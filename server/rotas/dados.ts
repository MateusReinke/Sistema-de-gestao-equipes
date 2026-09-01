/**
 * Carga inicial da aplicação.
 *
 * Devolve as coleções já recortadas pelo alcance de quem pediu. O recorte
 * acontece aqui, e não na tela: filtrar no navegador esconderia os dados da
 * vista, mas eles teriam trafegado assim mesmo.
 */
import { and, gte, inArray, lte, or, eq } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index';
import * as t from '../db/schema';
import { ehRh, equipesVisiveis } from '../auth/permissoes';
import { COLUNAS_USUARIO, comoPublico } from '../auth/usuario-publico';
import { exigirSessao } from './auth';
import { somarDias, hoje } from '@/lib/date';

/**
 * Janela de plantões carregada por padrão.
 *
 * Plantões é a única coleção que cresce sem limite — um ano de operação passa
 * de 3 mil linhas. O calendário navega mês a mês, então dois meses para trás e
 * quatro para a frente cobrem tudo que as telas usam de uma vez.
 */
const DIAS_ANTES = 60;
const DIAS_DEPOIS = 120;

export function rotasDados(app: FastifyInstance): void {
  app.get<{ Querystring: { de?: string; ate?: string } }>('/api/dados', async (req, reply) => {
    const sessao = await exigirSessao(req);
    const equipes = await equipesVisiveis(sessao);
    const rh = ehRh(sessao);
    const eu = sessao.funcionario.id;

    const de = req.query.de ?? somarDias(hoje(), -DIAS_ANTES);
    const ate = req.query.ate ?? somarDias(hoje(), DIAS_DEPOIS);

    /** Ids dos funcionários no alcance da sessão. */
    const idsNoAlcance = rh
      ? null
      : (
          await db
            .select({ id: t.funcionarios.id })
            .from(t.funcionarios)
            .where(inArray(t.funcionarios.equipe_id, equipes ?? []))
        ).map((f) => f.id);

    /** Solicitação visível: é minha, ou é de alguém da minha equipe. */
    const daMinhaGente = (coluna: AnyPgColumn) =>
      rh
        ? undefined
        : or(eq(coluna, eu), inArray(coluna, idsNoAlcance?.length ? idsNoAlcance : ['']));

    const [
      departamentos,
      equipesTodas,
      funcionarios,
      escalas,
      escalaDetalhes,
      escalaFuncionarios,
      plantoes,
      ferias,
      ausencias,
      sistemas,
      solicitacoesAcesso,
      trocasPlantao,
      comunicados,
    ] = await Promise.all([
      db.select().from(t.departamentos),
      db.select().from(t.equipes),
      // Nomes de colegas aparecem em escala e aprovação, então o cadastro
      // básico é visível a todos; o que é sensível vem nas coleções abaixo.
      db.select().from(t.funcionarios),
      db.select().from(t.escalas),
      db.select().from(t.escalaDetalhes),
      db.select().from(t.escalaFuncionarios),
      db
        .select()
        .from(t.plantoes)
        .where(and(gte(t.plantoes.data, de), lte(t.plantoes.data, ate))),
      db.select().from(t.ferias).where(daMinhaGente(t.ferias.funcionario_id)),
      db.select().from(t.ausencias).where(daMinhaGente(t.ausencias.funcionario_id)),
      db.select().from(t.sistemas),
      db
        .select()
        .from(t.solicitacoesAcesso)
        .where(daMinhaGente(t.solicitacoesAcesso.funcionario_id)),
      db.select().from(t.trocasPlantao).where(daMinhaGente(t.trocasPlantao.funcionario_id)),
      db.select().from(t.comunicados),
    ]);

    // Carteira de clientes e trilha de auditoria não são de todos.
    const gestao = rh || sessao.usuario.role === 'gestor';
    const [
      clientes,
      contatosCliente,
      niveisEscalonamento,
      servicos,
      servicosContratados,
      atendimentoEquipes,
      avaliacoesCliente,
    ] = gestao
      ? await Promise.all([
          db.select().from(t.clientes),
          db.select().from(t.contatosCliente),
          db.select().from(t.niveisEscalonamento),
          db.select().from(t.servicos),
          db.select().from(t.servicosContratados),
          db.select().from(t.atendimentoEquipes),
          db.select().from(t.avaliacoesCliente),
        ])
      : [[], [], [], [], [], [], []];

    const auditoria = rh
      ? await db.select().from(t.auditoria).orderBy(t.auditoria.em).limit(500)
      : [];
    // Projeção explícita: `select().from(usuarios)` traria o hash da senha.
    const usuarios =
      sessao.usuario.role === 'admin'
        ? (await db.select(COLUNAS_USUARIO).from(t.usuarios)).map(comoPublico)
        : [];

    return reply.send({
      janelaPlantoes: { de, ate },
      departamentos,
      equipes: equipesTodas,
      funcionarios,
      usuarios,
      clientes,
      contatosCliente,
      niveisEscalonamento,
      servicos,
      servicosContratados,
      atendimentoEquipes,
      avaliacoesCliente,
      escalas,
      escalaDetalhes,
      escalaFuncionarios,
      plantoes,
      ferias,
      ausencias,
      sistemas,
      solicitacoesAcesso,
      trocasPlantao,
      comunicados,
      auditoria: auditoria.reverse(),
    });
  });
}
