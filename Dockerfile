# 使用官方 Node.js 运行时作为基础镜像（Alpine 体积小）
FROM node:20-alpine AS builder

WORKDIR /app

# 安装所有依赖（包含 devDependencies），用于构建前端
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 构建前端（Vite）
RUN npm run build

FROM node:20-alpine AS runner

# 生产环境，避免 devDependencies 与部分运行时优化
ENV NODE_ENV=production

WORKDIR /app

# 仅安装生产依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 拷贝服务端和前端构建产物
COPY server.js ./
COPY --from=builder /app/dist ./dist

# 使用非 root 用户运行（安全最佳实践）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# 便于编排系统检测容器健康
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
