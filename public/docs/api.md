# API da Central de Gestão

Toda a API fala JSON e vive sob `/api`. Há duas formas de se autenticar:

| Forma | Para quem | Como |
| --- | --- | --- |
| **Cookie de sessão** | O navegador, na aplicação | `POST /api/auth/login` |
| **Token de API** | Integrações (n8n, scripts, outro serviço) | `X-API-Key` ou `Authorization: Bearer` |

Esta página é sobre a segunda.

> Nos exemplos, troque `https://gestao-equipes.exemplo.com` pelo endereço da sua
> instalação e `$TOKEN` pelo token que você gerou.

---

## 1. O token vale o que você vale

Um token **não tem permissão própria**. Ele carrega o usuário que o criou, e a
requisição feita com ele passa exatamente pelas mesmas regras de papel e de
equipe que essa pessoa teria navegando na aplicação.

| Papel do dono | O que o token alcança |
| --- | --- |
| `admin` | Tudo: todas as equipes, cadastros, aprovações e administração |
| `rh` | Todas as equipes e pessoas, férias, ausências, acessos, aprovações |
| `gestor` | Só as equipes que ele gerencia — pessoas, escala e aprovações delas |
| `colaborador` | Só os próprios dados e a escala da própria equipe |

O **escopo** do token só reduz esse alcance, nunca amplia:

| Escopo | Efeito |
| --- | --- |
| `leitura` (padrão) | Só `GET`. Qualquer `POST`/`PUT`/`PATCH`/`DELETE` recebe `403` |
| `escrita` | Também grava — dentro do que o papel do dono já permitia |

Um token de administrador com escopo `leitura` não grava nada. Um token de
colaborador com escopo `escrita` continua sem enxergar a folha de outra equipe.

### O que nenhum token faz

Credenciais só se gerenciam por sessão de navegador. Estas rotas recusam token,
de qualquer papel, com `401`:

- `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/senha`
- `GET|PUT /api/admin/auth` e `POST /api/admin/auth/testar` (SSO)
- `POST /api/admin/usuarios/:id/senha`, `.../senha-temporaria`, `.../desbloquear`
- `GET|POST|DELETE /api/tokens` (um token não emite outro)

Verificado contra a API:

```bash
curl -X PUT "$BASE/api/admin/auth" -H "X-API-Key: $TOKEN" \
  -H 'Content-Type: application/json' -d '{}'
# 401 {"erro":"Esta operação mexe em credenciais e exige sessão de navegador
#      — token de API não alcança."}
```

A razão é prática: sem essa fronteira, revogar um token vazado não adiantaria —
quem o tivesse já teria emitido o próximo ou trocado uma senha.

### Criando um token

Pela aplicação, em **Tokens de API** no menu lateral. O segredo aparece **uma
única vez**: o servidor guarda apenas o hash. Se perder, revogue e crie outro.

---

## 2. Autenticação nas chamadas

Os dois cabeçalhos funcionam, escolha um:

```bash
# X-API-Key — mais simples de configurar no n8n
curl -H "X-API-Key: $TOKEN" \
  https://gestao-equipes.exemplo.com/api/dados

# Authorization: Bearer — padrão em clientes HTTP genéricos
curl -H "Authorization: Bearer $TOKEN" \
  https://gestao-equipes.exemplo.com/api/dados
```

Guarde o token numa variável de ambiente, nunca no corpo do script:

```bash
export TOKEN='lumini_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
export BASE='https://gestao-equipes.exemplo.com'
```

---

## 3. Rotas

### 3.1 Saúde

Sem autenticação — serve para o monitor saber se a aplicação está de pé.

```bash
curl "$BASE/api/saude"
```

```json
{ "ok": true, "ambiente": "production" }
```

### 3.2 Quem sou eu

Confere qual usuário o token representa e o que ele alcança. É a primeira
chamada a fazer quando algo dá `403` e você não entende por quê.

```bash
curl -H "X-API-Key: $TOKEN" "$BASE/api/auth/me"
```

```json
{
  "usuario": { "id": "u1", "email": "helena.braga@lumini.com.br", "role": "admin" },
  "funcionario": { "id": "f01", "nome": "Helena Braga", "equipe_id": "eq6" },
  "papel": "admin",
  "ehRh": true,
  "equipesVisiveis": null,
  "token": { "id": "tok_…", "nome": "n8n produção", "escopo": "escrita" }
}
```

`equipesVisiveis: null` quer dizer "todas". Um token de colaborador responde
assim, com o recorte da equipe dele:

```json
{ "papel": "colaborador", "ehRh": false, "equipesVisiveis": ["eq1"] }
```

