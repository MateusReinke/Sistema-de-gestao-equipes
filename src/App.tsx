import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { DadosProvider } from '@/data/store';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/AppLayout';
import type { UserRole } from '@/types/sgo';

import LoginPage from '@/pages/LoginPage';
import TrocarSenhaPage from '@/pages/TrocarSenhaPage';
import NotFound from '@/pages/NotFound';

/**
 * Só o login entra no pacote inicial. As telas internas — inclusive o portal,
 * que carrega a biblioteca de gráficos — vêm sob demanda, para que quem abre a
 * página de entrada não baixe o sistema inteiro.
 */
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const FuncionariosPage = lazy(() => import('@/pages/FuncionariosPage'));
const EquipesPage = lazy(() => import('@/pages/EquipesPage'));
const GestoresPage = lazy(() => import('@/pages/GestoresPage'));
const ClientesPage = lazy(() => import('@/pages/ClientesPage'));
const EscalasPage = lazy(() => import('@/pages/EscalasPage'));
const PlantoesPage = lazy(() => import('@/pages/PlantoesPage'));
const AprovacoesPage = lazy(() => import('@/pages/AprovacoesPage'));
const FeriasPage = lazy(() => import('@/pages/FeriasPage'));
const AusenciasPage = lazy(() => import('@/pages/AusenciasPage'));
const AcessosPage = lazy(() => import('@/pages/AcessosPage'));
const ComunicadosPage = lazy(() => import('@/pages/ComunicadosPage'));
const AuditoriaPage = lazy(() => import('@/pages/AuditoriaPage'));
const AutenticacaoPage = lazy(() => import('@/pages/AutenticacaoPage'));
const IntegracoesPage = lazy(() => import('@/pages/IntegracoesPage'));

const queryClient = new QueryClient();

/** Tela cheia enquanto a sessão é resolvida. */
function TelaCarregando() {
  return (
    <div className="brand-hero grid min-h-screen place-items-center">
      <div className="animate-pulse text-sm text-white/60">Carregando…</div>
    </div>
  );
}

/** Esqueleto exibido enquanto o pedaço da rota é baixado. */
function CarregandoPagina() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

/**
 * Envolve uma rota com sessão obrigatória e, opcionalmente, com restrição de
 * papel. Sem sessão vai para o login; com papel insuficiente volta ao portal,
 * já que o item sequer aparece no menu para esse usuário.
 */
function Protegida({ children, papeis }: { children: React.ReactNode; papeis?: UserRole[] }) {
  const { sessao, papel, carregando } = useAuth();
  // Enquanto a sessão não é resolvida, redirecionar mandaria todo mundo para
  // o login a cada recarga de página.
  if (carregando) return <TelaCarregando />;
  if (!sessao) return <Navigate to="/login" replace />;
  // Senha emitida por outra pessoa: nada mais abre até ser trocada. A API
  // aplica a mesma regra — aqui é só para a pessoa não bater numa parede.
  if (sessao.deveTrocarSenha) return <TrocarSenhaPage />;
  if (papeis && (papel === null || !papeis.includes(papel))) return <Navigate to="/" replace />;
  return (
    <AppLayout>
      <Suspense fallback={<CarregandoPagina />}>{children}</Suspense>
    </AppLayout>
  );
}

const GESTAO: UserRole[] = ['admin', 'rh', 'gestor'];
const RH: UserRole[] = ['admin', 'rh'];
const ADMIN: UserRole[] = ['admin'];

function Rotas() {
  const { sessao, carregando } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={sessao && !carregando ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route path="/" element={<Protegida><DashboardPage /></Protegida>} />
      <Route path="/funcionarios" element={<Protegida papeis={GESTAO}><FuncionariosPage /></Protegida>} />
      <Route path="/equipes" element={<Protegida papeis={GESTAO}><EquipesPage /></Protegida>} />
      <Route path="/gestores" element={<Protegida papeis={RH}><GestoresPage /></Protegida>} />
      <Route path="/clientes" element={<Protegida papeis={GESTAO}><ClientesPage /></Protegida>} />
      <Route path="/escalas" element={<Protegida papeis={GESTAO}><EscalasPage /></Protegida>} />
      <Route path="/plantoes" element={<Protegida><PlantoesPage /></Protegida>} />
      <Route path="/aprovacoes" element={<Protegida papeis={GESTAO}><AprovacoesPage /></Protegida>} />
      <Route path="/ferias" element={<Protegida><FeriasPage /></Protegida>} />
      <Route path="/ausencias" element={<Protegida><AusenciasPage /></Protegida>} />
      <Route path="/acessos" element={<Protegida><AcessosPage /></Protegida>} />
      <Route path="/comunicados" element={<Protegida><ComunicadosPage /></Protegida>} />
      <Route path="/auditoria" element={<Protegida papeis={RH}><AuditoriaPage /></Protegida>} />
      <Route path="/autenticacao" element={<Protegida papeis={ADMIN}><AutenticacaoPage /></Protegida>} />
      <Route path="/integracoes" element={<Protegida papeis={ADMIN}><IntegracoesPage /></Protegida>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={300}>
        <Toaster />
        <Sonner position="top-right" richColors closeButton />
        <BrowserRouter>
          {/* A sessão vem primeiro: a carga de dados depende de estar logado. */}
          <AuthProvider>
            <DadosProvider>
              <Rotas />
            </DadosProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
