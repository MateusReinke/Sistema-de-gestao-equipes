/**
 * Administração da autenticação.
 *
 * Permite ao administrador ligar o SSO, testar a conexão com o provedor e
 * gerenciar as senhas locais — tudo pela tela, sem redeploy.
 */
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { db } from '../db/index';
import * as t from '../db/schema';
import { registrar } from '../auditoria';
import { exigir } from '../auth/permissoes';
import { exigirSessao } from './auth';
import {
  clientSecret,
  lerConfiguracao,
  metodosDisponiveis,
  salvarConfiguracao,
} from '../auth/configuracao';
import { limparCacheDescoberta, testarDescoberta, urlDeRetorno } from '../auth/oidc';
import { SegredoIlegivel, mascarar } from '../auth/segredos';
import { gerarHash, gerarSenhaTemporaria, validarForcaSenha } from '../auth/senha';

export function rotasAdministracao(app: FastifyInstance): void {
  /* --------------------------------------------- configuração de autenticação */

  app.get('/api/admin/auth', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração acessa esta configuração.');

    const cfg = await lerConfiguracao();
    const metodos = await metodosDisponiveis();

    return reply.send({
      senha_local_ativa: cfg.senha_local_ativa,
      sso_ativo: cfg.sso_ativo,
      oidc_issuer: cfg.oidc_issuer,
      oidc_client_id: cfg.oidc_client_id,
      // O segredo nunca volta em claro; a tela mostra só que existe.
      oidc_client_secret: mascarar(cfg.oidc_client_secret),
      oidc_escopo: cfg.oidc_escopo,
      sso_validado_em: cfg.sso_validado_em,
      atualizado_em: cfg.atualizado_em,
      /** Endereço a cadastrar no provedor de identidade. */
      url_de_retorno: urlDeRetorno(),
      metodos,
      senha_local_forcada_por_ambiente: config.forcarLoginLocal,
    });
  });

  /**
   * Testa a configuração sem gravar. Se o segredo não vier no corpo, usa o que
   * já está salvo — assim dá para testar sem redigitá-lo.
   */
  app.post<{ Body: { issuer?: string; clientId?: string; clientSecret?: string } }>(
    '/api/admin/auth/testar',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      exigir(sessao.usuario.role === 'admin', 'Só a administração testa esta configuração.');

      const cfg = await lerConfiguracao();
      const issuer = req.body?.issuer?.trim() || cfg.oidc_issuer;
      const clientId = req.body?.clientId?.trim() || cfg.oidc_client_id;

      let segredo = req.body?.clientSecret?.trim();
      if (!segredo) {
        try {
          segredo = (await clientSecret()) ?? undefined;
        } catch (erro) {
          if (erro instanceof SegredoIlegivel) {
            return reply.code(422).send({ ok: false, erro: erro.message });
          }
          throw erro;
        }
      }

      if (!issuer || !clientId || !segredo) {
        return reply
          .code(422)
          .send({ ok: false, erro: 'Informe emissor, client id e client secret.' });
      }

      const resultado = await testarDescoberta({ issuer, clientId, clientSecret: segredo });

      // Um teste bem-sucedido sobre a configuração já salva carimba a
      // validação, que é o que autoriza desligar a senha local depois.
      const testouOSalvo = !req.body?.issuer && !req.body?.clientId && !req.body?.clientSecret;
      if (resultado.ok && testouOSalvo) {
        await salvarConfiguracao({ sso_validado_em: new Date().toISOString() }, sessao.funcionario.id);
      }

      return reply.send(resultado);
    },
  );

  app.put<{
    Body: {
      senha_local_ativa?: boolean;
      sso_ativo?: boolean;
      oidc_issuer?: string | null;
      oidc_client_id?: string | null;
      oidc_client_secret?: string | null;
      oidc_escopo?: string;
    };
  }>('/api/admin/auth', async (req, reply) => {
    const sessao = await exigirSessao(req);
    exigir(sessao.usuario.role === 'admin', 'Só a administração altera esta configuração.');

    const atual = await lerConfiguracao();
    const corpo = req.body ?? {};

    const issuer = corpo.oidc_issuer !== undefined ? corpo.oidc_issuer : atual.oidc_issuer;
    const clientId =
      corpo.oidc_client_id !== undefined ? corpo.oidc_client_id : atual.oidc_client_id;
    const temSegredo =
      corpo.oidc_client_secret !== undefined
        ? Boolean(corpo.oidc_client_secret)
        : Boolean(atual.oidc_client_secret);

    if (issuer) {
      try {
        const url = new URL(issuer);
        if (url.protocol !== 'https:') {
          return reply.code(422).send({ erro: 'O emissor precisa usar https.' });
        }
      } catch {
        return reply.code(422).send({ erro: 'Emissor não é uma URL válida.' });
      }
    }

    const querAtivarSso = corpo.sso_ativo ?? atual.sso_ativo;
    if (querAtivarSso && !(issuer && clientId && temSegredo)) {
      return reply
        .code(422)
        .send({ erro: 'Para ativar o SSO, preencha emissor, client id e client secret.' });
    }

    /*
     * Trava contra auto-trancamento: desligar a senha local só é permitido com
     * o SSO ativo e já testado com sucesso. Sem isso, uma configuração errada
     * deixaria todo mundo — inclusive quem configurou — do lado de fora.
     */
    const querDesligarSenha = corpo.senha_local_ativa === false;
    if (querDesligarSenha) {
      // Mudar a configuração invalida um teste anterior.
      const configuracaoMudou =
        (corpo.oidc_issuer !== undefined && corpo.oidc_issuer !== atual.oidc_issuer) ||
        (corpo.oidc_client_id !== undefined && corpo.oidc_client_id !== atual.oidc_client_id) ||
        corpo.oidc_client_secret !== undefined;

      if (!querAtivarSso) {
        return reply
          .code(422)
          .send({ erro: 'Não é possível desligar a senha local sem o SSO ativo.' });
      }
      if (!atual.sso_validado_em || configuracaoMudou) {
        return reply.code(422).send({
          erro: 'Teste a conexão com o provedor antes de desligar a senha local.',
        });
      }
    }

    const salva = await salvarConfiguracao(
      {
        senha_local_ativa: corpo.senha_local_ativa,
        sso_ativo: corpo.sso_ativo,
        oidc_issuer: corpo.oidc_issuer,
        oidc_client_id: corpo.oidc_client_id,
        // String vazia significa "apagar"; ausente significa "manter".
        oidc_client_secret:
          corpo.oidc_client_secret === undefined
            ? undefined
            : corpo.oidc_client_secret || null,
        oidc_escopo: corpo.oidc_escopo,
        // Alterar emissor, client id ou segredo derruba a validação anterior.
        sso_validado_em:
          corpo.oidc_issuer !== undefined ||
          corpo.oidc_client_id !== undefined ||
          corpo.oidc_client_secret !== undefined
            ? null
            : undefined,
      },
      sessao.funcionario.id,
    );

    limparCacheDescoberta();

    await registrar(sessao, {
      acao: 'atualizou',
      entidade: 'Autenticação',
      entidade_id: 'configuracao',
      descricao: `SSO ${salva.sso_ativo ? 'ativo' : 'inativo'}, senha local ${
        salva.senha_local_ativa ? 'ativa' : 'inativa'
      }`,
    });

    return reply.send({ ok: true });
  });

  /* ------------------------------------------------------ senhas de usuários */

  /**
   * Gera uma senha temporária para alguém que está entrando ou perdeu acesso.
   * O valor aparece uma única vez, na resposta — não fica recuperável depois.
   */
  app.post<{ Params: { id: string } }>(
    '/api/admin/usuarios/:id/senha-temporaria',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      exigir(sessao.usuario.role === 'admin', 'Só a administração redefine senha de terceiros.');

      const [usuario] = await db
        .select()
        .from(t.usuarios)
        .where(eq(t.usuarios.id, req.params.id))
        .limit(1);
      if (!usuario) return reply.code(404).send({ erro: 'Usuário não encontrado.' });

      const senha = gerarSenhaTemporaria();

      await db.transaction(async (tx) => {
        await tx
          .update(t.usuarios)
          .set({
            senha_hash: await gerarHash(senha),
            deve_trocar_senha: true,
            senha_atualizada_em: new Date().toISOString(),
            tentativas_falhas: 0,
            bloqueado_ate: null,
          })
          .where(eq(t.usuarios.id, usuario.id));

        // Redefinir senha encerra as sessões abertas daquele usuário.
        await tx.delete(t.sessoes).where(eq(t.sessoes.usuario_id, usuario.id));
      });

      await registrar(sessao, {
        acao: 'atualizou',
        entidade: 'Usuário',
        entidade_id: usuario.id,
        descricao: `Senha temporária emitida para ${usuario.email}`,
      });

      return reply.send({ senha, deve_trocar_senha: true });
    },
  );

  /** Define uma senha escolhida pelo administrador, útil no primeiro cadastro. */
  app.post<{ Params: { id: string }; Body: { senha?: string } }>(
    '/api/admin/usuarios/:id/senha',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      exigir(sessao.usuario.role === 'admin', 'Só a administração define senha de terceiros.');

      const senha = String(req.body?.senha ?? '');
      const [linha] = await db
        .select({ usuario: t.usuarios, funcionario: t.funcionarios })
        .from(t.usuarios)
        .innerJoin(t.funcionarios, eq(t.funcionarios.id, t.usuarios.funcionario_id))
        .where(eq(t.usuarios.id, req.params.id))
        .limit(1);
      if (!linha) return reply.code(404).send({ erro: 'Usuário não encontrado.' });

      const erros = validarForcaSenha(senha, {
        nome: linha.funcionario.nome,
        email: linha.usuario.email,
      });
      if (erros.length > 0) return reply.code(422).send({ erro: erros[0], detalhes: erros });

      await db.transaction(async (tx) => {
        await tx
          .update(t.usuarios)
          .set({
            senha_hash: await gerarHash(senha),
            // Senha escolhida por outra pessoa deve ser trocada no 1º acesso.
            deve_trocar_senha: true,
            senha_atualizada_em: new Date().toISOString(),
            tentativas_falhas: 0,
            bloqueado_ate: null,
          })
          .where(eq(t.usuarios.id, req.params.id));
        await tx.delete(t.sessoes).where(eq(t.sessoes.usuario_id, req.params.id));
      });

      await registrar(sessao, {
        acao: 'atualizou',
        entidade: 'Usuário',
        entidade_id: req.params.id,
        descricao: `Senha definida para ${linha.usuario.email}`,
      });

      return reply.send({ ok: true });
    },
  );

  /** Destrava quem passou do limite de tentativas antes do prazo. */
  app.post<{ Params: { id: string } }>(
    '/api/admin/usuarios/:id/desbloquear',
    async (req, reply) => {
      const sessao = await exigirSessao(req);
      exigir(sessao.usuario.role === 'admin', 'Só a administração desbloqueia acesso.');

      await db
        .update(t.usuarios)
        .set({ tentativas_falhas: 0, bloqueado_ate: null })
        .where(eq(t.usuarios.id, req.params.id));

      await registrar(sessao, {
        acao: 'atualizou',
        entidade: 'Usuário',
        entidade_id: req.params.id,
        descricao: 'Acesso desbloqueado',
      });

      return reply.send({ ok: true });
    },
  );
}
