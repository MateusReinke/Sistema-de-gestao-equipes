/**
 * Gerencia chaves de API para automação externa (n8n e afins).
 *
 * Hoje o caminho normal é a tela **Tokens de API**, onde cada pessoa emite o
 * seu e ele herda as permissões dela. Este script continua para o caso em que
 * não há ninguém logado para clicar: subir uma integração antes do primeiro
 * usuário existir, ou destravar automação com a aplicação fora do ar.
 *
 * A chave criada aqui não tem dono e, por isso, alcança só as rotas de leitura
 * `/api/n8n/*` — sem dono não há papel de quem herdar.
 *
 * Uso:
 *   npm run api:chave -- criar "n8n produção" [--dias 365]
 *   npm run api:chave -- listar
 *   npm run api:chave -- revogar <id>
 */
import { eq } from 'drizzle-orm';
import { db, sql } from './index';
import * as t from './schema';
import { gerarChaveApi } from '../auth/chaveApi';
import { novoId } from '../auditoria';

const [comando, ...args] = process.argv.slice(2);

function flag(nome: string): string | undefined {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
}

async function criar(): Promise<void> {
  const nome = args.find((a) => !a.startsWith('--'))?.trim();
  if (!nome) {
    throw new Error('Informe um nome para identificar a chave: npm run api:chave -- criar "n8n produção"');
  }

  const diasTexto = flag('--dias');
  const dias = diasTexto ? Number(diasTexto) : null;
  if (diasTexto && (!Number.isFinite(dias) || (dias as number) <= 0)) {
    throw new Error('--dias precisa ser um número de dias maior que zero.');
  }
  const expira_em = dias ? new Date(Date.now() + dias * 86_400_000).toISOString() : null;

  const { chave, hash, prefixo } = gerarChaveApi();
  const id = novoId('chaveapi');

  await db.insert(t.chavesApi).values({
    id,
    nome,
    prefixo,
    chave_hash: hash,
    ativo: true,
    criado_em: new Date().toISOString(),
    expira_em,
  });

  console.log('✓ chave de API criada:');
  console.log(`  id:    ${id}`);
  console.log(`  nome:  ${nome}`);
  console.log(`  chave: ${chave}`);
  console.log(`  expira: ${expira_em ?? 'nunca'}`);
  console.log('\nAnote a chave agora: ela não é gravada em claro e não aparece de novo.');
  console.log('Uso no n8n: cabeçalho HTTP "X-API-Key" com este valor.');
}

async function listar(): Promise<void> {
  const linhas = await db.select().from(t.chavesApi).orderBy(t.chavesApi.criado_em);
  if (linhas.length === 0) {
    console.log('Nenhuma chave de API cadastrada.');
    return;
  }

  for (const l of linhas) {
    const situacao = !l.ativo
      ? 'revogada'
      : l.expira_em && l.expira_em < new Date().toISOString()
        ? 'expirada'
        : 'ativa';
    console.log(`${l.id}  [${situacao}]  ${l.nome}  (${l.prefixo}…)`);
    console.log(
      `  criada em ${l.criado_em} · expira ${l.expira_em ?? 'nunca'} · último uso: ${l.ultimo_uso_em ?? 'nunca'}`,
    );
  }
}

async function revogar(): Promise<void> {
  const id = args[0];
  if (!id) throw new Error('Informe o id da chave: npm run api:chave -- revogar <id>');

  const [linha] = await db.update(t.chavesApi).set({ ativo: false }).where(eq(t.chavesApi.id, id)).returning();
  if (!linha) throw new Error(`Chave ${id} não encontrada.`);

  console.log(`✓ chave "${linha.nome}" (${id}) revogada — deixa de autenticar imediatamente.`);
}

function ajuda(): void {
  console.log('Uso:');
  console.log('  npm run api:chave -- criar "nome da chave" [--dias 365]');
  console.log('  npm run api:chave -- listar');
  console.log('  npm run api:chave -- revogar <id>');
}

try {
  if (comando === 'criar') await criar();
  else if (comando === 'listar') await listar();
  else if (comando === 'revogar') await revogar();
  else {
    ajuda();
    process.exitCode = comando ? 1 : 0;
  }
} catch (erro) {
  console.error('✗', erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await sql.end();
}
