/**
 * Rótulos em português e mapeamento de status para estilo visual.
 *
 * Centralizado para que "aprovada" tenha o mesmo texto e a mesma cor em todas
 * as telas — antes cada página redefinia sua própria função de badge.
 */
import type {
  CategoriaComunicado,
  CategoriaServico,
  CategoriaSistema,
  ModeloTrabalho,
  RegimeAtendimento,
  StatusContrato,
  TipoContato,
  NivelAcesso,
  StatusFuncionario,
  StatusPlantao,
  StatusSolicitacao,
  TipoAcesso,
  TipoAusencia,
  TipoContrato,
  TipoEscala,
  TipoPendencia,
  TipoPlantao,
  UserRole,
} from '@/types/sgo';

export const CONTRATO: Record<TipoContrato, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  temporario: 'Temporário',
  aprendiz: 'Aprendiz',
};

export const MODELO_TRABALHO: Record<ModeloTrabalho, string> = {
  presencial: 'Presencial',
  hibrido: 'Híbrido',
  remoto: 'Remoto',
};

export const STATUS_FUNCIONARIO: Record<StatusFuncionario, string> = {
  ativo: 'Ativo',
  ferias: 'Em férias',
  afastado: 'Afastado',
  desligado: 'Desligado',
};

export const STATUS_SOLICITACAO: Record<StatusSolicitacao, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  rejeitada: 'Rejeitada',
  cancelada: 'Cancelada',
  concluida: 'Concluída',
};

export const TIPO_PENDENCIA: Record<TipoPendencia, string> = {
  ferias: 'Férias',
  ausencia: 'Ausência',
  acesso: 'Acesso',
  troca: 'Troca de plantão',
};

export const TIPO_AUSENCIA: Record<TipoAusencia, string> = {
  atestado: 'Atestado',
  falta: 'Falta',
  licenca_medica: 'Licença médica',
  licenca_maternidade: 'Licença-maternidade',
  licenca_paternidade: 'Licença-paternidade',
  luto: 'Luto',
  folga_compensatoria: 'Folga compensatória',
  treinamento: 'Treinamento',
};

export const TIPO_ESCALA: Record<TipoEscala, string> = {
  '12x36': '12×36',
  '5x2': '5×2',
  '6x1': '6×1',
  personalizada: 'Personalizada',
};

export const TIPO_PLANTAO: Record<TipoPlantao, string> = {
  diurno: 'Diurno',
  noturno: 'Noturno',
  comercial: 'Comercial',
  sobreaviso: 'Sobreaviso',
  especial: 'Especial',
};

export const STATUS_PLANTAO: Record<StatusPlantao, string> = {
  previsto: 'Previsto',
  confirmado: 'Confirmado',
  trocado: 'Trocado',
  ausente: 'Ausente',
};

export const CATEGORIA_SISTEMA: Record<CategoriaSistema, string> = {
  infraestrutura: 'Infraestrutura',
  financeiro: 'Financeiro',
  comunicacao: 'Comunicação',
  desenvolvimento: 'Desenvolvimento',
  atendimento: 'Atendimento',
  rh: 'RH',
};

export const NIVEL_ACESSO: Record<NivelAcesso, string> = {
  leitura: 'Leitura',
  escrita: 'Escrita',
  admin: 'Administrador',
};

export const TIPO_ACESSO: Record<TipoAcesso, string> = {
  concessao: 'Concessão',
  alteracao: 'Alteração',
  revogacao: 'Revogação',
};

export const CATEGORIA_COMUNICADO: Record<CategoriaComunicado, string> = {
  geral: 'Geral',
  beneficios: 'Benefícios',
  politica: 'Política',
  evento: 'Evento',
  urgente: 'Urgente',
};

export const STATUS_CONTRATO: Record<StatusContrato, string> = {
  ativo: 'Vigente',
  em_renovacao: 'Em renovação',
  suspenso: 'Suspenso',
  encerrado: 'Encerrado',
};

export const REGIME_ATENDIMENTO: Record<RegimeAtendimento, string> = {
  '24x7': '24×7',
  '12x5': '12×5',
  '8x5': '8×5 (comercial)',
  sob_demanda: 'Sob demanda',
};

export const TIPO_CONTATO: Record<TipoContato, string> = {
  principal: 'Principal',
  tecnico: 'Técnico',
  financeiro: 'Financeiro',
  executivo: 'Executivo',
};

