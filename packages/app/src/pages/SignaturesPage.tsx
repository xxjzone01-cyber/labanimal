import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Signature {
  id: string;
  entityType: string;
  entityId: string;
  meaning: string;
  signatureHash: string;
  ipAddress: string | null;
  notes: string | null;
  signedAt: string;
  user: { id: string; name: string; email: string };
  protocol: { id: string; title: string } | null;
}

export function SignaturesPage() {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verification, setVerification] = useState<Record<string, boolean>>({});
  const [showSign, setShowSign] = useState(false);
  const [signForm, setSignForm] = useState({
    entityType: 'protocol',
    entityId: '',
    meaning: 'approved',
    notes: '',
  });
  const [signing, setSigning] = useState(false);
  const [lastSigned, setLastSigned] = useState<Signature | null>(null);

  useEffect(() => {
    loadSignatures();
  }, []);

  async function loadSignatures() {
    try {
      setLoading(true);
      const data = await api.getSignatures(api.getLabId());
      setSignatures(data.items || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(id: string) {
    try {
      const result = await api.verifySignature(id);
      setVerification((prev) => ({ ...prev, [id]: result.valid }));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    setSigning(true);
    setError('');
    try {
      const result = await api.createSignature({
        ...signForm,
        protocolId: signForm.entityType === 'protocol' ? signForm.entityId : undefined,
      });
      setLastSigned(result);
      setShowSign(false);
      setSignForm({ entityType: 'protocol', entityId: '', meaning: 'approved', notes: '' });
      loadSignatures();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSigning(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Electronic Signatures</h1>
        <button
          onClick={() => setShowSign(!showSign)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Create Signature
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {/* WYSIWYS: What You See Is What You Sign */}
      {showSign && (
        <div className="bg-white rounded-xl p-6 border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold mb-1">Create Electronic Signature</h2>
          <p className="text-xs text-gray-500 mb-4">
            21 CFR Part 11 compliant — review carefully before signing
          </p>

          <form onSubmit={handleSign}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity Type</label>
                <select
                  value={signForm.entityType}
                  onChange={(e) => setSignForm({ ...signForm, entityType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="protocol">Protocol</option>
                  <option value="health_record">Health Record</option>
                  <option value="death_report">Death Report</option>
                  <option value="breeding">Breeding Record</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entity ID</label>
                <input
                  value={signForm.entityId}
                  onChange={(e) => setSignForm({ ...signForm, entityId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Enter entity ID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Signature Meaning
                </label>
                <select
                  value={signForm.meaning}
                  onChange={(e) => setSignForm({ ...signForm, meaning: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="approved">Approved</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="witnessed">Witnessed</option>
                  <option value="authored">Authored</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <input
                  value={signForm.notes}
                  onChange={(e) => setSignForm({ ...signForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Additional context..."
                />
              </div>
            </div>

            {/* Preview before signing */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="text-sm font-medium text-amber-800 mb-2">Signature Preview</div>
              <div className="text-sm text-amber-700 space-y-1">
                <p>
                  I, <strong>the authenticated user</strong>, hereby sign:
                </p>
                <p>
                  <strong>Entity:</strong> {signForm.entityType} / {signForm.entityId || '...'}
                </p>
                <p>
                  <strong>Meaning:</strong> I have {signForm.meaning} this document
                </p>
                {signForm.notes && (
                  <p>
                    <strong>Notes:</strong> {signForm.notes}
                  </p>
                )}
                <p className="text-xs text-amber-600 mt-2">
                  This signature will be hashed with SHA-256 and recorded with timestamp and IP
                  address per 21 CFR Part 11.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={signing || !signForm.entityId}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {signing ? 'Signing...' : 'Sign Document'}
              </button>
              <button
                type="button"
                onClick={() => setShowSign(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Signature Certificate (last signed) */}
      {lastSigned && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-800">
              Signature Created Successfully
            </span>
            <button onClick={() => setLastSigned(null)} className="text-green-600 text-xs">
              Dismiss
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
            <div>
              <strong>Signature ID:</strong> {lastSigned.id}
            </div>
            <div>
              <strong>Signed By:</strong> {lastSigned.user.name} ({lastSigned.user.email})
            </div>
            <div>
              <strong>Entity:</strong> {lastSigned.entityType} / {lastSigned.entityId}
            </div>
            <div>
              <strong>Meaning:</strong> {lastSigned.meaning}
            </div>
            <div>
              <strong>Timestamp:</strong> {new Date(lastSigned.signedAt).toLocaleString()}
            </div>
            <div>
              <strong>IP Address:</strong> {lastSigned.ipAddress || 'N/A'}
            </div>
            <div className="col-span-2">
              <strong>SHA-256 Hash:</strong>{' '}
              <code className="text-xs break-all">{lastSigned.signatureHash}</code>
            </div>
          </div>
        </div>
      )}

      {/* Signatures Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Entity</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Meaning</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Signed At</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Hash</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : signatures.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No signatures
                </td>
              </tr>
            ) : (
              signatures.map((s) => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{s.user.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {s.entityType}/{s.entityId}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                      {s.meaning}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(s.signedAt).toLocaleString()}</td>
                  <td
                    className="px-4 py-3 text-xs font-mono text-gray-500 max-w-32 truncate"
                    title={s.signatureHash}
                  >
                    {s.signatureHash.slice(0, 16)}...
                  </td>
                  <td className="px-4 py-3">
                    {verification[s.id] !== undefined && (
                      <span
                        className={`inline-block px-2 py-1 text-xs rounded-full ${verification[s.id] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {verification[s.id] ? 'Valid' : 'Invalid'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleVerify(s.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Verify
                    </button>
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
