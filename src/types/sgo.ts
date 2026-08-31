/**
 * Modelo de domínio da Central de Gestão de Pessoas.
 *
 * Convenções:
 * - Datas simples usam o formato ISO `YYYY-MM-DD` (sem fuso), porque toda a
 *   regra de negócio aqui é por dia de calendário, não por instante.
 * - Carimbos de tempo (`*_em`) usam ISO completo.
 * - Horas usam `HH:MM` em 24h.
 */

export type IsoDate = string;
export type IsoDateTime = string;
export type HoraMinuto = string;

/* ------------------------------------------------------------------ acesso */

/**
 * `rh` enxerga e decide tudo relacionado a pessoas; `gestor` só age sobre as
 * equipes que lidera; `colaborador` só enxerga os próprios registros.
 */
export type UserRole = 'admin' | 'rh' | 'gestor' | 'colaborador';

export interface Usuario {
  id: string;
  funcionario_id: string;
  email: string;
  role: UserRole;
  ativo: boolean;
}

/* ------------------------------------------------------------- organização */

export interface Departamento {
  id: string;
  nome: string;
  sigla: string;
  centro_custo: string;
  /** Funcionário responsável pela área. */
  responsavel_id?: string | null;
}

/* ---------------------------------------------------------------- clientes */

export type StatusContrato = 'ativo' | 'em_renovacao' | 'suspenso' | 'encerrado';

/** Janela de atendimento contratada. */
export type RegimeAtendimento = '24x7' | '12x5' | '8x5' | 'sob_demanda';

export interface Cliente {
  id: string;
  nome: string;
  razao_social: string;
  cnpj: string;
  id_whatsapp: string;
  segmento: string;

  /**
   * Profissional responsável pela satisfação da conta — o ponto único de
   * relacionamento, distinto de quem responde tecnicamente.
   */
  gerente_conta_id: string;
  responsavel_tecnico_id?: string | null;

  /* ---------------------------------------------------------- contrato */
  contrato_numero: string;
  contrato_inicio: IsoDate;
  /** Data de renovação/término da vigência atual. */
  contrato_fim: IsoDate;
  renovacao_automatica: boolean;
  /**
   * Antecedência contratual para avisar não-renovação. Passar dessa data sem
   * decisão significa renovar por omissão.
   */
  aviso_previa_dias: number;
  valor_mensal: number;
  status_contrato: StatusContrato;

  /* ------------------------------------------------------------- SLA */
  regime: RegimeAtendimento;
  sla_resposta_min: number;
  sla_resolucao_horas: number;

  ativo: boolean;
}

export type TipoContato = 'principal' | 'tecnico' | 'financeiro' | 'executivo';

/** Pessoa do lado do cliente. */
export interface ContatoCliente {
  id: string;
  cliente_id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  tipo: TipoContato;
  /** Contato padrão para abertura e retorno de chamados. */
  principal: boolean;
  observacao?: string | null;
}

/**
 * Um degrau do caminho de escalonamento acordado com o cliente.
 *
 * Antes isso era um campo de texto livre no cadastro, o que impedia saber a
 * quem recorrer e em quanto tempo. Cada cliente monta os próprios níveis.
 */
export interface NivelEscalonamento {
  id: string;
  cliente_id: string;
  /** 1 é o primeiro acionamento; níveis maiores são acionados depois. */
  nivel: number;
  titulo: string;
  /** Tempo sem solução até acionar o próximo nível. */
  prazo_minutos: number;
  /** Quem responde pela Lumini neste degrau. */
  responsavel_interno_id?: string | null;
  /** Quem é avisado do lado do cliente. */
  contato_cliente_id?: string | null;
  canal: string;
  instrucoes: string;
}

export type CategoriaServico =
  | 'suporte'
  | 'infraestrutura'
  | 'monitoramento'
  | 'desenvolvimento'
  | 'field_service'
  | 'consultoria';

/** Catálogo de serviços que a Lumini presta. */
export interface Servico {
  id: string;
  nome: string;
  categoria: CategoriaServico;
  descricao: string;
  ativo: boolean;
}

