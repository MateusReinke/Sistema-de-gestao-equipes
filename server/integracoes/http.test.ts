import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buscarJson, ErroIntegracao } from './http';

let servidor: Server;
let porta: number;

/** O que o servidor de teste deve responder na próxima requisição. */
let responder: (url: string) => { status: number; corpo: string; cabecalhos?: Record<string, string> };

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const r = responder(req.url ?? '/');
    res.writeHead(r.status, { 'content-type': 'application/json', ...r.cabecalhos });
    res.end(r.corpo);
  });
  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  porta = (servidor.address() as { port: number }).port;
});

afterAll(() => new Promise<void>((pronto) => servidor.close(() => pronto())));

const endereco = (caminho = '/') => `http://127.0.0.1:${porta}${caminho}`;
const emProducao = (ligado: boolean) => {
  process.env.NODE_ENV = ligado ? 'production' : 'test';
};

afterEach(() => emProducao(false));

describe('buscarJson', () => {
  it('devolve o JSON da resposta', async () => {
    responder = () => ({ status: 200, corpo: '{"ok":true}' });
    await expect(buscarJson(endereco())).resolves.toEqual({ ok: true });
  });

  it('traduz status de credencial recusada', async () => {
    responder = () => ({ status: 403, corpo: '{}' });
    await expect(buscarJson(endereco())).rejects.toThrow(/Credencial recusada/);
  });

  it('traduz 404 apontando para o caminho da API', async () => {
    responder = () => ({ status: 404, corpo: '{}' });
    await expect(buscarJson(endereco())).rejects.toThrow(/caminho da API/);
  });

  it('explica resposta que não é JSON', async () => {
    // O caso real: a URL aponta para a tela de login e volta HTML.
    responder = () => ({ status: 200, corpo: '<!doctype html><title>Login</title>' });
    await expect(buscarJson(endereco())).rejects.toThrow(/não é JSON/);
  });

  it('segue redirecionamento', async () => {
    responder = (url) =>
      url === '/inicio'
        ? { status: 302, corpo: '', cabecalhos: { location: endereco('/fim') } }
        : { status: 200, corpo: '{"chegou":true}' };

    await expect(buscarJson(endereco('/inicio'))).resolves.toEqual({ chegou: true });
  });

  it('desiste depois de redirecionamentos demais', async () => {
    responder = () => ({ status: 302, corpo: '', cabecalhos: { location: endereco('/volta') } });
    await expect(buscarJson(endereco())).rejects.toThrow(/Redirecionamentos demais/);
  });
});

describe('bloqueio de destino interno (SSRF)', () => {
  it('recusa loopback em produção', async () => {
    emProducao(true);
    responder = () => ({ status: 200, corpo: '{}' });

    await expect(buscarJson(endereco())).rejects.toThrow(/rede interna/);
  });

  it('recusa o endereço de metadados da nuvem', async () => {
    emProducao(true);
    // 169.254.169.254 entrega credenciais da instância em AWS, GCP e Azure.
    await expect(buscarJson('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(
      /rede interna/,
    );
  });

  it('recusa as faixas privadas', async () => {
    emProducao(true);
    for (const ip of ['10.0.0.5', '192.168.1.1', '172.16.0.1', '172.31.255.254', '100.64.0.1']) {
      await expect(buscarJson(`http://${ip}/x`)).rejects.toThrow(/rede interna/);
    }
  });

  it('recusa IPv6 interno', async () => {
    emProducao(true);
    for (const ip of ['[::1]', '[::]', '[fd00::1]', '[fe80::1]', '[febf::1]', '[fc00::1]']) {
      await expect(buscarJson(`http://${ip}/x`)).rejects.toThrow(/rede interna/);
    }
  });

  it('recusa IPv4 mapeado em IPv6, que o Node normaliza para hexadecimal', async () => {
    emProducao(true);
    // `new URL('http://[::ffff:169.254.169.254]')` vira `[::ffff:a9fe:a9fe]`.
    // Comparar por prefixo de texto deixaria o metadata da nuvem passar
    // vestido de IPv6.
    for (const ip of [
      '[::ffff:10.0.0.1]',
      '[::ffff:169.254.169.254]',
      '[::ffff:a9fe:a9fe]',
      '[::ffff:127.0.0.1]',
    ]) {
      await expect(buscarJson(`http://${ip}/x`)).rejects.toThrow(/rede interna/);
    }
  });

  it('deixa passar IPv6 público', async () => {
    emProducao(true);
    // 2001:4860:4860::8888 é o DNS público do Google: não pode ser barrado.
    const erro = await buscarJson('http://[2001:4860:4860::8888]/x', {
      timeoutSegundos: 1,
    }).catch((e) => e as Error);
    expect((erro as Error).message).not.toMatch(/rede interna/);
  });

  it('deixa passar faixa pública vizinha das privadas', async () => {
    emProducao(true);
    // A faixa privada é só 172.16–172.31: 172.15 e 172.32 são públicas e
    // barrá-las quebraria integração legítima. O que importa aqui é que o
    // erro NÃO seja o de bloqueio — a requisição chegou a sair.
    for (const ip of ['172.15.0.1', '172.32.0.1', '11.0.0.1', '192.167.1.1']) {
      const erro = await buscarJson(`http://${ip}/x`, { timeoutSegundos: 1 }).catch(
        (e) => e as Error,
      );
      expect((erro as Error).message).not.toMatch(/rede interna/);
    }
  });

  it('revalida o destino a cada redirecionamento', async () => {
    // Um host externo redirecionando para 127.0.0.1 é a forma clássica de
    // furar uma checagem que só olha o primeiro endereço.
    responder = () => ({
      status: 302,
      corpo: '',
      cabecalhos: { location: 'http://169.254.169.254/latest/meta-data/' },
    });

    // Fora de produção o primeiro salto passa; ligamos o bloqueio no meio do
    // caminho para provar que o segundo salto é conferido.
    const promessa = buscarJson(endereco('/redireciona'), { timeoutSegundos: 5 });
    emProducao(true);
    await expect(promessa).rejects.toThrow(/rede interna/);
  });

  it('não bloqueia fora de produção, onde a integração é local', async () => {
    emProducao(false);
    responder = () => ({ status: 200, corpo: '{"ok":true}' });
    await expect(buscarJson(endereco())).resolves.toEqual({ ok: true });
  });
});

describe('tempo limite', () => {
  it('desiste e explica', async () => {
    responder = () => ({ status: 200, corpo: '{}' });
    // Servidor que nunca responde: porta fechada com timeout curto.
    await expect(
      buscarJson('http://10.255.255.1/x', { timeoutSegundos: 1 }),
    ).rejects.toBeInstanceOf(ErroIntegracao);
  });
});
