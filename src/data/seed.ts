/**
 * Massa de dados inicial.
 *
 * Datas de plantão, solicitações e comunicados são geradas em relação a *hoje*
 * para que a aplicação nunca abra com uma agenda vazia ou vencida, enquanto
 * cadastros (funcionários, equipes, sistemas) são fixos para permanecerem
 * estáveis entre recargas.
 */
import type {
  Ausencia,
  Cliente,
  Comunicado,
  Departamento,
  Equipe,
  Escala,
  EscalaDetalhe,
  EscalaFuncionario,
  Ferias,
  Funcionario,
  Plantao,
  Sistema,
  SolicitacaoAcesso,
  TrocaPlantao,
  Usuario,
} from '@/types/sgo';
import { diasNoIntervalo, hoje, paraIso, somarDias } from '@/lib/date';
import { periodoAquisitivoVigente, periodosAquisitivos } from '@/lib/rh';

const HOJE = hoje();
const dia = (offset: number) => somarDias(HOJE, offset);
/** Carimbo de tempo a N dias atrás, às 09:30 — hora plausível de expediente. */
const carimbo = (offsetDias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  d.setHours(9, 30, 0, 0);
  return d.toISOString();
};

export const departamentos: Departamento[] = [
  { id: 'dep1', nome: 'Operações', sigla: 'OPS', centro_custo: 'CC-1001', responsavel_id: 'f02' },
  { id: 'dep2', nome: 'Tecnologia', sigla: 'TEC', centro_custo: 'CC-1002', responsavel_id: 'f07' },
  { id: 'dep3', nome: 'Infraestrutura', sigla: 'INF', centro_custo: 'CC-1003', responsavel_id: 'f10' },
  { id: 'dep4', nome: 'Administrativo & RH', sigla: 'ADM', centro_custo: 'CC-1004', responsavel_id: 'f01' },
  { id: 'dep5', nome: 'Comercial', sigla: 'COM', centro_custo: 'CC-1005', responsavel_id: 'f16' },
];

export const clientes: Cliente[] = [
  { id: 'c1', nome: 'TechCorp S.A.', id_whatsapp: '5511990000001', escalation: 'João Pedro — Gerente de TI', responsavel_interno_id: 'f03', sla_resposta_min: 15, ativo: true },
  { id: 'c2', nome: 'FinBank Ltda.', id_whatsapp: '5511990000002', escalation: 'Maria Clara — Diretoria', responsavel_interno_id: 'f06', sla_resposta_min: 10, ativo: true },
  { id: 'c3', nome: 'LogiTrans Transportes', id_whatsapp: '5511990000003', escalation: 'Roberto Dias — Coordenação', responsavel_interno_id: 'f10', sla_resposta_min: 30, ativo: true },
  { id: 'c4', nome: 'EduPlus Educação', id_whatsapp: '5511990000004', escalation: 'Patrícia Nunes — Coordenação', responsavel_interno_id: 'f13', sla_resposta_min: 60, ativo: true },
  { id: 'c5', nome: 'HealthNet Clínicas', id_whatsapp: '5511990000005', escalation: 'Dr. Alberto — Diretor', responsavel_interno_id: 'f05', sla_resposta_min: 10, ativo: false },
];

export const equipes: Equipe[] = [
  { id: 'eq1', nome: 'Suporte N1', cliente_id: 'c1', gestor_id: 'f02', departamento_id: 'dep1', cobertura_minima: 2, ativo: true },
  { id: 'eq2', nome: 'Suporte N2', cliente_id: 'c2', gestor_id: 'f02', departamento_id: 'dep1', cobertura_minima: 2, ativo: true },
  { id: 'eq3', nome: 'NOC 24x7', cliente_id: 'c3', gestor_id: 'f10', departamento_id: 'dep3', cobertura_minima: 1, ativo: true },
  { id: 'eq4', nome: 'Desenvolvimento', gestor_id: 'f07', departamento_id: 'dep2', cobertura_minima: 0, ativo: true },
  { id: 'eq5', nome: 'Field Service', cliente_id: 'c4', gestor_id: 'f10', departamento_id: 'dep3', cobertura_minima: 1, ativo: true },
  { id: 'eq6', nome: 'Backoffice', gestor_id: 'f01', departamento_id: 'dep4', cobertura_minima: 0, ativo: true },
  { id: 'eq7', nome: 'Monitoramento Legado', cliente_id: 'c5', departamento_id: 'dep3', cobertura_minima: 0, ativo: false },
];

