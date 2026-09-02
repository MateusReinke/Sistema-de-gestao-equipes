import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizarFiltro } from '@/lib/integracoes';
import { buscarAlertas, listarGrupos, parametrosDaConsulta, testar } from './zabbix';

/* ------------------------------------------------- Zabbix de mentira, local */

interface Chamada {
  metodo: string;
  parametros: Record<string, unknown>;
  autorizacao?: string;
}

const recebidas: Chamada[] = [];
/** Respostas por método; cada teste ajusta o que precisa. */
let respostas: Record<string, unknown> = {};
let erroForcado: { code: number; message: string; data?: string } | null = null;

let servidor: Server;
let url: string;

beforeAll(async () => {
  servidor = createServer((req, res) => {
    let corpo = '';
    req.on('data', (p) => (corpo += p));
    req.on('end', () => {
      const pedido = JSON.parse(corpo);
      recebidas.push({
        metodo: pedido.method,
        parametros: pedido.params,
        autorizacao: req.headers.authorization,
      });

      res.setHeader('content-type', 'application/json');
      // O Zabbix responde 200 mesmo em erro; o problema vem no corpo.
      if (erroForcado) {
        res.end(JSON.stringify({ jsonrpc: '2.0', error: erroForcado, id: 1 }));
        return;
      }
      res.end(
        JSON.stringify({ jsonrpc: '2.0', result: respostas[pedido.method] ?? [], id: 1 }),
      );
    });
  });

  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const porta = (servidor.address() as { port: number }).port;
  url = `http://127.0.0.1:${porta}/api_jsonrpc.php`;
});

afterAll(() => new Promise<void>((pronto) => servidor.close(() => pronto())));

const conexao = () => ({ url, token: 'token-de-teste', timeoutSegundos: 5 });

function preparar(mapa: Record<string, unknown>, erro: typeof erroForcado = null) {
  recebidas.length = 0;
  respostas = mapa;
  erroForcado = erro;
}

/* ----------------------------------------------------------------- testes */

describe('parametrosDaConsulta', () => {
  it('traduz severidade mínima para a lista que a API espera', () => {
    // A tela pensa em "piso"; o Zabbix quer as severidades desejadas.
    const p = parametrosDaConsulta(normalizarFiltro({ severidade_minima: 3 }));
    expect(p.severities).toEqual([3, 4, 5]);
  });

  it('não filtra severidade quando o piso é zero', () => {
    const p = parametrosDaConsulta(normalizarFiltro({ severidade_minima: 0 }));
    expect(p.severities).toBeUndefined();
  });

  it('repassa grupos e limite', () => {
    const p = parametrosDaConsulta(normalizarFiltro({ grupos: ['10', '12'], limite: 25 }));
    expect(p.groupids).toEqual(['10', '12']);
    expect(p.limit).toBe(25);
  });

  it('omite groupids quando não há grupo, para não filtrar tudo fora', () => {
    const p = parametrosDaConsulta(normalizarFiltro({}));
    expect(p.groupids).toBeUndefined();
  });

  it('usa igualdade quando a tag tem valor e existência quando não tem', () => {
    const p = parametrosDaConsulta(
      normalizarFiltro({
        tags: [
          { tag: 'servico', valor: 'banco' },
          { tag: 'critico', valor: '' },
        ],
      }),
    );
    expect(p.tags).toEqual([
      { tag: 'servico', value: 'banco', operator: 1 },
      { tag: 'critico', operator: 2 },
    ]);
    expect(p.evaltype).toBe(0);
  });

  it('só pede não reconhecidos quando marcado', () => {
    expect(parametrosDaConsulta(normalizarFiltro({})).acknowledged).toBeUndefined();
    expect(
      parametrosDaConsulta(normalizarFiltro({ somente_nao_reconhecidos: true })).acknowledged,
    ).toBe(false);
  });

  it('esconde manutenção programada por padrão', () => {
    expect(parametrosDaConsulta(normalizarFiltro({})).suppressed).toBe(false);
    expect(
      parametrosDaConsulta(normalizarFiltro({ ocultar_suprimidos: false })).suppressed,
    ).toBeUndefined();
  });
});

