# Lumini · Central de Gestão de Pessoas

Central da **Lumini IT Solutions** para gestão de funcionários, equipes, escalas e
plantões, férias, ausências e solicitações de acesso — com apoio direto ao RH.

React 18 + TypeScript + Vite + Tailwind + shadcn/ui.

---

## O que a central faz

| Módulo | O que resolve |
| --- | --- |
| **Portal RH** | Indicadores do dia, alertas de furo de escala, férias em risco, aniversários, headcount por área e mural |
| **Funcionários** | Cadastro completo (cargo, área, gestor, contrato, admissão), ficha com abas, desligamento e exportação |
| **Equipes** | Time, gestor, cliente atendido e **cobertura mínima diária** |
| **Gestores** | Quem lidera cada equipe, com liderados e fila de aprovação |
| **Escalas** | Modelos 12×36, 5×2, 6×1 e personalizados, com carga semanal e vinculados |
| **Plantões** | Calendário mensal, detalhe do dia, escalação avulsa e **troca de turno** |
| **Aprovações** | Fila única para os quatro fluxos de solicitação |
| **Férias** | Saldo, período aquisitivo/concessivo e validação de CLT |
| **Ausências** | Atestados, licenças, faltas e folgas, com impacto na folha e na escala |
| **Acessos** | Concessão, alteração e revogação, com catálogo de sistemas e prazo de expiração |
| **Comunicados** | Mural interno, com itens fixados no Portal |
| **Auditoria** | Trilha de quem alterou o quê e quando |

### Regras de negócio verificadas

As regras ficam em `src/lib/rh.ts` e são cobertas por testes — nenhuma tela
recalcula direito de férias por conta própria.

- **Período aquisitivo e concessivo** (art. 130 e 137 CLT): 30 dias por ano
  trabalhado, a gozar em até 12 meses após o fim do aquisitivo. O sistema
  destaca quem está prestes a vencer e quem já venceu (férias em dobro).
- **Fracionamento** (art. 134 §1º): no máximo 3 períodos, nenhum abaixo de
  5 dias e um deles com pelo menos 14.
- **Abono pecuniário** (art. 143): teto de 10 dias.
- **Conflito de equipe**: avisa quando outra pessoa da mesma equipe já está
  fora no período pedido.
- **Furo de escala**: acusa plantão de quem estará de férias ou afastado, e
  equipe abaixo da cobertura mínima do dia.
- **Acesso temporário vencido**: aponta acessos cuja data de expiração passou
  e que ninguém revogou.

## Papéis de acesso

| Papel | Alcance |
| --- | --- |
| `admin` / `rh` | Toda a empresa; decide qualquer solicitação |
| `gestor` | Somente as equipes que lidera |
| `colaborador` | Somente os próprios registros |

O menu, as listagens e as rotas respeitam o recorte — um colaborador que digitar
`/funcionarios` é devolvido ao Portal.

## Rodando

```bash
npm install
npm run dev          # http://localhost:8080
```

Outros comandos:

```bash
npm run typecheck    # TypeScript sem emitir
npm run lint         # ESLint
npm test             # Vitest
npm run build        # build de produção
npm run icons        # regenera favicon/apple-touch-icon/og-image a partir da logo
```

### Acesso de demonstração

Qualquer senha é aceita. A tela de login lista os perfis para entrada rápida:

| E-mail | Papel |
| --- | --- |
| `helena.braga@lumini.com.br` | Administrador |
| `rafael.antunes@lumini.com.br` | RH |
| `carlos.meireles@lumini.com.br` | Gestor |
| `ana.silva@lumini.com.br` | Colaborador |

## Onde ficam os dados

Não há backend. `src/data/store.tsx` mantém uma base única em `localStorage`
(chave `lumini.central.db`), com CRUD e trilha de auditoria. O seed
(`src/data/seed.ts`) gera plantões e solicitações relativos a *hoje*, para que a
aplicação nunca abra com a agenda vazia.

**Para plugar uma API real**, reimplemente apenas as funções de `store.tsx` — as
telas consomem só o contexto `useDados()` e não sabem de onde os dados vêm.

Para voltar ao estado inicial: **Auditoria → Restaurar dados de exemplo**.
Alterar a estrutura da base exige subir `VERSAO_BASE` em `store.tsx`, o que
descarta a cópia local e recarrega o seed.

## Identidade visual

A marca são os quatro círculos translúcidos da Lumini
(`public/logo-mark.svg`), e as cores do tema derivam deles.

Toda a paleta está em **um lugar só**: o bloco `@layer base` de
`src/index.css`. Trocar os valores de `--brand-*` e das cores semânticas
reveste a aplicação inteira, clara e escura, sem tocar em componente nenhum.
`tailwind.config.ts` apenas aponta para essas variáveis.

Os ícones (`favicon.ico` multi-resolução, `apple-touch-icon.png`,
`og-image.png`) são gerados a partir do SVG com `npm run icons`.

## Estrutura

```
src/
  components/
    brand/Logo.tsx       marca e wordmark (herda a cor do tema)
    comum.tsx            cabeçalho, indicador, avatar, badge, estado vazio
    AppSidebar.tsx       navegação por papel, com contador de pendências
    PaletaComandos.tsx   busca global (Ctrl/⌘ + K)
  contexts/AuthContext   sessão e permissões
  data/
    seed.ts              massa inicial, relativa a hoje
    store.tsx            base única + CRUD + auditoria
  hooks/usePendencias    normaliza os quatro fluxos numa fila só
  lib/
    date.ts              datas de calendário e turnos que viram a meia-noite
    rh.ts                regras de férias, cobertura e indicadores
    labels.ts            rótulos em pt-BR e cores por status
    export.ts            CSV para Excel brasileiro
  pages/                 uma por módulo
```

## Deploy

### Docker Compose

```bash
docker compose up --build -d      # http://localhost:8080
APP_PORT=3000 docker compose up --build -d
```

### Coolify

- **Build Pack**: `Docker Compose`
- **Porta do container**: `80`
- **Serviço**: `web`

`APP_PORT` é opcional e serve a ambientes sem proxy reverso.
