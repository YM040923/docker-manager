# 飞牛NAS 部署指南

本指南将帮助您在飞牛NAS上部署Docker容器管理工具。

## 前置要求

在开始部署前，请确保您的飞牛NAS满足以下条件：

| 项目 | 要求 | 说明 |
|------|------|------|
| Docker | 已安装 | 飞牛NAS通常预装Docker |
| Docker Compose | 已安装 | 用于一键启动多个服务 |
| 磁盘空间 | 至少 2GB | 用于数据库和应用程序 |
| 网络 | 正常连接 | 需要访问互联网下载镜像 |

## 部署步骤

### 第一步：准备部署文件

1. **在飞牛NAS上创建应用目录**

   通过SSH连接到飞牛NAS，或使用文件管理器创建一个新目录：

   ```bash
   mkdir -p /mnt/docker-manager
   cd /mnt/docker-manager
   ```

2. **获取项目文件**

   您有两种方式获取项目文件：

   **方式 A：使用 Git 克隆（推荐）**

   ```bash
   cd /mnt/docker-manager
   git clone <项目仓库地址> .
   ```

   **方式 B：手动上传文件**

   - 从开发机器上下载所有项目文件
   - 通过SCP或文件管理器上传到 `/mnt/docker-manager` 目录
   - 确保包含以下关键文件：
     - `Dockerfile`
     - `docker-compose.example.yml`
     - `package.json`
     - `server/` 目录
     - `client/` 目录
     - `drizzle/` 目录

### 第二步：配置 Docker Compose

1. **复制示例配置文件**

   ```bash
   cd /mnt/docker-manager
   cp docker-compose.example.yml docker-compose.yml
   ```

2. **编辑配置文件**

   使用文本编辑器打开 `docker-compose.yml`，修改以下关键部分：

   ```yaml
   services:
     mysql:
       environment:
         MYSQL_ROOT_PASSWORD: your_secure_root_password  # 改为强密码
         MYSQL_PASSWORD: your_secure_db_password         # 改为强密码

     docker-manager-ui:
       environment:
         DATABASE_URL: mysql://docker_manager:your_secure_db_password@mysql:3306/docker_manager
         JWT_SECRET: your_jwt_secret_key_here_change_me  # 改为随机字符串
         VITE_APP_ID: your_app_id                         # 从OAuth提供商获取
         OWNER_OPEN_ID: your_owner_id                     # 您的用户ID
         OWNER_NAME: Your Name                            # 您的名称
   ```

   **安全建议**：
   - 使用强密码（至少12个字符，包含大小写字母、数字和特殊字符）
   - JWT_SECRET 应该是随机的长字符串
   - 不要在配置文件中提交到版本控制系统

### 第三步：构建和启动应用

1. **构建Docker镜像**

   ```bash
   cd /mnt/docker-manager
   docker-compose build
   ```

   这个过程可能需要 5-10 分钟，取决于您的网络速度。

2. **启动服务**

   ```bash
   docker-compose up -d
   ```

   `-d` 参数表示在后台运行。

3. **验证启动状态**

   ```bash
   docker-compose ps
   ```

   您应该看到两个容器都处于 `Up` 状态：
   - `docker-manager-mysql` - 数据库
   - `docker-manager-ui` - 应用程序

### 第四步：访问应用

1. **获取飞牛NAS的IP地址**

   - 打开飞牛NAS的管理界面
   - 查看系统信息，找到IP地址
   - 或在SSH中运行：`hostname -I`

2. **在浏览器中访问**

   打开浏览器，访问以下地址：

   ```
   http://your-nas-ip:13000
   ```

   将 `your-nas-ip` 替换为实际的IP地址。例如：`http://192.168.1.100:13000`

3. **首次使用**

   - 应用将要求您登录
   - 使用OAuth登录后，您就可以开始添加和管理容器了

## 容器自动发现

应用支持自动发现飞牛NAS中已有的容器，无需手动输入容器名称：

1. **打开容器管理页面**

   在导航栏中点击"启动顺序"

2. **点击"自动发现容器"按钮**

   应用会扫描所有现有容器

3. **选择要管理的容器**

   勾选您想要管理的容器，点击"添加"

