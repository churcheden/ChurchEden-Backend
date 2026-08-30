import fs from 'node:fs';

const authContextContent = `import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/apiClient";
import * as authApi from "@/lib/auth-api";
import { authStorage } from "@/lib/auth-storage";
import { env } from "@/env";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ requiresVerification: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  verifyEmail: (email: string, otp: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  setSessionFromTokens: (accessToken: string, refreshToken?: string) => Promise<void>;
  hydrateUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateUser = useCallback(async (): Promise<boolean> => {
    try {
      const response = await authApi.getCurrentUser();
      if (response && response.user) {
        setUser(response.user);
        return true;
      }
      return false;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.statusCode === 401 &&
        authStorage.getRefreshToken()
      ) {
        try {
          await authApi.refreshTokens();
          const retryResponse = await authApi.getCurrentUser();
          if (retryResponse && retryResponse.user) {
            setUser(retryResponse.user);
            return true;
          }
        } catch {
          setUser(null);
          return false;
        }
      }
      setUser(null);
      return false;
    }
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      await hydrateUser();
      setIsLoading(false);
    };
    void bootstrap();
  }, [hydrateUser]);

  const setSessionFromTokens = useCallback(
    async (accessToken: string, refreshToken?: string) => {
      if (refreshToken) {
        authStorage.setTokens(accessToken, refreshToken);
      } else {
        authStorage.setAccessToken(accessToken);
      }
      await hydrateUser();
    },
    [hydrateUser],
  );

  const signUp = useCallback(async (email: string, password: string) => {
    const response = await authApi.register(email, password);
    if (response.accessToken) {
      authStorage.setTokens(response.accessToken, response.refreshToken);
    }
    if (response.user) {
      setUser(response.user);
    }
    return { requiresVerification: response.requiresVerification };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    if (response.accessToken) {
      authStorage.setTokens(response.accessToken, response.refreshToken);
    }
    if (response.user) {
      setUser(response.user);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (error) {
      if (!(error instanceof ApiError) || error.statusCode !== 401) {
        // Ignore logout error
      }
    } finally {
      authStorage.clear();
      setUser(null);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const response = await authApi.getGoogleAuthUrl();
      if (response && response.url) {
        window.location.href = response.url;
      } else {
        window.location.href = \`\${env.apiBaseUrl}/auth/google\`;
      }
    } catch {
      window.location.href = \`\${env.apiBaseUrl}/auth/google\`;
    }
  }, []);

  const verifyEmail = useCallback(
    async (email: string, otp: string) => {
      await authApi.verifyEmail(email, otp);
      await hydrateUser();
    },
    [hydrateUser],
  );

  const resendVerification = useCallback(async () => {
    await authApi.resendVerification();
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      signUp,
      signIn,
      signOut,
      signInWithGoogle,
      verifyEmail,
      resendVerification,
      setSessionFromTokens,
      hydrateUser,
    }),
    [
      user,
      isLoading,
      signUp,
      signIn,
      signOut,
      signInWithGoogle,
      verifyEmail,
      resendVerification,
      setSessionFromTokens,
      hydrateUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
`;

const authCallbackContent = `import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/app/auth/auth-context";

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hydrateUser, setSessionFromTokens } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const authError = searchParams.get("error");
    const profileComplete = searchParams.get("profileComplete");

    if (authError) {
      setError("Google sign-in failed. Please try again.");
      return;
    }

    const complete = async () => {
      try {
        if (accessToken) {
          await setSessionFromTokens(accessToken);
        } else {
          await hydrateUser();
        }

        // Redirect based on profile status or default to dashboard
        if (profileComplete === "false") {
          navigate("/onboarding/church-basics", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      } catch {
        setError("Could not complete sign-in. Please try again.");
      }
    };

    void complete();
  }, [navigate, searchParams, hydrateUser, setSessionFromTokens]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-eden-surface px-6 font-eden text-eden-on-surface">
        <p className="text-center text-eden-on-surface-variant">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/onboarding/sign-in")}
          className="font-medium text-eden-primary hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-eden-surface font-eden text-eden-on-surface-variant">
      Completing sign-in...
    </div>
  );
}
`;

fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/app/auth/auth-context.tsx', authContextContent, 'utf8');
fs.writeFileSync('C:/Users/SIMPATY SOLUTIONS/ChurchEden-Web/src/app/components/auth/auth-callback.tsx', authCallbackContent, 'utf8');

console.log('Successfully updated auth-context.tsx and auth-callback.tsx');
