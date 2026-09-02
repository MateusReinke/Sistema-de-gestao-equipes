/**
 * Ida e volta dos segredos de integração.
 *
 * O que está em teste é a promessa da tela: campo de senha em branco mantém o
 * que já está gravado, e segredo nenhum volta em claro para o navegador.
 */
import { describe, expect, it } from 'vitest';
import { abrir, chavesGravadas, fechar, segredosDe, type LinhaIntegracao } from './index';

const linha = (over: Partial<LinhaIntegracao> = {}): LinhaIntegracao => ({
  tipo: 'zabbix',
  parametros: { url: 'https://z.lumini.com.br/api_jsonrpc.php', timeout: 10 },
  segredos: null,
  ...over,
});

describe('fechar e abrir', () => {
  it('separa segredo de parâmetro aberto', () => {
    const { parametros, segredos } = fechar('zabbix', {
      url: 'https://z.lumini.com.br/api_jsonrpc.php',
      timeout: 10,
      token: 'super-secreto',
    });

    expect(parametros).toEqual({ url: 'https://z.lumini.com.br/api_jsonrpc.php', timeout: 10 });
    // O token não pode aparecer em claro na coluna cifrada.
    expect(segredos).not.toBeNull();
    expect(segredos).not.toContain('super-secreto');
  });

  it('devolve tudo junto na leitura', () => {
    const { parametros, segredos } = fechar('zabbix', {
      url: 'https://z.lumini.com.br/api_jsonrpc.php',
      token: 'super-secreto',
    });

    expect(abrir(linha({ parametros, segredos }))).toMatchObject({
      url: 'https://z.lumini.com.br/api_jsonrpc.php',
      token: 'super-secreto',
    });
  });

  it('mantém o segredo salvo quando o campo vem em branco', () => {
    const primeiro = fechar('zabbix', { url: 'https://z/api', token: 'token-antigo' });
    const anteriores = segredosDe(linha({ segredos: primeiro.segredos }));

    // A pessoa edita só a URL e não redigita o token.
    const segundo = fechar('zabbix', { url: 'https://novo/api', token: '' }, anteriores);

    expect(abrir(linha({ parametros: segundo.parametros, segredos: segundo.segredos }))).toMatchObject(
      { url: 'https://novo/api', token: 'token-antigo' },
    );
  });

  it('troca o segredo quando o campo vem preenchido', () => {
    const primeiro = fechar('zabbix', { url: 'https://z/api', token: 'antigo' });
    const anteriores = segredosDe(linha({ segredos: primeiro.segredos }));
    const segundo = fechar('zabbix', { url: 'https://z/api', token: 'novo' }, anteriores);

    expect(abrir(linha({ segredos: segundo.segredos })).token).toBe('novo');
  });

  it('não guarda cifra quando não há segredo nenhum', () => {
    const { segredos } = fechar('webhook', { url: 'https://exemplo.com/hook' });
    expect(segredos).toBeNull();
  });

  it('guarda os dois tokens do GLPI', () => {
    const { parametros, segredos } = fechar('glpi', {
      url: 'https://glpi/apirest.php',
      app_token: 'app-123',
      user_token: 'user-456',
    });

    expect(parametros).toEqual({ url: 'https://glpi/apirest.php' });
    const aberto = abrir(linha({ tipo: 'glpi', parametros, segredos }));
    expect(aberto.app_token).toBe('app-123');
    expect(aberto.user_token).toBe('user-456');
  });

  it('apara espaço em volta do segredo colado', () => {
    // Copiar token de um painel costuma trazer espaço junto.
    const { segredos } = fechar('zabbix', { url: 'https://z/api', token: '  abc123  ' });
    expect(abrir(linha({ segredos })).token).toBe('abc123');
  });
});

describe('chavesGravadas', () => {
  it('lista o que já está salvo, para a tela dizer "já cadastrado"', () => {
    const { segredos } = fechar('glpi', {
      url: 'https://glpi/apirest.php',
      app_token: 'app-123',
      user_token: 'user-456',
    });

    expect(chavesGravadas(linha({ tipo: 'glpi', segredos })).sort()).toEqual([
      'app_token',
      'user_token',
    ]);
  });

  it('é vazia quando nada foi gravado', () => {
    expect(chavesGravadas(linha())).toEqual([]);
  });

  it('não estoura quando a chave de cifra mudou', () => {
    // APP_SECRET_KEY trocada: a tela precisa pedir os segredos de novo, e não
    // devolver 500.
    expect(chavesGravadas(linha({ segredos: 'v1$lixo$lixo$lixo' }))).toEqual([]);
  });
});
