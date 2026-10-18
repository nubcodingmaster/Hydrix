FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY components ./components
COPY lib ./lib
COPY scripts/analysis-contract.mjs scripts/analysis-contract.d.mts ./scripts/
COPY public ./public
RUN npm run build

FROM nginx:alpine
ENV PORT=8080
ENV NGINX_ENVSUBST_FILTER=PORT
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
