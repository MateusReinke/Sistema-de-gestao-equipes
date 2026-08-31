/**
 * Estado central da aplicação.
 *
 * Antes cada página guardava sua própria cópia dos dados em `useState`, então
 * um cadastro feito em Funcionários não aparecia em Férias e tudo se perdia no
 * recarregamento. Aqui há uma base única, persistida em `localStorage`, com
 * trilha de auditoria de toda alteração.
 *
 * O `localStorage` é o backend provisório: trocar por uma API significa
 * reimplementar apenas as funções deste arquivo, sem tocar nas telas.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AcaoAuditoria,
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
import * as seed from '@/data/seed';
import { agora } from '@/lib/date';

const CHAVE_ARMAZENAMENTO = 'lumini.central.db';
/** Subir esta versão descarta a base local e recarrega o seed. */
const VERSAO_BASE = 5;

export interface BaseDados {
  versao: number;
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

function baseInicial(): BaseDados {
  return {
    versao: VERSAO_BASE,
    departamentos: seed.departamentos,
    clientes: seed.clientes,
    contatosCliente: seed.contatosCliente,
    niveisEscalonamento: seed.niveisEscalonamento,
    servicos: seed.servicos,
    servicosContratados: seed.servicosContratados,
    atendimentoEquipes: seed.atendimentoEquipes,
    avaliacoesCliente: seed.avaliacoesCliente,
    equipes: seed.equipes,
    funcionarios: seed.funcionarios,
    usuarios: seed.usuarios,
    escalas: seed.escalas,
    escalaDetalhes: seed.escalaDetalhes,
    escalaFuncionarios: seed.escalaFuncionarios,
    plantoes: seed.plantoes,
    ferias: seed.ferias,
    ausencias: seed.ausencias,
    sistemas: seed.sistemas,
    solicitacoesAcesso: seed.solicitacoesAcesso,
    trocasPlantao: seed.trocasPlantao,
    comunicados: seed.comunicados,
    auditoria: [],
  };
}

function carregar(): BaseDados {
  if (typeof localStorage === 'undefined') return baseInicial();
  try {
    const bruto = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (!bruto) return baseInicial();
    const salvo = JSON.parse(bruto) as Partial<BaseDados>;
    // Mudança de schema invalida a base local: melhor recomeçar do seed do que
    // renderizar telas com registros faltando campos novos.
    if (salvo.versao !== VERSAO_BASE) return baseInicial();
    return { ...baseInicial(), ...salvo, versao: VERSAO_BASE };
  } catch {
    return baseInicial();
  }
}

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

/** Insere ou substitui pelo `id`, preservando a ordem de quem já existia. */
function upsert<T extends { id: string }>(lista: T[], item: T): T[] {
  const indice = lista.findIndex((i) => i.id === item.id);
  if (indice === -1) return [...lista, item];
  const copia = [...lista];
  copia[indice] = item;
  return copia;
}

/** Coleções que aceitam decisão na Central de Aprovações. */
const COLECAO_POR_TIPO: Record<TipoPendencia, keyof BaseDados> = {
  ferias: 'ferias',
  ausencia: 'ausencias',
  acesso: 'solicitacoesAcesso',
  troca: 'trocasPlantao',
};

/* ---------------------------------------------------------------- contexto */

interface Ator {
  id: string;
  nome: string;
}

interface ContextoDados extends BaseDados {
  /** Identifica quem assina os eventos de auditoria. */
  registrarAtor: (ator: Ator | null) => void;

  salvarFuncionario: (f: Funcionario) => void;
  desligarFuncionario: (id: string, data: string) => void;
  salvarEquipe: (e: Equipe) => void;
  salvarDepartamento: (d: Departamento) => void;
  salvarEscala: (e: Escala) => void;
  salvarSistema: (s: Sistema) => void;
  salvarComunicado: (c: Comunicado) => void;
  removerComunicado: (id: string) => void;

  /* ------------------------------------------------------------ clientes */
  salvarCliente: (c: Cliente) => void;
  salvarContatoCliente: (c: ContatoCliente) => void;
  removerContatoCliente: (id: string) => void;
  salvarNivelEscalonamento: (n: NivelEscalonamento) => void;
  removerNivelEscalonamento: (id: string) => void;
  salvarServico: (s: Servico) => void;
  salvarServicoContratado: (s: ServicoContratado) => void;
  removerServicoContratado: (id: string) => void;
  salvarAtendimentoEquipe: (a: AtendimentoEquipe) => void;
  removerAtendimentoEquipe: (id: string) => void;
  salvarAvaliacaoCliente: (a: AvaliacaoCliente) => void;

