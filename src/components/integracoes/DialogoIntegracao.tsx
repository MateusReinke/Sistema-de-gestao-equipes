/**
 * Cadastro de uma integração.
 *
 * O formulário não é escrito à mão: sai do catálogo (`src/lib/integracoes.ts`),
 * o mesmo que a API usa para validar. Um tipo novo aparece aqui sozinho.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { CATALOGO, TIPOS, definicao, validarIntegracao, type TipoIntegracao } from '@/lib/integracoes';
import { Aviso, CampoForm } from '@/components/comum';
import { CampoSenha } from '@/components/auth/CampoSenha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Integracao } from '@/data/integracoes';

type Valores = Record<string, string | number | undefined>;

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  /** Ausente significa cadastro novo. */
  editando?: Integracao | null;
  salvando: boolean;
  erroDoServidor?: string | null;
  camposComErro?: Record<string, string>;
  aoSalvar: (dados: {
    tipo: TipoIntegracao;
    nome: string;
    descricao: string;
    valores: Valores;
  }) => void;
}

export function DialogoIntegracao({
  aberto,
  aoFechar,
  editando,
  salvando,
  erroDoServidor,
  camposComErro,
  aoSalvar,
}: Props) {
  const [tipo, setTipo] = useState<TipoIntegracao>('zabbix');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valores, setValores] = useState<Valores>({});
  const [tocado, setTocado] = useState(false);

  // Reabrir o diálogo precisa recomeçar do registro atual, não do anterior.
  useEffect(() => {
    if (!aberto) return;
    setTocado(false);

    if (editando) {
      setTipo(editando.tipo);
      setNome(editando.nome);
      setDescricao(editando.descricao);
      // Segredos não voltam do servidor: os campos ficam em branco, e branco
      // significa "mantém o que está gravado".
      setValores({ ...(editando.parametros as Valores) });
    } else {
      setTipo('zabbix');
      setNome('');
      setDescricao('');
      setValores(padroesDe('zabbix'));
    }
  }, [aberto, editando]);

  const def = definicao(tipo);
  const jaGravados = editando?.segredos_gravados ?? [];

  const erros = useMemo(
    () => validarIntegracao(tipo, valores, jaGravados),
    // `jaGravados` é derivado de `editando`, estável entre renderizações.
    [tipo, valores, jaGravados],
  );

  const mostrarErro = (chave: string) =>
    (tocado ? erros[chave] : undefined) ?? camposComErro?.[chave];

  const trocarTipo = (novo: TipoIntegracao) => {
    setTipo(novo);
    // Campos do tipo anterior não se aplicam ao novo.
    setValores(padroesDe(novo));
  };

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    setTocado(true);
    if (Object.keys(erros).length > 0 || !nome.trim()) return;
    aoSalvar({ tipo, nome: nome.trim(), descricao: descricao.trim(), valores });
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? `Editar ${editando.nome}` : 'Nova integração'}</DialogTitle>
          <DialogDescription>{def.descricao}</DialogDescription>
        </DialogHeader>

        <form onSubmit={enviar} className="space-y-4">
          {erroDoServidor && <Aviso tom="destructive">{erroDoServidor}</Aviso>}

          {!editando && (
            <CampoForm rotulo="Sistema">
              {(id) => (
                <Select value={tipo} onValueChange={(v) => trocarTipo(v as TipoIntegracao)}>
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {CATALOGO[t].rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CampoForm>
          )}

          <CampoForm
            rotulo="Nome"
            dica="Como esta conexão aparece nas listas. Ex.: “Zabbix Produção”."
          >
            {(id) => (
              <Input
                id={id}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder={`${def.rotulo} Produção`}
                autoFocus
              />
            )}
          </CampoForm>
          {tocado && !nome.trim() && (
            <p className="-mt-2 text-[11px] text-destructive-strong">Dê um nome à integração.</p>
          )}

          {def.campos.map((campo) =>
            campo.tipo === 'segredo' ? (
              <div key={campo.chave}>
                <CampoSenha
                  rotulo={campo.rotulo}
                  valor={String(valores[campo.chave] ?? '')}
                  aoMudar={(v) => setValores((atual) => ({ ...atual, [campo.chave]: v }))}
                  autoComplete="new-password"
                  placeholder={jaGravados.includes(campo.chave) ? '••••••••' : undefined}
                  dica={
                    jaGravados.includes(campo.chave)
                      ? 'Já cadastrado e cifrado. Deixe em branco para manter.'
                      : campo.dica
                  }
                />
                {mostrarErro(campo.chave) && (
                  <p className="mt-1 text-[11px] text-destructive-strong">
                    {mostrarErro(campo.chave)}
                  </p>
                )}
              </div>
            ) : (
              <div key={campo.chave}>
                <CampoForm rotulo={campo.rotulo} dica={campo.dica}>
                  {(id) => (
                    <Input
                      id={id}
                      type={campo.tipo === 'numero' ? 'number' : 'text'}
                      inputMode={campo.tipo === 'numero' ? 'numeric' : undefined}
                      value={String(valores[campo.chave] ?? '')}
                      onChange={(e) =>
                        setValores((atual) => ({
                          ...atual,
                          [campo.chave]:
                            campo.tipo === 'numero' && e.target.value !== ''
                              ? Number(e.target.value)
                              : e.target.value,
                        }))
                      }
                      placeholder={campo.placeholder}
                    />
                  )}
                </CampoForm>
                {mostrarErro(campo.chave) && (
                  <p className="mt-1 text-[11px] text-destructive-strong">
                    {mostrarErro(campo.chave)}
                  </p>
                )}
              </div>
            ),
          )}

          <CampoForm rotulo="Observação" dica="Opcional. Para quem for mexer nisso depois.">
            {(id) => (
              <Textarea
                id={id}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
              />
            )}
          </CampoForm>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Valores iniciais vindos do catálogo, para o formulário não abrir vazio. */
function padroesDe(tipo: TipoIntegracao): Valores {
  const valores: Valores = {};
  for (const campo of definicao(tipo).campos) {
    if (campo.padrao !== undefined) valores[campo.chave] = campo.padrao;
  }
  return valores;
}
