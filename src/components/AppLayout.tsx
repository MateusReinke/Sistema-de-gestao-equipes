import { Search } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { PaletaComandos } from '@/components/PaletaComandos';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar } from '@/components/comum';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { PAPEL } from '@/lib/labels';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { sessao, papel } = useAuth();

  /** Dispara a paleta pelo botão, reaproveitando o mesmo atalho do teclado. */
  const abrirBusca = () =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-card/85 px-3 backdrop-blur sm:px-4">
            <SidebarTrigger />

            <Button
              variant="outline"
              size="sm"
              onClick={abrirBusca}
              className="ml-1 hidden h-8 gap-2 text-muted-foreground sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Buscar...</span>
              <kbd className="ml-2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                Ctrl K
              </kbd>
            </Button>

            <div className="flex-1" />

            <ThemeToggle />

            {sessao && (
              <div className="flex items-center gap-2 pl-1">
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-medium leading-tight">{sessao.funcionario.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{papel ? PAPEL[papel] : ''}</p>
                </div>
                <Avatar nome={sessao.funcionario.nome} tamanho="sm" />
              </div>
            )}
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="mx-auto w-full max-w-[1400px] animate-fade-in">{children}</div>
          </main>
        </div>
      </div>
      <PaletaComandos />
    </SidebarProvider>
  );
}
