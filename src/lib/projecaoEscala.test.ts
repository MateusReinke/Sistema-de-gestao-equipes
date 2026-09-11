/**
 * A projeção é o que a tela da equipe mostra, então o que se testa aqui é o
 * resultado visível: em cada dia, para cada pessoa, o estado certo — inclusive
 * quando o dia vem de duas escalas ao mesmo tempo.
 */
import { describe, expect, it } from 'vitest';
import type {
  Ausencia,
  Escala,
  EscalaDetalhe,
  EscalaFuncionario,
  Ferias,
  Funcionario,
} from '@/types/sgo';
import { gerarRevezamentoDiario } from './composicaoEscalas';
import { coberturaPorDia, diasDoIntervalo, projetarEscalaEquipe } from './projecaoEscala';

const EQUIPE = 'eq-noc';

function pessoa(id: string, nome: string): Funcionario {
  return {
    id,
    matricula: id,
    nome,
    email: `${id}@lumini.com`,
    telefone: '',
    cargo: 'Analista',
    departamento_id: 'dep1',
    equipe_id: EQUIPE,
    tipo_contrato: 'clt',
    modelo_trabalho: 'presencial',
    data_admissao: '2020-01-01',
    data_nascimento: '1990-01-01',
    status: 'ativo',
    local: 'São Paulo',
  };
}

function escala(id: string, parcial: Partial<Escala> = {}): Escala {
  return {
    id,
    nome: id,
    tipo: '12x36',
    descricao: '',
    equipe_id: EQUIPE,
    ciclo_semanas: 2,
    papel: 'trabalho',
    turno_tipo: 'noturno',
    turno_inicio: '19:00',
    turno_fim: '07:00',
    sobreaviso_inicio: '00:00',
    sobreaviso_fim: '23:59',
    ativo: true,
    ...parcial,
  };
}

function vinculo(id: string, funcionarioId: string, escalaId: string, ancora: string): EscalaFuncionario {
  return {
    id,
    funcionario_id: funcionarioId,
    escala_id: escalaId,
    ancora_em: ancora,
    data_inicio: '2026-01-01',
    data_fim: '2026-12-31',
  };
}

const ANCORA = '2026-01-05'; // segunda

/** O par 12×36 montado pelo compositor, pronto para virar linhas gravadas. */
const par = gerarRevezamentoDiario({
  diaBase: ANCORA,
  horaInicio: '19:00',
  horaFim: '07:00',
  tipo: 'noturno',
});

const detalhesPar: EscalaDetalhe[] = [
  ...par.detalhesPosicao1.map((d, i) => ({ ...d, id: `a${i}`, escala_id: 'esc-n1' })),
  ...par.detalhesPosicao2.map((d, i) => ({ ...d, id: `b${i}`, escala_id: 'esc-n2' })),
];

