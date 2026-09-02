/**
 * Chamada HTTP para sistemas externos.
 *
 * Centraliza o que toda integração precisa e é fácil esquecer numa delas:
 * tempo limite, teto de corpo, mensagem de erro legível e — o mais
 * importante — a recusa de endereços internos.
 *
 * Sobre a recusa: o endereço da integração é digitado por um administrador,
 * então o servidor faz requisição para onde mandarem. Sem barreira, isso é
 * SSRF: alguém aponta a "integração" para `169.254.169.254` e usa a central
 * como proxy para o metadata da nuvem, ou varre a rede interna medindo o
 * tempo de resposta. A verificação acontece a cada salto de redirecionamento,
 * porque um host externo pode redirecionar para um interno.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class ErroIntegracao extends Error {
  readonly causa?: string;

  constructor(mensagem: string, opcoes: { causa?: string } = {}) {
    super(mensagem);
    this.name = 'ErroIntegracao';
    this.causa = opcoes.causa;
  }
}

/**
 * Expande um IPv6 nos seus oito grupos de 16 bits.
 *
 * Comparar por prefixo de texto não serve: o `::` esconde grupos, e um IPv4
 * mapeado chega em hexadecimal — `new URL('http://[::ffff:169.254.169.254]')`
 * normaliza o hostname para `[::ffff:a9fe:a9fe]`. Sem expandir, o endereço de
 * metadados da nuvem passaria vestido de IPv6.
 */
function gruposIPv6(ip: string): number[] | null {
  const [antes, depois] = ip.toLowerCase().split('::');
  const cabeca = antes ? antes.split(':') : [];
  const cauda = depois !== undefined && depois ? depois.split(':') : [];

  // A cauda pode terminar em notação pontilhada (::ffff:10.0.0.1).
  const ultimo = cauda.at(-1) ?? cabeca.at(-1);
  if (ultimo?.includes('.')) {
    const octetos = ultimo.split('.').map(Number);
    if (octetos.length !== 4 || octetos.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return null;
    }
    const dois = [(octetos[0] << 8) | octetos[1], (octetos[2] << 8) | octetos[3]];
    const lista = cauda.length > 0 ? cauda : cabeca;
    lista.splice(-1, 1, dois[0].toString(16), dois[1].toString(16));
  }

  const faltando = 8 - cabeca.length - cauda.length;
  if (depois === undefined && faltando !== 0) return null;
  if (faltando < 0) return null;

  const grupos = [...cabeca, ...Array(Math.max(faltando, 0)).fill('0'), ...cauda].map((g) =>
    parseInt(g || '0', 16),
  );

  return grupos.length === 8 && grupos.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff)
    ? grupos
    : null;
}

/** Faixas reservadas que nenhuma integração legítima usa. */
function ehEnderecoInterno(ip: string): boolean {
  if (isIP(ip) === 6) {
    const g = gruposIPv6(ip);
    // Endereço que não conseguimos entender é tratado como suspeito.
    if (!g) return true;

    const zerado = g.slice(0, 5).every((x) => x === 0);
    // ::1 (loopback) e :: (não especificado).
    if (zerado && g[5] === 0 && g[6] === 0 && (g[7] === 1 || g[7] === 0)) return true;
    // IPv4 mapeado (::ffff:a.b.c.d) volta para a regra v4.
    if (zerado && g[5] === 0xffff) {
      const v4 = [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff].join('.');
      return ehEnderecoInterno(v4);
    }
    // Link-local fe80::/10 e unique-local fc00::/7.
    if ((g[0] & 0xffc0) === 0xfe80) return true;
    if ((g[0] & 0xfe00) === 0xfc00) return true;
    return false;
  }

  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 || // "este host"
    a === 10 || // privada
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local, inclui o metadata da nuvem
    (a === 172 && b >= 16 && b <= 31) || // privada
    (a === 192 && b === 168) || // privada
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224 // multicast e reservado
  );
}

/**
 * Em desenvolvimento a integração costuma estar no próprio laptop, então a
 * barreira só vale em produção. Fora dela, avisa e deixa passar.
 */
