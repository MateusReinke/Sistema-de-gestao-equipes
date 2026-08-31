/**
 * Sessão e permissões.
 *
 * A autenticação é simulada (qualquer senha entra) porque não há backend — o
 * que importa aqui é o **papel**, que define o que cada pessoa enxerga e pode
 * decidir. Ao plugar um backend real, só `entrar` muda.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Funcionario, UserRole, Usuario } from '@/types/sgo';
import { useDados } from '@/data/store';

const CHAVE_SESSAO = 'lumini.central.sessao';

export interface Sessao {
  usuario: Usuario;
  funcionario: Funcionario;
}

interface ContextoAuth {
  sessao: Sessao | null;
  entrar: (email: string, senha: string) => { ok: boolean; erro?: string };
  sair: () => void;
  papel: UserRole | null;
  /** Enxerga a empresa inteira e decide qualquer solicitação. */
  ehRh: boolean;
  /** Decide solicitações — RH e admin. */
  podeAprovar: boolean;
  /** Cria e edita cadastros de pessoas, equipes e sistemas. */
  podeGerenciar: boolean;
  /** Equipes sob responsabilidade do usuário; `null` significa "todas". */
  equipesVisiveis: string[] | null;
}

const Contexto = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { usuarios, funcionarios, equipes, registrarAtor } = useDados();
  const [usuarioId, setUsuarioId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CHAVE_SESSAO);
    } catch {
      return null;
    }
  });

  const sessao = useMemo<Sessao | null>(() => {
    if (!usuarioId) return null;
    const usuario = usuarios.find((u) => u.id === usuarioId && u.ativo);
    if (!usuario) return null;
    const funcionario = funcionarios.find((f) => f.id === usuario.funcionario_id);
    if (!funcionario) return null;
    return { usuario, funcionario };
  }, [usuarioId, usuarios, funcionarios]);

  useEffect(() => {
    try {
      if (usuarioId) localStorage.setItem(CHAVE_SESSAO, usuarioId);
      else localStorage.removeItem(CHAVE_SESSAO);
    } catch {
      // Sem persistência de sessão em modo privado; segue em memória.
    }
  }, [usuarioId]);

  // Mantém a auditoria assinada por quem está de fato operando o sistema.
  useEffect(() => {
    registrarAtor(sessao ? { id: sessao.funcionario.id, nome: sessao.funcionario.nome } : null);
  }, [sessao, registrarAtor]);

  const entrar = useCallback(
    (email: string, _senha: string) => {
      const alvo = usuarios.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!alvo) return { ok: false, erro: 'E-mail não encontrado.' };
      if (!alvo.ativo) return { ok: false, erro: 'Usuário inativo. Procure o RH.' };
      setUsuarioId(alvo.id);
      return { ok: true };
    },
    [usuarios],
  );

  const sair = useCallback(() => setUsuarioId(null), []);

  const papel = sessao?.usuario.role ?? null;
  const ehRh = papel === 'admin' || papel === 'rh';

  const equipesVisiveis = useMemo(() => {
    if (!sessao) return [];
    if (ehRh) return null; // sem recorte: enxerga a empresa toda
    if (papel === 'gestor') {
      return equipes.filter((e) => e.gestor_id === sessao.funcionario.id).map((e) => e.id);
    }
    return [sessao.funcionario.equipe_id];
  }, [sessao, ehRh, papel, equipes]);

  const valor = useMemo<ContextoAuth>(
    () => ({
      sessao,
      entrar,
      sair,
      papel,
      ehRh,
      podeAprovar: ehRh,
      podeGerenciar: ehRh,
      equipesVisiveis,
    }),
    [sessao, entrar, sair, papel, ehRh, equipesVisiveis],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAuth(): ContextoAuth {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}

export const ROTULO_PAPEL: Record<UserRole, string> = {
  admin: 'Administrador',
  rh: 'Recursos Humanos',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
};
