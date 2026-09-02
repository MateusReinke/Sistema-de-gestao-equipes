# Lumini · Central de Gestão de Pessoas

Central da **Lumini IT Solutions** para gestão de funcionários, equipes, escalas e
plantões, férias, ausências e solicitações de acesso — com apoio direto ao RH.

**Front:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui
**API:** Fastify + Drizzle + PostgreSQL
**Acesso:** senha local, com SSO corporativo (OpenID Connect) configurável pela tela

---

## O que a central faz

| Módulo | O que resolve |
| --- | --- |
| **Portal RH** | Indicadores do dia, alertas de furo de escala, férias em risco, aniversários, headcount por área e mural |
| **Funcionários** | Cadastro completo (cargo, área, gestor, contrato, admissão), ficha com abas, desligamento e exportação |
| **Equipes** | Time, gestor, contas atendidas e **cobertura mínima diária** |
| **Clientes** | Contrato e renovação, contatos, escalonamento próprio, equipes designadas, serviços contratados e satisfação |
| **Gestores** | Quem lidera cada equipe, com liderados e fila de aprovação |
| **Escalas** | Modelos 12×36, 5×2, 6×1 e personalizados, com carga semanal e vinculados |
| **Plantões** | Calendário mensal, detalhe do dia, escalação avulsa e **troca de turno** |
| **Aprovações** | Fila única para os quatro fluxos de solicitação |
| **Férias** | Saldo, período aquisitivo/concessivo e validação de CLT |
| **Ausências** | Atestados, licenças, faltas e folgas, com impacto na folha e na escala |
| **Acessos** | Concessão, alteração e revogação, com catálogo de sistemas e prazo de expiração |
| **Comunicados** | Mural interno, com itens fixados no Portal |
| **Auditoria** | Trilha de quem alterou o quê e quando |

### A ficha do cliente

Cada conta reúne, em cinco abas:

- **Contrato** — razão social, CNPJ, vigência, data de renovação, aviso prévio,
  renovação automática, valor mensal, regime e SLAs de resposta e resolução.
- **Contatos** — pessoas do lado do cliente, com tipo (principal, técnico,
  financeiro, executivo). Só um contato principal por conta.
- **Escalonamento** — trilha própria de cada cliente: quem aciona, em quanto
  tempo, por qual canal e com quais instruções, com o tempo acumulado até cada
  degrau.
- **Operação** — equipes designadas (com escopo e equipe de frente) e serviços
  contratados, com regime e volume.
- **Satisfação** — histórico de NPS registrado pelo gerente de conta, com
  variação entre medições.

A ficha aponta sozinha as **lacunas de cadastro** que travam a operação num
incidente: conta sem contato principal, sem trilha de escalonamento, sem equipe
designada ou sem gerente de conta.

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
- **Renovação de contrato** (`src/lib/clientes.ts`): a partir da vigência e do
  aviso prévio contratado, calcula o prazo-limite para comunicar não-renovação
  e avisa quando ele passou — em contrato com renovação automática, isso
  significa que ele já renovou por omissão.
- **NPS**: 0–6 detrator, 7–8 neutro, 9–10 promotor. A carteira usa a medição
  mais recente de cada conta e o painel destaca contas detratoras e sem
  medição há mais de 180 dias.

## Papéis de acesso

| Papel | Alcance |
| --- | --- |
| `admin` / `rh` | Toda a empresa; decide qualquer solicitação |
| `gestor` | Somente as equipes que lidera |
| `colaborador` | Somente os próprios registros |

O menu, as listagens e as rotas respeitam o recorte — um colaborador que digitar
`/funcionarios` é devolvido ao Portal.

## Rodando

### Com Docker Compose (mais próximo de produção)

```bash
cp .env.example .env      # preencha POSTGRES_PASSWORD e APP_URL
docker compose up --build -d
docker compose exec web npx tsx server/db/seed.ts    # massa inicial, opcional
```

Disponível em `http://localhost:8080` (ajuste com `APP_PORT`).

### Local, sem Docker

Precisa de um PostgreSQL 16 acessível.

```bash
npm install
cp .env.example .env
npm run db:migrate && npm run db:seed

npm run dev:api           # API em :3000
npm run dev               # front em :8080, com proxy de /api para a API
```

### Comandos

