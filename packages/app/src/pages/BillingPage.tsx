import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { generateBillingPDF } from '../lib/pdf';

interface LineItem {
  type: 'animal' | 'cage';
  species?: string;
  count: number;
  dailyRate: number;
  days: number;
  subtotal: number;
}

interface BillingReport {
  labId: string;
  period: { startDate: string; endDate: string; days: number };
  lineItems: LineItem[];
  summary: { animalCost: number; cageCost: number; total: number };
}

interface Invoice {
  id: string;
  month: string;
  animalCount: number;
  reportCount: number;
  animalCost: number;
  cageCost: number;
  totalAmount: number;
  status: string;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

function getQuickRange(period: string): { startDate: string; endDate: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case 'this-month':
      return { startDate: `${y}-${pad(m + 1)}-01`, endDate: fmt(now) };
    case 'last-month': {
      const lm = new Date(y, m - 1, 1);
      const lmEnd = new Date(y, m, 0);
      return { startDate: fmt(lm), endDate: fmt(lmEnd) };
    }
    case 'this-year':
      return { startDate: `${y}-01-01`, endDate: fmt(now) };
    case 'last-year':
      return { startDate: `${y - 1}-01-01`, endDate: `${y - 1}-12-31` };
    default:
      return { startDate: fmt(new Date(now.getTime() - 30 * 86400000)), endDate: fmt(now) };
  }
}

function downloadCSV(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BillingPage() {
  const [report, setReport] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceView, setInvoiceView] = useState<'monthly' | 'annual'>('monthly');
  const labId = api.getLabId();
  const [form, setForm] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!labId) return;
    api.getInvoices(labId).then(setInvoices).catch(() => {});
  }, [labId]);

  function handleQuickRange(period: string) {
    setForm(getQuickRange(period));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      const data = await api.generateBilling(api.getLabId(), form.startDate, form.endDate);
      setReport(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPDF() {
    if (!report) return;
    try {
      setPdfLoading(true);
      await generateBillingPDF(report, 'Lab', async (data) => {
        const res = await api.signReport(data);
        return { ...res, status: res.status as 'verified' | 'unverified' };
      });
    } catch (err: any) {
      setError(err.message || 'PDF generation failed');
    } finally {
      setPdfLoading(false);
    }
  }

  function handleExportReportCSV() {
    if (!report) return;
    const rows: Record<string, string | number>[] = report.lineItems.map((item) => ({
      Type: item.type,
      Species: item.species || '',
      Count: item.count,
      'Daily Rate': item.dailyRate.toFixed(2),
      Days: item.days,
      Subtotal: item.subtotal.toFixed(2),
    }));
    rows.push({ Type: '', Species: '', Count: '', 'Daily Rate': '', Days: 'Total', Subtotal: report.summary.total.toFixed(2) });
    downloadCSV(`billing-report-${form.startDate}-to-${form.endDate}.csv`, rows);
  }

  function handleExportInvoicesCSV() {
    const rows = displayInvoices.map((inv) => ({
      Month: inv.month,
      Animals: inv.animalCount,
      Reports: inv.reportCount,
      'Animal Cost': inv.animalCost.toFixed(2),
      'Cage Cost': inv.cageCost.toFixed(2),
      Total: inv.totalAmount.toFixed(2),
      Status: inv.status,
    }));
    downloadCSV('invoices.csv', rows);
  }

  // 年度汇总：按年分组
  const annualInvoices = invoices.reduce<Record<string, { year: string; totalAmount: number; animalCost: number; cageCost: number; months: number }>>((acc, inv) => {
    const year = inv.month.split('-')[0];
    if (!acc[year]) acc[year] = { year, totalAmount: 0, animalCost: 0, cageCost: 0, months: 0 };
    acc[year].totalAmount += inv.totalAmount;
    acc[year].animalCost += inv.animalCost;
    acc[year].cageCost += inv.cageCost;
    acc[year].months++;
    return acc;
  }, {});

  const displayInvoices = invoiceView === 'monthly' ? invoices : [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Billing Report</h1>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <form
        onSubmit={handleGenerate}
        className="bg-white rounded-xl p-6 border border-gray-200 mb-6"
      >
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleQuickRange('this-month')}
              className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handleQuickRange('last-month')}
              className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => handleQuickRange('this-year')}
              className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              This Year
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </form>

      {report && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {pdfLoading ? 'Signing & Generating PDF...' : 'Download Signed PDF'}
          </button>
          <button
            onClick={handleExportReportCSV}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
          >
            Export CSV
          </button>
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">Animal Cost</div>
              <div className="text-2xl font-bold">${report.summary.animalCost.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-sm text-gray-500">Cage Cost</div>
              <div className="text-2xl font-bold">${report.summary.cageCost.toFixed(2)}</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="text-sm text-blue-600">Total</div>
              <div className="text-2xl font-bold text-blue-700">
                ${report.summary.total.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 mb-4">
            Period: {report.period.startDate} to {report.period.endDate} ({report.period.days} days)
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Species</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Count</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                    Daily Rate
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Days</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No billing data
                    </td>
                  </tr>
                ) : (
                  report.lineItems.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-sm capitalize">{item.type}</td>
                      <td className="px-4 py-3 text-sm capitalize">{item.species || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.count}</td>
                      <td className="px-4 py-3 text-sm text-right">${item.dailyRate.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.days}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        ${item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Invoice History */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoice History</h2>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setInvoiceView('monthly')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  invoiceView === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInvoiceView('annual')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  invoiceView === 'annual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Annual
              </button>
            </div>
            {invoices.length > 0 && (
              <button
                onClick={handleExportInvoicesCSV}
                className="px-3 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>

        {invoiceView === 'monthly' ? (
          invoices.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No invoices yet</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Month</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Animals</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Reports</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Animal Cost</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cage Cost</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-sm font-medium">{inv.month}</td>
                    <td className="px-4 py-3 text-sm text-right">{inv.animalCount}</td>
                    <td className="px-4 py-3 text-sm text-right">{inv.reportCount}</td>
                    <td className="px-4 py-3 text-sm text-right">${inv.animalCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right">${inv.cageCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">${inv.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          Object.keys(annualInvoices).length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No invoices yet</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Year</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Months</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Animal Cost</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Cage Cost</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(annualInvoices)
                  .sort((a, b) => b.year.localeCompare(a.year))
                  .map((yr) => (
                    <tr key={yr.year} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-sm font-medium">{yr.year}</td>
                      <td className="px-4 py-3 text-sm text-right">{yr.months}</td>
                      <td className="px-4 py-3 text-sm text-right">${yr.animalCost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">${yr.cageCost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">${yr.totalAmount.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
