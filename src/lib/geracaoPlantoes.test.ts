/**
 * `plantoesGerados` é o motor que substitui lançar plantão um por um. Os
 * testes cobrem as duas regras reais que motivaram o recurso — NOC (12×36,
 * duas pessoas revezando) e INFRA (plantão + backup revezando entre três) —
 * além do caso simples de ciclo de uma semana só.
 */
import { describe, expect, it } from 'vitest';
import type { EscalaDetalhe, EscalaFuncionario } from '@/types/sgo';
import { plantoesGerados } from './geracaoPlantoes';

describe('plantoesGerados', () => {
  it('ciclo de 1 semana: só nos dias configurados, no tipo configurado', () => {
    // 2026-01-05 é segunda-feira.
    const detalhes: EscalaDetalhe[] = [1, 2, 3, 4, 5].map((diaSemana) => ({
      id: `d${diaSemana}`,
      escala_id: 'esc-comercial',
      semana_do_ciclo: 1,
      dia_semana: diaSemana,
      hora_inicio: '09:00',
      hora_fim: '18:00',
      tipo: 'comercial',
    }));
    const vinculo: EscalaFuncionario = {
      id: 'v1',
      funcionario_id: 'f1',
      escala_id: 'esc-comercial',
      ancora_em: '2026-01-05',
      data_inicio: '2026-01-05',
      data_fim: '2026-01-18',
    };

    const gerados = plantoesGerados(vinculo, detalhes, 1, '2026-01-05', '2026-01-18');

    expect(gerados.map((p) => p.data)).toEqual([
      '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09',
      '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15', '2026-01-16',
    ]);
    expect(gerados.every((p) => p.tipo === 'comercial' && p.hora_inicio === '09:00')).toBe(true);
  });

  it('recorta pela vigência do vínculo, não só pelo período pedido', () => {
    const detalhes: EscalaDetalhe[] = [
      { id: 'd1', escala_id: 'e', semana_do_ciclo: 1, dia_semana: 1, hora_inicio: '09:00', hora_fim: '18:00', tipo: 'comercial' },
    ];
    const vinculo: EscalaFuncionario = {
      id: 'v1', funcionario_id: 'f1', escala_id: 'e',
      ancora_em: '2026-01-05', data_inicio: '2026-01-12', data_fim: '2026-01-12',
    };

    // Pede um mês inteiro, mas o vínculo só vale um dia.
    const gerados = plantoesGerados(vinculo, detalhes, 1, '2026-01-01', '2026-01-31');
    expect(gerados.map((p) => p.data)).toEqual(['2026-01-12']);
  });

  it('vínculo fora do período pedido não gera nada', () => {
    const detalhes: EscalaDetalhe[] = [
      { id: 'd1', escala_id: 'e', semana_do_ciclo: 1, dia_semana: 1, hora_inicio: '09:00', hora_fim: '18:00', tipo: 'comercial' },
    ];
    const vinculo: EscalaFuncionario = {
      id: 'v1', funcionario_id: 'f1', escala_id: 'e',
      ancora_em: '2025-01-01', data_inicio: '2025-01-01', data_fim: '2025-06-30',
    };
    expect(plantoesGerados(vinculo, detalhes, 1, '2026-01-01', '2026-01-31')).toEqual([]);
  });

  describe('NOC — 12×36 com duas pessoas revezando (ciclo de 2 semanas)', () => {
    // 2026-01-05 é segunda; a janela cobre exatamente 2 semanas (um ciclo
    // inteiro). `dia_semana` é o dia real da semana, não um dia relativo à
    // âncora — por isso as duas metades do par usam escalas diferentes (a
    // mesma dupla horário/tipo, dias complementares), em vez de tentar
    // derivar a escala da B só deslocando a âncora da A em 1 dia: um
    // deslocamento que não é múltiplo de semana inteira não produz o
    // complemento certo, porque só a semana do ciclo se desloca com a
    // âncora — o dia da semana, não. As duas usam a mesma âncora; o que
    // alterna é em qual semana do ciclo cada dia real cai.
    const ANCORA = '2026-01-05';
    const DE = '2026-01-05';
    const ATE = '2026-01-18';

    const detalhesDe = (escalaId: string, porSemana: Record<1 | 2, number[]>): EscalaDetalhe[] =>
      ([1, 2] as const).flatMap((semana) =>
        porSemana[semana].map((diaSemana, i) => ({
          id: `${escalaId}-${semana}-${i}`,
          escala_id: escalaId,
          semana_do_ciclo: semana,
          dia_semana: diaSemana,
          hora_inicio: '07:00',
          hora_fim: '19:00',
          tipo: 'diurno' as const,
        })),
      );

    // Dom/Seg/Qua/Sex na semana 1, Ter/Qui/Sáb na semana 2 — para B, o
    // inverso. Juntas cobrem a semana toda, sem se sobrepor nunca.
    const detalhesA = detalhesDe('esc-diurno-a', { 1: [0, 1, 3, 5], 2: [2, 4, 6] });
    const detalhesB = detalhesDe('esc-diurno-b', { 1: [2, 4, 6], 2: [0, 1, 3, 5] });

    const pessoaA: EscalaFuncionario = {
      id: 'vA', funcionario_id: 'fA', escala_id: 'esc-diurno-a',
      ancora_em: ANCORA, data_inicio: DE, data_fim: ATE,
    };
    const pessoaB: EscalaFuncionario = {
      id: 'vB', funcionario_id: 'fB', escala_id: 'esc-diurno-b',
      ancora_em: ANCORA, data_inicio: DE, data_fim: ATE,
    };

    it('pessoa A trabalha em dias alternados', () => {
      const datas = plantoesGerados(pessoaA, detalhesA, 2, DE, ATE).map((p) => p.data);
      expect(datas).toEqual([
        '2026-01-05', '2026-01-07', '2026-01-09', '2026-01-11',
        '2026-01-13', '2026-01-15', '2026-01-17',
      ]);
    });

    it('pessoa B cobre exatamente os dias que A folga', () => {
      const datasA = plantoesGerados(pessoaA, detalhesA, 2, DE, ATE).map((p) => p.data);
      const datasB = plantoesGerados(pessoaB, detalhesB, 2, DE, ATE).map((p) => p.data);

      expect(datasB).toEqual([
        '2026-01-06', '2026-01-08', '2026-01-10', '2026-01-12',
        '2026-01-14', '2026-01-16', '2026-01-18',
      ]);

      // As 14 datas da janela, sem sobra nem lacuna, cobertas por A ou B —
      // nunca pelos dois no mesmo dia.
      const todasAsDatas = Array.from({ length: 14 }, (_, i) =>
        String(new Date(Date.UTC(2026, 0, 5 + i)).toISOString().slice(0, 10)),
      );
      expect([...datasA, ...datasB].sort()).toEqual(todasAsDatas);
    });
  });

  describe('INFRA — plantão e backup revezando entre 3 pessoas (ciclo de 3 semanas)', () => {
    // "Ligado" na semana 1 do ciclo, todos os 7 dias — a âncora de cada
    // pessoa é que decide qual semana civil vira a "semana 1" dela.
    const plantaoTemplate: EscalaDetalhe[] = [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
      id: `p${diaSemana}`,
      escala_id: 'esc-plantao-infra',
      semana_do_ciclo: 1,
      dia_semana: diaSemana,
      hora_inicio: '18:00',
      hora_fim: '09:00',
      tipo: 'sobreaviso',
    }));

    // Três pessoas, âncoras espaçadas em 1 semana: cada uma "liga" numa
    // semana diferente do rodízio de 3 semanas.
    const vinculoDe = (id: string, funcionarioId: string, ancora: string): EscalaFuncionario => ({
      id, funcionario_id: funcionarioId, escala_id: 'esc-plantao-infra',
      ancora_em: ancora, data_inicio: '2026-01-05', data_fim: '2026-02-01',
    });

    it('em cada semana, só uma das três pessoas está de plantão', () => {
      // Âncora simples: cada pessoa ancorada no primeiro dia da própria
      // semana "ligada" — dista da de A um múltiplo exato de 7 dias, o que
      // é o que faz as três se revezarem em vez de coincidirem.
      const pessoaA = vinculoDe('vA', 'fA', '2026-01-05'); // semana 1 dela: 05–11/jan
      const pessoaB = vinculoDe('vB', 'fB', '2026-01-12'); // semana 1 dela: 12–18/jan
      const pessoaC = vinculoDe('vC', 'fC', '2026-01-19'); // semana 1 dela: 19–25/jan

      const de = '2026-01-05';
      const ate = '2026-01-25';
      const datasA = plantoesGerados(pessoaA, plantaoTemplate, 3, de, ate).map((p) => p.data);
      const datasB = plantoesGerados(pessoaB, plantaoTemplate, 3, de, ate).map((p) => p.data);
      const datasC = plantoesGerados(pessoaC, plantaoTemplate, 3, de, ate).map((p) => p.data);

      expect(datasA).toEqual([
        '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
        '2026-01-09', '2026-01-10', '2026-01-11',
      ]);
      expect(datasB).toEqual([
        '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15',
        '2026-01-16', '2026-01-17', '2026-01-18',
      ]);
      expect(datasC).toEqual([
        '2026-01-19', '2026-01-20', '2026-01-21', '2026-01-22',
        '2026-01-23', '2026-01-24', '2026-01-25',
      ]);
    });

    it('"trabalho + plantão": a pessoa de plantão na semana também aparece na escala comercial — motor não precisa de código híbrido', () => {
      const comercialTemplate: EscalaDetalhe[] = [1, 2, 3, 4, 5].map((diaSemana) => ({
        id: `c${diaSemana}`, escala_id: 'esc-comercial-infra', semana_do_ciclo: 1,
        dia_semana: diaSemana, hora_inicio: '09:00', hora_fim: '18:00', tipo: 'comercial',
      }));
      const vinculoComercial: EscalaFuncionario = {
        id: 'vA-com', funcionario_id: 'fA', escala_id: 'esc-comercial-infra',
        ancora_em: '2026-01-05', data_inicio: '2026-01-05', data_fim: '2026-02-01',
      };
      const vinculoPlantao = vinculoDe('vA-plantao', 'fA', '2026-01-05');

      const dia = '2026-01-06'; // terça, dentro da semana de plantão de A
      const doComercial = plantoesGerados(vinculoComercial, comercialTemplate, 1, dia, dia);
      const doPlantao = plantoesGerados(vinculoPlantao, plantaoTemplate, 3, dia, dia);

      // Duas linhas para a mesma pessoa, no mesmo dia — uma comercial, uma
      // sobreaviso — em vez de um único código "trabalho + plantão".
      const combinado = [...doComercial, ...doPlantao];
      expect(combinado).toHaveLength(2);
      expect(combinado.map((p) => p.tipo).sort()).toEqual(['comercial', 'sobreaviso']);
      expect(combinado.every((p) => p.funcionario_id === 'fA' && p.data === dia)).toBe(true);
    });

    it('backup revezado, deslocado para nunca coincidir com a própria semana de plantão principal', () => {
      // A faz backup na semana em que B está de plantão principal — a
      // âncora do "backup de A" é a mesma âncora que B usa como principal.
      const backupTemplate = plantaoTemplate.map((d) => ({
        ...d,
        escala_id: 'esc-backup-infra',
      }));
      const vinculoBackupA: EscalaFuncionario = {
        id: 'vA-backup', funcionario_id: 'fA', escala_id: 'esc-backup-infra',
        ancora_em: '2026-01-12', data_inicio: '2026-01-05', data_fim: '2026-02-01',
      };

      const duranteAPropriaSemana = plantoesGerados(
        vinculoBackupA, backupTemplate, 3, '2026-01-05', '2026-01-11',
      );
      const duranteASemanaDeB = plantoesGerados(
        vinculoBackupA, backupTemplate, 3, '2026-01-12', '2026-01-18',
      );

      expect(duranteAPropriaSemana).toHaveLength(0); // A não é o próprio backup.
      expect(duranteASemanaDeB).toHaveLength(7); // A cobre o backup na semana de B.
    });
  });
});
