/**
 * Os dois compositores só têm valor se o que produzem, jogado dentro de
 * `plantoesGerados`, fechar exatamente como esperado — por isso os testes
 * aqui não checam a forma dos objetos, e sim as datas que saem na outra
 * ponta, do mesmo jeito que `geracaoPlantoes.test.ts` valida o motor.
 */
import { describe, expect, it } from 'vitest';
import type { EscalaDetalhe, EscalaFuncionario } from '@/types/sgo';
import { plantoesGerados } from './geracaoPlantoes';
import { gerarRevezamentoDiario, gerarRodizioComBackup } from './composicaoEscalas';

function comIds(escalaId: string, detalhes: Omit<EscalaDetalhe, 'id' | 'escala_id'>[]): EscalaDetalhe[] {
  return detalhes.map((d, i) => ({ ...d, id: `${escalaId}-${i}`, escala_id: escalaId }));
}

function vinculo(
  id: string,
  escalaId: string,
  v: Omit<EscalaFuncionario, 'id' | 'escala_id'>,
): EscalaFuncionario {
  return { ...v, id, escala_id: escalaId };
}

describe('gerarRevezamentoDiario', () => {
  // Mesmo cenário do par 12×36 da NOC em geracaoPlantoes.test.ts — a prova de
  // que este compositor produz o mesmo par que antes só existia escrito à mão.
  const DIA_BASE = '2026-01-05'; // segunda
  const DE = '2026-01-05';
  const ATE = '2026-01-18';

  const par = gerarRevezamentoDiario({
    diaBase: DIA_BASE,
    horaInicio: '07:00',
    horaFim: '19:00',
    tipo: 'diurno',
  });

  const detalhesA = comIds('esc-a', par.detalhesPosicao1);
  const detalhesB = comIds('esc-b', par.detalhesPosicao2);

  const pessoaA = vinculo('vA', 'esc-a', {
    funcionario_id: 'fA',
    ancora_em: DIA_BASE,
    data_inicio: DE,
    data_fim: ATE,
  });
  const pessoaB = vinculo('vB', 'esc-b', {
    funcionario_id: 'fB',
    ancora_em: DIA_BASE,
    data_inicio: DE,
    data_fim: ATE,
  });

  it('posição 1 trabalha em diaBase e nos dias alternados dele', () => {
    const datas = plantoesGerados(pessoaA, detalhesA, par.ciclo_semanas, DE, ATE).map((p) => p.data);
    expect(datas).toEqual([
      '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-11',
      '2026-01-13', '2026-01-15', '2026-01-17',
    ]);
  });

  it('posição 2 cobre exatamente os dias que a posição 1 folga, sem sobra nem lacuna', () => {
    const datasA = plantoesGerados(pessoaA, detalhesA, par.ciclo_semanas, DE, ATE).map((p) => p.data);
    const datasB = plantoesGerados(pessoaB, detalhesB, par.ciclo_semanas, DE, ATE).map((p) => p.data);

    expect(datasB).toEqual([
      '2026-01-06', '2026-01-08', '2026-01-10', '2026-01-12',
      '2026-01-14', '2026-01-16', '2026-01-18',
    ]);

    const todasAsDatas = Array.from({ length: 14 }, (_, i) =>
      String(new Date(Date.UTC(2026, 0, 5 + i)).toISOString().slice(0, 10)),
    );
    expect([...datasA, ...datasB].sort()).toEqual(todasAsDatas);
    // Nunca os dois no mesmo dia.
    expect(datasA.filter((d) => datasB.includes(d))).toEqual([]);
  });

  it('funciona para qualquer dia da semana como base, não só segunda', () => {
    // Base num sábado — garante que a paridade não depende de diaBase cair
    // sempre numa semana "redonda".
    const base = '2026-01-10'; // sábado
    const de = '2026-01-10';
    const ate = '2026-01-23';
    const outroPar = gerarRevezamentoDiario({
      diaBase: base,
      horaInicio: '19:00',
      horaFim: '07:00',
      tipo: 'noturno',
    });
    const dA = comIds('esc-c', outroPar.detalhesPosicao1);
    const dB = comIds('esc-d', outroPar.detalhesPosicao2);
    const vA = vinculo('vC', 'esc-c', { funcionario_id: 'fC', ancora_em: base, data_inicio: de, data_fim: ate });
    const vB = vinculo('vD', 'esc-d', { funcionario_id: 'fD', ancora_em: base, data_inicio: de, data_fim: ate });

    const datasA = plantoesGerados(vA, dA, outroPar.ciclo_semanas, de, ate).map((p) => p.data);
    const datasB = plantoesGerados(vB, dB, outroPar.ciclo_semanas, de, ate).map((p) => p.data);

    expect(datasA).toEqual([
      '2026-01-10', '2026-01-12', '2026-01-14', '2026-01-16',
      '2026-01-18', '2026-01-20', '2026-01-22',
    ]);
    expect(datasB).toEqual([
      '2026-01-11', '2026-01-13', '2026-01-15', '2026-01-17',
      '2026-01-19', '2026-01-21', '2026-01-23',
    ]);
  });
});

