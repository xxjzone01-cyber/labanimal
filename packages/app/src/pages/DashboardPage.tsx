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

const PLAN_LABELS: Record<string, string> = {
  'academic-free': 'Academic Free',
  'starter': 'Starter',
  'professional': 'Professional',
  'enterprise-saas': 'Enterprise SaaS',
  'enterprise-self-hosted': 'Enterprise Self-Hosted',
};

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const labId = api.getLabId();

  useEffect(() => {
    if (!labId) return;
    Promise.all([
      api.getBillingUsage(labId),
      api.getRooms(labId),
      api.getProtocols(labId),
    ]).then(([billing, rooms, protocols]) => {
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
    }).catch(() => {});
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
            套餐: {PLAN_LABELS[stats.plan] || stats.plan}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`${card.color} rounded-xl p-6`}
          >
            <div className="text-3xl mb-2">{card.icon}</div>
            <div className="text-3xl font-bold">{card.value}</div>
            <div className="text-sm opacity-75">{card.label}</div>
          </div>
        ))}
      </div>

      {/* 使用量进度条 */}
      {stats && (
        <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">使用量</h2>
          <div className="space-y-4">
            <UsageBar
              label="动物数量"
              current={stats.animalCount}
              max={stats.limits.maxAnimals}
            />
            <UsageBar
              label="用户数量"
              current={stats.userCount}
              max={stats.limits.maxUsers}
            />
            <UsageBar
              label="本月报告"
              current={stats.reportsThisMonth}
              max={stats.limits.maxReportsPerMonth}
            />
          </div>
        </div>
      )}

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
