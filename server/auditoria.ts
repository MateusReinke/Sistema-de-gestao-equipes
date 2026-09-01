import { randomBytes } from 'node:crypto';
import { db } from './db/index';
import * as t from './db/schema';
import type { Sessao } from './auth/sessao';

export type Acao = (typeof t.auditoria.$inferInsert)['acao'];

export const novoId = (prefixo: string) =>
  `${prefixo}_${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;

/**
 * Registra um evento na trilha.
 *
 * Guarda o nome do ator por valor: a trilha precisa continuar legível depois
 * que a pessoa é desligada e o cadastro dela muda.
 */
export async function registrar(
  sessao: Sessao,
  evento: { acao: Acao; entidade: string; entidade_id: string; descricao: string },
): Promise<void> {
  await db.insert(t.auditoria).values({
    id: novoId('aud'),
    em: new Date().toISOString(),
    ator_id: sessao.funcionario.id,
    ator_nome: sessao.funcionario.nome,
    ...evento,
  });
}
