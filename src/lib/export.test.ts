import { describe, expect, it } from 'vitest';
import { gerarCsv } from '@/lib/export';

interface Linha {
  nome: string;
  cargo: string;
  dias?: number;
}

const colunas = [
  { cabecalho: 'Nome', valor: (l: Linha) => l.nome },
  { cabecalho: 'Cargo', valor: (l: Linha) => l.cargo },
  { cabecalho: 'Dias', valor: (l: Linha) => l.dias },
];

describe('geração de CSV', () => {
  it('usa ponto e vírgula e BOM, como o Excel brasileiro espera', () => {
    const csv = gerarCsv([{ nome: 'Ana', cargo: 'Analista', dias: 30 }], colunas);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Nome;Cargo;Dias');
    expect(csv).toContain('Ana;Analista;30');
  });

  it('cerca com aspas campos que contêm o separador', () => {
    const csv = gerarCsv([{ nome: 'Silva; Ana', cargo: 'Analista' }], colunas);
    expect(csv).toContain('"Silva; Ana"');
  });

  it('duplica aspas internas para não quebrar a coluna', () => {
    const csv = gerarCsv([{ nome: 'Ana "Aninha"', cargo: 'Analista' }], colunas);
    expect(csv).toContain('"Ana ""Aninha"""');
  });

  it('escapa quebras de linha dentro de um campo', () => {
    const csv = gerarCsv([{ nome: 'Ana', cargo: 'Analista\nSênior' }], colunas);
    expect(csv).toContain('"Analista\nSênior"');
  });

  it('representa valores ausentes como campo vazio', () => {
    const csv = gerarCsv([{ nome: 'Ana', cargo: 'Analista' }], colunas);
    expect(csv.trim().endsWith('Ana;Analista;')).toBe(true);
  });

  it('emite só o cabeçalho quando não há linhas', () => {
    expect(gerarCsv([], colunas)).toBe('﻿Nome;Cargo;Dias');
  });
});
