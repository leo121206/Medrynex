import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/apiClient';
import { UserRole } from '../../types/user';
import {
  Shield,
  Cross,
  Lock,
  Mail,
  User as UserIcon,
  Stethoscope,
  Building2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Phone,
  Calendar,
  HeartPulse,
  Award,
  FileKey2,
  UserCheck,
  Network,
  KeyRound,
  Check,
  Info,
  Loader2,
} from 'lucide-react';

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  licenseId?: string;
  specialization?: string;
  hospital?: string;
  department?: string;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDER_OPTIONS = ['Female', 'Male', 'Non-Binary', 'Prefer not to say'];
const SPECIALIZATIONS = [
  'Cardiology',
  'Internal Medicine',
  'Neurology',
  'Oncology',
  'Orthopedics',
  'Pediatrics',
  'Radiology',
  'General Practice',
  'Emergency Medicine',
  'Dermatology',
];

export const RegisterPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('patient');

  // Common fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Patient-specific fields
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');

  // Doctor / Organization fields
  const [licenseId, setLicenseId] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospital, setHospital] = useState('');
  const [department, setDepartment] = useState('');

  // UI interaction states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const { register, loading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'doctor') navigate('/doctor/dashboard', { replace: true });
      else if (user.role === 'admin') navigate('/admin/dashboard', { replace: true });
      else navigate('/patient/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Check live backend gateway health
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

  // Password strength calculation using project semantic colors
  const passwordChecks = useMemo(() => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    const score = [hasMinLength, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;

    let label = 'Enter a password';
    let color = 'bg-[#DDE5DA]';
    let textColor = 'text-[#66736A]';

    if (password.length > 0) {
      if (score <= 1) {
        label = 'Weak';
        color = 'bg-[#C85C5C]';
        textColor = 'text-[#C85C5C]';
      } else if (score === 2) {
        label = 'Fair';
        color = 'bg-[#D9A441]';
        textColor = 'text-[#D9A441]';
      } else if (score === 3) {
        label = 'Good';
        color = 'bg-[#5F8D65]';
        textColor = 'text-[#47634C]';
      } else {
        label = 'Strong';
        color = 'bg-[#47634C]';
        textColor = 'text-[#26352A]';
      }
    }

    return {
      hasMinLength,
      hasUppercase,
      hasNumber,
      hasSpecial,
      score,
      label,
      color,
      textColor,
    };
  }, [password]);

  // Real-time validation function
  const computeErrors = (): FormErrors => {
    const errs: FormErrors = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errs.fullName = 'Full name must be at least 2 characters.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid clinical or personal email address.';
    }

    if (phone.trim() && !/^[+\d\s\-()]{7,20}$/.test(phone.trim())) {
      errs.phone = 'Please enter a valid phone number.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    } else if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      errs.password = 'Include at least 1 uppercase letter and 1 number.';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    if (selectedRole === 'patient') {
      if (!dob) {
        errs.dob = 'Date of birth is required for patient health records.';
      } else {
        const selectedDate = new Date(dob);
        if (selectedDate > new Date()) {
          errs.dob = 'Date of birth cannot be in the future.';
        }
      }
    }

    if (selectedRole === 'doctor') {
      if (!licenseId.trim() || licenseId.trim().length < 3) {
        errs.licenseId = 'Valid Medical Registration / License Number is required.';
      }
      if (!specialization.trim()) {
        errs.specialization = 'Please specify your clinical specialization.';
      }
      if (!hospital.trim()) {
        errs.hospital = 'Hospital or healthcare organization is required.';
      }
    }

    if (selectedRole === 'admin') {
      if (!hospital.trim()) {
        errs.hospital = 'Organization or hospital name is required.';
      }
      if (!department.trim()) {
        errs.department = 'Department or governance division is required.';
      }
    }

    return errs;
  };

  useEffect(() => {
    setFieldErrors(computeErrors());
  }, [
    fullName,
    email,
    phone,
    password,
    confirmPassword,
    dob,
    gender,
    bloodGroup,
    licenseId,
    specialization,
    hospital,
    department,
    selectedRole,
  ]);

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleRoleSwitch = (role: UserRole) => {
    setSelectedRole(role);
    setSubmitError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    setTouched({
      fullName: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
      dob: true,
      gender: true,
      bloodGroup: true,
      licenseId: true,
      specialization: true,
      hospital: true,
      department: true,
    });

    const currentErrors = computeErrors();
    setFieldErrors(currentErrors);

    if (Object.keys(currentErrors).length > 0) {
      setSubmitError('Please resolve the highlighted fields before creating your account.');
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
      };

      if (selectedRole === 'patient') {
        payload.dob = dob;
        payload.gender = gender || undefined;
        payload.bloodGroup = bloodGroup || undefined;
      } else if (selectedRole === 'doctor') {
        payload.licenseId = licenseId.trim();
        payload.specialization = specialization.trim();
        payload.hospital = hospital.trim();
      } else if (selectedRole === 'admin') {
        payload.hospital = hospital.trim();
        payload.department = department.trim();
      }

      const newUser = await register(payload, selectedRole);
      setSubmitSuccess('Account created and cryptographic profile initialized. Redirecting...');
      if (newUser.role === 'doctor') {
        navigate('/doctor/dashboard', { replace: true });
      } else if (newUser.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/patient/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Registration failed. Please verify your details and try again.';
      setSubmitError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1B14] flex flex-col lg:flex-row font-sans selection:bg-[#A8CBA0] selection:text-[#16261B]">
      {/* ═══════════════════════════════════════════════════════════════════════
          LEFT PANEL — BRANDING, VISUAL & TRUST ARCHITECTURE
          (Matches LoginPage & Project Forest-Green / Sage Palette)
         ═══════════════════════════════════════════════════════════════════════ */}
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

        {/* Center Hero Copy + Healthcare Trust Visual */}
        <div className="relative z-10 my-10 lg:my-auto py-4 max-w-xl space-y-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#25422E] border border-[#A8CBA0]/30 text-[#A8CBA0] text-xs font-semibold">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Zero-Trust Healthcare Record Infrastructure</span>
          </div>

          <div className="space-y-3.5">
            <h1 className="text-3xl sm:text-4xl xl:text-[42px] font-extrabold tracking-tight leading-[1.14] text-white">
              Secure Healthcare.{' '}
              <span className="text-[#A8CBA0]">Trusted Connections.</span>
            </h1>

            <p className="text-sm sm:text-base text-[#C2D6C6] leading-relaxed">
              Medrynx enables secure, consent-based healthcare record management—empowering patients
              with cryptographic ownership while giving verified clinicians seamless, auditable care
              access.
            </p>
          </div>

          {/* Tasteful Healthcare-Themed Visual: T0-T3 Trust & Encryption Card */}
          <div className="rounded-2xl bg-white/[0.04] backdrop-blur-xs border border-white/10 p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#25422E] border border-[#A8CBA0]/30 flex items-center justify-center">
                  <Network className="w-4 h-4 text-[#A8CBA0]" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white tracking-wide">
                    Medrynx T0–T3 Clinical Trust Hierarchy
                  </div>
                  <div className="text-[11px] text-[#9AB3A0]">
                    End-to-end envelope encryption &amp; patient-governed consent flow
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#25422E] text-[#A8CBA0] border border-[#A8CBA0]/30 font-semibold">
                AES-256-GCM
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="text-[10px] font-mono uppercase text-[#A8CBA0] mb-1">Step 01</div>
                <div className="text-xs font-bold text-white">Verified Identity</div>
                <div className="text-[11px] text-[#9AB3A0] mt-0.5">Role-bound T0 credential</div>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="text-[10px] font-mono uppercase text-[#A8CBA0] mb-1">Step 02</div>
                <div className="text-xs font-bold text-white">Care Link (T1)</div>
                <div className="text-[11px] text-[#9AB3A0] mt-0.5">Mutual clinical trust</div>
              </div>
              <div className="p-3 rounded-xl bg-[#25422E]/80 border border-[#A8CBA0]/40">
                <div className="text-[10px] font-mono uppercase text-[#A8CBA0] mb-1">Step 03</div>
                <div className="text-xs font-bold text-white">Patient Consent</div>
                <div className="text-[11px] text-[#C2D6C6] mt-0.5">T2 / T3 scoped access</div>
              </div>
            </div>
          </div>

          {/* Three Feature Highlights */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#25422E] border border-[#A8CBA0]/30 flex items-center justify-center shrink-0 mt-0.5">
                <FileKey2 className="h-5 w-5 text-[#A8CBA0]" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Encrypted Health Records</h3>
                <p className="text-[#9AB3A0] text-xs sm:text-sm leading-relaxed mt-0.5">
                  Every medical document is protected with unique per-record AES-256-GCM data
                  encryption keys and verifiable integrity hashes.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#25422E] border border-[#A8CBA0]/30 flex items-center justify-center shrink-0 mt-0.5">
                <UserCheck className="h-5 w-5 text-[#A8CBA0]" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Patient-Controlled Access</h3>
                <p className="text-[#9AB3A0] text-xs sm:text-sm leading-relaxed mt-0.5">
                  Patients approve consolidated access requests with one click and can revoke
                  permissions at any time with immediate effect.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#25422E] border border-[#A8CBA0]/30 flex items-center justify-center shrink-0 mt-0.5">
                <HeartPulse className="h-5 w-5 text-[#A8CBA0]" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">
                  Verified Healthcare Relationships
                </h3>
                <p className="text-[#9AB3A0] text-xs sm:text-sm leading-relaxed mt-0.5">
                  Strict role separation and tamper-evident audit trails ensure only verified care
                  providers can request clinical access.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Compliance Footer */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-[#8FA895]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#A8CBA0]" />
            <span>HIPAA &amp; GDPR Aligned Security Architecture</span>
          </div>
          <span className="font-mono text-[11px] text-[#A8CBA0]/80">
            SHA-256 Audit Chain • TLS 1.3
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RIGHT PANEL — REGISTRATION FORM
          (Matches LoginPage & Project Warm Beige / Forest Green / Sage Theme)
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="lg:w-7/12 xl:w-1/2 bg-[#F5EFE6] flex flex-col justify-between p-6 sm:p-10 lg:p-14 overflow-y-auto">
        {/* Top Navigation Back Link */}
        <div className="flex items-center justify-between mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#47634C] hover:text-[#26352A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Medrynx Home</span>
          </Link>

          <div className="text-xs text-[#66736A]">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-bold text-[#47634C] hover:text-[#26352A] underline underline-offset-4"
            >
              Sign in.
            </Link>
          </div>
        </div>

        <div className="w-full max-w-xl mx-auto my-auto">
          {/* Card Container */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#DDE5DA] p-6 sm:p-8 lg:p-10">
            {/* Form Heading */}
            <div className="mb-6 space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#E7F0E4] text-[#47634C] text-xs font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>Cryptographic Account Onboarding</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#26352A] tracking-tight">
                Create your Medrynx account
              </h2>
              <p className="text-xs sm:text-sm text-[#66736A] leading-relaxed">
                Join a secure healthcare network.
              </p>
            </div>

            {/* Account Type / Role Selection Cards */}
            <div className="mb-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#26352A] mb-2.5">
                Select Account Type
              </label>
              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                role="radiogroup"
                aria-label="Select Account Type"
              >
                {/* Patient Card */}
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('patient')}
                  aria-pressed={selectedRole === 'patient'}
                  className={`group relative text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                    selectedRole === 'patient'
                      ? 'bg-[#E7F0E4]/80 border-[#47634C] ring-2 ring-[#A8CBA0]/40 shadow-xs'
                      : 'bg-white border-[#DDE5DA] hover:border-[#A8CBA0] hover:bg-[#F8F3EA]/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        selectedRole === 'patient'
                          ? 'bg-[#47634C] text-white'
                          : 'bg-[#F2E7D5] text-[#47634C] group-hover:bg-[#E7F0E4]'
                      }`}
                    >
                      <UserIcon className="w-4 h-4" />
                    </div>
                    {selectedRole === 'patient' && (
                      <span className="w-5 h-5 rounded-full bg-[#47634C] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-[#26352A]">Patient</div>
                  <div className="text-[11px] text-[#66736A] leading-tight mt-0.5">
                    Manage personal records &amp; consent
                  </div>
                </button>

                {/* Doctor / Healthcare Provider Card */}
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('doctor')}
                  aria-pressed={selectedRole === 'doctor'}
                  className={`group relative text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                    selectedRole === 'doctor'
                      ? 'bg-[#E7F0E4]/80 border-[#47634C] ring-2 ring-[#A8CBA0]/40 shadow-xs'
                      : 'bg-white border-[#DDE5DA] hover:border-[#A8CBA0] hover:bg-[#F8F3EA]/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        selectedRole === 'doctor'
                          ? 'bg-[#47634C] text-white'
                          : 'bg-[#F2E7D5] text-[#47634C] group-hover:bg-[#E7F0E4]'
                      }`}
                    >
                      <Stethoscope className="w-4 h-4" />
                    </div>
                    {selectedRole === 'doctor' && (
                      <span className="w-5 h-5 rounded-full bg-[#47634C] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-[#26352A]">Healthcare Provider</div>
                  <div className="text-[11px] text-[#66736A] leading-tight mt-0.5">
                    Doctors &amp; clinical specialists
                  </div>
                </button>

                {/* Organization / Admin Card */}
                <button
                  type="button"
                  onClick={() => handleRoleSwitch('admin')}
                  aria-pressed={selectedRole === 'admin'}
                  className={`group relative text-left p-3.5 rounded-xl border transition-all duration-150 cursor-pointer ${
                    selectedRole === 'admin'
                      ? 'bg-[#E7F0E4]/80 border-[#47634C] ring-2 ring-[#A8CBA0]/40 shadow-xs'
                      : 'bg-white border-[#DDE5DA] hover:border-[#A8CBA0] hover:bg-[#F8F3EA]/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        selectedRole === 'admin'
                          ? 'bg-[#47634C] text-white'
                          : 'bg-[#F2E7D5] text-[#47634C] group-hover:bg-[#E7F0E4]'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                    {selectedRole === 'admin' && (
                      <span className="w-5 h-5 rounded-full bg-[#47634C] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-[#26352A]">Organization</div>
                  <div className="text-[11px] text-[#66736A] leading-tight mt-0.5">
                    Hospital &amp; compliance admin
                  </div>
                </button>
              </div>
            </div>

            {/* Submit Error / Success Alert Banners */}
            {submitError && (
              <div
                role="alert"
                className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-800 text-xs font-medium shadow-xs"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <span className="font-bold text-red-900 block">Registration Error</span>
                  <span className="text-red-700 leading-relaxed">{submitError}</span>
                </div>
              </div>
            )}

            {submitSuccess && (
              <div
                role="status"
                className="mb-6 p-4 rounded-2xl bg-[#E7F0E4] border border-[#A8CBA0] flex items-start space-x-3 text-[#26352A] text-xs font-medium shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4 text-[#47634C] shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <span className="font-bold text-[#26352A] block">Account Initialized</span>
                  <span className="text-[#47634C] leading-relaxed">{submitSuccess}</span>
                </div>
              </div>
            )}

            {/* Main Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* ── COMMON IDENTITY SECTION ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label
                    htmlFor="reg-fullname"
                    className="block text-xs font-bold uppercase tracking-wider text-[#26352A] mb-1.5"
                  >
                    Full Name <span className="text-[#C85C5C]">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="h-4 w-4 text-[#66736A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => markTouched('fullName')}
                      placeholder={
                        selectedRole === 'doctor'
                          ? 'Dr. Evelyn Vance'
                          : selectedRole === 'admin'
                            ? 'Jordan Hayes'
                            : 'Sarah Jenkins'
                      }
                      className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                        touched.fullName && fieldErrors.fullName
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                      }`}
                    />
                  </div>
                  {touched.fullName && fieldErrors.fullName && (
                    <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.fullName}</p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-bold uppercase tracking-wider text-[#26352A] mb-1.5"
                  >
                    Email Address <span className="text-[#C85C5C]">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-[#66736A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => markTouched('email')}
                      placeholder="name@hospital.org"
                      className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                        touched.email && fieldErrors.email
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                      }`}
                    />
                  </div>
                  {touched.email && fieldErrors.email && (
                    <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.email}</p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label
                    htmlFor="reg-phone"
                    className="block text-xs font-bold uppercase tracking-wider text-[#26352A] mb-1.5"
                  >
                    Phone Number{' '}
                    <span className="text-[11px] font-normal normal-case text-[#66736A]">
                      (Optional)
                    </span>
                  </label>
                  <div className="relative">
                    <Phone className="h-4 w-4 text-[#66736A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => markTouched('phone')}
                      placeholder="+1 (555) 234-5678"
                      className={`w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                        touched.phone && fieldErrors.phone
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                      }`}
                    />
                  </div>
                  {touched.phone && fieldErrors.phone && (
                    <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* ── ROLE-SPECIFIC CLINICAL FIELDS ── */}
              {selectedRole === 'patient' && (
                <div className="p-4 sm:p-5 rounded-xl bg-[#F8F3EA] border border-[#DDE5DA] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#26352A] flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-[#47634C]" />
                      Patient Clinical Profile
                    </span>
                    <span className="text-[11px] font-semibold text-[#47634C] bg-[#E7F0E4] px-2 py-0.5 rounded-md">
                      Encrypted Health Vault
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* Date of Birth */}
                    <div>
                      <label
                        htmlFor="reg-dob"
                        className="block text-xs font-bold text-[#26352A] mb-1"
                      >
                        Date of Birth <span className="text-[#C85C5C]">*</span>
                      </label>
                      <div className="relative">
                        <Calendar className="h-4 w-4 text-[#66736A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="reg-dob"
                          type="date"
                          required
                          max={new Date().toISOString().split('T')[0]}
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          onBlur={() => markTouched('dob')}
                          className={`w-full pl-9 pr-3 py-2 bg-white border rounded-xl text-sm text-[#26352A] focus:outline-none focus:ring-2 transition-all ${
                            touched.dob && fieldErrors.dob
                              ? 'border-red-400 focus:ring-red-200'
                              : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                          }`}
                        />
                      </div>
                      {touched.dob && fieldErrors.dob && (
                        <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.dob}</p>
                      )}
                    </div>

                    {/* Gender */}
                    <div>
                      <label
                        htmlFor="reg-gender"
                        className="block text-xs font-bold text-[#26352A] mb-1"
                      >
                        Gender
                      </label>
                      <select
                        id="reg-gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#D5DFD3] rounded-xl text-sm text-[#26352A] focus:outline-none focus:ring-2 focus:border-[#47634C] focus:ring-[#A8CBA0]/40 transition-all"
                      >
                        <option value="">Select gender</option>
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Blood Group */}
                    <div>
                      <label
                        htmlFor="reg-blood-group"
                        className="block text-xs font-bold text-[#26352A] mb-1"
                      >
                        Blood Group
                      </label>
                      <select
                        id="reg-blood-group"
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#D5DFD3] rounded-xl text-sm text-[#26352A] focus:outline-none focus:ring-2 focus:border-[#47634C] focus:ring-[#A8CBA0]/40 transition-all"
                      >
                        <option value="">Select type</option>
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {selectedRole === 'doctor' && (
                <div className="p-4 sm:p-5 rounded-xl bg-[#F8F3EA] border border-[#DDE5DA] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#26352A] flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5 text-[#47634C]" />
                      Clinician Credential Verification
                    </span>
                    <span className="text-[11px] font-mono font-semibold text-[#47634C] bg-[#E7F0E4] px-2 py-0.5 rounded border border-[#A8CBA0]">
                      Initial Tier: T0
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Medical Registration / License Number */}
                    <div>
                      <label
                        htmlFor="reg-license"
                        className="block text-xs font-bold text-[#26352A] mb-1"
                      >
                        Medical Registration / License No. <span className="text-[#C85C5C]">*</span>
                      </label>
                      <div className="relative">
                        <Award className="h-4 w-4 text-[#66736A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="reg-license"
                          type="text"
                          required
                          value={licenseId}
                          onChange={(e) => setLicenseId(e.target.value)}
                          onBlur={() => markTouched('licenseId')}
                          placeholder="e.g. MD-94820-NY"
                          className={`w-full pl-9 pr-3 py-2 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                            touched.licenseId && fieldErrors.licenseId
                              ? 'border-red-400 focus:ring-red-200'
                              : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                          }`}
                        />
                      </div>
                      {touched.licenseId && fieldErrors.licenseId && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          {fieldErrors.licenseId}
                        </p>
                      )}
                    </div>

                    {/* Specialization */}
                    <div>
                      <label
                        htmlFor="reg-specialization"
                        className="block text-xs font-bold text-[#26352A] mb-1"
                      >
                        Specialization <span className="text-[#C85C5C]">*</span>
                      </label>
                      <input
                        id="reg-specialization"
                        type="text"
                        list="clinical-specializations"
                        required
                        value={specialization}
                        onChange={(e) => setSpecialization(e.target.value)}
                        onBlur={() => markTouched('specialization')}
                        placeholder="e.g. Cardiology"
                        className={`w-full px-3 py-2 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                          touched.specialization && fieldErrors.specialization
                            ? 'border-red-400 focus:ring-red-200'
                            : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                        }`}
                      />
                      <datalist id="clinical-specializations">
                        {SPECIALIZATIONS.map((spec) => (
                          <option key={spec} value={spec} />
                        ))}
                      </datalist>
                      {touched.specialization && fieldErrors.specialization && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          {fieldErrors.specialization}
                        </p>
                      )}
                    </div>

                    {/* Hospital or Organization */}
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="reg-hospital"
                        className="block text-xs font-bold text-[#26352A] mb-1"
                      >
                        Hospital or Organization <span className="text-[#C85C5C]">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="h-4 w-4 text-[#66736A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="reg-hospital"
                          type="text"
                          required
                          value={hospital}
                          onChange={(e) => setHospital(e.target.value)}
                          onBlur={() => markTouched('hospital')}
                          placeholder="e.g. Mount Sinai Medical Center"
                          className={`w-full pl-9 pr-3 py-2 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                            touched.hospital && fieldErrors.hospital
                              ? 'border-red-400 focus:ring-red-200'
                              : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                          }`}
                        />
                      </div>
                      {touched.hospital && fieldErrors.hospital && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          {fieldErrors.hospital}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* T0 Security & Consent Policy Notice */}
                  <div className="p-3 rounded-lg bg-[#E7F0E4]/70 border border-[#A8CBA0]/60 flex items-start gap-2.5 text-xs text-[#47634C] leading-relaxed">
                    <Info className="w-4 h-4 text-[#47634C] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#26352A]">Zero-Trust Policy:</strong> Provider
                      registration establishes your clinical identity at <strong>Tier T0</strong> and
                      does not grant automatic access to patient records. A verified{' '}
                      <strong>T1</strong> care link and explicit <strong>T2/T3</strong> patient
                      consent are required before viewing records.
                    </span>
                  </div>
                </div>
              )}

              {selectedRole === 'admin' && (
                <div className="p-4 sm:p-5 rounded-xl bg-[#F8F3EA] border border-[#DDE5DA] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#26352A] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#47634C]" />
                      Organization &amp; Governance Details
                    </span>
                    <span className="text-[11px] font-semibold text-[#47634C] bg-[#E7F0E4] px-2 py-0.5 rounded-md">
                      Institutional Audit Scope
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label
                        htmlFor="reg-org-hospital"
                        className="block text-xs font-bold text-[#26352A] mb-1"
                      >
                        Hospital or Organization <span className="text-[#C85C5C]">*</span>
                      </label>
                      <input
                        id="reg-org-hospital"
                        type="text"
                        required
                        value={hospital}
                        onChange={(e) => setHospital(e.target.value)}
                        onBlur={() => markTouched('hospital')}
                        placeholder="e.g. Metro General Health System"
                        className={`w-full px-3 py-2 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                          touched.hospital && fieldErrors.hospital
                            ? 'border-red-400 focus:ring-red-200'
                            : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                        }`}
                      />
                      {touched.hospital && fieldErrors.hospital && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          {fieldErrors.hospital}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="reg-department"
                        className="block text-xs font-bold text-[#26352A] mb-1"
                      >
                        Department / Division <span className="text-[#C85C5C]">*</span>
                      </label>
                      <input
                        id="reg-department"
                        type="text"
                        required
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        onBlur={() => markTouched('department')}
                        placeholder="e.g. Clinical Compliance & Security"
                        className={`w-full px-3 py-2 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                          touched.department && fieldErrors.department
                            ? 'border-red-400 focus:ring-red-200'
                            : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                        }`}
                      />
                      {touched.department && fieldErrors.department && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          {fieldErrors.department}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── PASSWORD & CONFIRMATION SECTION ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Password */}
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-bold uppercase tracking-wider text-[#26352A] mb-1.5"
                  >
                    Password <span className="text-[#C85C5C]">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-[#66736A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => markTouched('password')}
                      placeholder="Min. 8 characters"
                      className={`w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                        touched.password && fieldErrors.password
                          ? 'border-red-400 focus:ring-red-200'
                          : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66736A] hover:text-[#26352A] p-1 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {touched.password && fieldErrors.password && (
                    <p className="mt-1 text-xs font-medium text-red-600">{fieldErrors.password}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="reg-confirm-password"
                    className="block text-xs font-bold uppercase tracking-wider text-[#26352A] mb-1.5"
                  >
                    Confirm Password <span className="text-[#C85C5C]">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-[#66736A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => markTouched('confirmPassword')}
                      placeholder="Re-enter password"
                      className={`w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-sm text-[#26352A] placeholder-[#9AA59D] focus:outline-none focus:ring-2 transition-all ${
                        touched.confirmPassword && fieldErrors.confirmPassword
                          ? 'border-red-400 focus:ring-red-200'
                          : confirmPassword.length > 0 && password === confirmPassword
                            ? 'border-[#5F8D65] focus:ring-[#A8CBA0]/40 focus:border-[#47634C]'
                            : 'border-[#D5DFD3] focus:border-[#47634C] focus:ring-[#A8CBA0]/40'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#66736A] hover:text-[#26352A] p-1 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {touched.confirmPassword && fieldErrors.confirmPassword && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                  {confirmPassword.length > 0 && password === confirmPassword && (
                    <p className="mt-1 text-xs font-medium text-[#47634C] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                    </p>
                  )}
                </div>
              </div>

              {/* Password Strength Meter & Live Requirements */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-[#66736A] font-medium">Password Strength</span>
                  <span className={`font-bold ${passwordChecks.textColor}`}>
                    {passwordChecks.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 h-1.5 mb-2.5">
                  {[1, 2, 3, 4].map((segment) => (
                    <div
                      key={segment}
                      className={`rounded-full transition-all duration-200 ${
                        password.length > 0 && passwordChecks.score >= segment
                          ? passwordChecks.color
                          : 'bg-[#DDE5DA]'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#66736A]">
                  <span
                    className={`inline-flex items-center gap-1 ${
                      passwordChecks.hasMinLength ? 'text-[#47634C] font-bold' : ''
                    }`}
                  >
                    <Check className="w-3 h-3" /> 8+ characters
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 ${
                      passwordChecks.hasUppercase ? 'text-[#47634C] font-bold' : ''
                    }`}
                  >
                    <Check className="w-3 h-3" /> Uppercase letter
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 ${
                      passwordChecks.hasNumber ? 'text-[#47634C] font-bold' : ''
                    }`}
                  >
                    <Check className="w-3 h-3" /> Number
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 ${
                      passwordChecks.hasSpecial ? 'text-[#47634C] font-bold' : ''
                    }`}
                  >
                    <Check className="w-3 h-3" /> Symbol
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl bg-[#47634C] hover:bg-[#39523E] active:bg-[#2F4433] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initializing Secure Account…</span>
                    </>
                  ) : (
                    <>
                      <span>
                        Create{' '}
                        {selectedRole === 'patient'
                          ? 'Patient'
                          : selectedRole === 'doctor'
                            ? 'Healthcare Provider'
                            : 'Organization'}{' '}
                        Account
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Bottom Sign-In Callout Card (Matches LoginPage Callout Card) */}
            <div className="mt-6 p-4 rounded-2xl bg-[#F8F3EA] border border-[#DDE5DA] flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-[#26352A]">Already have an account?</p>
                <p className="text-[11px] text-[#66736A]">
                  Sign in to access your Patient, Clinician, or Admin workspace.
                </p>
              </div>
              <Link
                to="/login"
                className="px-3.5 py-2 rounded-xl bg-[#E7F0E4] hover:bg-[#D5E6D0] text-[#26352A] font-bold text-xs whitespace-nowrap transition-colors"
              >
                Sign in.
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Security Note */}
        <div className="text-center text-[11px] text-[#66736A] mt-6">
          Protected by Medrynx Zero-Trust Access Control • Bcrypt Credential Verification &amp; Rotating Refresh Tokens
        </div>
      </div>
    </div>
  );
};
