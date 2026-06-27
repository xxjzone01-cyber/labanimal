#!/bin/bash
# ============================================================
# LabAnimal API 部署脚本 — 腾讯云服务器 + Caddy
# 服务器: api.labanimal.cloud
# ============================================================

set -e

echo "========================================="
echo "  LabAnimal API 部署脚本"
echo "  目标: api.labanimal.cloud"
echo "========================================="

# ============================================================
# 1. 安装基础依赖
# ============================================================
echo ""
echo "[1/7] 安装基础依赖..."

# Node.js 22
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
  echo "  ✅ Node.js $(node -v) 已安装"
else
  echo "  ✅ Node.js $(node -v) 已存在"
fi

# pnpm
if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
  echo "  ✅ pnpm 已安装"
else
  echo "  ✅ pnpm $(pnpm -v) 已存在"
fi

# PostgreSQL 16
if ! command -v psql &> /dev/null; then
  sudo apt-get install -y postgresql postgresql-contrib
  sudo systemctl enable postgresql
  sudo systemctl start postgresql
  echo "  ✅ PostgreSQL 已安装"
else
  echo "  ✅ PostgreSQL 已存在"
fi

# Caddy
if ! command -v caddy &> /dev/null; then
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update
  sudo apt install -y caddy
  echo "  ✅ Caddy 已安装"
else
  echo "  ✅ Caddy 已存在"
fi

# Git
if ! command -v git &> /dev/null; then
  sudo apt-get install -y git
  echo "  ✅ Git 已安装"
else
  echo "  ✅ Git 已存在"
fi

# ============================================================
# 2. 创建 PostgreSQL 数据库和用户
# ============================================================
echo ""
echo "[2/7] 配置 PostgreSQL..."

DB_NAME="labanimal"
DB_USER="labanimal"
DB_PASS="labanimal_$(openssl rand -hex 8)"

# 创建用户和数据库
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "  用户已存在，跳过"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "  数据库已存在，跳过"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null

echo "  ✅ 数据库: $DB_NAME"
echo "  ✅ 用户: $DB_USER"
echo "  ⚠️  密码: $DB_PASS (请保存！)"

# ============================================================
# 3. 克隆代码
# ============================================================
echo ""
echo "[3/7] 克隆代码..."

APP_DIR="/opt/labanimal"

if [ -d "$APP_DIR" ]; then
  echo "  目录已存在，拉取最新代码..."
  cd "$APP_DIR"
  git pull origin main
else
  sudo git clone https://github.com/xxjzone01-cyber/labanimal.git "$APP_DIR"
  sudo chown -R $(whoami):$(whoami) "$APP_DIR"
  cd "$APP_DIR"
fi

echo "  ✅ 代码在 $APP_DIR"

# ============================================================
# 4. 安装依赖 + 构建
# ============================================================
echo ""
echo "[4/7] 安装依赖 + 构建..."

cd "$APP_DIR"
pnpm install --frozen-lockfile
pnpm --filter @labanimal/compliance build
pnpm --filter @labanimal/db exec prisma generate
pnpm --filter @labanimal/db exec prisma migrate deploy
pnpm --filter @labanimal/api build

echo "  ✅ 构建完成"

# ============================================================
# 5. 配置环境变量
# ============================================================
echo ""
echo "[5/7] 配置环境变量..."

ENV_FILE="$APP_DIR/packages/api/.env"

cat > "$ENV_FILE" << EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
JWT_SECRET=$(openssl rand -hex 32)
PORT=3001
CORS_ORIGIN=https://labanimal.tech,https://www.labanimal.tech
EOF

echo "  ✅ 环境变量已写入 $ENV_FILE"
echo "  ⚠️  JWT_SECRET 已自动生成"

# ============================================================
# 6. 配置 Caddy 反向代理
# ============================================================
echo ""
echo "[6/7] 配置 Caddy..."

CADDYFILE="/etc/caddy/Caddyfile"

sudo tee "$CADDYFILE" > /dev/null << 'CADDY'
api.labanimal.cloud {
    reverse_proxy localhost:3001
}
CADDY

sudo systemctl restart caddy
echo "  ✅ Caddy 已配置: api.labanimal.cloud → localhost:3001"

# ============================================================
# 7. 配置 systemd 服务
# ============================================================
echo ""
echo "[7/7] 配置 systemd 服务..."

SERVICE_FILE="/etc/systemd/system/labanimal-api.service"

sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=LabAnimal API Server
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$APP_DIR/packages/api
EnvironmentFile=$ENV_FILE
ExecStart=$(which node) dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable labanimal-api
sudo systemctl start labanimal-api

echo "  ✅ 服务已启动"

# ============================================================
# 8. 配置自动备份
# ============================================================
echo ""
echo "[8/8] 配置自动备份..."

# 安装备份依赖
pip3 install coscmd 2>/dev/null || echo "  coscmd 安装失败（可稍后手动安装）"
chmod +x "$APP_DIR/scripts/backup-db.sh"

# 安装 systemd timer
sudo cp "$APP_DIR/scripts/backup-db.service" /etc/systemd/system/
sudo cp "$APP_DIR/scripts/backup-db.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable backup-db.timer
sudo systemctl start backup-db.timer

echo "  ✅ 自动备份已配置（每日 03:00 执行）"
echo "  ⚠️  请在 $ENV_FILE 中添加 COS 凭据："
echo "    COS_BUCKET=your-bucket-name"
echo "    COS_REGION=ap-guangzhou"
echo "    COS_SECRET_ID=your-secret-id"
echo "    COS_SECRET_KEY=your-secret-key"

# ============================================================
# 验证
# ============================================================
echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "API 地址: https://api.labanimal.cloud"
echo "健康检查: curl https://api.labanimal.cloud/api/health"
echo ""
echo "数据库密码: $DB_PASS"
echo "环境变量文件: $ENV_FILE"
echo ""
echo "常用命令:"
echo "  查看日志: sudo journalctl -u labanimal-api -f"
echo "  重启服务: sudo systemctl restart labanimal-api"
echo "  查看状态: sudo systemctl status labanimal-api"
echo "  手动备份: sudo systemctl start backup-db.service"
echo "  备份日志: sudo journalctl -u backup-db.service"
echo ""

# 验证服务
sleep 3
if curl -s http://localhost:3001/api/health | grep -q "ok"; then
  echo "✅ API 服务运行正常！"
else
  echo "⚠️  API 服务可能未正常启动，请检查日志:"
  echo "  sudo journalctl -u labanimal-api -n 50"
fi
