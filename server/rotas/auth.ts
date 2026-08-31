/**
 * Rotas de sessão.
 *
 * Em produção só existe o caminho do SSO. Sem OIDC configurado o servidor
 * aceita também um login de demonstração por e-mail, para desenvolvimento
 * local — `validarConfig()` impede que esse modo suba em produção.
 */
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config';
import { db } from '../db/index';
import * as t from '../db/schema';
import { criarSessao, encerrarSessao, lerSessao, type Sessao } from '../auth/sessao';
import { LoginRecusado, concluirLogin, iniciarLogin, urlDeLogout } from '../auth/oidc';
import { equipesVisiveis, ehRh } from '../auth/permissoes';

export class NaoAutenticado extends Error {}

/** Resolve a sessão ou interrompe a requisição com 401. */
export async function exigirSessao(req: FastifyRequest): Promise<Sessao> {
  const sessao = await lerSessao(req);
  if (!sessao) throw new NaoAutenticado('Sessão expirada ou inexistente.');
  return sessao;
}

/** Destino interno seguro: impede redirect para fora do domínio após o login. */
function destinoSeguro(valor: unknown): string {
  const texto = typeof valor === 'string' ? valor : '/';
  return texto.startsWith('/') && !texto.startsWith('//') ? texto : '/';
}

export function rotasAuth(app: FastifyInstance): void {
  /** O front consulta isto para saber qual tela de login mostrar. */
  app.get('/api/auth/config', async () => ({
    sso: config.ssoConfigurado,
    modoDemonstracao: !config.ssoConfigurado,
  }));

  app.get('/api/auth/me', async (req, reply) => {
    const sessao = await lerSessao(req);
    if (!sessao) return reply.code(401).send({ erro: 'Não autenticado.' });

    return reply.send({
      usuario: sessao.usuario,
      funcionario: sessao.funcionario,
      papel: sessao.usuario.role,
      ehRh: ehRh(sessao),
      equipesVisiveis: await equipesVisiveis(sessao),
    });
  });

  app.get<{ Querystring: { destino?: string } }>('/api/auth/login', async (req, reply) => {
    if (!config.ssoConfigurado) {
      return reply.code(400).send({ erro: 'SSO não configurado neste ambiente.' });
    }
    const { url } = await iniciarLogin(destinoSeguro(req.query.destino));
    return reply.redirect(url);
  });

  app.get('/api/auth/callback', async (req, reply) => {
    try {
      const urlAtual = new URL(`${config.urlPublica}${req.url}`);
      const { usuarioId, idToken, destino } = await concluirLogin(urlAtual);
      await criarSessao(reply, usuarioId, idToken);
      return reply.redirect(destinoSeguro(destino));
    } catch (erro) {
      const motivo =
        erro instanceof LoginRecusado ? erro.message : 'Não foi possível concluir o login.';
      req.log.warn({ erro }, 'falha no callback do SSO');
      // Volta para a tela de login com o motivo, em vez de exibir um stack.
      return reply.redirect(`/login?erro=${encodeURIComponent(motivo)}`);
    }
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const sessao = await lerSessao(req);
    let idToken: string | undefined;

    if (sessao) {
      const [linha] = await db
        .select({ id_token: t.sessoes.id_token })
        .from(t.sessoes)
        .where(eq(t.sessoes.id, sessao.sessaoId))
        .limit(1);
      idToken = linha?.id_token ?? undefined;
    }

    await encerrarSessao(req, reply);
    // Sem logout federado, a sessão do provedor continuaria de pé.
    return reply.send({ redirecionar: await urlDeLogout(idToken) });
  });

  /**
   * Perfis disponíveis no modo de demonstração, para a tela de login.
   * Some quando há SSO: aí a lista de e-mails não deve ser pública.
   */
  app.get('/api/auth/demo/perfis', async (_req, reply) => {
    if (config.ssoConfigurado) {
      return reply.code(404).send({ erro: 'Indisponível: este ambiente usa SSO.' });
    }
    const perfis = await db
      .select({
        email: t.usuarios.email,
        role: t.usuarios.role,
        nome: t.funcionarios.nome,
        cargo: t.funcionarios.cargo,
      })
      .from(t.usuarios)
      .innerJoin(t.funcionarios, eq(t.funcionarios.id, t.usuarios.funcionario_id))
      .where(eq(t.usuarios.ativo, true));
    return reply.send(perfis);
  });

  /**
   * Login de demonstração: entra como um usuário cadastrado, sem senha.
   * Só existe quando o SSO não está configurado.
   */
  app.post<{ Body: { email?: string } }>('/api/auth/demo', async (req, reply) => {
    if (config.ssoConfigurado) {
      return reply.code(404).send({ erro: 'Indisponível: este ambiente usa SSO.' });
    }

    const email = String(req.body?.email ?? '').toLowerCase().trim();
    const [usuario] = await db.select().from(t.usuarios).where(eq(t.usuarios.email, email)).limit(1);

    if (!usuario) return reply.code(401).send({ erro: 'E-mail não encontrado.' });
    if (!usuario.ativo) return reply.code(403).send({ erro: 'Usuário inativo. Procure o RH.' });

    await criarSessao(reply, usuario.id);
    return reply.send({ ok: true });
  });
}