describe('projetarEscalaEquipe', () => {
  const base = {
    funcionarios: [pessoa('f1', 'Ana'), pessoa('f2', 'Bruno')],
    escalas: [escala('esc-n1'), escala('esc-n2')],
    escalaDetalhes: detalhesPar,
    escalaFuncionarios: [
      vinculo('v1', 'f1', 'esc-n1', ANCORA),
      vinculo('v2', 'f2', 'esc-n2', ANCORA),
    ],
    ferias: [] as Ferias[],
    ausencias: [] as Ausencia[],
  };

  it('o par 12×36 aparece alternando dia a dia, sem lacuna', () => {
    const linhas = projetarEscalaEquipe(base, EQUIPE, '2026-01-05', '2026-01-11');
    const [ana, bruno] = linhas;

    expect(ana.funcionario.nome).toBe('Ana');
    expect([...ana.dias.keys()].sort()).toEqual([
      '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-11',
    ]);
    expect([...bruno.dias.keys()].sort()).toEqual([
      '2026-01-06', '2026-01-08', '2026-01-10',
    ]);
    // Todo dia do período é coberto por exatamente uma das duas.
    for (const data of diasDoIntervalo('2026-01-05', '2026-01-11')) {
      expect(Number(ana.dias.has(data)) + Number(bruno.dias.has(data))).toBe(1);
    }
  });

  it('mostra o horário e o estado do dia', () => {
    const [ana] = projetarEscalaEquipe(base, EQUIPE, '2026-01-05', '2026-01-05');
    expect(ana.dias.get('2026-01-05')).toMatchObject({
      estado: 'trabalho',
      horario: '19:00–07:00',
    });
  });

  it('pessoa vinculada a duas escalas no mesmo dia vira "trabalho + plantão"', () => {
    // Comercial de dia numa escala, sobreaviso na outra — sem código híbrido.
    const comercial = escala('esc-com', {
      tipo: '5x2',
      ciclo_semanas: 1,
      turno_tipo: 'comercial',
      turno_inicio: '09:00',
      turno_fim: '18:00',
    });
    const plantao = escala('esc-plantao', { tipo: 'personalizada', ciclo_semanas: 1, papel: 'plantao' });

    const linhas = projetarEscalaEquipe(
      {
        ...base,
        funcionarios: [pessoa('f3', 'Carla')],
        escalas: [comercial, plantao],
        escalaDetalhes: [
          { id: 'c1', escala_id: 'esc-com', semana_do_ciclo: 1, dia_semana: 1, hora_inicio: '09:00', hora_fim: '18:00', tipo: 'comercial' },
          { id: 'p1', escala_id: 'esc-plantao', semana_do_ciclo: 1, dia_semana: 1, hora_inicio: '00:00', hora_fim: '23:59', tipo: 'sobreaviso' },
        ],
        escalaFuncionarios: [
          vinculo('v3', 'f3', 'esc-com', ANCORA),
          vinculo('v4', 'f3', 'esc-plantao', ANCORA),
        ],
      },
      EQUIPE,
      '2026-01-05',
      '2026-01-05',
    );

    expect(linhas[0].dias.get('2026-01-05')).toMatchObject({
      estado: 'trabalho_plantao',
      // O horário mostrado é o do turno, não o da janela de acionamento.
      horario: '09:00–18:00',
    });
    expect(linhas[0].escalas).toHaveLength(2);
  });

  it('marca quem está escalado mas de férias, sem tirar da grade', () => {
    const ferias: Ferias[] = [
      {
        id: 'fe1',
        protocolo: 'FER-1',
        status: 'aprovada',
        solicitado_por: 'f1',
        solicitado_em: '2025-12-01T00:00:00.000Z',
        funcionario_id: 'f1',
        periodo_aquisitivo_inicio: '2025-01-01',
        periodo_aquisitivo_fim: '2025-12-31',
        data_inicio: '2026-01-05',
        data_fim: '2026-01-09',
        dias: 5,
        dias_abono: 0,
        decimo_terceiro_antecipado: false,
      },
    ];
    const [ana] = projetarEscalaEquipe({ ...base, ferias }, EQUIPE, '2026-01-05', '2026-01-11');

    expect(ana.dias.get('2026-01-05')?.indisponivel).toBe('ferias');
    expect(ana.dias.get('2026-01-11')?.indisponivel).toBeUndefined();
  });

  it('pessoa sem escala continua na lista, para o furo ficar visível', () => {
    const linhas = projetarEscalaEquipe(
      { ...base, escalaFuncionarios: [] },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0].dias.size).toBe(0);
  });

  it('escala inativa não projeta nada', () => {
    const linhas = projetarEscalaEquipe(
      { ...base, escalas: [escala('esc-n1', { ativo: false }), escala('esc-n2')] },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(linhas[0].dias.size).toBe(0);
    expect(linhas[1].dias.size).toBeGreaterThan(0);
  });
});

describe('coberturaPorDia', () => {
  const dias = diasDoIntervalo('2026-01-05', '2026-01-06');

  it('não conta backup nem quem está de férias como cobertura', () => {
    const linhas = [
      {
        funcionario: pessoa('f1', 'Ana'),
        escalas: [],
        dias: new Map([
          ['2026-01-05', { estado: 'trabalho' as const, horario: '09:00–18:00' }],
          ['2026-01-06', { estado: 'backup' as const, horario: '00:00–23:59' }],
        ]),
      },
      {
        funcionario: pessoa('f2', 'Bruno'),
        escalas: [],
        dias: new Map([
          ['2026-01-05', { estado: 'trabalho' as const, horario: '09:00–18:00', indisponivel: 'ferias' as const }],
          ['2026-01-06', { estado: 'plantao' as const, horario: '00:00–23:59' }],
        ]),
      },
    ];

    const cobertura = coberturaPorDia(linhas, dias);
    // Dia 5: Ana trabalha (conta), Bruno está de férias (não conta).
    expect(cobertura.get('2026-01-05')).toBe(1);
    // Dia 6: Ana é só backup (não conta), Bruno está de plantão (conta).
    expect(cobertura.get('2026-01-06')).toBe(1);
  });
});
