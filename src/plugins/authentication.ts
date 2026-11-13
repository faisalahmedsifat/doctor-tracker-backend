import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../common/errors.js';
import { env } from '../config/env.js';
import { ACCESS_COOKIE_NAME } from './security.js';
import { getActiveAdmin } from '../modules/auth/auth.service.js';

export interface AuthAdmin {
  id: string;
  email: string;
  role: 'admin';
}

// Express request augmentation is required for the authenticated principal.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authAdmin?: AuthAdmin;
    }
  }
}

export const authenticate: RequestHandler = async (request, _response, next) => {
  try {
    const signedCookie = request.signedCookies?.[ACCESS_COOKIE_NAME] as string | undefined;
    if (!signedCookie) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(signedCookie, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    request.authAdmin = await getActiveAdmin(payload.sub);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin: RequestHandler = (request, _response, next) => {
  if (!request.authAdmin) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    return;
  }
  next();
};
