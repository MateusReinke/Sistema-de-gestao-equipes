/**
 * Cliente da API REST do GLPI.
 *
 * A autenticação é em duas etapas: `initSession` troca App-Token + User-Token
 * por um Session-Token de vida curta, e as demais chamadas usam esse token.
 * Encerramos a sessão ao final — o GLPI mantém sessões abertas por padrão, e
 * deixar uma por teste acumula lixo no servidor do cliente.
 */
import { buscarJson, ErroIntegracao } from './http';

export interface Conexao {
  url: string;
  appToken: string;
  userToken: string;
  timeoutSegundos?: number;
}

/** Remove a barra final para poder concatenar caminho sem duplicar separador. */
const base = (url: string) => url.replace(/\/+$/, '');

async function abrirSessao(conexao: Conexao): Promise<string> {
  const resposta = await buscarJson<{ session_token?: string }>(
    `${base(conexao.url)}/initSession`,
    {
      timeoutSegundos: conexao.timeoutSegundos,
      cabecalhos: {
        'app-token': conexao.appToken,
        authorization: `user_token ${conexao.userToken}`,
      },
    },
  );

  if (!resposta.session_token) {
    throw new ErroIntegracao('O GLPI não devolveu session_token. Confira os dois tokens.');
  }
  return resposta.session_token;
}

async function fecharSessao(conexao: Conexao, sessao: string): Promise<void> {
  try {
    await buscarJson(`${base(conexao.url)}/killSession`, {
      timeoutSegundos: conexao.timeoutSegundos,
      cabecalhos: { 'app-token': conexao.appToken, 'session-token': sessao },
    });
  } catch {
    // Sessão órfã expira sozinha; falhar aqui não deve reprovar o teste.
  }
}

export interface ResultadoTeste {
  ok: boolean;
  detalhe: string;
}

export async function testar(conexao: Conexao): Promise<ResultadoTeste> {
  let sessao: string | null = null;
  try {
    sessao = await abrirSessao(conexao);

    // `getFullSession` confirma que o token vale para consultar, não só logar.
    const dados = await buscarJson<{ session?: { glpiname?: string; glpiID?: number } }>(
      `${base(conexao.url)}/getFullSession`,
      {
        timeoutSegundos: conexao.timeoutSegundos,
        cabecalhos: { 'app-token': conexao.appToken, 'session-token': sessao },
      },
    );

    const nome = dados.session?.glpiname ?? 'usuário desconhecido';
    return { ok: true, detalhe: `Sessão aberta no GLPI como ${nome}.` };
  } catch (erro) {
    return {
      ok: false,
      detalhe: erro instanceof ErroIntegracao ? erro.message : 'Falha inesperada ao falar com o GLPI.',
    };
  } finally {
    if (sessao) await fecharSessao(conexao, sessao);
  }
}
