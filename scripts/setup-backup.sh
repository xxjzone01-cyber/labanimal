#!/usr/bin/env bash
# 安装备份定时任务到 systemd
#
# 用法（在服务器上执行）：
#   sudo bash scripts/setup-backup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== LabAnimal Backup Setup ==="

# 检查 coscmd
if ! command -v coscmd &>/dev/null; then
  echo "Installing coscmd..."
  pip3 install coscmd
fi

# 检查 pg_dump
if ! command -v pg_dump &>/dev/null; then
  echo "Error: pg_dump not found. Install: apt install postgresql-client"
  exit 1
fi

# 设置脚本可执行权限
chmod +x "${SCRIPT_DIR}/backup-db.sh"

# 复制 systemd 文件
cp "${SCRIPT_DIR}/backup-db.service" /etc/systemd/system/
cp "${SCRIPT_DIR}/backup-db.timer" /etc/systemd/system/

# 重载 systemd
systemctl daemon-reload

# 启用并启动 timer
systemctl enable backup-db.timer
systemctl start backup-db.timer

echo ""
echo "=== Backup setup complete ==="
echo ""
echo "Timer status:"
systemctl list-timers backup-db.timer
echo ""
echo "Manual run:  systemctl start backup-db.service"
echo "View logs:   journalctl -u backup-db.service"
echo ""
echo "Required environment variables in /opt/labanimal/packages/api/.env:"
echo "  COS_BUCKET=your-bucket-name"
echo "  COS_REGION=ap-guangzhou"
echo "  COS_SECRET_ID=your-secret-id"
echo "  COS_SECRET_KEY=your-secret-key"
echo "  BACKUP_RETENTION_DAYS=30"
