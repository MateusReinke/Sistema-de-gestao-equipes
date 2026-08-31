# Compila o front. As devDependencies são necessárias aqui: Vite e Tailwind
# rodam no build.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# O front compilado é servido pela própria API: um container, uma origem, e
# por isso nenhum CORS e nenhum cookie entre domínios.
COPY --from=build /app/dist ./dist

# O servidor roda em TypeScript pelo tsx e importa as regras de negócio de
# src/lib, as mesmas que o front usa — por isso o código-fonte vai na imagem.
COPY server ./server
COPY src ./src
COPY tsconfig.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrar antes de atender: um deploy nunca responde contra schema antigo.
CMD ["sh", "-c", "npx tsx server/db/migrate.ts && npx tsx server/index.ts"]
