/**
 * Os dois compositores só têm valor se o que produzem, jogado dentro de
 * `plantoesGerados`, fechar exatamente como esperado — por isso os testes
 * aqui não checam a forma dos objetos, e sim as datas que saem na outra
 * ponta, do mesmo jeito que `geracaoPlantoes.test.ts` valida o motor.
 */
import { describe, expect, it } from 'vitest';
import type { EscalaDetalhe, EscalaFuncionario } from '@/types/sgo';
import { plantoesGerados } from './geracaoPlantoes';
import {
  ancoraDaPosicao,
  gerarRevezamentoDiario,
  gerarRodizioComBackup,
  posicaoDaAncora,
} from './composicaoEscalas';

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

describe('gerarRevezamentoDiario — o par inteiro numa escala só', () => {
  const DIA_BASE = '2026-01-05'; // segunda
  const DE = '2026-01-04'; // domingo que abre a semana
  const ATE = '2026-01-17';

  const revezamento = gerarRevezamentoDiario({
    diaBase: DIA_BASE,
    horaInicio: '07:00',
    horaFim: '19:00',
    tipo: 'diurno',
  });
  const detalhes = comIds('esc', revezamento.detalhes);

  /** Duas pessoas na MESMA escala, em posições diferentes do rodízio. */
  const naPosicao = (id: string, posicao: number) =>
    vinculo(id, 'esc', {
      funcionario_id: id,
      ancora_em: ancoraDaPosicao(DIA_BASE, posicao),
      data_inicio: DE,
      data_fim: ATE,
    });

  it('a posição 1 trabalha em dias alternados', () => {
    const datas = plantoesGerados(naPosicao('A', 0), detalhes, revezamento.ciclo_semanas, DE, ATE);
    expect(datas.map((p) => p.data)).toEqual([
      '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-11',
      '2026-01-13', '2026-01-15', '2026-01-17',
    ]);
  });

  it('a posição 2 cobre exatamente os dias que a posição 1 folga', () => {
    const ciclo = revezamento.ciclo_semanas;
    const a = plantoesGerados(naPosicao('A', 0), detalhes, ciclo, DE, ATE).map((p) => p.data);
    const b = plantoesGerados(naPosicao('B', 1), detalhes, ciclo, DE, ATE).map((p) => p.data);

    expect(b).toEqual([
      '2026-01-04', '2026-01-06', '2026-01-08', '2026-01-10',
      '2026-01-12', '2026-01-14', '2026-01-16',
    ]);
    // Os 14 dias da janela, sem sobra nem lacuna, e nunca os dois no mesmo dia.
    expect([...a, ...b].sort()).toHaveLength(14);
    expect(a.filter((d) => b.includes(d))).toEqual([]);
  });

  it('funciona para qualquer dia da semana como base', () => {
    const base = '2026-01-10'; // sábado
    const de = '2026-01-04';
    const ate = '2026-01-17';
    const outro = gerarRevezamentoDiario({
      diaBase: base,
      horaInicio: '19:00',
      horaFim: '07:00',
      tipo: 'noturno',
    });
    const d = comIds('esc2', outro.detalhes);
    const pos = (id: string, p: number) =>
      vinculo(id, 'esc2', {
        funcionario_id: id,
        ancora_em: ancoraDaPosicao(base, p),
        data_inicio: de,
        data_fim: ate,
      });

    const a = plantoesGerados(pos('C', 0), d, outro.ciclo_semanas, de, ate).map((x) => x.data);
    const b = plantoesGerados(pos('D', 1), d, outro.ciclo_semanas, de, ate).map((x) => x.data);
    expect(a.filter((x) => b.includes(x))).toEqual([]);
    expect([...a, ...b]).toHaveLength(14);
  });

  it('o dia da semana da data-base não muda o resultado, só a semana', () => {
    // Segunda e quinta da mesma semana têm de produzir a mesma escala.
    const deSegunda = gerarRevezamentoDiario({ diaBase: '2026-01-05', horaInicio: '07:00', horaFim: '19:00', tipo: 'diurno' });
    const deQuinta = gerarRevezamentoDiario({ diaBase: '2026-01-08', horaInicio: '07:00', horaFim: '19:00', tipo: 'diurno' });
    const datas = (r: typeof deSegunda, base: string) =>
      plantoesGerados(
        vinculo('X', 'e', { funcionario_id: 'X', ancora_em: ancoraDaPosicao(base, 0), data_inicio: DE, data_fim: ATE }),
        comIds('e', r.detalhes),
        r.ciclo_semanas,
        DE,
        ATE,
      ).map((p) => p.data);

    // Bases de paridade oposta geram os complementos — juntas, a semana toda.
    const s = datas(deSegunda, '2026-01-05');
    const q = datas(deQuinta, '2026-01-08');
    expect(s.filter((d) => q.includes(d))).toEqual([]);
    expect([...s, ...q]).toHaveLength(14);
  });
});

describe('posicaoDaAncora', () => {
  it('devolve a posição que a âncora representa', () => {
    const inicio = '2026-01-04';
    expect(posicaoDaAncora(inicio, ancoraDaPosicao(inicio, 0), 3)).toBe(0);
    expect(posicaoDaAncora(inicio, ancoraDaPosicao(inicio, 1), 3)).toBe(1);
    expect(posicaoDaAncora(inicio, ancoraDaPosicao(inicio, 2), 3)).toBe(2);
    // Dá a volta: a posição 3 de um ciclo de 3 é a mesma que a posição 0.
    expect(posicaoDaAncora(inicio, ancoraDaPosicao(inicio, 3), 3)).toBe(0);
  });

  it('não depende do dia da semana da âncora, só da semana', () => {
    const inicio = '2026-01-04'; // domingo
    // Qualquer dia da mesma semana tem de dar a mesma posição.
    for (const d of ['2026-01-04', '2026-01-06', '2026-01-10']) {
      expect(posicaoDaAncora(inicio, d, 2)).toBe(0);
    }
    for (const d of ['2026-01-11', '2026-01-14', '2026-01-17']) {
      expect(posicaoDaAncora(inicio, d, 2)).toBe(1);
    }
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
  // Semanas de calendário (domingo a sábado) — é assim que o motor conta.
  const semanas = [
    { de: '2026-01-04', ate: '2026-01-10' }, // semana de G1
    { de: '2026-01-11', ate: '2026-01-17' }, // semana de G2
    { de: '2026-01-18', ate: '2026-01-24' }, // semana de G3
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
      dataInicio: '2026-01-04',
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
    const datasX1 = plantoesGerados(vX1, dPrincipal, quinzenal.ciclo_semanas, '2026-01-04', '2026-01-17');
    expect(datasX1).toHaveLength(14);
    // X2 nada produz nesse mesmo intervalo — é a quinzena seguinte.
    expect(plantoesGerados(vX2, dPrincipal, quinzenal.ciclo_semanas, '2026-01-04', '2026-01-17')).toHaveLength(0);
    const datasX2 = plantoesGerados(vX2, dPrincipal, quinzenal.ciclo_semanas, '2026-01-18', '2026-01-31');
    expect(datasX2).toHaveLength(14);
  });
});
