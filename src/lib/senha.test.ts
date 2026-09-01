import { describe, expect, it } from 'vitest';
import {
  TAMANHO_MINIMO_SENHA,
  nivelSenha,
  validarForcaSenha,
  type ContextoSenha,
} from '@/lib/senha';

/** Contexto de quem mais aparece na massa de demonstração. */
const ANA = { nome: 'Ana Silva', email: 'ana.silva@lumini.com.br' };

describe('validarForcaSenha', () => {
  const aprova = (senha: string, contexto: ContextoSenha = ANA) =>
    validarForcaSenha(senha, contexto).length === 0;

  it('aprova uma frase longa e sem relação com a pessoa', () => {
    expect(validarForcaSenha('cavalo-bateria-grampo-correto', ANA)).toEqual([]);
  });

  it('exige o comprimento mínimo', () => {
    expect(TAMANHO_MINIMO_SENHA).toBe(12);
    expect(aprova('curta1')).toBe(false);
    expect(aprova('abcdefghijk')).toBe(false); // 11
    expect(aprova('mesa-verde-quente')).toBe(true); // 17
  });

  it('recusa senha absurdamente longa', () => {
    expect(aprova('x'.repeat(201))).toBe(false);
  });

  it('recusa as campeãs de vazamento, em qualquer caixa', () => {
    expect(aprova('minha-senha-secreta')).toBe(false);
    expect(aprova('PASSWORD-do-cofre-aqui')).toBe(false);
    expect(aprova('qwerty-no-teclado-hoje')).toBe(false);
    expect(aprova('lumini-solutions-2026')).toBe(false);
  });

  it('recusa senha feita com o próprio nome', () => {
    // Regressão: "Ana" tem 3 letras e o sobrenome não era conferido, então
    // esta senha passava.
    expect(validarForcaSenha('ana-silva-quer-entrar', ANA)).toContain(
      'A senha não pode conter o seu nome nem o seu e-mail.',
    );
    expect(aprova('ANA-entrando-no-sistema')).toBe(false);
    expect(aprova('trabalho-na-silva-corp')).toBe(false);
  });

  it('ignora acentos ao comparar com o nome', () => {
    const jose = { nome: 'José Antônio', email: 'jose.antonio@lumini.com.br' };
    expect(aprova('jose-antonio-2026', jose)).toBe(false);
    expect(aprova('JOSÉ-gosta-de-praia', jose)).toBe(false);
  });

  it('pega o nome colado, sem separador', () => {
    expect(aprova('anasilva2026x')).toBe(false); // "silva" como pedaço
  });

  it('usa também as partes do e-mail', () => {
    const contexto = { email: 'rodrigo.matos@lumini.com.br' };
    expect(aprova('rodrigo-no-trabalho', contexto)).toBe(false);
    expect(aprova('matos-de-inverno-2026', contexto)).toBe(false);
  });

  it('não confunde palavra comum que contém o nome curto', () => {
    // "ana" cabe dentro de "banana"; palavra de 3 letras só bate inteira.
    expect(validarForcaSenha('banana-split-roxo', ANA)).toEqual([]);
    expect(validarForcaSenha('caravana-de-montanha', ANA)).toEqual([]);
  });

  it('ignora partículas do nome, que não identificam ninguém', () => {
    const contexto = { nome: 'Maria de Souza', email: 'maria.souza@lumini.com.br' };
    // "de" tem 2 letras: não deveria reprovar qualquer senha que a contenha.
    expect(validarForcaSenha('bolo-de-chocolate-quente', contexto)).toEqual([]);
  });

  it('recusa um único caractere repetido', () => {
    expect(aprova('aaaaaaaaaaaaaaa')).toBe(false);
  });

  it('funciona sem contexto, quando ainda não se sabe quem é a pessoa', () => {
    expect(validarForcaSenha('cavalo-bateria-grampo-correto')).toEqual([]);
    expect(validarForcaSenha('curta')).not.toEqual([]);
  });
});

describe('nivelSenha', () => {
  it('não mostra nada para campo vazio', () => {
    expect(nivelSenha('')).toBe('vazia');
  });

  it('chama de fraca tudo que a política recusaria', () => {
    expect(nivelSenha('curta')).toBe('fraca');
    expect(nivelSenha('ana-silva-quer-entrar', ANA)).toBe('fraca');
  });

  it('sobe conforme o tamanho e a variedade', () => {
    expect(nivelSenha('mesaverdeqte', ANA)).toBe('razoavel');
    expect(nivelSenha('cavalo-bateria-grampo-correto', ANA)).toBe('forte');
  });

  it('nunca aponta como aceitável algo que a política reprova', () => {
    const reprovadas = ['curta', 'aaaaaaaaaaaaaaa', 'minha-senha-secreta', 'ana-silva-2026'];
    for (const senha of reprovadas) {
      expect(nivelSenha(senha, ANA)).toBe('fraca');
    }
  });
});
