/**
 * Projeção segura da tabela `usuarios`.
 *
 * `select().from(usuarios)` traz `senha_hash` junto, e essa linha viaja para a
 * sessão, para `/api/auth/me` e para a carga inicial — ou seja, o hash chegaria
 * ao navegador. Toda leitura de usuário passa por aqui.
 */
import * as t from '../db/schema';

export const COLUNAS_USUARIO = {
  id: t.usuarios.id,
  funcionario_id: t.usuarios.funcionario_id,
  email: t.usuarios.email,
  role: t.usuarios.role,
  ativo: t.usuarios.ativo,
  deve_trocar_senha: t.usuarios.deve_trocar_senha,
  ultimo_acesso_em: t.usuarios.ultimo_acesso_em,
  bloqueado_ate: t.usuarios.bloqueado_ate,
  /** Booleano derivado: diz se há senha local, sem expor o hash. */
  tem_senha: t.usuarios.senha_hash,
} as const;

export interface UsuarioPublico {
  id: string;
  funcionario_id: string;
  email: string;
  role: (typeof t.usuarios.$inferSelect)['role'];
  ativo: boolean;
  deve_trocar_senha: boolean;
  ultimo_acesso_em: string | null;
  bloqueado_ate: string | null;
  tem_senha: boolean;
}

/** Converte `senha_hash` no booleano `tem_senha`. */
export function comoPublico(linha: {
  id: string;
  funcionario_id: string;
  email: string;
  role: UsuarioPublico['role'];
  ativo: boolean;
  deve_trocar_senha: boolean;
  ultimo_acesso_em: string | null;
  bloqueado_ate: string | null;
  tem_senha: string | null;
}): UsuarioPublico {
  return { ...linha, tem_senha: Boolean(linha.tem_senha) };
}
