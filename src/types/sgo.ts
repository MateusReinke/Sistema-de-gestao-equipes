export type UserRole = 'admin' | 'gestor';

export interface User {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  equipe_ids?: string[];
}

export interface Cliente {
  id: string;
  nome: string;
  id_whatsapp: string;
  escalation: string;
  responsavel_interno_id: string;
  ativo: boolean;
}

export interface Equipe {
  id: string;
  nome: string;
  cliente_id?: string;
  ativo: boolean;
}

export type ModeloTrabalho = 'presencial' | 'hibrido' | 'remoto';
export type TipoContrato = 'clt' | 'pj' | 'estagio' | 'temporario';

export interface Colaborador {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  equipe_id: string;
  tipo_contrato: TipoContrato;
  modelo_trabalho: ModeloTrabalho;
  ativo: boolean;
}

export interface Gestor {
  id: string;
  nome: string;
  email: string;
  equipe_ids: string[];
}

export type TipoEscala = '12x36' | '5x2' | 'personalizada';

export interface Escala {
  id: string;
  nome: string;
  tipo: TipoEscala;
  descricao: string;
}

export interface EscalaColaborador {
  id: string;
  colaborador_id: string;
  escala_id: string;
  data_inicio: string;
  data_fim: string;
}

export interface EscalaDetalhe {
  id: string;
  escala_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

export interface Plantao {
  id: string;
  colaborador_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: string;
}

export type StatusFerias = 'aprovado' | 'pendente' | 'rejeitado';

export interface Ferias {
  id: string;
  colaborador_id: string;
  data_inicio: string;
  data_fim: string;
  status: StatusFerias;
}
