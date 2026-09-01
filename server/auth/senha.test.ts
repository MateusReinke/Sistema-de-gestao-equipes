import { describe, expect, it } from 'vitest';
import {
  MAX_TENTATIVAS,
  conferirSenha,
  gerarHash,
  gerarSenhaTemporaria,
  proximoBloqueio,
  validarForcaSenha,
} from './senha';

/** Contexto de quem mais aparece na massa de demonstração. */
const ANA = { nome: 'Ana Silva', email: 'ana.silva@lumini.com.br' };

describe('gerarHash e conferirSenha', () => {
  it('aceita a senha correta', async () => {
    const hash = await gerarHash('cavalo-bateria-grampo-correto');
    await expect(conferirSenha('cavalo-bateria-grampo-correto', hash)).resolves.toBe(true);
  });

  it('recusa senha errada, inclusive por um caractere', async () => {
    const hash = await gerarHash('cavalo-bateria-grampo-correto');
    await expect(conferirSenha('cavalo-bateria-grampo-corretO', hash)).resolves.toBe(false);
    await expect(conferirSenha('', hash)).resolves.toBe(false);
  });

  it('grava os parâmetros no hash, para poder endurecê-los depois', async () => {
    const hash = await gerarHash('cavalo-bateria-grampo-correto');
    const [algoritmo, n, r, p] = hash.split('$');

    expect(algoritmo).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(65_536);
    expect([Number(r), Number(p)]).toEqual([8, 1]);
    expect(hash.split('$')).toHaveLength(6);
  });

  it('usa salt novo a cada chamada', async () => {
    const [a, b] = await Promise.all([gerarHash('mesma-senha-aqui'), gerarHash('mesma-senha-aqui')]);
    expect(a).not.toBe(b);
    await expect(conferirSenha('mesma-senha-aqui', b)).resolves.toBe(true);
  });

  it('normaliza unicode: "ção" digitado das duas formas é a mesma senha', async () => {
    // Combinando (c + til) vs. composto (ç). Teclados e celulares divergem.
    const combinando = 'administração-plena';
    const composto = 'administração-plena';
    expect(combinando).not.toBe(composto);

    const hash = await gerarHash(combinando);
    await expect(conferirSenha(composto, hash)).resolves.toBe(true);
  });

  it('devolve false para hash corrompido em vez de estourar', async () => {
    // Um registro estragado não pode virar 500 na tela de login.
    const ruins = [
      '',
      'nada',
      'bcrypt$1$2$3$4$5',
      'scrypt$x$y$z$!!!$!!!',
      'scrypt$16384$8$1$c2FsdA', // faltando um campo
      'scrypt$0$8$1$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA', // N inválido
    ];
    for (const ruim of ruins) {
      await expect(conferirSenha('qualquer-senha-aqui', ruim)).resolves.toBe(false);
    }
  });

  it('não deixa registro truncado virar senha coringa', async () => {
    // Sem salt e sem digest, o scrypt deriva zero byte e `timingSafeEqual`
    // entre dois buffers vazios responde `true`: aceitaria qualquer senha.
    for (const truncado of ['scrypt$$$$$', 'scrypt$16384$8$1$$', 'scrypt$16384$8$1$c2FsdHNhbHQ$']) {
      await expect(conferirSenha('qualquer-senha-aqui', truncado)).resolves.toBe(false);
      await expect(conferirSenha('', truncado)).resolves.toBe(false);
    }
  });
});

describe('gerarSenhaTemporaria', () => {
  it('sai em grupos de quatro, sem caractere ambíguo', () => {
    for (let i = 0; i < 50; i += 1) {
      const senha = gerarSenhaTemporaria();
      expect(senha).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$/);
    }
  });

  it('passa na própria política de força', () => {
    expect(validarForcaSenha(gerarSenhaTemporaria(), ANA)).toEqual([]);
  });

  it('não se repete', () => {
    const geradas = new Set(Array.from({ length: 200 }, gerarSenhaTemporaria));
    expect(geradas.size).toBe(200);
  });

  it('distribui os caracteres sem viés de módulo', () => {
    // 256 % 56 != 0: sortear com `byte % 56` faria os 32 primeiros
    // caracteres saírem 25% mais que os outros 24.
    const contagem = new Map<string, number>();
    for (let i = 0; i < 4_000; i += 1) {
      for (const c of gerarSenhaTemporaria().replaceAll('-', '')) {
        contagem.set(c, (contagem.get(c) ?? 0) + 1);
      }
    }

    const esperado = (4_000 * 16) / 56;
    const frequencias = [...contagem.values()];
    expect(contagem.size).toBe(56);
    // Margem folgada: só queremos flagrar viés sistemático, não ruído.
    expect(Math.min(...frequencias)).toBeGreaterThan(esperado * 0.8);
    expect(Math.max(...frequencias)).toBeLessThan(esperado * 1.2);
  });
});

describe('proximoBloqueio', () => {
  const minutos = (iso: string | null) =>
    iso === null ? null : Math.round((Date.parse(iso) - Date.now()) / 60_000);

  it('não bloqueia antes do limite', () => {
    for (let i = 0; i < MAX_TENTATIVAS; i += 1) {
      expect(proximoBloqueio(i)).toBeNull();
    }
  });

  it('dobra a espera a cada bloco de tentativas', () => {
    expect(minutos(proximoBloqueio(5))).toBe(15);
    expect(minutos(proximoBloqueio(9))).toBe(15);
    expect(minutos(proximoBloqueio(10))).toBe(30);
    expect(minutos(proximoBloqueio(15))).toBe(60);
    expect(minutos(proximoBloqueio(20))).toBe(120);
  });

  it('tem teto de 8 horas, para não travar alguém para sempre', () => {
    expect(minutos(proximoBloqueio(50))).toBe(480);
    expect(minutos(proximoBloqueio(5_000))).toBe(480);
  });
});
