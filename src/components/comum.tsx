/**
 * Blocos de UI repetidos nas telas de listagem e nos painéis.
 *
 * Ficam num arquivo só porque são pequenos, sempre usados juntos e não têm
 * estado — separá-los em um arquivo cada só aumentaria o vaivém de imports.
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { iniciais } from '@/lib/labels';
import type { LucideIcon } from 'lucide-react';

/* --------------------------------------------------------- cabeçalho de página */

interface CabecalhoProps {
  titulo: string;
  descricao?: string;
  /** Botões de ação alinhados à direita. */
  acoes?: React.ReactNode;
}

export function CabecalhoPagina({ titulo, descricao, acoes }: CabecalhoProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- indicador */

interface IndicadorProps {
  rotulo: string;
  valor: React.ReactNode;
  icone: LucideIcon;
  /** Cor semântica do ícone e do seu fundo. */
  tom?: 'primary' | 'success' | 'warning' | 'info' | 'destructive';
  detalhe?: string;
  onClick?: () => void;
}

const TOM_INDICADOR = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success-strong',
  warning: 'bg-warning/10 text-warning-strong',
  info: 'bg-info/10 text-info-strong',
  destructive: 'bg-destructive/10 text-destructive',
} as const;

export function Indicador({
  rotulo,
  valor,
  icone: Icone,
  tom = 'primary',
  detalhe,
  onClick,
}: IndicadorProps) {
  return (
    <Card
      className={cn(
        'shadow-card transition-shadow',
        onClick && 'cursor-pointer hover:shadow-raised',
      )}
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', TOM_INDICADOR[tom])}>
          <Icone className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="tabular text-2xl font-bold leading-tight">{valor}</p>
          <p className="text-xs text-muted-foreground">{rotulo}</p>
          {detalhe && <p className="mt-0.5 text-[11px] text-muted-foreground/80">{detalhe}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ badges */

/** Badge cuja cor vem de um mapa de classes por status (ver `lib/labels`). */
export function BadgeStatus({
  texto,
  classe,
  className,
}: {
  texto: string;
  classe: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('font-medium', classe, className)}>
      {texto}
    </Badge>
  );
}

/* ----------------------------------------------------------------- avatar */

const TAMANHO_AVATAR = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
} as const;

/**
 * Avatar por iniciais. A cor deriva do nome, então a mesma pessoa recebe sempre
 * a mesma cor e a lista fica mais fácil de varrer visualmente.
 */
export function Avatar({
  nome,
  tamanho = 'md',
  className,
}: {
  nome: string;
  tamanho?: keyof typeof TAMANHO_AVATAR;
  className?: string;
}) {
  const paletas = [
    'bg-brand-orange/15 text-brand-orange',
    'bg-brand-blue/15 text-brand-blue',
    'bg-brand-coral/15 text-brand-coral',
    'bg-success/15 text-success-strong',
    'bg-info/15 text-info-strong',
  ];
  const indice = [...nome].reduce((soma, c) => soma + c.charCodeAt(0), 0) % paletas.length;

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        TAMANHO_AVATAR[tamanho],
        paletas[indice],
        className,
      )}
      title={nome}
    >
      {iniciais(nome)}
    </span>
  );
}

/* ------------------------------------------------------------ estado vazio */

export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted">
        <Icone className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{titulo}</p>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

/* ----------------------------------------------------------- campo de form */

/**
 * Rótulo ligado ao controle por `id` gerado.
 *
 * Escrever `<Label>` e `<Input>` como irmãos não os associa: clicar no rótulo
 * não foca o campo e leitores de tela não sabem a que ele se refere. Aqui o id
 * vem de `useId` e é entregue ao controle pelo render prop.
 */
export function CampoForm({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      {children(id)}
      {dica && <p className="text-[11px] text-muted-foreground">{dica}</p>}
    </div>
  );
}

/* -------------------------------------------------------------- utilitários */

/** Rótulo curto acima de um valor, usado nos painéis de detalhe. */
export function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </p>
      <div className="mt-0.5 break-words text-sm">{children}</div>
    </div>
  );
}

/** Faixa de alerta para conflitos e avisos de conformidade. */
export function Aviso({
  tom = 'warning',
  children,
}: {
  tom?: 'warning' | 'destructive' | 'info';
  children: React.ReactNode;
}) {
  const tons = {
    warning: 'border-warning/30 bg-warning/10 text-warning-strong',
    destructive: 'border-destructive/30 bg-destructive/10 text-destructive-strong',
    info: 'border-info/30 bg-info/10 text-info-strong',
  } as const;

  return (
    <div className={cn('rounded-lg border px-3 py-2 text-xs leading-relaxed', tons[tom])}>
      {children}
    </div>
  );
}
