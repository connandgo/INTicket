# 빌드 스테이지
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=inticket-npm-cache,target=/root/.npm,sharing=shared \
    npm ci --prefer-offline --no-audit
COPY . .
RUN npm run build

# 서빙 스테이지
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -q --spider http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
