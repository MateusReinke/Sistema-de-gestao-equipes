/**
 * Autorização — a versão que vale.
 *
 * O front esconde menus e botões conforme o papel, mas isso é conveniência de
 * interface: qualquer um pode chamar a API direto. As decisões daqui são as
 * que realmente restringem o acesso.
 */
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import * as t from '../db/schema';
import type { Sessao } from './sessao';

export type Papel = (typeof t.usuarios.$inferSelect)['role'];

export const PAPEIS_RH: Papel[] = ['admin', 'rh'];
export const PAPEIS_GESTAO: Papel[] = ['admin', 'rh', 'gestor'];

export const ehRh = (sessao: Sessao) => PAPEIS_RH.includes(sessao.usuario.role);
export const podeAprovar = ehRh;
export const podeGerenciar = ehRh;

/**
 * Equipes que a sessão enxerga. `null` significa "todas" — usado por RH e
 * administração, que não têm recorte.
 */
export async function equipesVisiveis(sessao: Sessao): Promise<string[] | null> {
  if (ehRh(sessao)) return null;

  if (sessao.usuario.role === 'gestor') {
    const linhas = await db
      .select({ id: t.equipes.id })
      .from(t.equipes)
      .where(eq(t.equipes.gestor_id, sessao.funcionario.id));
    return linhas.map((l) => l.id);
  }

  return [sessao.funcionario.equipe_id];
}

/**
 * A sessão pode agir sobre os registros deste funcionário?
 *
 * Colaborador só age sobre si; gestor, sobre a própria equipe; RH, sobre todos.
 */
export async function alcancaFuncionario(sessao: Sessao, funcionarioId: string): Promise<boolean> {
  if (ehRh(sessao)) return true;
  if (funcionarioId === sessao.funcionario.id) return true;

  const equipes = await equipesVisiveis(sessao);
  if (equipes === null) return true;

  const [alvo] = await db
    .select({ equipe_id: t.funcionarios.equipe_id })
    .from(t.funcionarios)
    .where(eq(t.funcionarios.id, funcionarioId))
    .limit(1);

  return alvo ? equipes.includes(alvo.equipe_id) : false;
}

export class SemPermissao extends Error {
  constructor(mensagem = 'Sem permissão para esta operação.') {
    super(mensagem);
  }
}

export function exigir(condicao: boolean, mensagem?: string): void {
  if (!condicao) throw new SemPermissao(mensagem);
}
