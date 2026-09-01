/**
 * Senhas locais.
 *
 * Usa `scrypt` da biblioteca padrão do Node em vez de argon2. Argon2 seria
 * marginalmente melhor, mas exige compilação nativa na imagem; scrypt é uma
 * KDF de memória dura, recomendada pelo OWASP e já disponível — a diferença
 * prática aqui é pequena diante do custo de manter dependência nativa.
 *
 * Os parâmetros ficam gravados junto do hash, então dá para endurecê-los no
 * futuro sem invalidar as senhas existentes.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/*
 * A política (comprimento, listas proibidas, uso do próprio nome) é a mesma no
 * formulário e aqui, então mora em `src/lib/senha.ts`. Reexportamos para quem
 * já importa deste módulo.
 */
export {
  TAMANHO_MINIMO_SENHA,
  TAMANHO_MAXIMO_SENHA,
  validarForcaSenha,
  type ContextoSenha,
} from '@/lib/senha';

/**
 * `promisify` perde a sobrecarga com opções do scrypt, então envolvemos à mão
 * para poder passar N, r, p e maxmem.
 */
function derivar(
  senha: string,
  salt: Buffer,
  tamanho: number,
  opcoes: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolver, rejeitar) => {
    scrypt(senha, salt, tamanho, opcoes, (erro, chave) =>
      erro ? rejeitar(erro) : resolver(chave),
    );
  });
}

/** Custo atual. N=2^16 leva ~100ms por verificação num servidor modesto. */
const PARAMETROS = { N: 65_536, r: 8, p: 1, tamanho: 64 } as const;

/**
 * Formato: `scrypt$N$r$p$salt$hash`, ambos em base64url.
 *
 * Guardar N, r e p no próprio registro permite subir o custo depois sem
 * quebrar quem já tem senha.
 */
export async function gerarHash(senha: string): Promise<string> {
  const { N, r, p, tamanho } = PARAMETROS;
  const salt = randomBytes(16);
  const derivada = await derivar(senha.normalize('NFKC'), salt, tamanho, {
    N,
    r,
    p,
    // O Node limita a memória do scrypt; N alto exige subir o teto.
    maxmem: 256 * 1024 * 1024,
  });

  return [
    'scrypt',
    N,
    r,
    p,
    salt.toString('base64url'),
    derivada.toString('base64url'),
  ].join('$');
}

/** Tamanhos mínimos aceitáveis, em bytes, para salt e digest gravados. */
const MINIMO_SALT = 8;
const MINIMO_DIGEST = 16;

const inteiroPositivo = (texto: string): number | null => {
  const valor = Number(texto);
  return Number.isInteger(valor) && valor > 0 ? valor : null;
};

/**
 * Confere a senha em tempo constante.
 *
 * Devolve `false` para qualquer hash malformado em vez de lançar: um registro
 * corrompido não deve virar erro 500 numa tela de login.
 *
 * A conferência de formato antes da comparação não é preciosismo. Um registro
 * truncado como `scrypt$16384$8$1$$` deriva uma chave de zero byte, e
 * `timingSafeEqual` entre dois buffers vazios é `true` — ou seja, aceitaria
 * qualquer senha. Exigir salt e digest com tamanho plausível fecha isso.
 */
export async function conferirSenha(senha: string, hashGuardado: string): Promise<boolean> {
  try {
    const partes = hashGuardado.split('$');
    if (partes.length !== 6) return false;

    const [algoritmo, n, r, p, saltB64, hashB64] = partes;
    if (algoritmo !== 'scrypt') return false;

    const custo = { N: inteiroPositivo(n), r: inteiroPositivo(r), p: inteiroPositivo(p) };
    if (custo.N === null || custo.r === null || custo.p === null) return false;

    const salt = Buffer.from(saltB64, 'base64url');
    const esperado = Buffer.from(hashB64, 'base64url');
    if (salt.length < MINIMO_SALT || esperado.length < MINIMO_DIGEST) return false;

    const derivada = await derivar(senha.normalize('NFKC'), salt, esperado.length, {
      N: custo.N,
      r: custo.r,
      p: custo.p,
      maxmem: 256 * 1024 * 1024,
    });

    return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
  } catch {
    return false;
  }
}

/** Sem caracteres ambíguos (0/O, 1/l/I) para não virar chamado de suporte. */
const ALFABETO_TEMPORARIA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Sorteia um caractere sem viés.
 *
 * `byte % 56` favoreceria os 32 primeiros caracteres, porque 256 não é
 * múltiplo de 56. Descartar os bytes acima do maior múltiplo devolve uma
 * distribuição uniforme — o laço quase sempre termina na primeira tentativa.
 */
function sortearCaractere(): string {
  const teto = 256 - (256 % ALFABETO_TEMPORARIA.length);
  for (;;) {
    const [byte] = randomBytes(1);
    if (byte < teto) return ALFABETO_TEMPORARIA[byte % ALFABETO_TEMPORARIA.length];
  }
}

/** Senha temporária legível, para o RH entregar a quem está entrando. */
export function gerarSenhaTemporaria(): string {
  const senha = Array.from({ length: 16 }, sortearCaractere).join('');
  // Grupos de quatro são mais fáceis de ditar por telefone.
  return `${senha.slice(0, 4)}-${senha.slice(4, 8)}-${senha.slice(8, 12)}-${senha.slice(12, 16)}`;
}

/* ---------------------------------------------------------- força bruta */

/** Tentativas erradas seguidas antes de bloquear temporariamente. */
export const MAX_TENTATIVAS = 5;

/** Quanto tempo o bloqueio dura. */
export const MINUTOS_BLOQUEIO = 15;

export function proximoBloqueio(tentativas: number): string | null {
  if (tentativas < MAX_TENTATIVAS) return null;
  // Cada bloco de MAX_TENTATIVAS dobra a espera, com teto de 8 horas.
  const fator = Math.min(2 ** Math.floor(tentativas / MAX_TENTATIVAS - 1), 32);
  const minutos = MINUTOS_BLOQUEIO * fator;
  return new Date(Date.now() + minutos * 60_000).toISOString();
}
