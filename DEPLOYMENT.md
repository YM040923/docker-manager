# Docker 容器管理工具 - 部署指南

## 快速开始

### 前置要求

- Node.js 22.13.0 或更高版本
- Docker 引擎（用于容器管理）
- MySQL 5.7+ 或 TiDB（数据库）
- 访问 `/var/run/docker.sock` 的权限

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 构建生产版本
pnpm build
```

## Docker Compose 部署

### 基础配置

创建 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: docker-manager-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: docker_manager
      MYSQL_USER: docker_manager
      MYSQL_PASSWORD: secure_password
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - docker-manager-network
    ports:
      - "3306:3306"

  docker-manager-ui:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: docker-manager-ui
    restart: always
    ports:
      - "13000:13000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      NODE_ENV: production
      DATABASE_URL: mysql://docker_manager:secure_password@mysql:3306/docker_manager
      JWT_SECRET: your_jwt_secret_key_here
      VITE_APP_ID: your_app_id
      OAUTH_SERVER_URL: https://api.manus.im
      VITE_OAUTH_PORTAL_URL: https://manus.im/oauth
      OWNER_OPEN_ID: your_owner_id
      OWNER_NAME: Your Name
      BUILT_IN_FORGE_API_URL: https://api.manus.im
      BUILT_IN_FORGE_API_KEY: your_api_key
      VITE_FRONTEND_FORGE_API_KEY: your_frontend_key
      VITE_FRONTEND_FORGE_API_URL: https://api.manus.im
      TZ: Asia/Shanghai
    depends_on:
      - mysql
    networks:
      - docker-manager-network

volumes:
  mysql_data:

networks:
  docker-manager-network:
    driver: bridge
```

### Dockerfile

```dockerfile
FROM node:22.13.0-alpine

WORKDIR /app

# 安装依赖
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["pnpm", "start"]
```

### 部署步骤

```bash
# 1. 构建镜像
docker-compose build

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f docker-manager-ui

# 4. 检查数据库连接
docker-compose exec docker-manager-ui node -e "console.log('Database connected')"
```

## 环境变量配置

| 变量名 | 说明 | 示例 |
|-------|------|------|
| `NODE_ENV` | 运行环境 | `production` 或 `development` |
| `DATABASE_URL` | 数据库连接字符串 | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | JWT签名密钥 | 随机字符串 |
| `VITE_APP_ID` | OAuth应用ID | 从OAuth提供商获取 |
| `OAUTH_SERVER_URL` | OAuth服务器URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | OAuth登录门户URL | `https://manus.im/oauth` |
| `OWNER_OPEN_ID` | 所有者OpenID | 用户唯一标识 |
| `OWNER_NAME` | 所有者名称 | 用户名 |
| `BUILT_IN_FORGE_API_URL` | 内置API URL | `https://api.manus.im` |
| `BUILT_IN_FORGE_API_KEY` | 内置API密钥 | 服务器端密钥 |
| `VITE_FRONTEND_FORGE_API_KEY` | 前端API密钥 | 前端密钥 |
| `VITE_FRONTEND_FORGE_API_URL` | 前端API URL | `https://api.manus.im` |
| `TZ` | 时区 | `Asia/Shanghai` |

## 数据库初始化

应用启动时会自动创建必要的表。如需手动初始化：

```bash
# 进入容器
docker-compose exec docker-manager-ui sh

# 运行迁移
pnpm db:push
```

## 生产部署最佳实践

### 1. 安全配置

- 使用强密码和密钥
- 启用 HTTPS
- 限制 Docker Socket 访问权限
- 定期更新依赖

### 2. 监控和日志

```bash
# 查看应用日志
docker-compose logs -f docker-manager-ui

# 查看数据库日志
docker-compose logs -f mysql
```

### 3. 备份

```bash
# 备份数据库
docker-compose exec mysql mysqldump -u docker_manager -p docker_manager > backup.sql

# 恢复数据库
docker-compose exec -T mysql mysql -u docker_manager -p docker_manager < backup.sql
```

### 4. 扩展和优化

- 使用负载均衡器（如 Nginx）
- 配置反向代理
- 启用缓存
- 监控资源使用

## 故障排查

### 数据库连接失败

```bash
# 检查数据库状态
docker-compose ps mysql

# 查看数据库日志
docker-compose logs mysql

# 测试连接
docker-compose exec docker-manager-ui mysql -h mysql -u docker_manager -p
```

### Docker Socket 权限问题

```bash
# 检查权限
ls -l /var/run/docker.sock

# 调整权限
sudo chmod 666 /var/run/docker.sock
```

### 应用无法启动

```bash
# 查看详细日志
docker-compose logs docker-manager-ui

# 检查环境变量
docker-compose exec docker-manager-ui env | grep DATABASE_URL
```

## 升级指南

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建镜像
docker-compose build --no-cache

# 3. 重启服务
docker-compose down
docker-compose up -d

# 4. 验证升级
docker-compose logs docker-manager-ui

## 访问应用

部署完成后，访问以下地址：

```
http://your-nas-ip:13000
```

其中 `your-nas-ip` 是您飞牛NAS的IP地址。
```

## 性能优化

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_container_name ON container_configs(name);
CREATE INDEX idx_log_created_at ON logs(createdAt);
```

### 2. 应用优化

- 增加 Node.js 内存限制
- 使用 PM2 进程管理
- 配置 CDN 加速静态资源

### 3. 容器资源限制

```yaml
services:
  docker-manager-ui:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 支持与反馈

如有部署问题，请查阅使用文档或提交反馈。
