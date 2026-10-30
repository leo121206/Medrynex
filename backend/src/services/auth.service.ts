import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User, UserRole, DoctorVerificationStatus } from '@prisma/client';
import { prisma, isDbConnected } from '../models/db';
import { store, InMemoryUser } from '../models/store';
import { ApiError } from '../utils/apiError';
import { signToken } from '../utils/jwt';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { AuthenticatedUser } from '../types/common.types';

export type SanitizedUser = Omit<User, 'passwordHash'>;

export const sanitizeUser = (user: User | InMemoryUser): SanitizedUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...sanitized } = user;
  return sanitized as SanitizedUser;
};

export interface AuthResponse {
  user: SanitizedUser;
  token: string;
  refreshToken?: string;
}

// Brute-force protection & account lockout tracking (email => { attempts, lockedUntil })
interface LockoutEntry {
  attempts: number;
  lockedUntil?: number;
}
const loginAttemptTracker = new Map<string, LockoutEntry>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export const checkAccountLockout = (email: string): void => {
  const entry = loginAttemptTracker.get(email);
  if (!entry) return;

  const now = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > now) {
    const remainingMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
    throw ApiError.forbidden(
      `Account temporarily locked due to excessive failed login attempts. Please try again in ${remainingMinutes} minute(s).`
    );
  }

  if (entry.lockedUntil && entry.lockedUntil <= now) {
    loginAttemptTracker.delete(email);
  }
};