4. **配置容器参数**

   - **启动延迟**：容器启动前等待的秒数（用于控制启动顺序间隔）
   - **启用监控**：是否定时检查容器状态，自动重启停止的容器

## 常见问题

### Q1：容器无法启动，提示"port already in use"

**解决方案**：
- 修改 `docker-compose.yml` 中的端口映射
- 例如，将 `13000:13000` 改为 `13001:13000`
- 然后重新启动：`docker-compose restart`

### Q2：无法连接到数据库

**检查步骤**：
1. 确认MySQL容器正在运行：`docker-compose ps`
2. 查看MySQL日志：`docker-compose logs mysql`
3. 验证数据库密码是否正确
4. 检查网络连接：`docker-compose exec docker-manager-ui ping mysql`

### Q3：容器发现功能无法工作

**可能原因**：
- Docker Socket 权限不足
- 容器已经在管理列表中
- Docker 守护进程未运行

**解决方案**：
```bash
# 检查Docker Socket权限
ls -l /var/run/docker.sock

# 重启Docker服务
sudo systemctl restart docker

# 查看应用日志
docker-compose logs docker-manager-ui
```

### Q4：如何查看应用日志？

```bash
# 查看所有日志
docker-compose logs

# 查看特定服务日志
docker-compose logs docker-manager-ui

# 实时查看日志
docker-compose logs -f docker-manager-ui
```

### Q5：如何停止或重启应用？

```bash
# 停止应用
docker-compose down

# 重启应用
docker-compose restart

# 完全重建并启动
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 数据备份

### 备份数据库

```bash
# 创建备份目录
mkdir -p /mnt/docker-manager/backups

# 备份数据库
docker-compose exec -T mysql mysqldump \
  -u docker_manager \
  -p"your_secure_db_password" \
  docker_manager > /mnt/docker-manager/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复数据库

```bash
# 恢复数据库
docker-compose exec -T mysql mysql \
  -u docker_manager \
  -p"your_secure_db_password" \
  docker_manager < /mnt/docker-manager/backups/backup_file.sql
```

## 性能优化

### 1. 资源限制

编辑 `docker-compose.yml`，为容器添加资源限制：

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

### 2. 数据库优化

连接到MySQL容器并执行优化：

```bash
docker-compose exec mysql mysql -u docker_manager -p"password" docker_manager

# 在MySQL中执行
CREATE INDEX idx_container_name ON container_configs(name);
CREATE INDEX idx_log_created_at ON logs(createdAt);
```

### 3. 清理旧日志

```bash
# 删除30天前的日志
docker-compose exec mysql mysql -u docker_manager -p"password" docker_manager

# 在MySQL中执行
DELETE FROM logs WHERE createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

## 升级应用

### 升级到最新版本

```bash
# 1. 进入应用目录
cd /mnt/docker-manager

# 2. 拉取最新代码
git pull origin main

# 3. 重新构建镜像
docker-compose build --no-cache

# 4. 重启服务
docker-compose down
docker-compose up -d

# 5. 验证升级
docker-compose logs docker-manager-ui
```

## 监控和维护

### 定期检查

建议每周检查以下内容：

1. **容器状态**：确保所有容器正常运行
2. **磁盘空间**：检查 `/mnt/docker-manager` 的磁盘使用情况
3. **日志文件**：查看是否有异常错误
4. **数据库大小**：监控数据库是否过大

### 定期维护

```bash
# 清理未使用的Docker资源
docker system prune -a

# 查看磁盘使用情况
du -sh /mnt/docker-manager

# 检查容器资源使用
docker stats
```

## 支持和反馈

如遇到问题，请：

1. 查看应用日志：`docker-compose logs docker-manager-ui`
2. 检查MySQL日志：`docker-compose logs mysql`
3. 参考本指南的常见问题部分
4. 提交问题反馈

## 总结

恭喜！您已经成功在飞牛NAS上部署了Docker容器管理工具。现在您可以：

- ✅ 自动发现和管理容器
- ✅ 配置容器启动顺序
- ✅ 设置自动监控和重启
- ✅ 查看实时日志和统计信息

祝您使用愉快！
