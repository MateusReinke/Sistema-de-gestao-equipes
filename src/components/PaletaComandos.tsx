import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Palmtree,
  Stethoscope,
  UserCog,
  Users,
  UsersRound,
  CalendarClock,
  FileClock,
  Plug,
  ShieldCheck,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useDados } from '@/data/store';

const PAGINAS = [
  { titulo: 'Portal RH', url: '/', icone: LayoutDashboard },
  { titulo: 'Funcionários', url: '/funcionarios', icone: Users },
  { titulo: 'Equipes', url: '/equipes', icone: UsersRound },
  { titulo: 'Gestores', url: '/gestores', icone: UserCog },
  { titulo: 'Escalas', url: '/escalas', icone: CalendarClock },
  { titulo: 'Plantões', url: '/plantoes', icone: CalendarDays },
  { titulo: 'Clientes', url: '/clientes', icone: Building2 },
  { titulo: 'Aprovações', url: '/aprovacoes', icone: ClipboardCheck },
  { titulo: 'Férias', url: '/ferias', icone: Palmtree },
  { titulo: 'Ausências', url: '/ausencias', icone: Stethoscope },
  { titulo: 'Acessos', url: '/acessos', icone: KeyRound },
  { titulo: 'Comunicados', url: '/comunicados', icone: Megaphone },
  { titulo: 'Auditoria', url: '/auditoria', icone: FileClock },
  { titulo: 'Autenticação', url: '/autenticacao', icone: ShieldCheck },
  { titulo: 'Integrações', url: '/integracoes', icone: Plug },
];

/**
 * Busca global por Ctrl/⌘+K.
 *
 * Num sistema com doze telas, procurar uma pessoa clicando em menu é o caminho
 * lento; aqui o nome do funcionário leva direto à ficha dele.
 */
export function PaletaComandos() {
  const [aberta, setAberta] = useState(false);
  const navegar = useNavigate();
  const { funcionarios, equipes, clientes } = useDados();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAberta((v) => !v);
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  const ativos = useMemo(
    () => funcionarios.filter((f) => f.status !== 'desligado').slice(0, 40),
    [funcionarios],
  );

  const ir = (url: string) => {
    setAberta(false);
    navegar(url);
  };

  return (
    <CommandDialog open={aberta} onOpenChange={setAberta}>
      <CommandInput placeholder="Buscar pessoa, equipe, cliente ou tela..." />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Ir para">
          {PAGINAS.map((p) => (
            <CommandItem key={p.url} value={`ir ${p.titulo}`} onSelect={() => ir(p.url)}>
              <p.icone className="mr-2 h-4 w-4" />
              {p.titulo}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Funcionários">
          {ativos.map((f) => (
            <CommandItem
              key={f.id}
              value={`${f.nome} ${f.cargo} ${f.email}`}
              onSelect={() => ir(`/funcionarios?id=${f.id}`)}
            >
              <Users className="mr-2 h-4 w-4" />
              <span className="flex-1">{f.nome}</span>
              <span className="text-xs text-muted-foreground">{f.cargo}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Equipes">
          {equipes.map((e) => (
            <CommandItem key={e.id} value={`equipe ${e.nome}`} onSelect={() => ir('/equipes')}>
              <UsersRound className="mr-2 h-4 w-4" />
              {e.nome}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Clientes">
          {clientes.map((c) => (
            <CommandItem key={c.id} value={`cliente ${c.nome}`} onSelect={() => ir('/clientes')}>
              <Building2 className="mr-2 h-4 w-4" />
              {c.nome}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
