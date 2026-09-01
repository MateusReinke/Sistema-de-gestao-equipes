/**
 * Política de senha local.
 *
 * Fica em `src/lib` porque os dois lados precisam dela: o formulário avisa
 * enquanto a pessoa digita e a API recusa na gravação. Uma regra só, num
 * arquivo só — a tela nunca aprova o que o servidor vai rejeitar.
 *
 * O que envolve criptografia (hash, conferência, senha temporária, bloqueio)
 * mora em `server/auth/senha.ts` e não desce para o navegador.
 */

/** Comprimento mínimo. Acima de 12 o ganho vem do tamanho, não da complexidade. */
export const TAMANHO_MINIMO_SENHA = 12;

/** Teto, para não gastar CPU derivando hash de um texto gigante. */
export const TAMANHO_MAXIMO_SENHA = 200;

/**
 * Senhas óbvias que aparecem em qualquer lista de ataque. Exigir símbolo e
 * maiúscula produz "Senha@123"; barrar as campeãs de vazamento resolve mais.
 */
const PROIBIDAS = [
  'senha',
  'password',
  '123456',
  'qwerty',
  'lumini',
  'admin',
  'mudar123',
  'trocar123',
];

/** Minúsculas e sem acento, para comparar "José" com "jose". */
const simplificar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Palavras de que a pessoa é dona: cada parte do nome e cada pedaço da conta
 * de e-mail. "Ana Silva" com `ana.silva@…` rende ana, silva.
 */
function palavrasPessoais(contexto: { nome?: string; email?: string }): string[] {
  const doNome = contexto.nome?.split(/\s+/) ?? [];
  const doEmail = contexto.email?.split('@')[0]?.split(/[^a-zA-Z0-9]+/) ?? [];

  return [...doNome, ...doEmail]
    .map(simplificar)
    // Partículas como "de", "da", "dos" não identificam ninguém.
    .filter((p) => p.length >= 3);
}

export interface ContextoSenha {
  nome?: string;
  email?: string;
}

/** Erros que impedem definir a senha. Lista vazia significa aprovada. */
export function validarForcaSenha(senha: string, contexto: ContextoSenha = {}): string[] {
  const erros: string[] = [];
  const normalizada = senha.normalize('NFKC');

  if (normalizada.length < TAMANHO_MINIMO_SENHA) {
    erros.push(`A senha precisa ter ao menos ${TAMANHO_MINIMO_SENHA} caracteres.`);
  }
  if (normalizada.length > TAMANHO_MAXIMO_SENHA) {
    erros.push('A senha é longa demais.');
  }

  const simples = simplificar(normalizada);
  if (PROIBIDAS.some((p) => simples.includes(p))) {
    erros.push('A senha contém uma sequência comum demais. Escolha outra.');
  }

  /*
   * Senha derivada do próprio nome é a primeira coisa que se tenta. Comparamos
   * por palavra — "ana-silva-2026" cai, "banana-split-roxo" não —, e só
   * procuramos como pedaço solto quando a palavra é longa o bastante para não
   * dar falso positivo.
   */
  const tokens = new Set(simples.split(/[^a-z0-9]+/).filter(Boolean));
  const pessoais = palavrasPessoais(contexto);

  const usaDadoPessoal = pessoais.some(
    (palavra) => tokens.has(palavra) || (palavra.length >= 5 && simples.includes(palavra)),
  );
  if (usaDadoPessoal) {
    erros.push('A senha não pode conter o seu nome nem o seu e-mail.');
  }

  if (/^(.)\1+$/.test(normalizada)) {
    erros.push('A senha não pode ser um único caractere repetido.');
  }

  return erros;
}

export type NivelSenha = 'vazia' | 'fraca' | 'razoavel' | 'boa' | 'forte';

export const ROTULO_NIVEL: Record<NivelSenha, string> = {
  vazia: '',
  fraca: 'Fraca',
  razoavel: 'Razoável',
  boa: 'Boa',
  forte: 'Forte',
};

/**
 * Estimativa grosseira para a barrinha do formulário.
 *
 * Não é medida de entropia: serve só para dar retorno visual enquanto se
 * digita. Quem decide se a senha passa é `validarForcaSenha`.
 */
export function nivelSenha(senha: string, contexto: ContextoSenha = {}): NivelSenha {
  if (senha.length === 0) return 'vazia';
  if (validarForcaSenha(senha, contexto).length > 0) return 'fraca';

  const variedade = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) =>
    re.test(senha),
  ).length;
  const palavras = senha.split(/[^a-zA-Z0-9]+/).filter(Boolean).length;

  // Frase com várias palavras vale tanto quanto mistura de caracteres.
  const pontos = (senha.length >= 20 ? 2 : senha.length >= 16 ? 1 : 0) + (palavras >= 3 ? 1 : 0) + (variedade >= 3 ? 1 : 0);

  if (pontos >= 3) return 'forte';
  if (pontos >= 1) return 'boa';
  return 'razoavel';
}
