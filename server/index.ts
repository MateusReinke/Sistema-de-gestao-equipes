import { config, validarConfig } from './config';
import { criarApp } from './app';
import { metodosDisponiveis } from './auth/configuracao';
import { limparExpirados } from './auth/sessao';
import { sql } from './db/index';

validarConfig();

const app = await criarApp();

// Sessões e estados de OIDC vencidos não se apagam sozinhos.
const faxina = setInterval(() => {
  limparExpirados().catch((erro) => app.log.warn({ erro }, 'falha ao limpar expirados'));
}, 15 * 60_000);

async function encerrar(sinal: string): Promise<void> {
  app.log.info(`${sinal} recebido, encerrando`);
  clearInterval(faxina);
  await app.close();
  await sql.end();
  process.exit(0);
}

process.on('SIGTERM', () => void encerrar('SIGTERM'));
process.on('SIGINT', () => void encerrar('SIGINT'));

await app.listen({ port: config.porta, host: '0.0.0.0' });

const metodos = await metodosDisponiveis();
const formas = [metodos.senhaLocal && 'senha local', metodos.sso && 'SSO'].filter(Boolean);

console.log(
  `Lumini API em http://localhost:${config.porta} · entrada por ${formas.join(' e ') || 'nenhum método (configure em Administração)'}`,
);
if (metodos.senhaLocalForcada) {
  console.warn('[auth] senha local ligada por ALLOW_LOCAL_LOGIN, apesar de desativada na tela.');
}
