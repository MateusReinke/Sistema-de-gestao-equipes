/**
 * Campo de senha com mostrar/ocultar e, quando pedido, medidor de força.
 *
 * O medidor usa a mesma política que a API aplica na gravação
 * (`src/lib/senha.ts`), então a tela nunca aprova o que o servidor recusaria.
 */
import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ROTULO_NIVEL, nivelSenha, validarForcaSenha, type ContextoSenha } from '@/lib/senha';

const CORES: Record<string, string> = {
  fraca: 'bg-destructive',
  razoavel: 'bg-warning',
  boa: 'bg-info',
  forte: 'bg-success',
};

const LARGURAS: Record<string, string> = {
  fraca: 'w-1/4',
  razoavel: 'w-2/4',
  boa: 'w-3/4',
  forte: 'w-full',
};

interface Props {
  rotulo: string;
  valor: string;
  aoMudar: (valor: string) => void;
  /** Mostra medidor e lista de pendências enquanto se digita. */
  medirForca?: boolean;
  /** Nome e e-mail de quem terá a senha, para barrar senha com o próprio nome. */
  contexto?: ContextoSenha;
  autoComplete?: string;
  autoFocus?: boolean;
  placeholder?: string;
  dica?: string;
  desabilitado?: boolean;
}

export function CampoSenha({
  rotulo,
  valor,
  aoMudar,
  medirForca = false,
  contexto,
  autoComplete = 'current-password',
  autoFocus,
  placeholder,
  dica,
  desabilitado,
}: Props) {
  const id = useId();
  const idDica = `${id}-dica`;
  const [visivel, setVisivel] = useState(false);

  const nivel = medirForca ? nivelSenha(valor, contexto) : 'vazia';
  const pendencias = medirForca && valor ? validarForcaSenha(valor, contexto) : [];

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visivel ? 'text' : 'password'}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          disabled={desabilitado}
          aria-describedby={dica || pendencias.length > 0 ? idDica : undefined}
          className="pr-10"
        />
        <button
          type="button"
          // Sem tabIndex negativo o botão entra no caminho entre os campos.
          tabIndex={-1}
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {medirForca && nivel !== 'vazia' && (
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full transition-all', CORES[nivel], LARGURAS[nivel])} />
          </div>
          <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
            {ROTULO_NIVEL[nivel]}
          </span>
        </div>
      )}

      <div id={idDica}>
        {pendencias.length > 0 ? (
          <ul className="space-y-0.5">
            {pendencias.map((p) => (
              <li key={p} className="text-[11px] leading-relaxed text-destructive-strong">
                {p}
              </li>
            ))}
          </ul>
        ) : (
          dica && <p className="text-[11px] leading-relaxed text-muted-foreground">{dica}</p>
        )}
      </div>
    </div>
  );
}
