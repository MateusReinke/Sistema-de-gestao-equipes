/**
 * Gera o hash de uma senha, para o INSERT do primeiro administrador.
 *
 * Depois que existe um admin, senha se define pela tela — este script só
 * resolve o ovo-e-galinha da base vazia.
 *
 * Uso:
 *   npm run senha:hash -- 'a-senha-provisoria'
 *   npm run senha:hash              (sorteia uma temporária e mostra as duas)
 */
import { gerarHash, gerarSenhaTemporaria, validarForcaSenha } from '../auth/senha';

const informada = process.argv[2];
const senha = informada ?? gerarSenhaTemporaria();

const erros = validarForcaSenha(senha);
if (erros.length > 0) {
  console.error('Senha recusada pela política:');
  for (const erro of erros) console.error(`  · ${erro}`);
  process.exit(1);
}

console.log(`senha: ${senha}`);
console.log(`hash:  ${await gerarHash(senha)}`);

if (!informada) {
  console.log('\nAnote a senha: ela não é recuperável a partir do hash.');
}
