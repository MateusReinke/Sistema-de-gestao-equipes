# Sistema de Gestão de Equipes

Aplicação web em React + Vite para gestão de equipes, clientes, colaboradores, escalas, plantões e férias.

## Rodando com Docker Compose

### Pré-requisitos
- Docker
- Docker Compose

### Subir a aplicação
```bash
docker compose up --build -d
```

A aplicação ficará disponível em `http://localhost:8080`.

### Alterar a porta publicada
```bash
APP_PORT=3000 docker compose up --build -d
```

## Deploy no Coolify

Este repositório já está preparado para deploy com `docker-compose` no Coolify.

### Configuração sugerida
- **Build Pack / Tipo**: `Docker Compose`
- **Porta exposta pelo container**: `80`
- **Serviço principal**: `web`

Se quiser alterar a porta publicada localmente, use a variável `APP_PORT` ou copie `.env.example` para `.env`. No Coolify, normalmente basta publicar o serviço `web` e deixar o proxy gerenciar o acesso externo; a variável `APP_PORT` é opcional e serve apenas para ambientes sem proxy reverso.

## Desenvolvimento local sem Docker
```bash
npm install
npm run dev
```

## Build de produção
```bash
npm run build
npm run preview
```