export const funcionarios: Funcionario[] = [
  { id: 'f01', matricula: '000101', nome: 'Helena Braga', email: 'helena.braga@lumini.com.br', telefone: '11 99100-0101', cargo: 'Gerente de RH', departamento_id: 'dep4', equipe_id: 'eq6', tipo_contrato: 'clt', modelo_trabalho: 'hibrido', data_admissao: '2019-02-11', data_nascimento: '1986-04-23', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f02', matricula: '000102', nome: 'Carlos Meireles', email: 'carlos.meireles@lumini.com.br', telefone: '11 99100-0102', cargo: 'Coordenador de Operações', departamento_id: 'dep1', equipe_id: 'eq1', gestor_id: 'f01', tipo_contrato: 'clt', modelo_trabalho: 'presencial', data_admissao: '2020-06-01', data_nascimento: '1984-09-08', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f03', matricula: '000103', nome: 'Ana Silva', email: 'ana.silva@lumini.com.br', telefone: '11 99100-0103', cargo: 'Analista de Suporte Pleno', departamento_id: 'dep1', equipe_id: 'eq1', gestor_id: 'f02', tipo_contrato: 'clt', modelo_trabalho: 'presencial', data_admissao: '2021-03-15', data_nascimento: '1994-01-30', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f04', matricula: '000104', nome: 'Bruno Costa', email: 'bruno.costa@lumini.com.br', telefone: '11 99100-0104', cargo: 'Analista de Suporte Júnior', departamento_id: 'dep1', equipe_id: 'eq1', gestor_id: 'f02', tipo_contrato: 'clt', modelo_trabalho: 'hibrido', data_admissao: '2022-08-01', data_nascimento: '1998-11-12', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f05', matricula: '000105', nome: 'Carla Dias', email: 'carla.dias@lumini.com.br', telefone: '11 99100-0105', cargo: 'Analista de Suporte Sênior', departamento_id: 'dep1', equipe_id: 'eq2', gestor_id: 'f02', tipo_contrato: 'pj', modelo_trabalho: 'remoto', data_admissao: '2020-10-05', data_nascimento: '1990-06-19', status: 'ativo', local: 'Curitiba — PR' },
  { id: 'f06', matricula: '000106', nome: 'Diego Alves', email: 'diego.alves@lumini.com.br', telefone: '11 99100-0106', cargo: 'Analista de Suporte Pleno', departamento_id: 'dep1', equipe_id: 'eq2', gestor_id: 'f02', tipo_contrato: 'clt', modelo_trabalho: 'presencial', data_admissao: '2021-09-20', data_nascimento: '1992-02-27', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f07', matricula: '000107', nome: 'Gabriela Lima', email: 'gabriela.lima@lumini.com.br', telefone: '11 99100-0107', cargo: 'Tech Lead', departamento_id: 'dep2', equipe_id: 'eq4', gestor_id: 'f01', tipo_contrato: 'clt', modelo_trabalho: 'remoto', data_admissao: '2019-11-04', data_nascimento: '1989-08-15', status: 'ativo', local: 'Florianópolis — SC' },
  { id: 'f08', matricula: '000108', nome: 'Hugo Martins', email: 'hugo.martins@lumini.com.br', telefone: '11 99100-0108', cargo: 'Desenvolvedor Pleno', departamento_id: 'dep2', equipe_id: 'eq4', gestor_id: 'f07', tipo_contrato: 'pj', modelo_trabalho: 'remoto', data_admissao: '2022-01-17', data_nascimento: '1995-05-03', status: 'ativo', local: 'Belo Horizonte — MG' },
  { id: 'f09', matricula: '000109', nome: 'Isabela Rocha', email: 'isabela.rocha@lumini.com.br', telefone: '11 99100-0109', cargo: 'Desenvolvedora Júnior', departamento_id: 'dep2', equipe_id: 'eq4', gestor_id: 'f07', tipo_contrato: 'clt', modelo_trabalho: 'remoto', data_admissao: '2023-04-03', data_nascimento: '2000-03-21', status: 'ativo', local: 'Recife — PE' },
  { id: 'f10', matricula: '000110', nome: 'Elena Souza', email: 'elena.souza@lumini.com.br', telefone: '11 99100-0110', cargo: 'Coordenadora de Infraestrutura', departamento_id: 'dep3', equipe_id: 'eq3', gestor_id: 'f01', tipo_contrato: 'clt', modelo_trabalho: 'hibrido', data_admissao: '2020-02-10', data_nascimento: '1987-12-05', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f11', matricula: '000111', nome: 'Felipe Rocha', email: 'felipe.rocha@lumini.com.br', telefone: '11 99100-0111', cargo: 'Analista de Redes', departamento_id: 'dep3', equipe_id: 'eq3', gestor_id: 'f10', tipo_contrato: 'clt', modelo_trabalho: 'presencial', data_admissao: '2021-07-12', data_nascimento: '1993-10-09', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f12', matricula: '000112', nome: 'Juliana Prado', email: 'juliana.prado@lumini.com.br', telefone: '11 99100-0112', cargo: 'Analista de NOC', departamento_id: 'dep3', equipe_id: 'eq3', gestor_id: 'f10', tipo_contrato: 'clt', modelo_trabalho: 'presencial', data_admissao: '2022-05-23', data_nascimento: '1996-07-14', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f13', matricula: '000113', nome: 'Marcelo Tavares', email: 'marcelo.tavares@lumini.com.br', telefone: '11 99100-0113', cargo: 'Técnico de Campo', departamento_id: 'dep3', equipe_id: 'eq5', gestor_id: 'f10', tipo_contrato: 'clt', modelo_trabalho: 'presencial', data_admissao: '2021-01-11', data_nascimento: '1991-04-02', status: 'ativo', local: 'Campinas — SP' },
  { id: 'f14', matricula: '000114', nome: 'Patrícia Gomes', email: 'patricia.gomes@lumini.com.br', telefone: '11 99100-0114', cargo: 'Técnica de Campo', departamento_id: 'dep3', equipe_id: 'eq5', gestor_id: 'f10', tipo_contrato: 'temporario', modelo_trabalho: 'presencial', data_admissao: '2024-02-19', data_nascimento: '1997-09-28', status: 'ativo', local: 'Campinas — SP' },
  { id: 'f15', matricula: '000115', nome: 'Rafael Antunes', email: 'rafael.antunes@lumini.com.br', telefone: '11 99100-0115', cargo: 'Analista de RH', departamento_id: 'dep4', equipe_id: 'eq6', gestor_id: 'f01', tipo_contrato: 'clt', modelo_trabalho: 'hibrido', data_admissao: '2022-03-07', data_nascimento: '1995-12-16', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f16', matricula: '000116', nome: 'Sofia Andrade', email: 'sofia.andrade@lumini.com.br', telefone: '11 99100-0116', cargo: 'Gerente Comercial', departamento_id: 'dep5', equipe_id: 'eq6', gestor_id: 'f01', tipo_contrato: 'clt', modelo_trabalho: 'hibrido', data_admissao: '2020-09-14', data_nascimento: '1988-02-08', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f17', matricula: '000117', nome: 'Thiago Bastos', email: 'thiago.bastos@lumini.com.br', telefone: '11 99100-0117', cargo: 'Estagiário de Suporte', departamento_id: 'dep1', equipe_id: 'eq1', gestor_id: 'f02', tipo_contrato: 'estagio', modelo_trabalho: 'presencial', data_admissao: '2025-02-03', data_nascimento: '2004-06-11', status: 'ativo', local: 'São Paulo — SP' },
  { id: 'f18', matricula: '000118', nome: 'Vanessa Cordeiro', email: 'vanessa.cordeiro@lumini.com.br', telefone: '11 99100-0118', cargo: 'Analista de Suporte Júnior', departamento_id: 'dep1', equipe_id: 'eq2', gestor_id: 'f02', tipo_contrato: 'clt', modelo_trabalho: 'remoto', data_admissao: '2023-10-02', data_nascimento: '1999-01-25', status: 'ativo', local: 'Salvador — BA' },
  { id: 'f19', matricula: '000119', nome: 'Otávio Ramos', email: 'otavio.ramos@lumini.com.br', telefone: '11 99100-0119', cargo: 'Analista de Suporte Pleno', departamento_id: 'dep1', equipe_id: 'eq2', gestor_id: 'f02', tipo_contrato: 'clt', modelo_trabalho: 'presencial', data_admissao: '2021-05-04', data_nascimento: '1990-11-30', status: 'desligado', local: 'São Paulo — SP', data_desligamento: dia(-12) },
  { id: 'f20', matricula: '000120', nome: 'Larissa Fontes', email: 'larissa.fontes@lumini.com.br', telefone: '11 99100-0120', cargo: 'Analista de Dados', departamento_id: 'dep2', equipe_id: 'eq4', gestor_id: 'f07', tipo_contrato: 'clt', modelo_trabalho: 'remoto', data_admissao: dia(-9), data_nascimento: '1994-08-07', status: 'ativo', local: 'Porto Alegre — RS' },
];

export const usuarios: Usuario[] = [
  { id: 'u1', funcionario_id: 'f01', email: 'helena.braga@lumini.com.br', role: 'admin', ativo: true },
  { id: 'u2', funcionario_id: 'f15', email: 'rafael.antunes@lumini.com.br', role: 'rh', ativo: true },
  { id: 'u3', funcionario_id: 'f02', email: 'carlos.meireles@lumini.com.br', role: 'gestor', ativo: true },
  { id: 'u4', funcionario_id: 'f10', email: 'elena.souza@lumini.com.br', role: 'gestor', ativo: true },
  { id: 'u5', funcionario_id: 'f03', email: 'ana.silva@lumini.com.br', role: 'colaborador', ativo: true },
];

export const escalas: Escala[] = [
  { id: 'esc1', nome: 'Plantão 12×36 — Diurno', tipo: '12x36', descricao: 'Turno diurno 07h–19h em dias alternados', ativo: true },
  { id: 'esc2', nome: 'Plantão 12×36 — Noturno', tipo: '12x36', descricao: 'Turno noturno 19h–07h em dias alternados', ativo: true },
  { id: 'esc3', nome: 'Comercial 5×2', tipo: '5x2', descricao: 'Segunda a sexta, 08h–17h', ativo: true },
  { id: 'esc4', nome: 'Cobertura de Fim de Semana', tipo: 'personalizada', descricao: 'Sábado e domingo, 08h–20h', ativo: true },
  { id: 'esc5', nome: 'Field Service 6×1', tipo: '6x1', descricao: 'Segunda a sábado, 08h–16h', ativo: true },
];

export const escalaDetalhes: EscalaDetalhe[] = [
  { id: 'ed01', escala_id: 'esc1', dia_semana: 0, hora_inicio: '07:00', hora_fim: '19:00' },
  { id: 'ed02', escala_id: 'esc1', dia_semana: 2, hora_inicio: '07:00', hora_fim: '19:00' },
  { id: 'ed03', escala_id: 'esc1', dia_semana: 4, hora_inicio: '07:00', hora_fim: '19:00' },
  { id: 'ed04', escala_id: 'esc2', dia_semana: 1, hora_inicio: '19:00', hora_fim: '07:00' },
  { id: 'ed05', escala_id: 'esc2', dia_semana: 3, hora_inicio: '19:00', hora_fim: '07:00' },
  { id: 'ed06', escala_id: 'esc2', dia_semana: 5, hora_inicio: '19:00', hora_fim: '07:00' },
  { id: 'ed07', escala_id: 'esc3', dia_semana: 1, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed08', escala_id: 'esc3', dia_semana: 2, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed09', escala_id: 'esc3', dia_semana: 3, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed10', escala_id: 'esc3', dia_semana: 4, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed11', escala_id: 'esc3', dia_semana: 5, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed12', escala_id: 'esc4', dia_semana: 6, hora_inicio: '08:00', hora_fim: '20:00' },
  { id: 'ed13', escala_id: 'esc4', dia_semana: 0, hora_inicio: '08:00', hora_fim: '20:00' },
  { id: 'ed14', escala_id: 'esc5', dia_semana: 1, hora_inicio: '08:00', hora_fim: '16:00' },
  { id: 'ed15', escala_id: 'esc5', dia_semana: 2, hora_inicio: '08:00', hora_fim: '16:00' },
  { id: 'ed16', escala_id: 'esc5', dia_semana: 3, hora_inicio: '08:00', hora_fim: '16:00' },
  { id: 'ed17', escala_id: 'esc5', dia_semana: 4, hora_inicio: '08:00', hora_fim: '16:00' },
  { id: 'ed18', escala_id: 'esc5', dia_semana: 5, hora_inicio: '08:00', hora_fim: '16:00' },
  { id: 'ed19', escala_id: 'esc5', dia_semana: 6, hora_inicio: '08:00', hora_fim: '16:00' },
];

export const escalaFuncionarios: EscalaFuncionario[] = [
  { id: 'ef1', funcionario_id: 'f03', escala_id: 'esc1', data_inicio: dia(-180), data_fim: dia(185) },
  { id: 'ef2', funcionario_id: 'f04', escala_id: 'esc2', data_inicio: dia(-180), data_fim: dia(185) },
  { id: 'ef3', funcionario_id: 'f05', escala_id: 'esc3', data_inicio: dia(-180), data_fim: dia(185) },
  { id: 'ef4', funcionario_id: 'f06', escala_id: 'esc1', data_inicio: dia(-180), data_fim: dia(185) },
  { id: 'ef5', funcionario_id: 'f11', escala_id: 'esc3', data_inicio: dia(-180), data_fim: dia(185) },
  { id: 'ef6', funcionario_id: 'f12', escala_id: 'esc4', data_inicio: dia(-90), data_fim: dia(120) },
  { id: 'ef7', funcionario_id: 'f13', escala_id: 'esc5', data_inicio: dia(-180), data_fim: dia(185) },
  { id: 'ef8', funcionario_id: 'f18', escala_id: 'esc3', data_inicio: dia(-120), data_fim: dia(185) },
];

/**
 * Gera a agenda de plantões de −21 a +45 dias a partir das escalas atribuídas,
 * cobrindo o mês anterior, o atual e o próximo na visão de calendário.
 */
function gerarPlantoes(): Plantao[] {
  const porEscala: Record<string, { tipo: Plantao['tipo']; dias: number[]; inicio: string; fim: string }> = {
    esc1: { tipo: 'diurno', dias: [0, 2, 4], inicio: '07:00', fim: '19:00' },
    esc2: { tipo: 'noturno', dias: [1, 3, 5], inicio: '19:00', fim: '07:00' },
    esc3: { tipo: 'comercial', dias: [1, 2, 3, 4, 5], inicio: '08:00', fim: '17:00' },
    esc4: { tipo: 'especial', dias: [0, 6], inicio: '08:00', fim: '20:00' },
    esc5: { tipo: 'sobreaviso', dias: [1, 2, 3, 4, 5, 6], inicio: '08:00', fim: '16:00' },
  };

  const resultado: Plantao[] = [];
  let seq = 1;

  for (let offset = -21; offset <= 45; offset++) {
    const data = dia(offset);
    const diaSemana = new Date(`${data}T12:00:00`).getDay();

    for (const vinculo of escalaFuncionarios) {
      if (data < vinculo.data_inicio || data > vinculo.data_fim) continue;
      const cfg = porEscala[vinculo.escala_id];
      if (!cfg || !cfg.dias.includes(diaSemana)) continue;

      resultado.push({
        id: `p${String(seq++).padStart(4, '0')}`,
        funcionario_id: vinculo.funcionario_id,
        escala_id: vinculo.escala_id,
        data,
        hora_inicio: cfg.inicio,
        hora_fim: cfg.fim,
        tipo: cfg.tipo,
        // Plantões passados já foram confirmados; futuros seguem previstos.
        status: offset < 0 ? 'confirmado' : 'previsto',
      });
    }
  }
  return resultado;
}

export const plantoes: Plantao[] = gerarPlantoes();

/**
 * Histórico de férias já gozadas.
 *
 * Sem ele, gente admitida em 2019 apareceria com seis períodos aquisitivos
 * intactos e o painel de risco acusaria a empresa inteira — o cálculo estaria
 * certo, mas a massa de dados é que seria irreal. Aqui cada pessoa goza os 30
 * dias de cada aquisitivo, exceto o último completo, que fica como saldo atual.
 */
function gerarHistoricoFerias(): Ferias[] {
  const historico: Ferias[] = [];
  let seq = 1;

  for (const f of funcionarios) {
    const completos = periodosAquisitivos(f.data_admissao, HOJE).filter((p) => p.completo);
    // O último completo fica em aberto para haver saldo a programar.
    for (const periodo of completos.slice(0, -1)) {
      // Gozadas ~4 meses depois do fim do aquisitivo, dentro do concessivo.
      const inicio = somarDias(periodo.fim, 120);
      const fim = somarDias(inicio, 29);
      historico.push({
        id: `feh${seq}`,
        protocolo: `FER-24${String(seq).padStart(2, '0')}`,
        funcionario_id: f.id,
        periodo_aquisitivo_inicio: periodo.inicio,
        periodo_aquisitivo_fim: periodo.fim,
        data_inicio: inicio,
        data_fim: fim,
        dias: 30,
        dias_abono: 0,
        decimo_terceiro_antecipado: false,
        status: 'concluida',
        solicitado_por: 'f15',
        solicitado_em: `${somarDias(inicio, -45)}T09:30:00.000Z`,
        decidido_por: 'f01',
        decidido_em: `${somarDias(inicio, -40)}T09:30:00.000Z`,
      });
      seq++;
    }
  }
  return historico;
}

const historicoFerias = gerarHistoricoFerias();

/** Monta um registro de férias no aquisitivo que a pessoa ainda tem em aberto. */
function criarFerias(
  id: string,
  protocolo: string,
  funcionarioId: string,
  inicio: string,
  fim: string,
  status: Ferias['status'],
  extras: Partial<Ferias> = {},
): Ferias {
  const funcionario = funcionarios.find((f) => f.id === funcionarioId)!;
  const periodo = periodoAquisitivoVigente(
    funcionario.data_admissao,
    HOJE,
    historicoFerias.filter((f) => f.funcionario_id === funcionarioId),
  );
  return {
    id,
    protocolo,
    funcionario_id: funcionarioId,
    periodo_aquisitivo_inicio: periodo?.inicio ?? funcionario.data_admissao,
    periodo_aquisitivo_fim: periodo?.fim ?? funcionario.data_admissao,
    data_inicio: inicio,
    data_fim: fim,
    dias: diasNoIntervalo(inicio, fim),
    dias_abono: 0,
    decimo_terceiro_antecipado: false,
    status,
    solicitado_por: 'f15',
    solicitado_em: carimbo(-20),
    ...extras,
  };
}

export const ferias: Ferias[] = [
  ...historicoFerias,
  criarFerias('fe1', 'FER-2601', 'f08', dia(-3), dia(12), 'aprovada', {
    solicitado_em: carimbo(-45),
    decidido_por: 'f01',
    decidido_em: carimbo(-40),
  }),
  criarFerias('fe2', 'FER-2602', 'f04', dia(18), dia(32), 'pendente', { solicitado_em: carimbo(-4) }),
  criarFerias('fe3', 'FER-2603', 'f11', dia(25), dia(39), 'pendente', { solicitado_em: carimbo(-2) }),
  criarFerias('fe4', 'FER-2604', 'f06', dia(60), dia(79), 'aprovada', {
    dias_abono: 10,
    solicitado_em: carimbo(-30),
    decidido_por: 'f01',
    decidido_em: carimbo(-26),
  }),
  criarFerias('fe6', 'FER-2606', 'f18', dia(7), dia(21), 'pendente', { solicitado_em: carimbo(-1) }),
  criarFerias('fe7', 'FER-2607', 'f16', dia(90), dia(119), 'rejeitada', {
    solicitado_em: carimbo(-14),
    decidido_por: 'f01',
    decidido_em: carimbo(-10),
    observacao_decisao: 'Conflita com o fechamento comercial do trimestre.',
  }),
];

export const ausencias: Ausencia[] = [
  { id: 'au1', protocolo: 'AUS-2601', funcionario_id: 'f03', tipo: 'atestado', data_inicio: dia(-5), data_fim: dia(-4), dias: 2, justificativa: 'Atestado médico — consulta e repouso.', abonada: true, status: 'aprovada', solicitado_por: 'f03', solicitado_em: carimbo(-5), decidido_por: 'f15', decidido_em: carimbo(-5) },
  { id: 'au2', protocolo: 'AUS-2602', funcionario_id: 'f12', tipo: 'licenca_medica', data_inicio: dia(1), data_fim: dia(15), dias: 15, justificativa: 'Procedimento cirúrgico agendado, com laudo anexado.', abonada: true, status: 'aprovada', solicitado_por: 'f12', solicitado_em: carimbo(-8), decidido_por: 'f15', decidido_em: carimbo(-6) },
  { id: 'au3', protocolo: 'AUS-2603', funcionario_id: 'f09', tipo: 'treinamento', data_inicio: dia(10), data_fim: dia(12), dias: 3, justificativa: 'Certificação AWS Solutions Architect.', abonada: true, status: 'pendente', solicitado_por: 'f09', solicitado_em: carimbo(-2) },
  { id: 'au4', protocolo: 'AUS-2604', funcionario_id: 'f17', tipo: 'falta', data_inicio: dia(-9), data_fim: dia(-9), dias: 1, justificativa: 'Falta não justificada.', abonada: false, status: 'concluida', solicitado_por: 'f02', solicitado_em: carimbo(-9), decidido_por: 'f02', decidido_em: carimbo(-9) },
  { id: 'au5', protocolo: 'AUS-2605', funcionario_id: 'f14', tipo: 'folga_compensatoria', data_inicio: dia(4), data_fim: dia(4), dias: 1, justificativa: 'Compensação de plantão extra no feriado.', abonada: true, status: 'pendente', solicitado_por: 'f14', solicitado_em: carimbo(-1) },
];

export const sistemas: Sistema[] = [
  { id: 's01', nome: 'AWS — Console', categoria: 'infraestrutura', descricao: 'Console e CLI da conta de produção.', responsavel_id: 'f10', requer_aprovacao_gestor: true, ativo: true },
  { id: 's02', nome: 'VPN Corporativa', categoria: 'infraestrutura', descricao: 'Acesso remoto à rede interna.', responsavel_id: 'f11', requer_aprovacao_gestor: true, ativo: true },
  { id: 's03', nome: 'GLPI — Service Desk', categoria: 'atendimento', descricao: 'Abertura e tratamento de chamados.', responsavel_id: 'f02', requer_aprovacao_gestor: false, ativo: true },
  { id: 's04', nome: 'Zabbix — Monitoramento', categoria: 'infraestrutura', descricao: 'Painéis e alertas de disponibilidade.', responsavel_id: 'f10', requer_aprovacao_gestor: false, ativo: true },
  { id: 's05', nome: 'Microsoft 365', categoria: 'comunicacao', descricao: 'E-mail, Teams e SharePoint.', responsavel_id: 'f11', requer_aprovacao_gestor: false, ativo: true },
  { id: 's06', nome: 'GitHub — Organização', categoria: 'desenvolvimento', descricao: 'Repositórios privados da Lumini.', responsavel_id: 'f07', requer_aprovacao_gestor: true, ativo: true },
  { id: 's07', nome: 'Jira & Confluence', categoria: 'desenvolvimento', descricao: 'Backlog de produto e documentação.', responsavel_id: 'f07', requer_aprovacao_gestor: false, ativo: true },
  { id: 's08', nome: 'ERP Financeiro', categoria: 'financeiro', descricao: 'Contas a pagar, receber e faturamento.', responsavel_id: 'f16', requer_aprovacao_gestor: true, ativo: true },
  { id: 's09', nome: 'Portal RH', categoria: 'rh', descricao: 'Folha, ponto e benefícios.', responsavel_id: 'f01', requer_aprovacao_gestor: true, ativo: true },
  { id: 's10', nome: 'Datadog', categoria: 'infraestrutura', descricao: 'Observabilidade das aplicações.', responsavel_id: 'f07', requer_aprovacao_gestor: false, ativo: true },
];

export const solicitacoesAcesso: SolicitacaoAcesso[] = [
  { id: 'sa1', protocolo: 'ACS-2601', funcionario_id: 'f20', sistema_id: 's05', tipo: 'concessao', nivel: 'escrita', justificativa: 'Onboarding — e-mail e Teams para a nova analista de dados.', status: 'pendente', solicitado_por: 'f15', solicitado_em: carimbo(-1) },
  { id: 'sa2', protocolo: 'ACS-2602', funcionario_id: 'f20', sistema_id: 's07', tipo: 'concessao', nivel: 'escrita', justificativa: 'Onboarding — acompanhamento do backlog de dados.', status: 'pendente', solicitado_por: 'f15', solicitado_em: carimbo(-1) },
  { id: 'sa3', protocolo: 'ACS-2603', funcionario_id: 'f09', sistema_id: 's01', tipo: 'concessao', nivel: 'leitura', justificativa: 'Investigar logs de produção durante o plantão de release.', status: 'pendente', solicitado_por: 'f09', solicitado_em: carimbo(-3), expira_em: dia(30) },
  { id: 'sa4', protocolo: 'ACS-2604', funcionario_id: 'f19', sistema_id: 's02', tipo: 'revogacao', nivel: 'escrita', justificativa: 'Desligamento — revogar acesso remoto.', status: 'aprovada', solicitado_por: 'f15', solicitado_em: carimbo(-12), decidido_por: 'f01', decidido_em: carimbo(-12) },
  { id: 'sa5', protocolo: 'ACS-2605', funcionario_id: 'f19', sistema_id: 's05', tipo: 'revogacao', nivel: 'escrita', justificativa: 'Desligamento — encerrar caixa postal.', status: 'concluida', solicitado_por: 'f15', solicitado_em: carimbo(-12), decidido_por: 'f01', decidido_em: carimbo(-11) },
  { id: 'sa6', protocolo: 'ACS-2606', funcionario_id: 'f06', sistema_id: 's08', tipo: 'concessao', nivel: 'admin', justificativa: 'Assumir a conciliação de faturamento do FinBank.', status: 'rejeitada', solicitado_por: 'f06', solicitado_em: carimbo(-9), decidido_por: 'f01', decidido_em: carimbo(-7), observacao_decisao: 'Nível admin não se justifica; solicitar perfil de escrita.' },
  { id: 'sa7', protocolo: 'ACS-2607', funcionario_id: 'f12', sistema_id: 's04', tipo: 'alteracao', nivel: 'admin', justificativa: 'Passar a configurar triggers do NOC, não só visualizar.', status: 'pendente', solicitado_por: 'f10', solicitado_em: carimbo(-2) },
  { id: 'sa8', protocolo: 'ACS-2608', funcionario_id: 'f18', sistema_id: 's03', tipo: 'concessao', nivel: 'escrita', justificativa: 'Passou a atender chamados do N2 diretamente.', status: 'aprovada', solicitado_por: 'f02', solicitado_em: carimbo(-20), decidido_por: 'f01', decidido_em: carimbo(-18) },
];

export const trocasPlantao: TrocaPlantao[] = [
  { id: 'tp1', protocolo: 'TRC-2601', plantao_id: plantoes.find((p) => p.data === dia(3) && p.funcionario_id === 'f03')?.id ?? plantoes[0].id, funcionario_id: 'f03', substituto_id: 'f04', motivo: 'Compromisso familiar já combinado com o Bruno.', status: 'pendente', solicitado_por: 'f03', solicitado_em: carimbo(-1) },
  { id: 'tp2', protocolo: 'TRC-2602', plantao_id: plantoes.find((p) => p.data === dia(6) && p.funcionario_id === 'f11')?.id ?? plantoes[1].id, funcionario_id: 'f11', substituto_id: 'f12', motivo: 'Consulta médica no turno.', status: 'pendente', solicitado_por: 'f11', solicitado_em: carimbo(-2) },
];

export const comunicados: Comunicado[] = [
  { id: 'cm1', titulo: 'Campanha de férias 2026 — envie sua preferência até dia 20', corpo: 'O RH está montando o calendário de férias do próximo ciclo. Registre seu período preferido pelo menu Férias. Pedidos que conflitem com a cobertura mínima da equipe serão negociados diretamente com o gestor.', categoria: 'politica', autor_id: 'f01', publicado_em: carimbo(-2), fixado: true },
  { id: 'cm2', titulo: 'Novo plano odontológico disponível', corpo: 'A partir do próximo mês o plano odontológico passa a ser opcional e sem coparticipação para dependentes diretos. A adesão pode ser feita pelo Portal RH.', categoria: 'beneficios', autor_id: 'f15', publicado_em: carimbo(-6), fixado: false },
  { id: 'cm3', titulo: 'Revisão trimestral de acessos', corpo: 'Gestores devem revisar até o fim do mês os acessos concedidos à sua equipe. Acessos sem uso nos últimos 90 dias serão revogados automaticamente.', categoria: 'urgente', autor_id: 'f10', publicado_em: carimbo(-9), fixado: true },
  { id: 'cm4', titulo: 'Boas-vindas à Larissa Fontes', corpo: 'A Larissa se junta ao time de Tecnologia como Analista de Dados. O onboarding dela acontece nesta semana — passem para dar as boas-vindas.', categoria: 'geral', autor_id: 'f15', publicado_em: carimbo(-9), fixado: false },
];

/** Data usada para carimbar a criação do banco local. */
export const criadoEm = paraIso(new Date());
