/**
 * 轻量级进程内监控
 *
 * 零外部依赖，记录请求计数、错误率、响应时间、内存使用。
 * 每分钟聚合一次快照，保留最近 60 个快照（1 小时数据）。
 */

interface RequestSnapshot {
  timestamp: number;
  totalRequests: number;
  totalErrors: number;       // 4xx + 5xx
  serverErrors: number;      // 5xx only
  avgResponseMs: number;
  p95ResponseMs: number;
  p99ResponseMs: number;
}

interface MetricsSnapshot extends RequestSnapshot {
  uptime: number;
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  activeConnections: number;
}

// 当前分钟的原始数据
let currentMinute = {
  startTime: Date.now(),
  totalRequests: 0,
  totalErrors: 0,
  serverErrors: 0,
  responseTimes: [] as number[],
};

// 历史快照（保留 60 个 = 1 小时）
const snapshots: MetricsSnapshot[] = [];
const MAX_SNAPSHOTS = 60;

// 告警状态
const alertState = {
  lastDbAlert: 0,
  lastErrorRateAlert: 0,
  lastMemoryAlert: 0,
  lastSlowResponseAlert: 0,
};
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 分钟冷却

let activeConnections = 0;
let startTime = Date.now();

/** 记录请求完成 */
export function recordRequest(statusCode: number, responseTimeMs: number): void {
  currentMinute.totalRequests++;
  if (statusCode >= 400) currentMinute.totalErrors++;
  if (statusCode >= 500) currentMinute.serverErrors++;
  if (currentMinute.responseTimes.length < 10000) {
    currentMinute.responseTimes.push(responseTimeMs);
  }
}

/** 增加活跃连接 */
export function incrementConnections(): void {
  activeConnections++;
}

/** 减少活跃连接 */
export function decrementConnections(): void {
  activeConnections = Math.max(0, activeConnections - 1);
}

/** 计算百分位数 */
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** 聚合当前分钟数据为快照 */
function aggregateSnapshot(): void {
  const now = Date.now();
  const times = currentMinute.responseTimes;

  const snapshot: MetricsSnapshot = {
    timestamp: now,
    totalRequests: currentMinute.totalRequests,
    totalErrors: currentMinute.totalErrors,
    serverErrors: currentMinute.serverErrors,
    avgResponseMs: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    p95ResponseMs: percentile(times, 95),
    p99ResponseMs: percentile(times, 99),
    uptime: now - startTime,
    memory: {
      rss: process.memoryUsage().rss,
      heapUsed: process.memoryUsage().heapUsed,
      heapTotal: process.memoryUsage().heapTotal,
      external: process.memoryUsage().external,
    },
    activeConnections,
  };

  snapshots.push(snapshot);
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();

  // 重置当前分钟
  currentMinute = {
    startTime: now,
    totalRequests: 0,
    totalErrors: 0,
    serverErrors: 0,
    responseTimes: [],
  };
}

// 每分钟聚合一次
const AGGREGATE_INTERVAL_MS = 60 * 1000;
let aggregateTimer: ReturnType<typeof setInterval> | null = null;

export function startMonitor(): void {
  if (process.env.VITEST || process.env.JEST_WORKER_ID) return;
  if (aggregateTimer) return;

  aggregateTimer = setInterval(aggregateSnapshot, AGGREGATE_INTERVAL_MS);
  console.log('[Monitor] Request metrics collection started');
}

export function stopMonitor(): void {
  if (aggregateTimer) {
    clearInterval(aggregateTimer);
    aggregateTimer = null;
  }
}

/** 获取当前指标摘要 */
export function getMetrics(): {
  current: Omit<MetricsSnapshot, 'timestamp'>;
  history: MetricsSnapshot[];
  alerts: typeof alertState;
} {
  // 生成一个实时快照（不入库）
  const mem = process.memoryUsage();
  const times = currentMinute.responseTimes;

  return {
    current: {
      totalRequests: currentMinute.totalRequests,
      totalErrors: currentMinute.totalErrors,
      serverErrors: currentMinute.serverErrors,
      avgResponseMs: times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      p95ResponseMs: percentile(times, 95),
      p99ResponseMs: percentile(times, 99),
      uptime: Date.now() - startTime,
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external },
      activeConnections,
    },
    history: snapshots,
    alerts: { ...alertState },
  };
}

/** 检查是否需要触发告警（返回需要告警的描述列表） */
export function checkAlerts(dbHealthy: boolean): string[] {
  const now = Date.now();
  const alerts: string[] = [];

  // 数据库不健康
  if (!dbHealthy && now - alertState.lastDbAlert > ALERT_COOLDOWN_MS) {
    alerts.push('Database connection failed');
    alertState.lastDbAlert = now;
  }

  // 5xx 错误率 > 10%（最近 5 个快照）
  const recent = snapshots.slice(-5);
  if (recent.length >= 3) {
    const totalReqs = recent.reduce((s, snap) => s + snap.totalRequests, 0);
    const total5xx = recent.reduce((s, snap) => s + snap.serverErrors, 0);
    if (totalReqs > 10 && total5xx / totalReqs > 0.1 && now - alertState.lastErrorRateAlert > ALERT_COOLDOWN_MS) {
      alerts.push(`High 5xx error rate: ${Math.round((total5xx / totalReqs) * 100)}% (${total5xx}/${totalReqs})`);
      alertState.lastErrorRateAlert = now;
    }
  }

  // 内存使用 > 80% 堆上限
  const mem = process.memoryUsage();
  const heapUsagePercent = mem.heapUsed / mem.heapTotal;
  if (heapUsagePercent > 0.8 && now - alertState.lastMemoryAlert > ALERT_COOLDOWN_MS) {
    alerts.push(`High memory usage: ${Math.round(heapUsagePercent * 100)}% heap (${Math.round(mem.heapUsed / 1024 / 1024)}MB)`);
    alertState.lastMemoryAlert = now;
  }

  // P99 响应时间 > 5 秒（最近快照）
  if (recent.length > 0) {
    const latestP99 = recent[recent.length - 1].p99ResponseMs;
    if (latestP99 > 5000 && now - alertState.lastSlowResponseAlert > ALERT_COOLDOWN_MS) {
      alerts.push(`Slow response: P99 = ${latestP99}ms`);
      alertState.lastSlowResponseAlert = now;
    }
  }

  return alerts;
}
