import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/user';

// ── Loading Spinner ───────────────────────────────────────────────────────────

const AuthSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F2E7D5]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-[#A8CBA0] border-t-[#47634C] rounded-full animate-spin" />
      <p className="text-sm text-[#66736A] font-medium">Restoring session…</p>
    </div>
  </div>
);

// ── PrivateRoute ──────────────────────────────────────────────────────────────
/**
 * Wraps any route that requires authentication.
 * Redirects to /login if the user is not authenticated.
 * Shows a spinner while the initial session restore is in progress.
 */
export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isInitialized } = useAuth();
  const location = useLocation();

  if (!isInitialized) return <AuthSpinner />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// ── RequireRole ───────────────────────────────────────────────────────────────
/**
 * Wraps a route that requires the authenticated user to have a specific role.
 * Redirects to the correct dashboard if the user has a different role,
 * or to /login if not authenticated at all.
 */
export const RequireRole: React.FC<{ role: UserRole; children: React.ReactNode }> = ({
  role,
  children,
}) => {
  const { isAuthenticated, isInitialized, user } = useAuth();
  const location = useLocation();

  if (!isInitialized) return <AuthSpinner />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.role !== role) {
    // Redirect to the user's actual dashboard instead of showing a blank page
    const dashboards: Record<string, string> = {
      patient: '/patient/dashboard',
      doctor: '/doctor/dashboard',
      admin: '/admin/dashboard',
    };
    return <Navigate to={dashboards[user.role] || '/'} replace />;
  }

  return <>{children}</>;
};

// ── RedirectIfAuthenticated ───────────────────────────────────────────────────
/**
 * Wraps public-only routes like /login and /register.
 * Redirects already-authenticated users to their dashboard.
 */
export const RedirectIfAuthenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isInitialized, user } = useAuth();

  if (!isInitialized) return <AuthSpinner />;

  if (isAuthenticated && user) {
    const dashboards: Record<string, string> = {
      patient: '/patient/dashboard',
      doctor: '/doctor/dashboard',
      admin: '/admin/dashboard',
    };
    return <Navigate to={dashboards[user.role] || '/'} replace />;
  }

  return <>{children}</>;
};
