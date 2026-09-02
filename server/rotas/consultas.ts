/**
 * Consultas a fontes públicas para poupar digitação no cadastro.
 *
 * A BrasilAPI espelha o CNPJ da Receita Federal e não exige chave — dá para
 * chamar direto, sem guardar credencial nenhuma. Passa pelo servidor em vez
 * de o navegador chamar direto porque `fetch` do browser bateria em CORS.
 */
import type { FastifyInstance } from 'fastify';
import { exigirSessao } from './auth';

interface RespostaBrasilApiCnpj {
  razao_social?: string;
  nome_fantasia?: string;
  cnae_fiscal_descricao?: string;
  municipio?: string;
  uf?: string;
  ddd_telefone_1?: string;
  email?: string;
}

export function rotasConsultas(app: FastifyInstance): void {
  app.get<{ Params: { cnpj: string } }>('/api/consultas/cnpj/:cnpj', async (req, reply) => {
    // Qualquer pessoa autenticada pode consultar — não é dado sensível da
    // central, é o cadastro público do próprio CNPJ.
    await exigirSessao(req);

    const cnpj = req.params.cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14) {
      return reply.code(400).send({ erro: 'CNPJ precisa ter 14 dígitos.' });
    }

    let resposta: Response;
    try {
      resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        signal: AbortSignal.timeout(8000),
      });
    } catch (erro) {
      // Sem isto, uma falha de rede do próprio servidor (DNS, egress bloqueado)
      // vira só "não deu" pro usuário e some do log — impossível de diagnosticar
      // depois. `docker logs` mostra a causa real.
      req.log.warn({ erro }, 'falha ao consultar CNPJ na BrasilAPI');
      return reply.code(502).send({ erro: 'Não foi possível consultar o CNPJ agora. Tente novamente.' });
    }

    if (resposta.status === 404) {
      return reply.code(404).send({ erro: 'CNPJ não encontrado na Receita Federal.' });
    }
    if (!resposta.ok) {
      return reply.code(502).send({ erro: 'Serviço de consulta de CNPJ indisponível no momento.' });
    }

    const dados = (await resposta.json()) as RespostaBrasilApiCnpj;

    return reply.send({
      razao_social: dados.razao_social ?? '',
      nome_fantasia: dados.nome_fantasia || dados.razao_social || '',
      segmento: dados.cnae_fiscal_descricao ?? '',
      municipio: dados.municipio ?? '',
      uf: dados.uf ?? '',
      telefone: dados.ddd_telefone_1 ?? '',
      email: dados.email ?? '',
    });
  });
}
