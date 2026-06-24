import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Animal {
  id: string;
  internalId: string;
  species: string;
  strain: string | null;
  genotype: string | null;
  sex: string;
  status: string;
  cage: { position: string; rack: { name: string; room: { name: string } } } | null;
  identityLinks: { linkedTo: { id: string; internalId: string; status: string } }[];
  linkedFrom: { id: string; reason: string; animal: { id: string; internalId: string; status: string } }[];
}

export function AnimalsPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newAnimal, setNewAnimal] = useState({
    internalId: '',
    species: 'mouse',
    strain: '',
    genotype: '',
    sex: 'male',
    source: '',
  });

  useEffect(() => {
    loadAnimals();
  }, []);

  async function loadAnimals() {
    try {
      setLoading(true);
      // TODO: get labId from auth context
      const data = await api.getAnimals(api.getLabId());
      setAnimals(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createAnimal({ ...newAnimal, labId: api.getLabId() });
      setShowAdd(false);
      setNewAnimal({ internalId: '', species: 'mouse', strain: '', genotype: '', sex: 'male', source: '' });
      loadAnimals();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Animals</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Add Animal
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add New Animal</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Internal ID</label>
              <input
                value={newAnimal.internalId}
                onChange={(e) => setNewAnimal({ ...newAnimal, internalId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Species</label>
              <select
                value={newAnimal.species}
                onChange={(e) => setNewAnimal({ ...newAnimal, species: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="mouse">Mouse</option>
                <option value="rat">Rat</option>
                <option value="hamster">Hamster</option>
                <option value="guinea_pig">Guinea Pig</option>
                <option value="rabbit">Rabbit</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
              <select
                value={newAnimal.sex}
                onChange={(e) => setNewAnimal({ ...newAnimal, sex: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strain</label>
              <input
                value={newAnimal.strain}
                onChange={(e) => setNewAnimal({ ...newAnimal, strain: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., C57BL/6"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Genotype</label>
              <input
                value={newAnimal.genotype}
                onChange={(e) => setNewAnimal({ ...newAnimal, genotype: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Cre+/-"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <input
                value={newAnimal.source}
                onChange={(e) => setNewAnimal({ ...newAnimal, source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Jackson Lab"
              />
            </div>
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
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">ID</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Species</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Strain</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Sex</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Cage</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : animals.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No animals found</td></tr>
            ) : (
              animals.map((a) => (
                <tr key={a.id} className={`border-t border-gray-100 hover:bg-gray-50 ${a.status === 'retired' ? 'opacity-70' : ''}`}>
                  <td className="px-4 py-3 text-sm font-medium">
                    <div>{a.internalId}</div>
                    {a.status === 'retired' && a.identityLinks.length > 0 && (
                      <div className="text-xs text-blue-600 mt-1">
                        &rarr; {a.identityLinks.map(l => l.linkedTo.internalId).join(', ')}
                      </div>
                    )}
                    {a.linkedFrom.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Was: {a.linkedFrom.map(l => l.animal.internalId).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{a.species}</td>
                  <td className="px-4 py-3 text-sm">{a.strain || '—'}</td>
                  <td className="px-4 py-3 text-sm capitalize">{a.sex}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      a.status === 'active' ? 'bg-green-100 text-green-700' :
                      a.status === 'deceased' ? 'bg-gray-100 text-gray-500' :
                      a.status === 'retired' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {a.cage ? `${a.cage.rack.room.name} / ${a.cage.rack.name} / ${a.cage.position}` : '—'}
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
