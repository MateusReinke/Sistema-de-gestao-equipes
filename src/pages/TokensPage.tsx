/**
 * Tokens de API — cada pessoa gerencia os seus.
 *
 * A ideia que a tela precisa passar em uma frase: **o token vale o que você
 * vale**. Ele não tem permissão própria; carrega o dono, e a requisição feita
 * com ele passa exatamente pelas mesmas regras de papel e de equipe que a
 * pessoa teria navegando. Por isso qualquer usuário pode emitir o seu, e por
 * isso o quadro no topo mostra o alcance do papel de quem está olhando.
 *
 * O escopo só reduz: `leitura` recusa qualquer escrita, mesmo num token de
 * administrador — é o padrão para o caso comum, um script que só consulta.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Aviso, BadgeStatus, CabecalhoPagina, EstadoVazio, Indicador } from '@/components/comum';
import { api } from '@/data/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatarDataHora } from '@/lib/date';
import { PAPEL } from '@/lib/labels';
import type { UserRole } from '@/types/sgo';

interface TokenPublico {
  id: string;
  nome: string;
  prefixo: string;
  escopo: 'leitura' | 'escrita';
  ativo: boolean;
  criado_em: string;
  expira_em: string | null;
  ultimo_uso_em: string | null;
  usuario_id: string | null;
  dono?: string;
}

/** O que cada papel alcança — o mesmo texto vale para a pessoa e para o token dela. */
const ALCANCE: Record<UserRole, string> = {
  admin: 'tudo — todas as equipes, cadastros, aprovações e administração',
  rh: 'todas as equipes e pessoas, férias, ausências, acessos e aprovações',
  gestor: 'as equipes que você gerencia — pessoas, escala e aprovações delas',
  colaborador: 'os seus próprios dados e a escala da sua equipe',
};

const DIAS = [
  { valor: 30, rotulo: '30 dias' },
  { valor: 90, rotulo: '90 dias' },
  { valor: 365, rotulo: '1 ano' },
  { valor: 730, rotulo: '2 anos' },
];

