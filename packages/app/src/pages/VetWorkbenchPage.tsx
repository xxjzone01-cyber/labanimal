import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Cage {
  id: string;
  position: string;
  status: string;
  capacity: number;
  isSingleHoused: boolean;
  singleHousingReason: string | null;
  animals: { id: string; internalId: string; species: string; status: string }[];
  enrichments: { id: string; type: string }[];
}

export function VetWorkbenchPage() {
  const [cages, setCages] = useState<Cage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rackId, setRackId] = useState('');
  const [selectedCage, setSelectedCage] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState({
    recordType: 'check',
    bodyConditionScore: '3',
    painScore: '',
    painScoreType: 'MGS',
    description: '',
    treatment: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (rackId) loadCages();
  }, [rackId]);

  async function loadCages() {
    try {
      setLoading(true);
      const data = await api.getCages(rackId);
      setCages(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchCheck(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCage) return;

    const cage = cages.find((c) => c.id === selectedCage);
    if (!cage || cage.animals.length === 0) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      let created = 0;
      for (const animal of cage.animals) {
        await api.createHealthRecord({
          animalId: animal.id,
          recordType: batchForm.recordType,
          bodyConditionScore: batchForm.bodyConditionScore
            ? parseInt(batchForm.bodyConditionScore)
            : undefined,
          painScore: batchForm.painScore ? parseFloat(batchForm.painScore) : undefined,
          painScoreType: batchForm.painScore ? batchForm.painScoreType : undefined,
          description: batchForm.description || undefined,
          treatment: batchForm.treatment || undefined,
        });
        created++;
      }
      setSuccess(`Created ${created} health records for cage ${cage.position}`);
      setSelectedCage(null);
      setBatchForm({
        recordType: 'check',
        bodyConditionScore: '3',
        painScore: '',
        painScoreType: 'MGS',
        description: '',
        treatment: '',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function getCageColor(cage: Cage): string {
    const count = cage.animals.length;
    if (count > cage.capacity) return 'border-red-300 bg-red-50';
    if (count === 0) return 'border-gray-200 bg-gray-50';
    if (count >= cage.capacity) return 'border-yellow-300 bg-yellow-50';
    if (count === cage.capacity - 1) return 'border-yellow-300 bg-yellow-50';
    return 'border-green-200 bg-green-50';
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Veterinary Workbench</h1>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {success}
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Rack ID</label>
        <input
          value={rackId}
          onChange={(e) => setRackId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
          placeholder="Enter rack ID to inspect"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cage Grid */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-3">Cages</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {loading ? (
              <div className="col-span-3 text-center text-gray-500">Loading...</div>
            ) : cages.length === 0 ? (
              <div className="col-span-3 text-center text-gray-500">
                Enter a rack ID to view cages
              </div>
            ) : (
              cages.map((cage) => (
                <button
                  key={cage.id}
                  onClick={() => setSelectedCage(cage.id === selectedCage ? null : cage.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedCage === cage.id ? 'ring-2 ring-blue-500 ' : ''
                  }${getCageColor(cage)}`}
                >
                  <div className="font-medium text-sm mb-1">{cage.position}</div>
                  <div className="text-xs text-gray-600 mb-1">
                    {cage.animals.length} / {cage.capacity} animals
                  </div>
                  {cage.isSingleHoused && (
                    <div className="text-xs text-orange-600">Single housing</div>
                  )}
                  {cage.animals.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      {cage.animals.map((a) => a.internalId).join(', ')}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Batch Health Check Form */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Cage Health Check</h2>
          {selectedCage ? (
            <form
              onSubmit={handleBatchCheck}
              className="bg-white rounded-xl p-4 border border-gray-200"
            >
              <div className="text-sm text-gray-600 mb-3">
                Checking {cages.find((c) => c.id === selectedCage)?.animals.length || 0} animals in
                cage <strong>{cages.find((c) => c.id === selectedCage)?.position}</strong>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Record Type
                  </label>
                  <select
                    value={batchForm.recordType}
                    onChange={(e) => setBatchForm({ ...batchForm, recordType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="check">Routine Check</option>
                    <option value="abnormal">Abnormal Finding</option>
                    <option value="treatment">Treatment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Body Condition Score (1-5)
                  </label>
                  <select
                    value={batchForm.bodyConditionScore}
                    onChange={(e) =>
                      setBatchForm({ ...batchForm, bodyConditionScore: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="1">1 - Emaciated</option>
                    <option value="2">2 - Underweight</option>
                    <option value="3">3 - Normal</option>
                    <option value="4">4 - Overweight</option>
                    <option value="5">5 - Obese</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pain Score (0-1, optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={batchForm.painScore}
                      onChange={(e) => setBatchForm({ ...batchForm, painScore: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="0.00"
                    />
                    <select
                      value={batchForm.painScoreType}
                      onChange={(e) =>
                        setBatchForm({ ...batchForm, painScoreType: e.target.value })
                      }
                      className="px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="MGS">MGS</option>
                      <option value="RGS">RGS</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <input
                    value={batchForm.description}
                    onChange={(e) => setBatchForm({ ...batchForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Observations..."
                  />
                </div>

                {batchForm.recordType === 'treatment' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Treatment
                    </label>
                    <input
                      value={batchForm.treatment}
                      onChange={(e) => setBatchForm({ ...batchForm, treatment: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Treatment protocol..."
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Recording...' : 'Record for All Animals'}
              </button>
            </form>
          ) : (
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 text-center text-sm text-gray-500">
              Select a cage to perform batch health checks
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
