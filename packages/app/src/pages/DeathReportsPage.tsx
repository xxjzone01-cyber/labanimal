import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface DeathReport {
  id: string;
  animalId: string;
  dateOfDeath: string;
  cause: string;
  euthanasiaMethodId: string | null;
  necropsyPerformed: boolean;
  animal: { internalId: string; species: string };
}

export function DeathReportsPage() {
  const [reports, setReports] = useState<DeathReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadReports(); }, []);

  async function loadReports() {
    try {
      setLoading(true);
      const data = await api.getDeathReports(api.getLabId());
      setReports(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Death Reports</h1>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Animal</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cause</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Necropsy</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No death reports</td></tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{r.animal.internalId}</td>
                  <td className="px-4 py-3 text-sm">{new Date(r.dateOfDeath).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm capitalize">{r.cause.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-sm">{r.necropsyPerformed ? 'Yes' : 'No'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
