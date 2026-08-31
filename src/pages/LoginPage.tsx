import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/data/api';
import { Logo } from '@/components/brand/Logo';
import { Avatar, Aviso } from '@/components/comum';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PAPEL } from '@/lib/labels';
import type { UserRole } from '@/types/sgo';

interface Perfil {
  email: string;
  role: UserRole;
  nome: string;
  cargo: string;
}

const DESTAQUES = [
  'Saldo de férias e período concessivo calculados automaticamente',
  'Alerta de furo de escala antes que o plantão aconteça',
  'Fila única de aprovação para os quatro fluxos de solicitação',
  'Trilha de auditoria de toda alteração',
];

export default function LoginPage() {
  const { sso, carregando, entrarComSso, entrarDemonstracao } = useAuth();
  const [params] = useSearchParams();
  const [perfis, setPerfis] = useState<Perfil[] | null>(null);
  const [entrando, setEntrando] = useState<string | null>(null);

  // O callback do SSO devolve o motivo da recusa pela query string.
  const erroDoSso = params.get('erro');

  useEffect(() => {
    if (carregando || sso) return;
    api
      .get<Perfil[]>('/api/auth/demo/perfis')
      .then(setPerfis)
      .catch(() => setPerfis([]));
  }, [carregando, sso]);

  const entrar = async (email: string) => {
    setEntrando(email);
    try {
      await entrarDemonstracao(email);
    } catch {
      toast.error('Não foi possível entrar com este perfil.');
      setEntrando(null);
    }
  };

  return (
    <div className="brand-hero flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          {/* Apresentação */}
          <div className="flex flex-col justify-center text-white">
            <Logo tamanho="lg" />
            <h1 className="mt-7 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Central de <span className="text-brand-amber">Gestão de Pessoas</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70">
              Funcionários, equipes, escalas e plantões, férias, ausências e solicitações de acesso
              num só lugar — com as regras da CLT verificadas antes de cada aprovação.
            </p>

            <ul className="mt-6 space-y-2">
              {DESTAQUES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Entrada */}
          <Card className="shadow-raised">
            <CardContent className="p-6">
              {erroDoSso && (
                <div className="mb-4">
                  <Aviso tom="destructive">{erroDoSso}</Aviso>
                </div>
              )}

              {carregando ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : sso ? (
                <>
                  <h2 className="font-display text-lg font-bold">Entrar</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O acesso usa a sua conta corporativa. Você será levado ao provedor de
                    identidade da Lumini para confirmar quem é.
                  </p>
                  <Button className="mt-6 w-full" onClick={entrarComSso}>
                    Entrar com a conta corporativa <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
                    Sem acesso liberado? O cadastro na central é feito pelo RH — ter conta no
                    diretório da empresa, sozinho, não dá entrada aqui.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-lg font-bold">Entrar</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ambiente de demonstração, sem SSO configurado. Escolha um perfil para ver o
                    sistema pelos olhos dele.
                  </p>

                  <div className="mt-5 space-y-1.5">
                    {perfis === null &&
                      Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}

                    {perfis?.length === 0 && (
                      <Aviso tom="warning">
                        Nenhum usuário cadastrado. Rode <code>npm run db:seed</code> para carregar a
                        massa de demonstração.
                      </Aviso>
                    )}

                    {perfis?.map((p) => (
                      <button
                        key={p.email}
                        type="button"
                        disabled={entrando !== null}
                        onClick={() => entrar(p.email)}
                        className="flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors hover:bg-accent/60 disabled:opacity-60"
                      >
                        <Avatar nome={p.nome} tamanho="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{p.nome}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {PAPEL[p.role]} · {p.cargo}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
