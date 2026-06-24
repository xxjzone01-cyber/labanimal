import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Breeding {
  id: string;
  sireId: string;
  damId: string;
  pairDate: string | null;
  litterDate: string | null;
  litterSize: number | null;
  weanedCount: number | null;
  weaningDate: string | null;
  sire: { internalId: string };
  dam: { internalId: string };
}

export function BreedingsPage() {
  const [breedings, setBreedings] = useState<Breeding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newBreeding, setNewBreeding] = useState({
    sireId: '',
    damId: '',
    pairDate: '',
    notes: '',
  });
  const [weanTarget, setWeanTarget] = useState<string | null>(null);
  const [weanForm, setWeanForm] = useState({ weanedCount: '', weaningDate: '' });

  useEffect(() => { loadBreedings(); }, []);

  async function loadBreedings() {
    try {
      setLoading(true);
      const data = await api.getBreedings(api.getLabId());
      setBreedings(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createBreeding({ ...newBreeding, labId: api.getLabId() });
      setShowAdd(false);
      setNewBreeding({ sireId: '', damId: '', pairDate: '', notes: '' });
      loadBreedings();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleWean(e: React.FormEvent) {
    e.preventDefault();
    if (!weanTarget) return;
    try {
      await api.weanBreeding(weanTarget, {
        weanedCount: parseInt(weanForm.weanedCount),
        weaningDate: weanForm.weaningDate || undefined,
      });
      setWeanTarget(null);
      setWeanForm({ weanedCount: '', weaningDate: '' });
      loadBreedings();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Breeding</h1>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Add Breeding
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add Breeding Record</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sire ID (Male)</label>
              <input value={newBreeding.sireId} onChange={(e) => setNewBreeding({ ...newBreeding, sireId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dam ID (Female)</label>
              <input value={newBreeding.damId} onChange={(e) => setNewBreeding({ ...newBreeding, damId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pair Date</label>
              <input type="date" value={newBreeding.pairDate} onChange={(e) => setNewBreeding({ ...newBreeding, pairDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Create</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Sire</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Dam</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Pair Date</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Litter Size</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Weaned</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Wean Date</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : breedings.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No breeding records</td></tr>
            ) : (
              breedings.map((b) => (
                <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{b.sire.internalId}</td>
                  <td className="px-4 py-3 text-sm">{b.dam.internalId}</td>
                  <td className="px-4 py-3 text-sm">{b.pairDate ? new Date(b.pairDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-sm">{b.litterSize ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">{b.weanedCount ?? '—'}</td>
                  <td className="px-4 py-3 text-sm">{b.weaningDate ? new Date(b.weaningDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {b.litterSize && !b.weaningDate && (
                      <button
                        onClick={() => { setWeanTarget(b.id); setWeanForm({ weanedCount: String(b.litterSize), weaningDate: '' }); }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                      >
                        Wean
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Wean Dialog */}
      {weanTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <form onSubmit={handleWean} className="bg-white rounded-xl p-6 border border-gray-200 w-96">
            <h2 className="text-lg font-semibold mb-4">Wean Litter</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weaned Count</label>
                <input
                  type="number"
                  min="0"
                  value={weanForm.weanedCount}
                  onChange={(e) => setWeanForm({ ...weanForm, weanedCount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weaning Date</label>
                <input
                  type="date"
                  value={weanForm.weaningDate}
                  onChange={(e) => setWeanForm({ ...weanForm, weaningDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Defaults to today if empty</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">Confirm Wean</button>
              <button type="button" onClick={() => setWeanTarget(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