O bloco `token` só aparece quando a chamada veio por token — é como a
integração confirma qual credencial está em uso e com que escopo.

### 3.3 Carga de dados

`GET /api/dados` devolve, numa resposta só, tudo o que a aplicação usa para
montar as telas — já recortado pelo alcance do token.

```bash
curl -H "X-API-Key: $TOKEN" "$BASE/api/dados?de=2026-09-01&ate=2026-09-30"
```

| Parâmetro | Padrão | Para quê |
| --- | --- | --- |
| `de`, `ate` | mês corrente ±1 | Janela dos plantões devolvidos |

```json
{
  "janelaPlantoes": { "de": "2026-09-01", "ate": "2026-09-30" },
  "departamentos": [ … ],
  "equipes": [ { "id": "eq3", "nome": "NOC 24x7", "cobertura_minima": 1 } ],
  "funcionarios": [ … ],
  "tiposTurno": [ … ],
  "escalaPosicoes": [ … ],
  "escalaCelulas": [ … ],
  "escalaExcecoes": [ … ],
  "plantoes": [ … ],
  "ferias": [ … ],
  "ausencias": [ … ]
}
```

Extrair só o que interessa com `jq`:

```bash
curl -sH "X-API-Key: $TOKEN" "$BASE/api/dados" \
  | jq '.equipes[] | {id, nome, cobertura_minima}'
```

### 3.4 Escala

A escala é da **equipe**: cada `escalaPosicao` é uma vaga com a própria grade
de ciclo (`escalaCelulas`), e o funcionário é quem ocupa a vaga. Posição sem
ocupante é uma brecha — e continua aparecendo, de propósito.

**Ver as posições de uma equipe:**

```bash
curl -sH "X-API-Key: $TOKEN" "$BASE/api/dados" \
  | jq '[.escalaPosicoes[] | select(.equipe_id == "eq3")]'
```

```json
[
  { "id": "ep08", "nome": "NOC Diurno 1", "funcionario_id": "f11", "inicio_em": "2026-01-04" },
  { "id": "ep10", "nome": "NOC Noturno 2", "funcionario_id": null,  "inicio_em": "2026-01-04" }
]
```

**Achar as vagas abertas de todas as equipes** — o alerta que interessa à
operação:

```bash
curl -sH "X-API-Key: $TOKEN" "$BASE/api/dados" \
  | jq '[.escalaPosicoes[] | select(.funcionario_id == null) | {nome, equipe_id}]'
```

**Trocar o ciclo inteiro de uma posição** (escopo `escrita`, papel `rh` ou
`admin`). A grade chega inteira e substitui a anterior numa transação só —
`semana` é 1-based e `dia_semana` vai de 0 (domingo) a 6 (sábado):

```bash
curl -X PUT "$BASE/api/posicoes/ep08/ciclo" \
  -H "X-API-Key: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inicio_em": "2026-01-04",
    "celulas": [
      { "semana": 1, "dia_semana": 1, "tipo_turno_id": "tt-eq3-t1" },
      { "semana": 1, "dia_semana": 3, "tipo_turno_id": "tt-eq3-t1" },
      { "semana": 1, "dia_semana": 5, "tipo_turno_id": "tt-eq3-t1" },
      { "semana": 2, "dia_semana": 0, "tipo_turno_id": "tt-eq3-t1" },
      { "semana": 2, "dia_semana": 2, "tipo_turno_id": "tt-eq3-t1" },
      { "semana": 2, "dia_semana": 4, "tipo_turno_id": "tt-eq3-t1" },
      { "semana": 2, "dia_semana": 6, "tipo_turno_id": "tt-eq3-t1" }
    ]
  }'
```

```json
{ "posicao_id": "ep08", "semanas": 2, "celulas": 7 }
```

O ciclo tem o tamanho da última semana preenchida e volta sozinho ao começo.
Atenção a uma regra que vem da planilha de origem: **a semana da `inicio_em` é
a última do ciclo**, e a `Semana 1` é a seguinte.

**Esvaziar a grade sem apagar a vaga:**

```bash
curl -X DELETE "$BASE/api/posicoes/ep08/ciclo" -H "X-API-Key: $TOKEN"
```

**Designar quem ocupa uma posição** (CRUD genérico, veja 3.7):

```bash
curl -X PUT "$BASE/api/escalaPosicoes/ep10" \
  -H "X-API-Key: $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "equipe_id": "eq3", "nome": "NOC Noturno 2",
    "funcionario_id": "f12", "inicio_em": "2026-01-04",
    "ordem": 2, "ativo": true
  }'
```

