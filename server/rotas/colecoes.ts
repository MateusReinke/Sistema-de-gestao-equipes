/**
 * Registro das coleções expostas pela API.
 *
 * Em vez de escrever um handler por recurso, cada coleção declara sua tabela,
 * quem pode gravar e a validação extra que precisa. As rotas em `crud.ts`
 * atendem todas a partir daqui — acrescentar um recurso é acrescentar uma
 * linha, e nenhuma delas pode "esquecer" de checar permissão.
 */
import { createInsertSchema } from 'drizzle-zod';
import { eq } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '../db/index';
import * as t from '../db/schema';
import { alcancaFuncionario, ehRh, exigir, type Papel } from '../auth/permissoes';
import type { Sessao } from '../auth/sessao';
import { validarFerias } from '@/lib/rh';
import { diasNoIntervalo } from '@/lib/date';

/** Quem pode gravar numa coleção. */
type Escrita =
  /** Apenas RH e administração. */
  | { tipo: 'rh' }
  /** Apenas administração. */
  | { tipo: 'admin' }
  /**
   * O próprio interessado, o gestor da equipe dele ou o RH. Usado nas
   * solicitações, que qualquer pessoa abre para si.
   */
  | { tipo: 'proprio'; campo: 'funcionario_id' };

/**
 * Só o que precisamos de um schema de validação.
 *
 * Descrito estruturalmente, e não como `z.ZodType`: o pacote `drizzle-zod`
 * gera schemas da API v4 do Zod, enquanto o restante do projeto usa a v3, e
 * os dois tipos não se encaixam. O contrato aqui é o mesmo nas duas versões.
 */
interface SchemaValidacao {
  safeParse(valor: unknown):
    | { success: true; data: unknown }
    | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
}

/** Toda tabela exposta pela API tem `id` como chave primária de texto. */
export type TabelaComId = PgTable & { id: AnyPgColumn };

export interface Colecao {
  /** Nome usado na URL e como chave no payload de `/api/dados`. */
  nome: string;
  tabela: TabelaComId;
  entidade: string;
  escrita: Escrita;
  schema: SchemaValidacao;
  rotulo: (item: Record<string, unknown>) => string;
  /** Regras de negócio verificadas antes de gravar. Devolve erros. */
  validar?: (item: Record<string, never>, sessao: Sessao) => Promise<string[]>;
  /** Ajustes colaterais depois de gravar, na mesma requisição. */
  depoisDeSalvar?: (item: Record<string, never>) => Promise<void>;
  /** Coleções que só são lidas, nunca escritas pela API. */
  somenteLeitura?: boolean;
}

/** `createInsertSchema` deriva do schema real, então não há como divergir. */
const de = (tabela: Parameters<typeof createInsertSchema>[0]) => createInsertSchema(tabela).strict();

const nomeDe = (i: Record<string, unknown>) => String(i.nome ?? i.titulo ?? i.protocolo ?? i.id);

