import { describe, expect, it } from 'vitest';
import {
  CATALOGO,
  FILTRO_PADRAO,
  TIPOS,
  chavesSecretas,
  erroDeUrl,
  normalizarFiltro,
  resumirFiltro,
  rotuloSeveridade,
  validarIntegracao,
} from '@/lib/integracoes';

describe('catálogo', () => {
  it('tem uma definição para cada tipo declarado', () => {
    for (const tipo of TIPOS) {
      expect(CATALOGO[tipo]?.tipo).toBe(tipo);
    }
  });

  it('não repete chave de campo dentro do mesmo tipo', () => {
    for (const tipo of TIPOS) {
      const chaves = CATALOGO[tipo].campos.map((c) => c.chave);
      expect(new Set(chaves).size).toBe(chaves.length);
    }
  });

  it('sabe quais campos são segredo', () => {
    expect(chavesSecretas('zabbix')).toEqual(['token']);
    expect(chavesSecretas('glpi')).toEqual(['app_token', 'user_token']);
    // Sem segredo obrigatório, mas o cabeçalho continua sendo segredo.
    expect(chavesSecretas('webhook')).toEqual(['cabecalho_autorizacao']);
  });

  it('só o Zabbix alimenta consultas de alerta', () => {
    expect(TIPOS.filter((t) => CATALOGO[t].temConsultas)).toEqual(['zabbix']);
  });
});

describe('erroDeUrl', () => {
  it('aceita https', () => {
    expect(erroDeUrl('https://zabbix.lumini.com.br/api_jsonrpc.php')).toBeNull();
  });

  it('recusa endereço sem esquema', () => {
    expect(erroDeUrl('zabbix.lumini.com.br')).toMatch(/http/);
  });

  it('recusa esquema que não é web', () => {
    // Sem isto um file:// digitado por engano viraria leitura de disco.
    expect(erroDeUrl('file:///etc/passwd')).toMatch(/http e https/);
    expect(erroDeUrl('ftp://servidor/x')).toMatch(/http e https/);
  });

  it('recusa http remoto, onde o token trafega em claro', () => {
    expect(erroDeUrl('http://zabbix.lumini.com.br/api_jsonrpc.php')).toMatch(/https/);
  });

  it('aceita http em endereço de laboratório', () => {
    expect(erroDeUrl('http://localhost:8080/api_jsonrpc.php')).toBeNull();
    expect(erroDeUrl('http://127.0.0.1/api_jsonrpc.php')).toBeNull();
    expect(erroDeUrl('http://zabbix.local/api_jsonrpc.php')).toBeNull();
  });
});

describe('validarIntegracao', () => {
  const zabbixOk = { url: 'https://z.lumini.com.br/api_jsonrpc.php', token: 'abc', timeout: 10 };

  it('aprova uma configuração completa', () => {
    expect(validarIntegracao('zabbix', zabbixOk)).toEqual({});
  });

  it('cobra os campos obrigatórios', () => {
    const erros = validarIntegracao('zabbix', {});
    expect(erros.url).toBe('Campo obrigatório.');
    expect(erros.token).toBe('Campo obrigatório.');
    // Tempo limite tem padrão, então não é cobrado.
    expect(erros.timeout).toBeUndefined();
  });

  it('trata espaço em branco como vazio', () => {
    expect(validarIntegracao('zabbix', { ...zabbixOk, token: '   ' }).token).toBe(
      'Campo obrigatório.',
    );
  });

  it('não cobra segredo em branco quando já existe um salvo', () => {
    // Campo de senha vazio no formulário significa "mantém o que está lá".
    const erros = validarIntegracao('zabbix', { url: zabbixOk.url, token: '' }, ['token']);
    expect(erros).toEqual({});
  });

  it('cobra segredo em branco quando não há nada salvo', () => {
    expect(validarIntegracao('zabbix', { url: zabbixOk.url, token: '' }, []).token).toBe(
      'Campo obrigatório.',
    );
  });

  it('valida a URL', () => {
    expect(validarIntegracao('zabbix', { ...zabbixOk, url: 'nao-e-url' }).url).toBeTruthy();
  });

  it('valida o tempo limite', () => {
    expect(validarIntegracao('zabbix', { ...zabbixOk, timeout: 0 }).timeout).toBeTruthy();
    expect(validarIntegracao('zabbix', { ...zabbixOk, timeout: -5 }).timeout).toBeTruthy();
    expect(validarIntegracao('zabbix', { ...zabbixOk, timeout: 999 }).timeout).toBeTruthy();
    expect(validarIntegracao('zabbix', { ...zabbixOk, timeout: 30 }).timeout).toBeUndefined();
  });

  it('deixa passar o webhook sem cabeçalho, que é opcional', () => {
    expect(validarIntegracao('webhook', { url: 'https://exemplo.com/hook' })).toEqual({});
  });
});

