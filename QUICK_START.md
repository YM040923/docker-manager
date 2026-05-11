# 飞牛 NAS 快速部署指南

## 🚀 一键部署（推荐）

### 前置条件
- 飞牛 NAS 已安装 Docker
- 可以通过 SSH 访问飞牛 NAS

### 部署步骤

#### 1. 获取项目代码

在飞牛 NAS 的 SSH 终端中执行：

```bash
# 创建部署目录
mkdir -p /mnt/docker-manager
cd /mnt/docker-manager

# 下载项目代码（选择其中一种方式）

# 方式 A: 使用 Git（推荐）
git clone https://github.com/yourusername/docker_manager_ui.git .

# 方式 B: 使用 curl 下载 ZIP（如果没有 Git）
curl -L https://github.com/yourusername/docker_manager_ui/archive/main.zip -o docker-manager.zip
unzip docker-manager.zip
mv docker_manager_ui-main/* .
rm -rf docker_manager_ui-main docker-manager.zip
```

#### 2. 运行一键部署脚本

```bash
cd /mnt/docker-manager
bash DEPLOY_ON_FEINU.sh
```

脚本会自动：
- ✅ 检查 Docker 环境
- ✅ 创建必要的目录和文件
- ✅ 配置数据库
- ✅ 构建 Docker 镜像
- ✅ 启动所有服务
- ✅ 验证服务状态

#### 3. 访问应用

部署完成后，在浏览器中打开：

```
http://[飞牛NAS的IP]:13000
```

例如：`http://192.168.1.100:13000`

---

## 📋 手动部署（如果一键脚本失败）

### 步骤 1: 创建目录结构

```bash
mkdir -p /mnt/docker-manager
cd /mnt/docker-manager
```

### 步骤 2: 上传项目文件

将项目文件上传到 `/mnt/docker-manager` 目录

### 步骤 3: 创建 .env 文件

```bash
cat > /mnt/docker-manager/.env << 'EOF'
MYSQL_ROOT_PASSWORD=your_password
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=docker_manager
MYSQL_USER=docker_manager
DATABASE_URL=mysql://docker_manager:your_password@mysql:3306/docker_manager
JWT_SECRET=$(openssl rand -base64 32)
NODE_ENV=production
PORT=13000
EOF
```

### 步骤 4: 构建镜像

```bash
cd /mnt/docker-manager
docker-compose build
```

### 步骤 5: 启动服务

```bash
docker-compose up -d
```

### 步骤 6: 验证服务

```bash
docker-compose ps
```

---

## 🔧 常用命令

### 查看日志

```bash
# 查看实时日志
docker-compose logs -f docker-manager-ui

# 查看数据库日志
docker-compose logs -f mysql
```

### 停止/重启服务

```bash
# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重启特定容器
docker-compose restart docker-manager-ui
```

### 查看容器状态

```bash
docker-compose ps
```

### 进入容器

```bash
# 进入应用容器
docker-compose exec docker-manager-ui sh

# 进入数据库容器
docker-compose exec mysql mysql -u root -p
```

---

## 🐛 故障排查

### 问题 1: 无法访问应用

**症状**: 浏览器无法打开 `http://192.168.1.100:13000`

**解决方案**:
```bash
# 检查容器是否运行
docker-compose ps

# 查看应用日志
docker-compose logs docker-manager-ui

# 检查端口是否被占用
netstat -tuln | grep 13000
```

### 问题 2: 数据库连接失败

**症状**: 应用启动但无法连接数据库

**解决方案**:
```bash
# 检查数据库容器
docker-compose logs mysql

# 验证数据库连接
docker-compose exec mysql mysql -u docker_manager -p docker_manager -e "SELECT 1;"
```

### 问题 3: Docker 镜像构建失败

**症状**: `docker-compose build` 出错

**解决方案**:
```bash
# 清理旧镜像
docker-compose down
docker system prune -a

# 重新构建
docker-compose build --no-cache
```

---

## 📊 应用功能

部署完成后，您可以：

### 1. 仪表盘
- 查看所有容器的实时状态
- 查看容器统计数据

### 2. 容器发现
- 点击"发现容器"按钮自动扫描已有容器
- 一键添加容器到管理列表

### 3. 启动顺序管理
- 拖拽排序容器启动顺序
- 为每个容器设置启动延迟
- 一键启动所有容器

### 4. 监控配置
- 为每个容器开启/关闭健康检查
- 自动重启失败的容器

### 5. 全局设置
- 配置健康检查间隔
- 查看系统日志

### 6. 实时日志
- 查看容器启动事件
- 查看自动重启记录

---

## 🔐 安全建议

1. **更改默认密码**
   ```bash
   # 修改 .env 文件中的密码
   MYSQL_ROOT_PASSWORD=your_strong_password
   MYSQL_PASSWORD=your_strong_password
   ```

2. **配置防火墙**
   ```bash
   # 只允许内网访问
   ufw allow from 192.168.1.0/24 to any port 13000
   ```

3. **定期备份数据库**
   ```bash
   docker-compose exec mysql mysqldump -u root -p docker_manager > backup.sql
   ```

---

## 📞 获取帮助

如遇到问题，请：

1. 查看日志：`docker-compose logs`
2. 检查环境变量：`cat .env`
3. 验证 Docker 状态：`docker ps`
4. 查看本文档的故障排查部分

---

## 🎉 下一步

部署完成后，建议：

1. ✅ 在浏览器中打开应用
2. ✅ 点击"发现容器"扫描现有容器
3. ✅ 配置容器启动顺序
4. ✅ 测试一键启动功能
5. ✅ 配置监控参数

祝您使用愉快！🚀