export const CATEGORIA_SERVICO: Record<CategoriaServico, string> = {
  suporte: 'Suporte',
  infraestrutura: 'Infraestrutura',
  monitoramento: 'Monitoramento',
  desenvolvimento: 'Desenvolvimento',
  field_service: 'Field Service',
  consultoria: 'Consultoria',
};

export const CLASSE_STATUS_CONTRATO: Record<StatusContrato, string> = {
  ativo: 'bg-success/15 text-success-strong border-success/30',
  em_renovacao: 'bg-warning/15 text-warning-strong border-warning/30',
  suspenso: 'bg-destructive/15 text-destructive border-destructive/30',
  encerrado: 'bg-muted text-muted-foreground border-border',
};

export const CLASSE_TIPO_CONTATO: Record<TipoContato, string> = {
  principal: 'bg-primary/15 text-primary border-primary/30',
  tecnico: 'bg-info/15 text-info-strong border-info/30',
  financeiro: 'bg-success/15 text-success-strong border-success/30',
  executivo: 'bg-brand-coral/15 text-brand-coral border-brand-coral/30',
};

/** Cores das faixas de NPS: detrator vermelho, neutro âmbar, promotor verde. */
export const CLASSE_NPS: Record<'detrator' | 'neutro' | 'promotor', string> = {
  detrator: 'bg-destructive/15 text-destructive border-destructive/30',
  neutro: 'bg-warning/15 text-warning-strong border-warning/30',
  promotor: 'bg-success/15 text-success-strong border-success/30',
};

export const ROTULO_NPS: Record<'detrator' | 'neutro' | 'promotor', string> = {
  detrator: 'Detrator',
  neutro: 'Neutro',
  promotor: 'Promotor',
};

/** Reais sem centavos — os valores de contrato aqui são sempre cheios. */
export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

export const PAPEL: Record<UserRole, string> = {
  admin: 'Administrador',
  rh: 'RH',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
};

/* -------------------------------------------------------------- aparência */

/**
 * Classes de badge por status. Usamos classes utilitárias diretas em vez das
 * variantes do shadcn porque precisamos de mais de quatro estados semânticos.
 */
export const CLASSE_STATUS_SOLICITACAO: Record<StatusSolicitacao, string> = {
  pendente: 'bg-warning/15 text-warning-strong border-warning/30',
  aprovada: 'bg-success/15 text-success-strong border-success/30',
  rejeitada: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelada: 'bg-muted text-muted-foreground border-border',
  concluida: 'bg-info/15 text-info-strong border-info/30',
};

export const CLASSE_STATUS_FUNCIONARIO: Record<StatusFuncionario, string> = {
  ativo: 'bg-success/15 text-success-strong border-success/30',
  ferias: 'bg-info/15 text-info-strong border-info/30',
  afastado: 'bg-warning/15 text-warning-strong border-warning/30',
  desligado: 'bg-muted text-muted-foreground border-border',
};

export const CLASSE_TIPO_PLANTAO: Record<TipoPlantao, string> = {
  diurno: 'bg-warning/15 text-warning-strong border-warning/30',
  noturno: 'bg-info/15 text-info-strong border-info/30',
  comercial: 'bg-primary/15 text-primary border-primary/30',
  sobreaviso: 'bg-brand-coral/15 text-brand-coral border-brand-coral/30',
  especial: 'bg-success/15 text-success-strong border-success/30',
};

export const CLASSE_TIPO_PENDENCIA: Record<TipoPendencia, string> = {
  ferias: 'bg-info/15 text-info-strong border-info/30',
  ausencia: 'bg-warning/15 text-warning-strong border-warning/30',
  acesso: 'bg-primary/15 text-primary border-primary/30',
  troca: 'bg-brand-coral/15 text-brand-coral border-brand-coral/30',
};

export const CLASSE_CATEGORIA_COMUNICADO: Record<CategoriaComunicado, string> = {
  geral: 'bg-muted text-muted-foreground border-border',
  beneficios: 'bg-success/15 text-success-strong border-success/30',
  politica: 'bg-info/15 text-info-strong border-info/30',
  evento: 'bg-primary/15 text-primary border-primary/30',
  urgente: 'bg-destructive/15 text-destructive border-destructive/30',
};

/** Iniciais para avatares — no máximo duas letras. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Primeiro nome — usado onde o espaço é apertado (células de calendário). */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0];
}
