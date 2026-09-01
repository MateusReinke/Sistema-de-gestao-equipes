/**
 * Cifra de segredos guardados no banco.
 *
 * O client secret do provedor de identidade fica em `configuracao_auth`. Se
 * ficasse em texto puro, um dump do banco — um backup extraviado, um acesso de
 * leitura ao Postgres — entregaria o segredo. Cifrando com uma chave que mora
 * fora do banco, o dump sozinho não basta.
 *
 * AES-256-GCM: além de cifrar, autentica, então adulteração é detectada.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config';

/**
 * Deriva a chave de 32 bytes de `APP_SECRET_KEY`.
 *
 * SHA-256 sobre o valor bruto: a chave já é material de alta entropia vindo do
 * ambiente, não uma senha digitada, então não há por que passar por uma KDF
 * lenta a cada uso.
 */
function chave(): Buffer {
  return createHash('sha256').update(config.chaveSegredos, 'utf8').digest();
}

/** Formato: `v1$iv$tag$dados`, tudo em base64url. */
export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ['v1', iv.toString('base64url'), tag.toString('base64url'), dados.toString('base64url')].join(
    '$',
  );
}

export class SegredoIlegivel extends Error {
  constructor() {
    super(
      'Não foi possível decifrar o segredo do SSO. Confira se APP_SECRET_KEY é a mesma usada quando ele foi salvo.',
    );
  }
}

export function decifrar(cifrado: string): string {
  const [versao, ivB64, tagB64, dadosB64] = cifrado.split('$');
  if (versao !== 'v1') throw new SegredoIlegivel();

  try {
    const decipher = createDecipheriv('aes-256-gcm', chave(), Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dadosB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // Chave trocada ou dado adulterado — nos dois casos não dá para seguir.
    throw new SegredoIlegivel();
  }
}

/** Máscara para exibir na tela sem revelar o segredo. */
export function mascarar(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return '••••••••';
}
