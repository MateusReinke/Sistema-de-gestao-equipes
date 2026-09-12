/**
 * A projeção é o que a tela da equipe mostra, então o que se testa aqui é o
 * resultado visível: em cada dia, para cada pessoa, o turno certo — vindo do
 * cadastro, do ajuste manual, ou de nenhum dos dois.
 */
import { describe, expect, it } from 'vitest';
import type {
  Ausencia,
  EscalaCadastro,
  EscalaCelula,
  EscalaExcecao,
  Ferias,
  Funcionario,
  TipoTurno,
} from '@/types/sgo';
import { girarCiclo } from './cicloEscala';
import { TURNOS_PADRAO } from './turnos';
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

function cadastro(funcionarioId: string): EscalaCadastro {
  return { id: `cad-${funcionarioId}`, funcionario_id: funcionarioId, inicio_em: INICIO, observacao: '' };
}

/** Monta as células de uma grade, uma string por semana (Dom…Sáb). */
function celulas(cadastroId: string, ...semanas: string[][]): EscalaCelula[] {
  return semanas.flatMap((dias, i) =>
    dias
      .map((turno, dia) => ({
        id: `${cadastroId}-${i}-${dia}`,
        cadastro_id: cadastroId,
        semana: i + 1,
        dia_semana: dia,
        tipo_turno_id: turno,
      }))
      .filter((c) => c.tipo_turno_id !== ''),
  );
}

/** Par 12×36: Ana nos dias ímpares do ciclo, Bruno no complemento. */
const GRADE_ANA = celulas(
  'cad-f1',
  [FOLGA, TRABALHO, FOLGA, TRABALHO, FOLGA, TRABALHO, FOLGA],
  [TRABALHO, FOLGA, TRABALHO, FOLGA, TRABALHO, FOLGA, TRABALHO],
);
const GRADE_BRUNO = girarCiclo(
  GRADE_ANA.map(({ semana, dia_semana, tipo_turno_id }) => ({ semana, dia_semana, tipo_turno_id })),
  1,
).map((c, i) => ({ ...c, id: `cad-f2-${i}`, cadastro_id: 'cad-f2' }));

