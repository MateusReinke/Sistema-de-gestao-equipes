/**
 * Sessão e permissões, resolvidas pelo servidor.
 *
 * O papel e o alcance de equipes vêm de `/api/auth/me`; aqui eles só orientam
 * o que a interface mostra. Quem realmente autoriza é a API — esconder um
 * botão não impede ninguém de chamar a rota.
 *
 * Duas formas de entrar convivem: senha cadastrada na própria central e SSO
 * corporativo. Quais estão no ar vem de `/api/auth/config`, que o
 * administrador controla pela tela de Autenticação.
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
  /** Senha emitida por outra pessoa: precisa ser trocada antes de seguir. */
  deveTrocarSenha: boolean;
}

/** Formas de entrada oferecidas por esta instalação. */
export interface MetodosEntrada {
  senhaLocal: boolean;
  sso: boolean;
  /** Senha local ligada por variável de ambiente, apesar de desligada na tela. */
  senhaLocalForcada: boolean;
}

interface ContextoAuth {
  sessao: Sessao | null;
  carregando: boolean;
  metodos: MetodosEntrada;

  entrarComSenha: (email: string, senha: string) => Promise<void>;
  /** Manda o navegador para o provedor de identidade. */
  entrarComSso: () => void;
  trocarSenha: (senhaAtual: string, senhaNova: string) => Promise<void>;
  sair: () => Promise<void>;

  papel: UserRole | null;
  ehRh: boolean;
  ehAdmin: boolean;
  podeAprovar: boolean;
  podeGerenciar: boolean;
  equipesVisiveis: string[] | null;
}

const Contexto = createContext<ContextoAuth | null>(null);

/** Enquanto a configuração não chega, supomos senha local: é o caso comum. */
const METODOS_PADRAO: MetodosEntrada = { senhaLocal: true, sso: false, senhaLocalForcada: false };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cliente = useQueryClient();

  const config = useQuery({
    queryKey: ['auth', 'config'],
    queryFn: () => api.get<MetodosEntrada>('/api/auth/config'),
    staleTime: 5 * 60_000,
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

  const entrarComSenha = useCallback(
    async (email: string, senha: string) => {
      await api.post('/api/auth/login', { email, senha });
      // Tudo que estava em cache era de "ninguém logado".
      await cliente.invalidateQueries();
    },
    [cliente],
  );

  const entrarComSso = useCallback(() => {
    const destino = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/api/auth/sso?destino=${encodeURIComponent(destino)}`;
  }, []);

  const trocarSenha = useCallback(
    async (senhaAtual: string, senhaNova: string) => {
      await api.post('/api/auth/senha', { senhaAtual, senhaNova });
      // `deveTrocarSenha` mudou; a sessão precisa ser relida.
      await cliente.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    [cliente],
  );

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
      metodos: config.data ?? METODOS_PADRAO,
      entrarComSenha,
      entrarComSso,
      trocarSenha,
      sair,
      papel: atual?.papel ?? null,
      ehRh: atual?.ehRh ?? false,
      ehAdmin: atual?.papel === 'admin',
      podeAprovar: atual?.ehRh ?? false,
      podeGerenciar: atual?.ehRh ?? false,
      equipesVisiveis: atual?.equipesVisiveis ?? [],
    }),
    [
      atual,
      sessao.isLoading,
      config.isLoading,
      config.data,
      entrarComSenha,
      entrarComSso,
      trocarSenha,
      sair,
    ],
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
