/**
 * Integrações com sistemas externos.
 *
 * Configurar é privilégio da administração; *consultar* alertas é mais amplo,
 * porque quem atende o cliente precisa ver o ambiente dele. Por isso as rotas
 * de escrita exigem `admin` e a de execução usa o recorte por equipe.
 *
 * Segredo nunca sai daqui em claro: a listagem devolve só quais chaves estão
 * gravadas, e a tela mostra "já cadastrado".
 */
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  normalizarFiltro,
  validarIntegracao,
  TIPOS,
  type TipoIntegracao,
} from '@/lib/integracoes';
import { db } from '../db/index';
import * as t from '../db/schema';
import { novoId, registrar } from '../auditoria';
import { ehRh, equipesVisiveis, exigir } from '../auth/permissoes';
import { exigirSessao } from './auth';
import {
  ErroIntegracao,
  buscarAlertas,
  chavesGravadas,
  conexaoDeMonitoramento,
  fechar,
  listarGrupos,
  segredosDe,
  testar,
} from '../integracoes/index';

/** Linha pronta para a tela: sem segredo, com o que já está gravado. */
function comoPublica(linha: typeof t.integracoes.$inferSelect) {
  const { segredos, ...resto } = linha;
  return { ...resto, segredos_gravados: chavesGravadas(linha) };
}

const ehTipoValido = (v: unknown): v is TipoIntegracao => TIPOS.includes(v as TipoIntegracao);

