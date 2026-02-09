# 使用官方 Node.js 运行时作为基础镜像（Alpine 体积小）
FROM node:20-alpine

# 生产环境，避免 devDependencies 与部分运行时优化
ENV NODE_ENV=production

WORKDIR /app

# 先只复制依赖文件，利用层缓存
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 再复制应用源码
COPY server.js ./
COPY public ./public

# 使用非 root 用户运行（安全最佳实践）
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

# 便于编排系统检测容器健康
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
