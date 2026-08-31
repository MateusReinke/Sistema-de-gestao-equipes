/**
 * Sessão e permissões, resolvidas pelo servidor.
 *
 * O papel e o alcance de equipes vêm de `/api/auth/me`; aqui eles só orientam
 * o que a interface mostra. Quem realmente autoriza é a API — esconder um
 * botão não impede ninguém de chamar a rota.
 */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Funcionario, UserRole, Usuario } from '@/types/sgo';
import { ErroApi, api } from '@/data/api';

export interface Sessao {
  usuario: Usuario;
  funcionario: Funcionario;
  papel: UserRole;
  ehRh: boolean;
  /** Equipes sob responsabilidade do usuário; `null` significa "todas". */
  equipesVisiveis: string[] | null;
}

interface ConfigAuth {
  sso: boolean;
  modoDemonstracao: boolean;
}

interface ContextoAuth {
  sessao: Sessao | null;
  carregando: boolean;
  /** O ambiente usa SSO corporativo? */
  sso: boolean;
  /** Login sem senha por seleção de perfil, disponível fora de produção. */
  entrarDemonstracao: (email: string) => Promise<void>;
  /** Manda o navegador para o provedor de identidade. */
  entrarComSso: () => void;
  sair: () => Promise<void>;

  papel: UserRole | null;
  ehRh: boolean;
  podeAprovar: boolean;
  podeGerenciar: boolean;
  equipesVisiveis: string[] | null;
}

const Contexto = createContext<ContextoAuth | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cliente = useQueryClient();

  const config = useQuery({
    queryKey: ['auth', 'config'],
    queryFn: () => api.get<ConfigAuth>('/api/auth/config'),
    staleTime: Infinity,
  });

  const sessao = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await api.get<Sessao>('/api/auth/me');
      } catch (erro) {
        // 401 é resposta esperada de quem ainda não entrou, não é falha.
        if (erro instanceof ErroApi && erro.naoAutenticado) return null;
        throw erro;
      }
    },
    retry: false,
  });

  const entrarDemonstracao = useCallback(
    async (email: string) => {
      await api.post('/api/auth/demo', { email });
      await cliente.invalidateQueries();
    },
    [cliente],
  );

  const entrarComSso = useCallback(() => {
    const destino = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/api/auth/login?destino=${encodeURIComponent(destino)}`;
  }, []);

  const sair = useCallback(async () => {
    const { redirecionar } = await api.post<{ redirecionar: string | null }>('/api/auth/logout');
    // Limpa a base em memória antes de sair: os dados são do usuário anterior.
    cliente.clear();
    // Logout federado, quando o provedor oferece; senão volta ao login.
    window.location.href = redirecionar ?? '/login';
  }, [cliente]);

  const atual = sessao.data ?? null;

  const valor = useMemo<ContextoAuth>(
    () => ({
      sessao: atual,
      carregando: sessao.isLoading || config.isLoading,
      sso: config.data?.sso ?? false,
      entrarDemonstracao,
      entrarComSso,
      sair,
      papel: atual?.papel ?? null,
      ehRh: atual?.ehRh ?? false,
      podeAprovar: atual?.ehRh ?? false,
      podeGerenciar: atual?.ehRh ?? false,
      equipesVisiveis: atual?.equipesVisiveis ?? [],
    }),
    [atual, sessao.isLoading, config.isLoading, config.data, entrarDemonstracao, entrarComSso, sair],
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
