import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface BillingData {
  plan: string;
  limits: { maxAnimals: number; maxUsers: number; maxReportsPerMonth: number };
  usage: { animalCount: number; userCount: number; reportsThisMonth: number };
  isOverLimit: boolean;
  overLimitReasons: string[];
}

const PLAN_LABELS: Record<string, string> = {
  'academic-free': 'Academic Free',
  'starter': 'Starter',
  'professional': 'Professional',
  'enterprise-saas': 'Enterprise SaaS',
  'enterprise-self-hosted': 'Enterprise Self-Hosted',
};

export function BillingBanner() {
  const [billing, setBilling] = useState<BillingData | null>(null);
  const labId = api.getLabId();

  useEffect(() => {
    if (!labId) return;
    api.getBillingUsage(labId)
      .then(setBilling)
      .catch(() => {});
  }, [labId]);

  if (!billing || !billing.isOverLimit) return null;

  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6 rounded-r-lg">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-amber-800">
            使用量超限 — {PLAN_LABELS[billing.plan] || billing.plan}
          </h3>
          <ul className="mt-1 text-sm text-amber-700 list-disc list-inside">
            {billing.overLimitReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-600">
            超限后报告将失去 RSA 合规签名（显示为 UNVERIFIED）。升级套餐以恢复签名能力。
          </p>
        </div>
        <a
          href="/subscriptions"
          className="shrink-0 ml-4 px-3 py-1.5 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
        >
          升级套餐
        </a>
      </div>
    </div>
  );
}
