import {
  User, Cliente, Equipe, Colaborador, Gestor,
  Escala, EscalaColaborador, EscalaDetalhe, Plantao, Ferias
} from '@/types/sgo';

export const users: User[] = [
  { id: 'u1', nome: 'Admin Master', email: 'admin@sgo.com', role: 'admin' },
  { id: 'u2', nome: 'Carlos Gestor', email: 'carlos@sgo.com', role: 'gestor', equipe_ids: ['eq1', 'eq2'] },
];

export const equipes: Equipe[] = [
  { id: 'eq1', nome: 'Suporte N1', cliente_id: 'c1', ativo: true },
  { id: 'eq2', nome: 'Suporte N2', cliente_id: 'c2', ativo: true },
  { id: 'eq3', nome: 'Infraestrutura', cliente_id: 'c3', ativo: true },
  { id: 'eq4', nome: 'Desenvolvimento', ativo: true },
  { id: 'eq5', nome: 'Monitoramento', cliente_id: 'c1', ativo: false },
];

export const colaboradores: Colaborador[] = [
  { id: 'col1', nome: 'Ana Silva', email: 'ana@sgo.com', telefone: '11999001001', equipe_id: 'eq1', tipo_contrato: 'clt', modelo_trabalho: 'presencial', ativo: true },
  { id: 'col2', nome: 'Bruno Costa', email: 'bruno@sgo.com', telefone: '11999001002', equipe_id: 'eq1', tipo_contrato: 'clt', modelo_trabalho: 'hibrido', ativo: true },
  { id: 'col3', nome: 'Carla Dias', email: 'carla@sgo.com', telefone: '11999001003', equipe_id: 'eq2', tipo_contrato: 'pj', modelo_trabalho: 'remoto', ativo: true },
  { id: 'col4', nome: 'Diego Alves', email: 'diego@sgo.com', telefone: '11999001004', equipe_id: 'eq2', tipo_contrato: 'clt', modelo_trabalho: 'presencial', ativo: true },
  { id: 'col5', nome: 'Elena Souza', email: 'elena@sgo.com', telefone: '11999001005', equipe_id: 'eq3', tipo_contrato: 'clt', modelo_trabalho: 'hibrido', ativo: true },
  { id: 'col6', nome: 'Felipe Rocha', email: 'felipe@sgo.com', telefone: '11999001006', equipe_id: 'eq3', tipo_contrato: 'temporario', modelo_trabalho: 'presencial', ativo: true },
  { id: 'col7', nome: 'Gabriela Lima', email: 'gabriela@sgo.com', telefone: '11999001007', equipe_id: 'eq4', tipo_contrato: 'clt', modelo_trabalho: 'remoto', ativo: true },
  { id: 'col8', nome: 'Hugo Martins', email: 'hugo@sgo.com', telefone: '11999001008', equipe_id: 'eq4', tipo_contrato: 'pj', modelo_trabalho: 'remoto', ativo: false },
];

export const clientes: Cliente[] = [
  { id: 'c1', nome: 'TechCorp SA', id_whatsapp: '5511999000001', escalation: 'Gerente: João Pedro', responsavel_interno_id: 'col1', ativo: true },
  { id: 'c2', nome: 'FinBank Ltda', id_whatsapp: '5511999000002', escalation: 'Diretoria: Maria Clara', responsavel_interno_id: 'col3', ativo: true },
  { id: 'c3', nome: 'LogiTrans', id_whatsapp: '5511999000003', escalation: 'Coord: Roberto', responsavel_interno_id: 'col5', ativo: true },
  { id: 'c4', nome: 'EduPlus', id_whatsapp: '5511999000004', escalation: 'Coord: Patrícia', responsavel_interno_id: 'col7', ativo: false },
];

export const gestores: Gestor[] = [
  { id: 'g1', nome: 'Carlos Gestor', email: 'carlos@sgo.com', equipe_ids: ['eq1', 'eq2'] },
  { id: 'g2', nome: 'Mariana Lopes', email: 'mariana@sgo.com', equipe_ids: ['eq3'] },
  { id: 'g3', nome: 'Ricardo Nunes', email: 'ricardo@sgo.com', equipe_ids: ['eq4'] },
];

export const escalas: Escala[] = [
  { id: 'esc1', nome: 'Suporte 12x36 Dia', tipo: '12x36', descricao: 'Turno diurno 07h–19h' },
  { id: 'esc2', nome: 'Suporte 12x36 Noite', tipo: '12x36', descricao: 'Turno noturno 19h–07h' },
  { id: 'esc3', nome: 'Comercial 5x2', tipo: '5x2', descricao: 'Seg–Sex 08h–17h' },
  { id: 'esc4', nome: 'Plantão Especial', tipo: 'personalizada', descricao: 'Cobertura fim de semana' },
];

export const escalaColaboradores: EscalaColaborador[] = [
  { id: 'ec1', colaborador_id: 'col1', escala_id: 'esc1', data_inicio: '2026-01-01', data_fim: '2026-12-31' },
  { id: 'ec2', colaborador_id: 'col2', escala_id: 'esc2', data_inicio: '2026-01-01', data_fim: '2026-12-31' },
  { id: 'ec3', colaborador_id: 'col3', escala_id: 'esc3', data_inicio: '2026-01-01', data_fim: '2026-12-31' },
  { id: 'ec4', colaborador_id: 'col4', escala_id: 'esc1', data_inicio: '2026-01-01', data_fim: '2026-12-31' },
  { id: 'ec5', colaborador_id: 'col5', escala_id: 'esc3', data_inicio: '2026-01-01', data_fim: '2026-12-31' },
  { id: 'ec6', colaborador_id: 'col6', escala_id: 'esc4', data_inicio: '2026-03-01', data_fim: '2026-06-30' },
];