### 3.5 Plantões

**Gerar os plantões do mês de uma equipe** a partir da escala (escopo
`escrita`, papel `rh` ou `admin`):

```bash
curl -X POST "$BASE/api/equipes/eq3/gerar-plantoes" \
  -H "X-API-Key: $TOKEN" -H "Content-Type: application/json" \
  -d '{ "de": "2026-09-01", "ate": "2026-09-30", "sobrescrever": false }'
```

```json
{ "criados": 38, "atualizados": 0, "pulados": 0, "vagas": 22 }
```

| Campo | O que é |
| --- | --- |
| `criados` | Plantões novos |
| `atualizados` | Já existiam e foram reconciliados com a escala |
| `pulados` | Ajustados à mão — preservados, a menos que `sobrescrever: true` |
| `vagas` | Turnos que a escala prevê mas **ninguém** cobre: posição sem ocupante |

`vagas > 0` é o sinal de brecha: a escala pede gente que não existe.

**Lançar um plantão avulso:**

```bash
curl -X PUT "$BASE/api/plantoes/p-extra-01" \
  -H "X-API-Key: $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "funcionario_id": "f11", "data": "2026-09-15",
    "hora_inicio": "19:00", "hora_fim": "07:00",
    "tipo": "noturno", "status": "previsto",
    "gerado_automaticamente": false
  }'
```

`tipo` aceita `diurno`, `noturno`, `comercial`, `sobreaviso`, `backup` e
`especial`. `status`, `previsto`, `confirmado`, `trocado` e `ausente`.

### 3.6 Automação (`/api/n8n`)

Rotas de leitura que já respondem a pergunta pronta, em vez de devolver tabela
crua para o fluxo cruzar. **Aceitam qualquer token válido** e também as chaves
antigas, criadas por linha de comando.

**Catálogo de equipes** — para mapear nome → id:

```bash
curl -H "X-API-Key: $TOKEN" "$BASE/api/n8n/equipes"
```

```json
[
  {
    "id": "eq3", "nome": "NOC 24x7", "cobertura_minima": 1, "ativo": true,
    "gestor": { "id": "f10", "nome": "Elena Souza", "telefone": "+55 11 90000-0000" }
  }
]
```

**Quem está de plantão numa equipe agora:**

```bash
curl -H "X-API-Key: $TOKEN" "$BASE/api/n8n/equipes/eq3/plantonista"
```

Ou num instante específico (ISO 8601, com fuso):

```bash
curl -H "X-API-Key: $TOKEN" \
  "$BASE/api/n8n/equipes/eq3/plantonista?em=2026-09-15T03:00:00-03:00"
```

```json
{
  "equipe": { "id": "eq3", "nome": "NOC 24x7" },
  "em": "2026-09-15T06:00:00.000Z",
  "plantonistas": [
    {
      "funcionario": { "nome": "Juliana Prado", "telefone": "+55 11 90000-0000" },
      "plantao": { "data": "2026-09-15", "hora_inicio": "19:00", "hora_fim": "07:00" }
    }
  ]
}
```

**Caminho de escalonamento de um cliente** — para quem ligar, em ordem:

```bash
curl -H "X-API-Key: $TOKEN" "$BASE/api/n8n/clientes/c1/escalonamento"
```

**Plantonista de todas as equipes de uma vez** — evita um `GET` por equipe:

```bash
curl -H "X-API-Key: $TOKEN" "$BASE/api/n8n/plantonistas"

# Restringindo a algumas equipes (ids separados por vírgula)
curl -H "X-API-Key: $TOKEN" "$BASE/api/n8n/plantonistas?equipe_id=eq3,eq5"
```

**Carteira de clientes** e o detalhe de um:

```bash
curl -H "X-API-Key: $TOKEN" "$BASE/api/n8n/clientes"
curl -H "X-API-Key: $TOKEN" "$BASE/api/n8n/clientes/c1"
```

**Quem atende um cliente agora** — cruza as equipes que atendem a conta com o
plantão de cada uma:

```bash
curl -H "X-API-Key: $TOKEN" "$BASE/api/n8n/clientes/c1/plantonista"
```

**Cliente pelo id do grupo de WhatsApp** — o caso do bot que recebe a mensagem
e precisa saber de quem é. Responde sempre com uma lista, inclusive vazia: o id
do grupo não é único no banco, e "nenhum cliente" é resposta válida, não erro.

```bash
curl -H "X-API-Key: $TOKEN" \
  "$BASE/api/n8n/clientes/por-grupo/5511999999999-1600000000@g.us"
```

