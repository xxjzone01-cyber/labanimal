/**
 * API integration test helper
 * Assumes API is running on localhost:3001
 */

const API_BASE = 'http://localhost:3001/api';

let authToken: string | null = null;
let labId: string | null = null;

export async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export function setToken(token: string | null) {
  authToken = token;
}

export function getToken(): string | null {
  return authToken;
}

export function setLabId(id: string) {
  labId = id;
}

export function getLabId(): string {
  return labId || '';
}

export async function loginAsAdmin(): Promise<string> {
  const res = await api('POST', '/auth/login', {
    email: 'admin@demo.lab',
    password: 'password',
  });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
  setToken(res.data.token);
  const id = res.data.labs?.[0]?.labId;
  if (id) setLabId(id);
  return res.data.token;
}

export async function loginAs(email: string, password = 'password'): Promise<string> {
  const res = await api('POST', '/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
  setToken(res.data.token);
  const id = res.data.labs?.[0]?.labId;
  if (id) setLabId(id);
  return res.data.token;
}

export function clearAuth() {
  authToken = null;
}

/** Create test infrastructure: room + rack + cage, return IDs */
export async function createTestInfra() {
  const room = await api('POST', '/rooms', {
    labId: getLabId(),
    name: `Test Room ${Date.now()}`,
  });
  const rack = await api('POST', '/racks', {
    roomId: room.data.id,
    name: `Test Rack ${Date.now()}`,
  });
  const cage = await api('POST', '/cages', {
    rackId: rack.data.id,
    position: `T-${Date.now()}`,
    capacity: 5,
  });
  return {
    roomId: room.data.id,
    rackId: rack.data.id,
    cageId: cage.data.id,
  };
}

/** Create a test animal, return its data */
export async function createTestAnimal(overrides?: Record<string, unknown>) {
  const res = await api('POST', '/animals', {
    labId: getLabId(),
    internalId: `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    species: 'mouse',
    sex: 'male',
    strain: 'C57BL/6J',
    ...overrides,
  });
  return res.data;
}
