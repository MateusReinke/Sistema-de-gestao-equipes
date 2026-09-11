/**
 * O contrato que importa é a ida e volta: o que a tela pinta precisa virar as
 * linhas certas de `escala_detalhes`, e essas linhas precisam voltar a ser
 * exatamente o mesmo desenho quando a escala for reaberta — inclusive depois
 * de a equipe ter trocado os nomes e as cores da legenda dela.
 */
import { describe, expect, it } from 'vitest';
import type { EscalaDetalhe, TipoTurno } from '@/types/sgo';
import {
  FOLGA,
  FOLGA_ID,
  TURNOS_PADRAO,
  detalhesDoTurno,
  gradeDeDetalhes,
  legendaDaEquipe,
  legendaInicialDaEquipe,
  turnoDeDetalhes,
} from './turnos';

const porRotulo = (rotulo: string) => {
  const t = TURNOS_PADRAO.find((x) => x.rotulo === rotulo);
  if (!t) throw new Error(`turno "${rotulo}" não existe no padrão`);
  return t;
};

describe('detalhesDoTurno', () => {
  it('folga não gera turno nenhum', () => {
    expect(detalhesDoTurno(FOLGA, 1, 0)).toEqual([]);
  });

  it('trabalho gera só o turno, no horário do turno', () => {
    expect(detalhesDoTurno(porRotulo('Trabalho'), 1, 3)).toEqual([
      {
        tipo_turno_id: null,
        semana_do_ciclo: 1,
        dia_semana: 3,
        hora_inicio: '08:00',
        hora_fim: '17:00',
        tipo: 'comercial',
      },
    ]);
  });

  it('plantão e backup geram só o acionamento, na janela de acionamento', () => {
    expect(detalhesDoTurno(porRotulo('Plantão'), 2, 5)[0]).toMatchObject({
      tipo: 'sobreaviso',
      hora_inicio: '00:00',
      hora_fim: '23:59',
    });
    expect(detalhesDoTurno(porRotulo('Backup de plantão'), 2, 5)[0]).toMatchObject({
      tipo: 'backup',
    });
  });

  it('dia que acumula papéis vira duas linhas — turno e acionamento', () => {
    const linhas = detalhesDoTurno(porRotulo('Trabalho + plantão'), 1, 1);
    expect(linhas).toHaveLength(2);
    expect(linhas.map((l) => l.tipo)).toEqual(['comercial', 'sobreaviso']);
    // Uma janela para o turno, outra para o acionamento.
    expect(linhas[0].hora_inicio).toBe('08:00');
    expect(linhas[1].hora_inicio).toBe('00:00');
  });

  it('um turno da equipe carrega o próprio id nas linhas gravadas', () => {
    const noturno: TipoTurno = {
      ...porRotulo('Trabalho'),
      id: 'tt_noturno',
      equipe_id: 'eq-noc',
      codigo: 'T.2',
      rotulo: 'Noturno',
      hora_inicio: '19:00',
      hora_fim: '07:00',
      tipo_plantao: 'noturno',
    };
    expect(detalhesDoTurno(noturno, 1, 2)).toEqual([
      {
        tipo_turno_id: 'tt_noturno',
        semana_do_ciclo: 1,
        dia_semana: 2,
        hora_inicio: '19:00',
        hora_fim: '07:00',
        tipo: 'noturno',
      },
    ]);
  });

  it('toda a legenda padrão faz ida e volta sem perder o turno', () => {
    for (const turno of [FOLGA, ...TURNOS_PADRAO]) {
      expect(turnoDeDetalhes(detalhesDoTurno(turno, 1, 2), TURNOS_PADRAO).id).toBe(turno.id);
    }
  });
});

describe('turnoDeDetalhes', () => {
  it('escala antiga, sem id de legenda, é lida pelo que o turno faz', () => {
    // Antes da legenda, um turno diurno/noturno/comercial era só "trabalha".
    expect(turnoDeDetalhes([{ tipo: 'diurno' }], TURNOS_PADRAO).rotulo).toBe('Trabalho');
    expect(turnoDeDetalhes([{ tipo: 'sobreaviso' }], TURNOS_PADRAO).rotulo).toBe('Plantão');
    expect(turnoDeDetalhes([{ tipo: 'backup' }], TURNOS_PADRAO).rotulo).toBe('Backup de plantão');
    expect(
      turnoDeDetalhes([{ tipo: 'comercial' }, { tipo: 'sobreaviso' }], TURNOS_PADRAO).rotulo,
    ).toBe('Trabalho + plantão');
  });

  it('dia sem turno nenhum é folga', () => {
    expect(turnoDeDetalhes([], TURNOS_PADRAO).id).toBe(FOLGA_ID);
  });

  it('o id da legenda vence a dedução pelo tipo', () => {
    const legenda: TipoTurno[] = [
      { ...porRotulo('Trabalho'), id: 'tt_noturno', codigo: 'T.2', rotulo: 'Noturno' },
    ];
    // O tipo diz "comercial", mas a linha aponta para o item "Noturno".
    const lido = turnoDeDetalhes([{ tipo: 'comercial', tipo_turno_id: 'tt_noturno' }], legenda);
    expect(lido.rotulo).toBe('Noturno');
  });

  it('id que não existe mais na legenda cai na dedução, sem quebrar', () => {
    const lido = turnoDeDetalhes([{ tipo: 'sobreaviso', tipo_turno_id: 'tt_apagado' }], TURNOS_PADRAO);
    expect(lido.rotulo).toBe('Plantão');
  });
});

