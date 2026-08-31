/**
 * Estado da aplicação, servido pela API.
 *
 * A interface pública (`useDados()`) é a mesma de quando os dados viviam em
 * `localStorage` — as telas não sabem de onde eles vêm. O que mudou é que
 * agora há uma fonte única no Postgres, e as regras de negócio são conferidas
 * de novo no servidor antes de qualquer gravação.
 */
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  AtendimentoEquipe,
  Ausencia,
  AvaliacaoCliente,
  Cliente,
  Comunicado,
  ContatoCliente,
  Departamento,
  Equipe,
  Escala,
  EscalaDetalhe,
  EscalaFuncionario,
  EventoAuditoria,
  Ferias,
  Funcionario,
  NivelEscalonamento,
  Plantao,
  Servico,
  ServicoContratado,
  Sistema,
  SolicitacaoAcesso,
  StatusSolicitacao,
  TipoPendencia,
  TrocaPlantao,
  Usuario,
} from '@/types/sgo';
import { ErroApi, api } from '@/data/api';
import { useAuth } from '@/contexts/AuthContext';

export interface BaseDados {
  /** Intervalo de datas dos plantões carregados. */
  janelaPlantoes: { de: string; ate: string };
  departamentos: Departamento[];
  clientes: Cliente[];
  contatosCliente: ContatoCliente[];
  niveisEscalonamento: NivelEscalonamento[];
  servicos: Servico[];
  servicosContratados: ServicoContratado[];
  atendimentoEquipes: AtendimentoEquipe[];
  avaliacoesCliente: AvaliacaoCliente[];
  equipes: Equipe[];
  funcionarios: Funcionario[];
  usuarios: Usuario[];
  escalas: Escala[];
  escalaDetalhes: EscalaDetalhe[];
  escalaFuncionarios: EscalaFuncionario[];
  plantoes: Plantao[];
  ferias: Ferias[];
  ausencias: Ausencia[];
  sistemas: Sistema[];
  solicitacoesAcesso: SolicitacaoAcesso[];
  trocasPlantao: TrocaPlantao[];
  comunicados: Comunicado[];
  auditoria: EventoAuditoria[];
}

const BASE_VAZIA: BaseDados = {
  janelaPlantoes: { de: '', ate: '' },
  departamentos: [],
  clientes: [],
  contatosCliente: [],
  niveisEscalonamento: [],
  servicos: [],
  servicosContratados: [],
  atendimentoEquipes: [],
  avaliacoesCliente: [],
  equipes: [],
  funcionarios: [],
  usuarios: [],
  escalas: [],
  escalaDetalhes: [],
  escalaFuncionarios: [],
  plantoes: [],
  ferias: [],
  ausencias: [],
  sistemas: [],
  solicitacoesAcesso: [],
  trocasPlantao: [],
  comunicados: [],
  auditoria: [],
};

export const CHAVE_DADOS = ['dados'] as const;

/* ---------------------------------------------------------------- helpers */

/** Próximo protocolo sequencial de um fluxo (ex.: FER-2608). */
export function proximoProtocolo(prefixo: string, existentes: { protocolo: string }[]): string {
  const numeros = existentes
    .map((e) => Number(e.protocolo.split('-')[1]))
    .filter((n) => Number.isFinite(n));
  const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 2601;
  return `${prefixo}-${proximo}`;
}

