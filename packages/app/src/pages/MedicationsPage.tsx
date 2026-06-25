import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Medication {
  id: string;
  animalId: string;
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  animal: { internalId: string };
}

export function MedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMedications();
  }, []);

  async function loadMedications() {
    try {
      setLoading(true);
      const data = await api.getMedications(api.getLabId());
      setMedications(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Medications</h1>
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Animal</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Dosage</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Route</th>
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
            ) : medications.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No medications
                </td>
              </tr>
            ) : (
              medications.map((m) => (
                <tr key={m.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{m.animal.internalId}</td>
                  <td className="px-4 py-3 text-sm font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-sm">{m.dosage}</td>
                  <td className="px-4 py-3 text-sm capitalize">{m.route}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-1 text-xs rounded-full ${m.endDate ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}
                    >
                      {m.endDate ? 'Completed' : 'Active'}
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
