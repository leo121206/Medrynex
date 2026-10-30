import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types/user';
import { authService } from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, passwordOrRole: string, maybePassword?: string) => Promise<User>;
  register: (data: Record<string, unknown>, role: UserRole) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ── Session restore on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const restoredUser = await authService.restoreSession();
        if (!cancelled) {
          setUser(restoredUser);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsInitialized(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, passwordOrRole: string, maybePassword?: string): Promise<User> => {
    setLoading(true);
    setError(null);
    try {
      const loggedUser = await authService.login(email, passwordOrRole, maybePassword);
      setUser(loggedUser);
      return loggedUser;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(msg);
      throw err; // re-throw so the page can display the error too
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Register ──────────────────────────────────────────────────────────────
  const register = useCallback(async (data: Record<string, unknown>, role: UserRole): Promise<User> => {
    setLoading(true);
    setError(null);
    try {
      const newUser = await authService.register(data, role);
      setUser(newUser);
      return newUser;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const role = user ? (user.role as UserRole) : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isInitialized,
        loading,
        error,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
