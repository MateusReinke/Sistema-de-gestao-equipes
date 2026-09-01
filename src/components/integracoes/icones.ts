/**
 * Ícone de cada tipo de integração.
 *
 * Fica separado do catálogo porque `src/lib/integracoes.ts` também roda no
 * servidor, e o servidor não deve importar componentes React. O catálogo
 * guarda só o nome; o mapa daqui resolve para o componente.
 */
import { Activity, LifeBuoy, Plug, Webhook, type LucideIcon } from 'lucide-react';
import { CATALOGO, type TipoIntegracao } from '@/lib/integracoes';

const POR_NOME: Record<string, LucideIcon> = { Activity, LifeBuoy, Webhook };

/** Fallback silencioso seria fácil de não notar; o teste cobre a cobertura. */
export function iconeDe(tipo: TipoIntegracao): LucideIcon {
  return POR_NOME[CATALOGO[tipo].icone] ?? Plug;
}

/** Só para o teste conferir que nenhum tipo caiu no fallback. */
export const NOMES_CONHECIDOS = Object.keys(POR_NOME);
