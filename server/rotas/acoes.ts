/**
 * Ações que mexem em mais de uma tabela e por isso não cabem no CRUD genérico:
 * decidir uma solicitação e registrar um desligamento.
 *
 * Ambas rodam em transação — aprovar uma troca sem reescalar o substituto, ou
 * desligar alguém sem revogar o acesso, deixaria o sistema em estado
 * inconsistente.
 */
import { and, eq, gte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index';
import * as t from '../db/schema';
import { novoId, registrar } from '../auditoria';
import { ehRh, exigir, alcancaFuncionario } from '../auth/permissoes';
import { exigirSessao } from './auth';
import { hoje } from '@/lib/date';

/** Tabelas por tipo de solicitação, como a Central de Aprovações as trata. */
const TABELA = {
  ferias: t.ferias,
  ausencia: t.ausencias,
  acesso: t.solicitacoesAcesso,
  troca: t.trocasPlantao,
} as const;

type TipoPendencia = keyof typeof TABELA;

const STATUS_VALIDOS = ['aprovada', 'rejeitada', 'cancelada', 'concluida'] as const;
type StatusDecisao = (typeof STATUS_VALIDOS)[number];

const ACAO = {
  aprovada: 'aprovou',
  rejeitada: 'rejeitou',
  cancelada: 'cancelou',
  concluida: 'atualizou',
} as const;

export function rotasAcoes(app: FastifyInstance): void {
  app.post<{
    Params: { tipo: string; id: string };
    Body: { status?: string; observacao?: string };
  }>('/api/solicitacoes/:tipo/:id/decidir', async (req, reply) => {
    const sessao = await exigirSessao(req);
    const tipo = req.params.tipo as TipoPendencia;
    const tabela = TABELA[tipo];
    if (!tabela) return reply.code(404).send({ erro: 'Tipo de solicitação desconhecido.' });

    const status = req.body?.status as StatusDecisao;
    if (!STATUS_VALIDOS.includes(status)) {
      return reply.code(400).send({ erro: 'Status de decisão inválido.' });
    }

    const observacao = req.body?.observacao?.trim() || undefined;
    // Rejeitar sem motivo deixa o solicitante sem saber o que corrigir.
    if (status === 'rejeitada' && (!observacao || observacao.length < 5)) {
      return reply.code(422).send({ erro: 'Descreva o motivo da rejeição.' });
    }

    const [alvo] = await db.select().from(tabela).where(eq(tabela.id, req.params.id)).limit(1);
    if (!alvo) return reply.code(404).send({ erro: 'Solicitação não encontrada.' });

    // Cancelar o próprio pedido é direito de quem pediu; decidir é do RH.
    if (status === 'cancelada') {
      exigir(
        ehRh(sessao) || (await alcancaFuncionario(sessao, alvo.funcionario_id)),
        'Você só pode cancelar solicitações suas ou da sua equipe.',
      );
    } else {
      exigir(ehRh(sessao), 'Só o RH e a administração decidem solicitações.');
    }

    if (alvo.status !== 'pendente' && status !== 'concluida') {
      return reply.code(409).send({ erro: `Solicitação já está ${alvo.status}.` });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(tabela)
        .set({
          status,
          decidido_por: sessao.funcionario.id,
          decidido_em: new Date().toISOString(),
          observacao_decisao: observacao,
        })
        .where(eq(tabela.id, req.params.id));

      // Troca aprovada precisa aparecer na escala: o titular sai, o
      // substituto entra no mesmo turno.
      if (tipo === 'troca' && status === 'aprovada') {
        const troca = alvo as typeof t.trocasPlantao.$inferSelect;
        const [original] = await tx
          .select()
          .from(t.plantoes)
          .where(eq(t.plantoes.id, troca.plantao_id))
          .limit(1);

        if (original) {
          await tx
            .update(t.plantoes)
            .set({ status: 'trocado' })
            .where(eq(t.plantoes.id, original.id));
          await tx.insert(t.plantoes).values({
            ...original,
            id: novoId('p'),
            funcionario_id: troca.substituto_id,
            status: 'confirmado',
          });
        }
      }

      // Férias aprovadas que já começaram mudam a situação do funcionário.
      if (tipo === 'ferias' && status === 'aprovada') {
        const f = alvo as typeof t.ferias.$inferSelect;
        const hojeIso = hoje();
        if (f.data_inicio <= hojeIso && f.data_fim >= hojeIso) {
          await tx
            .update(t.funcionarios)
            .set({ status: 'ferias' })
            .where(and(eq(t.funcionarios.id, f.funcionario_id), eq(t.funcionarios.status, 'ativo')));
        }
      }
    });

    await registrar(sessao, {
      acao: ACAO[status],
      entidade: tipo,
      entidade_id: req.params.id,
      descricao: `${alvo.protocolo} — ${status}`,
    });

    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string }; Body: { data?: string } }>(
    '/api/funcionarios/:id/desligar',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      exigir(ehRh(sessao), 'Só o RH e a administração registram desligamento.');

      const data = req.body?.data ?? hoje();
      const [alvo] = await db
        .select()
        .from(t.funcionarios)
        .where(eq(t.funcionarios.id, req.params.id))
        .limit(1);
      if (!alvo) return reply.code(404).send({ erro: 'Funcionário não encontrado.' });

      await db.transaction(async (tx) => {
        await tx
          .update(t.funcionarios)
          .set({ status: 'desligado', data_desligamento: data })
          .where(eq(t.funcionarios.id, req.params.id));

        // Plantões futuros viram furo de escala se ficarem no nome de quem saiu.
        await tx
          .delete(t.plantoes)
          .where(and(eq(t.plantoes.funcionario_id, req.params.id), gte(t.plantoes.data, data)));

        // Desligar sem cortar o acesso deixaria a pessoa entrando no sistema.
        const usuarios = await tx
          .update(t.usuarios)
          .set({ ativo: false })
          .where(eq(t.usuarios.funcionario_id, req.params.id))
          .returning({ id: t.usuarios.id });

        for (const u of usuarios) {
          await tx.delete(t.sessoes).where(eq(t.sessoes.usuario_id, u.id));
        }
      });

      await registrar(sessao, {
        acao: 'atualizou',
        entidade: 'Funcionário',
        entidade_id: req.params.id,
        descricao: `${alvo.nome} desligado em ${data}; acesso revogado`,
      });

      return reply.send({ ok: true });
    },
  );
}
