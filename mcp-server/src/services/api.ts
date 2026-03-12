// src/services/api.ts
// Centralized API client for Uphouse Dashboard

const MAX_ERROR_BODY = 500;

export interface ApiError {
  status: number;
  message: string;
}

export async function uphouse<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const token = process.env.UPHOUSE_API_TOKEN;
  if (!token) {
    throw new Error('UPHOUSE_API_TOKEN is not set. Please configure the environment variable.');
  }

  const baseUrl = process.env.UPHOUSE_BASE_URL || 'https://dashboard.uphousetw.com';
  const url = `${baseUrl}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const res = await fetch(url, options);

  if (!res.ok) {
    const text = await res.text().catch(() => 'No response body');
    const safeText = text.length > MAX_ERROR_BODY
      ? text.slice(0, MAX_ERROR_BODY) + '...'
      : text;
    throw new Error(`Uphouse API error ${res.status}: ${safeText}`);
  }

  // 204 No Content
  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}

export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
