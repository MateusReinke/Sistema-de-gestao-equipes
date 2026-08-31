import { useMemo, useState } from 'react';
import { Megaphone, Pin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, BadgeStatus, CabecalhoPagina, EstadoVazio } from '@/components/comum';
import { useDados, novoId } from '@/data/store';
import { useAuth } from '@/contexts/AuthContext';
import { agora, formatarDataHora } from '@/lib/date';
import { CATEGORIA_COMUNICADO, CLASSE_CATEGORIA_COMUNICADO } from '@/lib/labels';
import type { CategoriaComunicado, Comunicado } from '@/types/sgo';

export default function ComunicadosPage() {
  const { comunicados, funcionarios, salvarComunicado, removerComunicado } = useDados();
  const { sessao, podeGerenciar } = useAuth();
  const [emEdicao, setEmEdicao] = useState<Comunicado | null>(null);

  /** Fixados primeiro, depois os mais recentes. */
  const ordenados = useMemo(
    () =>
      [...comunicados].sort((a, b) => {
        if (a.fixado !== b.fixado) return a.fixado ? -1 : 1;
        return b.publicado_em.localeCompare(a.publicado_em);
      }),
    [comunicados],
  );

  const abrirNovo = () => {
    if (!sessao) return;
    setEmEdicao({
      id: novoId('cm'),
      titulo: '',
      corpo: '',
      categoria: 'geral',
      autor_id: sessao.funcionario.id,
      publicado_em: agora(),
      fixado: false,
    });
  };

  const salvar = () => {
    if (!emEdicao) return;
    if (emEdicao.titulo.trim().length < 5) return toast.error('Informe um título.');
    if (emEdicao.corpo.trim().length < 10) return toast.error('Escreva o conteúdo do comunicado.');

    salvarComunicado({
      ...emEdicao,
      titulo: emEdicao.titulo.trim(),
      corpo: emEdicao.corpo.trim(),
    });
    toast.success('Comunicado publicado.');
    setEmEdicao(null);
  };

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Mural de comunicados"
        descricao="Avisos do RH e das lideranças para toda a empresa."
        acoes={
          podeGerenciar && (
            <Button onClick={abrirNovo}>
              <Plus className="mr-2 h-4 w-4" /> Novo comunicado
            </Button>
          )
        }
      />

      {ordenados.length === 0 ? (
        <Card className="shadow-card">
          <EstadoVazio
            icone={Megaphone}
            titulo="Nenhum comunicado publicado"
            descricao="Publique um aviso para a equipe."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {ordenados.map((c) => {
            const autor = funcionarios.find((f) => f.id === c.autor_id);
            return (
              <Card key={c.id} className={`shadow-card ${c.fixado ? 'border-primary/40' : ''}`}>
                <CardContent className="space-y-2.5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {c.fixado && <Pin className="h-4 w-4 shrink-0 text-primary" />}
                      <h2 className="font-display text-base font-semibold leading-snug">
                        {c.titulo}
                      </h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <BadgeStatus
                        texto={CATEGORIA_COMUNICADO[c.categoria]}
                        classe={CLASSE_CATEGORIA_COMUNICADO[c.categoria]}
                        className="text-[10px]"
                      />
                      {podeGerenciar && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEmEdicao({ ...c })}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => {
                              removerComunicado(c.id);
                              toast.success('Comunicado removido.');
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {c.corpo}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <Avatar nome={autor?.nome ?? '?'} tamanho="sm" />
                    <span className="text-xs text-muted-foreground">
                      {autor?.nome} · {formatarDataHora(c.publicado_em)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={emEdicao !== null} onOpenChange={(v) => !v && setEmEdicao(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Comunicado</SheetTitle>
          </SheetHeader>
          {emEdicao && (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={emEdicao.titulo}
                  onChange={(e) => setEmEdicao({ ...emEdicao, titulo: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={emEdicao.categoria}
                  onValueChange={(v) =>
                    setEmEdicao({ ...emEdicao, categoria: v as CategoriaComunicado })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORIA_COMUNICADO) as CategoriaComunicado[]).map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORIA_COMUNICADO[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Conteúdo</Label>
                <Textarea
                  rows={7}
                  value={emEdicao.corpo}
                  onChange={(e) => setEmEdicao({ ...emEdicao, corpo: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm">Fixar no topo</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Aparece também no Portal RH.
                  </p>
                </div>
                <Switch
                  checked={emEdicao.fixado}
                  onCheckedChange={(v) => setEmEdicao({ ...emEdicao, fixado: v })}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setEmEdicao(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={salvar}>Publicar</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
