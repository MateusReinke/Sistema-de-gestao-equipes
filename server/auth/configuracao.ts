/**
 * Configuração de autenticação, guardada no banco.
 *
 * Fica aqui porque o administrador precisa ligar o SSO pela tela, sem editar
 * variável de ambiente nem redeployar. As variáveis `OIDC_*` do ambiente ainda
 * servem, mas só para semear a primeira linha numa base nova.
 */
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { db } from '../db/index';
import * as t from '../db/schema';
import { cifrar, decifrar } from './segredos';

export type ConfiguracaoAuth = typeof t.configuracaoAuth.$inferSelect;

/** Linha única. */
const ID = 1;

/**
 * Cache em memória.
 *
 * Cada requisição autenticada consulta esta configuração; relê-la do banco
 * toda vez seria desperdício. Toda escrita limpa o cache, e há um único
 * processo servindo — se um dia houver mais de uma réplica, isto vira um
 * `LISTEN/NOTIFY` ou um TTL curto.
 */
let cache: ConfiguracaoAuth | null = null;

export function limparCache(): void {
  cache = null;
}

export async function lerConfiguracao(): Promise<ConfiguracaoAuth> {
  if (cache) return cache;

  const [linha] = await db
    .select()
    .from(t.configuracaoAuth)
    .where(eq(t.configuracaoAuth.id, ID))
    .limit(1);

  if (linha) {
    cache = linha;
    return linha;
  }

  // Primeira vez: cria a linha, aproveitando o que houver no ambiente.
  const { issuer, clientId, clientSecret, escopo } = config.oidcInicial;
  const temAmbiente = Boolean(issuer && clientId && clientSecret);

  const [criada] = await db
    .insert(t.configuracaoAuth)
    .values({
      id: ID,
      senha_local_ativa: true,
      // Mesmo vindo do ambiente, o SSO começa desligado: ligar é uma decisão
      // consciente, tomada depois de testar a conexão pela tela.
      sso_ativo: false,
      oidc_issuer: issuer ?? null,
      oidc_client_id: clientId ?? null,
      oidc_client_secret: temAmbiente ? cifrar(clientSecret!) : null,
      oidc_escopo: escopo,
      atualizado_em: new Date().toISOString(),
    })
    .returning();

  cache = criada;
  return criada;
}

export interface MetodosLogin {
  /** Aceita e-mail e senha cadastrados na própria central. */
  senhaLocal: boolean;
  /** Aceita entrada pelo provedor de identidade. */
  sso: boolean;
  /** A senha local está ligada só pela válvula de escape do ambiente. */
  senhaLocalForcada: boolean;
}

export async function metodosDisponiveis(): Promise<MetodosLogin> {
  const cfg = await lerConfiguracao();
  const completo = Boolean(cfg.oidc_issuer && cfg.oidc_client_id && cfg.oidc_client_secret);

  return {
    senhaLocal: cfg.senha_local_ativa || config.forcarLoginLocal,
    sso: cfg.sso_ativo && completo,
    senhaLocalForcada: !cfg.senha_local_ativa && config.forcarLoginLocal,
  };
}

/** Client secret em claro, para uso no fluxo OIDC. */
export async function clientSecret(): Promise<string | null> {
  const cfg = await lerConfiguracao();
  return cfg.oidc_client_secret ? decifrar(cfg.oidc_client_secret) : null;
}

export interface AtualizacaoAuth {
  senha_local_ativa?: boolean;
  sso_ativo?: boolean;
  oidc_issuer?: string | null;
  oidc_client_id?: string | null;
  /** Texto puro; é cifrado aqui. `undefined` mantém o atual. */
  oidc_client_secret?: string | null;
  oidc_escopo?: string;
  sso_validado_em?: string | null;
}

export async function salvarConfiguracao(
  patch: AtualizacaoAuth,
  atorId: string,
): Promise<ConfiguracaoAuth> {
  await lerConfiguracao(); // garante que a linha existe

  const valores: Partial<typeof t.configuracaoAuth.$inferInsert> = {
    atualizado_em: new Date().toISOString(),
    atualizado_por: atorId,
  };

  if (patch.senha_local_ativa !== undefined) valores.senha_local_ativa = patch.senha_local_ativa;
  if (patch.sso_ativo !== undefined) valores.sso_ativo = patch.sso_ativo;
  if (patch.oidc_issuer !== undefined) valores.oidc_issuer = patch.oidc_issuer;
  if (patch.oidc_client_id !== undefined) valores.oidc_client_id = patch.oidc_client_id;
  if (patch.oidc_escopo !== undefined) valores.oidc_escopo = patch.oidc_escopo;
  if (patch.sso_validado_em !== undefined) valores.sso_validado_em = patch.sso_validado_em;

  if (patch.oidc_client_secret !== undefined) {
    valores.oidc_client_secret = patch.oidc_client_secret ? cifrar(patch.oidc_client_secret) : null;
  }

  const [atualizada] = await db
    .update(t.configuracaoAuth)
    .set(valores)
    .where(eq(t.configuracaoAuth.id, ID))
    .returning();

  limparCache();
  return atualizada;
}
