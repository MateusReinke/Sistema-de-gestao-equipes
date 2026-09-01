/**
 * Configuração vinda do ambiente.
 *
 * Aqui ficam só as coisas que pertencem ao *ambiente*: onde está o banco, qual
 * a URL pública, qual a chave que cifra segredos. A configuração de
 * autenticação — se há SSO, qual o provedor — mora no banco e é editada pela
 * própria aplicação, para não exigir redeploy a cada ajuste.
 *
 * Falha no boot quando falta algo obrigatório: melhor o container não subir do
 * que subir e quebrar quando alguém tentar entrar.
 */
import { randomBytes } from 'node:crypto';

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

const ambiente = opcional('NODE_ENV', 'development');

/**
 * Fora de produção, uma chave aleatória por processo evita ter de configurar
 * qualquer coisa para rodar local. O custo é que um segredo de SSO salvo em
 * desenvolvimento não é lido depois de reiniciar — aceitável, e avisado.
 */
function chaveDeSegredos(): string {
  const doAmbiente = process.env.APP_SECRET_KEY;
  if (doAmbiente) return doAmbiente;

  if (ambiente === 'production') {
    throw new Error(
      'APP_SECRET_KEY é obrigatória em produção: é a chave que cifra o client secret do SSO. ' +
        'Gere uma com: openssl rand -base64 48',
    );
  }

  console.warn(
    '[config] APP_SECRET_KEY ausente — usando chave efêmera. Segredos de SSO salvos agora ' +
      'não serão legíveis após reiniciar.',
  );
  return randomBytes(48).toString('base64');
}

export const config = {
  ambiente,
  porta: Number(opcional('PORT', '3000')),
  /** URL pública da aplicação — base do redirect do SSO. */
  urlPublica: opcional('APP_URL', 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: obrigatoria('DATABASE_URL'),
  chaveSegredos: chaveDeSegredos(),

  /**
   * Valores usados apenas para semear a configuração de autenticação no
   * primeiro boot de uma base vazia. Depois disso, quem manda é o banco.
   */
  oidcInicial: {
    issuer: process.env.OIDC_ISSUER,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    escopo: opcional('OIDC_SCOPE', 'openid profile email'),
  },

  /**
   * Válvula de escape: força o login por senha mesmo que ele tenha sido
   * desligado na tela. É o que destranca a porta se o provedor de identidade
   * cair depois que o SSO virou o único caminho.
   */
  forcarLoginLocal: opcional('ALLOW_LOCAL_LOGIN', '') === 'true',

  sessao: {
    cookie: 'lumini_sessao',
    /** Duração da sessão. Oito horas cobrem um expediente sem novo login. */
    duracaoHoras: Number(opcional('SESSION_HOURS', '8')),
  },
} as const;

export function validarConfig(): void {
  if (config.ambiente === 'production' && config.urlPublica.startsWith('http://')) {
    throw new Error('APP_URL precisa usar https em produção: o cookie de sessão exige.');
  }
}
