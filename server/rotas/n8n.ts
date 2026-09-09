/**
 * API de automação — pensada para n8n, mas é HTTP/JSON comum: qualquer
 * cliente serve (Make, Zapier, curl, outro serviço interno).
 *
 * Três perguntas concentram o uso real: quem está de plantão numa equipe
 * agora, qual o caminho de escalonamento de um cliente, e qual o grupo de
 * WhatsApp dele. As rotas abaixo respondem a essas perguntas diretamente, em
 * vez de expor as tabelas cruas e empurrar o cruzamento para o fluxo do n8n.
 *
 * Só leitura, de propósito: uma chave de API vazada não dá a quem a pegou
 * poder de alterar cadastro nenhum. A autenticação é por chave — ver
 * `auth/chaveApi.ts` — e não pela sessão de cookie que o resto da aplicação
 * usa, porque quem chama aqui não é um navegador.
 */
import { and, eq, ilike, inArray, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index';
import * as t from '../db/schema';
import { exigirChaveApi } from '../auth/chaveApi';
import { plantonistasDeEquipe, plantonistasPorEquipe, type Plantonista } from '../plantonistas';

type FuncionarioLinha = typeof t.funcionarios.$inferSelect;
type ContatoLinha = typeof t.contatosCliente.$inferSelect;

/** Cartão de contato: o suficiente para a automação acionar a pessoa direto. */
function resumoFuncionario(f: FuncionarioLinha | null | undefined) {
  if (!f) return null;
  return {
    id: f.id,
    nome: f.nome,
    email: f.email,
    telefone: f.telefone,
    cargo: f.cargo,
    equipe_id: f.equipe_id,
  };
}

function resumoContato(c: ContatoLinha | null | undefined) {
  if (!c) return null;
  return { id: c.id, nome: c.nome, cargo: c.cargo, email: c.email, telefone: c.telefone, tipo: c.tipo };
}

function comoPlantonista(p: Plantonista) {
  return {
    funcionario: resumoFuncionario(p.funcionario),
    plantao: {
      id: p.plantao.id,
      data: p.plantao.data,
      hora_inicio: p.plantao.hora_inicio,
      hora_fim: p.plantao.hora_fim,
      tipo: p.plantao.tipo,
      status: p.plantao.status,
    },
  };
}

/** `undefined` vira "agora"; texto inválido vira `null`, para o handler recusar com 400. */
function instanteDaConsulta(valor: unknown): Date | null {
  if (valor === undefined) return new Date();
  const instante = new Date(String(valor));
  return Number.isNaN(instante.getTime()) ? null : instante;
}

const ERRO_INSTANTE = 'Parâmetro "em" inválido: use uma data/hora ISO 8601, ex. 2026-09-09T14:30:00-03:00.';

export function rotasN8n(app: FastifyInstance): void {
  /* ------------------------------------------------------------------- equipes */

  /** Catálogo de equipes, para mapear nome → id antes de pedir o plantonista. */
  app.get('/api/n8n/equipes', async (req, reply) => {
    await exigirChaveApi(req);

    const gestorEquipe = alias(t.funcionarios, 'gestor_equipe');
    const linhas = await db
      .select({ equipe: t.equipes, gestor: gestorEquipe })
      .from(t.equipes)
      .leftJoin(gestorEquipe, eq(gestorEquipe.id, t.equipes.gestor_id))
      .orderBy(t.equipes.nome);

    return reply.send(
      linhas.map(({ equipe, gestor }) => ({
        id: equipe.id,
        nome: equipe.nome,
        departamento_id: equipe.departamento_id,
        cobertura_minima: equipe.cobertura_minima,
        ativo: equipe.ativo,
        gestor: resumoFuncionario(gestor),
      })),
    );
  });

  /** Quem está de plantão numa equipe específica, agora ou em `?em=`. */
  app.get<{ Params: { id: string }; Querystring: { em?: string } }>(
    '/api/n8n/equipes/:id/plantonista',
    async (req, reply) => {
      await exigirChaveApi(req);

      const [equipe] = await db.select().from(t.equipes).where(eq(t.equipes.id, req.params.id)).limit(1);
      if (!equipe) return reply.code(404).send({ erro: 'Equipe não encontrada.' });

      const instante = instanteDaConsulta(req.query.em);
      if (!instante) return reply.code(400).send({ erro: ERRO_INSTANTE });

      const plantonistas = await plantonistasDeEquipe(equipe.id, instante);

      return reply.send({
        equipe: { id: equipe.id, nome: equipe.nome },
        em: instante.toISOString(),
        plantonistas: plantonistas.map(comoPlantonista),
      });
    },
  );

  /**
   * Painel de plantonistas — todas as equipes de uma vez, ou um subconjunto
   * via `?equipe_id=eq1,eq2`. Equipe sem ninguém em serviço aparece com
   * `plantonistas: []`, o que já é o sinal de furo de escala.
   */
  app.get<{ Querystring: { em?: string; equipe_id?: string } }>(
    '/api/n8n/plantonistas',
    async (req, reply) => {
      await exigirChaveApi(req);

      const instante = instanteDaConsulta(req.query.em);
      if (!instante) return reply.code(400).send({ erro: ERRO_INSTANTE });

      const filtroIds = req.query.equipe_id
        ? req.query.equipe_id
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : null;

      const equipes = await db
        .select()
        .from(t.equipes)
        .where(filtroIds && filtroIds.length > 0 ? inArray(t.equipes.id, filtroIds) : undefined)
        .orderBy(t.equipes.nome);

      const mapa = await plantonistasPorEquipe(
        equipes.map((e) => e.id),
        instante,
      );

      return reply.send({
        em: instante.toISOString(),
        equipes: equipes.map((equipe) => ({
          equipe: { id: equipe.id, nome: equipe.nome },
          plantonistas: (mapa.get(equipe.id) ?? []).map(comoPlantonista),
        })),
      });
    },
  );

  /* ------------------------------------------------------------------ clientes */

  const gerenteConta = alias(t.funcionarios, 'gerente_conta');
  const responsavelTecnico = alias(t.funcionarios, 'responsavel_tecnico');

  function comoClienteResumo(linha: {
    cliente: typeof t.clientes.$inferSelect;
    gerente: FuncionarioLinha | null;
    tecnico: FuncionarioLinha | null;
  }) {
    const { cliente, gerente, tecnico } = linha;
    return {
      id: cliente.id,
      nome: cliente.nome,
      razao_social: cliente.razao_social,
      cnpj: cliente.cnpj,
      /** Grupo de WhatsApp do cliente — o id que a automação usa para mandar mensagem. */
      id_whatsapp: cliente.id_whatsapp,
      segmento: cliente.segmento,
      status_contrato: cliente.status_contrato,
      regime: cliente.regime,
      sla_resposta_min: cliente.sla_resposta_min,
      sla_resolucao_horas: cliente.sla_resolucao_horas,
      gerente_conta: resumoFuncionario(gerente),
      responsavel_tecnico: resumoFuncionario(tecnico),
      ativo: cliente.ativo,
    };
  }

  /** Catálogo de clientes. `?q=` busca em nome, razão social, CNPJ e id do WhatsApp. */
  app.get<{ Querystring: { q?: string; ativo?: string } }>('/api/n8n/clientes', async (req, reply) => {
    await exigirChaveApi(req);

    const condicoes = [];
    if (req.query.ativo !== undefined) {
      condicoes.push(eq(t.clientes.ativo, req.query.ativo === 'true'));
    }
    const termo = req.query.q?.trim();
    if (termo) {
      const like = `%${termo}%`;
      condicoes.push(
        or(
          ilike(t.clientes.nome, like),
          ilike(t.clientes.razao_social, like),
          ilike(t.clientes.cnpj, like),
          ilike(t.clientes.id_whatsapp, like),
        ),
      );
    }

    const linhas = await db
      .select({ cliente: t.clientes, gerente: gerenteConta, tecnico: responsavelTecnico })
      .from(t.clientes)
      .leftJoin(gerenteConta, eq(gerenteConta.id, t.clientes.gerente_conta_id))
      .leftJoin(responsavelTecnico, eq(responsavelTecnico.id, t.clientes.responsavel_tecnico_id))
      .where(condicoes.length > 0 ? and(...condicoes) : undefined)
      .orderBy(t.clientes.nome);

    return reply.send(linhas.map(comoClienteResumo));
  });

  /** Acha o cliente pelo id do grupo de WhatsApp — o caminho inverso, para quando a automação só tem o id do grupo de onde a mensagem veio. */
  app.get<{ Params: { idWhatsapp: string } }>(
    '/api/n8n/clientes/por-grupo/:idWhatsapp',
    async (req, reply) => {
      await exigirChaveApi(req);

      const linhas = await db
        .select({ cliente: t.clientes, gerente: gerenteConta, tecnico: responsavelTecnico })
        .from(t.clientes)
        .leftJoin(gerenteConta, eq(gerenteConta.id, t.clientes.gerente_conta_id))
        .leftJoin(responsavelTecnico, eq(responsavelTecnico.id, t.clientes.responsavel_tecnico_id))
        .where(eq(t.clientes.id_whatsapp, req.params.idWhatsapp));

      // Array, não 404: o id do grupo não tem restrição de unicidade no
      // banco, e uma busca sem resultado é uma resposta válida, não um erro.
      return reply.send({ clientes: linhas.map(comoClienteResumo) });
    },
  );

  /** Caminho de escalonamento do cliente, do nível 1 em diante, com quem aciona e quem é acionado em cada degrau. */
  async function escalonamentoDoCliente(clienteId: string) {
    const responsavelInterno = alias(t.funcionarios, 'responsavel_interno');
    const linhas = await db
      .select({ nivel: t.niveisEscalonamento, responsavel: responsavelInterno, contato: t.contatosCliente })
      .from(t.niveisEscalonamento)
      .leftJoin(responsavelInterno, eq(responsavelInterno.id, t.niveisEscalonamento.responsavel_interno_id))
      .leftJoin(t.contatosCliente, eq(t.contatosCliente.id, t.niveisEscalonamento.contato_cliente_id))
      .where(eq(t.niveisEscalonamento.cliente_id, clienteId))
      .orderBy(t.niveisEscalonamento.nivel);

    return linhas.map(({ nivel, responsavel, contato }) => ({
      nivel: nivel.nivel,
      titulo: nivel.titulo,
      prazo_minutos: nivel.prazo_minutos,
      canal: nivel.canal,
      instrucoes: nivel.instrucoes,
      responsavel_interno: resumoFuncionario(responsavel),
      contato_cliente: resumoContato(contato),
    }));
  }

  app.get<{ Params: { id: string } }>('/api/n8n/clientes/:id/escalonamento', async (req, reply) => {
    await exigirChaveApi(req);

    const [existe] = await db.select({ id: t.clientes.id }).from(t.clientes).where(eq(t.clientes.id, req.params.id));
    if (!existe) return reply.code(404).send({ erro: 'Cliente não encontrado.' });

    return reply.send(await escalonamentoDoCliente(req.params.id));
  });

  /** Equipes que atendem o cliente, com quem está de plantão em cada uma agora (ou em `?em=`). */
  app.get<{ Params: { id: string }; Querystring: { em?: string } }>(
    '/api/n8n/clientes/:id/plantonista',
    async (req, reply) => {
      await exigirChaveApi(req);

      const [cliente] = await db
        .select({ id: t.clientes.id, nome: t.clientes.nome })
        .from(t.clientes)
        .where(eq(t.clientes.id, req.params.id));
      if (!cliente) return reply.code(404).send({ erro: 'Cliente não encontrado.' });

      const instante = instanteDaConsulta(req.query.em);
      if (!instante) return reply.code(400).send({ erro: ERRO_INSTANTE });

      const vinculos = await db
        .select({ vinculo: t.atendimentoEquipes, equipe: t.equipes })
        .from(t.atendimentoEquipes)
        .innerJoin(t.equipes, eq(t.equipes.id, t.atendimentoEquipes.equipe_id))
        .where(eq(t.atendimentoEquipes.cliente_id, cliente.id));

      const mapa = await plantonistasPorEquipe(
        vinculos.map((v) => v.equipe.id),
        instante,
      );

      // Equipe de frente primeiro: é a que a automação deve acionar.
      const equipes = vinculos
        .sort((a, b) => Number(b.vinculo.principal) - Number(a.vinculo.principal))
        .map(({ vinculo, equipe }) => ({
          equipe: { id: equipe.id, nome: equipe.nome },
          principal: vinculo.principal,
          escopo: vinculo.escopo,
          plantonistas: (mapa.get(equipe.id) ?? []).map(comoPlantonista),
        }));

      return reply.send({ cliente, em: instante.toISOString(), equipes });
    },
  );

  /**
   * Visão completa do cliente numa chamada só: contrato, grupo de WhatsApp,
   * contatos, escalonamento e plantonista atual de cada equipe que o atende.
   * Pensada para o primeiro passo de um fluxo de incidente, quando a
   * automação só tem o id do cliente e precisa de tudo em volta dele.
   */
  app.get<{ Params: { id: string } }>('/api/n8n/clientes/:id', async (req, reply) => {
    await exigirChaveApi(req);

    const [linha] = await db
      .select({ cliente: t.clientes, gerente: gerenteConta, tecnico: responsavelTecnico })
      .from(t.clientes)
      .leftJoin(gerenteConta, eq(gerenteConta.id, t.clientes.gerente_conta_id))
      .leftJoin(responsavelTecnico, eq(responsavelTecnico.id, t.clientes.responsavel_tecnico_id))
      .where(eq(t.clientes.id, req.params.id));
    if (!linha) return reply.code(404).send({ erro: 'Cliente não encontrado.' });

    const [contatos, escalonamento, vinculos] = await Promise.all([
      db.select().from(t.contatosCliente).where(eq(t.contatosCliente.cliente_id, linha.cliente.id)),
      escalonamentoDoCliente(linha.cliente.id),
      db
        .select({ vinculo: t.atendimentoEquipes, equipe: t.equipes })
        .from(t.atendimentoEquipes)
        .innerJoin(t.equipes, eq(t.equipes.id, t.atendimentoEquipes.equipe_id))
        .where(eq(t.atendimentoEquipes.cliente_id, linha.cliente.id)),
    ]);

    const mapaPlantonistas = await plantonistasPorEquipe(vinculos.map((v) => v.equipe.id));

    return reply.send({
      cliente: comoClienteResumo(linha),
      contrato: {
        numero: linha.cliente.contrato_numero,
        inicio: linha.cliente.contrato_inicio,
        fim: linha.cliente.contrato_fim,
        renovacao_automatica: linha.cliente.renovacao_automatica,
        aviso_previa_dias: linha.cliente.aviso_previa_dias,
        valor_mensal: linha.cliente.valor_mensal,
        status: linha.cliente.status_contrato,
      },
      contatos: contatos.map((c) => ({
        id: c.id,
        nome: c.nome,
        cargo: c.cargo,
        email: c.email,
        telefone: c.telefone,
        tipo: c.tipo,
        principal: c.principal,
        observacao: c.observacao,
      })),
      escalonamento,
      equipes: vinculos
        .sort((a, b) => Number(b.vinculo.principal) - Number(a.vinculo.principal))
        .map(({ vinculo, equipe }) => ({
          equipe: { id: equipe.id, nome: equipe.nome },
          principal: vinculo.principal,
          escopo: vinculo.escopo,
          plantonistas: (mapaPlantonistas.get(equipe.id) ?? []).map(comoPlantonista),
        })),
    });
  });
}