describe('legendaDaEquipe', () => {
  it('sem legenda própria, a equipe usa a embutida', () => {
    expect(legendaDaEquipe([], 'eq1')).toEqual(TURNOS_PADRAO);
  });

  it('com legenda própria, a da equipe vence e vem na ordem definida', () => {
    const daEquipe: TipoTurno[] = [
      { ...porRotulo('Trabalho'), id: 'b', equipe_id: 'eq1', rotulo: 'Noturno', ordem: 2 },
      { ...porRotulo('Trabalho'), id: 'a', equipe_id: 'eq1', rotulo: 'Diurno', ordem: 1 },
    ];
    expect(legendaDaEquipe(daEquipe, 'eq1').map((t) => t.rotulo)).toEqual(['Diurno', 'Noturno']);
  });

  it('a legenda de uma equipe não vaza para outra', () => {
    const daEquipe: TipoTurno[] = [
      { ...porRotulo('Trabalho'), id: 'a', equipe_id: 'eq1', rotulo: 'Só do NOC' },
    ];
    expect(legendaDaEquipe(daEquipe, 'eq2')).toEqual(TURNOS_PADRAO);
  });

  it('item desativado some da legenda', () => {
    const daEquipe: TipoTurno[] = [
      { ...porRotulo('Trabalho'), id: 'a', equipe_id: 'eq1', ativo: false },
    ];
    // Sem nenhum item ativo, volta para a embutida em vez de ficar vazia.
    expect(legendaDaEquipe(daEquipe, 'eq1')).toEqual(TURNOS_PADRAO);
  });
});

describe('legendaInicialDaEquipe', () => {
  it('copia o padrão com ids novos, presos à equipe', () => {
    let n = 0;
    const copia = legendaInicialDaEquipe('eq1', () => `tt_${++n}`);
    expect(copia).toHaveLength(TURNOS_PADRAO.length);
    expect(copia.every((t) => t.equipe_id === 'eq1')).toBe(true);
    expect(copia.map((t) => t.rotulo)).toEqual(TURNOS_PADRAO.map((t) => t.rotulo));
    // Ids novos: editar a cópia não pode mexer no padrão embutido.
    expect(copia.some((t) => TURNOS_PADRAO.some((p) => p.id === t.id))).toBe(false);
  });
});

describe('gradeDeDetalhes — plantão de infra da planilha (ciclo de 3 semanas)', () => {
  /*
   * Semana 1 de backup, semana 2 de plantão, semana 3 livre — com o turno
   * comercial rodando por baixo de segunda a sexta nas três. É a linha do
   * Adriano na planilha, convertida para a legenda daqui.
   */
  const PADRAO = [
    ['Folga', 'Trabalho + backup', 'Trabalho + backup', 'Trabalho + backup', 'Trabalho + backup', 'Trabalho + backup', 'Backup de plantão'],
    ['Backup de plantão', 'Trabalho + plantão', 'Trabalho + plantão', 'Trabalho + plantão', 'Trabalho + plantão', 'Trabalho + plantão', 'Plantão'],
    ['Plantão', 'Trabalho', 'Trabalho', 'Trabalho', 'Trabalho', 'Trabalho', 'Folga'],
  ];

  const turnoDe = (rotulo: string) => (rotulo === 'Folga' ? FOLGA : porRotulo(rotulo));

  const detalhes: EscalaDetalhe[] = PADRAO.flatMap((linha, i) =>
    linha.flatMap((rotulo, dia) =>
      detalhesDoTurno(turnoDe(rotulo), i + 1, dia).map((d, n) => ({
        ...d,
        id: `ed-${i}-${dia}-${n}`,
        escala_id: 'esc-infra',
      })),
    ),
  );

  it('o desenho inteiro volta igual ao que foi pintado', () => {
    const grade = gradeDeDetalhes(detalhes, 3, TURNOS_PADRAO);
    expect(grade.map((linha) => linha.map((t) => t.rotulo))).toEqual(PADRAO);
  });

  it('gera o número de turnos que a semana realmente tem', () => {
    // 15 dias de trabalho (3 semanas × seg-sex) + 7 de plantão + 7 de backup.
    expect(detalhes.filter((d) => d.tipo === 'comercial')).toHaveLength(15);
    expect(detalhes.filter((d) => d.tipo === 'sobreaviso')).toHaveLength(7);
    expect(detalhes.filter((d) => d.tipo === 'backup')).toHaveLength(7);
  });

  it('semana além do ciclo não aparece na grade', () => {
    expect(gradeDeDetalhes(detalhes, 2, TURNOS_PADRAO)).toHaveLength(2);
    // E uma escala maior que o desenhado ganha semanas de folga, não erro.
    const maior = gradeDeDetalhes(detalhes, 4, TURNOS_PADRAO);
    expect(maior[3].every((t) => t.id === FOLGA_ID)).toBe(true);
  });
});
