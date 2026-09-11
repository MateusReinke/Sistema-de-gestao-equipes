/**
 * `gerarChaveApi` é o único pedaço puro deste módulo — o resto depende do
 * banco. O que vale testar: o token nasce com entropia suficiente, o hash é
 * determinístico (senão a verificação nunca bateria) e o prefixo não vaza o
 * segredo.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { gerarChaveApi } from './chaveApi';

describe('gerarChaveApi', () => {
  it('gera um token com o prefixo esperado', () => {
    const { chave } = gerarChaveApi();
    expect(chave.startsWith('lumini_n8n_')).toBe(true);
  });

  it('nunca repete duas chaves', () => {
    const geradas = new Set(Array.from({ length: 200 }, () => gerarChaveApi().chave));
    expect(geradas.size).toBe(200);
  });

  it('o hash é o SHA-256 determinístico do token, não um valor aleatório à parte', () => {
    const { chave, hash } = gerarChaveApi();
    expect(hash).toBe(createHash('sha256').update(chave, 'utf8').digest('hex'));
  });

  it('o prefixo é um pedaço curto do token, não o token inteiro', () => {
    const { chave, prefixo } = gerarChaveApi();
    expect(chave.startsWith(prefixo)).toBe(true);
    expect(prefixo.length).toBeLessThan(chave.length);
  });
});
