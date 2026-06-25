const API_BASE = import.meta.env.VITE_API_BASE || '/api';

class ApiClient {
  private token: string | null = null;
  private labId: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  setLabId(labId: string | null) {
    this.labId = labId;
    if (labId) {
      localStorage.setItem('labId', labId);
    } else {
      localStorage.removeItem('labId');
    }
  }

  getLabId(): string {
    if (!this.labId) {
      this.labId = localStorage.getItem('labId');
    }
    return this.labId || '';
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // Auth
  register(data: { email: string; password: string; name: string }) {
    return this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  login(data: { email: string; password: string }) {
    return this.request<{ user: any; token: string; labs: { labId: string; role: string }[] }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  }

  // Animals
  getAnimals(labId: string, params?: Record<string, string>) {
    const query = new URLSearchParams({ labId, ...params }).toString();
    return this.request<any>(`/animals?${query}`);
  }

  getAnimal(id: string) {
    return this.request<any>(`/animals/${id}`);
  }

  createAnimal(data: Record<string, any>) {
    return this.request<any>('/animals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateAnimal(id: string, data: Record<string, any>) {
    return this.request<any>(`/animals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteAnimal(id: string) {
    return this.request<any>(`/animals/${id}`, { method: 'DELETE' });
  }

  // Rooms
  getRooms(labId: string) {
    return this.request<any[]>(`/rooms?labId=${labId}`);
  }

  createRoom(data: Record<string, any>) {
    return this.request<any>('/rooms', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Protocols
  getProtocols(labId: string) {
    return this.request<any[]>(`/protocols?labId=${labId}`);
  }

  getProtocol(id: string) {
    return this.request<any>(`/protocols/${id}`);
  }

  createProtocol(data: Record<string, any>) {
    return this.request<any>('/protocols', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateProtocol(id: string, data: Record<string, any>) {
    return this.request<any>(`/protocols/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteProtocol(id: string) {
    return this.request<any>(`/protocols/${id}`, { method: 'DELETE' });
  }

  // Health Records
  getHealthRecords(labId: string, params?: Record<string, string>) {
    const query = new URLSearchParams({ labId, ...params }).toString();
    return this.request<any>(`/health-records?${query}`);
  }

  getHealthRecord(id: string) {
    return this.request<any>(`/health-records/${id}`);
  }

  createHealthRecord(data: Record<string, any>) {
    return this.request<any>('/health-records', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateHealthRecord(id: string, data: Record<string, any>) {
    return this.request<any>(`/health-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteHealthRecord(id: string) {
    return this.request<any>(`/health-records/${id}`, { method: 'DELETE' });
  }

  // Death Reports
  getDeathReports(labId: string, params?: Record<string, string>) {
    const query = new URLSearchParams({ labId, ...params }).toString();
    return this.request<any>(`/death-reports?${query}`);
  }

  createDeathReport(data: Record<string, any>) {
    return this.request<any>('/death-reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deleteDeathReport(id: string) {
    return this.request<any>(`/death-reports/${id}`, { method: 'DELETE' });
  }

  // Medications
  getMedications(labId: string, params?: Record<string, string>) {
    const query = new URLSearchParams({ labId, ...params }).toString();
    return this.request<any>(`/medications?${query}`);
  }

  createMedication(data: Record<string, any>) {
    return this.request<any>('/medications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deleteMedication(id: string) {
    return this.request<any>(`/medications/${id}`, { method: 'DELETE' });
  }

  // Breedings
  getBreedings(labId: string) {
    return this.request<any>(`/breedings?labId=${labId}`);
  }

  createBreeding(data: Record<string, any>) {
    return this.request<any>('/breedings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deleteBreeding(id: string) {
    return this.request<any>(`/breedings/${id}`, { method: 'DELETE' });
  }

  weanBreeding(id: string, data: { weanedCount: number; weaningDate?: string }) {
    return this.request<any>(`/breedings/${id}/wean`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Racks
  getRacks(roomId: string) {
    return this.request<any[]>(`/racks?roomId=${roomId}`);
  }

  createRack(data: Record<string, any>) {
    return this.request<any>('/racks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Cages
  getCages(rackId: string) {
    return this.request<any[]>(`/cages?rackId=${rackId}`);
  }

  createCage(data: Record<string, any>) {
    return this.request<any>('/cages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  assignAnimalToCage(cageId: string, animalId: string) {
    return this.request<any>(`/cages/${cageId}/assign-animal`, {
      method: 'POST',
      body: JSON.stringify({ animalId }),
    });
  }

  removeAnimalFromCage(cageId: string, animalId: string) {
    return this.request<any>(`/cages/${cageId}/remove-animal`, {
      method: 'POST',
      body: JSON.stringify({ animalId }),
    });
  }

  // Audit Log
  getAuditLog(labId: string, params?: Record<string, string>) {
    const query = new URLSearchParams({ labId, ...params }).toString();
    return this.request<any>(`/audit-log?${query}`);
  }

  verifyAuditLog(labId: string) {
    return this.request<any>(`/audit-log/verify?labId=${labId}`);
  }

  // Trainings
  getTrainings(labId: string, params?: Record<string, string>) {
    const query = new URLSearchParams({ labId, ...params }).toString();
    return this.request<any>(`/trainings?${query}`);
  }

  createTraining(data: Record<string, any>) {
    return this.request<any>('/trainings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  deleteTraining(id: string) {
    return this.request<any>(`/trainings/${id}`, { method: 'DELETE' });
  }

  // Work Sessions
  getWorkSessions(labId: string) {
    return this.request<any>(`/work-sessions?labId=${labId}`);
  }

  getActiveWorkSession(labId: string) {
    return this.request<any>(`/work-sessions/active?labId=${labId}`);
  }

  startWorkSession(labId: string) {
    return this.request<any>('/work-sessions', {
      method: 'POST',
      body: JSON.stringify({ labId }),
    });
  }

  endWorkSession(id: string) {
    return this.request<any>(`/work-sessions/${id}/end`, {
      method: 'PUT',
    });
  }

  // Enrichments
  getEnrichments(cageId: string) {
    return this.request<any[]>(`/enrichments?cageId=${cageId}`);
  }

  createEnrichment(data: Record<string, any>) {
    return this.request<any>('/enrichments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Rates
  getRates(labId: string) {
    return this.request<any[]>(`/rates?labId=${labId}`);
  }

  createRate(data: Record<string, any>) {
    return this.request<any>('/rates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  generateBilling(labId: string, startDate: string, endDate: string) {
    return this.request<any>(
      `/billing/generate?labId=${labId}&startDate=${startDate}&endDate=${endDate}`,
    );
  }

  // Electronic Signatures
  getSignatures(labId: string, params?: Record<string, string>) {
    const query = new URLSearchParams({ labId, ...params }).toString();
    return this.request<any>(`/electronic-signatures?${query}`);
  }

  createSignature(data: Record<string, any>) {
    return this.request<any>('/electronic-signatures', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  verifySignature(id: string) {
    return this.request<any>(`/electronic-signatures/${id}/verify`);
  }

  // Billing
  getBillingUsage(labId: string) {
    return this.request<any>(`/billing/usage?labId=${labId}`);
  }

  // Subscriptions
  getSubscriptionStatus(labId: string) {
    return this.request<any>(`/subscriptions/status?labId=${labId}`);
  }

  createSubscription(planId: string, labId: string) {
    return this.request<{
      subscriptionId?: string;
      approveUrl?: string;
      subscription?: any;
      message?: string;
    }>('/subscriptions/create', {
      method: 'POST',
      body: JSON.stringify({ planId, labId }),
    });
  }

  activateSubscription(subscriptionId: string, labId: string) {
    return this.request<any>('/subscriptions/activate', {
      method: 'POST',
      body: JSON.stringify({ subscriptionId, labId }),
    });
  }

  cancelSubscription(labId: string, reason?: string) {
    return this.request<any>('/subscriptions/cancel', {
      method: 'POST',
      body: JSON.stringify({ labId, reason }),
    });
  }

  // License
  getLicenseStatus() {
    return this.request<{
      deployId: string;
      hasLicense: boolean;
      maxAnimals: number;
      maxReportsPerMonth: number;
      publicKeyConfigured: boolean;
    }>('/license/status');
  }

  signReport(data: { reportHash?: string; reportData?: string }) {
    return this.request<{
      signature: string;
      status: string;
      deployId: string;
      verifyUrl: string;
      signedAt: string;
    }>('/license/sign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  verifyReport(signature: string, reportHash?: string) {
    return this.request<{ valid: boolean; data?: any; error?: string }>('/license/verify', {
      method: 'POST',
      body: JSON.stringify({ signature, reportHash }),
    });
  }

  /** 通过报告哈希从数据库查找签名并验证（公开端点，无需登录） */
  verifyReportByHash(reportHash: string) {
    return this.request<{
      valid: boolean;
      error?: string;
      message?: string;
      data?: { deployId?: string; signedAt?: string; reportHash?: string; status?: string };
    }>(`/license/verify/${reportHash}`);
  }

  renewLicense(deployId: string) {
    return this.request<{
      renewalCode: string;
      deployId: string;
      expiresAt: string;
      validDays: number;
    }>('/license/renew', {
      method: 'POST',
      body: JSON.stringify({ deployId }),
    });
  }
}

export const api = new ApiClient();