```bash
npm run typecheck         # front
npm run typecheck:server  # servidor
npm run lint
npm test                  # 170 testes das regras de negócio, senha e integrações
npm run build
npm run icons             # regenera favicon/apple-touch-icon/og-image
```

### Acesso de demonstração

O seed cria todos os usuários com a mesma senha, `central-demo-2026`. Ela só
existe em base semeada — numa base real o acesso nasce pela tela de
administração, com senha temporária individual.

| E-mail | Papel |
| --- | --- |
| `helena.braga@lumini.com.br` | Administrador |
| `rafael.antunes@lumini.com.br` | RH |
| `carlos.meireles@lumini.com.br` | Gestor |
| `elena.souza@lumini.com.br` | Gestor |
| `ana.silva@lumini.com.br` | Colaborador |

## Arquitetura

```
navegador ──▶ Fastify ──▶ PostgreSQL
              │
              └── dist/ (front compilado)
```

Um container serve o front e a API na **mesma origem**: sem CORS e sem cookie
entre domínios. O Postgres fica num container à parte, com volume próprio.

### As regras vivem num lugar só

`src/lib/rh.ts` e `src/lib/clientes.ts` são importados **pelo front e pelo
servidor**. A tela usa para avisar cedo; a API usa para decidir. Não há duas
implementações da mesma regra para divergirem.

Isso importa porque validação de tela não vale como controle: qualquer um
chama a API direto. O servidor recusa férias de 3 dias, abono acima de 10 e
total de dias que não bate com o período, mesmo que a tela deixe passar.

### Autorização

O papel e o alcance vêm de `/api/auth/me` e orientam o que a interface mostra.
Quem autoriza de fato é a API, em `server/auth/permissoes.ts`:

| Papel | Alcance |
| --- | --- |
| `admin` | Tudo, mais o cadastro de usuários e papéis |
| `rh` | Toda a empresa; decide qualquer solicitação |
| `gestor` | Somente as equipes que lidera |
| `colaborador` | Somente os próprios registros |

O recorte acontece na consulta, não na tela: um colaborador que chame
`/api/dados` recebe as férias da própria equipe, não as de todo mundo.

### Entrada

Duas formas convivem, e quais estão no ar é decidido em **Administração ›
Autenticação**, não por variável de ambiente:

**Senha local.** É como a central começa. O administrador emite uma senha
temporária pela tela, entrega à pessoa, e ela troca no primeiro acesso. As
senhas são guardadas com `scrypt` (N=2¹⁶), parâmetros gravados junto do hash
para poderem ser endurecidos depois sem invalidar o que já existe.

A política de força vive em `src/lib/senha.ts` e é a **mesma** nos dois lados:
o formulário avisa enquanto se digita e a API recusa na gravação. Mínimo de 12
caracteres, sem as campeãs de vazamento e sem o próprio nome ou e-mail — uma
frase curta passa, `Senha@123` não.

Cinco tentativas erradas bloqueiam por 15 minutos, dobrando a cada novo bloco
até um teto de 8 horas. O administrador destrava pela tela. E-mail inexistente
e senha errada devolvem a mesma resposta, no mesmo tempo, para não revelar
quem tem cadastro.

**SSO corporativo.** Fluxo authorization code com PKCE. O provedor autentica;
a central confere o e-mail verificado contra a tabela `usuarios`. **Ter conta
no diretório da empresa não dá acesso** — o cadastro na central é do RH.

Emissor, client id e client secret são cadastrados pela tela. O segredo é
guardado cifrado (AES-256-GCM, chave derivada de `APP_SECRET_KEY`) e nunca
volta em claro: a tela mostra só a máscara. O redirect a registrar no provedor
aparece pronto para copiar, e é `<APP_URL>/api/auth/callback`.

**Trava contra auto-trancamento.** Desligar a senha local só é permitido com o
SSO ativo *e* uma conexão testada com sucesso naquela configuração — mudar o
emissor, o client id ou o segredo derruba a validação. Se ainda assim o
provedor cair, subir com `ALLOW_LOCAL_LOGIN=true` reabre a senha local sem
mexer no banco.

A sessão é um identificador opaco em cookie `httpOnly`; o estado fica no
banco. Apagar a linha em `sessoes` derruba o acesso na hora — é o que o
desligamento faz, junto com desativar o usuário e limpar os plantões futuros.
Trocar ou redefinir a senha encerra as outras sessões da pessoa.