/** Serviço efetivamente contratado por um cliente. */
export interface ServicoContratado {
  id: string;
  cliente_id: string;
  servico_id: string;
  regime: RegimeAtendimento;
  /** Volume contratado — postos, hosts, licenças, chamados/mês. */
  quantidade: number;
  unidade: string;
  observacao?: string | null;
}

/**
 * Vínculo cliente ↔ equipe.
 *
 * É N:N porque uma equipe como o NOC 24×7 atende várias contas ao mesmo tempo,
 * e uma conta costuma ser servida por mais de uma equipe.
 */
export interface AtendimentoEquipe {
  id: string;
  cliente_id: string;
  equipe_id: string;
  /** O que essa equipe cobre nesta conta especificamente. */
  escopo: string;
  /** Equipe de frente, acionada primeiro. */
  principal: boolean;
}

/** Medição periódica de satisfação, registrada pelo gerente de conta. */
export interface AvaliacaoCliente {
  id: string;
  cliente_id: string;
  data: IsoDate;
  /** Nota NPS de 0 a 10. */
  nota: number;
  registrado_por: string;
  comentario: string;
}

export interface Equipe {
  id: string;
  nome: string;
  /** Gestor da equipe — é um funcionário, não um cadastro à parte. */
  gestor_id?: string | null;
  departamento_id?: string | null;
  /** Mínimo de pessoas em serviço para a equipe ser considerada coberta. */
  cobertura_minima: number;
  ativo: boolean;
}

/* ------------------------------------------------------------ funcionários */

export type TipoContrato = 'clt' | 'pj' | 'estagio' | 'temporario' | 'aprendiz';
export type ModeloTrabalho = 'presencial' | 'hibrido' | 'remoto';

/**
 * `ferias` e `afastado` são situações temporárias derivadas de registros de
 * férias/ausência; `desligado` é terminal.
 */
export type StatusFuncionario = 'ativo' | 'ferias' | 'afastado' | 'desligado';

export interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  email: string;
  telefone: string;
  cargo: string;
  departamento_id: string;
  equipe_id: string;
  /** Gestor direto. Vazio para o topo da hierarquia. */
  gestor_id?: string | null;
  tipo_contrato: TipoContrato;
  modelo_trabalho: ModeloTrabalho;
  data_admissao: IsoDate;
  data_nascimento: IsoDate;
  data_desligamento?: IsoDate | null;
  status: StatusFuncionario;
  local: string;
}

/* ----------------------------------------------------- escalas e plantões */

export type TipoEscala = '12x36' | '5x2' | '6x1' | 'personalizada';

export interface Escala {
  id: string;
  nome: string;
  tipo: TipoEscala;
  descricao: string;
  ativo: boolean;
}

export interface EscalaDetalhe {
  id: string;
  escala_id: string;
  /** 0 = domingo … 6 = sábado. */
  dia_semana: number;
  hora_inicio: HoraMinuto;
  hora_fim: HoraMinuto;
}

export interface EscalaFuncionario {
  id: string;
  funcionario_id: string;
  escala_id: string;
  data_inicio: IsoDate;
  data_fim: IsoDate;
}

export type TipoPlantao = 'diurno' | 'noturno' | 'comercial' | 'sobreaviso' | 'especial';

/**
 * `trocado` marca o plantão de origem depois que uma troca é aprovada; o
 * substituto recebe um plantão novo apontando para o mesmo turno.
 */
export type StatusPlantao = 'previsto' | 'confirmado' | 'trocado' | 'ausente';

export interface Plantao {
  id: string;
  funcionario_id: string;
  escala_id?: string | null;
  data: IsoDate;
  hora_inicio: HoraMinuto;
  hora_fim: HoraMinuto;
  tipo: TipoPlantao;
  status: StatusPlantao;
}

/* ------------------------------------------------------------ solicitações */

export type StatusSolicitacao =
  | 'pendente'
  | 'aprovada'
  | 'rejeitada'
  | 'cancelada'
  | 'concluida';

