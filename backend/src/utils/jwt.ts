import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthenticatedUser } from '../types/common.types';

export interface JwtPayload extends AuthenticatedUser {
  iat?: number;
  exp?: number;
}

export const signToken = (payload: AuthenticatedUser, expiresIn?: string | number): string => {
  const options: SignOptions = {
    expiresIn: (expiresIn || env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};
