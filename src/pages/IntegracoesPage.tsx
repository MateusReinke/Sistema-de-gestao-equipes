/**
 * Administração › Integrações.
 *
 * Registro dos sistemas externos ligados à central, no formato do *media type*
 * do Zabbix: um catálogo de tipos, cada um com seus campos e um teste de
 * conexão. Acrescentar um sistema é acrescentar uma entrada no catálogo
 * (`src/lib/integracoes.ts`) — esta tela se ajusta sozinha.
 *
 * A identidade (SSO/Entra ID) aparece aqui como status e atalho, mas continua
 * sendo editada em Autenticação: manter dois lugares gravando a mesma
 * configuração seria pedir para os dois divergirem.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  Pencil,
  Plug,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { definicao } from '@/lib/integracoes';
import { ErroApi, api } from '@/data/api';
import {
  useAcoesIntegracao,
  useConsultas,
  useIntegracoes,
  type Integracao,
} from '@/data/integracoes';
import { CabecalhoPagina, Aviso, EstadoVazio } from '@/components/comum';
import { DialogoIntegracao } from '@/components/integracoes/DialogoIntegracao';
import { ConsultasAlerta } from '@/components/integracoes/ConsultasAlerta';
import { iconeDe } from '@/components/integracoes/icones';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { formatarDataHora } from '@/lib/date';

export default function IntegracoesPage() {
  const integracoes = useIntegracoes();
  const consultas = useConsultas();
  const acoes = useAcoesIntegracao();

  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [editando, setEditando] = useState<Integracao | null>(null);
  const [erroDoServidor, setErroDoServidor] = useState<string | null>(null);
  const [camposComErro, setCamposComErro] = useState<Record<string, string>>({});

  const abrirNova = () => {
    setEditando(null);
    setErroDoServidor(null);
    setCamposComErro({});
    setDialogoAberto(true);
  };

  const abrirEdicao = (integracao: Integracao) => {
    setEditando(integracao);
    setErroDoServidor(null);
    setCamposComErro({});
    setDialogoAberto(true);
  };

  const tratarErro = (erro: unknown) => {
    if (erro instanceof ErroApi) {
      setErroDoServidor(erro.message);
      // A API devolve mensagem por campo em `campos`; o cliente HTTP guarda o
      // corpo cru em `detalhes`, então lemos daqui o que der.
      if (erro.campos) setCamposComErro(erro.campos);
    } else {
      setErroDoServidor('Não foi possível salvar.');
    }
  };

  const salvar = (dados: Parameters<typeof acoes.criar.mutate>[0]) => {
    setErroDoServidor(null);
    setCamposComErro({});

    const pronto = () => {
      toast.success(editando ? 'Integração salva.' : 'Integração cadastrada.');
      setDialogoAberto(false);
    };

    if (editando) {
      acoes.atualizar.mutate(
        { id: editando.id, nome: dados.nome, descricao: dados.descricao, valores: dados.valores },
        { onSuccess: pronto, onError: tratarErro },
      );
    } else {
      acoes.criar.mutate(dados, { onSuccess: pronto, onError: tratarErro });
    }
  };

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Integrações"
        descricao="Sistemas externos ligados à central: monitoramento, service desk, identidade e canais de aviso."
        acoes={
          <Button onClick={abrirNova}>
            <Plus className="mr-2 h-4 w-4" /> Nova integração
          </Button>
        }
      />

      <CartaoIdentidade />

      {integracoes.isLoading && <Skeleton className="h-48" />}
      {integracoes.isError && (
        <Aviso tom="destructive">Não foi possível carregar as integrações.</Aviso>
      )}

      {integracoes.data?.length === 0 && (
        <Card>
          <EstadoVazio
            icone={Plug}
            titulo="Nenhum sistema conectado"
            descricao="Ligue o Zabbix para acompanhar o ambiente dos clientes, ou o GLPI para os chamados."
            acao={
              <Button onClick={abrirNova}>
                <Plus className="mr-2 h-4 w-4" /> Nova integração
              </Button>
            }
          />
        </Card>
      )}

      {integracoes.data?.map((integracao) => (
        <CartaoIntegracao
          key={integracao.id}
          integracao={integracao}
          consultas={(consultas.data ?? []).filter((c) => c.integracao_id === integracao.id)}
          acoes={acoes}
          aoEditar={() => abrirEdicao(integracao)}
        />
      ))}

      <DialogoIntegracao
        aberto={dialogoAberto}
        aoFechar={() => setDialogoAberto(false)}
        editando={editando}
        salvando={acoes.criar.isPending || acoes.atualizar.isPending}
        erroDoServidor={erroDoServidor}
        camposComErro={camposComErro}
        aoSalvar={salvar}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- cartões */