describe('testar', () => {
  it('aprova quando versão e grupos respondem', async () => {
    preparar({ 'apiinfo.version': '7.0.4', 'hostgroup.get': [{ groupid: '1' }] });

    const r = await testar(conexao());
    expect(r.ok).toBe(true);
    expect(r.detalhe).toContain('7.0.4');
  });

  it('não manda token em apiinfo.version, que recusa autenticação', async () => {
    preparar({ 'apiinfo.version': '7.0.4', 'hostgroup.get': [] });
    await testar(conexao());

    const versao = recebidas.find((c) => c.metodo === 'apiinfo.version');
    const grupos = recebidas.find((c) => c.metodo === 'hostgroup.get');
    expect(versao?.autorizacao).toBeUndefined();
    expect(grupos?.autorizacao).toBe('Bearer token-de-teste');
  });

  it('confirma o token com uma chamada autenticada, não só com a versão', async () => {
    // apiinfo.version responde sem token: sozinha, ela provaria só que a URL
    // é de um Zabbix, e um token errado passaria batido.
    preparar({ 'apiinfo.version': '7.0.4' }, {
      code: -32602,
      message: 'Not authorised.',
      data: 'Session terminated, re-login please.',
    });

    const r = await testar(conexao());
    expect(r.ok).toBe(false);
    expect(r.detalhe).toContain('Token recusado');
  });

  it('traduz falta de permissão', async () => {
    preparar({}, { code: -32500, message: 'No permissions to referred object.' });
    const r = await testar(conexao());
    expect(r.ok).toBe(false);
    expect(r.detalhe).toContain('permissão');
  });

  it('avisa quando o token não enxerga grupo nenhum', async () => {
    preparar({ 'apiinfo.version': '7.0.4', 'hostgroup.get': [] });
    const r = await testar(conexao());
    expect(r.ok).toBe(true);
    expect(r.detalhe).toContain('nenhum grupo visível');
  });

  it('não estoura com endereço que não responde', async () => {
    const r = await testar({ url: 'http://127.0.0.1:1/api_jsonrpc.php', token: 'x', timeoutSegundos: 2 });
    expect(r.ok).toBe(false);
    expect(r.detalhe).toBeTruthy();
  });
});

describe('listarGrupos', () => {
  it('devolve id e nome em ordem', async () => {
    preparar({
      'hostgroup.get': [
        { groupid: '4', name: 'Servidores' },
        { groupid: '9', name: 'Redes' },
      ],
    });

    await expect(listarGrupos(conexao())).resolves.toEqual([
      { id: '4', nome: 'Servidores' },
      { id: '9', nome: 'Redes' },
    ]);
  });
});

describe('buscarAlertas', () => {
  it('converte a resposta para o formato do domínio', async () => {
    preparar({
      'problem.get': [
        {
          eventid: '1001',
          name: 'Sem espaço em /var',
          severity: '4',
          clock: '1772323200',
          acknowledged: '0',
          hosts: [{ name: 'srv-banco-01' }],
          tags: [{ tag: 'servico', value: 'banco' }],
        },
      ],
    });

    const [alerta] = await buscarAlertas(conexao(), normalizarFiltro({}));
    expect(alerta.id).toBe('1001');
    expect(alerta.nome).toBe('Sem espaço em /var');
    expect(alerta.severidade).toBe(4);
    expect(alerta.reconhecido).toBe(false);
    expect(alerta.host).toBe('srv-banco-01');
    expect(alerta.tags).toEqual([{ tag: 'servico', valor: 'banco' }]);
    // `clock` é epoch em segundos, não milissegundos.
    expect(alerta.desde).toBe(new Date(1772323200 * 1000).toISOString());
  });

  it('sobrevive a problema sem host e sem tags', async () => {
    preparar({
      'problem.get': [{ eventid: '2', name: 'X', severity: '1', clock: '0', acknowledged: '1' }],
    });

    const [alerta] = await buscarAlertas(conexao(), normalizarFiltro({}));
    expect(alerta.host).toBe('—');
    expect(alerta.tags).toEqual([]);
    expect(alerta.reconhecido).toBe(true);
  });

  it('leva o filtro salvo até a chamada', async () => {
    preparar({ 'problem.get': [] });
    await buscarAlertas(conexao(), normalizarFiltro({ severidade_minima: 5, grupos: ['7'] }));

    const chamada = recebidas.at(-1);
    expect(chamada?.metodo).toBe('problem.get');
    expect(chamada?.parametros.severities).toEqual([5]);
    expect(chamada?.parametros.groupids).toEqual(['7']);
  });
});
