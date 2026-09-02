/**
 * Semeia o catálogo de sistemas com os mais comuns numa operação de TI.
 *
 * Sem isto, uma instalação nova chega com "Solicitações de acesso" vazio e
 * cada sistema precisa ser cadastrado à mão antes da primeira solicitação —
 * roda no start do container, depois do bootstrap do admin, e só age se o
 * catálogo estiver vazio, então repetir em todo deploy não duplica nada.
 * Quem já tem sistema cadastrado não é tocado.
 *
 * Uso:
 *   npm run db:bootstrap-sistemas
 */
import { sql as sqlOp } from 'drizzle-orm';
import { db, sql } from './index';
import * as t from './schema';
import { novoId } from '../auditoria';

const CATALOGO_PADRAO: {
  nome: string;
  categoria: (typeof t.sistemas.$inferInsert)['categoria'];
  descricao: string;
}[] = [
  { nome: 'Microsoft Azure', categoria: 'infraestrutura', descricao: 'Portal e assinaturas na nuvem Microsoft.' },
  { nome: 'AWS', categoria: 'infraestrutura', descricao: 'Console e contas na nuvem Amazon.' },
  { nome: 'Zabbix', categoria: 'infraestrutura', descricao: 'Monitoramento de infraestrutura e alertas.' },
  { nome: 'GLPI', categoria: 'atendimento', descricao: 'Chamados, inventário e ativos de TI.' },
  { nome: 'Google Workspace', categoria: 'comunicacao', descricao: 'E-mail, Drive e agenda corporativos.' },
  { nome: 'VPN corporativa', categoria: 'infraestrutura', descricao: 'Acesso remoto à rede interna.' },
  { nome: 'Active Directory', categoria: 'infraestrutura', descricao: 'Autenticação e contas de rede interna.' },
];

try {
  const [{ total }] = await db.select({ total: sqlOp<number>`count(*)::int` }).from(t.sistemas);

  if (total > 0) {
    console.log(`Já existem sistemas cadastrados (${total}). Seed do catálogo ignorado.`);
    process.exit(0);
  }

  // O catálogo exige um responsável — pega qualquer funcionário existente
  // (o bootstrap do admin, se rodou antes, garante ao menos um). Sem
  // funcionário nenhum não há a quem atribuir, então não seme nada ainda.
  const [responsavel] = await db.select({ id: t.funcionarios.id }).from(t.funcionarios).limit(1);
  if (!responsavel) {
    console.log('Nenhum funcionário cadastrado ainda. Seed do catálogo de sistemas adiado.');
    process.exit(0);
  }

  await db.insert(t.sistemas).values(
    CATALOGO_PADRAO.map((s) => ({
      id: novoId('s'),
      nome: s.nome,
      categoria: s.categoria,
      descricao: s.descricao,
      responsavel_id: responsavel.id,
      requer_aprovacao_gestor: false,
      ativo: true,
    })),
  );

  console.log(`✓ catálogo semeado com ${CATALOGO_PADRAO.length} sistemas comuns.`);
} catch (erro) {
  console.error('✗ falha ao semear catálogo de sistemas:', erro);
  process.exitCode = 1;
} finally {
  await sql.end();
}
