import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface PlatformStats {
  totalLabs: number;
  totalUsers: number;
  totalAnimals: number;
  totalSubscriptions: number;
  activeSubscriptions: number;
  planDistribution: { planId: string; count: number }[];
  recentLabs: {
    id: string;
    name: string;
    institution: string | null;
    createdAt: string;
    userCount: number;
    animalCount: number;
    plan: string;
    subscriptionStatus: string;
  }[];
}

interface LabItem {
  id: string;
  name: string;
  institution: string | null;
  createdAt: string;
  userCount: number;
  animalCount: number;
  protocolCount: number;
  subscription: {
    planId: string;
    status: string;
    provider: string;
    currentPeriodEnd: string | null;
  } | null;
}

interface LabsResponse {
  labs: LabItem[];
  total: number;
  page: number;
  totalPages: number;
}

interface LabDetail {
  id: string;
  name: string;
  institution: string | null;
  address: string | null;
  createdAt: string;
  users: { id: string; email: string; name: string; role: string; joinedAt: string }[];
  subscription: any;
  stats: { animals: number; protocols: number; rooms: number; deathReports: number; apiKeys: number };
  animalStatusDistribution: { status: string; count: number }[];
}

const PLAN_LABELS: Record<string, string> = {
  'academic-free': 'Academic Free',
  starter: 'Starter',
  professional: 'Professional',
  'enterprise-saas': 'Enterprise SaaS',
  'enterprise-self-hosted': 'Enterprise Self-Hosted',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  cancelled: 'bg-yellow-100 text-yellow-800',
  expired: 'bg-red-100 text-red-800',
  suspended: 'bg-gray-100 text-gray-800',
  none: 'bg-gray-100 text-gray-500',
};