function bloqueioAtivo(): boolean {
  return process.env.NODE_ENV === 'production';
}

async function conferirDestino(url: URL): Promise<void> {
  if (!bloqueioAtivo()) return;

  const host = url.hostname.replace(/^\[|\]$/g, '');

  const enderecos = isIP(host)
    ? [host]
    : await lookup(host, { all: true })
        .then((r) => r.map((e) => e.address))
        .catch(() => {
          throw new ErroIntegracao(`Não foi possível resolver o endereço ${host}.`);
        });

  if (enderecos.length === 0) {
    throw new ErroIntegracao(`Não foi possível resolver o endereço ${host}.`);
  }
  if (enderecos.some(ehEnderecoInterno)) {
    throw new ErroIntegracao(
      `O endereço ${host} aponta para a rede interna do servidor. Integrações precisam de um destino externo.`,
    );
  }
}

/** Corpo máximo aceito de um sistema externo — 8 MB cobre qualquer resposta útil. */
const MAXIMO_CORPO = 8 * 1024 * 1024;

export interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST';
  cabecalhos?: Record<string, string>;
  corpo?: unknown;
  timeoutSegundos?: number;
}

/**
 * Faz a requisição e devolve o JSON.
 *
 * Segue redirecionamento à mão (`redirect: 'manual'`) para poder revalidar o
 * destino a cada salto — `redirect: 'follow'` entregaria o controle ao fetch e
 * a barreira valeria só para o primeiro endereço.
 */
export async function buscarJson<T>(endereco: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const limite = Math.min(Math.max(opcoes.timeoutSegundos ?? 10, 1), 120);
  const cancelamento = AbortSignal.timeout(limite * 1000);

  let url = new URL(endereco);
  let resposta: Response;

  for (let salto = 0; ; salto += 1) {
    if (salto > 3) throw new ErroIntegracao('Redirecionamentos demais.');
    await conferirDestino(url);

    try {
      resposta = await fetch(url, {
        method: opcoes.metodo ?? 'GET',
        headers: { accept: 'application/json', ...opcoes.cabecalhos },
        body: opcoes.corpo === undefined ? undefined : JSON.stringify(opcoes.corpo),
        signal: cancelamento,
        redirect: 'manual',
      });
    } catch (erro) {
      if (cancelamento.aborted) {
        throw new ErroIntegracao(`Sem resposta em ${limite}s. O endereço está acessível a partir do servidor?`);
      }
      throw new ErroIntegracao('Não foi possível conectar ao endereço informado.', {
        causa: erro instanceof Error ? erro.message : String(erro),
      });
    }

    const destino = resposta.headers.get('location');
    if (resposta.status >= 300 && resposta.status < 400 && destino) {
      url = new URL(destino, url);
      continue;
    }
    break;
  }

  if (!resposta.ok) {
    throw new ErroIntegracao(mensagemDeStatus(resposta.status));
  }

  const texto = await lerLimitado(resposta);
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErroIntegracao(
      'A resposta não é JSON. Confira se a URL aponta para a API e não para a tela de login.',
    );
  }
}

function mensagemDeStatus(status: number): string {
  if (status === 401 || status === 403) return `Credencial recusada pelo servidor (HTTP ${status}).`;
  if (status === 404) return 'Endereço não encontrado (HTTP 404). Confira o caminho da API.';
  if (status >= 500) return `O sistema externo respondeu com erro (HTTP ${status}).`;
  return `Resposta inesperada do sistema externo (HTTP ${status}).`;
}

/** Lê o corpo com teto, para uma resposta gigante não derrubar o processo. */
async function lerLimitado(resposta: Response): Promise<string> {
  const corpo = resposta.body;
  if (!corpo) return '';

  const pedacos: Uint8Array[] = [];
  let total = 0;

  const leitor = corpo.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAXIMO_CORPO) {
      await leitor.cancel();
      throw new ErroIntegracao('A resposta do sistema externo é grande demais.');
    }
    pedacos.push(value);
  }

  return Buffer.concat(pedacos).toString('utf8');
}
