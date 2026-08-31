import { describe, expect, it } from 'vitest';
import {
  diasNoIntervalo,
  diferencaDias,
  duracaoTurnoHoras,
  intervalosSobrepoem,
  paraIso,
  somarDias,
  somarMeses,
  turnoCobreMinuto,
} from '@/lib/date';

describe('aritmética de datas', () => {
  it('soma dias atravessando a virada de mês e de ano', () => {
    expect(somarDias('2026-01-31', 1)).toBe('2026-02-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('soma dias sem escorregar no horário de verão', () => {
    // Interpretar a data ao meio-dia evita o clássico off-by-one de fuso.
    expect(somarDias('2026-10-17', 1)).toBe('2026-10-18');
    expect(somarDias('2026-02-14', 1)).toBe('2026-02-15');
  });

  it('trata ano bissexto', () => {
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(diferencaDias('2028-02-01', '2028-03-01')).toBe(29);
  });

  it('soma meses preservando o dia', () => {
    expect(somarMeses('2026-01-15', 12)).toBe('2027-01-15');
    expect(somarMeses('2026-06-30', 6)).toBe('2026-12-30');
  });
});

describe('intervalos', () => {
  it('conta os dias incluindo início e fim, como o RH conta férias', () => {
    expect(diasNoIntervalo('2026-04-01', '2026-04-30')).toBe(30);
    expect(diasNoIntervalo('2026-04-01', '2026-04-01')).toBe(1);
  });

  it('devolve zero para intervalo invertido ou vazio', () => {
    expect(diasNoIntervalo('2026-04-10', '2026-04-01')).toBe(0);
    expect(diasNoIntervalo('', '2026-04-01')).toBe(0);
  });

  it('detecta sobreposição inclusive quando encostam num único dia', () => {
    expect(intervalosSobrepoem('2026-01-01', '2026-01-10', '2026-01-10', '2026-01-20')).toBe(true);
    expect(intervalosSobrepoem('2026-01-01', '2026-01-10', '2026-01-11', '2026-01-20')).toBe(false);
    expect(intervalosSobrepoem('2026-01-05', '2026-01-06', '2026-01-01', '2026-01-31')).toBe(true);
  });
});

describe('turnos', () => {
  it('mede a duração de um turno que vira a meia-noite', () => {
    expect(duracaoTurnoHoras('19:00', '07:00')).toBe(12);
    expect(duracaoTurnoHoras('07:00', '19:00')).toBe(12);
    expect(duracaoTurnoHoras('08:00', '17:30')).toBe(9.5);
  });

  it('sabe se o turno cobre um minuto do dia, mesmo virando o dia', () => {
    // Plantão noturno 19h–07h: cobre 23h e 03h, não cobre 12h.
    expect(turnoCobreMinuto('19:00', '07:00', 23 * 60)).toBe(true);
    expect(turnoCobreMinuto('19:00', '07:00', 3 * 60)).toBe(true);
    expect(turnoCobreMinuto('19:00', '07:00', 12 * 60)).toBe(false);

    // O fim é exclusivo: às 07:00 em ponto o turno já acabou.
    expect(turnoCobreMinuto('19:00', '07:00', 7 * 60)).toBe(false);
    expect(turnoCobreMinuto('08:00', '17:00', 8 * 60)).toBe(true);
    expect(turnoCobreMinuto('08:00', '17:00', 17 * 60)).toBe(false);
  });
});

describe('conversão', () => {
  it('formata Date para ISO local, sem deslocar por UTC', () => {
    expect(paraIso(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01');
    expect(paraIso(new Date(2026, 11, 31, 0, 30))).toBe('2026-12-31');
  });
});
