/**
 * Troca obrigatória de senha.
 *
 * Aparece no lugar do sistema quando a senha em uso foi definida por outra
 * pessoa (senha temporária do RH). Enquanto não trocar, não há como navegar —
 * a API também recusaria, então esconder o menu seria só metade da história.
 */
import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ErroApi } from '@/data/api';
import { Logo } from '@/components/brand/Logo';
import { Aviso } from '@/components/comum';
import { CampoSenha } from '@/components/auth/CampoSenha';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TAMANHO_MINIMO_SENHA, validarForcaSenha } from '@/lib/senha';

export default function TrocarSenhaPage() {
  const { sessao, trocarSenha, sair } = useAuth();

  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const contexto = {
    nome: sessao?.funcionario.nome,
    email: sessao?.usuario.email,
  };

  const naoConfere = confirmacao.length > 0 && nova !== confirmacao;
  const pronto =
    atual.length > 0 &&
    nova === confirmacao &&
    confirmacao.length > 0 &&
    validarForcaSenha(nova, contexto).length === 0;

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await trocarSenha(atual, nova);
      toast.success('Senha alterada. As outras sessões foram encerradas.');
      // Sem navegação: com `deveTrocarSenha` falso, o roteador libera o sistema.
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não foi possível trocar a senha.');
      setEnviando(false);
    }
  };

  return (
    <div className="brand-hero flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* O wordmark usa `currentColor`: sem o branco ele some no fundo navy. */}
        <div className="mb-6 flex justify-center text-white">
          <Logo tamanho="md" />
        </div>

        <Card className="shadow-raised">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-brand-amber" />
              <h1 className="font-display text-lg font-bold">Defina a sua senha</h1>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A senha atual foi emitida pela administração, então só você deve conhecer a próxima.
              Escolha uma com pelo menos {TAMANHO_MINIMO_SENHA} caracteres — uma frase curta funciona
              melhor que uma palavra com símbolos.
            </p>

            {erro && (
              <div className="mt-4">
                <Aviso tom="destructive">{erro}</Aviso>
              </div>
            )}

            <form onSubmit={enviar} className="mt-5 space-y-4">
              <CampoSenha
                rotulo="Senha atual"
                valor={atual}
                aoMudar={setAtual}
                autoComplete="current-password"
                autoFocus
              />

              <CampoSenha
                rotulo="Nova senha"
                valor={nova}
                aoMudar={setNova}
                autoComplete="new-password"
                medirForca
                contexto={contexto}
                dica="Evite o seu nome, o seu e-mail e sequências comuns."
              />

              <CampoSenha
                rotulo="Repita a nova senha"
                valor={confirmacao}
                aoMudar={setConfirmacao}
                autoComplete="new-password"
              />

              {naoConfere && <Aviso tom="warning">As duas senhas não são iguais.</Aviso>}

              <Button type="submit" className="w-full" disabled={!pronto || enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…
                  </>
                ) : (
                  'Salvar e entrar'
                )}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => void sair()}
              className="mt-4 w-full text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline"
            >
              Sair e voltar depois
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
