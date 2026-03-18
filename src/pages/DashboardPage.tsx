import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPlantaoAtual, getProximosPlantoes, colaboradores, clientes, equipes, plantoes, ferias } from '@/data/mock';
import { Users, Building2, CalendarDays, Palmtree, Clock, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
  const emPlantao = getPlantaoAtual();
  const proximos = getProximosPlantoes(6);
  const totalAtivos = colaboradores.filter(c => c.ativo).length;
  const totalClientes = clientes.filter(c => c.ativo).length;
  const feriasAtivas = ferias.filter(f => f.status === 'aprovado').length;

  const tipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'diurno': return 'default';
      case 'noturno': return 'secondary';
      case 'comercial': return 'outline';
      default: return 'destructive';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do sistema operacional</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{emPlantao.length}</p>
              <p className="text-xs text-muted-foreground">Em plantão agora</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAtivos}</p>
              <p className="text-xs text-muted-foreground">Colaboradores ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalClientes}</p>
              <p className="text-xs text-muted-foreground">Clientes ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              <Palmtree className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{feriasAtivas}</p>
              <p className="text-xs text-muted-foreground">Férias ativas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plantão Atual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Plantão Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          {emPlantao.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum colaborador em plantão neste momento.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {emPlantao.map(({ colaborador, plantao, cliente }) => (
                <div key={plantao.id} className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-medium text-sm">{colaborador.nome}</p>
                    <Badge variant={tipoBadge(plantao.tipo)}>{plantao.tipo}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{plantao.hora_inicio} – {plantao.hora_fim}</p>
                  {cliente && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Building2 className="inline h-3 w-3 mr-1" />{cliente.nome}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Equipe: {equipes.find(e => e.id === colaborador.equipe_id)?.nome}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Próximos Plantões */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Próximos Plantões
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {proximos.map(p => {
              const colab = colaboradores.find(c => c.id === p.colaborador_id);
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                      <span className="text-xs font-medium">{colab?.nome[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{colab?.nome}</p>
                      <p className="text-xs text-muted-foreground">{p.data} · {p.hora_inicio}–{p.hora_fim}</p>
                    </div>
                  </div>
                  <Badge variant={tipoBadge(p.tipo)} className="text-xs">{p.tipo}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
