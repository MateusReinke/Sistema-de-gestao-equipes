import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDados } from '@/data/store';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/comum';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { PAPEL } from '@/lib/labels';

export default function LoginPage() {
  const { entrar } = useAuth();
  const { usuarios, funcionarios } = useDados();
  const [email, setEmail] = useState('helena.braga@lumini.com.br');
  const [senha, setSenha] = useState('demo');
  const [erro, setErro] = useState('');

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const r = entrar(email, senha);
    if (!r.ok) setErro(r.erro ?? 'Não foi possível entrar.');
  };

  /** Entrada rápida por perfil: a demo existe para comparar o que cada papel vê. */
  const entrarComo = (emailDoPerfil: string) => {
    setEmail(emailDoPerfil);
    setErro('');
    const r = entrar(emailDoPerfil, 'demo');
    if (!r.ok) setErro(r.erro ?? 'Não foi possível entrar.');
  };

  return (
    <div className="brand-glow flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          {/* Apresentação */}
          <div className="flex flex-col justify-center">
            <Logo tamanho="lg" />
            <h1 className="mt-7 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Central de <span className="brand-gradient-text">Gestão de Pessoas</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              Funcionários, equipes, escalas e plantões, férias, ausências e solicitações de acesso
              num só lugar — com as regras da CLT verificadas antes de cada aprovação.
            </p>

            <ul className="mt-6 space-y-2">
              {[
                'Saldo de férias e período concessivo calculados automaticamente',
                'Alerta de furo de escala antes que o plantão aconteça',
                'Fila única de aprovação para os quatro fluxos de solicitação',
                'Trilha de auditoria de toda alteração',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Formulário */}
          <Card className="shadow-raised">
            <CardContent className="p-6">
              <h2 className="font-display text-lg font-bold">Entrar</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Ambiente de demonstração — qualquer senha é aceita.
              </p>

              <form onSubmit={enviar} className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail corporativo</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErro('');
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </div>

                {erro && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {erro}
                  </p>
                )}

                <Button type="submit" className="w-full">
                  Entrar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="mt-6">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Acessar como
                </p>
                <div className="space-y-1.5">
                  {usuarios.map((u) => {
                    const pessoa = funcionarios.find((f) => f.id === u.funcionario_id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => entrarComo(u.email)}
                        className="flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition-colors hover:bg-accent/60"
                      >
                        <Avatar nome={pessoa?.nome ?? '?'} tamanho="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{pessoa?.nome}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {PAPEL[u.role]} · {pessoa?.cargo}
                          </p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
