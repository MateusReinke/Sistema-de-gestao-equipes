/**
 * Exportação de listas para CSV.
 *
 * O RH consome essas listas no Excel, que no Brasil abre CSV assumindo `;` como
 * separador e espera BOM UTF-8 para não quebrar acentuação.
 */

export interface ColunaExport<T> {
  cabecalho: string;
  valor: (item: T) => string | number | undefined | null;
}

/** Escapa um campo: aspas duplicadas e cerca quando há separador ou quebra. */
function escapar(valor: string | number | undefined | null): string {
  const texto = valor === undefined || valor === null ? '' : String(valor);
  if (/[;"\n\r]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/** BOM UTF-8 — sem ele o Excel abre "João" como "JoÃ£o". */
const BOM = '﻿';

export function gerarCsv<T>(itens: T[], colunas: ColunaExport<T>[]): string {
  const linhas = [
    colunas.map((c) => escapar(c.cabecalho)).join(';'),
    ...itens.map((item) => colunas.map((c) => escapar(c.valor(item))).join(';')),
  ];
  return BOM + linhas.join('\r\n');
}

/** Dispara o download do CSV no navegador. */
export function baixarCsv<T>(nomeArquivo: string, itens: T[], colunas: ColunaExport<T>[]): void {
  const blob = new Blob([gerarCsv(itens, colunas)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
