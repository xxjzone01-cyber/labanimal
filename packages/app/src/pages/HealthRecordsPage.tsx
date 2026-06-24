import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface HealthRecord {
  id: string;
  animalId: string;
  recordType: string;
  weight: number | null;
  bodyConditionScore: number | null;
  painScore: number | null;
  painScoreType: string | null;
  description: string | null;
  treatment: string | null;
  euthanasiaMethodId: string | null;
  recordedAt: string;
  animal: { id: string; internalId: string; species: string };
  recorder: { id: string; name: string };
}

export function HealthRecordsPage() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newRecord, setNewRecord] = useState({
    animalId: '',
    recordType: 'check',
    weight: '',
    bodyConditionScore: '',
    painScore: '',
    painScoreType: 'MGS',
    description: '',
    treatment: '',
    euthanasiaMethodId: '',
  });

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    try {
      setLoading(true);
      const data = await api.getHealthRecords(api.getLabId());
      setRecords(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createHealthRecord({
        ...newRecord,
        weight: newRecord.weight ? parseFloat(newRecord.weight) : undefined,
        bodyConditionScore: newRecord.bodyConditionScore ? parseInt(newRecord.bodyConditionScore) : undefined,
        painScore: newRecord.painScore ? parseFloat(newRecord.painScore) : undefined,
        painScoreType: newRecord.painScore ? newRecord.painScoreType : undefined,
      });
      setShowAdd(false);
      setNewRecord({ animalId: '', recordType: 'check', weight: '', bodyConditionScore: '', painScore: '', painScoreType: 'MGS', description: '', treatment: '', euthanasiaMethodId: '' });
      loadRecords();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Health Records</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add Record
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add Health Record</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Animal ID</label>
              <input
                value={newRecord.animalId}
                onChange={(e) => setNewRecord({ ...newRecord, animalId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Record Type</label>
              <select
                value={newRecord.recordType}
                onChange={(e) => setNewRecord({ ...newRecord, recordType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="check">Check</option>
                <option value="abnormal">Abnormal</option>
                <option value="treatment">Treatment</option>
                <option value="euthanasia">Euthanasia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (g)</label>
              <input
                type="number"
                value={newRecord.weight}
                onChange={(e) => setNewRecord({ ...newRecord, weight: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Body Condition Score</label>
              <input
                type="number"
                min="1"
                max="5"
                value={newRecord.bodyConditionScore}
                onChange={(e) => setNewRecord({ ...newRecord, bodyConditionScore: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pain Score (0-1)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={newRecord.painScore}
                onChange={(e) => setNewRecord({ ...newRecord, painScore: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="0.00 - 1.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pain Scale</label>
              <select
                value={newRecord.painScoreType}
                onChange={(e) => setNewRecord({ ...newRecord, painScoreType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="MGS">MGS (Mouse Grimace Scale)</option>
                <option value="RGS">RGS (Rat Grimace Scale)</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                value={newRecord.description}
                onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            {newRecord.recordType === 'euthanasia' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Euthanasia Method</label>
                <select
                  value={newRecord.euthanasiaMethodId}
                  onChange={(e) => setNewRecord({ ...newRecord, euthanasiaMethodId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  required
                >
                  <option value="">Select method...</option>
                  <option value="co2_gradual">CO2 (Gradual)</option>
                  <option value="cervical_dislocation">Cervical Dislocation</option>
                  <option value="barbiturate_iv">Barbiturate (IV)</option>
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
              Create
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Animal</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Weight</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Pain</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Description</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Recorded By</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No records found</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{r.animal.internalId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      r.recordType === 'euthanasia' ? 'bg-red-100 text-red-700' :
                      r.recordType === 'abnormal' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {r.recordType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{r.weight ? `${r.weight}g` : '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {r.painScore != null ? (
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        r.painScore >= 0.6 ? 'bg-red-100 text-red-700' :
                        r.painScore >= 0.3 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {r.painScore.toFixed(2)} {r.painScoreType || ''}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">{r.description || '—'}</td>
                  <td className="px-4 py-3 text-sm">{r.recorder.name}</td>
                  <td className="px-4 py-3 text-sm">{new Date(r.recordedAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
