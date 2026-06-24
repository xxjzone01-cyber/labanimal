#!/bin/bash
# 生成 RSA-2048 密钥对（用于 License 签名和报告签名）
#
# 用法:
#   ./scripts/generate-license-keys.sh
#
# 生成文件:
#   private-key.pem  — 私钥（保密，仅服务端持有）
#   public-key.pem   — 公钥（可嵌入开源代码）
#
# 安全提示:
#   - 私钥必须妥善保管，绝不能泄露
#   - 公钥可以公开，用于客户端验签
#   - 建议为 License 和 Report 分别使用不同的密钥对

set -euo pipefail

echo "=== LabAnimal License 密钥生成 ==="
echo ""

# 检查 openssl 是否可用
if ! command -v openssl &> /dev/null; then
  echo "错误: 未找到 openssl，请先安装 OpenSSL"
  exit 1
fi

# 生成私钥
echo "生成 RSA-2048 私钥..."
openssl genpkey -algorithm RSA -out private-key.pem -pkeyopt rsa_keygen_bits:2048 2>/dev/null
echo "  → private-key.pem"

# 从私钥导出公钥
echo "导出公钥..."
openssl rsa -pubout -in private-key.pem -out public-key.pem 2>/dev/null
echo "  → public-key.pem"

echo ""
echo "=== 密钥生成完成 ==="
echo ""
echo "公钥内容（可嵌入开源代码）:"
echo "---"
cat public-key.pem
echo "---"
echo ""
echo "安全提醒:"
echo "  1. private-key.pem 必须妥善保管，绝不能提交到 Git"
echo "  2. 建议将 private-key.pem 存储在安全的密钥管理服务中"
echo "  3. 如需生成报告签名专用密钥，请修改输出文件名后重新运行"
