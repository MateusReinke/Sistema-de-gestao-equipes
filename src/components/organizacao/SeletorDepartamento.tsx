/**
 * Select de departamento com opção de criar um novo sem sair do formulário.
 *
 * Equipes e funcionários referenciam departamento, mas não havia tela
 * dedicada a cadastrá-los — só o seed vinha com alguns. Sem isso, uma
 * instalação nova ficava sem departamento algum e ambos os formulários
 * empacavam.
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

const NOVO = '__novo__';
const NENHUM = '__nenhum__';

interface Props {
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  /** Quando o vínculo é opcional (equipe), mostra "Sem departamento". */
  permiteVazio?: boolean;
  id?: string;
}

export function SeletorDepartamento({ value, onChange, permiteVazio, id }: Props) {
  const { departamentos, salvarDepartamento } = useDados();
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [sigla, setSigla] = useState('');
  const [centroCusto, setCentroCusto] = useState('');

  const fechar = () => {
    setCriando(false);
    setNome('');
    setSigla('');
    setCentroCusto('');
  };

  const criar = async () => {
    if (!nome.trim()) return toast.error('Informe o nome do departamento.');
    if (!sigla.trim()) return toast.error('Informe a sigla.');
    if (!centroCusto.trim()) return toast.error('Informe o centro de custo.');

    const departamento = {
      id: novoId('dep'),
      nome: nome.trim(),
      sigla: sigla.trim().toUpperCase(),
      centro_custo: centroCusto.trim(),
    };

    try {
      await salvarDepartamento(departamento);
    } catch {
      return; // erro já avisado pelo contexto de dados
    }

    toast.success('Departamento criado.');
    onChange(departamento.id);
    fechar();
  };

  return (
    <>
      <Select
        value={value ?? (permiteVazio ? NENHUM : undefined)}
        onValueChange={(v) => {
          if (v === NOVO) {
            setCriando(true);
            return;
          }
          onChange(v === NENHUM ? undefined : v);
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {permiteVazio && <SelectItem value={NENHUM}>Sem departamento</SelectItem>}
          {departamentos.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={NOVO}>
            <span className="flex items-center gap-1.5 text-primary">
              <Plus className="h-3.5 w-3.5" /> Novo departamento
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={criando} onOpenChange={(v) => !v && fechar()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo departamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <CampoForm rotulo="Nome">
              {(campoId) => (
                <Input id={campoId} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
              )}
            </CampoForm>

            <div className="grid grid-cols-2 gap-3">
              <CampoForm rotulo="Sigla" dica="Até 12 caracteres.">
                {(campoId) => (
                  <Input
                    id={campoId}
                    value={sigla}
                    maxLength={12}
                    onChange={(e) => setSigla(e.target.value)}
                  />
                )}
              </CampoForm>
              <CampoForm rotulo="Centro de custo">
                {(campoId) => (
                  <Input id={campoId} value={centroCusto} onChange={(e) => setCentroCusto(e.target.value)} />
                )}
              </CampoForm>
            </div>
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
