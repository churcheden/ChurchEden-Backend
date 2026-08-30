import fs from 'node:fs';

const typesContent = `// ChurchEden Unified API & Domain Types
// Generated from prisma/schema.prisma & backend routes

export type LoginProvider = 'EMAIL' | 'GOOGLE';
export type Gender = 'MALE' | 'FEMALE' | 'PREFER_NOT_TO_SAY';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'PREFER_NOT_TO_SAY';
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
export type ChurchRole = 'MEMBER' | 'ADMIN' | 'SUPER_ADMIN';
export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type CongregationSize =
  | 'RANGE_1_100'
  | 'RANGE_101_500'
  | 'RANGE_501_1000'
  | 'RANGE_1001_2000'
  | 'RANGE_2000_PLUS';
export type ChurchLanguage = 'ENGLISH' | 'FRENCH' | 'SPANISH';

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  googleId?: string | null;
  loginProvider: LoginProvider;
  isVerified: boolean;
  isPremium: boolean;
  premiumSince?: string | null;
  premiumExpiry?: string | null;
  subscriptionProcessor?: string | null;
  subscriptionRef?: string | null;
  subscriptionStatus?: SubscriptionStatus | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberProfile {
  id: string;
  userId: string;
  profilePhotoUrl?: string | null;
  fullName: string;
  dateOfBirth: string;
  gender: Gender;
  phoneNumber: string;
  contactEmail: string;
  city: string;
  address: string;
  maritalStatus: MaritalStatus;
  occupation?: string | null;
  completedAt: string;
  updatedAt: string;
}

export interface Church {
  id: string;
  name: string;
  denomination: string;
  congregationSize: CongregationSize;
  foundedYear?: number | null;
  country: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  primaryLanguage: ChurchLanguage;
  timeZone: string;
  logoUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceTime {
  id: string;
  churchId: string;
  label: string;
  dayOfWeek: number;
  time: string;
  createdAt: string;
}

export interface ChurchMinistry {
  id: string;
  churchId: string;
  name: string;
  type: 'MINISTRY' | 'DEPARTMENT';
  description?: string | null;
  icon?: string | null;
  isCustom: boolean;
  isActive: boolean;
}

export interface ChurchMembership {
  id: string;
  userId: string;
  churchId: string;
  role: ChurchRole;
  status: MembershipStatus;
  rejectionReason?: string | null;
  joinedAt: string;
  church?: Church;
  user?: User;
}

export interface ChurchOnboardingDraft {
  firstName?: string;
  lastName?: string;
  churchName?: string;
  denomination?: string;
  congregationSize?: CongregationSize;
  foundedYear?: number;
  country?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  primaryLanguage?: ChurchLanguage;
  timeZone?: string;
  serviceTimes?: Array<{ label: string; dayOfWeek: number; time: string }>;
  logoUrl?: string;
  ministryIds?: string[];
  customMinistries?: Array<{
    name: string;
    type: 'MINISTRY' | 'DEPARTMENT';
    description?: string;
    icon?: string;
  }>;
}

export interface ClientError {
  status: 'error';
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface ServerError {
  status: 'fail';
  error: string;
  message?: string;
}

export type ApiErrorShape = ClientError | ServerError;

export interface AuthSuccessResponse {
  status: 'success';
  message: string;
  accessToken: string;
  refreshToken?: string;
  user: Pick<User, 'id' | 'email' | 'fullName' | 'isVerified' | 'loginProvider'>;
}

export interface TokenRefreshResponse {
  status: 'success';
  accessToken?: string;
  refreshToken?: string;
  data?: {
    accessToken?: string;
    newAccessToken?: string;
    refreshToken?: string;
    newRefreshToken?: string;
  };
}
`;

