import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Training {
  id: string;
  userId: string;
  type: string;
  certificationNumber: string | null;
  issuedBy: string | null;
  issuedDate: string | null;
  expirationDate: string | null;
  status: string;
  user: { id: string; name: string };
}

export function TrainingsPage() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newTraining, setNewTraining] = useState({
    userId: '',
    type: 'aalas_lat',
    certificationNumber: '',
    issuedBy: '',
    expirationDate: '',
  });

  useEffect(() => {
    loadTrainings();
  }, []);

  async function loadTrainings() {
    try {
      setLoading(true);
      const data = await api.getTrainings(api.getLabId());
      setTrainings(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createTraining({ ...newTraining, labId: api.getLabId() });
      setShowAdd(false);
      setNewTraining({
        userId: '',
        type: 'aalas_lat',
        certificationNumber: '',
        issuedBy: '',
        expirationDate: '',
      });
      loadTrainings();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Training & Qualifications</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add Training
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add Training Record</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <input
                value={newTraining.userId}
                onChange={(e) => setNewTraining({ ...newTraining, userId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={newTraining.type}
                onChange={(e) => setNewTraining({ ...newTraining, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="aalas_lat">AALAS LAT</option>
                <option value="aalas_latg">AALAS LATG</option>
                <option value="iacuc_orientation">IACUC Orientation</option>
                <option value="species_specific">Species Specific</option>
                <option value="surgery">Surgery</option>
                <option value="euthanasia">Euthanasia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Certification Number
              </label>
              <input
                value={newTraining.certificationNumber}
                onChange={(e) =>
                  setNewTraining({ ...newTraining, certificationNumber: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expiration Date
              </label>
              <input
                type="date"
                value={newTraining.expirationDate}
                onChange={(e) => setNewTraining({ ...newTraining, expirationDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cert #</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Expires</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : trainings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No training records
                </td>
              </tr>
            ) : (
              trainings.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{t.user.name}</td>
                  <td className="px-4 py-3 text-sm capitalize">{t.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-sm">{t.certificationNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {t.expirationDate ? new Date(t.expirationDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full ${
                        t.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : t.status === 'expired'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {t.status}
                    </span>
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
