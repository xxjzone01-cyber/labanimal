# LabAnimal 部署指南

## 目录

- [环境要求](#环境要求)
- [快速开始（手动部署）](#快速开始手动部署)
- [Docker 部署](#docker-部署)
- [环境变量](#环境变量)
- [生产配置](#生产配置)
- [反向代理](#反向代理)

---

## 环境要求

| 组件 | 版本 |
|------|------|
| Node.js | >= 20 |
| pnpm | >= 9 |
| PostgreSQL | >= 16 |

---

## 快速开始（手动部署）

```bash
# 1. 克隆仓库
git clone https://github.com/xxjzone01-cyber/labanimal.git
cd labanimal

# 2. 安装依赖
pnpm install

# 3. 构建合规引擎（其他包的前置依赖）
pnpm --filter @labanimal/compliance build

# 4. 配置数据库
# 编辑 packages/db/.env，设置 DATABASE_URL
echo 'DATABASE_URL=postgresql://user:password@localhost:5432/labanimal' > packages/db/.env

# 5. 执行数据库迁移
pnpm --filter @labanimal/db exec prisma migrate deploy

# 6. （可选）导入种子数据
pnpm --filter @labanimal/db db:seed

# 7. 设置 API 环境变量
export AUTH_SECRET=$(openssl rand -hex 32)
export DATABASE_URL=postgresql://user:password@localhost:5432/labanimal
export NODE_ENV=production

# 8. 构建并启动 API
pnpm --filter @labanimal/api build
pnpm --filter @labanimal/api start

# 9. 构建前端
pnpm --filter @labanimal/app build
# 产出在 packages/app/dist/，用 nginx 或其他 Web 服务器托管
```

---

## Docker 部署

### docker-compose.yml（参考配置）

```yaml
version: '3.8'

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: labanimal
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: labanimal
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U labanimal"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    environment:
      DATABASE_URL: postgresql://labanimal:${DB_PASSWORD}@db:5432/labanimal
      AUTH_SECRET: ${AUTH_SECRET}
      NODE_ENV: production
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      db:
        condition: service_healthy

  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  pgdata:
```

### 启动

```bash
# 生成密钥
export AUTH_SECRET=$(openssl rand -hex 32)
export DB_PASSWORD=$(openssl rand -hex 16)

# 构建并启动
docker compose up -d --build

# 执行数据库迁移
docker compose exec api node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma

# （可选）导入种子数据
docker compose exec api node packages/db/prisma/seed.js
```

---

## 环境变量

### 必填

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@host:5432/db` |
| `AUTH_SECRET` | JWT 签名密钥（>= 32 字符） | `openssl rand -hex 32` 生成 |

### 可选

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `PORT` | API 监听端口 | `3001` |
| `CORS_ORIGIN` | 允许的跨域来源 | `*` |
| `DISABLE_RATE_LIMIT` | 禁用速率限制 | `false` |
| `PAYPAL_WEBHOOK_ID` | PayPal Webhook ID（用于验签） | — |
| `STRIPE_SECRET_KEY` | Stripe 密钥 | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 签名密钥 | — |
| `LICENSE_PRIVATE_KEY_PATH` | RSA 私钥路径（verified 签名） | — |

---

## 生产配置

### 安全要求

1. **必须设置 `AUTH_SECRET`**：生产环境下，未设置 `AUTH_SECRET` 会导致 API 启动失败
2. **CORS 收紧**：设置 `CORS_ORIGIN=https://your-domain.com`，不要使用 `*`
3. **HTTPS**：在反向代理层配置 TLS
4. **数据库**：使用强密码，限制网络访问

### 数据库备份

```bash
# 每日备份
pg_dump -U labanimal labanimal > backup_$(date +%Y%m%d).sql

# 恢复
psql -U labanimal labanimal < backup_20260626.sql
```

---

## 反向代理

### Nginx 参考配置

```nginx
server {
    listen 443 ssl http2;
    server_name labanimal.example.com;

    ssl_certificate /etc/ssl/certs/labanimal.pem;
    ssl_certificate_key /etc/ssl/private/labanimal.key;

    # 前端静态文件
    root /var/www/labanimal/packages/app/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Caddy 参考配置

```
labanimal.example.com {
    root * /var/www/labanimal/packages/app/dist
    file_server
    try_files {path} /index.html

    reverse_proxy /api/* localhost:3001
}
```
