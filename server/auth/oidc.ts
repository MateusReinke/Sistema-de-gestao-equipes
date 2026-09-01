/**
 * Login por SSO corporativo (OpenID Connect).
 *
 * Fluxo authorization code com PKCE. O provedor é quem autentica; aqui só
 * confiamos no e-mail verificado que ele devolve e o casamos com o cadastro de
 * usuário. Quem não tem cadastro não entra, mesmo com login válido no provedor
 * — o acesso ao sistema é concedido pelo RH, não pelo diretório.
 *
 * A configuração vem do banco (ver `configuracao.ts`), então ligar ou trocar o
 * provedor não exige redeploy.
 */
import { randomBytes } from 'node:crypto';
import * as client from 'openid-client';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/index';
import * as t from '../db/schema';
import { clientSecret, lerConfiguracao, metodosDisponiveis } from './configuracao';

export class SsoIndisponivel extends Error {}
export class LoginRecusado extends Error {}

/**
 * Descoberta do provedor, guardada em cache.
 *
 * A chave inclui issuer e client id: mudar qualquer um pela tela invalida o
 * cache sozinho, sem precisar reiniciar o processo.
 */
let cacheDescoberta: { chave: string; configuracao: client.Configuration } | null = null;

async function obterConfiguracao(): Promise<client.Configuration> {
  const cfg = await lerConfiguracao();
  const segredo = await clientSecret();

  if (!cfg.oidc_issuer || !cfg.oidc_client_id || !segredo) {
    throw new SsoIndisponivel('SSO não configurado.');
  }

  const chave = `${cfg.oidc_issuer}|${cfg.oidc_client_id}`;
  if (cacheDescoberta?.chave === chave) return cacheDescoberta.configuracao;

  const configuracao = await client.discovery(
    new URL(cfg.oidc_issuer),
    cfg.oidc_client_id,
    segredo,
  );
  cacheDescoberta = { chave, configuracao };
  return configuracao;
}

export function limparCacheDescoberta(): void {
  cacheDescoberta = null;
}

export const urlDeRetorno = () => `${config.urlPublica}/api/auth/callback`;

/**
 * Testa uma configuração sem gravá-la: busca o documento de descoberta e
 * confere que o provedor oferece o que o fluxo precisa.
 *
 * É o que permite ao administrador validar antes de ligar o SSO — e é o que
 * autoriza desligar a senha local depois.
 */
export async function testarDescoberta(entrada: {
  issuer: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ ok: true; emissor: string; suportaLogout: boolean } | { ok: false; erro: string }> {
  try {
    const descoberto = await client.discovery(
      new URL(entrada.issuer),
      entrada.clientId,
      entrada.clientSecret,
    );
    const meta = descoberto.serverMetadata();

    if (!meta.authorization_endpoint || !meta.token_endpoint) {
      return { ok: false, erro: 'O provedor não expõe os endpoints de autorização e token.' };
    }

    return {
      ok: true,
      emissor: meta.issuer,
      suportaLogout: Boolean(meta.end_session_endpoint),
    };
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    return { ok: false, erro: `Não foi possível falar com o provedor: ${detalhe}` };
  }
}

export interface InicioLogin {
  url: string;
  state: string;
}

/**
 * Monta a URL de autorização e guarda o estado do PKCE no banco.
 *
 * O verifier fica no banco, e não num cookie, para que o fluxo funcione mesmo
 * se o provedor devolver o usuário em outra aba.
 */
export async function iniciarLogin(destino: string): Promise<InicioLogin> {
  const metodos = await metodosDisponiveis();
  if (!metodos.sso) throw new SsoIndisponivel('SSO não está ativo nesta instalação.');

  const cfg = await lerConfiguracao();
  const oidc = await obterConfiguracao();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const nonce = client.randomNonce();
  const state = randomBytes(24).toString('hex');

  await db.insert(t.oidcEstados).values({
    state,
    code_verifier: codeVerifier,
    nonce,
    destino,
    criado_em: new Date().toISOString(),
  });

  const url = client.buildAuthorizationUrl(oidc, {
    redirect_uri: urlDeRetorno(),
    scope: cfg.oidc_escopo,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    nonce,
    state,
  });

  return { url: url.href, state };
}

export interface ResultadoLogin {
  usuarioId: string;
  idToken?: string;
  destino: string;
}

/** Valida o retorno do provedor e resolve o usuário interno correspondente. */
export async function concluirLogin(urlAtual: URL): Promise<ResultadoLogin> {
  const oidc = await obterConfiguracao();
  const state = urlAtual.searchParams.get('state');
  if (!state) throw new LoginRecusado('Retorno do provedor sem state.');

  const [estado] = await db
    .select()
    .from(t.oidcEstados)
    .where(eq(t.oidcEstados.state, state))
    .limit(1);
  if (!estado) throw new LoginRecusado('Estado de login expirado. Tente entrar novamente.');

  // Estado é de uso único: consumir aqui impede replay do mesmo callback.
  await db.delete(t.oidcEstados).where(eq(t.oidcEstados.state, state));

  const tokens = await client.authorizationCodeGrant(oidc, urlAtual, {
    pkceCodeVerifier: estado.code_verifier,
    expectedNonce: estado.nonce,
    expectedState: state,
  });

  const claims = tokens.claims();
  const email = String(claims?.email ?? '').toLowerCase().trim();
  if (!email) {
    throw new LoginRecusado(
      'O provedor não devolveu e-mail. Verifique se o escopo "email" está liberado na aplicação.',
    );
  }
  // Um e-mail não verificado pode ser digitado por qualquer um no diretório.
  if (claims?.email_verified === false) {
    throw new LoginRecusado('E-mail ainda não verificado no provedor de identidade.');
  }

  const [usuario] = await db.select().from(t.usuarios).where(eq(t.usuarios.email, email)).limit(1);
  if (!usuario) {
    throw new LoginRecusado(`${email} não tem acesso liberado à central. Procure o RH.`);
  }
  if (!usuario.ativo) {
    throw new LoginRecusado('Acesso desativado. Procure o RH.');
  }

  return { usuarioId: usuario.id, idToken: tokens.id_token, destino: estado.destino };
}

/**
 * URL de logout no provedor, quando ele suporta RP-initiated logout. Sem isso,
 * sair da central deixaria a sessão do SSO viva no navegador.
 */
export async function urlDeLogout(idToken?: string): Promise<string | null> {
  const metodos = await metodosDisponiveis();
  if (!metodos.sso) return null;

  try {
    const oidc = await obterConfiguracao();
    if (!oidc.serverMetadata().end_session_endpoint) return null;

    const url = client.buildEndSessionUrl(oidc, {
      post_logout_redirect_uri: config.urlPublica,
      ...(idToken ? { id_token_hint: idToken } : {}),
    });
    return url.href;
  } catch {
    // Provedor fora do ar não deve impedir alguém de sair da central.
    return null;
  }
}
