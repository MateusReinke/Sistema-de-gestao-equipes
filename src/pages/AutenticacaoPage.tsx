/**
 * Administração › Autenticação.
 *
 * Liga o SSO corporativo e administra as senhas locais sem redeploy. A ordem
 * da tela é a ordem da migração: começa-se com senha local, cadastra-se o
 * provedor, testa-se a conexão e só então a senha local pode sair de cena.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  PlugZap,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useDados } from '@/data/store';
import { ErroApi, api } from '@/data/api';
import { CabecalhoPagina, Aviso, CampoForm, Campo, Avatar } from '@/components/comum';
import { CampoSenha } from '@/components/auth/CampoSenha';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatarDataHora } from '@/lib/date';
import { PAPEL } from '@/lib/labels';
import type { UserRole } from '@/types/sgo';

interface ConfigAuth {
  senha_local_ativa: boolean;
  sso_ativo: boolean;
  oidc_issuer: string | null;
  oidc_client_id: string | null;
  /** Só a máscara, nunca o valor: o segredo não volta do servidor. */
  oidc_client_secret: string | null;
  oidc_escopo: string;
  sso_validado_em: string | null;
  atualizado_em: string | null;
  url_de_retorno: string;
  metodos: { senhaLocal: boolean; sso: boolean; senhaLocalForcada: boolean };
  senha_local_forcada_por_ambiente: boolean;
}

interface UsuarioAdmin {
  id: string;
  email: string;
  role: UserRole;
  ativo: boolean;
  funcionario_id: string;
  tem_senha: boolean;
  deve_trocar_senha: boolean;
  bloqueado_ate: string | null;
  ultimo_acesso_em: string | null;
}

const mensagem = (e: unknown, padrao: string) => (e instanceof ErroApi ? e.message : padrao);

