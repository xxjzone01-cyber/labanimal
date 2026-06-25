import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Protocol {
  id: string;
  title: string;
  piName: string;
  iacucNumber: string | null;
  status: string;
  painCategory: string | null;
  startDate: string | null;
  endDate: string | null;
  animalCount: number;
  animalLimit: number | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-500',
};

export function ProtocolsPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newProtocol, setNewProtocol] = useState({
    title: '',
    piName: '',
    iacucNumber: '',
    painCategory: 'C',
    animalLimit: '',
    startDate: '',
    endDate: '',
    description: '',
  });

  useEffect(() => {
    loadProtocols();
  }, []);

  async function loadProtocols() {
    try {
      setLoading(true);
      const data = await api.getProtocols(api.getLabId());
      setProtocols(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createProtocol({
        labId: api.getLabId(),
        title: newProtocol.title,
        piName: newProtocol.piName,
        iacucNumber: newProtocol.iacucNumber || undefined,
        painCategory: newProtocol.painCategory,
        animalLimit: newProtocol.animalLimit ? parseInt(newProtocol.animalLimit) : undefined,
        startDate: newProtocol.startDate || undefined,
        endDate: newProtocol.endDate || undefined,
        description: newProtocol.description || undefined,
      });
      setShowAdd(false);
      setNewProtocol({
        title: '',
        piName: '',
        iacucNumber: '',
        painCategory: 'C',
        animalLimit: '',
        startDate: '',
        endDate: '',
        description: '',
      });
      loadProtocols();
    } catch (err: any) {
      console.error(err);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">IACUC Protocols</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + New Protocol
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Protocol</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                value={newProtocol.title}
                onChange={(e) => setNewProtocol({ ...newProtocol, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PI Name *</label>
              <input
                value={newProtocol.piName}
                onChange={(e) => setNewProtocol({ ...newProtocol, piName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IACUC Number</label>
              <input
                value={newProtocol.iacucNumber}
                onChange={(e) => setNewProtocol({ ...newProtocol, iacucNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pain Category</label>
              <select
                value={newProtocol.painCategory}
                onChange={(e) => setNewProtocol({ ...newProtocol, painCategory: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="B">B — No procedures</option>
                <option value="C">C — No pain</option>
                <option value="D">D — Pain alleviated</option>
                <option value="E">E — Unalleviated pain</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Animal Limit</label>
              <input
                value={newProtocol.animalLimit}
                onChange={(e) => setNewProtocol({ ...newProtocol, animalLimit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                value={newProtocol.startDate}
                onChange={(e) => setNewProtocol({ ...newProtocol, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                value={newProtocol.endDate}
                onChange={(e) => setNewProtocol({ ...newProtocol, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                type="date"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">PI</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">IACUC #</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Pain</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Animals</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : protocols.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No protocols found
                </td>
              </tr>
            ) : (
              protocols.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 text-sm font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-sm">{p.piName}</td>
                  <td className="px-4 py-3 text-sm font-mono">{p.iacucNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {p.painCategory && (
                      <span className="inline-block px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
                        {p.painCategory}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full ${statusColors[p.status] || 'bg-gray-100'}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.animalCount}
                    {p.animalLimit ? ` / ${p.animalLimit}` : ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
