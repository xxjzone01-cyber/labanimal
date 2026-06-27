import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { trackEvent } from '../lib/posthog';

interface SubscriptionData {
  planId: string;
  status: string;
  provider: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

interface BillingData {
  plan: string;
  subscription: SubscriptionData;
  limits: { maxAnimals: number; maxUsers: number; maxReportsPerMonth: number };
  usage: { animalCount: number; userCount: number; reportsThisMonth: number };
}

const PLANS = [
  {
    id: 'academic-free',
    name: 'Academic Free',
    price: '$0/月',
    animals: '500',
    users: '10',
    reports: '3份/月',
    api: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$99/月',
    animals: '1,000',
    users: '15',
    reports: '无限',
    api: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$299/月',
    animals: '15,000',
    users: '40',
    reports: '无限',
    api: true,
  },
  {
    id: 'enterprise-saas',
    name: 'Enterprise SaaS',
    price: '$499/月',
    animals: '无限',
    users: '无限',
    reports: '无限',
    api: true,
  },
];

export function SubscriptionsPage() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const labId = api.getLabId();

  useEffect(() => {
    if (!labId) {
      setLoading(false);
      return;
    }
    api
      .getBillingUsage(labId)
      .then(setBilling)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [labId]);

  const handleSubscribe = async (planId: string) => {
    if (!labId) return;
    setActionLoading(planId);
    try {
      const result = await api.createSubscription(planId, labId);
      if (result.approveUrl) {
        // PayPal 付费套餐：跳转到 PayPal 审批页面
        trackEvent('subscription_upgraded', { planId });
        window.location.href = result.approveUrl;
      } else {
        // 免费套餐：直接激活
        setBilling(null);
        // 重新获取
        const fresh = await api.getBillingUsage(labId);
        setBilling(fresh);
      }
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!labId || !confirm('确定要取消订阅吗？当前计费周期结束前仍可使用。')) return;
    setActionLoading('cancel');
    try {
      await api.cancelSubscription(labId);
      const fresh = await api.getBillingUsage(labId);
      setBilling(fresh);
    } catch (err: any) {
      alert(err.message || '取消失败');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  const currentPlan = billing?.plan || 'academic-free';

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">订阅管理</h1>
      <p className="text-gray-500 mb-8">管理您的套餐和使用量</p>

      {/* 当前状态 */}
      {billing && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">
                当前套餐: {PLANS.find((p) => p.id === currentPlan)?.name || currentPlan}
              </h2>
              <p className="text-sm text-gray-500">
                状态:{' '}
                {billing.subscription.status === 'active' ? '生效中' : billing.subscription.status}
                {billing.subscription.cancelAtPeriodEnd && ' (将在计费周期结束时取消)'}
              </p>
            </div>
            {billing.subscription.provider !== 'free' &&
              billing.subscription.status === 'active' && (
                <button
                  onClick={handleCancel}
                  disabled={actionLoading === 'cancel'}
                  className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {actionLoading === 'cancel' ? '处理中...' : '取消订阅'}
                </button>
              )}
          </div>

          {/* 使用量 */}
          <div className="grid grid-cols-3 gap-4">
            <UsageCard
              label="动物数量"
              current={billing.usage.animalCount}
              max={billing.limits.maxAnimals}
            />
            <UsageCard
              label="用户数量"
              current={billing.usage.userCount}
              max={billing.limits.maxUsers}
            />
            <UsageCard
              label="本月报告"
              current={billing.usage.reportsThisMonth}
              max={billing.limits.maxReportsPerMonth}
            />
          </div>
        </div>
      )}

      {/* 套餐列表 */}
      <h2 className="text-lg font-semibold mb-4">选择套餐</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isDowngrade =
            PLANS.findIndex((p) => p.id === currentPlan) > PLANS.findIndex((p) => p.id === plan.id);
          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border-2 p-6 transition-colors ${
                isCurrent ? 'border-blue-500' : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              {isCurrent && (
                <span className="inline-block px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 rounded mb-3">
                  当前套餐
                </span>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="text-2xl font-bold text-blue-600 my-2">{plan.price}</p>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                <li>{plan.animals} 动物</li>
                <li>{plan.users} 用户</li>
                <li>{plan.reports} 报告</li>
                <li>{plan.api ? 'API 访问' : '无 API 访问'}</li>
              </ul>
              {!isCurrent && (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={actionLoading !== null}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    isDowngrade
                      ? 'text-gray-600 border border-gray-300 hover:bg-gray-50'
                      : 'text-white bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {actionLoading === plan.id ? '处理中...' : isDowngrade ? '降级' : '升级'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UsageCard({ label, current, max }: { label: string; current: number; max: number }) {
  const unlimited = max === -1;
  const percent = unlimited ? 0 : Math.min(100, (current / max) * 100);
  const overLimit = !unlimited && current > max;

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold">
        {current}
        <span className="text-sm font-normal text-gray-400">
          {' / '}
          {unlimited ? '∞' : max}
        </span>
      </div>
      {!unlimited && (
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${overLimit ? 'bg-red-500' : percent > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      )}
    </div>
  );
}