/** Campos comuns a tudo que passa pela Central de Aprovações. */
export interface BaseSolicitacao {
  id: string;
  protocolo: string;
  status: StatusSolicitacao;
  solicitado_por: string;
  solicitado_em: IsoDateTime;
  decidido_por?: string | null;
  decidido_em?: IsoDateTime | null;
  observacao_decisao?: string | null;
}

export interface Ferias extends BaseSolicitacao {
  funcionario_id: string;
  /** Período aquisitivo CLT que está sendo gozado. */
  periodo_aquisitivo_inicio: IsoDate;
  periodo_aquisitivo_fim: IsoDate;
  data_inicio: IsoDate;
  data_fim: IsoDate;
  dias: number;
  /** Venda de até 1/3 do período (abono pecuniário, art. 143 CLT). */
  dias_abono: number;
  decimo_terceiro_antecipado: boolean;
}

export type TipoAusencia =
  | 'atestado'
  | 'falta'
  | 'licenca_medica'
  | 'licenca_maternidade'
  | 'licenca_paternidade'
  | 'luto'
  | 'folga_compensatoria'
  | 'treinamento';

export interface Ausencia extends BaseSolicitacao {
  funcionario_id: string;
  tipo: TipoAusencia;
  data_inicio: IsoDate;
  data_fim: IsoDate;
  dias: number;
  justificativa: string;
  abonada: boolean;
}

export type CategoriaSistema =
  | 'infraestrutura'
  | 'financeiro'
  | 'comunicacao'
  | 'desenvolvimento'
  | 'atendimento'
  | 'rh';

export interface Sistema {
  id: string;
  nome: string;
  categoria: CategoriaSistema;
  descricao: string;
  /** Funcionário dono do sistema, que executa a concessão após aprovação. */
  responsavel_id: string;
  /** Exige aval do gestor direto antes de chegar ao RH/TI. */
  requer_aprovacao_gestor: boolean;
  ativo: boolean;
}

export type NivelAcesso = 'leitura' | 'escrita' | 'admin';
export type TipoAcesso = 'concessao' | 'alteracao' | 'revogacao';

export interface SolicitacaoAcesso extends BaseSolicitacao {
  funcionario_id: string;
  sistema_id: string;
  tipo: TipoAcesso;
  nivel: NivelAcesso;
  justificativa: string;
  /** Data de expiração para acesso temporário. */
  expira_em?: IsoDate | null;
}

export interface TrocaPlantao extends BaseSolicitacao {
  plantao_id: string;
  /** Quem sai do plantão. */
  funcionario_id: string;
  /** Quem assume, já tendo concordado fora do sistema. */
  substituto_id: string;
  motivo: string;
}

/* ------------------------------------------------- comunicação e auditoria */

export type CategoriaComunicado = 'geral' | 'beneficios' | 'politica' | 'evento' | 'urgente';

export interface Comunicado {
  id: string;
  titulo: string;
  corpo: string;
  categoria: CategoriaComunicado;
  autor_id: string;
  publicado_em: IsoDateTime;
  fixado: boolean;
}

export type AcaoAuditoria = 'criou' | 'atualizou' | 'removeu' | 'aprovou' | 'rejeitou' | 'cancelou';

export interface EventoAuditoria {
  id: string;
  em: IsoDateTime;
  ator_id: string;
  ator_nome: string;
  acao: AcaoAuditoria;
  entidade: string;
  entidade_id: string;
  descricao: string;
}

/* -------------------------------------------------------- visão unificada */

export type TipoPendencia = 'ferias' | 'ausencia' | 'acesso' | 'troca';

/**
 * Linha normalizada da Central de Aprovações. Permite tratar os quatro fluxos
 * de solicitação numa lista só sem perder o vínculo com o registro original.
 */
export interface Pendencia {
  id: string;
  tipo: TipoPendencia;
  protocolo: string;
  funcionario_id: string;
  titulo: string;
  detalhe: string;
  solicitado_em: IsoDateTime;
  status: StatusSolicitacao;
  equipe_id?: string | null;
}
