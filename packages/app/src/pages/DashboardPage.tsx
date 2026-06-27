import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface DashboardStats {
  animalCount: number;
  roomCount: number;
  protocolCount: number;
  userCount: number;
  reportsThisMonth: number;
  plan: string;
  limits: { maxAnimals: number; maxUsers: number; maxReportsPerMonth: number };
  isOverLimit: boolean;
}

interface ExpiringProtocol {
  id: string;
  title: string;
  endDate: string;
  daysRemaining: number;
}

interface LicenseInfo {
  deployId: string;
  hasLicense: boolean;
  maxAnimals: number;
  maxReportsPerMonth: number;
  publicKeyConfigured: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  'academic-free': 'Academic Free',
  starter: 'Starter',
  professional: 'Professional',
  'enterprise-saas': 'Enterprise SaaS',
  'enterprise-self-hosted': 'Enterprise Self-Hosted',
};

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [expiringProtocols, setExpiringProtocols] = useState<ExpiringProtocol[]>([]);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const labId = api.getLabId();

  useEffect(() => {
    if (!labId) return;
    Promise.all([
      api.getBillingUsage(labId),
      api.getRooms(labId),
      api.getProtocols(labId),
      api.getLicenseStatus().catch(() => null),
    ])
      .then(([billing, rooms, protocols, license]) => {
        setStats({
          animalCount: billing.usage.animalCount,
          roomCount: rooms.length,
          protocolCount: protocols.length,
          userCount: billing.usage.userCount,
          reportsThisMonth: billing.usage.reportsThisMonth,
          plan: billing.plan,
          limits: billing.limits,
          isOverLimit: billing.isOverLimit,
        });

        // 计算即将到期的协议（30天内）
        const now = Date.now();
        const expiring = protocols
          .filter((p: any) => p.status === 'approved' && p.endDate)
          .map((p: any) => {
            const end = new Date(p.endDate).getTime();
            const days = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
            return { id: p.id, title: p.title, endDate: p.endDate, daysRemaining: days };
          })
          .filter((p: ExpiringProtocol) => p.daysRemaining > 0 && p.daysRemaining <= 30)
          .sort((a: ExpiringProtocol, b: ExpiringProtocol) => a.daysRemaining - b.daysRemaining);
        setExpiringProtocols(expiring);

        if (license) setLicenseInfo(license);
      })
      .catch(() => {});
  }, [labId]);

  const cards = [
    { label: 'Total Animals', value: stats?.animalCount ?? '-', icon: '🐭', color: 'bg-blue-50 text-blue-700' },
    { label: 'Rooms', value: stats?.roomCount ?? '-', icon: '🏠', color: 'bg-green-50 text-green-700' },
    { label: 'Active Protocols', value: stats?.protocolCount ?? '-', icon: '📋', color: 'bg-purple-50 text-purple-700' },
    { label: 'Users', value: stats?.userCount ?? '-', icon: '👥', color: 'bg-orange-50 text-orange-700' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {stats && (
          <span className="text-sm text-gray-500">
            Plan: {PLAN_LABELS[stats.plan] || stats.plan}
          </span>
        )}
      </div>

      {/* License 状态 */}
      {licenseInfo && (
        <div className={`mb-6 rounded-xl p-4 border ${
          licenseInfo.hasLicense
            ? 'bg-green-50 border-green-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {licenseInfo.hasLicense ? '✅' : '⚠️'}
            </span>
            <div>
              <div className="font-medium text-sm">
                License: {licenseInfo.hasLicense ? 'Verified' : 'Free Tier'}
              </div>
              <div className="text-xs text-gray-500">
                Deploy: {licenseInfo.deployId?.slice(0, 8) || 'N/A'} •
                Max animals: {licenseInfo.maxAnimals === -1 ? '∞' : licenseInfo.maxAnimals} •
                Reports/month: {licenseInfo.maxReportsPerMonth === -1 ? '∞' : licenseInfo.maxReportsPerMonth}
              </div>
            </div>
            {!licenseInfo.hasLicense && (
              <a href="/subscriptions" className="ml-auto text-sm text-blue-600 hover:underline">
                Upgrade →
              </a>
            )}
          </div>
        </div>
      )}

      {/* 协议到期预警 */}
      {expiringProtocols.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">⏰</span>
            <h3 className="font-semibold text-amber-800">Protocols Expiring Soon</h3>
          </div>
          <div className="space-y-2">
            {expiringProtocols.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-amber-900 truncate mr-4">{p.title}</span>
                <span className={`font-medium whitespace-nowrap ${
                  p.daysRemaining <= 7 ? 'text-red-600' : 'text-amber-600'
                }`}>
                  {p.daysRemaining} day{p.daysRemaining !== 1 ? 's' : ''} left
                </span>
              </div>
            ))}
          </div>
          <a href="/protocols" className="inline-block mt-3 text-sm text-amber-700 hover:underline">
            View all protocols →
          </a>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-6`}>
            <div className="text-3xl mb-2">{card.icon}</div>
            <div className="text-3xl font-bold">{card.value}</div>
            <div className="text-sm opacity-75">{card.label}</div>
          </div>
        ))}
      </div>

      {/* 使用量进度条 */}
      {stats && (
        <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Usage</h2>
          <div className="space-y-4">
            <UsageBar label="Animals" current={stats.animalCount} max={stats.limits.maxAnimals} />
            <UsageBar label="Users" current={stats.userCount} max={stats.limits.maxUsers} />
            <UsageBar
              label="Reports this month"
              current={stats.reportsThisMonth}
              max={stats.limits.maxReportsPerMonth}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/animals" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center">
            <div className="text-2xl mb-1">➕</div>
            <div className="text-sm font-medium">Add Animal</div>
          </a>
          <a href="/rooms" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center">
            <div className="text-2xl mb-1">🏠</div>
            <div className="text-sm font-medium">Manage Rooms</div>
          </a>
          <a href="/protocols" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center">
            <div className="text-2xl mb-1">📋</div>
            <div className="text-sm font-medium">View Protocols</div>
          </a>
          <a href="/subscriptions" className="block p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-center">
            <div className="text-2xl mb-1">💳</div>
            <div className="text-sm font-medium">Subscriptions</div>
          </a>
        </div>
      </div>
    </div>
  );
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const unlimited = max === -1;
  const percent = unlimited ? 0 : Math.min(100, (current / max) * 100);
  const overLimit = !unlimited && current > max;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={overLimit ? 'text-red-600 font-medium' : 'text-gray-500'}>
          {current} / {unlimited ? '∞' : max}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${overLimit ? 'bg-red-500' : percent > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}
    </div>
  );
}
