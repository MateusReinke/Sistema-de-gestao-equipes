/**
 * Tokens de API — cada pessoa gerencia os seus.
 *
 * O token não tem permissão própria: ele carrega o dono, e a requisição
 * autenticada por ele vira exatamente a sessão que essa pessoa teria no
 * navegador (ver `auth/chaveApi.ts`). Por isso qualquer usuário pode emitir o
 * seu — um colaborador não consegue, com isso, alcançar nada que já não
 * alcançasse pela tela.
 *
 * Três decisões que valem explicar:
 *
 * - **Só sessão de navegador cria e revoga token.** Um token não emite outro.
 *   Sem isso, revogar um token vazado não adiantaria: quem o tivesse já teria
 *   emitido o próximo.
 * - **O segredo aparece uma vez só.** O banco guarda o hash; se a pessoa
 *   perder o token, o caminho é revogar e emitir outro.
 * - **Admin enxerga e revoga os de todos.** É quem responde por uma credencial
 *   vazada, e precisa conseguir cortá-la sem depender do dono.
 */
import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index';
import * as t from '../db/schema';
import { novoId, registrar } from '../auditoria';
import { gerarChaveApi } from '../auth/chaveApi';
import { exigir } from '../auth/permissoes';
import { exigirSessaoHumana } from './auth';

/** Teto de validade: uma credencial eterna é uma credencial esquecida. */
const DIAS_MAXIMO = 730;
const DIAS_PADRAO = 365;

const ESCOPOS = ['leitura', 'escrita'] as const;
type Escopo = (typeof ESCOPOS)[number];

/** A linha como ela pode ser mostrada — nunca inclui o token nem o hash. */
type LinhaChave = typeof t.chavesApi.$inferSelect;
const comoPublico = (c: LinhaChave, donoNome?: string) => ({
  id: c.id,
  nome: c.nome,
  prefixo: c.prefixo,
  escopo: c.escopo,
  ativo: c.ativo,
  criado_em: c.criado_em,
  expira_em: c.expira_em,
  ultimo_uso_em: c.ultimo_uso_em,
  usuario_id: c.usuario_id,
  dono: donoNome,
});

export function rotasTokens(app: FastifyInstance): void {
  /**
   * Os tokens que a pessoa pode ver: os dela sempre; todos, se for admin.
   */
  app.get('/api/tokens', async (req, reply) => {
    const sessao = await exigirSessaoHumana(req);
    const ehAdmin = sessao.usuario.role === 'admin';

    const linhas = await db
      .select({ chave: t.chavesApi, dono: t.funcionarios.nome })
      .from(t.chavesApi)
      .leftJoin(t.usuarios, eq(t.usuarios.id, t.chavesApi.usuario_id))
      .leftJoin(t.funcionarios, eq(t.funcionarios.id, t.usuarios.funcionario_id))
      .orderBy(desc(t.chavesApi.criado_em));

    const visiveis = ehAdmin
      ? linhas
      : linhas.filter((l) => l.chave.usuario_id === sessao.usuario.id);

    return reply.send({
      tokens: visiveis.map((l) => comoPublico(l.chave, l.dono ?? undefined)),
      // A tela mostra o que este token alcançaria, que é o que o dono alcança.
      papel: sessao.usuario.role,
    });
  });

  /**
   * Emite um token novo. O segredo volta **uma única vez**, nesta resposta.
   */
  app.post<{ Body: { nome?: string; escopo?: string; dias?: number } }>(
    '/api/tokens',
    async (req, reply) => {
      const sessao = await exigirSessaoHumana(req);

      const nome = (req.body?.nome ?? '').trim();
      if (nome.length < 3) {
        return reply
          .code(400)
          .send({ erro: 'Dê um nome de ao menos 3 caracteres — é como o token é reconhecido depois.' });
      }

      const escopo = (req.body?.escopo ?? 'leitura') as Escopo;
      if (!ESCOPOS.includes(escopo)) {
        return reply.code(400).send({ erro: `"escopo" precisa ser ${ESCOPOS.join(' ou ')}.` });
      }

      const dias = req.body?.dias ?? DIAS_PADRAO;
      if (!Number.isFinite(dias) || dias <= 0 || dias > DIAS_MAXIMO) {
        return reply
          .code(400)
          .send({ erro: `"dias" precisa ser um número entre 1 e ${DIAS_MAXIMO}.` });
      }

      const { chave, hash, prefixo } = gerarChaveApi();
      const id = novoId('tok');
      const criado_em = new Date().toISOString();
      const expira_em = new Date(Date.now() + dias * 86_400_000).toISOString();

      await db.insert(t.chavesApi).values({
        id,
        nome,
        prefixo,
        chave_hash: hash,
        usuario_id: sessao.usuario.id,
        escopo,
        ativo: true,
        criado_em,
        criado_por: sessao.funcionario.id,
        expira_em,
      });

      await registrar(sessao, {
        acao: 'criou',
        entidade: 'Token de API',
        entidade_id: id,
        descricao: `${nome} (${escopo}), validade até ${expira_em.slice(0, 10)}`,
      });

      return reply.code(201).send({
        // Única vez que o segredo sai daqui.
        token: chave,
        aviso: 'Guarde agora: este token não volta a ser exibido.',
        chave: comoPublico({
          id,
          nome,
          prefixo,
          chave_hash: hash,
          usuario_id: sessao.usuario.id,
          escopo,
          ativo: true,
          criado_em,
          criado_por: sessao.funcionario.id,
          expira_em,
          ultimo_uso_em: null,
        }),
      });
    },
  );

  /** Revoga um token. O dono revoga o seu; admin revoga qualquer um. */
  app.delete<{ Params: { id: string } }>('/api/tokens/:id', async (req, reply) => {
    const sessao = await exigirSessaoHumana(req);

    const [chave] = await db
      .select()
      .from(t.chavesApi)
      .where(eq(t.chavesApi.id, req.params.id))
      .limit(1);
    if (!chave) return reply.code(404).send({ erro: 'Token não encontrado.' });

    exigir(
      sessao.usuario.role === 'admin' || chave.usuario_id === sessao.usuario.id,
      'Só o dono do token, ou a administração, pode revogá-lo.',
    );

    // Revogar, e não apagar: a linha inerte preserva a trilha de auditoria de
    // quando a credencial existiu e quando foi usada pela última vez.
    await db.update(t.chavesApi).set({ ativo: false }).where(eq(t.chavesApi.id, chave.id));

    await registrar(sessao, {
      acao: 'removeu',
      entidade: 'Token de API',
      entidade_id: chave.id,
      descricao: `${chave.nome} revogado`,
    });

    return reply.code(204).send();
  });
}
