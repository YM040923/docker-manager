FROM node:22.13.0-alpine

WORKDIR /app

# 安装基础工具
RUN apk add --no-cache git curl

# 安装pnpm
RUN npm install -g pnpm

# 复制package文件和patches
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 构建应用
RUN pnpm build

# 暴露端口
EXPOSE 13000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=13000

# 启动应用
CMD ["pnpm", "start"]
