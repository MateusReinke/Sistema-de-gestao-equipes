/**
 * Cliente HTTP da API.
 *
 * O front e a API são servidos pela mesma origem, então as chamadas são
 * relativas e o cookie de sessão vai junto sem configuração de CORS.
 */

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly detalhes?: string[],
  ) {
    super(mensagem);
  }

  /** Sessão expirada ou inexistente — a aplicação deve voltar ao login. */
  get naoAutenticado(): boolean {
    return this.status === 401;
  }
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
    // Sem isto o cookie de sessão não acompanha a requisição.
    credentials: 'same-origin',
  });

  if (resposta.status === 204) return undefined as T;

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(
      resposta.status,
      (corpo as { erro?: string }).erro ?? 'Falha na comunicação com o servidor.',
      (corpo as { detalhes?: string[] }).detalhes,
    );
  }
  return corpo as T;
}

export const api = {
  get: <T>(caminho: string) => pedir<T>(caminho),
  put: <T>(caminho: string, corpo: unknown) =>
    pedir<T>(caminho, { method: 'PUT', body: JSON.stringify(corpo) }),
  post: <T>(caminho: string, corpo?: unknown) =>
    pedir<T>(caminho, { method: 'POST', body: JSON.stringify(corpo ?? {}) }),
  remover: (caminho: string) => pedir<void>(caminho, { method: 'DELETE' }),
};
