# ---- build ----
FROM node:20-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
# 从构建阶段拷贝已编译好的依赖（含 better-sqlite3 原生二进制），再裁剪开发依赖
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:8080/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/server.js"]
