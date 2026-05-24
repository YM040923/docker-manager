# ---- 构建阶段 ----
FROM node:22.13.0-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git curl
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---- 生产阶段 ----
FROM node:22.13.0-alpine

RUN apk add --no-cache curl
RUN addgroup -S appuser && adduser -S appuser -G appuser

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/patches/ ./patches/
COPY --from=builder /app/drizzle/ ./drizzle/
COPY --from=builder /app/dist/ ./dist/

RUN npm install -g pnpm && pnpm install --frozen-lockfile --prod

ENV NODE_ENV=production
ENV PORT=13000

EXPOSE 13000

USER appuser

CMD ["pnpm", "start"]
