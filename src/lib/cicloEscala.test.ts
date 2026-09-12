/**
 * O critério aqui não é "a função devolve um objeto bonito": é bater com a
 * planilha. Os casos abaixo são recortes literais do arquivo da operação
 * (`Escala De Plantão Geral V3.xlsx`) — a grade de cadastro de cada pessoa e o
 * mês que o Excel calculou com ela. Se um dia a conta mudar, isto quebra.
 */
import { describe, expect, it } from 'vitest';
import type { IsoDate } from '@/types/sgo';
import { somarDias } from './date';
import {
  type CelulaCiclo,
  ciclosPorDia,
  girarCiclo,
  semanaDoCiclo,
  semanasDoCiclo,
  turnoDoDia,
} from './cicloEscala';

/** Monta a grade do jeito que a planilha mostra: uma string por semana. */
function grade(...semanas: string[][]): CelulaCiclo[] {
  return semanas.flatMap((dias, i) =>
    dias.map((turno, dia) => ({ semana: i + 1, dia_semana: dia, tipo_turno_id: turno })),
  );
}

/** Dom, Seg, Ter, Qua, Qui, Sex, Sáb. */
const ADRIANO = grade(
  ['Folga', 'T.5', 'T.5', 'T.5', 'T.5', 'T.5', 'T.3'],
  ['T.3', 'T.4', 'T.4', 'T.4', 'T.4', 'T.4', 'T.2'],
  ['T.2', 'T.1', 'T.1', 'T.1', 'T.1', 'T.1', 'Folga'],
);
const LUCIANO = grade(
  ['T.2', 'T.1', 'T.1', 'T.1', 'T.1', 'T.1', 'Folga'],
  ['Folga', 'T.5', 'T.5', 'T.5', 'T.5', 'T.5', 'T.3'],
  ['T.3', 'T.4', 'T.4', 'T.4', 'T.4', 'T.4', 'T.2'],
);
const FABIO = grade(
  ['T.3', 'T.4', 'T.4', 'T.4', 'T.4', 'T.4', 'T.2'],
  ['T.2', 'T.1', 'T.1', 'T.1', 'T.1', 'T.1', 'Folga'],
  ['Folga', 'T.5', 'T.5', 'T.5', 'T.5', 'T.5', 'T.3'],
);

/** Todos os cadastros da planilha partem de 01/01/2017. */
const INICIO: IsoDate = '2017-01-01';

/** O mês inteiro, dia 1 ao 31, como o Excel gravou na aba do plantão. */
function mes(celulas: CelulaCiclo[], primeiroDia: IsoDate, dias: number): string[] {
  return Array.from({ length: dias }, (_, i) =>
    turnoDoDia({ inicio_em: INICIO, celulas }, somarDias(primeiroDia, i)) ?? '',
  );
}

