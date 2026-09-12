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
  EscalaCelula,
  EscalaPosicao,
  EscalaExcecao,
  EventoAuditoria,
  Ferias,
  Funcionario,
  NivelEscalonamento,
  Plantao,
  Servico,
  ServicoContratado,
  Sistema,
  SolicitacaoAcesso,
  TipoTurno,
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
  tiposTurno: TipoTurno[];
  escalaPosicoes: EscalaPosicao[];
  escalaCelulas: EscalaCelula[];
  escalaExcecoes: EscalaExcecao[];
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
  tiposTurno: [],
  escalaPosicoes: [],
  escalaCelulas: [],
  escalaExcecoes: [],
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
  salvarTipoTurno: (t: TipoTurno) => Promise<void>;
  removerTipoTurno: (id: string) => Promise<void>;
  /** Turnos e vínculos caem junto (cascata); plantões já gerados ficam, órfãos. */
  /** Ajuste de um dia solto, por cima do padrão do ciclo. */
  salvarEscalaExcecao: (e: EscalaExcecao) => Promise<void>;
  removerEscalaExcecao: (id: string) => Promise<void>;
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
  gerarPlantoesEquipe: (
    equipeId: string,
    de: string,
    ate: string,
    sobrescrever?: boolean,
  ) => Promise<{ criados: number; atualizados: number; pulados: number; vagas: number }>;
  salvarPosicao: (p: EscalaPosicao) => Promise<void>;
  removerPosicao: (id: string) => Promise<void>;
  /** Esvazia a grade de uma posição, mantendo a vaga de pé. */
  removerCiclo: (posicaoId: string) => Promise<void>;
  /** Troca o ciclo inteiro de uma posição — ver `/api/posicoes/:id/ciclo`. */
  salvarCiclo: (
    posicaoId: string,
    inicioEm: string,
    celulas: Omit<EscalaCelula, 'id' | 'posicao_id'>[],
  ) => Promise<void>;

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

  const gerarPlantoesEquipe = useCallback(
    async (equipeId: string, de: string, ate: string, sobrescrever?: boolean) => {
      try {
        const resultado = await api.post<{
          criados: number;
          atualizados: number;
          pulados: number;
          vagas: number;
        }>(
          `/api/equipes/${equipeId}/gerar-plantoes`,
          { de, ate, sobrescrever },
        );
        aoConcluir();
        return resultado;
      } catch (erro) {
        aoFalhar(erro);
        throw erro;
      }
    },
    [aoConcluir, aoFalhar],
  );

  const salvarCiclo = useCallback(
    async (
      posicaoId: string,
      inicioEm: string,
      celulas: Omit<EscalaCelula, 'id' | 'posicao_id'>[],
    ) => {
      try {
        await api.put(`/api/posicoes/${posicaoId}/ciclo`, { inicio_em: inicioEm, celulas });
        aoConcluir();
      } catch (erro) {
        aoFalhar(erro);
        throw erro;
      }
    },
    [aoConcluir, aoFalhar],
  );

  const removerCiclo = useCallback(
    async (posicaoId: string) => {
      try {
        await api.remover(`/api/posicoes/${posicaoId}/ciclo`);
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
      salvarPosicao: salvarEm('escalaPosicoes'),
      removerPosicao: removerDe('escalaPosicoes'),
      salvarTipoTurno: salvarEm('tiposTurno'),
      removerTipoTurno: removerDe('tiposTurno'),
      salvarEscalaExcecao: salvarEm('escalaExcecoes'),
      removerEscalaExcecao: removerDe('escalaExcecoes'),
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
      gerarPlantoesEquipe,
      salvarCiclo,
      removerCiclo,

      decidir,
    }),
    [
      base,
      consulta.isPending,
      aoConcluir,
      salvarEm,
      removerDe,
      decidir,
      desligarFuncionario,
      gerarPlantoesEquipe,
      salvarCiclo,
      removerCiclo,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useDados(): ContextoDados {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useDados precisa estar dentro de <DadosProvider>');
  return ctx;
}