export default function TokensPage() {
  const { sessao, papel } = useAuth();
  const [tokens, setTokens] = useState<TokenPublico[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [criarAberto, setCriarAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [escopo, setEscopo] = useState<'leitura' | 'escrita'>('leitura');
  const [dias, setDias] = useState(365);
  const [criando, setCriando] = useState(false);
  /** O segredo recém-gerado. Some da tela assim que ela é fechada. */
  const [segredo, setSegredo] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const [aRevogar, setARevogar] = useState<TokenPublico | null>(null);

  const carregar = async () => {
    try {
      const r = await api.get<{ tokens: TokenPublico[] }>('/api/tokens');
      setTokens(r.tokens);
    } catch {
      toast.error('Não foi possível carregar os tokens.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const ehAdmin = papel === 'admin';
  const meus = useMemo(
    () => tokens.filter((t) => t.usuario_id === sessao?.usuario.id),
    [tokens, sessao],
  );
  const ativos = tokens.filter((t) => t.ativo && !expirado(t));

  const criar = async () => {
    setCriando(true);
    try {
      const r = await api.post<{ token: string }>('/api/tokens', { nome: nome.trim(), escopo, dias });
      setSegredo(r.token);
      setNome('');
      await carregar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível criar o token.');
    } finally {
      setCriando(false);
    }
  };

  const copiar = async () => {
    if (!segredo) return;
    try {
      await navigator.clipboard.writeText(segredo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto e copie à mão.');
    }
  };

  const revogar = async () => {
    if (!aRevogar) return;
    try {
      await api.remover(`/api/tokens/${aRevogar.id}`);
      toast.success(`Token "${aRevogar.nome}" revogado.`);
      await carregar();
    } catch {
      toast.error('Não foi possível revogar o token.');
    } finally {
      setARevogar(null);
    }
  };

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Tokens de API"
        descricao="Credenciais para integrações chamarem a API no seu nome."
        acoes={
          <>
            <Button variant="outline" asChild>
              <a href="/docs/api.md" target="_blank" rel="noreferrer">
                <BookOpen className="mr-2 h-4 w-4" /> Documentação
              </a>
            </Button>
            <Button
              onClick={() => {
                setSegredo(null);
                setEscopo('leitura');
                setDias(365);
                setCriarAberto(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo token
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador rotulo="Tokens ativos" valor={ativos.length} icone={KeyRound} tom="primary" />
        <Indicador rotulo="Meus tokens" valor={meus.length} icone={KeyRound} />
        <Indicador
          rotulo="Seu papel"
          valor={papel ? PAPEL[papel] : '—'}
          icone={ShieldCheck}
          tom="info"
        />
      </div>

      {papel && (
        <Aviso tom="info">
          <strong>O token vale o que você vale.</strong> Ele não tem permissão própria: quem chama a
          API com ele é você. Como {PAPEL[papel].toLowerCase()}, o alcance é {ALCANCE[papel]}. Um
          token de escopo <em>leitura</em> recusa qualquer escrita, mesmo assim. Nenhum token mexe
          em senha, SSO ou nos próprios tokens — isso exige entrar pelo navegador.
        </Aviso>
      )}

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {ehAdmin ? 'Todos os tokens' : 'Meus tokens'}
          </CardTitle>
          {ehAdmin && (
            <p className="text-xs text-muted-foreground">
              Como administrador, você enxerga e revoga os tokens de todo mundo.
            </p>
          )}
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : tokens.length === 0 ? (
            <EstadoVazio
              icone={KeyRound}
              titulo="Nenhum token ainda"
              descricao="Crie um para uma integração chamar a API no seu nome."
            />
          ) : (
            <div className="space-y-1.5">
              {tokens.map((t) => {
                const venceu = expirado(t);
                const inativo = !t.ativo || venceu;
                return (
                  <div
                    key={t.id}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 ${
                      inativo ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.nome}</p>
                      <p className="tabular truncate text-[11px] text-muted-foreground">
                        {t.prefixo}… · criado {formatarDataHora(t.criado_em)}
                        {t.expira_em && ` · vence ${formatarDataHora(t.expira_em)}`}
                        {t.ultimo_uso_em
                          ? ` · último uso ${formatarDataHora(t.ultimo_uso_em)}`
                          : ' · nunca usado'}
                      </p>
                      {ehAdmin && t.dono && (
                        <p className="truncate text-[11px] text-muted-foreground">de {t.dono}</p>
                      )}
                    </div>

                    <BadgeStatus
                      texto={t.escopo === 'escrita' ? 'Leitura e escrita' : 'Somente leitura'}
                      classe={
                        t.escopo === 'escrita'
                          ? 'bg-warning/15 text-warning-strong border-warning/30'
                          : 'bg-muted text-muted-foreground border-border'
                      }
                      className="text-[10px]"
                    />
                    {!t.ativo && (
                      <BadgeStatus
                        texto="Revogado"
                        classe="bg-destructive/15 text-destructive border-destructive/30"
                        className="text-[10px]"
                      />
                    )}
                    {t.ativo && venceu && (
                      <BadgeStatus
                        texto="Expirado"
                        classe="bg-destructive/15 text-destructive border-destructive/30"
                        className="text-[10px]"
                      />
                    )}

                    {t.ativo && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        title={`Revogar ${t.nome}`}
                        onClick={() => setARevogar(t)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------ criar token */}
      <Sheet
        open={criarAberto}
        onOpenChange={(v) => {
          if (!v) {
            setCriarAberto(false);
            // O segredo não sobrevive ao fechamento: ou foi copiado, ou se perde.
            setSegredo(null);
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{segredo ? 'Token criado' : 'Novo token'}</SheetTitle>
          </SheetHeader>

          {segredo ? (
            <div className="mt-6 space-y-4">
              <Aviso tom="warning">
                <strong>Copie agora.</strong> Este token não volta a ser exibido — o servidor guarda
                só o hash. Se perder, revogue e crie outro.
              </Aviso>

              <div className="space-y-1.5">
                <Label>Seu token</Label>
                <div className="flex gap-2">
                  <Input readOnly value={segredo} className="tabular font-mono text-xs" />
                  <Button variant="outline" onClick={copiar}>
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Como usar</Label>
                <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 text-[11px] leading-relaxed">
{`curl -H "X-API-Key: ${segredo}" \\
  ${window.location.origin}/api/dados`}
                </pre>
                <p className="text-xs text-muted-foreground">
                  Também funciona como <code>Authorization: Bearer &lt;token&gt;</code>. A
                  documentação traz um exemplo por rota.
                </p>
              </div>

              <Button className="w-full" onClick={() => { setCriarAberto(false); setSegredo(null); }}>
                Já guardei
              </Button>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome-token">Nome</Label>
                <Input
                  id="nome-token"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: n8n produção"
                />
                <p className="text-xs text-muted-foreground">
                  É como você reconhece este token depois, para saber qual revogar.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Escopo</Label>
                <Select value={escopo} onValueChange={(v) => setEscopo(v as typeof escopo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leitura">Somente leitura (recomendado)</SelectItem>
                    <SelectItem value="escrita">Leitura e escrita</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {escopo === 'leitura'
                    ? 'Só GET. Qualquer tentativa de gravar é recusada com 403.'
                    : 'Pode criar, alterar e apagar — dentro do que o seu papel já permite.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Validade</Label>
                <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS.map((d) => (
                      <SelectItem key={d.valor} value={String(d.valor)}>{d.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {escopo === 'escrita' && (
                <Aviso tom="warning">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  Um token de escrita altera dados de verdade. Use somente leitura quando a
                  integração só consulta.
                </Aviso>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setCriarAberto(false)}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={criar}
                  disabled={criando || nome.trim().length < 3}
                >
                  {criando ? 'Criando…' : 'Criar token'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={aRevogar !== null} onOpenChange={(v) => !v && setARevogar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar o token {aRevogar?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele para de funcionar imediatamente, e quem estiver usando recebe 401. O registro fica
              na lista, marcado como revogado, para a trilha de auditoria. Não dá para reativar —
              crie outro se precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={revogar}>Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Um token com data de validade vencida já não autentica, mesmo ativo. */
function expirado(t: TokenPublico): boolean {
  return t.expira_em !== null && t.expira_em < new Date().toISOString();
}