## Integrações

Registro dos sistemas externos, no formato do *media type* do Zabbix: um
catálogo de tipos, cada um declarando os campos que precisa, e um teste de
conexão por tipo. O formulário da tela é **gerado** a partir do catálogo
(`src/lib/integracoes.ts`), que é o mesmo módulo que a API usa para validar —
acrescentar um sistema é acrescentar uma entrada, não uma tela.

| Tipo | Para quê |
| --- | --- |
| Zabbix | Monitoramento. Alimenta as consultas de alerta. |
| GLPI | Service desk: abre sessão pela API REST. |
| Webhook | POST em JSON para Teams, n8n ou automação própria. |

Credencial (token, App-Token, User-Token) é marcada como segredo no catálogo, e
é essa marcação que decide o que vai cifrado (AES-256-GCM) para o banco. A
listagem devolve apenas **quais** chaves estão gravadas, nunca os valores;
campo em branco no formulário significa "mantém o que está lá".

### Consultas de alerta

Uma consulta é um filtro nomeado sobre os problemas do Zabbix — severidade
mínima, grupos de host, tags, reconhecidos ou não — amarrado a um cliente. É o
que responde "como está o ambiente do cliente X".

Quem enxerga cada consulta segue o recorte de sempre: administração e RH veem
todas; o gestor vê as dos clientes atendidos pelas equipes que lidera; o
colaborador não vê nenhuma. Uma consulta fora do alcance responde **404**, não
403 — negar com 403 confirmaria que ela existe.

A opção "liberar para o cliente" marca a consulta como visível ao cliente dono.
A tela de acesso do próprio cliente ainda não existe: hoje a central só tem
usuários internos, e esse é o passo seguinte natural.

### Chamadas para fora

Toda requisição a sistema externo passa por `server/integracoes/http.ts`, que
concentra tempo limite, teto de corpo e a recusa de endereços internos.

Essa última merece explicação. O endereço da integração é digitado por um
administrador, então o servidor faz requisição para onde mandarem — isso é
SSRF. Sem barreira, alguém aponta a "integração" para `169.254.169.254` e usa a
central como proxy para o metadata da nuvem. A verificação roda **a cada salto
de redirecionamento**, porque um host externo pode redirecionar para um
interno, e cobre IPv4 mapeado em IPv6: o Node normaliza
`[::ffff:169.254.169.254]` para `[::ffff:a9fe:a9fe]`, e comparar por prefixo de
texto deixaria passar. Fora de produção a barreira não vale, porque em
desenvolvimento a integração costuma estar no próprio laptop.

## Banco de dados

Schema em `server/db/schema.ts`, espelhando `src/types/sgo.ts` campo a campo.
Os tipos de união do domínio viram enums do Postgres, então um status inválido
é barrado no banco, não só na aplicação.

```bash
npm run db:generate          # gera a migration a partir do schema
npm run db:migrate           # aplica as pendentes
npm run db:seed              # carrega a massa de demonstração
npm run db:seed -- --reset   # apaga tudo e recarrega
npm run senha:hash           # hash de senha, para o primeiro admin
npm run db:studio            # navegador de dados do Drizzle
```

O container roda `db:migrate` antes de atender: um deploy nunca responde
contra schema desatualizado.

### Uma nota sobre volume

`/api/dados` devolve as coleções numa carga só, com **plantões limitados a uma
janela** de 60 dias para trás e 120 para a frente (`?de=&ate=` sobrescreve).
Plantões é a única coleção que cresce sem limite: um ano de operação passa de
3 mil linhas. As demais, na escala desta empresa, cabem numa requisição.
Quando o cadastro crescer muito, é este ponto que precisa virar paginação.

## Identidade visual

