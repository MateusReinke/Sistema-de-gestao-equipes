/**
 * Rotas de sessão.
 *
 * Dois caminhos de entrada convivem: senha local, cadastrada na própria
 * central, e SSO corporativo. Quais estão disponíveis vem da configuração no
 * banco, editável pela tela de administração.
 */
import { eq, sql as sqlOp } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { config } from '../config';
import { db } from '../db/index';
import * as t from '../db/schema';
import { criarSessao, encerrarSessao, lerSessao, type Sessao } from '../auth/sessao';
import { LoginRecusado, SsoIndisponivel, concluirLogin, iniciarLogin, urlDeLogout } from '../auth/oidc';
import { metodosDisponiveis } from '../auth/configuracao';
import { equipesVisiveis, ehRh } from '../auth/permissoes';
import {
  MAX_TENTATIVAS,
  conferirSenha,
  gerarHash,
  proximoBloqueio,
  validarForcaSenha,
} from '../auth/senha';
import { registrar } from '../auditoria';

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
  /** O front consulta isto para saber quais formas de entrada oferecer. */
  app.get('/api/auth/config', async () => {
    const metodos = await metodosDisponiveis();
    return {
      senhaLocal: metodos.senhaLocal,
      sso: metodos.sso,
      senhaLocalForcada: metodos.senhaLocalForcada,
    };
  });

  app.get('/api/auth/me', async (req, reply) => {
    const sessao = await lerSessao(req);
    if (!sessao) return reply.code(401).send({ erro: 'Não autenticado.' });

    return reply.send({
      usuario: sessao.usuario,
      funcionario: sessao.funcionario,
      papel: sessao.usuario.role,
      ehRh: ehRh(sessao),
      equipesVisiveis: await equipesVisiveis(sessao),
      deveTrocarSenha: sessao.usuario.deve_trocar_senha,
    });
  });

  /* ------------------------------------------------------------ senha local */

  app.post<{ Body: { email?: string; senha?: string } }>(
    '/api/auth/login',
    async (req, reply) => {
      const metodos = await metodosDisponiveis();
      if (!metodos.senhaLocal) {
        return reply.code(400).send({ erro: 'Esta instalação entra apenas por SSO.' });
      }

      const email = String(req.body?.email ?? '').toLowerCase().trim();
      const senha = String(req.body?.senha ?? '');

      const [usuario] = await db
        .select()
        .from(t.usuarios)
        .where(eq(t.usuarios.email, email))
        .limit(1);

      // Resposta idêntica para e-mail inexistente e senha errada: distinguir
      // os dois entregaria a lista de quem tem conta.
      const generico = { erro: 'E-mail ou senha incorretos.' };

      if (!usuario || !usuario.senha_hash) {
        // Gasta tempo comparável ao caminho feliz, para o tempo de resposta
        // não denunciar se o e-mail existe.
        await conferirSenha(senha, 'scrypt$65536$8$1$YQ$YQ');
        return reply.code(401).send(generico);
      }

      if (usuario.bloqueado_ate && usuario.bloqueado_ate > new Date().toISOString()) {
        return reply.code(429).send({
          erro: 'Acesso bloqueado por tentativas seguidas. Aguarde alguns minutos.',
        });
      }

      if (!usuario.ativo) return reply.code(403).send({ erro: 'Usuário inativo. Procure o RH.' });

      if (!(await conferirSenha(senha, usuario.senha_hash))) {
        const tentativas = usuario.tentativas_falhas + 1;
        await db
          .update(t.usuarios)
          .set({ tentativas_falhas: tentativas, bloqueado_ate: proximoBloqueio(tentativas) })
          .where(eq(t.usuarios.id, usuario.id));

        const restantes = MAX_TENTATIVAS - (tentativas % MAX_TENTATIVAS || MAX_TENTATIVAS);
        return reply
          .code(401)
          .send(restantes === 0 ? { erro: 'Acesso bloqueado temporariamente.' } : generico);
      }

      await db
        .update(t.usuarios)
        .set({
          tentativas_falhas: 0,
          bloqueado_ate: null,
          ultimo_acesso_em: new Date().toISOString(),
        })
        .where(eq(t.usuarios.id, usuario.id));

      await criarSessao(reply, usuario.id);
      return reply.send({ ok: true, deveTrocarSenha: usuario.deve_trocar_senha });
    },
  );

  /** Troca da própria senha. Exige a atual, mesmo com sessão válida. */
  app.post<{ Body: { senhaAtual?: string; senhaNova?: string } }>(
    '/api/auth/senha',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      const senhaAtual = String(req.body?.senhaAtual ?? '');
      const senhaNova = String(req.body?.senhaNova ?? '');

      const [usuario] = await db
        .select()
        .from(t.usuarios)
        .where(eq(t.usuarios.id, sessao.usuario.id))
        .limit(1);
      if (!usuario) return reply.code(404).send({ erro: 'Usuário não encontrado.' });

      // Quem entrou por SSO e nunca teve senha local pode definir a primeira
      // sem informar a anterior — não existe anterior.
      if (usuario.senha_hash && !(await conferirSenha(senhaAtual, usuario.senha_hash))) {
        return reply.code(401).send({ erro: 'Senha atual incorreta.' });
      }

      const erros = validarForcaSenha(senhaNova, {
        nome: sessao.funcionario.nome,
        email: usuario.email,
      });
      if (erros.length > 0) return reply.code(422).send({ erro: erros[0], detalhes: erros });

      if (usuario.senha_hash && (await conferirSenha(senhaNova, usuario.senha_hash))) {
        return reply.code(422).send({ erro: 'A nova senha precisa ser diferente da atual.' });
      }

      await db
        .update(t.usuarios)
        .set({
          senha_hash: await gerarHash(senhaNova),
          deve_trocar_senha: false,
          senha_atualizada_em: new Date().toISOString(),
          tentativas_falhas: 0,
          bloqueado_ate: null,
        })
        .where(eq(t.usuarios.id, usuario.id));

      // Trocar a senha derruba as outras sessões: é o que resolve uma suspeita
      // de acesso indevido.
      await db.delete(t.sessoes).where(
        sqlOp`${t.sessoes.usuario_id} = ${usuario.id} AND ${t.sessoes.id} <> ${sessao.sessaoId}`,
      );

      await registrar(sessao, {
        acao: 'atualizou',
        entidade: 'Usuário',
        entidade_id: usuario.id,
        descricao: 'Trocou a própria senha',
      });

      return reply.send({ ok: true });
    },
  );

  /* -------------------------------------------------------------------- SSO */

  app.get<{ Querystring: { destino?: string } }>('/api/auth/sso', async (req, reply) => {
    try {
      const { url } = await iniciarLogin(destinoSeguro(req.query.destino));
      return reply.redirect(url);
    } catch (erro) {
      const motivo =
        erro instanceof SsoIndisponivel ? erro.message : 'Não foi possível iniciar o login por SSO.';
      req.log.warn({ erro }, 'falha ao iniciar SSO');
      return reply.redirect(`/login?erro=${encodeURIComponent(motivo)}`);
    }
  });

  app.get('/api/auth/callback', async (req, reply) => {
    try {
      const urlAtual = new URL(`${config.urlPublica}${req.url}`);
      const { usuarioId, idToken, destino } = await concluirLogin(urlAtual);

      await db
        .update(t.usuarios)
        .set({ ultimo_acesso_em: new Date().toISOString() })
        .where(eq(t.usuarios.id, usuarioId));

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
    return reply.send({ redirecionar: idToken ? await urlDeLogout(idToken) : null });
  });
}