type Tab = 'overview' | 'labs' | 'subscriptions';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [labsData, setLabsData] = useState<LabsResponse | null>(null);
  const [selectedLab, setSelectedLab] = useState<LabDetail | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (tab === 'labs') loadLabs();
  }, [tab, page, search]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await api.get<PlatformStats>('/admin/stats');
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const loadLabs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const data = await api.get<LabsResponse>(`/admin/labs?${params}`);
      setLabsData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load labs');
    } finally {
      setLoading(false);
    }
  };

  const loadLabDetail = async (labId: string) => {
    try {
      const data = await api.get<LabDetail>(`/admin/labs/${labId}`);
      setSelectedLab(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load lab details');
    }
  };

  if (loading && !stats) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>;
  }

  if (error && !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <p className="text-sm text-gray-500 mt-2">Make sure you have admin role in a lab.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        {(['overview', 'labs', 'subscriptions'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelectedLab(null); }}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'overview' ? 'Overview' : t === 'labs' ? 'Labs' : 'Subscriptions'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Labs', value: stats.totalLabs, color: 'bg-blue-50 text-blue-700' },
              { label: 'Total Users', value: stats.totalUsers, color: 'bg-green-50 text-green-700' },
              { label: 'Total Animals', value: stats.totalAnimals, color: 'bg-purple-50 text-purple-700' },
              { label: 'Subscriptions', value: stats.totalSubscriptions, color: 'bg-orange-50 text-orange-700' },
              { label: 'Active', value: stats.activeSubscriptions, color: 'bg-emerald-50 text-emerald-700' },
            ].map((card) => (
              <div key={card.label} className={`rounded-lg p-4 ${card.color}`}>
                <div className="text-2xl font-bold">{card.value}</div>
                <div className="text-sm opacity-75">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Plan Distribution */}
          {stats.planDistribution.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Active Plan Distribution</h2>
              <div className="space-y-3">
                {stats.planDistribution.map((p) => (
                  <div key={p.planId} className="flex items-center gap-4">
                    <span className="w-40 text-sm font-medium">{PLAN_LABELS[p.planId] || p.planId}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4">
                      <div
                        className="bg-blue-600 rounded-full h-4"
                        style={{ width: `${(p.count / stats.activeSubscriptions) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-8 text-right">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Labs */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Labs</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Institution</th>
                  <th className="pb-2">Users</th>
                  <th className="pb-2">Animals</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLabs.map((lab) => (
                  <tr key={lab.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{lab.name}</td>
                    <td className="py-2 text-gray-600">{lab.institution || '-'}</td>
                    <td className="py-2">{lab.userCount}</td>
                    <td className="py-2">{lab.animalCount}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[lab.subscriptionStatus]}`}>
                        {PLAN_LABELS[lab.plan] || lab.plan}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{new Date(lab.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Labs Tab */}
      {tab === 'labs' && !selectedLab && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search labs..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg flex-1 max-w-md"
            />
          </div>

          {labsData && (
            <>
              <div className="bg-white rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b bg-gray-50">
                      <th className="p-3">Name</th>
                      <th className="p-3">Institution</th>
                      <th className="p-3">Users</th>
                      <th className="p-3">Animals</th>
                      <th className="p-3">Protocols</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labsData.labs.map((lab) => (
                      <tr key={lab.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="p-3 font-medium">{lab.name}</td>
                        <td className="p-3 text-gray-600">{lab.institution || '-'}</td>
                        <td className="p-3">{lab.userCount}</td>
                        <td className="p-3">{lab.animalCount}</td>
                        <td className="p-3">{lab.protocolCount}</td>
                        <td className="p-3">
                          {PLAN_LABELS[lab.subscription?.planId || ''] || 'academic-free'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[lab.subscription?.status || 'none']}`}>
                            {lab.subscription?.status || 'none'}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500">{new Date(lab.createdAt).toLocaleDateString()}</td>
                        <td className="p-3">
                          <button
                            onClick={() => loadLabDetail(lab.id)}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {labsData.totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    Page {labsData.page} of {labsData.totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(labsData.totalPages, p + 1))}
                    disabled={page === labsData.totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Lab Detail */}
      {tab === 'labs' && selectedLab && (
        <div className="space-y-6">
          <button
            onClick={() => setSelectedLab(null)}
            className="text-blue-600 hover:underline text-sm"
          >
            ← Back to Labs
          </button>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold">{selectedLab.name}</h2>
            <p className="text-gray-600">{selectedLab.institution || 'No institution'}</p>
            {selectedLab.address && <p className="text-sm text-gray-500 mt-1">{selectedLab.address}</p>}

            <div className="grid grid-cols-5 gap-4 mt-6">
              {Object.entries(selectedLab.stats).map(([key, val]) => (
                <div key={key} className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xl font-bold">{val}</div>
                  <div className="text-xs text-gray-500 capitalize">{key}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Subscription */}
          {selectedLab.subscription && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold mb-3">Subscription</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Plan:</span>{' '}
                  {PLAN_LABELS[selectedLab.subscription.planId] || selectedLab.subscription.planId}
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[selectedLab.subscription.status]}`}>
                    {selectedLab.subscription.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Provider:</span> {selectedLab.subscription.provider}
                </div>
                {selectedLab.subscription.currentPeriodEnd && (
                  <div>
                    <span className="text-gray-500">Period End:</span>{' '}
                    {new Date(selectedLab.subscription.currentPeriodEnd).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Users */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold mb-3">Members ({selectedLab.users.length})</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {selectedLab.users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2">{u.name}</td>
                    <td className="py-2 text-gray-600">{u.email}</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">{u.role}</span>
                    </td>
                    <td className="py-2 text-gray-500">{new Date(u.joinedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Animal Status Distribution */}
          {selectedLab.animalStatusDistribution.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="font-semibold mb-3">Animal Status Distribution</h3>
              <div className="flex gap-4">
                {selectedLab.animalStatusDistribution.map((s) => (
                  <div key={s.status} className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-lg font-bold">{s.count}</div>
                    <div className="text-xs text-gray-500 capitalize">{s.status}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscriptions Tab */}
      {tab === 'subscriptions' && <SubscriptionsTab />}
    </div>
  );
}

function SubscriptionsTab() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ subscriptions: any[] }>('/admin/subscriptions')
      .then((data) => setSubscriptions(data.subscriptions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-8 text-gray-500">Loading...</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b bg-gray-50">
            <th className="p-3">Lab</th>
            <th className="p-3">Plan</th>
            <th className="p-3">Status</th>
            <th className="p-3">Provider</th>
            <th className="p-3">Users</th>
            <th className="p-3">Animals</th>
            <th className="p-3">Period End</th>
            <th className="p-3">Cancel at End</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="p-3 font-medium">{sub.labName}</td>
              <td className="p-3">{PLAN_LABELS[sub.planId] || sub.planId}</td>
              <td className="p-3">
                <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[sub.status]}`}>
                  {sub.status}
                </span>
              </td>
              <td className="p-3">{sub.provider}</td>
              <td className="p-3">{sub.userCount}</td>
              <td className="p-3">{sub.animalCount}</td>
              <td className="p-3 text-gray-500">
                {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : '-'}
              </td>
              <td className="p-3">{sub.cancelAtPeriodEnd ? 'Yes' : 'No'}</td>
            </tr>
          ))}
          {subscriptions.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-gray-500">
                No subscriptions found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