const webSchemasContent = `import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  otp: z.string().regex(/^\\d{6}$/, 'OTP must be exactly 6 digits'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const onboardingStep1Schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  churchName: z.string().trim().min(1, 'Church name is required').max(150),
  denomination: z.string().trim().min(1, 'Denomination is required').max(100),
  congregationSize: z.enum([
    'RANGE_1_100',
    'RANGE_101_500',
    'RANGE_501_1000',
    'RANGE_1001_2000',
    'RANGE_2000_PLUS',
  ] as const),
  foundedYear: z.coerce.number().int().min(1500).max(new Date().getFullYear()).optional(),
});

export const onboardingStep2Schema = z.object({
  country: z.string().trim().min(1, 'Country is required'),
  city: z.string().trim().min(1, 'City is required').max(100),
  address: z.string().trim().min(1, 'Address is required').max(255),
  phone: z.string().trim().min(1, 'Phone is required'),
  email: z.string().email('Invalid church email address').max(255),
  primaryLanguage: z.enum(['ENGLISH', 'FRENCH', 'SPANISH'] as const),
  timeZone: z.string().min(1, 'Time zone is required'),
});

export const serviceTimeItemSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(60),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  time: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/, 'Time must be HH:MM format (24h)'),
});

export const customMinistryItemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  type: z.enum(['MINISTRY', 'DEPARTMENT'] as const),
  description: z.string().trim().max(255).optional(),
  icon: z.string().optional(),
});

export const onboardingStep4Schema = z.object({
  ministryIds: z.array(z.string().uuid()).default([]),
  customMinistries: z.array(customMinistryItemSchema).default([]),
});

export const completeProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(120),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY'] as const),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  contactEmail: z.string().email('Invalid contact email address').max(255),
  city: z.string().trim().min(1, 'City is required').max(100),
  address: z.string().trim().min(1, 'Address is required').max(255),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'PREFER_NOT_TO_SAY'] as const),
  occupation: z.string().trim().max(100).optional(),
});

export const joinRequestSchema = z.object({
  churchId: z.string().uuid('Invalid church ID'),
});

export const rejectJoinRequestSchema = z.object({
  membershipId: z.string().uuid('Invalid membership ID'),
  rejectionReason: z.string().trim().max(500).optional(),
});
`;

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

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
  _retry?: boolean;
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

  const response = await fetch(url.toString(), {
    ...init,
    headers: reqHeaders,
    credentials: "include",
    body: isFormData ? (body as FormData) : body !== undefined && typeof body !== "string" ? JSON.stringify(body) : (body as string | undefined),
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

const webHooksUseApiContent = `import { useState, useEffect, useCallback } from "react";
import { apiClient, AppError } from "@/lib/apiClient";
import type {
  User,
  MemberProfile,
  ChurchMembership,
  ChurchOnboardingDraft,
  MembershipStatus,
} from "@/types/api";

export function useCurrentUser() {
  const [data, setData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<User>("/auth/me");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof AppError ? err : new AppError((err as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { data, isLoading, error, refetch: fetchUser };
}

export function useOnboardingDraft() {
  const [data, setData] = useState<ChurchOnboardingDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchDraft = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<ChurchOnboardingDraft>("/onboarding/church/draft");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof AppError ? err : new AppError((err as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  return { data, isLoading, error, refetch: fetchDraft };
}

export function useMemberProfile() {
  const [data, setData] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<MemberProfile>("/members/profile");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof AppError ? err : new AppError((err as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { data, isLoading, error, refetch: fetchProfile };
}

export function useJoinRequests(filters?: { status?: MembershipStatus; churchId?: string }) {
  const [data, setData] = useState<ChurchMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<ChurchMembership[]>("/join-requests", { params: filters });
      setData(res || []);
      setError(null);
    } catch (err) {
      setError(err instanceof AppError ? err : new AppError((err as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, [filters?.status, filters?.churchId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { data, isLoading, error, refetch: fetchRequests };
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

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  auth?: boolean;
  _retry?: boolean;
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

  const response = await fetch(url.toString(), {
    ...init,
    headers: reqHeaders,
    body: isFormData ? (body as FormData) : body !== undefined && typeof body !== "string" ? JSON.stringify(body) : (body as string | undefined),
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

const mobileHooksUseApiContent = `import { useState, useEffect, useCallback } from "react";
import { apiClient, AppError } from "../lib/apiClient";
import type {
  User,
  MemberProfile,
  ChurchMembership,
  ChurchOnboardingDraft,
  MembershipStatus,
} from "../types/api";

export function useCurrentUser() {
  const [data, setData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<User>("/auth/me");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof AppError ? err : new AppError((err as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { data, isLoading, error, refetch: fetchUser };
}

export function useOnboardingDraft() {
  const [data, setData] = useState<ChurchOnboardingDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchDraft = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<ChurchOnboardingDraft>("/onboarding/church/draft");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof AppError ? err : new AppError((err as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  return { data, isLoading, error, refetch: fetchDraft };
}

export function useMemberProfile() {
  const [data, setData] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<MemberProfile>("/members/profile");
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof AppError ? err : new AppError((err as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { data, isLoading, error, refetch: fetchProfile };
}

export function useJoinRequests(filters?: { status?: MembershipStatus; churchId?: string }) {
  const [data, setData] = useState<ChurchMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<ChurchMembership[]>("/join-requests", { params: filters });
      setData(res || []);
      setError(null);
    } catch (err) {
      setError(err instanceof AppError ? err : new AppError((err as Error).message));
    } finally {
      setIsLoading(false);
    }
  }, [filters?.status, filters?.churchId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { data, isLoading, error, refetch: fetchRequests };
}
`;

// Ensure directories exist
fs.mkdirSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/types', { recursive: true });
fs.mkdirSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/lib', { recursive: true });
fs.mkdirSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/hooks', { recursive: true });

fs.mkdirSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/types', { recursive: true });
fs.mkdirSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/lib', { recursive: true });
fs.mkdirSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/hooks', { recursive: true });

// Write Web files
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/types/api.ts', typesContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/lib/schemas.ts', webSchemasContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/lib/apiClient.ts', webApiClientContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/hooks/useApi.ts', webHooksUseApiContent, 'utf8');

// Write Mobile files
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/types/api.ts', typesContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/lib/schemas.ts', webSchemasContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/lib/apiClient.ts', mobileApiClientContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Mobile/src/hooks/useApi.ts', mobileHooksUseApiContent, 'utf8');

console.log('Successfully generated all integration files for Web and Mobile!');
