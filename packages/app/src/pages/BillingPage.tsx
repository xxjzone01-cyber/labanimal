import { useState } from 'react';
import { api } from '../lib/api';

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

export function BillingPage() {
  const [report, setReport] = useState<BillingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Billing Report</h1>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      <form onSubmit={handleGenerate} className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
        <div className="flex items-end gap-4">
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
              <div className="text-2xl font-bold text-blue-700">${report.summary.total.toFixed(2)}</div>
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
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Daily Rate</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Days</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {report.lineItems.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No billing data</td></tr>
                ) : (
                  report.lineItems.map((item, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-3 text-sm capitalize">{item.type}</td>
                      <td className="px-4 py-3 text-sm capitalize">{item.species || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.count}</td>
                      <td className="px-4 py-3 text-sm text-right">${item.dailyRate.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">{item.days}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