export const COLECOES: Colecao[] = [
  /* ------------------------------------------------------------ organização */
  {
    nome: 'departamentos',
    tabela: t.departamentos,
    entidade: 'Departamento',
    escrita: { tipo: 'rh' },
    schema: de(t.departamentos),
    rotulo: nomeDe,
  },
  {
    nome: 'equipes',
    tabela: t.equipes,
    entidade: 'Equipe',
    escrita: { tipo: 'rh' },
    schema: de(t.equipes),
    rotulo: nomeDe,
  },
  {
    nome: 'funcionarios',
    tabela: t.funcionarios,
    entidade: 'Funcionário',
    escrita: { tipo: 'rh' },
    schema: de(t.funcionarios),
    rotulo: nomeDe,
  },
  {
    nome: 'usuarios',
    tabela: t.usuarios,
    entidade: 'Usuário',
    // Conceder papel é o que define quem enxerga a empresa inteira.
    escrita: { tipo: 'admin' },
    schema: de(t.usuarios),
    rotulo: (i) => String(i.email),
  },

  /* --------------------------------------------------------------- clientes */
  {
    nome: 'clientes',
    tabela: t.clientes,
    entidade: 'Cliente',
    escrita: { tipo: 'rh' },
    schema: de(t.clientes),
    rotulo: nomeDe,
  },
  {
    nome: 'contatosCliente',
    tabela: t.contatosCliente,
    entidade: 'Contato do cliente',
    escrita: { tipo: 'rh' },
    schema: de(t.contatosCliente),
    rotulo: nomeDe,
    // Só um contato principal por conta: marcar um desmarca os demais.
    depoisDeSalvar: async (item) => {
      const contato = item as unknown as typeof t.contatosCliente.$inferSelect;
      if (!contato.principal) return;
      await db
        .update(t.contatosCliente)
        .set({ principal: false })
        .where(eq(t.contatosCliente.cliente_id, contato.cliente_id));
      await db
        .update(t.contatosCliente)
        .set({ principal: true })
        .where(eq(t.contatosCliente.id, contato.id));
    },
  },
  {
    nome: 'niveisEscalonamento',
    tabela: t.niveisEscalonamento,
    entidade: 'Escalonamento',
    escrita: { tipo: 'rh' },
    schema: de(t.niveisEscalonamento),
    rotulo: (i) => `N${i.nivel} — ${i.titulo}`,
  },
  {
    nome: 'servicos',
    tabela: t.servicos,
    entidade: 'Serviço',
    escrita: { tipo: 'rh' },
    schema: de(t.servicos),
    rotulo: nomeDe,
  },
  {
    nome: 'servicosContratados',
    tabela: t.servicosContratados,
    entidade: 'Serviço contratado',
    escrita: { tipo: 'rh' },
    schema: de(t.servicosContratados),
    rotulo: (i) => `${i.quantidade} ${i.unidade}`,
  },
  {
    nome: 'atendimentoEquipes',
    tabela: t.atendimentoEquipes,
    entidade: 'Equipe do cliente',
    escrita: { tipo: 'rh' },
    schema: de(t.atendimentoEquipes),
    rotulo: (i) => String(i.escopo || i.id),
  },
  {
    nome: 'avaliacoesCliente',
    tabela: t.avaliacoesCliente,
    entidade: 'Avaliação',
    escrita: { tipo: 'rh' },
    schema: de(t.avaliacoesCliente),
    rotulo: (i) => `Nota ${i.nota}`,
    validar: async (item) => {
      const nota = Number((item as unknown as { nota: number }).nota);
      return nota < 0 || nota > 10 ? ['A nota de NPS vai de 0 a 10.'] : [];
    },
  },

  /* ----------------------------------------------------- escalas e plantões */
  {
    nome: 'escalas',
    tabela: t.escalas,
    entidade: 'Escala',
    escrita: { tipo: 'rh' },
    schema: de(t.escalas),
    rotulo: nomeDe,
  },
  {
    nome: 'escalaDetalhes',
    tabela: t.escalaDetalhes,
    entidade: 'Turno de escala',
    escrita: { tipo: 'rh' },
    schema: de(t.escalaDetalhes),
    rotulo: (i) => `${i.hora_inicio}–${i.hora_fim}`,
  },
  {
    nome: 'escalaFuncionarios',
    tabela: t.escalaFuncionarios,
    entidade: 'Vínculo de escala',
    escrita: { tipo: 'rh' },
    schema: de(t.escalaFuncionarios),
    rotulo: (i) => String(i.id),
  },
  {
    nome: 'plantoes',
    tabela: t.plantoes,
    entidade: 'Plantão',
    escrita: { tipo: 'rh' },
    schema: de(t.plantoes),
    rotulo: (i) => `${i.data} ${i.hora_inicio}`,
    validar: async (item) => {
      const p = item as unknown as typeof t.plantoes.$inferSelect;
      return p.hora_inicio === p.hora_fim
        ? ['Início e fim do turno não podem ser iguais.']
        : [];
    },
  },

  /* ------------------------------------------------------------ solicitações */
  {
    nome: 'ferias',
    tabela: t.ferias,
    entidade: 'Férias',
    escrita: { tipo: 'proprio', campo: 'funcionario_id' },
    schema: de(t.ferias),
    rotulo: (i) => String(i.protocolo),
    /**
     * As mesmas regras de CLT que a tela aplica, agora sobre o banco. É esta
     * verificação que vale: a da tela pode ser contornada chamando a API.
     */
    validar: async (item) => {
      const f = item as unknown as typeof t.ferias.$inferSelect;
      const [funcionarios, todas] = await Promise.all([
        db.select().from(t.funcionarios),
        db.select().from(t.ferias),
      ]);
      const { erros } = validarFerias(
        {
          funcionario_id: f.funcionario_id,
          data_inicio: f.data_inicio,
          data_fim: f.data_fim,
          dias_abono: f.dias_abono ?? 0,
          id: f.id,
        },
        { funcionarios, ferias: todas },
      );
      // O total de dias é derivado, não aceito do cliente.
      if (f.dias !== diasNoIntervalo(f.data_inicio, f.data_fim)) {
        erros.push('Total de dias não confere com o período informado.');
      }
      return erros;
    },
  },
  {
    nome: 'ausencias',
    tabela: t.ausencias,
    entidade: 'Ausência',
    escrita: { tipo: 'proprio', campo: 'funcionario_id' },
    schema: de(t.ausencias),
    rotulo: (i) => String(i.protocolo),
    validar: async (item) => {
      const a = item as unknown as typeof t.ausencias.$inferSelect;
      const erros: string[] = [];
      if (a.data_fim < a.data_inicio) erros.push('A data final não pode ser anterior à inicial.');
      if (a.justificativa.trim().length < 5) erros.push('Descreva a justificativa.');
      return erros;
    },
  },
  {
    nome: 'sistemas',
    tabela: t.sistemas,
    entidade: 'Sistema',
    escrita: { tipo: 'rh' },
    schema: de(t.sistemas),
    rotulo: nomeDe,
  },
  {
    nome: 'solicitacoesAcesso',
    tabela: t.solicitacoesAcesso,
    entidade: 'Acesso',
    escrita: { tipo: 'proprio', campo: 'funcionario_id' },
    schema: de(t.solicitacoesAcesso),
    rotulo: (i) => String(i.protocolo),
    validar: async (item) => {
      const s = item as unknown as typeof t.solicitacoesAcesso.$inferSelect;
      return s.justificativa.trim().length < 10
        ? ['Descreva a justificativa de negócio (mínimo 10 caracteres).']
        : [];
    },
  },
  {
    nome: 'trocasPlantao',
    tabela: t.trocasPlantao,
    entidade: 'Troca de plantão',
    escrita: { tipo: 'proprio', campo: 'funcionario_id' },
    schema: de(t.trocasPlantao),
    rotulo: (i) => String(i.protocolo),
    validar: async (item) => {
      const tr = item as unknown as typeof t.trocasPlantao.$inferSelect;
      const erros: string[] = [];
      if (tr.substituto_id === tr.funcionario_id) {
        erros.push('O substituto precisa ser outra pessoa.');
      }
      if (tr.motivo.trim().length < 5) erros.push('Descreva o motivo da troca.');
      return erros;
    },
  },

  /* ------------------------------------------------------------- comunicação */
  {
    nome: 'comunicados',
    tabela: t.comunicados,
    entidade: 'Comunicado',
    escrita: { tipo: 'rh' },
    schema: de(t.comunicados),
    rotulo: (i) => String(i.titulo),
  },

  /* Trilha de auditoria: escrita apenas pelo próprio servidor. */
  {
    nome: 'auditoria',
    tabela: t.auditoria,
    entidade: 'Auditoria',
    escrita: { tipo: 'admin' },
    schema: de(t.auditoria),
    rotulo: (i) => String(i.descricao),
    somenteLeitura: true,
  },
];

export const colecaoPorNome = new Map(COLECOES.map((c) => [c.nome, c]));

/** Verifica se a sessão pode gravar o item nesta coleção. */
export async function autorizarEscrita(
  colecao: Colecao,
  item: Record<string, unknown>,
  sessao: Sessao,
): Promise<void> {
  exigir(!colecao.somenteLeitura, `${colecao.entidade} não é editável pela API.`);

  switch (colecao.escrita.tipo) {
    case 'admin':
      exigir(sessao.usuario.role === 'admin', 'Só a administração pode alterar este cadastro.');
      return;
    case 'rh':
      exigir(ehRh(sessao), 'Só o RH pode alterar este cadastro.');
      return;
    case 'proprio': {
      const alvo = String(item[colecao.escrita.campo] ?? '');
      exigir(
        await alcancaFuncionario(sessao, alvo),
        'Você só pode abrir solicitações para si ou para a sua equipe.',
      );
      return;
    }
  }
}

/** Papéis que enxergam a coleção inteira sem recorte por equipe. */
export const SEM_RECORTE: Papel[] = ['admin', 'rh'];
