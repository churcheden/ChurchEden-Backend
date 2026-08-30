import fs from 'node:fs';

const mobileSchemasContent = `// ChurchEden Client Validation Patterns & Helpers for Mobile
// Custom type-safe validators (zero-dependency / React Native compatible)

export const Validators = {
  isValidEmail(email: string): boolean {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.trim());
  },
  isValidPassword(password: string): boolean {
    return password.length >= 8;
  },
  isValidOtp(otp: string): boolean {
    return /^\\d{6}$/.test(otp.trim());
  },
  isValidPhone(phone: string): boolean {
    return phone.trim().length >= 8;
  },
  isValid24hTime(time: string): boolean {
    return /^([01]\\d|2[0-3]):[0-5]\\d$/.test(time.trim());
  },
};

export interface FormErrorResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateLoginForm(values: { email?: string; password?: string }): FormErrorResult {
  const errors: Record<string, string> = {};
  if (!values.email || !Validators.isValidEmail(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!values.password || values.password.length === 0) {
    errors.password = 'Password is required.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateRegisterForm(values: { email?: string; password?: string }): FormErrorResult {
  const errors: Record<string, string> = {};
  if (!values.email || !Validators.isValidEmail(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!values.password || !Validators.isValidPassword(values.password)) {
    errors.password = 'Password must be at least 8 characters.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function validateOtpForm(values: { email?: string; otp?: string }): FormErrorResult {
  const errors: Record<string, string> = {};
  if (!values.email || !Validators.isValidEmail(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }
  if (!values.otp || !Validators.isValidOtp(values.otp)) {
    errors.otp = 'OTP must be exactly 6 digits.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}
`;

const mobileApiClientContent = `import AsyncStorage from "@react-native-async-storage/async-storage";
import { Config } from "../constants/Config";
import type { ApiErrorShape, ClientError } from "../types/api";

export const AUTH_ACCESS_TOKEN_KEY = "auth_access_token";
export const AUTH_REFRESH_TOKEN_KEY = "auth_refresh_token";

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

export async function getTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    AsyncStorage.getItem(AUTH_ACCESS_TOKEN_KEY),
    AsyncStorage.getItem(AUTH_REFRESH_TOKEN_KEY),
  ]);
  return { accessToken, refreshToken };
}

export async function saveTokens(accessToken: string, refreshToken?: string) {
  const ops: Promise<void>[] = [AsyncStorage.setItem(AUTH_ACCESS_TOKEN_KEY, accessToken)];
  if (refreshToken) {
    ops.push(AsyncStorage.setItem(AUTH_REFRESH_TOKEN_KEY, refreshToken));
  }
  await Promise.all(ops);
}

export async function clearTokens() {
  await Promise.all([
    AsyncStorage.removeItem(AUTH_ACCESS_TOKEN_KEY),
    AsyncStorage.removeItem(AUTH_REFRESH_TOKEN_KEY),
  ]);
}

export function apiUrl(path: string): string {
  const base = Config.apiUrl.replace(/\\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : \`/\${path}\`;
  return \`\${base}\${normalizedPath}\`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, auth = true, _retry = false, headers = {}, body, ...init } = options;

  const url = new URL(apiUrl(path));
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
  }

  const { accessToken } = await getTokens();

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    "x-client-platform": "mobile",
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(auth && accessToken ? { Authorization: \`Bearer \${accessToken}\` } : {}),
    ...(headers as Record<string, string>),
  };

  const payload: BodyInit | undefined = isFormData
    ? (body as FormData)
    : body !== undefined && typeof body !== "string"
    ? JSON.stringify(body)
    : (body as string | undefined);

  const response = await fetch(url.toString(), {
    ...init,
    headers: reqHeaders,
    body: payload,
  });

  // Handle 401 refresh flow
  if (response.status === 401 && !_retry && !path.includes("/auth/login") && !path.includes("/auth/refresh")) {
    try {
      await withRefreshMutex(async () => {
        const { refreshToken } = await getTokens();
        if (!refreshToken) {
          await clearTokens();
          throw new AppError("Session expired", "SESSION_EXPIRED", undefined, 401);
        }

        const refreshRes = await fetch(apiUrl("/auth/refresh"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "x-client-platform": "mobile",
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!refreshRes.ok) {
          await clearTokens();
          throw new AppError("Session expired", "SESSION_EXPIRED", undefined, 401);
        }

        const refreshData = await refreshRes.json();
        const newAccess = refreshData.accessToken || refreshData.data?.newAccessToken || refreshData.data?.accessToken;
        const newRefresh = refreshData.refreshToken || refreshData.data?.newRefreshToken || refreshData.data?.refreshToken;
        if (newAccess) {
          await saveTokens(newAccess, newRefresh || refreshToken);
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

export default apiClient;
`;

fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/lib/schemas.ts', mobileSchemasContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/lib/apiClient.ts', mobileApiClientContent, 'utf8');

console.log('Updated mobile schemas and apiClient');
