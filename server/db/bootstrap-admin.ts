/**
 * Garante um administrador numa base vazia.
 *
 * Numa instalação nova ninguém entra: não há usuário para o qual emitir
 * senha (o mesmo ovo-e-galinha que `hash-senha.ts` resolve à mão). Este
 * script automatiza a receita manual que estava só no README — roda no
 * start do container, depois das migrations, e só age se a tabela
 * `usuarios` estiver vazia, então repetir em todo deploy não duplica nada.
 *
 * ADMIN_SENHA fica de fora do `.env.example` de propósito: gerar uma
 * temporária e imprimir uma vez só no log é mais seguro que uma senha
 * padrão fixa no código, e `deve_trocar_senha` obriga a troca no primeiro
 * acesso de qualquer forma.
 *
 * Uso:
 *   npm run db:bootstrap-admin
 *   ADMIN_EMAIL=voce@lumini.com.br ADMIN_NOME='Seu Nome' npm run db:bootstrap-admin
 */
import { sql as sqlOp } from 'drizzle-orm';
import { db, sql } from './index';
import * as t from './schema';
import { gerarHash, gerarSenhaTemporaria, validarForcaSenha } from '../auth/senha';

const email = (process.env.ADMIN_EMAIL?.trim() || 'admin@lumini.com.br').toLowerCase();
const nome = process.env.ADMIN_NOME?.trim() || 'Administrador';
const senhaEscolhida = process.env.ADMIN_SENHA?.trim() || undefined;

try {
  const [{ total }] = await db.select({ total: sqlOp<number>`count(*)::int` }).from(t.usuarios);

  if (total > 0) {
    console.log(`Já existe usuário cadastrado (${total}). Bootstrap do admin ignorado.`);
    process.exit(0);
  }

  const senha = senhaEscolhida ?? gerarSenhaTemporaria();
  const erros = validarForcaSenha(senha);
  if (erros.length > 0) {
    console.error('ADMIN_SENHA recusada pela política:');
    for (const erro of erros) console.error(`  · ${erro}`);
    process.exitCode = 1;
  } else {
    const depId = 'dep-bootstrap';
    const eqId = 'eq-bootstrap';
    const funcId = 'func-bootstrap-admin';
    const usuarioId = 'user-bootstrap-admin';

    // Departamento e equipe mínimos: funcionário exige os dois. `onConflictDoNothing`
    // deixa repetir o script sem esbarrar num id que já exista.
    await db
      .insert(t.departamentos)
      .values({ id: depId, nome: 'Administrativo', sigla: 'ADM', centro_custo: 'CC-1' })
      .onConflictDoNothing();

    await db
      .insert(t.equipes)
      .values({ id: eqId, nome: 'Backoffice', cobertura_minima: 0, ativo: true })
      .onConflictDoNothing();

    await db.insert(t.funcionarios).values({
      id: funcId,
      matricula: '000001',
      nome,
      email,
      cargo: 'Administrador',
      departamento_id: depId,
      equipe_id: eqId,
      tipo_contrato: 'clt',
      modelo_trabalho: 'hibrido',
      data_admissao: new Date().toISOString().slice(0, 10),
      data_nascimento: '1990-01-01',
      status: 'ativo',
    });

    // role: 'admin' — acesso full, o mais alto do enum `papel_usuario`.
    await db.insert(t.usuarios).values({
      id: usuarioId,
      funcionario_id: funcId,
      email,
      role: 'admin',
      ativo: true,
      senha_hash: await gerarHash(senha),
      deve_trocar_senha: true,
    });

    console.log('✓ administrador criado:');
    console.log(`  e-mail: ${email}`);
    if (!senhaEscolhida) {
      console.log(`  senha temporária: ${senha}`);
      console.log('  (troca obrigatória no 1º acesso — anote agora, não aparece de novo)');
    }
  }
} catch (erro) {
  console.error('✗ falha ao criar administrador inicial:', erro);
  process.exitCode = 1;
} finally {
  await sql.end();
}
