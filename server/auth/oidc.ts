/**
 * Login por SSO corporativo (OpenID Connect).
 *
 * Fluxo authorization code com PKCE. O provedor é quem autentica; aqui só
 * confiamos no e-mail verificado que ele devolve e o casamos com o cadastro
 * de usuário. Quem não tem cadastro não entra, mesmo com login válido no
 * provedor — o acesso ao sistema é concedido pelo RH, não pelo diretório.
 */
import { randomBytes } from 'node:crypto';
import * as client from 'openid-client';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/index';
import * as t from '../db/schema';

let configuracao: client.Configuration | null = null;

/** Descoberta do provedor, feita uma vez e reaproveitada. */
async function obterConfiguracao(): Promise<client.Configuration> {
  if (configuracao) return configuracao;
  if (!config.ssoConfigurado) throw new Error('SSO não configurado.');

  configuracao = await client.discovery(
    new URL(config.oidc.issuer!),
    config.oidc.clientId!,
    config.oidc.clientSecret!,
  );
  return configuracao;
}

export const urlDeRetorno = () => `${config.urlPublica}/api/auth/callback`;

export interface InicioLogin {
  url: string;
  state: string;
}

/**
 * Monta a URL de autorização e guarda o estado do PKCE no banco.
 *
 * O verifier fica no banco, e não num cookie, para que o fluxo funcione mesmo
 * se o provedor devolver o usuário em outra aba ou instância do servidor.
 */
export async function iniciarLogin(destino: string): Promise<InicioLogin> {
  const cfg = await obterConfiguracao();

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

  const url = client.buildAuthorizationUrl(cfg, {
    redirect_uri: urlDeRetorno(),
    scope: config.oidc.escopo,
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

export class LoginRecusado extends Error {}

/** Valida o retorno do provedor e resolve o usuário interno correspondente. */
export async function concluirLogin(urlAtual: URL): Promise<ResultadoLogin> {
  const cfg = await obterConfiguracao();
  const state = urlAtual.searchParams.get('state');
  if (!state) throw new LoginRecusado('Retorno do provedor sem state.');

  const [estado] = await db.select().from(t.oidcEstados).where(eq(t.oidcEstados.state, state)).limit(1);
  if (!estado) throw new LoginRecusado('Estado de login expirado. Tente entrar novamente.');

  // Estado é de uso único: consumir aqui impede replay do mesmo callback.
  await db.delete(t.oidcEstados).where(eq(t.oidcEstados.state, state));

  const tokens = await client.authorizationCodeGrant(cfg, urlAtual, {
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

  return {
    usuarioId: usuario.id,
    idToken: tokens.id_token,
    destino: estado.destino,
  };
}

/**
 * URL de logout no provedor, quando ele suporta RP-initiated logout. Sem isso,
 * sair da central deixaria a sessão do SSO viva no navegador.
 */
export async function urlDeLogout(idToken?: string): Promise<string | null> {
  if (!config.ssoConfigurado) return null;
  const cfg = await obterConfiguracao();
  const meta = cfg.serverMetadata();
  if (!meta.end_session_endpoint) return null;

  const url = client.buildEndSessionUrl(cfg, {
    post_logout_redirect_uri: config.urlPublica,
    ...(idToken ? { id_token_hint: idToken } : {}),
  });
  return url.href;
}