  salvarFerias: (f: Ferias) => void;
  salvarAusencia: (a: Ausencia) => void;
  salvarSolicitacaoAcesso: (s: SolicitacaoAcesso) => void;
  salvarTrocaPlantao: (t: TrocaPlantao) => void;
  salvarPlantao: (p: Plantao) => void;
  removerPlantao: (id: string) => void;

  /** Aprova, rejeita, cancela ou conclui qualquer solicitação. */
  decidir: (
    tipo: TipoPendencia,
    id: string,
    status: StatusSolicitacao,
    observacao?: string,
  ) => void;

  restaurarSeed: () => void;
}

const Contexto = createContext<ContextoDados | null>(null);

export function DadosProvider({ children }: { children: React.ReactNode }) {
  const [base, setBase] = useState<BaseDados>(carregar);
  const atorRef = useRef<Ator>({ id: 'sistema', nome: 'Sistema' });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(base));
    } catch {
      // Cota estourada ou modo privado: seguimos apenas em memória.
    }
  }, [base]);

  const registrarAtor = useCallback((ator: Ator | null) => {
    atorRef.current = ator ?? { id: 'sistema', nome: 'Sistema' };
  }, []);

  /** Aplica uma mudança e registra o evento correspondente na auditoria. */
  const mutar = useCallback(
    (
      alterar: (base: BaseDados) => Partial<BaseDados>,
      registro: { acao: AcaoAuditoria; entidade: string; entidade_id: string; descricao: string },
    ) => {
      setBase((atual) => {
        const evento: EventoAuditoria = {
          id: novoId('aud'),
          em: agora(),
          ator_id: atorRef.current.id,
          ator_nome: atorRef.current.nome,
          ...registro,
        };
        return {
          ...atual,
          ...alterar(atual),
          // A trilha cresce indefinidamente sem limite; 500 eventos cobrem o
          // histórico útil sem estourar a cota do localStorage.
          auditoria: [evento, ...atual.auditoria].slice(0, 500),
        };
      });
    },
    [],
  );

  /** Fábrica das operações de "salvar" — todas seguem o mesmo formato. */
  const criarSalvar = useCallback(
    <K extends keyof BaseDados>(
      colecao: K,
      entidade: string,
      rotulo: (item: BaseDados[K] extends (infer T)[] ? T : never) => string,
    ) =>
      (item: BaseDados[K] extends (infer T)[] ? T : never) => {
        const registro = item as unknown as { id: string };
        mutar(
          (atual) => ({
            [colecao]: upsert(atual[colecao] as { id: string }[], registro),
          }) as Partial<BaseDados>,
          {
            acao: (base[colecao] as { id: string }[]).some((i) => i.id === registro.id)
              ? 'atualizou'
              : 'criou',
            entidade,
            entidade_id: registro.id,
            descricao: rotulo(item),
          },
        );
      },
    [mutar, base],
  );

  const salvarFuncionario = useCallback(
    (f: Funcionario) => criarSalvar('funcionarios', 'Funcionário', (i: Funcionario) => i.nome)(f),
    [criarSalvar],
  );
  const salvarEquipe = useCallback(
    (e: Equipe) => criarSalvar('equipes', 'Equipe', (i: Equipe) => i.nome)(e),
    [criarSalvar],
  );
  const salvarCliente = useCallback(
    (c: Cliente) => criarSalvar('clientes', 'Cliente', (i: Cliente) => i.nome)(c),
    [criarSalvar],
  );
  const salvarDepartamento = useCallback(
    (d: Departamento) => criarSalvar('departamentos', 'Departamento', (i: Departamento) => i.nome)(d),
    [criarSalvar],
  );
  const salvarEscala = useCallback(
    (e: Escala) => criarSalvar('escalas', 'Escala', (i: Escala) => i.nome)(e),
    [criarSalvar],
  );
  const salvarSistema = useCallback(
    (s: Sistema) => criarSalvar('sistemas', 'Sistema', (i: Sistema) => i.nome)(s),
    [criarSalvar],
  );
  const salvarComunicado = useCallback(
    (c: Comunicado) => criarSalvar('comunicados', 'Comunicado', (i: Comunicado) => i.titulo)(c),
    [criarSalvar],
  );
  const salvarFerias = useCallback(
    (f: Ferias) => criarSalvar('ferias', 'Férias', (i: Ferias) => i.protocolo)(f),
    [criarSalvar],
  );
  const salvarAusencia = useCallback(
    (a: Ausencia) => criarSalvar('ausencias', 'Ausência', (i: Ausencia) => i.protocolo)(a),
    [criarSalvar],
  );
  const salvarSolicitacaoAcesso = useCallback(
    (s: SolicitacaoAcesso) =>
      criarSalvar('solicitacoesAcesso', 'Acesso', (i: SolicitacaoAcesso) => i.protocolo)(s),
    [criarSalvar],
  );
  const salvarTrocaPlantao = useCallback(
    (t: TrocaPlantao) => criarSalvar('trocasPlantao', 'Troca de plantão', (i: TrocaPlantao) => i.protocolo)(t),
    [criarSalvar],
  );
  const salvarPlantao = useCallback(
    (p: Plantao) => criarSalvar('plantoes', 'Plantão', (i: Plantao) => `${i.data} ${i.hora_inicio}`)(p),
    [criarSalvar],
  );
  const salvarContatoCliente = useCallback(
    (c: ContatoCliente) =>
      criarSalvar('contatosCliente', 'Contato do cliente', (i: ContatoCliente) => i.nome)(c),
    [criarSalvar],
  );
  const salvarNivelEscalonamento = useCallback(
    (n: NivelEscalonamento) =>
      criarSalvar(
        'niveisEscalonamento',
        'Escalonamento',
        (i: NivelEscalonamento) => `N${i.nivel} — ${i.titulo}`,
      )(n),
    [criarSalvar],
  );
  const salvarServico = useCallback(
    (s: Servico) => criarSalvar('servicos', 'Serviço', (i: Servico) => i.nome)(s),
    [criarSalvar],
  );
  const salvarServicoContratado = useCallback(
    (s: ServicoContratado) =>
      criarSalvar(
        'servicosContratados',
        'Serviço contratado',
        (i: ServicoContratado) => `${i.quantidade} ${i.unidade}`,
      )(s),
    [criarSalvar],
  );
  const salvarAtendimentoEquipe = useCallback(
    (a: AtendimentoEquipe) =>
      criarSalvar('atendimentoEquipes', 'Equipe do cliente', (i: AtendimentoEquipe) => i.escopo)(a),
    [criarSalvar],
  );
  const salvarAvaliacaoCliente = useCallback(
    (a: AvaliacaoCliente) =>
      criarSalvar('avaliacoesCliente', 'Avaliação', (i: AvaliacaoCliente) => `Nota ${i.nota}`)(a),
    [criarSalvar],
  );

  /** Fábrica das operações de remoção — mesmo formato para toda coleção. */
  const criarRemover = useCallback(
    <K extends keyof BaseDados>(colecao: K, entidade: string, descricao: string) =>
      (id: string) => {
        mutar(
          (atual) => ({
            [colecao]: (atual[colecao] as { id: string }[]).filter((i) => i.id !== id),
          }) as Partial<BaseDados>,
          { acao: 'removeu', entidade, entidade_id: id, descricao },
        );
      },
    [mutar],
  );

  const removerContatoCliente = useCallback(
    (id: string) => criarRemover('contatosCliente', 'Contato do cliente', 'Contato removido')(id),
    [criarRemover],
  );
  const removerNivelEscalonamento = useCallback(
    (id: string) =>
      criarRemover('niveisEscalonamento', 'Escalonamento', 'Nível removido da trilha')(id),
    [criarRemover],
  );
  const removerServicoContratado = useCallback(
    (id: string) =>
      criarRemover('servicosContratados', 'Serviço contratado', 'Serviço retirado do contrato')(id),
    [criarRemover],
  );
  const removerAtendimentoEquipe = useCallback(
    (id: string) =>
      criarRemover('atendimentoEquipes', 'Equipe do cliente', 'Equipe desvinculada da conta')(id),
    [criarRemover],
  );

  const removerComunicado = useCallback(
    (id: string) => {
      const alvo = base.comunicados.find((c) => c.id === id);
      mutar((atual) => ({ comunicados: atual.comunicados.filter((c) => c.id !== id) }), {
        acao: 'removeu',
        entidade: 'Comunicado',
        entidade_id: id,
        descricao: alvo?.titulo ?? id,
      });
    },
    [mutar, base.comunicados],
  );

  const removerPlantao = useCallback(
    (id: string) => {
      mutar((atual) => ({ plantoes: atual.plantoes.filter((p) => p.id !== id) }), {
        acao: 'removeu',
        entidade: 'Plantão',
        entidade_id: id,
        descricao: 'Plantão removido da escala',
      });
    },
    [mutar],
  );

  const desligarFuncionario = useCallback(
    (id: string, data: string) => {
      const alvo = base.funcionarios.find((f) => f.id === id);
      mutar(
        (atual) => ({
          funcionarios: atual.funcionarios.map((f) =>
            f.id === id ? { ...f, status: 'desligado' as const, data_desligamento: data } : f,
          ),
          // Plantões futuros de quem sai viram furo de escala se ficarem;
          // removê-los força o gestor a reescalar conscientemente.
          plantoes: atual.plantoes.filter((p) => !(p.funcionario_id === id && p.data >= data)),
        }),
        {
          acao: 'atualizou',
          entidade: 'Funcionário',
          entidade_id: id,
          descricao: `${alvo?.nome ?? id} desligado em ${data}`,
        },
      );
    },
    [mutar, base.funcionarios],
  );

  const decidir = useCallback(
    (tipo: TipoPendencia, id: string, status: StatusSolicitacao, observacao?: string) => {
      const colecao = COLECAO_POR_TIPO[tipo];
      const acao: AcaoAuditoria =
        status === 'aprovada' ? 'aprovou' : status === 'rejeitada' ? 'rejeitou' : status === 'cancelada' ? 'cancelou' : 'atualizou';

      mutar(
        (atual) => {
          const lista = atual[colecao] as unknown as (BaseSolicitacaoRegistro)[];
          const alvo = lista.find((i) => i.id === id);
          const atualizada = lista.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status,
                  decidido_por: atorRef.current.id,
                  decidido_em: agora(),
                  observacao_decisao: observacao,
                }
              : item,
          );

          const mudanca = { [colecao]: atualizada } as Partial<BaseDados>;

          // Aprovar uma troca precisa refletir na escala: o titular sai e o
          // substituto entra no mesmo turno.
          if (tipo === 'troca' && status === 'aprovada' && alvo) {
            const troca = alvo as unknown as TrocaPlantao;
            const original = atual.plantoes.find((p) => p.id === troca.plantao_id);
            if (original) {
              mudanca.plantoes = [
                ...atual.plantoes.map((p) =>
                  p.id === original.id ? { ...p, status: 'trocado' as const } : p,
                ),
                {
                  ...original,
                  id: novoId('p'),
                  funcionario_id: troca.substituto_id,
                  status: 'confirmado' as const,
                },
              ];
            }
          }

          // Férias aprovadas que já começaram mudam a situação do funcionário.
          if (tipo === 'ferias' && status === 'aprovada' && alvo) {
            const f = alvo as unknown as Ferias;
            const hojeIso = new Date().toISOString().slice(0, 10);
            if (f.data_inicio <= hojeIso && f.data_fim >= hojeIso) {
              mudanca.funcionarios = atual.funcionarios.map((func) =>
                func.id === f.funcionario_id && func.status === 'ativo'
                  ? { ...func, status: 'ferias' as const }
                  : func,
              );
            }
          }

          return mudanca;
        },
        {
          acao,
          entidade: tipo,
          entidade_id: id,
          descricao: `Solicitação ${status}`,
        },
      );
    },
    [mutar],
  );

  const restaurarSeed = useCallback(() => {
    setBase(baseInicial());
  }, []);

  const valor = useMemo<ContextoDados>(
    () => ({
      ...base,
      registrarAtor,
      salvarFuncionario,
      desligarFuncionario,
      salvarEquipe,
      salvarCliente,
      salvarContatoCliente,
      removerContatoCliente,
      salvarNivelEscalonamento,
      removerNivelEscalonamento,
      salvarServico,
      salvarServicoContratado,
      removerServicoContratado,
      salvarAtendimentoEquipe,
      removerAtendimentoEquipe,
      salvarAvaliacaoCliente,
      salvarDepartamento,
      salvarEscala,
      salvarSistema,
      salvarComunicado,
      removerComunicado,
      salvarFerias,
      salvarAusencia,
      salvarSolicitacaoAcesso,
      salvarTrocaPlantao,
      salvarPlantao,
      removerPlantao,
      decidir,
      restaurarSeed,
    }),
    [
      base,
      registrarAtor,
      salvarFuncionario,
      desligarFuncionario,
      salvarEquipe,
      salvarCliente,
      salvarContatoCliente,
      removerContatoCliente,
      salvarNivelEscalonamento,
      removerNivelEscalonamento,
      salvarServico,
      salvarServicoContratado,
      removerServicoContratado,
      salvarAtendimentoEquipe,
      removerAtendimentoEquipe,
      salvarAvaliacaoCliente,
      salvarDepartamento,
      salvarEscala,
      salvarSistema,
      salvarComunicado,
      removerComunicado,
      salvarFerias,
      salvarAusencia,
      salvarSolicitacaoAcesso,
      salvarTrocaPlantao,
      salvarPlantao,
      removerPlantao,
      decidir,
      restaurarSeed,
    ],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Forma mínima que `decidir` precisa enxergar em qualquer solicitação. */
interface BaseSolicitacaoRegistro {
  id: string;
  status: StatusSolicitacao;
  decidido_por?: string;
  decidido_em?: string;
  observacao_decisao?: string;
}

export function useDados(): ContextoDados {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useDados precisa estar dentro de <DadosProvider>');
  return ctx;
}
