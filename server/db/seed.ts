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
import { gerarHash } from '../auth/senha';

/** Senha dos perfis de demonstração. Só existe em base semeada. */
const SENHA_DEMONSTRACAO = 'central-demo-2026';

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

  // Todo usuário da demonstração recebe a mesma senha conhecida. Serve para
  // desenvolvimento e homologação; numa base real o acesso é criado pela tela
  // de administração, que emite senha temporária individual.
  const hash = await gerarHash(SENHA_DEMONSTRACAO);
  await inserir(
    t.usuarios,
    dados.usuarios.map((u) => ({ ...u, senha_hash: hash, deve_trocar_senha: false })),
    'usuários',
  );

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
  console.log(`\n  Entre com qualquer e-mail abaixo e a senha: ${SENHA_DEMONSTRACAO}`);
  for (const u of dados.usuarios) {
    const nome = dados.funcionarios.find((f) => f.id === u.funcionario_id)?.nome ?? '';
    console.log(`    ${u.email.padEnd(34)} ${u.role.padEnd(12)} ${nome}`);
  }
} catch (erro) {
  console.error('✗ falha no seed:', erro);
  process.exitCode = 1;
} finally {
  await sql.end();
}
