FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# `npm ci` instala exatamente o que está no lockfile — build reproduzível.
# As devDependencies são necessárias: o Vite e o Tailwind rodam no build.
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