describe('gerarRodizioComBackup', () => {
  const DATA_INICIO = '2026-01-05'; // segunda: G1 assume
  const DATA_FIM = '2026-06-01';

  const rodizio = gerarRodizioComBackup({
    participantes: ['G1', 'G2', 'G3'],
    dataInicio: DATA_INICIO,
    dataFim: DATA_FIM,
    horaInicio: '18:00',
    horaFim: '09:00',
    tipo: 'sobreaviso',
  });

  const detalhesPrincipal = comIds('esc-principal', rodizio.detalhes);
  const detalhesBackup = comIds('esc-backup', rodizio.detalhes);

  const vinculosPrincipal = rodizio.vinculosPrincipal.map((v, i) =>
    vinculo(`vp-${i}`, 'esc-principal', v),
  );
  const vinculosBackup = rodizio.vinculosBackup.map((v, i) => vinculo(`vb-${i}`, 'esc-backup', v));

  // Uma semana de cada vez, cobrindo o ciclo de 3 semanas inteiro.
  const semanas = [
    { de: '2026-01-05', ate: '2026-01-11' }, // semana de G1
    { de: '2026-01-12', ate: '2026-01-18' }, // semana de G2
    { de: '2026-01-19', ate: '2026-01-25' }, // semana de G3
  ];

  const quemEstaAtivoNaSemana = (vinculos: EscalaFuncionario[], de: string, ate: string) =>
    vinculos
      .filter((v) => plantoesGerados(v, detalhesPrincipal, rodizio.ciclo_semanas, de, ate).length > 0)
      .map((v) => v.funcionario_id);

  it('só uma pessoa por semana no plantão principal, na ordem da lista', () => {
    expect(quemEstaAtivoNaSemana(vinculosPrincipal, semanas[0].de, semanas[0].ate)).toEqual(['G1']);
    expect(quemEstaAtivoNaSemana(vinculosPrincipal, semanas[1].de, semanas[1].ate)).toEqual(['G2']);
    expect(quemEstaAtivoNaSemana(vinculosPrincipal, semanas[2].de, semanas[2].ate)).toEqual(['G3']);
  });

  it('o backup de cada semana é sempre a PRÓXIMA pessoa da lista, com giro no fim', () => {
    const quemEBackup = (de: string, ate: string) =>
      vinculosBackup
        .filter((v) => plantoesGerados(v, detalhesBackup, rodizio.ciclo_semanas, de, ate).length > 0)
        .map((v) => v.funcionario_id);

    expect(quemEBackup(semanas[0].de, semanas[0].ate)).toEqual(['G2']); // semana de G1 → backup G2
    expect(quemEBackup(semanas[1].de, semanas[1].ate)).toEqual(['G3']); // semana de G2 → backup G3
    expect(quemEBackup(semanas[2].de, semanas[2].ate)).toEqual(['G1']); // semana de G3 → backup G1 (giro)
  });

  it('backup nunca coincide com quem já está de plantão principal na mesma semana', () => {
    for (const semana of semanas) {
      const principal = quemEstaAtivoNaSemana(vinculosPrincipal, semana.de, semana.ate);
      const backup = vinculosBackup
        .filter((v) => plantoesGerados(v, detalhesBackup, rodizio.ciclo_semanas, semana.de, semana.ate).length > 0)
        .map((v) => v.funcionario_id);
      expect(principal.some((p) => backup.includes(p))).toBe(false);
    }
  });

  it('respeita semanasPorTurno > 1 (ex.: rodízio quinzenal)', () => {
    const quinzenal = gerarRodizioComBackup({
      participantes: ['X1', 'X2'],
      dataInicio: '2026-01-05',
      dataFim: '2026-12-31',
      horaInicio: '00:00',
      horaFim: '23:59',
      tipo: 'sobreaviso',
      semanasPorTurno: 2,
    });
    expect(quinzenal.ciclo_semanas).toBe(4);

    const dPrincipal = comIds('esc-quinzenal', quinzenal.detalhes);
    const vX1 = vinculo('vx1', 'esc-quinzenal', quinzenal.vinculosPrincipal[0]);
    const vX2 = vinculo('vx2', 'esc-quinzenal', quinzenal.vinculosPrincipal[1]);

    // X1 cobre as duas primeiras semanas inteiras, sem furo.
    const datasX1 = plantoesGerados(vX1, dPrincipal, quinzenal.ciclo_semanas, '2026-01-05', '2026-01-18');
    expect(datasX1).toHaveLength(14);
    // X2 nada produz nesse mesmo intervalo — é a quinzena seguinte.
    expect(plantoesGerados(vX2, dPrincipal, quinzenal.ciclo_semanas, '2026-01-05', '2026-01-18')).toHaveLength(0);
    const datasX2 = plantoesGerados(vX2, dPrincipal, quinzenal.ciclo_semanas, '2026-01-19', '2026-02-01');
    expect(datasX2).toHaveLength(14);
  });
});