describe('turnoDoDia — maio/2023 da planilha, plantão de infra', () => {
  const MAIO = '2023-05-01';

  it('Fabio sai exatamente como na planilha', () => {
    expect(mes(FABIO, MAIO, 31)).toEqual([
      'T.5', 'T.5', 'T.5', 'T.5', 'T.5', 'T.3', // 01–06
      'T.3', 'T.4', 'T.4', 'T.4', 'T.4', 'T.4', 'T.2', // 07–13
      'T.2', 'T.1', 'T.1', 'T.1', 'T.1', 'T.1', 'Folga', // 14–20
      'Folga', 'T.5', 'T.5', 'T.5', 'T.5', 'T.5', 'T.3', // 21–27
      'T.3', 'T.4', 'T.4', 'T.4', // 28–31
    ]);
  });

  it('Adriano sai exatamente como na planilha', () => {
    expect(mes(ADRIANO, MAIO, 31)).toEqual([
      'T.1', 'T.1', 'T.1', 'T.1', 'T.1', 'Folga',
      'Folga', 'T.5', 'T.5', 'T.5', 'T.5', 'T.5', 'T.3',
      'T.3', 'T.4', 'T.4', 'T.4', 'T.4', 'T.4', 'T.2',
      'T.2', 'T.1', 'T.1', 'T.1', 'T.1', 'T.1', 'Folga',
      'Folga', 'T.5', 'T.5', 'T.5',
    ]);
  });

  it('Luciano sai exatamente como na planilha', () => {
    expect(mes(LUCIANO, MAIO, 31)).toEqual([
      'T.4', 'T.4', 'T.4', 'T.4', 'T.4', 'T.2',
      'T.2', 'T.1', 'T.1', 'T.1', 'T.1', 'T.1', 'Folga',
      'Folga', 'T.5', 'T.5', 'T.5', 'T.5', 'T.5', 'T.3',
      'T.3', 'T.4', 'T.4', 'T.4', 'T.4', 'T.4', 'T.2',
      'T.2', 'T.1', 'T.1', 'T.1',
    ]);
  });

  it('os três nunca estão na mesma semana do rodízio', () => {
    for (let i = 0; i < 31; i += 1) {
      const dia = somarDias(MAIO, i);
      const semanas = [FABIO, ADRIANO, LUCIANO].map((c) =>
        semanaDoCiclo(INICIO, dia, semanasDoCiclo(c)),
      );
      // Mesma semana do ciclo para os três — o que separa é a grade girada.
      expect(new Set(semanas).size).toBe(1);
      // E, no dia, os três turnos são sempre diferentes: um trabalha, um está
      // de plantão, um está no meio do rodízio.
      const turnos = [FABIO, ADRIANO, LUCIANO].map(
        (c) => turnoDoDia({ inicio_em: INICIO, celulas: c }, dia),
      );
      expect(new Set(turnos).size).toBe(3);
    }
  });
});

describe('semanaDoCiclo', () => {
  it('a semana da data inicial é a última do ciclo, e a seguinte é a 1', () => {
    // É o `MOD(...)=0 → ciclo` da planilha. Parece invertido, mas é o que
    // alinha o rodízio com o calendário real.
    expect(semanaDoCiclo('2026-01-04', '2026-01-07', 3)).toBe(3);
    expect(semanaDoCiclo('2026-01-04', '2026-01-11', 3)).toBe(1);
    expect(semanaDoCiclo('2026-01-04', '2026-01-18', 3)).toBe(2);
    expect(semanaDoCiclo('2026-01-04', '2026-01-25', 3)).toBe(3);
    expect(semanaDoCiclo('2026-01-04', '2026-02-01', 3)).toBe(1);
  });

  it('não depende do dia da semana da data inicial, só da semana', () => {
    // Quarta e sexta da mesma semana têm de dar o mesmo resultado.
    for (const inicio of ['2026-01-04', '2026-01-07', '2026-01-10']) {
      expect(semanaDoCiclo(inicio, '2026-01-14', 2)).toBe(1);
    }
  });

  it('anda para trás sem quebrar em datas anteriores ao início', () => {
    expect(semanaDoCiclo('2026-01-04', '2025-12-28', 3)).toBe(2);
    expect(semanaDoCiclo('2026-01-04', '2025-12-21', 3)).toBe(1);
  });

  it('atravessa a virada do ano sem repetir semana', () => {
    // Aqui a planilha erra: o WEEKNUM dela volta para 1 em janeiro. Contamos
    // semanas corridas, então o rodízio de 2 semanas continua alternando.
    const dias = ['2025-12-21', '2025-12-28', '2026-01-04', '2026-01-11'];
    expect(dias.map((d) => semanaDoCiclo('2025-12-07', d, 2))).toEqual([2, 1, 2, 1]);
  });

  it('sem ciclo devolve 0 em vez de dividir por zero', () => {
    expect(semanaDoCiclo('2026-01-04', '2026-01-11', 0)).toBe(0);
  });
});

