#!/bin/bash

# 飞牛 NAS Docker 容器管理工具 - 一键部署脚本
# 在飞牛 NAS 的 SSH 终端中运行此脚本

set -e

echo "=========================================="
echo "🚀 飞牛 NAS - Docker 容器管理工具部署"
echo "=========================================="
echo ""

# 配置变量
DEPLOY_DIR="/mnt/docker-manager"
REPO_URL="https://github.com/yourusername/docker_manager_ui.git"  # 需要替换为实际的仓库地址
MYSQL_PASSWORD="${MYSQL_PASSWORD:-docker_manager_123}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 32)}"
DB_NAME="docker_manager"
DB_USER="docker_manager"

echo "📋 部署配置："
echo "  部署目录: $DEPLOY_DIR"
echo "  数据库名: $DB_NAME"
echo "  数据库用户: $DB_USER"
echo ""

# 步骤 1: 检查 Docker 是否安装
echo "✓ 步骤 1: 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    echo "请先在飞牛 NAS 中安装 Docker"
    exit 1
fi
DOCKER_VERSION=$(docker --version)
echo "✓ Docker 已安装: $DOCKER_VERSION"
echo ""

# 步骤 2: 创建部署目录
echo "✓ 步骤 2: 创建部署目录..."
if [ ! -d "$DEPLOY_DIR" ]; then
    mkdir -p "$DEPLOY_DIR"
    echo "✓ 创建目录: $DEPLOY_DIR"
else
    echo "✓ 目录已存在: $DEPLOY_DIR"
fi
cd "$DEPLOY_DIR"
echo ""

# 步骤 3: 下载项目代码
echo "✓ 步骤 3: 下载项目代码..."
if [ ! -d "$DEPLOY_DIR/.git" ]; then
    echo "从 GitHub 克隆项目..."
    # 如果没有 git，使用 curl 下载 zip
    if command -v git &> /dev/null; then
        git clone "$REPO_URL" .
    else
        echo "⚠️  Git 未安装，使用 curl 下载..."
        # 这里需要您提供正确的下载链接
        echo "❌ 请先安装 git 或手动上传项目文件到 $DEPLOY_DIR"
        exit 1
    fi
else
    echo "✓ 项目代码已存在"
fi
echo ""

# 步骤 4: 创建 .env 文件
echo "✓ 步骤 4: 创建环境配置文件..."
cat > "$DEPLOY_DIR/.env" << EOF
# Docker 容器管理工具 - 环境配置

# 数据库配置
MYSQL_ROOT_PASSWORD=$MYSQL_PASSWORD
MYSQL_PASSWORD=$MYSQL_PASSWORD
MYSQL_DATABASE=$DB_NAME
MYSQL_USER=$DB_USER
DATABASE_URL=mysql://$DB_USER:$MYSQL_PASSWORD@mysql:3306/$DB_NAME

# JWT 密钥（用于会话加密）
JWT_SECRET=$JWT_SECRET

# OAuth 配置（如果需要）
VITE_APP_ID=your_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://login.manus.im

# 应用端口
PORT=13000

# 环境
NODE_ENV=production
EOF
echo "✓ 环境配置文件已创建: $DEPLOY_DIR/.env"
echo ""

# 步骤 5: 创建 docker-compose.yml
echo "✓ 步骤 5: 创建 docker-compose 配置..."
cat > "$DEPLOY_DIR/docker-compose.yml" << 'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: docker-manager-mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - docker-manager-net
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 5s
      retries: 5

  docker-manager-ui:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: docker-manager-ui
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      VITE_APP_ID: ${VITE_APP_ID}
      OAUTH_SERVER_URL: ${OAUTH_SERVER_URL}
      VITE_OAUTH_PORTAL_URL: ${VITE_OAUTH_PORTAL_URL}
      NODE_ENV: ${NODE_ENV}
    ports:
      - "13000:13000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - docker-manager-net
    restart: unless-stopped

volumes:
  mysql_data:

networks:
  docker-manager-net:
    driver: bridge
EOF
echo "✓ docker-compose 配置已创建"
echo ""

# 步骤 6: 构建镜像
echo "✓ 步骤 6: 构建 Docker 镜像..."
echo "  这可能需要几分钟，请耐心等待..."
docker-compose build
echo "✓ Docker 镜像构建完成"
echo ""

# 步骤 7: 启动服务
echo "✓ 步骤 7: 启动服务..."
docker-compose up -d
echo "✓ 服务已启动"
echo ""

# 步骤 8: 等待服务就绪
echo "✓ 步骤 8: 等待服务就绪..."
sleep 10

# 步骤 9: 验证服务
echo "✓ 步骤 9: 验证服务..."
if docker-compose ps | grep -q "docker-manager-ui.*Up"; then
    echo "✓ 服务运行正常"
else
    echo "⚠️  服务可能未正确启动，请检查日志："
    echo "  docker-compose logs docker-manager-ui"
    exit 1
fi
echo ""

# 获取 NAS IP
NAS_IP=$(hostname -I | awk '{print $1}')

echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "🌐 访问地址:"
echo "  http://$NAS_IP:13000"
echo ""
echo "📊 常用命令:"
echo "  查看日志:      docker-compose logs -f docker-manager-ui"
echo "  停止服务:      docker-compose down"
echo "  重启服务:      docker-compose restart"
echo "  查看容器状态:  docker-compose ps"
echo ""
echo "🔧 数据库信息:"
echo "  用户名: $DB_USER"
echo "  密码: $MYSQL_PASSWORD"
echo "  数据库: $DB_NAME"
echo ""
echo "💡 下一步:"
echo "  1. 在浏览器中打开 http://$NAS_IP:13000"
echo "  2. 点击'发现容器'按钮自动扫描已有容器"
echo "  3. 配置容器启动顺序和监控参数"
echo ""