```json
{ "clientes": [ { "id": "c1", "nome": "Aurora Varejo", "gerente_conta": { … } } ] }
```

### 3.7 CRUD genérico

Toda coleção responde no mesmo formato. Ler é pelo `GET /api/dados`; gravar e
apagar, por coleção:

```
PUT    /api/:colecao/:id     cria ou atualiza (o id da URL manda)
DELETE /api/:colecao/:id     remove
```

Coleções e quem pode gravar nelas:

| Coleção | Escrita exige |
| --- | --- |
| `departamentos`, `equipes`, `funcionarios`, `clientes`, `contatosCliente`, `niveisEscalonamento`, `servicos`, `servicosContratados`, `atendimentoEquipes`, `avaliacoesCliente`, `tiposTurno`, `escalaPosicoes`, `escalaCelulas`, `escalaExcecoes`, `plantoes`, `sistemas`, `comunicados` | papel `rh` ou `admin` |
| `usuarios` | papel `admin` |
| `ferias`, `ausencias`, `solicitacoesAcesso`, `trocasPlantao` | o próprio, ou alguém da sua equipe se for gestor; `rh`/`admin` em qualquer um |
| `auditoria` | ninguém — só leitura |

```bash
# Criar uma equipe
curl -X PUT "$BASE/api/equipes/eq-noc-2" \
  -H "X-API-Key: $TOKEN" -H "Content-Type: application/json" \
  -d '{ "nome": "NOC Turno B", "departamento_id": "dep3",
        "cobertura_minima": 1, "ativo": true }'

# Pedir férias para si (qualquer papel)
curl -X PUT "$BASE/api/ferias/fe-2026-001" \
  -H "X-API-Key: $TOKEN" -H "Content-Type: application/json" \
  -d '{ "protocolo": "FER-2026-001", "funcionario_id": "f11",
        "status": "pendente", "solicitado_por": "f11",
        "solicitado_em": "2026-09-12T10:00:00.000Z",
        "periodo_aquisitivo_inicio": "2025-01-01",
        "periodo_aquisitivo_fim": "2025-12-31",
        "data_inicio": "2026-12-01", "data_fim": "2026-12-30",
        "dias": 30, "dias_abono": 0, "decimo_terceiro_antecipado": false }'

# Apagar
curl -X DELETE "$BASE/api/equipes/eq-noc-2" -H "X-API-Key: $TOKEN"
```

O `PUT` valida o corpo inteiro contra o schema da tabela: campo faltando ou com
tipo errado volta `400` com a lista do que está errado.

### 3.8 Aprovações

```bash
curl -X POST "$BASE/api/solicitacoes/ferias/fe-2026-001/decidir" \
  -H "X-API-Key: $TOKEN" -H "Content-Type: application/json" \
  -d '{ "status": "aprovada", "observacao": "Cobertura combinada com o Bruno." }'
```

Tipos: `ferias`, `ausencia`, `acesso`, `troca`. Status: `aprovada`,
`rejeitada`, `cancelada`, `concluida`. Exige papel `rh`, `admin` ou gestor da
equipe de quem pediu.

---

## 4. Erros

| Código | Quando | O que fazer |
| --- | --- | --- |
| `400` | Corpo inválido | Ler `detalhes`, que lista campo a campo |
| `401` | Token ausente, inválido, revogado ou expirado | Gerar outro em **Tokens de API** |
| `401` | Rota de credencial chamada com token | Não há como: use o navegador |
| `403` | Papel insuficiente | Conferir com `GET /api/auth/me` |
| `403` | Token de escopo `leitura` tentando gravar | Emitir um token de escrita |
| `404` | Registro ou coleção inexistente | Conferir o id |
| `409` | Violação de unicidade ou de chave estrangeira | Ver a mensagem |
| `422` | Regra de negócio (ex.: férias fora da CLT) | Ver `erro` e `detalhes` |
| `429` | Mais de 120 requisições por minuto no mesmo token | Esperar um minuto |

O corpo do erro é sempre o mesmo formato:

```json
{ "erro": "Só o RH pode alterar este cadastro." }
```

```json
{
  "erro": "Dados inválidos.",
  "detalhes": ["nome: Required", "cobertura_minima: Expected number"]
}
```

---

## 5. O mesmo pedido, tokens diferentes

Vale ver o efeito do papel e do escopo numa chamada só. Os blocos abaixo são
respostas reais da API, com três tokens: um de administrador com escopo de
escrita, um de administrador **somente leitura**, e um de colaborador com
escopo de escrita.

**Leitura — o recorte por papel aparece no volume de dados:**

