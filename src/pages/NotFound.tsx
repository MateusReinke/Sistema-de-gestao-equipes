import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const { pathname } = useLocation();

  useEffect(() => {
    console.error('404 — rota inexistente:', pathname);
  }, [pathname]);

  return (
    <div className="brand-glow flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6 text-center">
      <Logo tamanho="lg" />
      <div>
        <p className="font-display text-6xl font-extrabold tracking-tight text-primary">404</p>
        <h1 className="mt-2 font-display text-xl font-bold">Página não encontrada</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          O endereço <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{pathname}</code> não
          existe nesta central.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Voltar ao Portal RH</Link>
      </Button>
    </div>
  );
}