export function novoId(prefixo: string): string {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ---------------------------------------------------------------- contexto */

interface ContextoDados extends BaseDados {
  /** Recarrega a base do servidor. */
  recarregar: () => void;
  carregando: boolean;

  salvarFuncionario: (f: Funcionario) => Promise<void>;
  desligarFuncionario: (id: string, data: string) => Promise<void>;
  salvarEquipe: (e: Equipe) => Promise<void>;
  salvarDepartamento: (d: Departamento) => Promise<void>;
  salvarEscala: (e: Escala) => Promise<void>;
  salvarSistema: (s: Sistema) => Promise<void>;
  salvarComunicado: (c: Comunicado) => Promise<void>;
  removerComunicado: (id: string) => Promise<void>;

  salvarCliente: (c: Cliente) => Promise<void>;
  salvarContatoCliente: (c: ContatoCliente) => Promise<void>;
  removerContatoCliente: (id: string) => Promise<void>;
  salvarNivelEscalonamento: (n: NivelEscalonamento) => Promise<void>;
  removerNivelEscalonamento: (id: string) => Promise<void>;
  salvarServico: (s: Servico) => Promise<void>;
  salvarServicoContratado: (s: ServicoContratado) => Promise<void>;
  removerServicoContratado: (id: string) => Promise<void>;
  salvarAtendimentoEquipe: (a: AtendimentoEquipe) => Promise<void>;
  removerAtendimentoEquipe: (id: string) => Promise<void>;
  salvarAvaliacaoCliente: (a: AvaliacaoCliente) => Promise<void>;

  salvarFerias: (f: Ferias) => Promise<void>;
  salvarAusencia: (a: Ausencia) => Promise<void>;
  salvarSolicitacaoAcesso: (s: SolicitacaoAcesso) => Promise<void>;
  salvarTrocaPlantao: (t: TrocaPlantao) => Promise<void>;
  salvarPlantao: (p: Plantao) => Promise<void>;
  removerPlantao: (id: string) => Promise<void>;

  decidir: (
    tipo: TipoPendencia,
    id: string,
    status: StatusSolicitacao,
    observacao?: string,
  ) => Promise<void>;
}

const Contexto = createContext<ContextoDados | null>(null);

export function DadosProvider({ children }: { children: React.ReactNode }) {
  const cliente = useQueryClient();
  const { sessao } = useAuth();

  const consulta = useQuery({
    queryKey: CHAVE_DADOS,
    queryFn: () => api.get<BaseDados>('/api/dados'),
    // Sem sessão a rota responde 401; esperamos o login antes de pedir.
    enabled: Boolean(sessao),
    // Sem sessão não adianta insistir: a aplicação manda para o login.
    retry: (tentativas, erro) =>
      erro instanceof ErroApi && erro.naoAutenticado ? false : tentativas < 2,
    staleTime: 30_000,
  });

  /**
   * Toda gravação recarrega a base.
   *
   * O servidor pode alterar mais do que o registro enviado — aprovar uma troca
   * reescala o plantão, desligar alguém limpa a agenda — então reconciliar
   * campo a campo no cliente daria divergência. Nesta escala de dados, buscar
   * de novo é mais simples e sempre correto.
   */
  const aoConcluir = useCallback(() => {
    void cliente.invalidateQueries({ queryKey: CHAVE_DADOS });
  }, [cliente]);

  /** Erro da API vira aviso na tela, com a mensagem que o servidor mandou. */
  const aoFalhar = useCallback((erro: unknown) => {
    const mensagem =
      erro instanceof ErroApi ? erro.message : 'Não foi possível salvar. Tente novamente.';
    toast.error(mensagem);
  }, []);

  const gravacao = useMutation({
    mutationFn: ({ colecao, item }: { colecao: string; item: { id: string } }) =>
      api.put(`/api/${colecao}/${item.id}`, item),
    onSuccess: aoConcluir,
    onError: aoFalhar,
  });

  const exclusao = useMutation({
    mutationFn: ({ colecao, id }: { colecao: string; id: string }) =>
      api.remover(`/api/${colecao}/${id}`),
    onSuccess: aoConcluir,
    onError: aoFalhar,
  });

  const salvarEm = useCallback(
    (colecao: string) => async (item: { id: string }) => {
      await gravacao.mutateAsync({ colecao, item });
    },
    [gravacao],
  );

  const removerDe = useCallback(
    (colecao: string) => async (id: string) => {
      await exclusao.mutateAsync({ colecao, id });
    },
    [exclusao],
  );

  const decidir = useCallback(
    async (tipo: TipoPendencia, id: string, status: StatusSolicitacao, observacao?: string) => {
      try {
        await api.post(`/api/solicitacoes/${tipo}/${id}/decidir`, { status, observacao });
        aoConcluir();
      } catch (erro) {
        aoFalhar(erro);
        throw erro;
      }
    },
    [aoConcluir, aoFalhar],
  );

  const desligarFuncionario = useCallback(
    async (id: string, data: string) => {
      try {
        await api.post(`/api/funcionarios/${id}/desligar`, { data });
        aoConcluir();
      } catch (erro) {
        aoFalhar(erro);
        throw erro;
      }
    },
    [aoConcluir, aoFalhar],
  );

  const base = consulta.data ?? BASE_VAZIA;

  const valor = useMemo<ContextoDados>(
    () => ({
      ...base,
      carregando: consulta.isPending,
      recarregar: aoConcluir,

      salvarFuncionario: salvarEm('funcionarios'),
      desligarFuncionario,
      salvarEquipe: salvarEm('equipes'),
      salvarDepartamento: salvarEm('departamentos'),
      salvarEscala: salvarEm('escalas'),
      salvarSistema: salvarEm('sistemas'),
      salvarComunicado: salvarEm('comunicados'),
      removerComunicado: removerDe('comunicados'),

      salvarCliente: salvarEm('clientes'),
      salvarContatoCliente: salvarEm('contatosCliente'),
      removerContatoCliente: removerDe('contatosCliente'),
      salvarNivelEscalonamento: salvarEm('niveisEscalonamento'),
      removerNivelEscalonamento: removerDe('niveisEscalonamento'),
      salvarServico: salvarEm('servicos'),
      salvarServicoContratado: salvarEm('servicosContratados'),
      removerServicoContratado: removerDe('servicosContratados'),
      salvarAtendimentoEquipe: salvarEm('atendimentoEquipes'),
      removerAtendimentoEquipe: removerDe('atendimentoEquipes'),
      salvarAvaliacaoCliente: salvarEm('avaliacoesCliente'),

      salvarFerias: salvarEm('ferias'),
      salvarAusencia: salvarEm('ausencias'),
      salvarSolicitacaoAcesso: salvarEm('solicitacoesAcesso'),
      salvarTrocaPlantao: salvarEm('trocasPlantao'),
      salvarPlantao: salvarEm('plantoes'),
      removerPlantao: removerDe('plantoes'),

      decidir,
    }),
    [base, consulta.isPending, aoConcluir, salvarEm, removerDe, decidir, desligarFuncionario],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDados(): ContextoDados {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useDados precisa estar dentro de <DadosProvider>');
  return ctx;
}