export function rotasIntegracoes(app: FastifyInstance): void {
  /* ------------------------------------------------------------- integrações */

  app.get('/api/admin/integracoes', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração vê as integrações.');

    const linhas = await db.select().from(t.integracoes).orderBy(t.integracoes.nome);
    return reply.send(linhas.map(comoPublica));
  });

  app.post<{
    Body: { tipo?: string; nome?: string; descricao?: string; valores?: Record<string, unknown> };
  }>('/api/admin/integracoes', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração cria integrações.');

    const tipo = req.body?.tipo;
    if (!ehTipoValido(tipo)) return reply.code(422).send({ erro: 'Tipo de integração inválido.' });

    const nome = String(req.body?.nome ?? '').trim();
    if (!nome) return reply.code(422).send({ erro: 'Dê um nome à integração.' });

    const valores = (req.body?.valores ?? {}) as Record<string, string | number | undefined>;
    const erros = validarIntegracao(tipo, valores);
    if (Object.keys(erros).length > 0) {
      return reply.code(422).send({ erro: 'Confira os campos destacados.', campos: erros });
    }

    const { parametros, segredos } = fechar(tipo, valores);
    const agora = new Date().toISOString();
    const id = novoId('int');

    await db.insert(t.integracoes).values({
      id,
      tipo,
      nome,
      descricao: String(req.body?.descricao ?? '').trim(),
      parametros,
      segredos,
      criado_em: agora,
      atualizado_em: agora,
      atualizado_por: sessao.funcionario.id,
    });

    await registrar(sessao, {
      acao: 'criou',
      entidade: 'Integração',
      entidade_id: id,
      descricao: `${nome} (${tipo})`,
    });

    const [criada] = await db.select().from(t.integracoes).where(eq(t.integracoes.id, id));
    return reply.code(201).send(comoPublica(criada));
  });

  app.put<{
    Params: { id: string };
    Body: {
      nome?: string;
      descricao?: string;
      ativo?: boolean;
      valores?: Record<string, unknown>;
    };
  }>('/api/admin/integracoes/:id', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração altera integrações.');

    const [atual] = await db.select().from(t.integracoes).where(eq(t.integracoes.id, req.params.id));
    if (!atual) return reply.code(404).send({ erro: 'Integração não encontrada.' });

    const mudanca: Partial<typeof t.integracoes.$inferInsert> = {
      atualizado_em: new Date().toISOString(),
      atualizado_por: sessao.funcionario.id,
    };

    if (req.body?.nome !== undefined) {
      const nome = String(req.body.nome).trim();
      if (!nome) return reply.code(422).send({ erro: 'Dê um nome à integração.' });
      mudanca.nome = nome;
    }
    if (req.body?.descricao !== undefined) mudanca.descricao = String(req.body.descricao).trim();
    if (req.body?.ativo !== undefined) mudanca.ativo = Boolean(req.body.ativo);

    if (req.body?.valores) {
      const valores = req.body.valores as Record<string, string | number | undefined>;
      const erros = validarIntegracao(atual.tipo, valores, chavesGravadas(atual));
      if (Object.keys(erros).length > 0) {
        return reply.code(422).send({ erro: 'Confira os campos destacados.', campos: erros });
      }

      const { parametros, segredos } = fechar(atual.tipo, valores, lerSegredos(atual));
      mudanca.parametros = parametros;
      mudanca.segredos = segredos;
      // Mudar endereço ou credencial invalida o teste anterior.
      mudanca.ultimo_teste_em = null;
      mudanca.ultimo_teste_ok = null;
      mudanca.ultimo_teste_detalhe = null;
    }

    await db.update(t.integracoes).set(mudanca).where(eq(t.integracoes.id, atual.id));

    await registrar(sessao, {
      acao: 'atualizou',
      entidade: 'Integração',
      entidade_id: atual.id,
      descricao: mudanca.nome ?? atual.nome,
    });

    const [salva] = await db.select().from(t.integracoes).where(eq(t.integracoes.id, atual.id));
    return reply.send(comoPublica(salva));
  });

  app.delete<{ Params: { id: string } }>('/api/admin/integracoes/:id', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração remove integrações.');

    const [atual] = await db.select().from(t.integracoes).where(eq(t.integracoes.id, req.params.id));
    if (!atual) return reply.code(404).send({ erro: 'Integração não encontrada.' });

    // As consultas caem junto por ON DELETE CASCADE.
    await db.delete(t.integracoes).where(eq(t.integracoes.id, atual.id));

    await registrar(sessao, {
      acao: 'removeu',
      entidade: 'Integração',
      entidade_id: atual.id,
      descricao: atual.nome,
    });

    return reply.code(204).send();
  });

  /** Testa a conexão e guarda o resultado, para a tela mostrar sem retestar. */
  app.post<{ Params: { id: string } }>('/api/admin/integracoes/:id/testar', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração testa integrações.');

    const [linha] = await db.select().from(t.integracoes).where(eq(t.integracoes.id, req.params.id));
    if (!linha) return reply.code(404).send({ erro: 'Integração não encontrada.' });

    const resultado = await testar(linha);

    await db
      .update(t.integracoes)
      .set({
        ultimo_teste_em: new Date().toISOString(),
        ultimo_teste_ok: resultado.ok,
        ultimo_teste_detalhe: resultado.detalhe,
      })
      .where(eq(t.integracoes.id, linha.id));

    return reply.send(resultado);
  });

  /** Grupos de host do Zabbix, para o seletor da consulta. */
  app.get<{ Params: { id: string } }>('/api/admin/integracoes/:id/grupos', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração lê grupos.');

    const [linha] = await db.select().from(t.integracoes).where(eq(t.integracoes.id, req.params.id));
    if (!linha) return reply.code(404).send({ erro: 'Integração não encontrada.' });

    try {
      return reply.send(await listarGrupos(conexaoDeMonitoramento(linha)));
    } catch (erro) {
      if (erro instanceof ErroIntegracao) return reply.code(502).send({ erro: erro.message });
      throw erro;
    }
  });

  /* ---------------------------------------------------- consultas de alerta */

  app.get('/api/admin/consultas', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração vê as consultas.');

    const linhas = await db.select().from(t.consultasAlerta).orderBy(t.consultasAlerta.ordem);
    return reply.send(linhas);
  });

  app.post<{ Body: Record<string, unknown> }>('/api/admin/consultas', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração cria consultas.');

    const erro = await validarConsulta(req.body);
    if (erro) return reply.code(422).send({ erro });

    const id = novoId('cns');
    const agora = new Date().toISOString();
    const clienteId = textoOuNulo(req.body?.cliente_id);

    await db.insert(t.consultasAlerta).values({
      id,
      integracao_id: String(req.body?.integracao_id),
      nome: String(req.body?.nome).trim(),
      descricao: String(req.body?.descricao ?? '').trim(),
      filtro: normalizarFiltro(req.body?.filtro),
      cliente_id: clienteId,
      // Sem dono não há a quem liberar: a flag só vale com cliente.
      visivel_para_cliente: clienteId !== null && req.body?.visivel_para_cliente === true,
      ordem: Number(req.body?.ordem ?? 0) || 0,
      criado_em: agora,
      atualizado_em: agora,
    });

    await registrar(sessao, {
      acao: 'criou',
      entidade: 'Consulta de alerta',
      entidade_id: id,
      descricao: String(req.body?.nome),
    });

    const [criada] = await db.select().from(t.consultasAlerta).where(eq(t.consultasAlerta.id, id));
    return reply.code(201).send(criada);
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/admin/consultas/:id',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      exigir(sessao.usuario.role === 'admin', 'Só a administração altera consultas.');

      const [atual] = await db
        .select()
        .from(t.consultasAlerta)
        .where(eq(t.consultasAlerta.id, req.params.id));
      if (!atual) return reply.code(404).send({ erro: 'Consulta não encontrada.' });

      const erro = await validarConsulta({ integracao_id: atual.integracao_id, ...req.body });
      if (erro) return reply.code(422).send({ erro });

      const clienteId =
        req.body?.cliente_id !== undefined ? textoOuNulo(req.body.cliente_id) : atual.cliente_id;
      const querVisivel =
        req.body?.visivel_para_cliente !== undefined
          ? req.body.visivel_para_cliente === true
          : atual.visivel_para_cliente;

      await db
        .update(t.consultasAlerta)
        .set({
          nome: req.body?.nome !== undefined ? String(req.body.nome).trim() : atual.nome,
          descricao:
            req.body?.descricao !== undefined ? String(req.body.descricao).trim() : atual.descricao,
          filtro: req.body?.filtro !== undefined ? normalizarFiltro(req.body.filtro) : atual.filtro,
          cliente_id: clienteId,
          visivel_para_cliente: clienteId !== null && querVisivel,
          ordem: req.body?.ordem !== undefined ? Number(req.body.ordem) || 0 : atual.ordem,
          ativo: req.body?.ativo !== undefined ? Boolean(req.body.ativo) : atual.ativo,
          atualizado_em: new Date().toISOString(),
        })
        .where(eq(t.consultasAlerta.id, atual.id));

      await registrar(sessao, {
        acao: 'atualizou',
        entidade: 'Consulta de alerta',
        entidade_id: atual.id,
        descricao: atual.nome,
      });

      const [salva] = await db
        .select()
        .from(t.consultasAlerta)
        .where(eq(t.consultasAlerta.id, atual.id));
      return reply.send(salva);
    },
  );

  app.delete<{ Params: { id: string } }>('/api/admin/consultas/:id', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração remove consultas.');

    const [atual] = await db
      .select()
      .from(t.consultasAlerta)
      .where(eq(t.consultasAlerta.id, req.params.id));
    if (!atual) return reply.code(404).send({ erro: 'Consulta não encontrada.' });

    await db.delete(t.consultasAlerta).where(eq(t.consultasAlerta.id, atual.id));
    await registrar(sessao, {
      acao: 'removeu',
      entidade: 'Consulta de alerta',
      entidade_id: atual.id,
      descricao: atual.nome,
    });

    return reply.code(204).send();
  });

  /* --------------------------------------------------------------- execução */

  /**
   * Lista as consultas que a sessão pode executar.
   *
   * RH e administração veem todas; gestor vê as dos clientes atendidos pelas
   * suas equipes; colaborador não vê nenhuma.
   */
  app.get('/api/consultas', async (req, reply) => {
    const sessao = await exigirSessao(req);
    return reply.send(await consultasDaSessao(sessao));
  });

  /** Roda a consulta contra o monitoramento e devolve os alertas. */
  app.get<{ Params: { id: string } }>('/api/consultas/:id/alertas', async (req, reply) => {
    const sessao = await exigirSessao(req);

    const permitidas = await consultasDaSessao(sessao);
    const consulta = permitidas.find((c) => c.id === req.params.id);
    // Consulta fora do alcance responde igual a inexistente: não vazamos nem
    // a existência de um cliente que a pessoa não atende.
    if (!consulta) return reply.code(404).send({ erro: 'Consulta não encontrada.' });

    const [integracao] = await db
      .select()
      .from(t.integracoes)
      .where(eq(t.integracoes.id, consulta.integracao_id));

    if (!integracao || !integracao.ativo) {
      return reply.code(409).send({ erro: 'A integração desta consulta está desativada.' });
    }

    try {
      const alertas = await buscarAlertas(
        conexaoDeMonitoramento(integracao),
        normalizarFiltro(consulta.filtro),
      );
      return reply.send({ consulta: consulta.id, em: new Date().toISOString(), alertas });
    } catch (erro) {
      if (erro instanceof ErroIntegracao) return reply.code(502).send({ erro: erro.message });
      throw erro;
    }
  });
}

