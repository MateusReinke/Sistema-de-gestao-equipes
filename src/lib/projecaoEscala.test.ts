/**
 * A projeção é o que a tela da equipe mostra, então o que se testa aqui é o
 * resultado visível: em cada dia, para cada **posição**, o turno certo — e,
 * quando não há quem cumpra, a brecha aparecendo em vez de a linha sumir.
 */
import { describe, expect, it } from 'vitest';
import type {
  Ausencia,
  EscalaCelula,
  EscalaExcecao,
  EscalaPosicao,
  Ferias,
  Funcionario,
  TipoTurno,
} from '@/types/sgo';
import { girarCiclo } from './cicloEscala';
import { TURNOS_PADRAO } from './turnos';
import {
  brechasPorDia,
  coberturaPorDia,
  diasDoIntervalo,
  projetarEscalaEquipe,
} from './projecaoEscala';

const EQUIPE = 'eq-noc';

function pessoa(id: string, nome: string, parcial: Partial<Funcionario> = {}): Funcionario {
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
    ...parcial,
  };
}

const porRotulo = (rotulo: string) => {
  const t = TURNOS_PADRAO.find((x) => x.rotulo === rotulo);
  if (!t) throw new Error(`turno "${rotulo}" não existe no padrão`);
  return t;
};

const TRABALHO = porRotulo('Trabalho').id;
const PLANTAO = porRotulo('Plantão').id;
const BACKUP = porRotulo('Backup de plantão').id;
const FOLGA = porRotulo('Folga').id;

/*
 * Domingo. Atenção à regra da planilha: a semana da data inicial é a **última**
 * do ciclo, e a `Semana 1` é a seguinte. Escolhendo 28/12 aqui, a semana de
 * 04/01 é a `Semana 1` — que é como os casos abaixo se leem.
 */
const INICIO = '2025-12-28';

function posicao(
  id: string,
  nome: string,
  funcionarioId: string | null,
  parcial: Partial<EscalaPosicao> = {},
): EscalaPosicao {
  return {
    id,
    equipe_id: EQUIPE,
    nome,
    funcionario_id: funcionarioId,
    inicio_em: INICIO,
    ordem: 0,
    ativo: true,
    ...parcial,
  };
}

/** Monta as células de uma grade, uma string por semana (Dom…Sáb). */
function celulas(posicaoId: string, ...semanas: string[][]): EscalaCelula[] {
  return semanas.flatMap((dias, i) =>
    dias
      .map((turno, dia) => ({
        id: `${posicaoId}-${i}-${dia}`,
        posicao_id: posicaoId,
        semana: i + 1,
        dia_semana: dia,
        tipo_turno_id: turno,
      }))
      .filter((c) => c.tipo_turno_id !== ''),
  );
}

/** Par 12×36: a posição A nos dias ímpares do ciclo, a B no complemento. */
const GRADE_A = celulas(
  'pos-a',
  [FOLGA, TRABALHO, FOLGA, TRABALHO, FOLGA, TRABALHO, FOLGA],
  [TRABALHO, FOLGA, TRABALHO, FOLGA, TRABALHO, FOLGA, TRABALHO],
);
const GRADE_B = girarCiclo(
  GRADE_A.map(({ semana, dia_semana, tipo_turno_id }) => ({ semana, dia_semana, tipo_turno_id })),
  1,
).map((c, i) => ({ ...c, id: `pos-b-${i}`, posicao_id: 'pos-b' }));

