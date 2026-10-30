import { User, UserRole, PatientUser, DoctorUser, AdminUser } from '../types/user';
import { apiRequest, setAuthToken, setRefreshToken, getAuthToken, getRefreshToken, clearAllTokens } from './apiClient';

interface BackendAuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    phone?: string;
    patientId?: string;
    dob?: string;
    gender?: string;
    bloodGroup?: string;
    doctorId?: string;
    licenseId?: string;
    specialization?: string;
    hospital?: string;
    verificationStatus?: string;
    adminId?: string;
    department?: string;
    createdAt?: string;
    lastLogin?: string;
  };
  token: string;
  refreshToken?: string;
}

export const mapBackendUserToFrontend = (u: BackendAuthResponse['user']): User => {
  const role = (u.role.toLowerCase() as UserRole) || 'patient';
  const baseUser = {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    phone: u.phone || '',
    avatarUrl: undefined,
    createdAt: u.createdAt || new Date().toISOString(),
    lastLogin: u.lastLogin || new Date().toISOString(),
    securityStatus: {
      authentication: true,
      recordEncryption: true,
      accessMonitoring: true,
      auditLogging: true,
    },
  };

  if (role === 'doctor') {
    return {
      ...baseUser,
      role: 'doctor',
      doctorId: u.doctorId || '',
      licenseId: u.licenseId || '',
      specialization: u.specialization || 'General Medicine',
      hospital: u.hospital || '',
      verificationStatus:
        (u.verificationStatus?.toLowerCase() as 'verified' | 'pending' | 'rejected') || 'verified',
      activePatientsCount: 0,
      authorizedRecordsCount: 0,
    } as DoctorUser;
  }

  if (role === 'admin') {
    return {
      ...baseUser,
      role: 'admin',
      adminId: u.adminId || '',
      department: u.department || 'Administration',
      permissions: ['AUDIT_ALL', 'MANAGE_USERS', 'VERIFY_DOCTORS'],
    } as AdminUser;
  }

  return {
    ...baseUser,
    role: 'patient',
    patientId: u.patientId || '',
    dob: u.dob || '',
    gender: u.gender || '',
    bloodGroup: u.bloodGroup || '',
    allergiesCount: 0,
    activeConsentsCount: 0,
    totalRecordsCount: 0,
  } as PatientUser;
};

export const authService = {
  /**
   * POST /auth/login — real credential check against the backend.
   * Stores access token + refresh token on success and returns the authenticated User.
   */
  async login(email: string, passwordOrRole: string, maybePassword?: string): Promise<User> {
    const isLegacyCall = maybePassword !== undefined;
    const password = isLegacyCall ? maybePassword : passwordOrRole;
    const role = isLegacyCall ? (passwordOrRole as UserRole) : undefined;

    const payload: Record<string, string> = {
      email: email.trim().toLowerCase(),
      password: password || '',
    };
    if (role) {
      payload.role = role.toUpperCase();
    }

    const result = await apiRequest<BackendAuthResponse>('/auth/login', {
      method: 'POST',
      data: payload,
    });

    setAuthToken(result.token);
    if (result.refreshToken) {
      setRefreshToken(result.refreshToken);
    }
    return mapBackendUserToFrontend(result.user);
  },

  /**
   * POST /auth/register — create a new account.
   * Stores tokens on success.
   */
  async register(data: Record<string, unknown>, role: UserRole): Promise<User> {
    const result = await apiRequest<BackendAuthResponse>('/auth/register', {
      method: 'POST',
      data: {
        name: ((data.fullName as string) || (data.name as string) || '').trim(),
        email: ((data.email as string) || '').trim().toLowerCase(),
        password: (data.password as string) || '',
        role: role.toUpperCase(),
        phone: (data.phone as string) || undefined,
        dob: (data.dob as string) || undefined,
        gender: (data.gender as string) || undefined,
        bloodGroup: (data.bloodGroup as string) || undefined,
        licenseId: (data.licenseId as string) || undefined,
        specialization: (data.specialization as string) || undefined,
        hospital: (data.hospital as string) || undefined,
        department: (data.department as string) || undefined,
      },
    });

    setAuthToken(result.token);
    if (result.refreshToken) {
      setRefreshToken(result.refreshToken);
    }
    return mapBackendUserToFrontend(result.user);
  },

  /**
   * Restore session from stored tokens on page load.
   * Returns null when no tokens are present (user is logged out).
   * Throws only on unexpected network failures.
   */
  async restoreSession(): Promise<User | null> {
    const accessToken = getAuthToken();
    const refreshToken = getRefreshToken();

    // Nothing stored → user is not logged in
    if (!accessToken && !refreshToken) return null;

    // Try to fetch current user with existing access token
    if (accessToken) {
      try {
        const user = await apiRequest<BackendAuthResponse['user']>('/auth/me');
        return mapBackendUserToFrontend(user);
      } catch {
        // Access token expired or invalid — try to rotate using refresh token
      }
    }

    // Try refresh token rotation
    if (refreshToken) {
      try {
        const result = await apiRequest<{ token: string; refreshToken: string; user: BackendAuthResponse['user'] }>(
          '/auth/refresh',
          {
            method: 'POST',
            data: { refreshToken },
            _skipRetry: true,
          } as Parameters<typeof apiRequest>[1]
        );
        setAuthToken(result.token);
        setRefreshToken(result.refreshToken);
        return mapBackendUserToFrontend(result.user);
      } catch {
        // Refresh token expired/revoked — clear everything, user must re-login
        clearAllTokens();
        return null;
      }
    }

    clearAllTokens();
    return null;
  },

  /**
   * POST /auth/logout — revoke refresh token on the server, then clear local tokens.
   */
  async logout(): Promise<void> {
    const rt = getRefreshToken();
    try {
      if (rt) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          data: { refreshToken: rt },
        });
      }
    } catch {
      // Best-effort — clear tokens regardless of server response
    } finally {
      clearAllTokens();
    }
  },
};
