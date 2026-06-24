/**
 * E2E test helper — API client for Playwright tests
 */

const API_BASE = 'http://localhost:3001/api';

let authToken: string | null = null;

async function apiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export async function register(email: string, password: string, name: string) {
  return apiRequest('POST', '/auth/register', { email, password, name });
}

export async function login(email: string, password: string) {
  const res = await apiRequest('POST', '/auth/login', { email, password });
  if (res.data?.token) {
    authToken = res.data.token;
  }
  return res;
}

export async function get(path: string) {
  return apiRequest('GET', path);
}

export async function post(path: string, body: Record<string, unknown>) {
  return apiRequest('POST', path, body);
}

export async function put(path: string, body: Record<string, unknown>) {
  return apiRequest('PUT', path, body);
}

export async function del(path: string) {
  return apiRequest('DELETE', path);
}

export function getToken(): string | null {
  return authToken;
}

export function setToken(token: string | null) {
  authToken = token;
}
