/**
 * Ações que mexem em mais de uma tabela e por isso não cabem no CRUD genérico:
 * decidir uma solicitação e registrar um desligamento.
 *
 * Ambas rodam em transação — aprovar uma troca sem reescalar o substituto, ou
 * desligar alguém sem revogar o acesso, deixaria o sistema em estado
 * inconsistente.
 */
import { and, eq, gte, inArray, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index';
import * as t from '../db/schema';
import { novoId, registrar } from '../auditoria';
import { ehRh, exigir, alcancaFuncionario } from '../auth/permissoes';
import { exigirSessao } from './auth';
import { plantoesGerados } from '@/lib/geracaoPlantoes';
import { hoje } from '@/lib/date';

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

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
            // Nasceu da aprovação da troca, não do motor de rodízio: uma
            // geração futura não deve mexer nela.
            gerado_automaticamente: false,
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

  /**
   * Aplica o rodízio de uma equipe sobre um período: projeta o template de
   * cada `escala_funcionarios` ativo e grava os plantões resultantes — o
   * botão que substitui lançar plantão um por um.
   *
   * Nunca atropela um plantão lançado à mão (`gerado_automaticamente =
   * false`) sem `sobrescrever`; um plantão que a própria geração criou antes
   * é só atualizado, para uma segunda rodada no mesmo período não duplicar.
   */
  app.post<{
    Params: { id: string };
    Body: { de?: string; ate?: string; sobrescrever?: boolean };
  }>('/api/equipes/:id/gerar-plantoes', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(ehRh(sessao), 'Só o RH e a administração geram plantões em lote.');

    const [equipe] = await db.select().from(t.equipes).where(eq(t.equipes.id, req.params.id)).limit(1);
    if (!equipe) return reply.code(404).send({ erro: 'Equipe não encontrada.' });

    const de = req.body?.de ?? '';
    const ate = req.body?.ate ?? '';
    if (!DATA_ISO.test(de) || !DATA_ISO.test(ate) || de > ate) {
      return reply.code(400).send({ erro: '"de" e "ate" precisam ser datas ISO válidas, com "de" não posterior a "ate".' });
    }
    const sobrescrever = req.body?.sobrescrever === true;

    const funcionarios = await db
      .select({ id: t.funcionarios.id })
      .from(t.funcionarios)
      .where(and(eq(t.funcionarios.equipe_id, equipe.id), ne(t.funcionarios.status, 'desligado')));
    const funcionarioIds = funcionarios.map((f) => f.id);

    if (funcionarioIds.length === 0) {
      return reply.send({ criados: 0, atualizados: 0, pulados: 0 });
    }

    const vinculos = await db
      .select()
      .from(t.escalaFuncionarios)
      .where(inArray(t.escalaFuncionarios.funcionario_id, funcionarioIds));

    const escalaIds = [...new Set(vinculos.map((v) => v.escala_id))];
    const [escalas, detalhes] = escalaIds.length
      ? await Promise.all([
          db.select().from(t.escalas).where(inArray(t.escalas.id, escalaIds)),
          db.select().from(t.escalaDetalhes).where(inArray(t.escalaDetalhes.escala_id, escalaIds)),
        ])
      : [[], []];

    const escalaPorId = new Map(escalas.map((e) => [e.id, e]));
    const detalhesPorEscala = new Map<string, typeof detalhes>();
    for (const d of detalhes) {
      const lista = detalhesPorEscala.get(d.escala_id) ?? [];
      lista.push(d);
      detalhesPorEscala.set(d.escala_id, lista);
    }

    let criados = 0;
    let atualizados = 0;
    let pulados = 0;

    await db.transaction(async (tx) => {
      for (const vinculo of vinculos) {
        const escala = escalaPorId.get(vinculo.escala_id);
        if (!escala || !escala.ativo) continue;

        const candidatos = plantoesGerados(
          vinculo,
          detalhesPorEscala.get(escala.id) ?? [],
          escala.ciclo_semanas,
          de,
          ate,
        );

        for (const candidato of candidatos) {
          const [existente] = await tx
            .select({ id: t.plantoes.id, gerado_automaticamente: t.plantoes.gerado_automaticamente })
            .from(t.plantoes)
            .where(
              and(
                eq(t.plantoes.funcionario_id, candidato.funcionario_id),
                eq(t.plantoes.data, candidato.data),
                eq(t.plantoes.hora_inicio, candidato.hora_inicio),
              ),
            )
            .limit(1);

          if (existente) {
            if (!existente.gerado_automaticamente && !sobrescrever) {
              pulados++;
              continue;
            }
            await tx
              .update(t.plantoes)
              .set({
                hora_fim: candidato.hora_fim,
                tipo: candidato.tipo,
                escala_id: candidato.escala_id,
                gerado_automaticamente: true,
              })
              .where(eq(t.plantoes.id, existente.id));
            atualizados++;
            continue;
          }

          await tx.insert(t.plantoes).values({
            id: novoId('p'),
            funcionario_id: candidato.funcionario_id,
            escala_id: candidato.escala_id,
            data: candidato.data,
            hora_inicio: candidato.hora_inicio,
            hora_fim: candidato.hora_fim,
            tipo: candidato.tipo,
            status: candidato.data < hoje() ? 'confirmado' : 'previsto',
            gerado_automaticamente: true,
          });
          criados++;
        }
      }
    });

    await registrar(sessao, {
      acao: 'criou',
      entidade: 'Plantão (geração em lote)',
      entidade_id: equipe.id,
      descricao: `${equipe.nome}: ${criados} criados, ${atualizados} atualizados, ${pulados} pulados (${de} a ${ate})`,
    });

    return reply.send({ criados, atualizados, pulados });
  });
}