export default function AutenticacaoPage() {
  const cliente = useQueryClient();
  const { sessao } = useAuth();
  const { funcionarios } = useDados();

  const config = useQuery({
    queryKey: ['admin', 'auth'],
    queryFn: () => api.get<ConfigAuth>('/api/admin/auth'),
  });

  /* Rascunho do formulário do provedor, separado do que está salvo. */
  const [issuer, setIssuer] = useState('');
  const [clientId, setClientId] = useState('');
  const [segredo, setSegredo] = useState('');
  const [escopo, setEscopo] = useState('openid profile email');

  // Preenche o rascunho quando a configuração chega (e a cada recarga dela).
  useEffect(() => {
    if (!config.data) return;
    setIssuer(config.data.oidc_issuer ?? '');
    setClientId(config.data.oidc_client_id ?? '');
    setEscopo(config.data.oidc_escopo);
    setSegredo('');
  }, [config.data]);

  const salvar = useMutation({
    mutationFn: (patch: Partial<Record<string, unknown>>) => api.put('/api/admin/auth', patch),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: ['admin', 'auth'] });
      await cliente.invalidateQueries({ queryKey: ['auth', 'config'] });
      toast.success('Configuração salva.');
    },
    onError: (e) => toast.error(mensagem(e, 'Não foi possível salvar.')),
  });

  const testar = useMutation({
    mutationFn: (corpo: Record<string, string> | undefined) =>
      api.post<{ ok: boolean; emissor?: string; suportaLogout?: boolean; erro?: string }>(
        '/api/admin/auth/testar',
        corpo ?? {},
      ),
    onSuccess: async (r) => {
      await cliente.invalidateQueries({ queryKey: ['admin', 'auth'] });
      if (r.ok) toast.success(`Provedor respondeu: ${r.emissor}`);
      else toast.error(r.erro ?? 'O provedor não respondeu como esperado.');
    },
    onError: (e) => toast.error(mensagem(e, 'Falha ao testar a conexão.')),
  });

  const cfg = config.data;
  const mudouProvedor =
    !!cfg &&
    (issuer !== (cfg.oidc_issuer ?? '') ||
      clientId !== (cfg.oidc_client_id ?? '') ||
      segredo.length > 0 ||
      escopo !== cfg.oidc_escopo);

  const validado = !!cfg?.sso_validado_em && !mudouProvedor;

  const salvarProvedor = () =>
    salvar.mutate({
      oidc_issuer: issuer.trim() || null,
      oidc_client_id: clientId.trim() || null,
      // Campo em branco mantém o segredo atual; para apagar, o servidor
      // aceita string vazia — aqui só mandamos quando algo foi digitado.
      ...(segredo ? { oidc_client_secret: segredo } : {}),
      oidc_escopo: escopo.trim() || 'openid profile email',
    });

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Autenticação"
        descricao="Como as pessoas entram na central: senha cadastrada aqui, SSO corporativo, ou os dois durante a migração."
      />

      {config.isLoading && <Skeleton className="h-64" />}
      {config.isError && (
        <Aviso tom="destructive">Não foi possível ler a configuração de autenticação.</Aviso>
      )}

      {cfg && (
        <>
          <MetodosDeEntrada cfg={cfg} validado={validado} salvar={salvar} />
          <Provedor
            cfg={cfg}
            issuer={issuer}
            setIssuer={setIssuer}
            clientId={clientId}
            setClientId={setClientId}
            segredo={segredo}
            setSegredo={setSegredo}
            escopo={escopo}
            setEscopo={setEscopo}
            mudouProvedor={mudouProvedor}
            validado={validado}
            salvarProvedor={salvarProvedor}
            salvando={salvar.isPending}
            testar={testar}
          />
          <Acessos funcionarios={funcionarios} eu={sessao?.usuario.id ?? ''} />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------- métodos de entrada */

function MetodosDeEntrada({
  cfg,
  validado,
  salvar,
}: {
  cfg: ConfigAuth;
  validado: boolean;
  salvar: ReturnType<typeof useMutation<unknown, Error, Partial<Record<string, unknown>>>>;
}) {
  // Desligar a senha local sem SSO testado trancaria todo mundo do lado de
  // fora — inclusive quem está configurando. A API recusa; a tela explica.
  const podeDesligarSenha = cfg.sso_ativo && validado;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LockKeyhole className="h-4 w-4 text-brand-amber" /> Formas de entrada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="min-w-0">
            <Label htmlFor="senha-local" className="text-sm font-medium">
              Senha cadastrada na central
            </Label>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Cada pessoa entra com o e-mail corporativo e uma senha definida aqui. É o modo
              inicial, e serve de porta dos fundos se o provedor de identidade sair do ar.
            </p>
            {!podeDesligarSenha && cfg.senha_local_ativa && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Para desligar, ative o SSO e teste a conexão com sucesso.
              </p>
            )}
            {cfg.senha_local_forcada_por_ambiente && !cfg.senha_local_ativa && (
              <p className="mt-1.5 text-[11px] text-warning-strong">
                Reaberta por <code>ALLOW_LOCAL_LOGIN</code> no ambiente, apesar de desligada aqui.
              </p>
            )}
          </div>
          <Switch
            id="senha-local"
            checked={cfg.senha_local_ativa}
            disabled={salvar.isPending || (cfg.senha_local_ativa && !podeDesligarSenha)}
            onCheckedChange={(v) => salvar.mutate({ senha_local_ativa: v })}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
          <div className="min-w-0">
            <Label htmlFor="sso-ativo" className="text-sm font-medium">
              SSO corporativo (OpenID Connect)
            </Label>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              A identidade vem do provedor da empresa. Ter conta no diretório não dá acesso
              sozinho: a pessoa também precisa de cadastro na central.
            </p>
            {!cfg.sso_ativo && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Preencha emissor, client id e client secret abaixo para poder ativar.
              </p>
            )}
          </div>
          <Switch
            id="sso-ativo"
            checked={cfg.sso_ativo}
            disabled={salvar.isPending}
            onCheckedChange={(v) => salvar.mutate({ sso_ativo: v })}
          />
        </div>

        {!cfg.metodos.senhaLocal && !cfg.metodos.sso && (
          <Aviso tom="destructive">
            Nenhuma forma de entrada está ativa. Ninguém consegue entrar depois que a sessão atual
            expirar.
          </Aviso>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------- provedor OIDC */

interface PropsProvedor {
  cfg: ConfigAuth;
  issuer: string;
  setIssuer: (v: string) => void;
  clientId: string;
  setClientId: (v: string) => void;
  segredo: string;
  setSegredo: (v: string) => void;
  escopo: string;
  setEscopo: (v: string) => void;
  mudouProvedor: boolean;
  validado: boolean;
  salvarProvedor: () => void;
  salvando: boolean;
  testar: ReturnType<
    typeof useMutation<
      { ok: boolean; emissor?: string; suportaLogout?: boolean; erro?: string },
      Error,
      Record<string, string> | undefined
    >
  >;
}

function Provedor(p: PropsProvedor) {
  const { cfg } = p;

  const copiarRetorno = async () => {
    try {
      await navigator.clipboard.writeText(cfg.url_de_retorno);
      toast.success('Endereço de retorno copiado.');
    } catch {
      toast.error('Copie manualmente: o navegador bloqueou a área de transferência.');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <PlugZap className="h-4 w-4 text-brand-amber" /> Provedor de identidade
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3">
          <Campo rotulo="Cadastre este endereço de retorno no provedor">
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-xs">{cfg.url_de_retorno}</code>
              <Button variant="ghost" size="sm" onClick={copiarRetorno}>
                <Copy className="h-3.5 w-3.5" />
                <span className="sr-only">Copiar endereço de retorno</span>
              </Button>
            </div>
          </Campo>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <CampoForm
            rotulo="Emissor (issuer)"
            dica="URL base do provedor, em https. A descoberta busca /.well-known/openid-configuration."
          >
            {(id) => (
              <Input
                id={id}
                value={p.issuer}
                onChange={(e) => p.setIssuer(e.target.value)}
                placeholder="https://login.microsoftonline.com/…/v2.0"
                autoComplete="off"
              />
            )}
          </CampoForm>

          <CampoForm rotulo="Client ID">
            {(id) => (
              <Input
                id={id}
                value={p.clientId}
                onChange={(e) => p.setClientId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                autoComplete="off"
              />
            )}
          </CampoForm>

          <CampoSenha
            rotulo="Client secret"
            valor={p.segredo}
            aoMudar={p.setSegredo}
            autoComplete="new-password"
            placeholder={cfg.oidc_client_secret ?? 'ainda não cadastrado'}
            dica={
              cfg.oidc_client_secret
                ? 'Já cadastrado e cifrado. Deixe em branco para manter.'
                : 'Guardado cifrado; não volta a aparecer depois de salvo.'
            }
          />

          <CampoForm rotulo="Escopos" dica="Separados por espaço.">
            {(id) => (
              <Input id={id} value={p.escopo} onChange={(e) => p.setEscopo(e.target.value)} />
            )}
          </CampoForm>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={p.salvarProvedor} disabled={p.salvando || !p.mudouProvedor}>
            {p.salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar provedor
          </Button>

          <Button
            variant="outline"
            disabled={p.testar.isPending || p.mudouProvedor}
            onClick={() => p.testar.mutate(undefined)}
          >
            {p.testar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlugZap className="mr-2 h-4 w-4" />
            )}
            Testar conexão
          </Button>

          {p.mudouProvedor && (
            <span className="text-[11px] text-muted-foreground">
              Salve antes de testar — o teste vale sobre a configuração gravada.
            </span>
          )}
        </div>

        {p.validado ? (
          <div className="flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-4 w-4" />
            Conexão validada em {formatarDataHora(cfg.sso_validado_em!)}.
          </div>
        ) : (
          cfg.sso_ativo && (
            <Aviso tom="warning">
              O SSO está ativo mas a conexão ainda não foi testada nesta configuração. Teste antes
              de desligar a senha local.
            </Aviso>
          )
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------- senhas dos usuários */

function Acessos({
  funcionarios,
  eu,
}: {
  funcionarios: { id: string; nome: string }[];
  eu: string;
}) {
  const cliente = useQueryClient();
  const [temporaria, setTemporaria] = useState<{ nome: string; senha: string } | null>(null);

  const usuarios = useQuery({
    queryKey: ['dados'],
    queryFn: () => api.get<{ usuarios: UsuarioAdmin[] }>('/api/dados'),
    select: (d) => d.usuarios,
  });

  const emitir = useMutation({
    mutationFn: (u: UsuarioAdmin) =>
      api.post<{ senha: string }>(`/api/admin/usuarios/${u.id}/senha-temporaria`),
    onSuccess: async (r, u) => {
      await cliente.invalidateQueries({ queryKey: ['dados'] });
      const nome = funcionarios.find((f) => f.id === u.funcionario_id)?.nome ?? u.email;
      setTemporaria({ nome, senha: r.senha });
    },
    onError: (e) => toast.error(mensagem(e, 'Não foi possível emitir a senha.')),
  });

  const desbloquear = useMutation({
    mutationFn: (u: UsuarioAdmin) => api.post(`/api/admin/usuarios/${u.id}/desbloquear`),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: ['dados'] });
      toast.success('Acesso desbloqueado.');
    },
    onError: (e) => toast.error(mensagem(e, 'Não foi possível desbloquear.')),
  });

  const bloqueado = (u: UsuarioAdmin) =>
    !!u.bloqueado_ate && Date.parse(u.bloqueado_ate) > Date.now();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-brand-amber" /> Acessos e senhas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {usuarios.isLoading && <Skeleton className="h-40" />}

        <div className="divide-y">
          {usuarios.data?.map((u) => {
            const funcionario = funcionarios.find((f) => f.id === u.funcionario_id);
            const nome = funcionario?.nome ?? u.email;

            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar nome={nome} tamanho="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {nome}
                    {u.id === eu && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">(você)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email} · {PAPEL[u.role]}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {!u.ativo && <Badge variant="outline">Inativo</Badge>}
                  {!u.tem_senha && <Badge variant="outline">Sem senha</Badge>}
                  {u.deve_trocar_senha && <Badge variant="secondary">Troca pendente</Badge>}
                  {bloqueado(u) && <Badge variant="destructive">Bloqueado</Badge>}
                  {u.ultimo_acesso_em && (
                    <span className="hidden text-[11px] text-muted-foreground sm:inline">
                      último acesso {formatarDataHora(u.ultimo_acesso_em)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {bloqueado(u) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={desbloquear.isPending}
                      onClick={() => desbloquear.mutate(u)}
                    >
                      <Unlock className="mr-1.5 h-3.5 w-3.5" /> Desbloquear
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={emitir.isPending}
                    onClick={() => emitir.mutate(u)}
                  >
                    Senha temporária
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Emitir uma senha temporária encerra as sessões abertas da pessoa e obriga a troca no
          próximo acesso. O valor aparece uma única vez.
        </p>
      </CardContent>

      <Dialog open={temporaria !== null} onOpenChange={() => setTemporaria(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-amber" /> Senha temporária de{' '}
              {temporaria?.nome}
            </DialogTitle>
            <DialogDescription>
              Entregue por um canal que só a pessoa acesse. Ela não poderá ser consultada de novo —
              se perder, emita outra.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <code className="flex-1 select-all break-all font-mono text-base tracking-wide">
              {temporaria?.senha}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(temporaria?.senha ?? '');
                  toast.success('Senha copiada.');
                } catch {
                  toast.error('Copie manualmente: o navegador bloqueou a cópia.');
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="sr-only">Copiar senha</span>
            </Button>
          </div>

          <Button onClick={() => setTemporaria(null)}>Já anotei</Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
