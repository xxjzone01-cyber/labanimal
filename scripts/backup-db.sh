#!/usr/bin/env bash
# LabAnimal 数据库自动备份脚本
#
# 功能：pg_dump → gzip → 上传腾讯云 COS → 清理过期备份
#
# 环境变量（可通过 systemd EnvironmentFile 或 .env 配置）：
#   DATABASE_URL    — PostgreSQL 连接串
#   COS_BUCKET      — COS 存储桶名称（如 labanimal-backup-1250000000）
#   COS_REGION      — COS 区域（如 ap-guangzhou）
#   COS_SECRET_ID   — 腾讯云 SecretId
#   COS_SECRET_KEY  — 腾讯云 SecretKey
#   BACKUP_DIR      — 本地临时目录（默认 /tmp/labanimal-backup）
#   BACKUP_RETENTION_DAYS — 保留天数（默认 30）
#
# 用法：
#   chmod +x scripts/backup-db.sh
#   ./scripts/backup-db.sh

set -euo pipefail

# 默认值
BACKUP_DIR="${BACKUP_DIR:-/tmp/labanimal-backup}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/labanimal_${TIMESTAMP}.sql.gz"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[backup]${NC} $1"; }
warn() { echo -e "${YELLOW}[backup]${NC} $1"; }
error() { echo -e "${RED}[backup]${NC} $1" >&2; }

# 检查必要工具
check_deps() {
  local missing=()
  command -v pg_dump &>/dev/null || missing+=("pg_dump (postgresql-client)")
  command -v gzip &>/dev/null || missing+=("gzip")
  command -v coscmd &>/dev/null || missing+=("coscmd (pip install coscmd)")

  if [ ${#missing[@]} -gt 0 ]; then
    error "Missing dependencies: ${missing[*]}"
    error "Install with: apt install postgresql-client gzip && pip install coscmd"
    exit 1
  fi
}

# 检查环境变量
check_env() {
  if [ -z "${DATABASE_URL:-}" ]; then
    error "DATABASE_URL not set"
    exit 1
  fi

  if [ -z "${COS_BUCKET:-}" ] || [ -z "${COS_SECRET_ID:-}" ] || [ -z "${COS_SECRET_KEY:-}" ]; then
    warn "COS credentials not set — backup will be local only"
    LOCAL_ONLY=true
  else
    LOCAL_ONLY=false
  fi
}

# 执行 pg_dump + 压缩
do_backup() {
  log "Starting database backup..."
  mkdir -p "${BACKUP_DIR}"

  # 从 DATABASE_URL 解析连接参数
  local db_url="${DATABASE_URL}"

  # pg_dump 使用 DATABASE_URL 环境变量
  PGPASSWORD="" pg_dump "${db_url}" --no-owner --no-acl --clean --if-exists 2>/dev/null \
    | gzip > "${BACKUP_FILE}"

  local size
  size=$(du -h "${BACKUP_FILE}" | cut -f1)
  log "Backup created: ${BACKUP_FILE} (${size})"
}

# 上传到 COS
upload_to_cos() {
  if [ "${LOCAL_ONLY}" = true ]; then
    log "Skipping COS upload (local only)"
    return 0
  fi

  log "Configuring coscmd..."
  coscmd config -a "${COS_SECRET_ID}" -s "${COS_SECRET_KEY}" -b "${COS_BUCKET}" -r "${COS_REGION:-ap-guangzhou}" 2>/dev/null

  local cos_path="db-backup/labanimal_$(date +%Y/%m)/labanimal_${TIMESTAMP}.sql.gz"

  log "Uploading to cos://${COS_BUCKET}/${cos_path}..."
  if coscmd upload "${BACKUP_FILE}" "/${cos_path}" 2>/dev/null; then
    log "Upload complete"
  else
    error "Upload failed — backup saved locally at ${BACKUP_FILE}"
    return 1
  fi
}

# 清理过期本地备份
cleanup_local() {
  log "Cleaning up local backups older than ${BACKUP_RETENTION_DAYS} days..."
  find "${BACKUP_DIR}" -name "labanimal_*.sql.gz" -mtime "+${BACKUP_RETENTION_DAYS}" -delete 2>/dev/null || true
}

# 清理过期 COS 备份（可选，需要 coscmd）
cleanup_cos() {
  if [ "${LOCAL_ONLY}" = true ]; then
    return 0
  fi

  # COS 生命周期策略通常在控制台配置，这里仅做提示
  log "Note: Configure COS lifecycle policy in Tencent Cloud Console for automatic cleanup"
}

# 主流程
main() {
  log "=== LabAnimal Database Backup ==="
  log "Timestamp: ${TIMESTAMP}"

  check_deps
  check_env
  do_backup
  upload_to_cos
  cleanup_local
  cleanup_cos

  log "=== Backup complete ==="
}

main "$@"
