/**
 * Ações que mexem em mais de uma tabela e por isso não cabem no CRUD genérico:
 * decidir uma solicitação e registrar um desligamento.
 *
 * Ambas rodam em transação — aprovar uma troca sem reescalar o substituto, ou
 * desligar alguém sem revogar o acesso, deixaria o sistema em estado
 * inconsistente.
 */
import { and, eq, gte, inArray, lte, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index';
import * as t from '../db/schema';
import { novoId, registrar } from '../auditoria';
import { ehRh, exigir, alcancaFuncionario } from '../auth/permissoes';
import { exigirSessao } from './auth';
import { MAXIMO_SEMANAS, turnoDoDia } from '@/lib/cicloEscala';
import { diasDoIntervalo } from '@/lib/projecaoEscala';
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

    /*
     * Tudo o que a conta precisa: o cadastro de cada pessoa (grade + data
     * inicial), os ajustes de dia solto e a legenda da equipe. É o mesmo
     * material que a tela usa — o que se vê no calendário é o que é gravado.
     */
    const [cadastros, excecoes, tiposTurno] = await Promise.all([
      db
        .select()
        .from(t.escalaCadastros)
        .where(inArray(t.escalaCadastros.funcionario_id, funcionarioIds)),
      db
        .select()
        .from(t.escalaExcecoes)
        .where(
          and(
            inArray(t.escalaExcecoes.funcionario_id, funcionarioIds),
            gte(t.escalaExcecoes.data, de),
            lte(t.escalaExcecoes.data, ate),
          ),
        ),
      db.select().from(t.tiposTurno).where(eq(t.tiposTurno.equipe_id, equipe.id)),
    ]);

    const celulas = cadastros.length
      ? await db
          .select()
          .from(t.escalaCelulas)
          .where(
            inArray(
              t.escalaCelulas.cadastro_id,
              cadastros.map((c) => c.id),
            ),
          )
      : [];

    const turnoPorId = new Map(tiposTurno.map((x) => [x.id, x]));
    const excecaoPorDia = new Map(excecoes.map((x) => [`${x.funcionario_id}|${x.data}`, x]));

    const celulasPorCadastro = new Map<string, typeof celulas>();
    for (const celula of celulas) {
      const lista = celulasPorCadastro.get(celula.cadastro_id) ?? [];
      lista.push(celula);
      celulasPorCadastro.set(celula.cadastro_id, lista);
    }

    const dias = diasDoIntervalo(de, ate);

    /** As janelas que um turno ocupa no dia: trabalho, acionamento, ou as duas. */
    const janelasDoTurno = (turno: (typeof tiposTurno)[number]) =>
      [
        turno.trabalha
          ? { inicio: turno.hora_inicio, fim: turno.hora_fim, tipo: turno.tipo_plantao }
          : null,
        turno.acionamento !== 'nenhum'
          ? {
              inicio: turno.acionamento_inicio,
              fim: turno.acionamento_fim,
              tipo: turno.acionamento === 'plantao' ? ('sobreaviso' as const) : ('backup' as const),
            }
          : null,
      ].filter((j): j is NonNullable<typeof j> => j !== null);

    let criados = 0;
    let atualizados = 0;
    let pulados = 0;

    await db.transaction(async (tx) => {
      for (const cadastro of cadastros) {
        const grade = celulasPorCadastro.get(cadastro.id) ?? [];
        if (grade.length === 0) continue;

        for (const data of dias) {
          // O ajuste manual do dia vence o ciclo, e é materializado depois.
          if (excecaoPorDia.has(`${cadastro.funcionario_id}|${data}`)) continue;

          const tipoTurnoId = turnoDoDia({ inicio_em: cadastro.inicio_em, celulas: grade }, data);
          const turno = tipoTurnoId ? turnoPorId.get(tipoTurnoId) : undefined;
          if (!turno) continue;

          for (const janela of janelasDoTurno(turno)) {
            const [existente] = await tx
              .select({
                id: t.plantoes.id,
                gerado_automaticamente: t.plantoes.gerado_automaticamente,
              })
              .from(t.plantoes)
              .where(
                and(
                  eq(t.plantoes.funcionario_id, cadastro.funcionario_id),
                  eq(t.plantoes.data, data),
                  eq(t.plantoes.hora_inicio, janela.inicio),
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
                  hora_fim: janela.fim,
                  tipo: janela.tipo,
                  tipo_turno_id: turno.id,
                  gerado_automaticamente: true,
                })
                .where(eq(t.plantoes.id, existente.id));
              atualizados++;
              continue;
            }

            await tx.insert(t.plantoes).values({
              id: novoId('p'),
              funcionario_id: cadastro.funcionario_id,
              data,
              hora_inicio: janela.inicio,
              hora_fim: janela.fim,
              tipo: janela.tipo,
              tipo_turno_id: turno.id,
              status: data < hoje() ? 'confirmado' : 'previsto',
              gerado_automaticamente: true,
            });
            criados++;
          }
        }
      }

      /*
       * O que os ajustes pedem entra por último. Um ajuste sem turno esvazia o
       * dia: ele simplesmente não gera plantão, e o que uma rodada anterior
       * tenha criado ali é retirado.
       */
      for (const excecao of excecoes) {
        await tx
          .delete(t.plantoes)
          .where(
            and(
              eq(t.plantoes.funcionario_id, excecao.funcionario_id),
              eq(t.plantoes.data, excecao.data),
              eq(t.plantoes.gerado_automaticamente, true),
            ),
          );

        const turno = excecao.tipo_turno_id ? turnoPorId.get(excecao.tipo_turno_id) : undefined;
        if (!turno) continue;

        for (const janela of janelasDoTurno(turno)) {
          await tx.insert(t.plantoes).values({
            id: novoId('p'),
            funcionario_id: excecao.funcionario_id,
            tipo_turno_id: turno.id,
            data: excecao.data,
            hora_inicio: janela.inicio,
            hora_fim: janela.fim,
            tipo: janela.tipo,
            status: excecao.data < hoje() ? 'confirmado' : 'previsto',
            // Nasceu de um ajuste manual, mas é a geração que o materializa:
            // marcar como automático deixa a próxima rodada reconciliar.
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

  /**
   * Substitui o ciclo inteiro de uma pessoa, de uma vez.
   *
   * A tela pinta a grade célula a célula, e o ciclo cresce e encolhe junto com
   * as semanas preenchidas. Fazer isso pelo CRUD genérico seria um PUT ou
   * DELETE por clique, capaz de deixar a grade pela metade se um deles
   * falhasse — e uma grade pela metade muda o tamanho do ciclo, ou seja, muda
   * todo o resto do calendário. Aqui a grade chega inteira e é trocada numa
   * transação só.
   */
  app.put<{
    Params: { id: string };
    Body: {
      inicio_em?: string;
      celulas?: { semana: number; dia_semana: number; tipo_turno_id: string }[];
    };
  }>('/api/funcionarios/:id/ciclo', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(ehRh(sessao), 'Só o RH e a administração alteram o cadastro da escala.');

    const [funcionario] = await db
      .select()
      .from(t.funcionarios)
      .where(eq(t.funcionarios.id, req.params.id))
      .limit(1);
    if (!funcionario) return reply.code(404).send({ erro: 'Funcionário não encontrado.' });

    const inicioEm = req.body?.inicio_em ?? '';
    if (!DATA_ISO.test(inicioEm)) {
      return reply.code(400).send({ erro: '"inicio_em" precisa ser uma data ISO válida.' });
    }

    const celulas = req.body?.celulas ?? [];
    const foraDoCiclo = celulas.find((c) => c.semana < 1 || c.semana > MAXIMO_SEMANAS);
    if (foraDoCiclo) {
      return reply
        .code(400)
        .send({ erro: `A semana precisa estar entre 1 e ${MAXIMO_SEMANAS}.` });
    }
    const foraDaSemana = celulas.find((c) => c.dia_semana < 0 || c.dia_semana > 6);
    if (foraDaSemana) {
      return reply
        .code(400)
        .send({ erro: 'Dia da semana precisa estar entre 0 (domingo) e 6 (sábado).' });
    }

    // Uma célula apontando para turno de outra equipe pintaria uma cor que a
    // legenda desta equipe não tem — e sumiria do calendário.
    const legenda = await db
      .select({ id: t.tiposTurno.id })
      .from(t.tiposTurno)
      .where(eq(t.tiposTurno.equipe_id, funcionario.equipe_id));
    const daEquipe = new Set(legenda.map((x) => x.id));
    const intrusa = celulas.find((c) => !daEquipe.has(c.tipo_turno_id));
    if (intrusa) {
      return reply
        .code(400)
        .send({ erro: 'Turno não pertence à legenda da equipe desta pessoa.' });
    }

    const cadastroId = await db.transaction(async (tx) => {
      const [existente] = await tx
        .select()
        .from(t.escalaCadastros)
        .where(eq(t.escalaCadastros.funcionario_id, funcionario.id))
        .limit(1);

      const id = existente?.id ?? novoId('ec');
      if (existente) {
        await tx
          .update(t.escalaCadastros)
          .set({ inicio_em: inicioEm })
          .where(eq(t.escalaCadastros.id, id));
        await tx.delete(t.escalaCelulas).where(eq(t.escalaCelulas.cadastro_id, id));
      } else {
        await tx
          .insert(t.escalaCadastros)
          .values({ id, funcionario_id: funcionario.id, inicio_em: inicioEm, observacao: '' });
      }

      if (celulas.length > 0) {
        await tx.insert(t.escalaCelulas).values(
          celulas.map((c) => ({
            id: novoId('ecl'),
            cadastro_id: id,
            semana: c.semana,
            dia_semana: c.dia_semana,
            tipo_turno_id: c.tipo_turno_id,
          })),
        );
      }
      return id;
    });

    const semanas = celulas.reduce((maior, c) => Math.max(maior, c.semana), 0);
    await registrar(sessao, {
      acao: 'atualizou',
      entidade: 'Cadastro de escala',
      entidade_id: cadastroId,
      descricao: `${funcionario.nome}: ciclo de ${semanas} semana(s), a partir de ${inicioEm}`,
    });

    return reply.send({ cadastro_id: cadastroId, semanas, celulas: celulas.length });
  });

  /**
   * Apaga o cadastro de escala de uma pessoa — a grade e a data inicial.
   *
   * É o "limpar e começar de novo": sem cadastro, a pessoa continua na equipe,
   * só não é projetada em dia nenhum. Os plantões que já foram gerados ficam
   * onde estão, porque apagá-los junto varreria histórico que outras telas
   * (trocas, aprovações) ainda referenciam.
   */
  app.delete<{ Params: { id: string } }>('/api/funcionarios/:id/ciclo', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(ehRh(sessao), 'Só o RH e a administração apagam o cadastro da escala.');

    const [funcionario] = await db
      .select()
      .from(t.funcionarios)
      .where(eq(t.funcionarios.id, req.params.id))
      .limit(1);
    if (!funcionario) return reply.code(404).send({ erro: 'Funcionário não encontrado.' });

    const [cadastro] = await db
      .select()
      .from(t.escalaCadastros)
      .where(eq(t.escalaCadastros.funcionario_id, funcionario.id))
      .limit(1);
    if (!cadastro) return reply.send({ apagado: false });

    // As células somem junto, por cascata da FK.
    await db.delete(t.escalaCadastros).where(eq(t.escalaCadastros.id, cadastro.id));

    await registrar(sessao, {
      acao: 'removeu',
      entidade: 'Cadastro de escala',
      entidade_id: cadastro.id,
      descricao: `Cadastro de escala de ${funcionario.nome} apagado`,
    });

    return reply.send({ apagado: true });
  });
}
