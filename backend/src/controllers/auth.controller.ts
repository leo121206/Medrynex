import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, getCurrentUserProfile, updateUserProfile } from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawKey, ...rawVal] = part.trim().split('=');
    if (rawKey) {
      acc[rawKey.trim()] = decodeURIComponent(rawVal.join('='));
    }
    return acc;
  }, {});
};

const isSecureRequest = (req: Request): boolean => {
  return (
    process.env.NODE_ENV === 'production' ||
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https'
  );
};

const setAuthCookies = (res: Response, req: Request, token: string, refreshToken?: string): void => {
  const secure = isSecureRequest(req);
  const sameSite: 'none' | 'lax' = secure ? 'none' : 'lax';

  res.cookie('medrynx_access_token', token, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  if (refreshToken) {
    res.cookie('medrynx_refresh_token', refreshToken, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
};

const clearAuthCookies = (res: Response, req: Request): void => {
  const secure = isSecureRequest(req);
  const sameSite: 'none' | 'lax' = secure ? 'none' : 'lax';
  res.clearCookie('medrynx_access_token', { httpOnly: true, secure, sameSite, path: '/' });
  res.clearCookie('medrynx_refresh_token', { httpOnly: true, secure, sameSite, path: '/api/v1/auth' });
};

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await registerUser(req.body);
    setAuthCookies(res, req, result.token, result.refreshToken);
    ApiResponse.created(res, result, 'User registered successfully');
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await loginUser(req.body);
    setAuthCookies(res, req, result.token, result.refreshToken);
    ApiResponse.success(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw ApiError.unauthorized('Authentication required');
    }
    const user = await getCurrentUserProfile(req.user.id);
    ApiResponse.success(res, user, 'Current user profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id) {
      throw ApiError.unauthorized('Authentication required');
    }
    const user = await updateUserProfile(req.user.id, req.body);
    ApiResponse.success(res, user, 'User profile updated successfully');
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = req.body?.refreshToken || cookies.medrynx_refresh_token;
    if (!token) {
      throw ApiError.badRequest('Refresh token required in request body');
    }
    const { rotateRefreshToken } = await import('../services/auth.service');
    const result = await rotateRefreshToken(token);
    setAuthCookies(res, req, result.token, result.refreshToken);
    ApiResponse.success(res, result, 'Token refreshed successfully');
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const token = req.body?.refreshToken || cookies.medrynx_refresh_token;
    if (token) {
      const { revokeRefreshToken } = await import('../services/auth.service');
      await revokeRefreshToken(token);
    }
    clearAuthCookies(res, req);
    ApiResponse.success(res, { loggedOut: true }, 'Successfully logged out');
  } catch (error) {
    next(error);
  }
};
