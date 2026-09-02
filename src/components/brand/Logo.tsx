import { cn } from '@/lib/utils';

/**
 * Marca da Lumini: três círculos sobrepostos com um círculo branco onde os
 * três se encontram.
 *
 * O SVG fica inline (e não como `<img>`) para herdar tamanho por classe e não
 * piscar em branco durante o carregamento — o mesmo desenho está em
 * `public/logo-mark.svg`, que alimenta o favicon e o cartão de compartilhamento.
 */
export function LogoMarca({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn('h-8 w-8 shrink-0', className)}
      role="img"
      aria-label="Lumini IT Solutions"
    >
      <circle cx="30" cy="22" r="16" fill="#F0645C" />
      <circle cx="40" cy="37" r="17" fill="#F5A623" />
      <circle cx="21" cy="38" r="13" fill="#17A8D8" />
      <circle cx="29" cy="32" r="6.5" fill="#FFFFFF" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Oculta o texto, deixando só a marca — usado na barra lateral recolhida. */
  somenteMarca?: boolean;
  tamanho?: 'sm' | 'md' | 'lg';
}

const TAMANHOS = {
  sm: { marca: 'h-7 w-7', nome: 'text-base', sub: 'text-[9px] tracking-[0.2em]' },
  md: { marca: 'h-9 w-9', nome: 'text-lg', sub: 'text-[10px] tracking-[0.22em]' },
  lg: { marca: 'h-14 w-14', nome: 'text-3xl', sub: 'text-xs tracking-[0.26em]' },
} as const;

/**
 * Logo completa. O wordmark usa `currentColor`, então fica escuro no tema claro
 * e branco sobre a barra lateral — sem precisar de dois arquivos de imagem.
 */
export function Logo({ className, somenteMarca = false, tamanho = 'md' }: LogoProps) {
  const t = TAMANHOS[tamanho];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMarca className={t.marca} />
      {!somenteMarca && (
        <div className="leading-none">
          {/* Como no site: wordmark em minúsculas e assinatura logo abaixo. */}
          <p className={cn('font-display font-bold lowercase tracking-tight', t.nome)}>lumini</p>
          <p className={cn('mt-1 font-semibold uppercase opacity-70', t.sub)}>IT Solutions</p>
        </div>
      )}
    </div>
  );
}
