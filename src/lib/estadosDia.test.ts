/**
 * O contrato que importa aqui é a ida e volta: o que a tela pinta precisa
 * virar as linhas certas de `escala_detalhes`, e essas linhas precisam voltar
 * a ser exatamente o mesmo desenho quando a escala for reaberta.
 *
 * O caso grande usa o padrão real do plantão de infra da planilha (ciclo de 3
 * semanas: uma de backup, uma de plantão, uma livre) — se ele fecha, o modelo
 * cobre o que a operação já faz hoje no Excel.
 */
import { describe, expect, it } from 'vitest';
import type { EscalaDetalhe } from '@/types/sgo';
import {
  ESTADO_DIA,
  ESTADOS_DIA,
  detalhesDoEstado,
  estadoDeDetalhes,
  gradeDeDetalhes,
  horariosDeDetalhes,
  type EstadoDia,
  type HorariosEscala,
} from './estadosDia';

const HORARIOS: HorariosEscala = {
  turno_tipo: 'comercial',
  turno_inicio: '09:00',
  turno_fim: '18:00',
  sobreaviso_inicio: '00:00',
  sobreaviso_fim: '23:59',
};

describe('detalhesDoEstado', () => {
  it('folga não gera turno nenhum', () => {
    expect(detalhesDoEstado('folga', 1, 0, HORARIOS)).toEqual([]);
  });

  it('trabalho gera só o turno, no horário do turno', () => {
    const linhas = detalhesDoEstado('trabalho', 1, 3, HORARIOS);
    expect(linhas).toEqual([
      {
        semana_do_ciclo: 1,
        dia_semana: 3,
        hora_inicio: '09:00',
        hora_fim: '18:00',
        tipo: 'comercial',
      },
    ]);
  });

  it('plantão e backup geram só o acionamento, na janela de sobreaviso', () => {
    expect(detalhesDoEstado('plantao', 2, 5, HORARIOS)).toEqual([
      { semana_do_ciclo: 2, dia_semana: 5, hora_inicio: '00:00', hora_fim: '23:59', tipo: 'sobreaviso' },
    ]);
    expect(detalhesDoEstado('backup', 2, 5, HORARIOS)).toEqual([
      { semana_do_ciclo: 2, dia_semana: 5, hora_inicio: '00:00', hora_fim: '23:59', tipo: 'backup' },
    ]);
  });

  it('dia que acumula papéis vira duas linhas — turno e acionamento', () => {
    const linhas = detalhesDoEstado('trabalho_plantao', 1, 1, HORARIOS);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => l.tipo)).toEqual(['comercial', 'sobreaviso']);
    expect(linhas[0].hora_inicio).toBe('09:00');
    expect(linhas[1].hora_inicio).toBe('00:00');

    const comBackup = detalhesDoEstado('trabalho_backup', 1, 1, HORARIOS);
    expect(comBackup.map((l) => l.tipo)).toEqual(['comercial', 'backup']);
  });

  it('toda a paleta faz ida e volta sem perder o estado', () => {
    for (const estado of ESTADOS_DIA) {
      expect(estadoDeDetalhes(detalhesDoEstado(estado, 1, 2, HORARIOS))).toBe(estado);
    }
  });
});

describe('estadoDeDetalhes', () => {
  it('escala antiga, sem código de dia, é lida como trabalho', () => {
    // Antes dos códigos, um turno diurno/noturno/comercial era só "trabalha".
    expect(estadoDeDetalhes([{ tipo: 'diurno' }])).toBe('trabalho');
    expect(estadoDeDetalhes([{ tipo: 'noturno' }])).toBe('trabalho');
    expect(estadoDeDetalhes([{ tipo: 'especial' }])).toBe('trabalho');
  });

  it('dia sem turno nenhum é folga', () => {
    expect(estadoDeDetalhes([])).toBe('folga');
  });

  it('quem acumula plantão e backup no mesmo dia conta como plantão', () => {
    // Primeira linha vence: quem atende primeiro não é "backup de si mesmo".
    expect(estadoDeDetalhes([{ tipo: 'backup' }, { tipo: 'sobreaviso' }])).toBe('plantao');
    expect(estadoDeDetalhes([{ tipo: 'sobreaviso' }, { tipo: 'backup' }])).toBe('plantao');
  });
});