export const escalaDetalhes: EscalaDetalhe[] = [
  { id: 'ed1', escala_id: 'esc1', dia_semana: 0, hora_inicio: '07:00', hora_fim: '19:00' },
  { id: 'ed2', escala_id: 'esc1', dia_semana: 2, hora_inicio: '07:00', hora_fim: '19:00' },
  { id: 'ed3', escala_id: 'esc1', dia_semana: 4, hora_inicio: '07:00', hora_fim: '19:00' },
  { id: 'ed4', escala_id: 'esc2', dia_semana: 1, hora_inicio: '19:00', hora_fim: '07:00' },
  { id: 'ed5', escala_id: 'esc2', dia_semana: 3, hora_inicio: '19:00', hora_fim: '07:00' },
  { id: 'ed6', escala_id: 'esc2', dia_semana: 5, hora_inicio: '19:00', hora_fim: '07:00' },
  { id: 'ed7', escala_id: 'esc3', dia_semana: 1, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed8', escala_id: 'esc3', dia_semana: 2, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed9', escala_id: 'esc3', dia_semana: 3, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed10', escala_id: 'esc3', dia_semana: 4, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed11', escala_id: 'esc3', dia_semana: 5, hora_inicio: '08:00', hora_fim: '17:00' },
  { id: 'ed12', escala_id: 'esc4', dia_semana: 6, hora_inicio: '08:00', hora_fim: '20:00' },
  { id: 'ed13', escala_id: 'esc4', dia_semana: 0, hora_inicio: '08:00', hora_fim: '20:00' },
];

const today = new Date();
const fmt = (d: Date) => d.toISOString().split('T')[0];

function generatePlantoes(): Plantao[] {
  const result: Plantao[] = [];
  let id = 1;
  for (let dayOffset = -7; dayOffset <= 30; dayOffset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    const dateStr = fmt(d);
    const dow = d.getDay();

    if (dow === 0 || dow === 2 || dow === 4) {
      result.push({ id: `p${id++}`, colaborador_id: 'col1', data: dateStr, hora_inicio: '07:00', hora_fim: '19:00', tipo: 'diurno' });
      result.push({ id: `p${id++}`, colaborador_id: 'col4', data: dateStr, hora_inicio: '07:00', hora_fim: '19:00', tipo: 'diurno' });
    }
    if (dow === 1 || dow === 3 || dow === 5) {
      result.push({ id: `p${id++}`, colaborador_id: 'col2', data: dateStr, hora_inicio: '19:00', hora_fim: '07:00', tipo: 'noturno' });
    }
    if (dow >= 1 && dow <= 5) {
      result.push({ id: `p${id++}`, colaborador_id: 'col3', data: dateStr, hora_inicio: '08:00', hora_fim: '17:00', tipo: 'comercial' });
      result.push({ id: `p${id++}`, colaborador_id: 'col5', data: dateStr, hora_inicio: '08:00', hora_fim: '17:00', tipo: 'comercial' });
    }
    if (dow === 6 || dow === 0) {
      result.push({ id: `p${id++}`, colaborador_id: 'col6', data: dateStr, hora_inicio: '08:00', hora_fim: '20:00', tipo: 'especial' });
    }
  }
  return result;
}

export const plantoes: Plantao[] = generatePlantoes();

export const ferias: Ferias[] = [
  { id: 'f1', colaborador_id: 'col7', data_inicio: '2026-03-20', data_fim: '2026-04-03', status: 'aprovado' },
  { id: 'f2', colaborador_id: 'col2', data_inicio: '2026-04-10', data_fim: '2026-04-24', status: 'pendente' },
  { id: 'f3', colaborador_id: 'col5', data_inicio: '2026-05-01', data_fim: '2026-05-15', status: 'aprovado' },
];

export function getPlantaoAtual(): { colaborador: Colaborador; plantao: Plantao; cliente?: Cliente }[] {
  const now = new Date();
  const todayStr = fmt(now);
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentMinutes = hour * 60 + minute;

  const feriasAtivas = ferias.filter(f => f.status === 'aprovado' && f.data_inicio <= todayStr && f.data_fim >= todayStr);
  const colabEmFerias = new Set(feriasAtivas.map(f => f.colaborador_id));

  const plantoesHoje = plantoes.filter(p => {
    if (p.data !== todayStr) return false;
    if (colabEmFerias.has(p.colaborador_id)) return false;
    const [hi, mi] = p.hora_inicio.split(':').map(Number);
    const [hf, mf] = p.hora_fim.split(':').map(Number);
    const inicio = hi * 60 + mi;
    const fim = hf * 60 + mf;
    if (fim < inicio) {
      return currentMinutes >= inicio || currentMinutes < fim;
    }
    return currentMinutes >= inicio && currentMinutes < fim;
  });

  return plantoesHoje.map(p => {
    const colab = colaboradores.find(c => c.id === p.colaborador_id)!;
    const equipe = equipes.find(e => e.id === colab.equipe_id);
    const cliente = clientes.find(c => c.id === equipe?.cliente_id);
    return { colaborador: colab, plantao: p, cliente };
  });
}

export function getProximosPlantoes(limit = 5): Plantao[] {
  const now = new Date();
  const todayStr = fmt(now);
  const hour = now.getHours();
  const currentMinutes = hour * 60 + now.getMinutes();

  return plantoes
    .filter(p => {
      if (p.data > todayStr) return true;
      if (p.data === todayStr) {
        const [h, m] = p.hora_inicio.split(':').map(Number);
        return h * 60 + m > currentMinutes;
      }
      return false;
    })
    .sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.hora_inicio.localeCompare(b.hora_inicio);
    })
    .slice(0, limit);
}