Calcada em [luminiitsolutions.com](https://luminiitsolutions.com):

| Elemento | Valor |
| --- | --- |
| Navy da marca | `#0B1B3D` — fundo do hero, barra lateral nos dois temas |
| Âmbar de ação | `#FBB03B` — botões, foco, selos e destaques |
| Azul de apoio | `#2B7FD4` — acentos e informação |
| Botões | Pílula (`rounded-full`), como no site |
| Títulos | Poppins; corpo em Inter, melhor para tabela densa |
| Marca | Círculos translúcidos + wordmark `lumini` em minúsculas |

Uma diferença deliberada: o site usa texto **branco** sobre o âmbar, o que dá
pouco mais de 2:1 de contraste. Num sistema usado o dia inteiro isso cansa,
então os botões aqui usam texto **navy** sobre o âmbar — mais de 7:1, sem sair
da identidade.

Toda a paleta está em **um lugar só**: o bloco `@layer base` de
`src/index.css`. Trocar os valores de `--brand-*` e das cores semânticas
reveste a aplicação inteira, clara e escura, sem tocar em componente nenhum.
`tailwind.config.ts` apenas aponta para essas variáveis.

As cores foram lidas de uma captura do site, então podem estar a um tom do
valor exato — se tiver o CSS ou o guia de marca, é só ajustar essas variáveis.

Os ícones (`favicon.ico` multi-resolução, `apple-touch-icon.png`,
`og-image.png`) são gerados a partir do SVG com `npm run icons`.

## Estrutura

```
server/
  config.ts              variáveis de ambiente, com validação no boot
  app.ts, index.ts       Fastify, tratamento de erro, arquivos estáticos
  auth/
    oidc.ts              fluxo OpenID Connect com PKCE
    sessao.ts            cookie opaco + sessão no banco
    permissoes.ts        autorização — a que vale
  rotas/
    colecoes.ts          registro das coleções: tabela, permissão, validação
    crud.ts              PUT/DELETE genéricos sobre o registro
    dados.ts             carga inicial, recortada por papel
    acoes.ts             decidir solicitação, registrar desligamento
    auth.ts              login por senha, SSO, logout, sessão atual
    administracao.ts     configuração de autenticação e senhas de usuários
    integracoes.ts       sistemas externos e consultas de alerta
  integracoes/
    http.ts              tempo limite, teto de corpo e bloqueio de SSRF
    zabbix.ts            JSON-RPC: versão, grupos de host, problemas
    glpi.ts              sessão da API REST
    index.ts             cifra/decifra segredos e escolhe o cliente
  db/
    schema.ts            schema Drizzle
    migrations/          SQL versionado
    seed.ts, migrate.ts

src/
  components/
    brand/Logo.tsx       marca e wordmark (herda a cor do tema)
    clientes/            ficha da conta com as cinco abas
    comum.tsx            cabeçalho, indicador, avatar, badge, vazio, campo
    AppSidebar.tsx       navegação por papel, com contador de pendências
    PaletaComandos.tsx   busca global (Ctrl/⌘ + K)
  contexts/AuthContext   sessão do servidor e permissões da interface
  data/
    api.ts               cliente HTTP
    store.tsx            useDados() sobre react-query
    seed.ts              massa de demonstração (usada pelo db:seed)
  hooks/usePendencias    normaliza os quatro fluxos numa fila só
  lib/                   ⬅ compartilhado com o servidor
    date.ts              datas de calendário e turnos que viram a meia-noite
    rh.ts                regras de férias, cobertura e indicadores
    clientes.ts          contrato, escalonamento e satisfação
    labels.ts            rótulos em pt-BR e cores por status
    export.ts            CSV para Excel brasileiro
  pages/                 uma por módulo
```

## Deploy

### Variáveis

| Variável | Obrigatória | O que é |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | sim¹ | Senha do Postgres embutido no compose |
| `DATABASE_URL` | sim² | Conexão completa, para banco gerenciado |
| `APP_URL` | **sim** | URL pública real, com `https` |
| `APP_SECRET_KEY` | **sim** | Cifra o client secret do SSO no banco |
| `APP_PORT` | não | Porta no host (padrão `8080`) |
| `SESSION_HOURS` | não | Duração da sessão (padrão `8`) |
| `ALLOW_LOCAL_LOGIN` | não | Reabre a senha local se o SSO cair |
| `POSTGRES_USER` / `POSTGRES_DB` | não | Padrão `lumini` nos dois |
| `OIDC_*` | não | Só semeiam a primeira leitura; depois manda a tela |

¹ no caminho com banco junto · ² no caminho com banco gerenciado

`APP_URL` com `http` faz o servidor **recusar subir** em produção: o cookie de
sessão não é enviado por conexão insegura, e subir assim daria uma tela de
login que nunca autentica. `APP_SECRET_KEY` sai de `openssl rand -base64 48` —
guarde-a, porque trocá-la torna ilegível o client secret do SSO já gravado (a
tela avisa, e basta redigitá-lo).

### Caminho 1 — banco junto, no mesmo compose

É o padrão. Você define só a senha; a `DATABASE_URL` é montada apontando para
o serviço `db`, que guarda os dados no volume `pgdata`.

```bash
POSTGRES_PASSWORD=<senha forte>
APP_URL=https://central.lumini.com.br
APP_SECRET_KEY=<openssl rand -base64 48>
```

### Caminho 2 — Postgres gerenciado

Definir `DATABASE_URL` no ambiente sobrepõe a montagem automática. Use quando
o banco for do Coolify, RDS, Neon ou similar — aí o backup, a réplica e o
upgrade de versão ficam com o provedor, não com você.

```bash
DATABASE_URL=postgres://usuario:senha@host:5432/lumini?sslmode=require
```

Nesse caso o serviço `db` do compose pode ser removido, junto com o
`depends_on` e o volume `pgdata`.

> **Senha com caractere especial** (`@ : / ? #`) precisa vir percent-encoded
> na URL — `@` vira `%40`. Uma senha `sen@ha` gera
> `postgres://lumini:sen@ha@db:5432/lumini`, que não conecta. Vale para os
> dois caminhos.

### Coolify

- **Build Pack**: `Docker Compose`
- **Serviço principal**: `web`
- **Porta do container**: `3000`
- **Variáveis**: as da tabela acima, no painel do Coolify

### Migrations

O container roda `server/db/migrate.ts` **antes** de a API atender, no próprio
`CMD`. Um deploy nunca responde requisição contra schema desatualizado, e não
há passo manual de migração.

O seed **não** roda sozinho — numa base real ele não deve rodar. Para carregar
dados de exemplo em homologação:

```bash
docker compose exec web npx tsx server/db/seed.ts
```

### Backup

Com o banco gerenciado, é do provedor. Com o banco junto, é seu:

```bash
# cópia
docker compose exec -T db pg_dump -U lumini lumini | gzip > backup-$(date +%F).sql.gz

# restauração numa base vazia
gunzip -c backup-2026-09-01.sql.gz | docker compose exec -T db psql -U lumini lumini
```

Vale agendar isso num cron do host. O volume `pgdata` sobrevive a
`docker compose up --build`, mas não a um `docker compose down -v` — essa
flag apaga o volume.

### Primeiro acesso em produção

Numa base vazia ninguém entra: não há usuário para o qual emitir senha. Crie o
primeiro administrador direto no banco e, na linha de `usuarios`, deixe
`deve_trocar_senha` ligado — assim a senha provisória vale para uma entrada só.

```sql
INSERT INTO departamentos (id, nome, sigla, centro_custo)
  VALUES ('dep1', 'Administrativo', 'ADM', 'CC-1');
INSERT INTO equipes (id, nome, cobertura_minima, ativo)
  VALUES ('eq1', 'Backoffice', 0, true);
INSERT INTO funcionarios
  (id, matricula, nome, email, cargo, departamento_id, equipe_id,
   tipo_contrato, modelo_trabalho, data_admissao, data_nascimento, status)
  VALUES ('f1', '000001', 'Nome da Pessoa', 'pessoa@lumini.com.br',
          'Administrador', 'dep1', 'eq1', 'clt', 'hibrido',
          '2020-01-01', '1990-01-01', 'ativo');
INSERT INTO usuarios (id, funcionario_id, email, role, ativo, senha_hash,
                      deve_trocar_senha)
  VALUES ('u1', 'f1', 'pessoa@lumini.com.br', 'admin', true,
          '<hash>', true);
```

O `<hash>` sai daqui — sem argumento o script sorteia uma senha temporária e
mostra as duas:

```bash
docker compose exec web npm run senha:hash
docker compose exec web npm run senha:hash -- 'a-senha-provisoria'
```

Daí em diante tudo é feito pela interface: esse administrador entra, troca a
senha na hora e cadastra o resto do time em **Administração › Autenticação**.

Se depois ligar o SSO, o `email` em `usuarios` precisa ser exatamente o que o
provedor de identidade devolve — é por ele que os dois lados se encontram.
