/**
 * Select de equipe com opção de criar uma nova sem sair do formulário.
 *
 * Mesmo problema do departamento: o cadastro de funcionário só lista
 * equipes já existentes, então dar de cara com a base vazia (ou faltando
 * a equipe certa) empacava o cadastro no meio.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CampoForm } from '@/components/comum';
import { useDados, novoId } from '@/data/store';

const NOVA = '__nova__';

interface Props {
  value: string;
  onChange: (id: string) => void;
  /** Departamento da equipe recém-criada, herdado de quem está preenchendo o form. */
  departamentoIdSugerido?: string;
  id?: string;
}

export function SeletorEquipe({ value, onChange, departamentoIdSugerido, id }: Props) {
  const { equipes, salvarEquipe } = useDados();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');

  const fechar = () => {
    setCriando(false);
    setNome('');
  };

  const criar = async () => {
    if (!nome.trim()) return toast.error('Informe o nome da equipe.');

    const equipe = {
      id: novoId('eq'),
      nome: nome.trim(),
      departamento_id: departamentoIdSugerido,
      cobertura_minima: 1,
      ativo: true,
    };

    try {
      await salvarEquipe(equipe);
    } catch {
      return; // erro já avisado pelo contexto de dados
    }

    toast.success('Equipe criada.');
    onChange(equipe.id);
    fechar();
  };

  return (
    <>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === NOVA) {
            setCriando(true);
            return;
          }
          onChange(v);
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {equipes.filter((e) => e.ativo).map((e) => (
            <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={NOVA}>
            <span className="flex items-center gap-1.5 text-primary">
              <Plus className="h-3.5 w-3.5" /> Nova equipe
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={criando} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova equipe</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <CampoForm rotulo="Nome" dica="Departamento, gestor e cobertura mínima dá para ajustar depois, em Equipes.">
              {(campoId) => (
                <Input id={campoId} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
              )}
            </CampoForm>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={fechar}>Cancelar</Button>
            <Button onClick={criar}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
