import fs from 'node:fs';

const webApiClientContent = `import { env } from "@/env";
import { authStorage } from "@/lib/auth-storage";
import type { ApiErrorShape, ClientError } from "@/types/api";

export class AppError extends Error {
  code: string;
  statusCode?: number;
  details?: Record<string, string[]>;

  constructor(message: string, code: string = "UNKNOWN_ERROR", details?: Record<string, string[]>, statusCode?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

// Backward-compatible alias for existing web components
export const ApiError = AppError;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
  _retry?: boolean;
  body?: unknown;
}

let refreshPromise: Promise<void> | null = null;

function withRefreshMutex(fn: () => Promise<void>): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = fn().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : \`/\${path}\`;
  return \`\${env.apiBaseUrl}\${normalizedPath}\`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, auth = true, _retry = false, headers = {}, body, ...init } = options;

  const url = new URL(apiUrl(path));
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(headers as Record<string, string>),
  };

  if (auth) {
    const token = authStorage.getAccessToken();
    if (token) {
      reqHeaders.Authorization = \`Bearer \${token}\`;
    }
  }

  const payload: BodyInit | undefined = isFormData
    ? (body as FormData)
    : body !== undefined && typeof body !== "string"
    ? JSON.stringify(body)
    : (body as string | undefined);

  const response = await fetch(url.toString(), {
    ...init,
    headers: reqHeaders,
    credentials: "include",
    body: payload,
  });

  // Handle 401 token refresh retry
  if (response.status === 401 && !_retry && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    try {
      await withRefreshMutex(async () => {
        const storedRefreshToken = authStorage.getRefreshToken();
        const refreshRes = await fetch(apiUrl("/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "include",
          body: storedRefreshToken ? JSON.stringify({ refreshToken: storedRefreshToken }) : JSON.stringify({}),
        });

        if (!refreshRes.ok) {
          authStorage.clear();
          throw new AppError("SESSION_EXPIRED", "SESSION_EXPIRED", undefined, 401);
        }

        const refreshData = await refreshRes.json();
        const newAccess = refreshData.accessToken || refreshData.data?.newAccessToken || refreshData.data?.accessToken;
        const newRefresh = refreshData.refreshToken || refreshData.data?.newRefreshToken || refreshData.data?.refreshToken;
        if (newAccess) {
          authStorage.setTokens(newAccess, newRefresh || storedRefreshToken || undefined);
        }
      });

      return request<T>(path, { ...options, _retry: true });
    } catch (refreshErr) {
      throw refreshErr;
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errObj = data as ApiErrorShape | null;
    const clientErr = errObj as ClientError | null;
    const code = clientErr?.code || (errObj as any)?.error || "UNKNOWN_ERROR";
    const message = errObj?.message || (errObj as any)?.error || \`HTTP \${response.status}: Request failed\`;
    throw new AppError(message, code, clientErr?.details, response.status);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { method: "GET", ...options }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { method: "POST", body, ...options }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { method: "PATCH", body, ...options }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>(path, { method: "PUT", body, ...options }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { method: "DELETE", ...options }),
};

// Backward-compatible apiRequest export
export const apiRequest = request;
`;

fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/lib/apiClient.ts', webApiClientContent, 'utf8');
console.log('Updated ChurchEden-Web/src/lib/apiClient.ts');
