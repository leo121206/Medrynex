import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/apiClient';
import {
  Shield,
  Cross,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  KeyRound,
  Activity,
  FileCheck2,
  Cpu,
  CheckCircle2,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, loading, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // If already authenticated, redirect to the user's real role dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'doctor') navigate('/doctor/dashboard', { replace: true });
      else if (user.role === 'admin') navigate('/admin/dashboard', { replace: true });
      else navigate('/patient/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Verify live backend API connectivity on mount
  useEffect(() => {
    let active = true;
    apiRequest<{ status: string }>('/health/liveness')
      .then(() => {
        if (active) setBackendStatus('online');
      })
      .catch(() => {
        if (active) setBackendStatus('offline');
      });
    return () => {
      active = false;
    };
  }, []);

  const handleQuickDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('SecurePass123!');
    setFieldErrors({});
    setError(null);
  };

  const validateForm = (): boolean => {
    const nextErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      const authenticatedUser = await login(email.trim().toLowerCase(), password);
      if (authenticatedUser.role === 'doctor') {
        navigate('/doctor/dashboard', { replace: true });
      } else if (authenticatedUser.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/patient/dashboard', { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Authentication failed. Please check your credentials and try again.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1B14] flex flex-col lg:flex-row font-sans selection:bg-[#A8CBA0] selection:text-[#16261B]">
      {/* Left Column: Clinical Security & Zero-Trust Telemetry Panel */}
      <div className="lg:w-5/12 xl:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#132419] via-[#1B3324] to-[#0D1911] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#2C4A36]/60">
        {/* Subtle decorative background radial glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#5F8D65]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#A8CBA0]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Bar: Brand + Live API Status */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-[#47634C] border border-[#A8CBA0]/40 text-[#A8CBA0] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <div className="relative flex items-center justify-center">
                <Shield className="w-6 h-6 stroke-[2.2]" />
                <Cross className="w-3.5 h-3.5 absolute text-white stroke-[3]" />
              </div>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white block leading-none">
                MEDRYNX
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[#A8CBA0] font-semibold">
                Clinical Data Sovereignty
              </span>
            </div>
          </Link>

          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              backendStatus === 'online'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : backendStatus === 'offline'
                  ? 'bg-red-950/60 border-red-500/40 text-red-300'
                  : 'bg-white/5 border-white/15 text-gray-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === 'online'
                  ? 'bg-emerald-400 animate-pulse'
                  : backendStatus === 'offline'
                    ? 'bg-red-400'
                    : 'bg-amber-400 animate-ping'
              }`}
            />
            {backendStatus === 'online'
              ? 'Auth Gateway Online'
              : backendStatus === 'offline'
                ? 'Gateway Unreachable'
                : 'Connecting Gateway…'}
          </div>
        </div>

        {/* Center Hero Copy & Security Capabilities */}
        <div className="relative z-10 my-10 lg:my-0 space-y-8 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#25422E] border border-[#A8CBA0]/30 text-[#A8CBA0] text-xs font-semibold">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Zero-Trust Healthcare Authentication</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.12] text-white">
              Cryptographic Control Over Every Medical Record.
            </h1>
            <p className="text-sm sm:text-base text-[#C2D6C6] leading-relaxed">
              Sign in to access your role-resolved clinical workspace. Every session is protected by rotating cryptographic tokens, envelope encryption, and immutable on-chain audit verification.
            </p>
          </div>

          {/* 4 Architecture Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#A8CBA0] font-semibold text-xs">
                <Lock className="w-4 h-4" />
                <span>AES-256-GCM Envelope</span>
              </div>
              <p className="text-xs text-[#9AB3A0] leading-relaxed">
                Per-record Data Encryption Keys wrapped via KMS and pinned off-chain.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#A8CBA0] font-semibold text-xs">
                <FileCheck2 className="w-4 h-4" />
                <span>Scope-Bound Consent</span>
              </div>
              <p className="text-xs text-[#9AB3A0] leading-relaxed">
                Granular, time-limited clinician authorizations enforced on every API call.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#A8CBA0] font-semibold text-xs">
                <Cpu className="w-4 h-4" />
                <span>AI Anomaly Scoring</span>
              </div>
              <p className="text-xs text-[#9AB3A0] leading-relaxed">
                Real-time Isolation Forest evaluation of clinician access patterns.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#A8CBA0] font-semibold text-xs">
                <Activity className="w-4 h-4" />
                <span>Tamper-Evident Audit</span>
              </div>
              <p className="text-xs text-[#9AB3A0] leading-relaxed">
                Every record read, grant, and emergency access anchored with SHA-256 proofs.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Compliance Footer */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#8FA895]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#A8CBA0]" />
            <span>Automatic Role Resolution (Patient • Clinician • Administrator)</span>
          </div>
          <span className="font-mono text-[11px] text-[#A8CBA0]/80">TLS / JWT + Refresh Rotation</span>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="lg:w-7/12 xl:w-1/2 bg-[#F5EFE6] flex flex-col justify-between p-6 sm:p-12 lg:p-16">
        {/* Top Navigation Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#47634C] hover:text-[#26352A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Medrynx Home</span>
          </Link>

          <div className="text-xs text-[#66736A]">
            New to Medrynx?{' '}
            <Link
              to="/register"
              className="font-bold text-[#47634C] hover:text-[#26352A] underline underline-offset-4"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* Main Form Container */}
        <div className="w-full max-w-md mx-auto my-10 space-y-7">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#E7F0E4] text-[#47634C] text-xs font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Authenticated Session Portal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#26352A] tracking-tight">
              Sign in to your workspace
            </h2>
            <p className="text-xs sm:text-sm text-[#66736A] leading-relaxed">
              Enter your registered email and password. Medrynx automatically routes you to your Patient, Doctor, or Administrator console.
            </p>
          </div>

          {/* Quick Demo Access Switcher */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#DDE5DA] shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#47634C] uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#5F8D65]" /> Quick Demo Accounts
              </span>
              <span className="text-[10px] text-[#66736A]">Click to auto-fill credentials</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-left">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('doctor.vance@medrynx.org')}
                className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col cursor-pointer ${
                  email === 'doctor.vance@medrynx.org'
                    ? 'bg-[#E7F0E4] border-[#5F8D65] ring-2 ring-[#5F8D65]/20'
                    : 'bg-[#FAF8F5] border-[#EBE3D5] hover:bg-[#F2E7D5]/60 hover:border-[#A8CBA0]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-[#26352A]">Dr. Marcus Vance</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#47634C] text-white font-bold">Doctor</span>
                </div>
                <span className="text-[10px] text-[#66736A] mt-0.5">Emergency & T1/T2 Care</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('aarav.sharma@medrynx.org')}
                className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col cursor-pointer ${
                  email === 'aarav.sharma@medrynx.org'
                    ? 'bg-[#E7F0E4] border-[#5F8D65] ring-2 ring-[#5F8D65]/20'
                    : 'bg-[#FAF8F5] border-[#EBE3D5] hover:bg-[#F2E7D5]/60 hover:border-[#A8CBA0]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-[#26352A]">Aarav Sharma</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#5F8D65] text-white font-bold">Patient</span>
                </div>
                <span className="text-[10px] text-[#66736A] mt-0.5">ID: PT-1001 • Cardiology</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('ananya.rao@medrynx.org')}
                className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col cursor-pointer ${
                  email === 'ananya.rao@medrynx.org'
                    ? 'bg-[#E7F0E4] border-[#5F8D65] ring-2 ring-[#5F8D65]/20'
                    : 'bg-[#FAF8F5] border-[#EBE3D5] hover:bg-[#F2E7D5]/60 hover:border-[#A8CBA0]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-[#26352A]">Ananya Rao</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#5F8D65] text-white font-bold">Patient</span>
                </div>
                <span className="text-[10px] text-[#66736A] mt-0.5">ID: PT-1002 • 3T MRI & CT</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin('admin@medrynx.org')}
                className={`p-2 rounded-xl text-left border transition-all text-xs flex flex-col cursor-pointer ${
                  email === 'admin@medrynx.org'
                    ? 'bg-[#E7F0E4] border-[#5F8D65] ring-2 ring-[#5F8D65]/20'
                    : 'bg-[#FAF8F5] border-[#EBE3D5] hover:bg-[#F2E7D5]/60 hover:border-[#A8CBA0]'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-[#26352A]">Admin Clara</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1B3324] text-white font-bold">Admin</span>
                </div>
                <span className="text-[10px] text-[#66736A] mt-0.5">Hospital Governance</span>
              </button>
            </div>
          </div>

          {/* Error Alert Banner */}
          {error && (
            <div
              className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-xs font-medium shadow-xs"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-red-900">Authentication Failed</p>
                <p className="text-red-700 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-xs font-bold uppercase tracking-wider text-[#26352A]"
              >
                Email Address
              </label>
              <div className="relative">
                <div className=" inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#66736A] absolute">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    if (error) setError(null);
                  }}
                  placeholder="name@hospital.org"
                  autoComplete="email"
                  disabled={loading}
                  required
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-white border text-sm text-[#26352A] placeholder-[#9AA59D] transition-all focus:outline-none focus:ring-2 ${
                    fieldErrors.email
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-xs font-medium text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-bold uppercase tracking-wider text-[#26352A]"
              >
                Password
              </label>
              <div className="relative">
                <div className="inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#66736A] absolute">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password)
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    if (error) setError(null);
                  }}
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                  className={`w-full pl-10 pr-11 py-3 rounded-xl bg-white border text-sm text-[#26352A] placeholder-[#9AA59D] transition-all focus:outline-none focus:ring-2 ${
                    fieldErrors.password
                      ? 'border-red-400 focus:ring-red-200'
                      : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="inset-y-0 right-0 pr-3.5 flex items-center text-[#66736A] hover:text-[#26352A] transition-colors absolute"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-xs font-medium text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 rounded-xl bg-[#47634C] hover:bg-[#39523E] active:bg-[#2F4433] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating &amp; Verifying Session…</span>
                </>
              ) : (
                <>
                  <span>Sign In to Medrynx</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Registration Callout Card */}
          <div className="p-4 rounded-2xl bg-white/80 border border-[#DDE5DA] flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-[#26352A]">Don&apos;t have a Medrynx account?</p>
              <p className="text-[11px] text-[#66736A]">
                Register as a Patient or Verified Clinician in under a minute.
              </p>
            </div>
            <Link
              to="/register"
              className="px-3.5 py-2 rounded-xl bg-[#E7F0E4] hover:bg-[#D5E6D0] text-[#26352A] font-bold text-xs whitespace-nowrap transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* Bottom Security Note */}
        <div className="text-center text-[11px] text-[#66736A]">
          Protected by Medrynx Zero-Trust Access Control • Bcrypt Credential Verification &amp; Rotating Refresh Tokens
        </div>
      </div>
    </div>
  );
};
