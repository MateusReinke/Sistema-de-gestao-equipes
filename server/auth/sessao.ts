/**
 * Sessão de usuário.
 *
 * O cookie carrega apenas um identificador opaco; tudo o mais fica no banco.
 * Assim, apagar a linha em `sessoes` derruba o acesso na hora — importante
 * quando alguém é desligado no meio do expediente.
 */
import { randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { db } from '../db/index';
import * as t from '../db/schema';

export interface Sessao {
  usuario: typeof t.usuarios.$inferSelect;
  funcionario: typeof t.funcionarios.$inferSelect;
  sessaoId: string;
}

const token = () => randomBytes(32).toString('hex');

export async function criarSessao(
  reply: FastifyReply,
  usuarioId: string,
  idToken?: string,
): Promise<string> {
  const id = token();
  const agora = new Date();
  const expira = new Date(agora.getTime() + config.sessao.duracaoHoras * 3_600_000);

  await db.insert(t.sessoes).values({
    id,
    usuario_id: usuarioId,
    criada_em: agora.toISOString(),
    expira_em: expira.toISOString(),
    id_token: idToken,
  });

  reply.setCookie(config.sessao.cookie, id, {
    path: '/',
    httpOnly: true,
    // `lax` permite o retorno do provedor de identidade sem perder o cookie.
    sameSite: 'lax',
    secure: config.urlPublica.startsWith('https://'),
    maxAge: config.sessao.duracaoHoras * 3600,
  });

  return id;
}

/** Resolve a sessão do cookie, ou `null` se ausente, expirada ou revogada. */
export async function lerSessao(req: FastifyRequest): Promise<Sessao | null> {
  const id = req.cookies[config.sessao.cookie];
  if (!id) return null;

  const [linha] = await db
    .select({ usuario: t.usuarios, funcionario: t.funcionarios })
    .from(t.sessoes)
    .innerJoin(t.usuarios, eq(t.usuarios.id, t.sessoes.usuario_id))
    .innerJoin(t.funcionarios, eq(t.funcionarios.id, t.usuarios.funcionario_id))
    .where(and(eq(t.sessoes.id, id), gt(t.sessoes.expira_em, new Date().toISOString())))
    .limit(1);

  if (!linha) return null;
  // Usuário desativado ou funcionário desligado perde o acesso na hora.
  if (!linha.usuario.ativo || linha.funcionario.status === 'desligado') return null;

  return { ...linha, sessaoId: id };
}

export async function encerrarSessao(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const id = req.cookies[config.sessao.cookie];
  if (id) await db.delete(t.sessoes).where(eq(t.sessoes.id, id));
  reply.clearCookie(config.sessao.cookie, { path: '/' });
}

/** Remove sessões e estados de OIDC vencidos. Chamado periodicamente. */
export async function limparExpirados(): Promise<void> {
  const agora = new Date().toISOString();
  await db.delete(t.sessoes).where(lt(t.sessoes.expira_em, agora));
  // O estado do OIDC só precisa sobreviver ao redirect de ida e volta.
  const limite = new Date(Date.now() - 15 * 60_000).toISOString();
  await db.delete(t.oidcEstados).where(lt(t.oidcEstados.criado_em, limite));
}