/* ------------------------------------------------------------------ apoio */

const textoOuNulo = (v: unknown): string | null => {
  const texto = v === undefined || v === null ? '' : String(v).trim();
  return texto.length > 0 ? texto : null;
};

/** Segredos anteriores, tolerando chave de cifra trocada. */
function lerSegredos(linha: typeof t.integracoes.$inferSelect) {
  try {
    return segredosDe(linha);
  } catch {
    // Ilegíveis: a gravação recomeça do que veio no formulário.
    return {};
  }
}

async function validarConsulta(corpo: Record<string, unknown> | undefined): Promise<string | null> {
  const nome = String(corpo?.nome ?? '').trim();
  if (!nome) return 'Dê um nome à consulta.';

  const integracaoId = String(corpo?.integracao_id ?? '');
  const [integracao] = await db
    .select({ tipo: t.integracoes.tipo })
    .from(t.integracoes)
    .where(eq(t.integracoes.id, integracaoId));

  if (!integracao) return 'Integração não encontrada.';
  if (integracao.tipo !== 'zabbix') return 'Consultas de alerta só existem em monitoramento.';

  const clienteId = textoOuNulo(corpo?.cliente_id);
  if (clienteId) {
    const [cliente] = await db
      .select({ id: t.clientes.id })
      .from(t.clientes)
      .where(eq(t.clientes.id, clienteId));
    if (!cliente) return 'Cliente não encontrado.';
  }

  return null;
}

/** Consultas ativas dentro do alcance da sessão. */
async function consultasDaSessao(sessao: Parameters<typeof equipesVisiveis>[0]) {
  const todas = await db
    .select()
    .from(t.consultasAlerta)
    .where(eq(t.consultasAlerta.ativo, true))
    .orderBy(t.consultasAlerta.ordem);

  if (ehRh(sessao)) return todas;
  if (sessao.usuario.role !== 'gestor') return [];

  const equipes = await equipesVisiveis(sessao);
  if (equipes === null) return todas;
  if (equipes.length === 0) return [];

  // Clientes atendidos pelas equipes do gestor.
  const vinculos = await db
    .selectDistinct({ cliente_id: t.atendimentoEquipes.cliente_id })
    .from(t.atendimentoEquipes)
    .where(inArray(t.atendimentoEquipes.equipe_id, equipes));

  const meusClientes = new Set(vinculos.map((v) => v.cliente_id));
  return todas.filter((c) => c.cliente_id !== null && meusClientes.has(c.cliente_id));
}
