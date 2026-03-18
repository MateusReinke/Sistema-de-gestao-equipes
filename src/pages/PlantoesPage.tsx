import { useState, useMemo } from 'react';
import { plantoes, colaboradores, ferias } from '@/data/mock';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const diasSemanaHeader = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function PlantoesPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [year, month]);

  const fmt = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const feriasAprovadas = ferias.filter(f => f.status === 'aprovado');
  const isEmFerias = (colabId: string, dateStr: string) =>
    feriasAprovadas.some(f => f.colaborador_id === colabId && f.data_inicio <= dateStr && f.data_fim >= dateStr);

  const tipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'diurno': return 'default';
      case 'noturno': return 'secondary';
      case 'comercial': return 'outline';
      default: return 'destructive';
    }
  };

  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Plantões</h1>
        <p className="text-sm text-muted-foreground">Visualização mensal dos plantões</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-lg capitalize">{monthName}</CardTitle>
            <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {diasSemanaHeader.map(d => (
              <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className="bg-card p-2 min-h-[80px]" />;
              const dateStr = fmt(day);
              const dayPlantoes = plantoes.filter(p => p.data === dateStr);
              const today = new Date();
              const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

              return (
                <div key={dateStr} className={`bg-card p-1.5 min-h-[80px] ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}>
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day}</p>
                  <div className="space-y-0.5">
                    {dayPlantoes.slice(0, 3).map(p => {
                      const colab = colaboradores.find(c => c.id === p.colaborador_id);
                      const emFeriasFlag = isEmFerias(p.colaborador_id, dateStr);
                      return (
                        <div
                          key={p.id}
                          className={`text-[10px] px-1 py-0.5 rounded truncate ${emFeriasFlag ? 'bg-muted line-through text-muted-foreground' : ''}`}
                          title={`${colab?.nome} · ${p.hora_inicio}–${p.hora_fim} (${p.tipo})${emFeriasFlag ? ' ⚠️ EM FÉRIAS' : ''}`}
                        >
                          <Badge variant={tipoBadge(p.tipo)} className="text-[9px] px-1 py-0 h-auto mr-0.5">
                            {p.tipo[0].toUpperCase()}
                          </Badge>
                          {colab?.nome.split(' ')[0]}
                        </div>
                      );
                    })}
                    {dayPlantoes.length > 3 && (
                      <p className="text-[9px] text-muted-foreground">+{dayPlantoes.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