function CartaoIntegracao({
  integracao,
  consultas,
  acoes,
  aoEditar,
}: {
  integracao: Integracao;
  consultas: ReturnType<typeof useConsultas>['data'];
  acoes: ReturnType<typeof useAcoesIntegracao>;
  aoEditar: () => void;
}) {
  const def = definicao(integracao.tipo);
  const Icone = iconeDe(integracao.tipo);
  const testando = acoes.testar.isPending && acoes.testar.variables === integracao.id;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-amber/15">
              <Icone className="h-4 w-4 text-brand-amber" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">{integracao.nome}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                <Badge variant="outline" className="mr-1.5">
                  {def.rotulo}
                </Badge>
                {String(integracao.parametros.url ?? '')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={integracao.ativo}
              aria-label={`${integracao.ativo ? 'Desativar' : 'Ativar'} ${integracao.nome}`}
              onCheckedChange={(v) =>
                acoes.atualizar.mutate(
                  { id: integracao.id, ativo: v },
                  { onError: () => toast.error('Não foi possível alterar.') },
                )
              }
            />
            <Button size="sm" variant="ghost" onClick={aoEditar}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">Editar {integracao.nome}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (!confirm(`Remover a integração “${integracao.nome}” e suas consultas?`)) return;
                acoes.remover.mutate(integracao.id, {
                  onSuccess: () => toast.success('Integração removida.'),
                  onError: () => toast.error('Não foi possível remover.'),
                });
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
              <span className="sr-only">Remover {integracao.nome}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {integracao.descricao && (
          <p className="text-sm text-muted-foreground">{integracao.descricao}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" disabled={testando} onClick={() => testar()}>
            {testando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug className="mr-1.5 h-3.5 w-3.5" />
            )}
            Testar conexão
          </Button>

          {integracao.ultimo_teste_em && (
            <span
              className={`flex items-center gap-1.5 text-xs ${
                integracao.ultimo_teste_ok ? 'text-success' : 'text-destructive-strong'
              }`}
            >
              {integracao.ultimo_teste_ok ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <CircleAlert className="h-3.5 w-3.5" />
              )}
              {integracao.ultimo_teste_detalhe}
              <span className="text-muted-foreground">
                · {formatarDataHora(integracao.ultimo_teste_em)}
              </span>
            </span>
          )}

          {!integracao.ultimo_teste_em && (
            <span className="text-xs text-muted-foreground">Ainda não testada.</span>
          )}
        </div>

        {def.temConsultas && (
          <ConsultasAlerta integracao={integracao} consultas={consultas ?? []} />
        )}
      </CardContent>
    </Card>
  );

  function testar() {
    acoes.testar.mutate(integracao.id, {
      onSuccess: (r) => (r.ok ? toast.success(r.detalhe) : toast.error(r.detalhe)),
      onError: () => toast.error('Não foi possível testar a conexão.'),
    });
  }
}

/**
 * Identidade corporativa.
 *
 * Mostra o estado do SSO e leva para a tela que o configura. Duplicar o
 * formulário aqui daria dois caminhos gravando a mesma linha.
 */
function CartaoIdentidade() {
  const config = useQuery({
    queryKey: ['admin', 'auth'],
    queryFn: () =>
      api.get<{
        sso_ativo: boolean;
        oidc_issuer: string | null;
        sso_validado_em: string | null;
        senha_local_ativa: boolean;
      }>('/api/admin/auth'),
  });

  const emissor = config.data?.oidc_issuer;
  const ehEntra = emissor?.includes('login.microsoftonline.com');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-brand-amber" /> Identidade corporativa
        </CardTitle>
      </CardHeader>
      <CardContent>
        {config.isLoading ? (
          <Skeleton className="h-12" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium">
                  {ehEntra ? 'Microsoft Entra ID' : 'SSO por OpenID Connect'}
                </span>
                {config.data?.sso_ativo ? (
                  <Badge variant="secondary">Ativo</Badge>
                ) : (
                  <Badge variant="outline">Inativo</Badge>
                )}
                {config.data?.sso_ativo && !config.data.sso_validado_em && (
                  <Badge variant="outline">Sem teste</Badge>
                )}
                {config.data?.senha_local_ativa && <Badge variant="outline">Senha local ligada</Badge>}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {emissor ?? 'Nenhum provedor cadastrado. A entrada é por senha local.'}
              </p>
            </div>

            <Button variant="outline" size="sm" asChild>
              <Link to="/autenticacao">
                Configurar <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
