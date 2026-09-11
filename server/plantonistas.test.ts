/**
 * `plantaoEstaAtivo` é o núcleo da API de plantonista: decidir, por dia de
 * calendário e minuto, se um turno gravado em `data` está em curso agora —
 * inclusive quando cruza a meia-noite. Errar aqui manda a automação acionar
 * a pessoa errada, ou ninguém.
 */
import { describe, expect, it } from 'vitest';
import { localDeInstante, plantaoEstaAtivo } from './plantonistas';

const HOJE = '2026-09-09';
const ONTEM = '2026-09-08';

describe('plantaoEstaAtivo', () => {
  it('turno comercial de hoje cobre o meio do expediente', () => {
    const p = { data: HOJE, hora_inicio: '08:00', hora_fim: '17:00' };
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 14 * 60)).toBe(true);
  });

  it('turno comercial de hoje não cobre antes do início nem depois do fim', () => {
    const p = { data: HOJE, hora_inicio: '08:00', hora_fim: '17:00' };
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 7 * 60)).toBe(false);
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 17 * 60)).toBe(false);
  });

  it('turno comercial de ontem não vaza para hoje', () => {
    // Mesmo horário do dia, mas o registro é de ontem — não pode contar hoje.
    const p = { data: ONTEM, hora_inicio: '08:00', hora_fim: '17:00' };
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 14 * 60)).toBe(false);
  });

  it('turno noturno de hoje cobre a noite de hoje', () => {
    const p = { data: HOJE, hora_inicio: '19:00', hora_fim: '07:00' };
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 23 * 60)).toBe(true);
  });

  it('turno noturno de hoje NÃO cobre a madrugada de hoje — ainda não começou', () => {
    // Regressão: o turno 19:00–07:00 gravado hoje só começa às 19h de hoje.
    // As 3h da madrugada de hoje são *antes* do início, não depois.
    const p = { data: HOJE, hora_inicio: '19:00', hora_fim: '07:00' };
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 3 * 60)).toBe(false);
  });

  it('turno noturno de ontem cobre a madrugada de hoje', () => {
    // O mesmo turno, só que gravado ontem: às 3h de hoje ele está em curso.
    const p = { data: ONTEM, hora_inicio: '19:00', hora_fim: '07:00' };
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 3 * 60)).toBe(true);
  });

  it('turno noturno de ontem já não cobre mais depois do fim', () => {
    const p = { data: ONTEM, hora_inicio: '19:00', hora_fim: '07:00' };
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 8 * 60)).toBe(false);
  });

  it('turno de outro dia qualquer não conta', () => {
    const p = { data: '2026-09-01', hora_inicio: '08:00', hora_fim: '17:00' };
    expect(plantaoEstaAtivo(p, HOJE, ONTEM, 14 * 60)).toBe(false);
  });
});

describe('localDeInstante', () => {
  it('converte um instante UTC para o dia e minuto em horário do Brasil (UTC-3)', () => {
    // 2026-01-01T03:00:00Z é 2026-01-01 00:00 em Brasília.
    expect(localDeInstante(new Date('2026-01-01T03:00:00Z'))).toEqual({
      dia: '2026-01-01',
      minuto: 0,
    });
  });

  it('não devolve "24:00" à meia-noite — vira o dia certo, minuto 0', () => {
    // Meia-noite em Brasília, escrita com o próprio offset -03:00: pega a
    // virada de ano, não só de dia, então também testa a virada de mês.
    expect(localDeInstante(new Date('2026-01-01T00:00:00-03:00'))).toEqual({
      dia: '2026-01-01',
      minuto: 0,
    });
  });

  it('minutos antes da meia-noite ficam no dia anterior', () => {
    expect(localDeInstante(new Date('2026-01-01T02:59:00Z'))).toEqual({
      dia: '2025-12-31',
      minuto: 23 * 60 + 59,
    });
  });
});
