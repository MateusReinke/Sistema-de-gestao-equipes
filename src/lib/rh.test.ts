import { describe, expect, it } from 'vitest';
import {
  aniversariantesDoMes,
  calcularSaldoFerias,
  conflitosDeEquipe,
  equipesSemCobertura,
  formatarTempoDeCasa,
  idade,
  periodoAquisitivoVigente,
  periodosAquisitivos,
  plantoesDescobertos,
  plantoesEmCurso,
  turnoverDoMes,
  validarFerias,
} from '@/lib/rh';
import type { Ausencia, Equipe, Ferias, Funcionario, Plantao } from '@/types/sgo';

const REF = '2026-06-15';

function funcionario(over: Partial<Funcionario> = {}): Funcionario {
  return {
    id: 'f1',
    matricula: '000001',
    nome: 'Ana Silva',
    email: 'ana@lumini.com.br',
    telefone: '',
    cargo: 'Analista',
    departamento_id: 'dep1',
    equipe_id: 'eq1',
    tipo_contrato: 'clt',
    modelo_trabalho: 'presencial',
    data_admissao: '2020-01-10',
    data_nascimento: '1990-06-20',
    status: 'ativo',
    local: 'São Paulo — SP',
    ...over,
  };
}

function ferias(over: Partial<Ferias> = {}): Ferias {
  return {
    id: 'fe1',
    protocolo: 'FER-1',
    funcionario_id: 'f1',
    periodo_aquisitivo_inicio: '2024-01-10',
    periodo_aquisitivo_fim: '2025-01-09',
    data_inicio: '2026-07-01',
    data_fim: '2026-07-15',
    dias: 15,
    dias_abono: 0,
    decimo_terceiro_antecipado: false,
    status: 'aprovada',
    solicitado_por: 'f1',
    solicitado_em: '2026-05-01T09:00:00.000Z',
    ...over,
  };
}

function plantao(over: Partial<Plantao> = {}): Plantao {
  return {
    id: 'p1',
    funcionario_id: 'f1',
    data: REF,
    hora_inicio: '08:00',
    hora_fim: '17:00',
    tipo: 'comercial',
    status: 'previsto',
    ...over,
  };
}

describe('períodos aquisitivos', () => {
  it('gera períodos anuais a partir da admissão', () => {
    const periodos = periodosAquisitivos('2024-03-01', '2026-06-15');
    expect(periodos[0]).toMatchObject({ inicio: '2024-03-01', fim: '2025-02-28' });
    expect(periodos[1]).toMatchObject({ inicio: '2025-03-01', fim: '2026-02-28' });
    // O terceiro ainda está em curso na data de referência.
    expect(periodos[2].completo).toBe(false);
  });

  it('define o limite concessivo 12 meses após o fim do aquisitivo', () => {
    const [primeiro] = periodosAquisitivos('2024-03-01', '2026-06-15');
    expect(primeiro.limiteConcessivo).toBe('2026-02-28');
  });

  it('não gera períodos completos para quem tem menos de um ano de casa', () => {
    const periodos = periodosAquisitivos('2026-03-01', REF);
    expect(periodos.filter((p) => p.completo)).toHaveLength(0);
  });

  it('sem histórico, o período vigente é o aquisitivo completo mais antigo', () => {
    const vigente = periodoAquisitivoVigente('2023-01-10', REF);
    expect(vigente?.inicio).toBe('2023-01-10');
  });

  it('pula os aquisitivos já gozados ao definir o período vigente', () => {
    const gozado = ferias({
      periodo_aquisitivo_inicio: '2023-01-10',
      periodo_aquisitivo_fim: '2024-01-09',
      dias: 30,
      status: 'concluida',
    });
    const vigente = periodoAquisitivoVigente('2023-01-10', REF, [gozado]);
    expect(vigente?.inicio).toBe('2024-01-10');
  });

  it('considera gozado o aquisitivo fechado com descanso mais abono', () => {
    const gozado = ferias({
      periodo_aquisitivo_inicio: '2023-01-10',
      periodo_aquisitivo_fim: '2024-01-09',
      dias: 20,
      dias_abono: 10,
      status: 'aprovada',
    });
    expect(periodoAquisitivoVigente('2023-01-10', REF, [gozado])?.inicio).toBe('2024-01-10');
  });

  it('ignora solicitação rejeitada ao apurar o que já foi gozado', () => {
    const rejeitada = ferias({
      periodo_aquisitivo_inicio: '2023-01-10',
      periodo_aquisitivo_fim: '2024-01-09',
      dias: 30,
      status: 'rejeitada',
    });
    expect(periodoAquisitivoVigente('2023-01-10', REF, [rejeitada])?.inicio).toBe('2023-01-10');
  });
});

