import type { CookieOptions } from 'express';
import { env } from '../config/env.js';

export const ACCESS_COOKIE_NAME = 'doctor_tracker_access';
export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};
