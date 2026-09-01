import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ErroApi } from '@/data/api';
import { Logo } from '@/components/brand/Logo';
import { Aviso, CampoForm } from '@/components/comum';
import { CampoSenha } from '@/components/auth/CampoSenha';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const DESTAQUES = [
  'Saldo de férias e período concessivo calculados automaticamente',
  'Alerta de furo de escala antes que o plantão aconteça',
  'Fila única de aprovação para os quatro fluxos de solicitação',
  'Trilha de auditoria de toda alteração',
];

export default function LoginPage() {
  const { metodos, carregando, entrarComSenha, entrarComSso } = useAuth();
  const [params] = useSearchParams();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // O callback do SSO devolve o motivo da recusa pela query string.
  const erroDoSso = params.get('erro');

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrarComSenha(email, senha);
      // Não há navegação aqui: com a sessão criada, a rota /login redireciona.
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível entrar. Tente de novo.');
      setSenha('');
      setEnviando(false);
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
              <h2 className="font-display text-lg font-bold">Entrar</h2>

              {(erroDoSso || erro) && (
                <div className="mt-4">
                  <Aviso tom="destructive">{erroDoSso ?? erro}</Aviso>
                </div>
              )}

              {carregando ? (
                <div className="mt-5 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  {metodos.senhaLocal && (
                    <form onSubmit={enviar} className="mt-5 space-y-4">
                      <CampoForm rotulo="E-mail corporativo">
                        {(id) => (
                          <Input
                            id={id}
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="username"
                            autoFocus
                            required
                            placeholder="nome.sobrenome@lumini.com.br"
                          />
                        )}
                      </CampoForm>

                      <CampoSenha
                        rotulo="Senha"
                        valor={senha}
                        aoMudar={setSenha}
                        autoComplete="current-password"
                      />

                      <Button type="submit" className="w-full" disabled={enviando}>
                        {enviando ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando…
                          </>
                        ) : (
                          <>
                            Entrar <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </form>
                  )}

                  {metodos.senhaLocal && metodos.sso && (
                    <div className="my-5 flex items-center gap-3">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        ou
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  {metodos.sso && (
                    <div className={metodos.senhaLocal ? '' : 'mt-5'}>
                      <Button
                        variant={metodos.senhaLocal ? 'outline' : 'default'}
                        className="w-full"
                        onClick={entrarComSso}
                      >
                        <KeyRound className="mr-2 h-4 w-4" />
                        Entrar com a conta corporativa
                      </Button>
                      {!metodos.senhaLocal && (
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                          Esta instalação usa apenas o provedor de identidade da empresa.
                        </p>
                      )}
                    </div>
                  )}

                  {!metodos.senhaLocal && !metodos.sso && (
                    <div className="mt-5">
                      <Aviso tom="warning">
                        Nenhuma forma de entrada está ativa. Suba o servidor com{' '}
                        <code>ALLOW_LOCAL_LOGIN=true</code> para reabrir a senha local e ajustar a
                        configuração em Administração › Autenticação.
                      </Aviso>
                    </div>
                  )}

                  <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
                    Esqueceu a senha ou o acesso está bloqueado? O RH emite uma senha temporária
                    pela tela de administração — o cadastro na central não é automático.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