describe('gradeDeDetalhes — plantão de infra da planilha (ciclo de 3 semanas)', () => {
  /*
   * Semana 1 de backup, semana 2 de plantão, semana 3 livre — com o turno
   * comercial rodando por baixo de segunda a sexta nas três. É a linha do
   * Adriano na planilha, convertida para os estados daqui.
   */
  const PADRAO: EstadoDia[][] = [
    ['folga', 'trabalho_backup', 'trabalho_backup', 'trabalho_backup', 'trabalho_backup', 'trabalho_backup', 'backup'],
    ['backup', 'trabalho_plantao', 'trabalho_plantao', 'trabalho_plantao', 'trabalho_plantao', 'trabalho_plantao', 'plantao'],
    ['plantao', 'trabalho', 'trabalho', 'trabalho', 'trabalho', 'trabalho', 'folga'],
  ];

  const detalhes: EscalaDetalhe[] = PADRAO.flatMap((linha, i) =>
    linha.flatMap((estado, dia) =>
      detalhesDoEstado(estado, i + 1, dia, HORARIOS).map((d, n) => ({
        ...d,
        id: `ed-${i}-${dia}-${n}`,
        escala_id: 'esc-infra',
      })),
    ),
  );

  it('o desenho inteiro volta igual ao que foi pintado', () => {
    expect(gradeDeDetalhes(detalhes, 3)).toEqual(PADRAO);
  });

  it('gera o número de turnos que a semana realmente tem', () => {
    // 15 dias de trabalho (3 semanas × seg-sex) + 12 dias de acionamento
    // (backup e plantão, cada um 5 dias úteis + sábado + domingo).
    const trabalho = detalhes.filter((d) => d.tipo === 'comercial');
    const plantao = detalhes.filter((d) => d.tipo === 'sobreaviso');
    const backup = detalhes.filter((d) => d.tipo === 'backup');
    expect(trabalho).toHaveLength(15);
    expect(plantao).toHaveLength(7);
    expect(backup).toHaveLength(7);
  });

  it('nunca deixa a pessoa de plantão e de backup no mesmo dia', () => {
    for (const linha of PADRAO) {
      for (const estado of linha) {
        expect(['nenhum', 'plantao', 'backup']).toContain(ESTADO_DIA[estado].acionamento);
      }
    }
  });

  it('semana além do ciclo não aparece na grade', () => {
    expect(gradeDeDetalhes(detalhes, 2)).toHaveLength(2);
    // E uma escala maior que o desenhado ganha semanas de folga, não erro.
    const maior = gradeDeDetalhes(detalhes, 4);
    expect(maior).toHaveLength(4);
    expect(maior[3]).toEqual(Array.from({ length: 7 }, () => 'folga'));
  });
});

describe('horariosDeDetalhes', () => {
  it('lê os horários de uma escala antiga a partir dos próprios turnos', () => {
    const detalhes = [
      { hora_inicio: '07:00', hora_fim: '19:00', tipo: 'diurno' as const },
      { hora_inicio: '19:00', hora_fim: '07:00', tipo: 'sobreaviso' as const },
    ];
    expect(horariosDeDetalhes(detalhes, HORARIOS)).toEqual({
      turno_tipo: 'diurno',
      turno_inicio: '07:00',
      turno_fim: '19:00',
      sobreaviso_inicio: '19:00',
      sobreaviso_fim: '07:00',
    });
  });

  it('sem turnos gravados, fica com o padrão da escala', () => {
    expect(horariosDeDetalhes([], HORARIOS)).toEqual(HORARIOS);
  });
});