describe('projetarEscalaEquipe', () => {
  const base = {
    funcionarios: [pessoa('f1', 'Ana'), pessoa('f2', 'Bruno')],
    escalaCadastros: [cadastro('f1'), cadastro('f2')],
    escalaCelulas: [...GRADE_ANA, ...GRADE_BRUNO],
    ferias: [] as Ferias[],
    ausencias: [] as Ausencia[],
    escalaExcecoes: [] as EscalaExcecao[],
    legenda: TURNOS_PADRAO,
  };

  /** Só os dias em que a pessoa realmente trabalha. */
  const diasDeTrabalho = (linha: ReturnType<typeof projetarEscalaEquipe>[number]) =>
    [...linha.dias.entries()]
      .filter(([, d]) => d.turno.id === TRABALHO)
      .map(([data]) => data)
      .sort();

  it('o par 12×36 alterna dia a dia, sem lacuna e sem sobreposição', () => {
    const [ana, bruno] = projetarEscalaEquipe(base, EQUIPE, '2026-01-05', '2026-01-11');

    expect(ana.funcionario.nome).toBe('Ana');
    expect(diasDeTrabalho(ana)).toEqual(['2026-01-05', '2026-01-07', '2026-01-09', '2026-01-11']);
    expect(diasDeTrabalho(bruno)).toEqual(['2026-01-06', '2026-01-08', '2026-01-10']);

    // Todo dia do período tem exatamente uma das duas trabalhando — e a outra
    // aparece na grade, de folga, em vez de sumir da linha.
    for (const data of diasDoIntervalo('2026-01-05', '2026-01-11')) {
      const trabalhando = [ana, bruno].filter((l) => l.dias.get(data)?.turno.id === TRABALHO);
      expect(trabalhando).toHaveLength(1);
      expect(ana.dias.has(data) && bruno.dias.has(data)).toBe(true);
    }
  });

  it('mostra o horário do turno e o tamanho do ciclo', () => {
    const [ana] = projetarEscalaEquipe(base, EQUIPE, '2026-01-05', '2026-01-05');
    expect(ana.ciclo).toBe(2);
    expect(ana.dias.get('2026-01-05')).toMatchObject({
      turno: { rotulo: 'Trabalho' },
      horario: '08:00–17:00',
    });
  });

  it('a folga aparece com horário vazio, não com 00:00–00:00', () => {
    const [ana] = projetarEscalaEquipe(base, EQUIPE, '2026-01-06', '2026-01-06');
    expect(ana.dias.get('2026-01-06')).toMatchObject({ turno: { rotulo: 'Folga' }, horario: '—' });
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
    expect(ana.dias.get('2026-01-05')?.turno.rotulo).toBe('Trabalho');
    expect(ana.dias.get('2026-01-11')?.indisponivel).toBeUndefined();
  });

  it('pessoa sem cadastro continua na lista, para o furo ficar visível', () => {
    const linhas = projetarEscalaEquipe(
      { ...base, escalaCadastros: [], escalaCelulas: [] },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0].dias.size).toBe(0);
    expect(linhas[0].ciclo).toBe(0);
  });

  it('ajuste de um dia vence o ciclo, sem mexer nos outros dias', () => {
    // Ana trabalha em 05, 07, 09… Trocar o dia 07 para plantão não pode mexer
    // no 09, que segue o ciclo.
    const excecao: EscalaExcecao = {
      id: 'ex1',
      funcionario_id: 'f1',
      data: '2026-01-07',
      tipo_turno_id: PLANTAO,
      observacao: '',
    };
    const [ana] = projetarEscalaEquipe(
      { ...base, escalaExcecoes: [excecao] },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );

    expect(ana.dias.get('2026-01-07')).toMatchObject({
      turno: { rotulo: 'Plantão' },
      ajustado: true,
    });
    expect(ana.dias.get('2026-01-09')?.turno.rotulo).toBe('Trabalho');
    expect(ana.dias.get('2026-01-09')?.ajustado).toBeUndefined();
  });

  it('o ajuste sobrevive à troca de mês — é ele que manda, não a tela', () => {
    // Era o bug que motivou a reescrita: ajustar um dia de janeiro e, ao abrir
    // fevereiro e voltar, encontrar o padrão do ciclo de novo.
    const excecao: EscalaExcecao = {
      id: 'ex2',
      funcionario_id: 'f1',
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

  it('ajuste sem turno esvazia o dia que o ciclo previa', () => {
    const excecao: EscalaExcecao = {
      id: 'ex3',
      funcionario_id: 'f1',
      data: '2026-01-07',
      tipo_turno_id: null,
      observacao: '',
    };
    const [ana] = projetarEscalaEquipe(
      { ...base, escalaExcecoes: [excecao] },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(ana.dias.has('2026-01-07')).toBe(false);
    expect(ana.dias.has('2026-01-05')).toBe(true);
  });

  it('célula apontando para turno que não existe mais deixa o dia fora do ciclo', () => {
    const orfa: EscalaCelula[] = [
      { id: 'x1', cadastro_id: 'cad-f1', semana: 1, dia_semana: 1, tipo_turno_id: 'tt-apagado' },
    ];
    const [ana] = projetarEscalaEquipe(
      { ...base, escalaCelulas: orfa },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(ana.dias.size).toBe(0);
  });

  it('quem mudou de equipe continua no calendário, com o turno equivalente daqui', () => {
    // O bug real: a pessoa foi cadastrada noutro time, as células apontam para
    // a legenda de lá, e a linha dela sumia inteira sem nenhum aviso.
    const deOutroTime: TipoTurno[] = [
      { ...porRotulo('Trabalho'), id: 'tt-outra-equipe', equipe_id: 'eq-noc-noturno', hora_inicio: '19:00', hora_fim: '07:00' },
    ];
    const celulasAlheias: EscalaCelula[] = [
      { id: 'y1', cadastro_id: 'cad-f1', semana: 1, dia_semana: 1, tipo_turno_id: 'tt-outra-equipe' },
    ];
    const [ana] = projetarEscalaEquipe(
      {
        ...base,
        escalaCelulas: celulasAlheias,
        turnosConhecidos: [...TURNOS_PADRAO, ...deOutroTime],
      },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );

    expect(ana.legendaDeOutraEquipe).toBe(true);
    // Aparece com o item de mesmo nome desta equipe — e com o horário daqui,
    // não o 19:00–07:00 do time anterior.
    expect(ana.dias.get('2026-01-05')).toMatchObject({
      turno: { rotulo: 'Trabalho', id: porRotulo('Trabalho').id },
      horario: '08:00–17:00',
    });
  });

  it('cadastro consistente não é marcado como de outra equipe', () => {
    const [ana] = projetarEscalaEquipe(
      { ...base, turnosConhecidos: TURNOS_PADRAO },
      EQUIPE,
      '2026-01-05',
      '2026-01-11',
    );
    expect(ana.legendaDeOutraEquipe).toBeUndefined();
  });
});

describe('coberturaPorDia', () => {
  const dias = diasDoIntervalo('2026-01-05', '2026-01-06');

  it('não conta folga, backup nem quem está de férias como cobertura', () => {
    const linhas = [
      {
        funcionario: pessoa('f1', 'Ana'),
        ciclo: 1,
        dias: new Map([
          ['2026-01-05', { turno: porRotulo('Trabalho'), horario: '09:00–18:00' }],
          ['2026-01-06', { turno: porRotulo('Backup de plantão'), horario: '00:00–23:59' }],
        ]),
      },
      {
        funcionario: pessoa('f2', 'Bruno'),
        ciclo: 1,
        dias: new Map([
          ['2026-01-05', { turno: porRotulo('Trabalho'), horario: '09:00–18:00', indisponivel: 'ferias' as const }],
          ['2026-01-06', { turno: porRotulo('Plantão'), horario: '00:00–23:59' }],
        ]),
      },
      {
        funcionario: pessoa('f3', 'Carla'),
        ciclo: 1,
        dias: new Map([
          ['2026-01-05', { turno: porRotulo('Folga'), horario: '—' }],
          ['2026-01-06', { turno: porRotulo('Folga'), horario: '—' }],
        ]),
      },
    ];

    const cobertura = coberturaPorDia(linhas, dias);
    // Dia 5: Ana trabalha (conta); Bruno está de férias e Carla de folga (não).
    expect(cobertura.get('2026-01-05')).toBe(1);
    // Dia 6: Ana é só backup (não conta); Bruno está de plantão (conta).
    expect(cobertura.get('2026-01-06')).toBe(1);
  });
});
