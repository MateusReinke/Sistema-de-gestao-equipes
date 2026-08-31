/**
 * Carrega a massa de demonstração no Postgres.
 *
 * Reaproveita `src/data/seed.ts`, o mesmo arquivo que alimentava a versão sem
 * backend — inclusive a geração de plantões relativa a hoje, para que a agenda
 * nunca abra vazia.
 *
 * Uso:
 *   npm run db:seed              carrega em base vazia
 *   npm run db:seed -- --reset   apaga tudo antes de carregar
 */
import { getTableName, sql as sqlOp } from 'drizzle-orm';
import * as dados from '@/data/seed';
import { db, sql } from './index';
import * as t from './schema';

const reset = process.argv.includes('--reset');

/** Insere em lote, ignorando lista vazia (o insert do Drizzle recusaria). */
async function inserir<T extends object>(
  tabela: Parameters<typeof db.insert>[0],
  linhas: readonly T[],
  rotulo: string,
): Promise<void> {
  if (linhas.length === 0) return;
  await db.insert(tabela).values(linhas as never);
  console.log(`  ${String(linhas.length).padStart(4)} ${rotulo}`);
}

try {
  const [{ total }] = await db
    .select({ total: sqlOp<number>`count(*)::int` })
    .from(t.funcionarios);

  if (total > 0 && !reset) {
    console.log(
      `Base já tem ${total} funcionários. Use "npm run db:seed -- --reset" para recarregar.`,
    );
    process.exit(0);
  }

  if (reset) {
    // TRUNCATE CASCADE numa transação: a ordem das FKs deixa de importar.
    const nomes = t.tabelasNaOrdem.map((tabela) => `"${getTableName(tabela)}"`);
    await sql.unsafe(`TRUNCATE ${nomes.join(', ')} RESTART IDENTITY CASCADE`);
    console.log('· base limpa');
  }

  console.log('Carregando massa de demonstração:');

  await inserir(t.departamentos, dados.departamentos, 'departamentos');
  await inserir(t.equipes, dados.equipes, 'equipes');
  await inserir(t.funcionarios, dados.funcionarios, 'funcionários');
  await inserir(t.usuarios, dados.usuarios, 'usuários');

  await inserir(t.clientes, dados.clientes, 'clientes');
  await inserir(t.contatosCliente, dados.contatosCliente, 'contatos de cliente');
  await inserir(t.niveisEscalonamento, dados.niveisEscalonamento, 'níveis de escalonamento');
  await inserir(t.servicos, dados.servicos, 'serviços');
  await inserir(t.servicosContratados, dados.servicosContratados, 'serviços contratados');
  await inserir(t.atendimentoEquipes, dados.atendimentoEquipes, 'vínculos cliente-equipe');
  await inserir(t.avaliacoesCliente, dados.avaliacoesCliente, 'avaliações');

  await inserir(t.escalas, dados.escalas, 'escalas');
  await inserir(t.escalaDetalhes, dados.escalaDetalhes, 'turnos de escala');
  await inserir(t.escalaFuncionarios, dados.escalaFuncionarios, 'vínculos de escala');
  await inserir(t.plantoes, dados.plantoes, 'plantões');

  await inserir(t.ferias, dados.ferias, 'registros de férias');
  await inserir(t.ausencias, dados.ausencias, 'ausências');
  await inserir(t.sistemas, dados.sistemas, 'sistemas');
  await inserir(t.solicitacoesAcesso, dados.solicitacoesAcesso, 'solicitações de acesso');
  await inserir(t.trocasPlantao, dados.trocasPlantao, 'trocas de plantão');
  await inserir(t.comunicados, dados.comunicados, 'comunicados');

  console.log('✓ seed concluído');
} catch (erro) {
  console.error('✗ falha no seed:', erro);
  process.exitCode = 1;
} finally {
  await sql.end();
}
