## 实时加密聊天（Secure Chat）

一个基于 **Express + Socket.IO** 的轻量级实时聊天应用，支持文本与图片消息，并提供简单的端到端加密体验。已内置 Docker 镜像与 GitHub Actions 工作流，方便一键构建和发布到 Docker Hub。

---

### 功能特性

- **实时聊天**：使用 Socket.IO 实现多人房间广播。
- **文本 + 图片**：支持发送文本消息与图片消息。
- **简单加密支持**：
  - 前端集成 `crypto-js`，可设置「加密密钥」对消息内容加密/解密。
  - 服务器端只转发消息，不持久化存储。
- **基础风控**：
  - 每个连接每分钟最多发送 60 条消息，防止刷屏。
  - 限制单条 Socket 消息大小（默认 500KB）。
  - 请求体大小限制（默认 100KB）防止恶意大请求。
- **生产友好**：
  - 使用 `NODE_ENV=production`、非 root 用户运行。
  - 健康检查 `HEALTHCHECK`，方便在 K8s / Docker 编排中探活。
  - 优雅退出 & 错误处理（SIGINT/SIGTERM、未捕获异常等）。

---

### 本地运行（不使用 Docker）

#### 1. 安装依赖

确保本地已安装 Node.js 18+：

```bash
npm ci
```

或：

```bash
npm install
```

#### 2. 启动服务

```bash
npm start
```

默认监听端口：

- `PORT` 环境变量未设置时：`http://localhost:3000`
- 可通过 `PORT` 环境变量自定义端口，例如：

```bash
PORT=4000 npm start
```

---

### 使用 Docker 运行

#### 1. 本地构建镜像

在仓库根目录执行：

```bash
docker build -t yourname/chat:local .
```

#### 2. 启动容器

```bash
docker run --rm -p 3000:3000 yourname/chat:local
```

访问：

- 浏览器打开 `http://localhost:3000`

支持自定义端口：

```bash
docker run --rm -e PORT=4000 -p 4000:4000 yourname/chat:local
```

---

### 通过 GitHub Actions 自动发布 Docker Hub 镜像

仓库已包含工作流：`/.github/workflows/docker-publish.yml`  
当你在 GitHub 上发布 Release 时，会自动构建并推送镜像到 **Docker Hub**。

#### 1. 准备 Docker Hub 凭据

1. 登录 `hub.docker.com`，在账号设置中创建一个 Access Token。
2. 在 GitHub 仓库中打开：
   - `Settings -> Secrets and variables -> Actions`
3. 新建两个 Repository secret：
   - `DOCKERHUB_USERNAME`：你的 Docker Hub 用户名
   - `DOCKERHUB_TOKEN`：上一步生成的 Access Token

#### 2. 触发构建与推送

1. 打开仓库页面的 **Releases**。
2. 点击 **Create a new release**。
3. 选择或新建一个 tag（建议语义化版本，例如 `v1.0.0`）。
4. 点击 **Publish release**。

GitHub Actions 会：

- 使用对应 tag 的代码构建 Docker 镜像。
- 推送到 Docker Hub：
  - `docker.io/<DOCKERHUB_USERNAME>/<仓库名>:v1.0.0`
  - `docker.io/<DOCKERHUB_USERNAME>/<仓库名>:1.0`
  - `docker.io/<DOCKERHUB_USERNAME>/<仓库名>:latest`

#### 3. 拉取已发布的镜像

假设：

- Docker Hub 用户名：`yourname`
- GitHub 仓库名：`chat`

则镜像为 `yourname/chat`，可以通过以下方式拉取：

```bash
docker pull yourname/chat:latest
docker run --rm -p 3000:3000 yourname/chat:latest
```

---

### 前端使用说明（加密 & 聊天）

1. 打开网页后，在顶部输入框中可设置：
   - **昵称**（可选）：会随消息一起广播显示。
   - **加密密钥**：所有本地发送的消息会用此密钥加密后再发送。
2. 在底部输入框中输入文本消息并发送。
3. 或通过图片按钮选择图片发送。

> 注意：加密为前端实现的简易方案，主要用于演示与基础隐私保护，不适合作为严肃安全场景的唯一防线。

---

### 生产部署建议

- 将本服务部署在反向代理（如 Nginx / Traefik）之后，启用 HTTPS。
- 在 Kubernetes / Swarm 中使用镜像自带的 `HEALTHCHECK` 作为存活探针。
- 如需持久化聊天记录，建议新增独立存储服务（如数据库），并在服务器端增加鉴权与审计。

