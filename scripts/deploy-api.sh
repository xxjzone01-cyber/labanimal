#!/bin/bash
# ============================================================
# LabAnimal API 部署脚本
# 目标: api.labanimal.cloud (腾讯云服务器 + Caddy)
#
# 使用方式:
#   1. SSH 登录服务器
#   2. 复制整个脚本粘贴执行
#   3. 或上传后 bash deploy-api.sh
# ============================================================

set -e

# ============================================================
# 配置区（请替换 __PLACEHOLDER__）
# ============================================================
DB_PASS="__DB_PASSWORD__"           # 数据库密码，自定义一个强密码
JWT_SECRET="__JWT_SECRET__"         # JWT 密钥，用 openssl rand -hex 32 生成
APP_DIR="/opt/labanimal"
API_DOMAIN="api.labanimal.cloud"

echo "========================================="
echo "  LabAnimal API 部署"
echo "  域名: $API_DOMAIN"
echo "========================================="

# ============================================================
# 1. 安装 Node.js 22
# ============================================================
echo ""
echo "[1/8] 安装 Node.js 22..."

if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "  Node.js $(node -v), npm $(npm -v)"

# ============================================================
# 2. 安装 pnpm
# ============================================================
echo ""
echo "[2/8] 安装 pnpm..."

if ! command -v pnpm &> /dev/null; then
  npm install -g pnpm
fi
echo "  pnpm $(pnpm -v)"

# ============================================================
# 3. 安装 PostgreSQL 16
# ============================================================
echo ""
echo "[3/8] 安装 PostgreSQL..."

if ! command -v psql &> /dev/null; then
  sudo apt-get install -y postgresql postgresql-contrib
  sudo systemctl enable postgresql
  sudo systemctl start postgresql
fi
echo "  PostgreSQL $(psql --version | head -1)"

# ============================================================
# 4. 安装 Caddy
# ============================================================
echo ""
echo "[4/8] 安装 Caddy..."

if ! command -v caddy &> /dev/null; then
  sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt update
  sudo apt install -y caddy
fi
echo "  Caddy $(caddy version)"

# ============================================================
# 5. 创建 PostgreSQL 数据库
# ============================================================
echo ""
echo "[5/8] 配置数据库..."

sudo -u postgres psql -c "CREATE USER labanimal WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "  用户已存在"
sudo -u postgres psql -c "CREATE DATABASE labanimal OWNER labanimal;" 2>/dev/null || echo "  数据库已存在"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE labanimal TO labanimal;" 2>/dev/null
sudo -u postgres psql -c "ALTER USER labanimal CREATEDB;" 2>/dev/null
echo "  数据库: labanimal, 用户: labanimal"

# ============================================================
# 6. 克隆代码 + 安装依赖 + 构建
# ============================================================
echo ""
echo "[6/8] 部署代码..."

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  sudo rm -rf "$APP_DIR"
  sudo git clone https://github.com/xxjzone01-cyber/labanimal.git "$APP_DIR"
  sudo chown -R $(whoami):$(whoami) "$APP_DIR"
  cd "$APP_DIR"
fi

pnpm install --frozen-lockfile
pnpm --filter @labanimal/compliance build
pnpm --filter @labanimal/db exec prisma generate
pnpm --filter @labanimal/db exec prisma migrate deploy
pnpm --filter @labanimal/api build

echo "  构建完成"

# ============================================================
# 7. 写入环境变量 + 配置 Caddy + systemd
# ============================================================
echo ""
echo "[7/8] 配置服务..."

# 环境变量
cat > "$APP_DIR/packages/api/.env" << EOF
DATABASE_URL=postgresql://labanimal:${DB_PASS}@localhost:5432/labanimal
JWT_SECRET=${JWT_SECRET}
PORT=3001
CORS_ORIGIN=https://labanimal.tech,https://www.labanimal.tech
EOF

# Caddy 反向代理
cat << 'CADDYEOF' | sudo tee /etc/caddy/Caddyfile
api.labanimal.cloud {
    reverse_proxy localhost:3001
}
CADDYEOF

sudo systemctl restart caddy

# systemd 服务
NODE_PATH=$(which node)
cat << EOF | sudo tee /etc/systemd/system/labanimal-api.service
[Unit]
Description=LabAnimal API Server
After=network.target postgresql.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$APP_DIR/packages/api
EnvironmentFile=$APP_DIR/packages/api/.env
ExecStart=$NODE_PATH dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable labanimal-api
sudo systemctl start labanimal-api

# ============================================================
# 8. 配置自动备份
# ============================================================
echo ""
echo "[8/9] 配置自动备份..."
pip3 install coscmd 2>/dev/null || echo "  coscmd 安装失败（可稍后手动安装）"
chmod +x "$APP_DIR/scripts/backup-db.sh"
sudo cp "$APP_DIR/scripts/backup-db.service" /etc/systemd/system/
sudo cp "$APP_DIR/scripts/backup-db.timer" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable backup-db.timer
sudo systemctl start backup-db.timer
echo "  ✅ 自动备份已配置（每日 03:00）"

# ============================================================
# 9. 验证
# ============================================================
echo ""
echo "[8/8] 验证部署..."
sleep 3

if curl -s http://localhost:3001/api/health | grep -q "ok"; then
  echo ""
  echo "========================================="
  echo "  ✅ 部署成功！"
  echo "========================================="
  echo ""
  echo "  API 地址:  https://$API_DOMAIN"
  echo "  健康检查:  curl https://$API_DOMAIN/api/health"
  echo ""
  echo "  环境变量:  $APP_DIR/packages/api/.env"
  echo "  查看日志:  sudo journalctl -u labanimal-api -f"
  echo "  重启服务:  sudo systemctl restart labanimal-api"
  echo "  查看状态:  sudo systemctl status labanimal-api"
  echo ""
else
  echo ""
  echo "⚠️  API 未正常启动，请检查日志:"
  echo "  sudo journalctl -u labanimal-api -n 50 --no-pager"
fi
