import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  diff: any;
  hash: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => { loadEntries(); }, []);

  async function loadEntries() {
    try {
      setLoading(true);
      const data = await api.getAuditLog(api.getLabId());
      setEntries(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    try {
      const result = await api.verifyAuditLog(api.getLabId());
      setVerification(result);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <button onClick={handleVerify} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
          Verify Hash Chain
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {verification && (
        <div className={`px-4 py-3 rounded-lg mb-4 text-sm ${verification.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {verification.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Time</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Action</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Entity</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Changes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No audit entries</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm">{e.user.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      e.action === 'create' ? 'bg-green-100 text-green-700' :
                      e.action === 'update' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{e.entityType}/{e.entityId}</td>
                  <td className="px-4 py-3 text-sm max-w-xs truncate">{JSON.stringify(e.diff)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
