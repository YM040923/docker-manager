#!/bin/bash

# Docker 容器管理工具 - 镜像上传脚本
# 此脚本会自动构建并上传镜像到 Docker Hub

set -e

echo "=========================================="
echo "Docker 容器管理工具 - 镜像上传脚本"
echo "=========================================="

# 配置
DOCKER_USERNAME="ymzwh"
REPO_NAME="docker-manager"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${REPO_NAME}:${IMAGE_TAG}"

echo ""
echo "📦 镜像配置："
echo "  用户名: $DOCKER_USERNAME"
echo "  仓库名: $REPO_NAME"
echo "  标签: $IMAGE_TAG"
echo "  完整镜像名: $FULL_IMAGE_NAME"
echo ""

# 步骤 1: 检查 Docker 是否安装
echo "✓ 步骤 1: 检查 Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi
echo "✓ Docker 已安装"

# 步骤 2: 检查是否已登录 Docker Hub
echo ""
echo "✓ 步骤 2: 检查 Docker Hub 登录状态..."
if ! docker info | grep -q "Username: $DOCKER_USERNAME"; then
    echo "⚠️  需要登录 Docker Hub"
    echo "请运行: docker login"
    exit 1
fi
echo "✓ 已登录到 Docker Hub"

# 步骤 3: 构建镜像
echo ""
echo "✓ 步骤 3: 构建 Docker 镜像..."
echo "  命令: docker build -t $FULL_IMAGE_NAME ."
docker build -t $FULL_IMAGE_NAME .
echo "✓ 镜像构建完成"

# 步骤 4: 上传镜像
echo ""
echo "✓ 步骤 4: 上传镜像到 Docker Hub..."
echo "  命令: docker push $FULL_IMAGE_NAME"
docker push $FULL_IMAGE_NAME
echo "✓ 镜像上传完成"

# 步骤 5: 验证
echo ""
echo "✓ 步骤 5: 验证镜像..."
docker images | grep $REPO_NAME || true

echo ""
echo "=========================================="
echo "✅ 完成！"
echo "=========================================="
echo ""
echo "镜像已成功上传到 Docker Hub"
echo "访问地址: https://hub.docker.com/r/$FULL_IMAGE_NAME"
echo ""
echo "在飞牛 NAS 上使用此镜像："
echo "  docker pull $FULL_IMAGE_NAME"
echo "  docker run -d \\"
echo "    --name docker-manager-ui \\"
echo "    -p 13000:13000 \\"
echo "    -v /var/run/docker.sock:/var/run/docker.sock:ro \\"
echo "    -e DATABASE_URL='mysql://user:pass@host:3306/db' \\"
echo "    -e JWT_SECRET='your-secret' \\"
echo "    $FULL_IMAGE_NAME"
echo ""
