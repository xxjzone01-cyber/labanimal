import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Cage {
  id: string;
  position: string;
  status: string;
  capacity: number;
  isSingleHoused: boolean;
  singleHousingReason: string | null;
  animals: { id: string; internalId: string; species: string }[];
  enrichments: { id: string; type: string }[];
}

function getCageColor(cage: Cage): { border: string; bg: string; label: string } {
  const count = cage.animals.length;
  const cap = cage.capacity;

  // Over capacity → Red
  if (count > cap) {
    return { border: 'border-red-300', bg: 'bg-red-50', label: 'Over capacity' };
  }

  // Empty → Gray
  if (count === 0) {
    return { border: 'border-gray-200', bg: 'bg-gray-50', label: 'Empty' };
  }

  // At capacity → Yellow
  if (count >= cap) {
    return { border: 'border-yellow-300', bg: 'bg-yellow-50', label: 'At capacity' };
  }

  // Near capacity (1 slot left) → Yellow
  if (count === cap - 1) {
    return { border: 'border-yellow-300', bg: 'bg-yellow-50', label: 'Near capacity' };
  }

  // Normal occupancy → Green
  return { border: 'border-green-200', bg: 'bg-green-50', label: 'Occupied' };
}

interface TeachingHint {
  title: string;
  severity: 'warning' | 'danger';
  guidelines: string[];
  actions: string[];
}

const DENSITY_TEACHING_HINTS: Record<string, TeachingHint> = {
  'Over capacity': {
    title: 'Cage Over Density — Immediate Action Required',
    severity: 'danger',
    guidelines: [
      'OLAW/AALAC requires housing density to comply with the Guide for the Care and Use of Laboratory Animals.',
      'Overcrowding causes stress, aggression, and can compromise research outcomes.',
      "IACUC protocols may specify approved density exemptions — check the animal's protocol.",
      'Regulatory inspections (AAALAC, USDA) will cite over-density as a non-compliance finding.',
    ],
    actions: [
      'Redistribute animals to empty or under-populated cages on this rack.',
      "Request a density exemption on the animal's IACUC protocol if scientifically justified.",
      'Document the reason and duration if temporary overcrowding is unavoidable.',
      'Contact the facility manager or veterinarian if no suitable cages are available.',
    ],
  },
  'At capacity': {
    title: 'Cage at Maximum Capacity',
    severity: 'warning',
    guidelines: [
      'The cage has reached its species-specific maximum density per the Guide.',
      'Adding more animals will trigger a non-compliance condition.',
      'Monitor for signs of stress or aggression when cages are at full capacity.',
    ],
    actions: [
      'Plan to redistribute if new animals need housing in this rack.',
      'Review enrichment provisions to reduce stress at maximum density.',
      'Consider whether single housing is needed for any animal (document reason).',
    ],
  },
  'Near capacity': {
    title: 'Cage Approaching Capacity',
    severity: 'warning',
    guidelines: [
      'Only one more animal can be added before reaching maximum density.',
      'Pre-plan housing assignments to avoid accidental over-density.',
    ],
    actions: [
      'Identify backup cages on this or other racks for overflow.',
      'Check upcoming breeding or protocol transfers that may add animals.',
    ],
  },
};

export function CagesPage() {
  const [cages, setCages] = useState<Cage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rackId, setRackId] = useState('');
  const [teachingHint, setTeachingHint] = useState<{ cage: Cage; hint: TeachingHint } | null>(null);

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Cages</h1>
      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Rack ID</label>
        <input
          value={rackId}
          onChange={(e) => setRackId(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
          placeholder="Enter rack ID"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-4 text-center text-gray-500">Loading...</div>
        ) : cages.length === 0 ? (
          <div className="col-span-4 text-center text-gray-500">No cages found</div>
        ) : (
          cages.map((cage) => {
            const color = getCageColor(cage);
            const hint = DENSITY_TEACHING_HINTS[color.label];
            const isClickable = !!hint;

            return (
              <div
                key={cage.id}
                onClick={() => {
                  if (hint) setTeachingHint({ cage, hint });
                }}
                className={`p-4 rounded-xl border ${color.border} ${color.bg} ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{cage.position}</span>
                  <div className="flex items-center gap-1">
                    {hint && (
                      <span className="text-xs text-gray-400" title="Click for guidance">
                        ℹ️
                      </span>
                    )}
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        color.label === 'Over capacity'
                          ? 'bg-red-100 text-red-700'
                          : color.label === 'Empty'
                            ? 'bg-gray-100 text-gray-500'
                            : color.label === 'At capacity' || color.label === 'Near capacity'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {color.label}
                    </span>
                  </div>
                </div>
                <div className="text-xs font-medium mb-1">
                  {cage.animals.length} / {cage.capacity} animals
                </div>
                {cage.isSingleHoused && (
                  <div className="text-xs text-orange-600 mb-1">
                    Single housing: {cage.singleHousingReason || 'Yes'}
                  </div>
                )}
                {cage.animals.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">
                    {cage.animals.map((a) => a.internalId).join(', ')}
                  </div>
                )}
                {cage.enrichments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {cage.enrichments.map((e) => (
                      <span
                        key={e.id}
                        className="px-1 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
                      >
                        {e.type}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 教学提示弹窗 */}
      {teachingHint && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setTeachingHint(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`px-6 py-4 ${teachingHint.hint.severity === 'danger' ? 'bg-red-50 border-b border-red-100' : 'bg-amber-50 border-b border-amber-100'}`}
            >
              <div className="flex items-center justify-between">
                <h3
                  className={`text-lg font-semibold ${teachingHint.hint.severity === 'danger' ? 'text-red-800' : 'text-amber-800'}`}
                >
                  {teachingHint.hint.severity === 'danger' ? '🚨' : '⚠️'} {teachingHint.hint.title}
                </h3>
                <button
                  onClick={() => setTeachingHint(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              </div>
              <p className="text-sm mt-1 ${teachingHint.hint.severity === 'danger' ? 'text-red-600' : 'text-amber-600'}">
                Cage: <strong>{teachingHint.cage.position}</strong> —{' '}
                {teachingHint.cage.animals.length} / {teachingHint.cage.capacity} animals
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Regulatory Guidelines</h4>
                <ul className="space-y-1.5">
                  {teachingHint.hint.guidelines.map((g, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Recommended Actions</h4>
                <ul className="space-y-1.5">
                  {teachingHint.hint.actions.map((a, i) => (
                    <li key={i} className="text-sm text-gray-600 flex gap-2">
                      <span className="text-blue-500 mt-0.5">→</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setTeachingHint(null)}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