export const recordFailedLogin = (email: string): void => {
  const now = Date.now();
  const entry = loginAttemptTracker.get(email) || { attempts: 0 };
  entry.attempts += 1;

  if (entry.attempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  loginAttemptTracker.set(email, entry);
};

export const clearFailedLogin = (email: string): void => {
  loginAttemptTracker.delete(email);
};

export const registerUser = async (input: RegisterInput): Promise<AuthResponse> => {
  const email = input.email.toLowerCase();
  const role = input.role as UserRole;
  let patientId = input.patientId;
  let doctorId = input.doctorId;
  let adminId = input.adminId;
  let verificationStatus: DoctorVerificationStatus | undefined = undefined;

  if (role === UserRole.PATIENT) {
    patientId = patientId || `PT-${Math.floor(10000 + Math.random() * 90000)}`;
  } else if (role === UserRole.DOCTOR) {
    doctorId = doctorId || `d-${Math.floor(100 + Math.random() * 900)}`;
    verificationStatus = DoctorVerificationStatus.VERIFIED;
  } else if (role === UserRole.ADMIN) {
    adminId = adminId || `adm-${Math.floor(100 + Math.random() * 900)}`;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  if (isDbConnected) {
    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw ApiError.conflict('An account with this email address already exists');
      }

      const newUser = await prisma.user.create({
        data: {
          name: input.name,
          email,
          passwordHash,
          role,
          phone: input.phone,
          avatarUrl: input.avatarUrl || undefined,
          patientId,
          dob: input.dob,
          gender: input.gender,
          bloodGroup: input.bloodGroup,
          doctorId,
          licenseId: input.licenseId,
          specialization: input.specialization,
          hospital: input.hospital,
          verificationStatus,
          adminId,
          department: input.department,
        },
      });

      const authPayload: AuthenticatedUser = {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        patientId: newUser.patientId ?? undefined,
        doctorId: newUser.doctorId ?? undefined,
        adminId: newUser.adminId ?? undefined,
        hospital: newUser.hospital ?? undefined,
      };

      const refreshToken = await issueRefreshToken(newUser.id);

      return {
        user: sanitizeUser(newUser),
        token: signToken(authPayload),
        refreshToken,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }
  }

  // Fallback to in-memory store immediately
  const existingMemory = store.users.find((u) => u.email === email);
  if (existingMemory) {
    throw ApiError.conflict('An account with this email address already exists');
  }

  const memoryUser: InMemoryUser = {
    id: `usr-${Date.now()}`,
    name: input.name,
    email,
    passwordHash,
    role,
    phone: input.phone,
    patientId,
    dob: input.dob,
    gender: input.gender,
    bloodGroup: input.bloodGroup,
    doctorId,
    licenseId: input.licenseId,
    specialization: input.specialization,
    hospital: input.hospital,
    verificationStatus: verificationStatus || DoctorVerificationStatus.VERIFIED,
    adminId,
    department: input.department,
    permissions: role === UserRole.PATIENT ? ['READ_OWN', 'WRITE_OWN', 'GRANT_CONSENT'] : ['REQUEST_ACCESS'],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: new Date(),
  };

  store.users.push(memoryUser);

  const authPayload: AuthenticatedUser = {
    id: memoryUser.id,
    email: memoryUser.email,
    role: memoryUser.role,
    patientId: memoryUser.patientId ?? undefined,
    doctorId: memoryUser.doctorId ?? undefined,
    adminId: memoryUser.adminId ?? undefined,
    hospital: memoryUser.hospital ?? undefined,
  };

  const refreshToken = await issueRefreshToken(memoryUser.id);

  return {
    user: sanitizeUser(memoryUser),
    token: signToken(authPayload),
    refreshToken,
  };
};


export const issueRefreshToken = async (userId: string, deviceId?: string, ipAddress?: string): Promise<string> => {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  if (isDbConnected) {
    try {
      await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash,
          deviceId,
          ipAddress,
          expiresAt,
        },
      });
      return rawToken;
    } catch {
      // fallback
    }
  }

  store.refreshTokens.push({
    id: `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId,
    tokenHash,
    deviceId,
    ipAddress,
    isRevoked: false,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return rawToken;
};

export const rotateRefreshToken = async (rawOldToken: string): Promise<{ token: string; refreshToken: string; user: SanitizedUser }> => {
  const tokenHash = crypto.createHash('sha256').update(rawOldToken).digest('hex');
  const now = new Date();

  let userId: string | null = null;

  if (isDbConnected) {
    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing || existing.isRevoked || existing.expiresAt < now) {
      throw ApiError.unauthorized('Invalid, expired, or revoked refresh token');
    }

    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { isRevoked: true },
    });

    userId = existing.userId;
  } else {
    const existing = store.refreshTokens.find((rt) => rt.tokenHash === tokenHash);
    if (!existing || existing.isRevoked || existing.expiresAt < now) {
      throw ApiError.unauthorized('Invalid, expired, or revoked refresh token');
    }
    existing.isRevoked = true;
    userId = existing.userId;
  }

  const user = await getCurrentUserProfile(userId);
  const authPayload: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
    patientId: user.patientId ?? undefined,
    doctorId: user.doctorId ?? undefined,
    adminId: user.adminId ?? undefined,
    hospital: user.hospital ?? undefined,
  };

  const newAccessToken = signToken(authPayload);
  const newRefreshToken = await issueRefreshToken(userId);

  return {
    token: newAccessToken,
    refreshToken: newRefreshToken,
    user,
  };
};

export const revokeRefreshToken = async (rawToken: string): Promise<void> => {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  if (isDbConnected) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  } else {
    const existing = store.refreshTokens.find((rt) => rt.tokenHash === tokenHash);
    if (existing) existing.isRevoked = true;
  }
};

export const loginUser = async (input: LoginInput): Promise<AuthResponse> => {
  const email = input.email.toLowerCase();

  // Check account brute-force lockout
  checkAccountLockout(email);

  if (isDbConnected) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        recordFailedLogin(email);
        throw ApiError.unauthorized('Invalid email or password credentials');
      }

      if (input.role && user.role !== (input.role as UserRole)) {
        recordFailedLogin(email);
        throw ApiError.unauthorized(
          `Account role mismatch. This account is registered as '${user.role}', but '${input.role}' login was requested.`
        );
      }

      // Strict bcrypt comparison — no bypass allowed
      const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
      if (!isPasswordValid) {
        recordFailedLogin(email);
        throw ApiError.unauthorized('Invalid email or password credentials');
      }

      // Login success: clear failed attempt tracker
      clearFailedLogin(email);

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });

      const authPayload: AuthenticatedUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        organizationId: updatedUser.organizationId ?? undefined,
        patientId: updatedUser.patientId ?? undefined,
        doctorId: updatedUser.doctorId ?? undefined,
        adminId: updatedUser.adminId ?? undefined,
        hospital: updatedUser.hospital ?? undefined,
      };

      const refreshToken = await issueRefreshToken(updatedUser.id);

      return {
        user: sanitizeUser(updatedUser),
        token: signToken(authPayload),
        refreshToken,
      };
    } catch (err) {
      if (err instanceof ApiError) throw err;
    }
  }

  // Fallback to in-memory store immediately
  const user = store.users.find((u) => u.email === email);
  if (!user) {
    recordFailedLogin(email);
    throw ApiError.unauthorized('Invalid email or password credentials');
  }

  if (input.role && user.role !== (input.role as UserRole)) {
    recordFailedLogin(email);
    throw ApiError.unauthorized(
      `Account role mismatch. This account is registered as '${user.role}', but '${input.role}' login was requested.`
    );
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    recordFailedLogin(email);
    throw ApiError.unauthorized('Invalid email or password credentials');
  }

  clearFailedLogin(email);
  user.lastLogin = new Date();

  const authPayload: AuthenticatedUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId ?? undefined,
    patientId: user.patientId ?? undefined,
    doctorId: user.doctorId ?? undefined,
    adminId: user.adminId ?? undefined,
    hospital: user.hospital ?? undefined,
  };

  const refreshToken = await issueRefreshToken(user.id);

  return {
    user: sanitizeUser(user),
    token: signToken(authPayload),
    refreshToken,
  };
};

export const getCurrentUserProfile = async (userId: string): Promise<SanitizedUser> => {
  if (isDbConnected) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        return sanitizeUser(user);
      }
    } catch {
      // Fallback to in-memory store
    }
  }

  const memoryUser = store.users.find((u) => u.id === userId || u.patientId === userId || u.doctorId === userId || u.adminId === userId);
  if (!memoryUser) {
    throw ApiError.notFound('User profile not found');
  }

  return sanitizeUser(memoryUser);
};

export const updateUserProfile = async (
  userId: string,
  updates: { name?: string; email?: string; phone?: string; dob?: string; bloodGroup?: string; specialization?: string; hospital?: string }
): Promise<SanitizedUser> => {
  if (isDbConnected) {
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.email ? { email: updates.email.toLowerCase() } : {}),
          ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
          ...(updates.dob !== undefined ? { dob: updates.dob } : {}),
          ...(updates.bloodGroup !== undefined ? { bloodGroup: updates.bloodGroup } : {}),
          ...(updates.specialization !== undefined ? { specialization: updates.specialization } : {}),
          ...(updates.hospital !== undefined ? { hospital: updates.hospital } : {}),
        },
      });
      return sanitizeUser(updated);
    } catch {
      // Fallback to in-memory store
    }
  }

  const memoryUser = store.users.find((u) => u.id === userId);
  if (!memoryUser) {
    throw ApiError.notFound('User profile not found');
  }
  if (updates.name) memoryUser.name = updates.name;
  if (updates.email) memoryUser.email = updates.email.toLowerCase();
  if (updates.phone !== undefined) memoryUser.phone = updates.phone;
  if (updates.dob !== undefined) memoryUser.dob = updates.dob;
  if (updates.bloodGroup !== undefined) memoryUser.bloodGroup = updates.bloodGroup;
  if (updates.specialization !== undefined) memoryUser.specialization = updates.specialization;
  if (updates.hospital !== undefined) memoryUser.hospital = updates.hospital;
  memoryUser.updatedAt = new Date();

  return sanitizeUser(memoryUser);
};