describe('normalizarFiltro', () => {
  it('devolve o padrão para entrada vazia', () => {
    expect(normalizarFiltro(undefined)).toEqual(FILTRO_PADRAO);
    expect(normalizarFiltro({})).toEqual(FILTRO_PADRAO);
  });

  it('mantém o que veio válido', () => {
    const filtro = normalizarFiltro({
      severidade_minima: 4,
      grupos: ['12', '15'],
      tags: [{ tag: 'servico', valor: 'banco' }],
      somente_nao_reconhecidos: true,
      ocultar_suprimidos: false,
      limite: 20,
    });
    expect(filtro.severidade_minima).toBe(4);
    expect(filtro.grupos).toEqual(['12', '15']);
    expect(filtro.tags).toEqual([{ tag: 'servico', valor: 'banco' }]);
    expect(filtro.somente_nao_reconhecidos).toBe(true);
    expect(filtro.ocultar_suprimidos).toBe(false);
    expect(filtro.limite).toBe(20);
  });

  it('conserta severidade fora da faixa', () => {
    expect(normalizarFiltro({ severidade_minima: 9 }).severidade_minima).toBe(3);
    expect(normalizarFiltro({ severidade_minima: -1 }).severidade_minima).toBe(3);
    expect(normalizarFiltro({ severidade_minima: 0 }).severidade_minima).toBe(0);
  });

  it('limita o teto de linhas, para uma consulta não derrubar a tela', () => {
    expect(normalizarFiltro({ limite: 100_000 }).limite).toBe(500);
    expect(normalizarFiltro({ limite: 0 }).limite).toBe(50);
  });

  it('descarta tag sem nome e apara espaços', () => {
    const { tags } = normalizarFiltro({
      tags: [
        { tag: ' servico ', valor: ' banco ' },
        { tag: '', valor: 'sozinho' },
      ],
    });
    expect(tags).toEqual([{ tag: 'servico', valor: 'banco' }]);
  });

  it('suprime manutenção por padrão', () => {
    // Alerta de janela programada não é notícia.
    expect(normalizarFiltro({}).ocultar_suprimidos).toBe(true);
    expect(normalizarFiltro({ ocultar_suprimidos: false }).ocultar_suprimidos).toBe(false);
  });

  it('sobrevive a lixo vindo do banco', () => {
    expect(normalizarFiltro({ grupos: 'nao-e-lista', tags: 42 }).grupos).toEqual([]);
    expect(normalizarFiltro({ grupos: 'nao-e-lista', tags: 42 }).tags).toEqual([]);
  });
});

describe('resumirFiltro', () => {
  it('descreve severidade sempre', () => {
    expect(resumirFiltro(normalizarFiltro({ severidade_minima: 4 }))).toBe('Alta ou acima');
  });

  it('usa o nome do grupo quando conhecido', () => {
    const nomes = new Map([['12', 'Servidores']]);
    const filtro = normalizarFiltro({ severidade_minima: 5, grupos: ['12'] });
    expect(resumirFiltro(filtro, nomes)).toBe('Desastre ou acima · Servidores');
  });

  it('conta em vez de listar quando são muitos grupos', () => {
    const filtro = normalizarFiltro({ grupos: ['1', '2', '3'] });
    expect(resumirFiltro(filtro)).toContain('3 grupos');
  });

  it('inclui tags e o recorte de reconhecidos', () => {
    const filtro = normalizarFiltro({
      tags: [{ tag: 'servico', valor: 'banco' }],
      somente_nao_reconhecidos: true,
    });
    expect(resumirFiltro(filtro)).toContain('servico:banco');
    expect(resumirFiltro(filtro)).toContain('não reconhecidos');
  });
});

describe('rotuloSeveridade', () => {
  it('traduz os valores do Zabbix', () => {
    expect(rotuloSeveridade(0)).toBe('Não classificada');
    expect(rotuloSeveridade(5)).toBe('Desastre');
  });

  it('não quebra com valor desconhecido', () => {
    expect(rotuloSeveridade(9)).toBe('Severidade 9');
  });
});

describe('ícones', () => {
  it('todo tipo tem ícone, sem cair no genérico', async () => {
    // Um tipo novo sem ícone cairia num fallback silencioso na tela.
    const { NOMES_CONHECIDOS } = await import('@/components/integracoes/icones');
    for (const tipo of TIPOS) {
      expect(NOMES_CONHECIDOS).toContain(CATALOGO[tipo].icone);
    }
  });
});
