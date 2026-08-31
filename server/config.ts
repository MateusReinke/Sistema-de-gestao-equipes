/**
 * Configuração vinda do ambiente.
 *
 * Falha no boot quando falta algo obrigatório: melhor o container não subir do
 * que subir e só quebrar quando alguém tentar entrar.
 */

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Variável de ambiente ${nome} não definida. Veja .env.example para a lista completa.`,
    );
  }
  return valor;
}

function opcional(nome: string, padrao: string): string {
  return process.env[nome] ?? padrao;
}

export const config = {
  ambiente: opcional('NODE_ENV', 'development'),
  porta: Number(opcional('PORT', '3000')),
  /** URL pública da aplicação — base do redirect do SSO. */
  urlPublica: opcional('APP_URL', 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: obrigatoria('DATABASE_URL'),

  oidc: {
    /** URL do emissor, ex.: https://login.microsoftonline.com/<tenant>/v2.0 */
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    escopo: opcional('OIDC_SCOPE', 'openid profile email'),
  },

  /**
   * Sem OIDC configurado o servidor sobe em modo de demonstração, com login
   * por seleção de perfil. Serve para desenvolvimento — em produção o boot
   * exige o SSO.
   */
  get ssoConfigurado(): boolean {
    return Boolean(this.oidc.issuer && this.oidc.clientId && this.oidc.clientSecret);
  },

  sessao: {
    cookie: 'lumini_sessao',
    /** Duração da sessão. Oito horas cobre um expediente sem re-login. */
    duracaoHoras: Number(opcional('SESSION_HOURS', '8')),
  },
} as const;

/** Em produção, subir sem SSO deixaria a base aberta a qualquer um. */
export function validarConfig(): void {
  if (config.ambiente === 'production' && !config.ssoConfigurado) {
    throw new Error(
      'Em produção é obrigatório configurar OIDC_ISSUER, OIDC_CLIENT_ID e OIDC_CLIENT_SECRET.',
    );
  }
  if (config.ambiente === 'production' && config.urlPublica.startsWith('http://')) {
    throw new Error('APP_URL precisa usar https em produção: o cookie de sessão exige.');
  }
}
