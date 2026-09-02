import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import estatico from '@fastify/static';
import { config } from './config';
import { SemPermissao } from './auth/permissoes';
import { NaoAutenticado, rotasAuth } from './rotas/auth';
import { rotasCrud } from './rotas/crud';
import { rotasDados } from './rotas/dados';
import { rotasAcoes } from './rotas/acoes';
import { rotasAdministracao } from './rotas/administracao';
import { rotasIntegracoes } from './rotas/integracoes';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Erro do Postgres que vale traduzir para o usuário em vez de virar 500. */
const MENSAGEM_POR_CODIGO: Record<string, string> = {
  '23505': 'Já existe um registro com este valor único.',
  '23503': 'Registro relacionado não encontrado.',
  '23514': 'Valor fora do permitido para este campo.',
};

export async function criarApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.ambiente === 'production' ? 'info' : 'warn' },
    // O proxy do Coolify termina o TLS; sem isto o Fastify acha que é http.
    trustProxy: true,
  });

  await app.register(cookie);

  app.setErrorHandler((erro, req, reply) => {
    if (erro instanceof NaoAutenticado) return reply.code(401).send({ erro: erro.message });
    if (erro instanceof SemPermissao) return reply.code(403).send({ erro: erro.message });

    const { code: codigo, statusCode: status, message } = erro as {
      code?: string;
      statusCode?: number;
      message?: string;
    };

    if (codigo && MENSAGEM_POR_CODIGO[codigo]) {
      return reply.code(409).send({ erro: MENSAGEM_POR_CODIGO[codigo] });
    }

    // Erros do próprio Fastify (corpo malformado, payload grande demais) já
    // trazem o status certo. Sem isto virariam 500 e esconderiam a causa real.
    if (status && status >= 400 && status < 500) {
      req.log.warn({ erro }, 'requisição recusada');
      return reply.code(status).send({ erro: message ?? 'Requisição inválida.' });
    }

    req.log.error({ erro }, 'erro não tratado');
    // Detalhe interno não vai para o cliente; fica no log.
    return reply.code(500).send({ erro: 'Erro interno. Tente novamente.' });
  });

  app.get('/api/saude', async () => ({ ok: true, ambiente: config.ambiente }));

  rotasAuth(app);
  rotasAdministracao(app);
  rotasIntegracoes(app);
  rotasDados(app);
  rotasAcoes(app);
  rotasCrud(app);

  // Em produção o mesmo processo serve o front compilado, então há um
  // container e uma origem só — sem CORS e sem cookie entre domínios.
  const dist = resolve(raiz, 'dist');
  if (existsSync(dist)) {
    await app.register(estatico, { root: dist, prefix: '/' });

    // Rotas do React Router precisam devolver o index.html.
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) {
        return reply.code(404).send({ erro: 'Rota não encontrada.' });
      }
      return reply.sendFile('index.html');
    });
  }

  return app;
}
