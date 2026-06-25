import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface BillingReport {
  labId: string;
  period: { startDate: string; endDate: string; days: number };
  lineItems: Array<{
    type: 'animal' | 'cage';
    species?: string;
    count: number;
    dailyRate: number;
    days: number;
    subtotal: number;
  }>;
  summary: { animalCost: number; cageCost: number; total: number };
}

interface SignatureData {
  signature: string;
  status: 'verified' | 'unverified';
  deployId: string;
  verifyUrl: string;
  signedAt: string;
}

/**
 * 计算字符串的 SHA-256 哈希
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 生成带签名二维码的计费报告 PDF
 */
export async function generateBillingPDF(
  report: BillingReport,
  labName: string,
  signReport: (data: { reportHash?: string; reportData?: string }) => Promise<SignatureData>,
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // 标题
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LabAnimal — Billing Report', pageWidth / 2, 25, { align: 'center' });

  // 实验室信息
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Lab: ${labName}`, 14, 38);
  doc.text(
    `Period: ${report.period.startDate} to ${report.period.endDate} (${report.period.days} days)`,
    14,
    44,
  );
  doc.text(`Generated: ${new Date().toISOString().split('T')[0]}`, 14, 50);

  // 分隔线
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 54, pageWidth - 14, 54);

  // 表头
  let y = 62;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Type', 14, y);
  doc.text('Species', 44, y);
  doc.text('Count', 84, y);
  doc.text('Daily Rate', 104, y);
  doc.text('Days', 134, y);
  doc.text('Subtotal', 158, y);

  // 表格行
  doc.setFont('helvetica', 'normal');
  y += 8;
  for (const item of report.lineItems) {
    doc.text(item.type, 14, y);
    doc.text(item.species || '—', 44, y);
    doc.text(String(item.count), 84, y);
    doc.text(`$${item.dailyRate.toFixed(2)}`, 104, y);
    doc.text(String(item.days), 134, y);
    doc.text(`$${item.subtotal.toFixed(2)}`, 158, y);
    y += 7;
  }

  // 分隔线
  y += 2;
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // 汇总
  doc.setFont('helvetica', 'bold');
  doc.text('Animal Cost:', 104, y);
  doc.text(`$${report.summary.animalCost.toFixed(2)}`, 158, y);
  y += 7;
  doc.text('Cage Cost:', 104, y);
  doc.text(`$${report.summary.cageCost.toFixed(2)}`, 158, y);
  y += 7;
  doc.setFontSize(11);
  doc.text('Total:', 104, y);
  doc.text(`$${report.summary.total.toFixed(2)}`, 158, y);

  // 签名
  const reportJson = JSON.stringify(report);
  const reportHash = await sha256(reportJson);
  let sig: SignatureData | null = null;
  try {
    sig = await signReport({ reportHash });
  } catch {
    // 签名失败不影响 PDF 生成
  }

  // 二维码
  const verifyUrl = sig?.verifyUrl || `https://labanimal.tech/verify?hash=${reportHash}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80, margin: 1 });

  // 页脚区域
  const footerY = doc.internal.pageSize.getHeight() - 40;

  // 分隔线
  doc.setDrawColor(200, 200, 200);
  doc.line(14, footerY - 5, pageWidth - 14, footerY - 5);

  // 二维码
  doc.addImage(qrDataUrl, 'PNG', 14, footerY, 25, 25);

  // 签名信息
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const statusText =
    sig?.status === 'verified'
      ? 'VERIFIED — Signed with RSA private key'
      : sig?.status === 'unverified'
        ? 'UNVERIFIED — Free tier or over limit'
        : 'UNVERIFIED — Signature unavailable';
  const statusColor: [number, number, number] =
    sig?.status === 'verified' ? [0, 128, 0] : [200, 150, 0];

  doc.text('Scan QR code to verify this report', 44, footerY + 3);
  doc.setTextColor(...statusColor);
  doc.setFont('helvetica', 'bold');
  doc.text(statusText, 44, footerY + 9);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');

  if (sig) {
    doc.text(`Deploy ID: ${sig.deployId}`, 44, footerY + 15);
    doc.text(`Signed: ${new Date(sig.signedAt).toLocaleString('zh-CN')}`, 44, footerY + 21);
  }
  doc.text(`Report Hash: ${reportHash.substring(0, 32)}...`, 44, footerY + 27);

  // 下载
  doc.save(`labanimal-billing-${report.period.startDate}-${report.period.endDate}.pdf`);
}