describe('ciclosPorDia', () => {
  it('conta o ciclo por coluna de dia da semana, como o COUNTA da planilha', () => {
    // Caso real (Carlos Eduardo Lopes): semana 2 preenchida só de segunda a
    // sexta. Domingo e sábado repetem toda semana; o miolo alterna.
    const celulas = grade(
      ['Folga', 'T.1', 'T.1', 'T.1', 'T.1', 'T.1', 'Folga'],
      ['', 'T.4', 'T.4', 'T.4', 'T.4', 'T.4', ''],
    ).filter((c) => c.tipo_turno_id !== '');

    expect(ciclosPorDia(celulas)).toEqual([1, 2, 2, 2, 2, 2, 1]);

    // 01/05/2023 é segunda. O domingo seguinte (07) folga sempre; as segundas
    // alternam T.4 / T.1.
    const ciclo = { inicio_em: INICIO, celulas };
    expect(turnoDoDia(ciclo, '2023-05-01')).toBe('T.4');
    expect(turnoDoDia(ciclo, '2023-05-07')).toBe('Folga');
    expect(turnoDoDia(ciclo, '2023-05-08')).toBe('T.1');
    expect(turnoDoDia(ciclo, '2023-05-14')).toBe('Folga');
    expect(turnoDoDia(ciclo, '2023-05-15')).toBe('T.4');
  });

  it('dia sem nenhuma célula não projeta nada', () => {
    const celulas = grade(['', 'T.1', 'T.1', 'T.1', 'T.1', 'T.1', '']).filter(
      (c) => c.tipo_turno_id !== '',
    );
    expect(turnoDoDia({ inicio_em: INICIO, celulas }, '2023-05-07')).toBeNull();
    expect(turnoDoDia({ inicio_em: INICIO, celulas }, '2023-05-08')).toBe('T.1');
  });
});

describe('girarCiclo', () => {
  it('reproduz o rodízio de três da planilha a partir de uma grade só', () => {
    expect(girarCiclo(ADRIANO, 1)).toEqual(LUCIANO);
    expect(girarCiclo(ADRIANO, 2)).toEqual(FABIO);
    expect(girarCiclo(ADRIANO, 3)).toEqual(ADRIANO);
  });

  it('girar é o mesmo que atrasar a pessoa em uma semana', () => {
    // O que Adriano faz nesta semana, quem foi girado em 1 faz na seguinte.
    const girado = girarCiclo(ADRIANO, 1);
    for (let i = 0; i < 21; i += 1) {
      const dia = somarDias('2023-05-01', i);
      expect(turnoDoDia({ inicio_em: INICIO, celulas: girado }, somarDias(dia, 7))).toBe(
        turnoDoDia({ inicio_em: INICIO, celulas: ADRIANO }, dia),
      );
    }
  });

  it('girar uma grade vazia não inventa células', () => {
    expect(girarCiclo([], 2)).toEqual([]);
  });

  it('aceita giro negativo', () => {
    expect(girarCiclo(ADRIANO, -1)).toEqual(girarCiclo(ADRIANO, 2));
  });
});

describe('o par 12×36 numa grade de 2 semanas', () => {
  // Caso real da planilha (Jean Santana e David Silva, turno 19:00–07:00):
  // duas grades de 2 semanas, uma o complemento da outra.
  const JEAN = grade(
    ['Folga', 'T.5', 'Folga', 'T.5', 'Folga', 'T.5', 'Folga'],
    ['T.5', 'Folga', 'T.5', 'Folga', 'T.5', 'Folga', 'T.5'],
  );
  const DAVID = girarCiclo(JEAN, 1);

  it('um cobre exatamente os dias que o outro folga', () => {
    for (let i = 0; i < 28; i += 1) {
      const dia = somarDias('2026-01-04', i);
      const a = turnoDoDia({ inicio_em: INICIO, celulas: JEAN }, dia);
      const b = turnoDoDia({ inicio_em: INICIO, celulas: DAVID }, dia);
      expect([a, b].filter((t) => t === 'T.5')).toHaveLength(1);
    }
  });

  it('ninguém trabalha dois dias seguidos', () => {
    for (const celulas of [JEAN, DAVID]) {
      const trabalhados: number[] = [];
      for (let i = 0; i < 28; i += 1) {
        const dia = somarDias('2026-01-04', i);
        if (turnoDoDia({ inicio_em: INICIO, celulas }, dia) === 'T.5') trabalhados.push(i);
      }
      expect(trabalhados).toHaveLength(14);
      for (let i = 1; i < trabalhados.length; i += 1) {
        expect(trabalhados[i] - trabalhados[i - 1]).toBe(2);
      }
    }
  });
});
