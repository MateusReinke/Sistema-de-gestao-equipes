import {
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileClock,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Palmtree,
  Stethoscope,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/comum';
import { useAuth } from '@/contexts/AuthContext';
import { useDados } from '@/data/store';
import { PAPEL } from '@/lib/labels';
import type { UserRole } from '@/types/sgo';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ItemNav {
  titulo: string;
  url: string;
  icone: LucideIcon;
  /** Papéis que enxergam o item; ausente significa "todos". */
  papeis?: UserRole[];
  /** Nome do contador exibido como selo à direita. */
  contador?: 'aprovacoes';
}

const GRUPOS: { rotulo: string; itens: ItemNav[] }[] = [
  {
    rotulo: 'Visão geral',
    itens: [{ titulo: 'Portal RH', url: '/', icone: LayoutDashboard }],
  },
  {
    rotulo: 'Pessoas',
    itens: [
      { titulo: 'Funcionários', url: '/funcionarios', icone: Users, papeis: ['admin', 'rh', 'gestor'] },
      { titulo: 'Equipes', url: '/equipes', icone: UsersRound, papeis: ['admin', 'rh', 'gestor'] },
      { titulo: 'Gestores', url: '/gestores', icone: UserCog, papeis: ['admin', 'rh'] },
    ],
  },
  {
    rotulo: 'Operação',
    itens: [
      { titulo: 'Escalas', url: '/escalas', icone: CalendarClock, papeis: ['admin', 'rh', 'gestor'] },
      { titulo: 'Plantões', url: '/plantoes', icone: CalendarDays },
      { titulo: 'Clientes', url: '/clientes', icone: Building2, papeis: ['admin', 'rh', 'gestor'] },
    ],
  },
  {
    rotulo: 'Solicitações',
    itens: [
      {
        titulo: 'Aprovações',
        url: '/aprovacoes',
        icone: ClipboardCheck,
        papeis: ['admin', 'rh', 'gestor'],
        contador: 'aprovacoes',
      },
      { titulo: 'Férias', url: '/ferias', icone: Palmtree },
      { titulo: 'Ausências', url: '/ausencias', icone: Stethoscope },
      { titulo: 'Acessos', url: '/acessos', icone: KeyRound },
    ],
  },
  {
    rotulo: 'Empresa',
    itens: [
      { titulo: 'Comunicados', url: '/comunicados', icone: Megaphone },
      { titulo: 'Auditoria', url: '/auditoria', icone: FileClock, papeis: ['admin', 'rh'] },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const recolhida = state === 'collapsed';
  const { sessao, papel, sair } = useAuth();
  const { ferias, ausencias, solicitacoesAcesso, trocasPlantao } = useDados();

  const pendentes =
    ferias.filter((f) => f.status === 'pendente').length +
    ausencias.filter((a) => a.status === 'pendente').length +
    solicitacoesAcesso.filter((s) => s.status === 'pendente').length +
    trocasPlantao.filter((t) => t.status === 'pendente').length;

  const visivel = (item: ItemNav) => !item.papeis || (papel !== null && item.papeis.includes(papel));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <Logo
          somenteMarca={recolhida}
          tamanho="sm"
          className={recolhida ? 'justify-center' : 'text-sidebar-foreground'}
        />
      </SidebarHeader>

      <SidebarContent>
        {GRUPOS.map((grupo) => {
          const itens = grupo.itens.filter(visivel);
          if (itens.length === 0) return null;

          return (
            <SidebarGroup key={grupo.rotulo}>
              {!recolhida && <SidebarGroupLabel>{grupo.rotulo}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {itens.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild tooltip={item.titulo}>
                        <NavLink
                          to={item.url}
                          end={item.url === '/'}
                          className="hover:bg-sidebar-accent/60"
                          activeClassName="bg-sidebar-accent font-medium text-sidebar-primary"
                        >
                          <item.icone className="h-4 w-4 shrink-0" />
                          {!recolhida && <span className="flex-1 truncate">{item.titulo}</span>}
                          {!recolhida && item.contador === 'aprovacoes' && pendentes > 0 && (
                            <Badge className="h-5 min-w-5 justify-center bg-primary px-1.5 text-[10px] text-primary-foreground">
                              {pendentes}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {sessao && !recolhida && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <Avatar nome={sessao.funcionario.nome} tamanho="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-sidebar-foreground">
                {sessao.funcionario.nome}
              </p>
              <p className="truncate text-[10px] text-sidebar-foreground/60">
                {papel ? PAPEL[papel] : ''}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size={recolhida ? 'icon' : 'sm'}
          onClick={sair}
          className="w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          {!recolhida && <span className="ml-2">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