describe('saldo de férias', () => {
  it('acumula 30 dias por período aquisitivo completo', () => {
    const saldo = calcularSaldoFerias(funcionario({ data_admissao: '2024-01-10' }), [], REF);
    expect(saldo.periodosCompletos).toBe(2);
    expect(saldo.direito).toBe(60);
    expect(saldo.saldo).toBe(60);
  });

  it('desconta dias gozados e dias vendidos como abono', () => {
    const saldo = calcularSaldoFerias(
      funcionario({ data_admissao: '2024-01-10' }),
      [ferias({ dias: 20, dias_abono: 10 })],
      REF,
    );
    expect(saldo.usados).toBe(30);
    expect(saldo.saldo).toBe(30);
  });

  it('trata solicitação pendente como reserva, não como consumo', () => {
    const saldo = calcularSaldoFerias(
      funcionario({ data_admissao: '2024-01-10' }),
      [ferias({ status: 'pendente', dias: 15 })],
      REF,
    );
    expect(saldo.usados).toBe(0);
    expect(saldo.agendados).toBe(15);
    expect(saldo.saldo).toBe(45);
  });

  it('sinaliza período concessivo vencido de quem ainda tem saldo', () => {
    // Admitido em 2020: o aquisitivo 2020–2021 venceu em 2022.
    const saldo = calcularSaldoFerias(funcionario({ data_admissao: '2020-01-10' }), [], REF);
    expect(saldo.vencido).toBe(true);
  });

  it('não acusa vencimento de quem já gozou tudo', () => {
    const gozadas: Ferias[] = Array.from({ length: 7 }, (_, i) =>
      ferias({ id: `fe${i}`, protocolo: `FER-${i}`, dias: 30, status: 'concluida' }),
    );
    const saldo = calcularSaldoFerias(funcionario({ data_admissao: '2020-01-10' }), gozadas, REF);
    expect(saldo.saldo).toBeLessThanOrEqual(0);
    expect(saldo.vencido).toBe(false);
  });
});

describe('validação de férias', () => {
  const contexto = { funcionarios: [funcionario({ data_admissao: '2024-01-10' })], ferias: [], referencia: REF };

  it('aceita um período regular', () => {
    const r = validarFerias(
      { funcionario_id: 'f1', data_inicio: '2026-08-03', data_fim: '2026-08-17', dias_abono: 0 },
      contexto,
    );
    expect(r.erros).toHaveLength(0);
  });

  it('rejeita período com menos de 5 dias (art. 134 §1º)', () => {
    const r = validarFerias(
      { funcionario_id: 'f1', data_inicio: '2026-08-03', data_fim: '2026-08-05', dias_abono: 0 },
      contexto,
    );
    expect(r.erros.some((e) => e.includes('5 dias'))).toBe(true);
  });

  it('rejeita abono acima de 10 dias (art. 143)', () => {
    const r = validarFerias(
      { funcionario_id: 'f1', data_inicio: '2026-08-03', data_fim: '2026-08-17', dias_abono: 11 },
      contexto,
    );
    expect(r.erros.some((e) => e.includes('abono'))).toBe(true);
  });

  it('rejeita data final anterior à inicial', () => {
    const r = validarFerias(
      { funcionario_id: 'f1', data_inicio: '2026-08-17', data_fim: '2026-08-03', dias_abono: 0 },
      contexto,
    );
    expect(r.erros).toHaveLength(1);
  });

  it('rejeita quando o saldo não cobre o pedido', () => {
    // Um ano de casa dá 30 dias; pedir 30 + 10 de abono estoura o saldo.
    const r = validarFerias(
      { funcionario_id: 'f1', data_inicio: '2026-08-01', data_fim: '2026-08-30', dias_abono: 10 },
      { ...contexto, funcionarios: [funcionario({ data_admissao: '2025-01-10' })] },
    );
    expect(r.erros.some((e) => e.includes('Saldo insuficiente'))).toBe(true);
  });

  it('rejeita sobreposição com outro período do mesmo funcionário', () => {
    const r = validarFerias(
      { funcionario_id: 'f1', data_inicio: '2026-07-10', data_fim: '2026-07-20', dias_abono: 0 },
      { ...contexto, ferias: [ferias()] },
    );
    expect(r.erros.some((e) => e.includes('Conflita'))).toBe(true);
  });

  it('alerta, sem bloquear, quando as férias começam no fim de semana', () => {
    // 2026-08-01 é sábado.
    const r = validarFerias(
      { funcionario_id: 'f1', data_inicio: '2026-08-01', data_fim: '2026-08-15', dias_abono: 0 },
      contexto,
    );
    expect(r.erros).toHaveLength(0);
    expect(r.alertas.some((a) => a.includes('fim de semana'))).toBe(true);
  });
});

describe('conflitos de equipe', () => {
  it('lista colegas da mesma equipe fora no mesmo período', () => {
    const colega = funcionario({ id: 'f2', nome: 'Bruno Costa', equipe_id: 'eq1' });
    const outraEquipe = funcionario({ id: 'f3', nome: 'Carla Dias', equipe_id: 'eq2' });

    const conflitos = conflitosDeEquipe(
      { funcionario_id: 'f1', data_inicio: '2026-07-05', data_fim: '2026-07-12' },
      {
        funcionarios: [funcionario(), colega, outraEquipe],
        ferias: [
          ferias({ id: 'fe2', funcionario_id: 'f2' }),
          ferias({ id: 'fe3', funcionario_id: 'f3' }),
        ],
      },
    );

    expect(conflitos.map((c) => c.id)).toEqual(['f2']);
  });
});