describe('projetarEscalaEquipe', () => {
  const base = {
    funcionarios: [pessoa('f1', 'Ana'), pessoa('f2', 'Bruno')],
    escalaPosicoes: [posicao('pos-a', 'NOC Diurno 1', 'f1'), posicao('pos-b', 'NOC Diurno 2', 'f2')],
    escalaCelulas: [...GRADE_A, ...GRADE_B],
    ferias: [] as Ferias[],
    ausencias: [] as Ausencia[],
    escalaExcecoes: [] as EscalaExcecao[],
    legenda: TURNOS_PADRAO,
  };

  /** Só os dias em que a posição realmente trabalha. */
  const diasDeTrabalho = (linha: ReturnType<typeof projetarEscalaEquipe>[number]) =>
    [...linha.dias.entries()]
      .filter(([, d]) => d.turno.id === TRABALHO)
      .map(([data]) => data)
      .sort();

  it('o par 12×36 alterna dia a dia, sem lacuna e sem sobreposição', () => {
    const [a, b] = projetarEscalaEquipe(base, EQUIPE, '2026-01-05', '2026-01-11');

    expect(a.posicao.nome).toBe('NOC Diurno 1');
    expect(a.ocupante?.nome).toBe('Ana');
    expect(diasDeTrabalho(a)).toEqual(['2026-01-05', '2026-01-07', '2026-01-09', '2026-01-11']);
    expect(diasDeTrabalho(b)).toEqual(['2026-01-06', '2026-01-08', '2026-01-10']);

    for (const data of diasDoIntervalo('2026-01-05', '2026-01-11')) {
      const trabalhando = [a, b].filter((l) => l.dias.get(data)?.turno.id === TRABALHO);
      expect(trabalhando).toHaveLength(1);
    }
  });

  it('mostra o horário do turno e o tamanho do ciclo', () => {
    const [a] = projetarEscalaEquipe(base, EQUIPE, '2026-01-05', '2026-01-05');
    expect(a.ciclo).toBe(2);
    expect(a.dias.get('2026-01-05')).toMatchObject({
      turno: { rotulo: 'Trabalho' },
      horario: '08:00–17:00',
    });
  });

  it('posição sem grade continua na lista, para o furo ficar visível', () => {
    const linhas = projetarEscalaEquipe({ ...base, escalaCelulas: [] }, EQUIPE, '2026-01-05', '2026-01-11');
    expect(linhas).toHaveLength(2);
    expect(linhas[0].dias.size).toBe(0);
    expect(linhas[0].ciclo).toBe(0);
  });

  it('posição inativa sai do quadro', () => {
    const linhas = projetarEscalaEquipe(
      { ...base, escalaPosicoes: [posicao('pos-a', 'NOC Diurno 1', 'f1', { ativo: false })] },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(linhas).toHaveLength(0);
  });

  describe('brecha na escala', () => {
    it('vaga aberta mantém os dias no calendário, marcados como vaga', () => {
      // O ponto da mudança: a escala é da equipe. Sem ninguém na vaga, o dia
      // continua existindo — é o alerta de que falta gente.
      const [a] = projetarEscalaEquipe(
        { ...base, escalaPosicoes: [posicao('pos-a', 'NOC Diurno 1', null)] },
        EQUIPE,
        '2026-01-05',
        '2026-01-11',
      );

      expect(a.ocupante).toBeUndefined();
      expect(a.dias.get('2026-01-05')).toMatchObject({
        turno: { rotulo: 'Trabalho' },
        descoberto: 'vaga',
      });
      // Folga não precisa de ninguém, então não é brecha.
      expect(a.dias.get('2026-01-06')?.descoberto).toBeUndefined();
    });

    it('desligar o ocupante abre a vaga sem apagar a escala', () => {
      const linhas = projetarEscalaEquipe(
        { ...base, funcionarios: [pessoa('f1', 'Ana', { status: 'desligado' }), pessoa('f2', 'Bruno')] },
        EQUIPE,
        '2026-01-05',
        '2026-01-11',
      );

      expect(linhas[0].ocupante).toBeUndefined();
      expect(linhas[0].ciclo).toBe(2);
      expect(linhas[0].dias.get('2026-01-05')?.descoberto).toBe('vaga');
      // A outra posição segue normal.
      expect(linhas[1].dias.get('2026-01-06')?.descoberto).toBeUndefined();
    });

    it('férias do ocupante também descobrem o dia, sem tirar da grade', () => {
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
      const [a] = projetarEscalaEquipe({ ...base, ferias }, EQUIPE, '2026-01-05', '2026-01-11');

      expect(a.dias.get('2026-01-05')?.descoberto).toBe('ferias');
      expect(a.dias.get('2026-01-05')?.turno.rotulo).toBe('Trabalho');
      expect(a.dias.get('2026-01-11')?.descoberto).toBeUndefined();
    });

    it('brechasPorDia lista só os dias em que falta gente', () => {
      const linhas = projetarEscalaEquipe(
        {
          ...base,
          escalaPosicoes: [posicao('pos-a', 'NOC Diurno 1', null), posicao('pos-b', 'NOC Diurno 2', 'f2')],
        },
        EQUIPE,
        '2026-01-05',
        '2026-01-08',
      );
      const brechas = brechasPorDia(linhas, diasDoIntervalo('2026-01-05', '2026-01-08'));

      // A posição vaga trabalha em 05 e 07; a ocupada cobre 06 e 08.
      expect([...brechas.keys()].sort()).toEqual(['2026-01-05', '2026-01-07']);
      expect(brechas.get('2026-01-05')?.[0].posicao.nome).toBe('NOC Diurno 1');
    });
  });

  it('ajuste de um dia vence o ciclo, sem mexer nos outros dias', () => {
    const excecao: EscalaExcecao = {
      id: 'ex1',
      posicao_id: 'pos-a',
      data: '2026-01-07',
      tipo_turno_id: PLANTAO,
      observacao: '',
    };
    const [a] = projetarEscalaEquipe(
      { ...base, escalaExcecoes: [excecao] },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );

    expect(a.dias.get('2026-01-07')).toMatchObject({ turno: { rotulo: 'Plantão' }, ajustado: true });
    expect(a.dias.get('2026-01-09')?.turno.rotulo).toBe('Trabalho');
    expect(a.dias.get('2026-01-09')?.ajustado).toBeUndefined();
  });

  it('o ajuste sobrevive à troca de mês — é ele que manda, não a tela', () => {
    const excecao: EscalaExcecao = {
      id: 'ex2',
      posicao_id: 'pos-a',
      data: '2026-02-14',
      tipo_turno_id: BACKUP,
      observacao: '',
    };
    const contexto = { ...base, escalaExcecoes: [excecao] };

    const [emJaneiro] = projetarEscalaEquipe(contexto, EQUIPE, '2026-01-01', '2026-01-31');
    expect(emJaneiro.dias.has('2026-02-14')).toBe(false);

    const [emFevereiro] = projetarEscalaEquipe(contexto, EQUIPE, '2026-02-01', '2026-02-28');
    expect(emFevereiro.dias.get('2026-02-14')).toMatchObject({
      turno: { rotulo: 'Backup de plantão' },
      ajustado: true,
    });
  });

  it('o ajuste fica na posição, então sobrevive à troca de ocupante', () => {
    // É a razão de a exceção não morar na pessoa: ela descreve o que a vaga
    // faz naquele dia, e continua valendo quando outra pessoa assume.
    const excecao: EscalaExcecao = {
      id: 'ex3',
      posicao_id: 'pos-a',
      data: '2026-01-07',
      tipo_turno_id: PLANTAO,
      observacao: '',
    };
    const [a] = projetarEscalaEquipe(
      {
        ...base,
        escalaPosicoes: [posicao('pos-a', 'NOC Diurno 1', 'f2')],
        escalaExcecoes: [excecao],
      },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(a.ocupante?.nome).toBe('Bruno');
    expect(a.dias.get('2026-01-07')?.turno.rotulo).toBe('Plantão');
  });

  it('ajuste sem turno esvazia o dia que o ciclo previa', () => {
    const excecao: EscalaExcecao = {
      id: 'ex4',
      posicao_id: 'pos-a',
      data: '2026-01-07',
      tipo_turno_id: null,
      observacao: '',
    };
    const [a] = projetarEscalaEquipe(
      { ...base, escalaExcecoes: [excecao] },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(a.dias.has('2026-01-07')).toBe(false);
    expect(a.dias.has('2026-01-05')).toBe(true);
  });

  it('célula apontando para turno que não existe mais deixa o dia fora do ciclo', () => {
    const orfa: EscalaCelula[] = [
      { id: 'x1', posicao_id: 'pos-a', semana: 1, dia_semana: 1, tipo_turno_id: 'tt-apagado' },
    ];
    const [a] = projetarEscalaEquipe(
      { ...base, escalaCelulas: orfa },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(a.dias.size).toBe(0);
  });

  it('posição montada noutra equipe continua no calendário, com o turno daqui', () => {
    const deOutroTime: TipoTurno[] = [
      {
        ...porRotulo('Trabalho'),
        id: 'tt-outra-equipe',
        equipe_id: 'eq-noc-noturno',
        hora_inicio: '19:00',
        hora_fim: '07:00',
      },
    ];
    const celulasAlheias: EscalaCelula[] = [
      { id: 'y1', posicao_id: 'pos-a', semana: 1, dia_semana: 1, tipo_turno_id: 'tt-outra-equipe' },
    ];
    const [a] = projetarEscalaEquipe(
      {
        ...base,
        escalaCelulas: celulasAlheias,
        turnosConhecidos: [...TURNOS_PADRAO, ...deOutroTime],
      },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );

    expect(a.legendaDeOutraEquipe).toBe(true);
    expect(a.dias.get('2026-01-05')).toMatchObject({
      turno: { rotulo: 'Trabalho', id: porRotulo('Trabalho').id },
      horario: '08:00–17:00',
    });
  });
});

describe('coberturaPorDia', () => {
  const dias = diasDoIntervalo('2026-01-05', '2026-01-06');

  it('não conta folga, backup, vaga aberta nem quem está de férias', () => {
    const linhas = [
      {
        posicao: posicao('p1', 'Posição 1', 'f1'),
        ocupante: pessoa('f1', 'Ana'),
        ciclo: 1,
        dias: new Map([
          ['2026-01-05', { turno: porRotulo('Trabalho'), horario: '09:00–18:00' }],
          ['2026-01-06', { turno: porRotulo('Backup de plantão'), horario: '00:00–23:59' }],
        ]),
      },
      {
        posicao: posicao('p2', 'Posição 2', 'f2'),
        ocupante: pessoa('f2', 'Bruno'),
        ciclo: 1,
        dias: new Map([
          [
            '2026-01-05',
            { turno: porRotulo('Trabalho'), horario: '09:00–18:00', descoberto: 'ferias' as const },
          ],
          ['2026-01-06', { turno: porRotulo('Plantão'), horario: '00:00–23:59' }],
        ]),
      },
      {
        posicao: posicao('p3', 'Posição 3', null),
        ciclo: 1,
        dias: new Map([
          [
            '2026-01-05',
            { turno: porRotulo('Trabalho'), horario: '09:00–18:00', descoberto: 'vaga' as const },
          ],
          ['2026-01-06', { turno: porRotulo('Folga'), horario: '—' }],
        ]),
      },
    ];

    const cobertura = coberturaPorDia(linhas, dias);
    // Dia 5: só a Ana trabalha de fato — Bruno de férias, posição 3 vaga.
    expect(cobertura.get('2026-01-05')).toBe(1);
    // Dia 6: Ana é só backup (não conta); Bruno está de plantão (conta).
    expect(cobertura.get('2026-01-06')).toBe(1);
  });
});
