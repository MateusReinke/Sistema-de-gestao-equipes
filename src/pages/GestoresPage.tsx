import { useMemo, useState } from 'react';
import { Search, UserCog } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, BadgeStatus, CabecalhoPagina, Campo, EstadoVazio } from '@/components/comum';
import { useDados } from '@/data/store';
import { usePendencias } from '@/hooks/usePendencias';
import { formatarTempoDeCasa } from '@/lib/rh';
import { hoje } from '@/lib/date';

/**
 * Gestores derivam de `Equipe.gestor_id` em vez de existirem como cadastro
 * próprio. Antes, um gestor era duplicado em duas tabelas — nome e e-mail
 * podiam divergir do cadastro de funcionário sem que nada acusasse.
 */
export default function GestoresPage() {
  const { equipes, funcionarios, ferias, clientes, atendimentoEquipes } = useDados();
  const { todas: pendencias } = usePendencias();
  const [busca, setBusca] = useState('');
  const hojeIso = hoje();

  const gestores = useMemo(() => {
    const ids = new Set(equipes.filter((e) => e.gestor_id).map((e) => e.gestor_id!));
    return funcionarios
      .filter((f) => ids.has(f.id))
      .map((gestor) => {
        const equipesDele = equipes.filter((e) => e.gestor_id === gestor.id);
        const idsEquipes = new Set(equipesDele.map((e) => e.id));
        const liderados = funcionarios.filter(
          (f) => idsEquipes.has(f.equipe_id) && f.status !== 'desligado' && f.id !== gestor.id,
        );
        const emFerias = liderados.filter((l) =>
          ferias.some(
            (f) =>
              f.funcionario_id === l.id &&
              f.status === 'aprovada' &&
              f.data_inicio <= hojeIso &&
              f.data_fim >= hojeIso,
          ),
        ).length;
        const fila = pendencias.filter(
          (p) => p.equipe_id !== undefined && idsEquipes.has(p.equipe_id),
        ).length;

        return { gestor, equipesDele, liderados, emFerias, fila };
      })
      .sort((a, b) => b.liderados.length - a.liderados.length);
  }, [equipes, funcionarios, ferias, pendencias, hojeIso]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return gestores;
    return gestores.filter((g) => g.gestor.nome.toLowerCase().includes(termo));
  }, [gestores, busca]);

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Gestores"
        descricao="Quem lidera cada equipe, com o time e a fila de aprovação de cada um."
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar gestores..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtrados.length === 0 ? (
        <Card className="shadow-card">
          <EstadoVazio
            icone={UserCog}
            titulo="Nenhum gestor encontrado"
            descricao="Defina o gestor de uma equipe na tela de Equipes."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map(({ gestor, equipesDele, liderados, emFerias, fila }) => (
            <Card key={gestor.id} className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Avatar nome={gestor.nome} tamanho="lg" />
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{gestor.nome}</CardTitle>
                    <p className="truncate text-xs text-muted-foreground">{gestor.cargo}</p>
                    <p className="truncate text-[11px] text-muted-foreground/80">{gestor.email}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { rotulo: 'Liderados', valor: liderados.length },
                    { rotulo: 'De férias', valor: emFerias },
                    { rotulo: 'Na fila', valor: fila },
                  ].map((c) => (
                    <div key={c.rotulo} className="rounded-lg border py-2">
                      <p className="tabular text-lg font-bold leading-none">{c.valor}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{c.rotulo}</p>
                    </div>
                  ))}
                </div>

                <Campo rotulo="Equipes">
                  <div className="mt-1 flex flex-wrap gap-1">
                    {equipesDele.map((e) => {
                      const contas = atendimentoEquipes
                        .filter((a) => a.equipe_id === e.id)
                        .map((a) => clientes.find((c) => c.id === a.cliente_id)?.nome)
                        .filter(Boolean);
                      return (
                        <BadgeStatus
                          key={e.id}
                          texto={contas.length > 0 ? `${e.nome} · ${contas.join(', ')}` : e.nome}
                          classe="bg-primary/10 text-primary border-primary/25"
                          className="text-[10px]"
                        />
                      );
                    })}
                  </div>
                </Campo>

                <Campo rotulo="Tempo de casa">{formatarTempoDeCasa(gestor.data_admissao)}</Campo>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