```bash
curl -sH "X-API-Key: $TOKEN_ADMIN" "$BASE/api/dados" \
  | jq '{funcionarios: (.funcionarios|length), ferias: (.ferias|length)}'
# { "funcionarios": 20, "ferias": 70 }

curl -sH "X-API-Key: $TOKEN_COLABORADOR" "$BASE/api/dados" \
  | jq '{funcionarios: (.funcionarios|length), ferias: (.ferias|length)}'
# { "funcionarios": 20, "ferias": 13 }
```

O cadastro básico de colegas é visível a todos — nomes aparecem em escala e
aprovação. O que é sensível, não: o colaborador enxerga 13 registros de férias
(os dele e os da equipe dele), não os 70.

**Escrita — a mesma chamada, três respostas:**

```bash
CORPO='{"nome":"Equipe Teste","departamento_id":"dep1","cobertura_minima":1,"ativo":true}'

curl -X PUT "$BASE/api/equipes/eq-teste" -H "X-API-Key: $TOKEN_ADMIN" \
  -H 'Content-Type: application/json' -d "$CORPO"
# 200 — administrador com escopo de escrita

curl -X PUT "$BASE/api/equipes/eq-teste" -H "X-API-Key: $TOKEN_ADMIN_LEITURA" \
  -H 'Content-Type: application/json' -d "$CORPO"
# 403 {"erro":"Este token é somente leitura. Gere um token com escopo de
#      escrita para esta operação."}

curl -X PUT "$BASE/api/equipes/eq-teste" -H "X-API-Key: $TOKEN_COLABORADOR" \
  -H 'Content-Type: application/json' -d "$CORPO"
# 403 {"erro":"Só o RH pode alterar este cadastro."}
```

As duas recusas são diferentes de propósito: a primeira é do escopo do token, a
segunda é do papel do dono. Saber qual delas veio diz o que fazer — emitir um
token de escrita, ou pedir a alguém com o papel certo.

**Revogação tem efeito imediato:**

```bash
# Em Tokens de API, revogar. Na chamada seguinte:
curl -s -o /dev/null -w '%{http_code}\n' -H "X-API-Key: $TOKEN_REVOGADO" "$BASE/api/dados"
# 401
```

---

## 6. Receitas

**Alertar quando alguma equipe ficar descoberta hoje:**

```bash
curl -sH "X-API-Key: $TOKEN" "$BASE/api/n8n/equipes" \
  | jq -r '.[] | select(.ativo) | .id' \
  | while read -r equipe; do
      total=$(curl -sH "X-API-Key: $TOKEN" \
        "$BASE/api/n8n/equipes/$equipe/plantonista" | jq '.plantonistas | length')
      [ "$total" -eq 0 ] && echo "SEM PLANTONISTA: $equipe"
    done
```

**Gerar o mês que vem para todas as equipes** (token de escrita, papel `rh`):

```bash
PROXIMO=$(date -d "$(date +%Y-%m-01) +1 month" +%Y-%m)
curl -sH "X-API-Key: $TOKEN" "$BASE/api/n8n/equipes" \
  | jq -r '.[] | select(.ativo) | .id' \
  | while read -r equipe; do
      curl -sX POST "$BASE/api/equipes/$equipe/gerar-plantoes" \
        -H "X-API-Key: $TOKEN" -H "Content-Type: application/json" \
        -d "{\"de\":\"$PROXIMO-01\",\"ate\":\"$(date -d "$PROXIMO-01 +1 month -1 day" +%F)\"}" \
        | jq --arg e "$equipe" '{equipe: $e} + .'
    done
```

**Exportar a escala de uma equipe em CSV:**

```bash
curl -sH "X-API-Key: $TOKEN" "$BASE/api/dados" | jq -r '
  .escalaPosicoes[] | select(.equipe_id == "eq3") |
  [.nome, (.funcionario_id // "VAGA ABERTA"), .inicio_em] | @csv'
```

---

## 7. Boas práticas

- **Um token por integração.** Assim revogar uma não derruba as outras, e o
  campo "último uso" diz qual está viva.
- **Escopo de leitura sempre que der.** A maioria das automações só consulta.
- **Prefira um dono de papel restrito.** Se o fluxo só precisa da escala de uma
  equipe, o token de um gestor basta — não use um de administrador.
- **Validade curta em token de escrita.** Ele vence e obriga a revisão.
- **Nunca no repositório.** Variável de ambiente ou cofre de segredos.
- **Revogue ao desconfiar.** Em **Tokens de API**, o efeito é imediato. O
  registro fica na lista, marcado, para a auditoria.
