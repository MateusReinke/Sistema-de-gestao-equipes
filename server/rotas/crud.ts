/**
 * Rotas de escrita das coleções.
 *
 * `PUT /api/:colecao/:id` grava (cria ou atualiza) e `DELETE` remove. As duas
 * passam obrigatoriamente por validação de schema, permissão e regra de
 * negócio antes de tocar o banco, e ambas registram a auditoria.
 */
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index';
import { registrar } from '../auditoria';
import { autorizarEscrita, colecaoPorNome } from './colecoes';
import { exigirSessao } from './auth';

export function rotasCrud(app: FastifyInstance): void {
  app.put<{ Params: { colecao: string; id: string }; Body: Record<string, unknown> }>(
    '/api/:colecao/:id',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      const colecao = colecaoPorNome.get(req.params.colecao);
      if (!colecao) return reply.code(404).send({ erro: 'Coleção desconhecida.' });

      // O id da URL manda: sem isso dava para gravar por cima de outro registro.
      const bruto = { ...req.body, id: req.params.id };

      const analise = colecao.schema.safeParse(bruto);
      if (!analise.success) {
        return reply.code(400).send({
          erro: 'Dados inválidos.',
          detalhes: analise.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        });
      }
      const item = analise.data as Record<string, never>;

      await autorizarEscrita(colecao, item, sessao);

      if (colecao.validar) {
        const erros = await colecao.validar(item, sessao);
        if (erros.length > 0) return reply.code(422).send({ erro: erros[0], detalhes: erros });
      }

      const [existente] = await db
        .select({ id: colecao.tabela.id })
        .from(colecao.tabela)
        .where(eq(colecao.tabela.id, req.params.id))
        .limit(1);

      await db
        .insert(colecao.tabela)
        .values(item)
        .onConflictDoUpdate({ target: colecao.tabela.id, set: item });

      if (colecao.depoisDeSalvar) await colecao.depoisDeSalvar(item);

      await registrar(sessao, {
        acao: existente ? 'atualizou' : 'criou',
        entidade: colecao.entidade,
        entidade_id: req.params.id,
        descricao: colecao.rotulo(item),
      });

      return reply.send(item);
    },
  );

  app.delete<{ Params: { colecao: string; id: string } }>(
    '/api/:colecao/:id',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      const colecao = colecaoPorNome.get(req.params.colecao);
      if (!colecao) return reply.code(404).send({ erro: 'Coleção desconhecida.' });

      const [atual] = await db
        .select()
        .from(colecao.tabela)
        .where(eq(colecao.tabela.id, req.params.id))
        .limit(1);
      if (!atual) return reply.code(404).send({ erro: 'Registro não encontrado.' });

      await autorizarEscrita(colecao, atual as Record<string, unknown>, sessao);
      await db.delete(colecao.tabela).where(eq(colecao.tabela.id, req.params.id));

      await registrar(sessao, {
        acao: 'removeu',
        entidade: colecao.entidade,
        entidade_id: req.params.id,
        descricao: colecao.rotulo(atual as Record<string, unknown>),
      });

      return reply.code(204).send();
    },
  );
}