describe('cobertura de plantão', () => {
  it('aponta plantão de quem estará de férias', () => {
    const descobertos = plantoesDescobertos({
      plantoes: [plantao({ data: '2026-07-05' })],
      ferias: [ferias()],
      ausencias: [],
      aPartirDe: REF,
    });
    expect(descobertos).toHaveLength(1);
    expect(descobertos[0].motivo).toBe('ferias');
  });

  it('aponta plantão de quem estará afastado', () => {
    const ausencia: Ausencia = {
      id: 'au1',
      protocolo: 'AUS-1',
      funcionario_id: 'f1',
      tipo: 'licenca_medica',
      data_inicio: '2026-06-20',
      data_fim: '2026-06-30',
      dias: 11,
      justificativa: 'Cirurgia',
      abonada: true,
      status: 'aprovada',
      solicitado_por: 'f1',
      solicitado_em: '2026-06-01T09:00:00.000Z',
    };
    const descobertos = plantoesDescobertos({
      plantoes: [plantao({ data: '2026-06-25' })],
      ferias: [],
      ausencias: [ausencia],
      aPartirDe: REF,
    });
    expect(descobertos[0].motivo).toBe('ausencia');
  });

  it('ignora plantão já trocado', () => {
    const descobertos = plantoesDescobertos({
      plantoes: [plantao({ data: '2026-07-05', status: 'trocado' })],
      ferias: [ferias()],
      ausencias: [],
      aPartirDe: REF,
    });
    expect(descobertos).toHaveLength(0);
  });

  it('não considera em serviço quem está escalado mas de férias', () => {
    // Meio do turno comercial no dia de início das férias.
    const momento = new Date(2026, 6, 1, 12, 0);
    const emCurso = plantoesEmCurso(
      {
        plantoes: [plantao({ data: '2026-07-01' })],
        ferias: [ferias()],
        ausencias: [],
      },
      momento,
    );
    expect(emCurso).toHaveLength(0);
  });

  it('acusa equipe abaixo da cobertura mínima', () => {
    const equipe: Equipe = {
      id: 'eq1',
      nome: 'Suporte N1',
      cobertura_minima: 2,
      ativo: true,
    };
    const resultado = equipesSemCobertura({
      equipes: [equipe],
      funcionarios: [funcionario()],
      plantoes: [plantao({ data: REF })],
      ferias: [],
      ausencias: [],
      data: REF,
    });
    expect(resultado[0]).toMatchObject({ escalados: 1, faltam: 1 });
  });
});

describe('indicadores de pessoas', () => {
  it('calcula idade considerando se o aniversário já passou', () => {
    expect(idade('1990-06-20', REF)).toBe(35);
    expect(idade('1990-06-10', REF)).toBe(36);
  });

  it('formata tempo de casa em anos e meses', () => {
    expect(formatarTempoDeCasa('2024-06-15', REF)).toBe('2 anos');
    expect(formatarTempoDeCasa('2025-12-15', REF)).toBe('6 meses');
    expect(formatarTempoDeCasa('2024-01-15', REF)).toBe('2a 5m');
  });

  it('lista aniversariantes do mês em ordem de dia', () => {
    const lista = aniversariantesDoMes(
      [
        funcionario({ id: 'f1', nome: 'Ana', data_nascimento: '1990-06-20' }),
        funcionario({ id: 'f2', nome: 'Bruno', data_nascimento: '1992-06-03' }),
        funcionario({ id: 'f3', nome: 'Carla', data_nascimento: '1988-07-01' }),
        funcionario({ id: 'f4', nome: 'Davi', data_nascimento: '1985-06-01', status: 'desligado' }),
      ],
      REF,
    );
    expect(lista.map((f) => f.nome)).toEqual(['Bruno', 'Ana']);
  });

  it('calcula turnover do mês sobre o headcount médio', () => {
    const equipe = [
      funcionario({ id: 'f1', data_admissao: '2024-01-10' }),
      funcionario({ id: 'f2', data_admissao: '2024-01-10' }),
      funcionario({ id: 'f3', data_admissao: '2026-06-01' }),
      funcionario({
        id: 'f4',
        data_admissao: '2023-01-10',
        status: 'desligado',
        data_desligamento: '2026-06-05',
      }),
    ];
    const r = turnoverDoMes(equipe, REF);
    expect(r.admissoes).toBe(1);
    expect(r.desligamentos).toBe(1);
    // 3 ativos no fim, 3 no início → média 3 → 1/3 ≈ 33,3%.
    expect(r.taxa).toBeCloseTo(33.3, 1);
  });
});
