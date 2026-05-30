export interface ApiConfig {
  tmdb: boolean;
  xai: boolean;
}

export const APP_BASE_PATH = '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${APP_BASE_PATH}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

let configPromise: Promise<ApiConfig> | null = null;

export function fetchApiConfig(): Promise<ApiConfig> {
  if (!configPromise) {
    configPromise = apiFetch<ApiConfig>('/config');
  }
  return configPromise;
}
