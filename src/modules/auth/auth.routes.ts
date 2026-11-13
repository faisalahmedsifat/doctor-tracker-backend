import { Router, type Router as ExpressRouter } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { AppError } from '../../common/errors.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../plugins/authentication.js';
import { ACCESS_COOKIE_NAME, cookieOptions } from '../../plugins/security.js';
import { authenticateAdmin } from './auth.service.js';
import { loginBodySchema } from './auth.schemas.js';

export const authRoutes: ExpressRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Retry in 1 minute.' },
  }),
});
authRoutes.post('/login', loginLimiter, (request, response, next) => {
  const parsed = loginBodySchema.safeParse(request.body);
  if (!parsed.success) { next(new AppError(400, 'VALIDATION_ERROR', parsed.error.issues.map((issue) => issue.message).join('; '))); return; }
  Object.assign(request, { body: parsed.data });
  next();
}, async (request, response, next) => {
  try {
    const body = loginBodySchema.parse(request.body);
    const admin = await authenticateAdmin(body.email, body.password);
    const token = jwt.sign({ sub: admin.id, email: admin.email, role: admin.role }, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as NonNullable<jwt.SignOptions['expiresIn']> });
    response.cookie(ACCESS_COOKIE_NAME, token, { ...cookieOptions, signed: true, maxAge: 15 * 60 * 1000 });
    response.json({ success: true, data: { admin } });
  } catch (error) { next(error); }
});
authRoutes.post('/logout', (_request, response) => {
  response.clearCookie(ACCESS_COOKIE_NAME, cookieOptions);
  response.json({ success: true });
});
authRoutes.get('/me', authenticate, (request, response, next) => {
  if (!request.authAdmin) { next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.')); return; }
  response.json({ success: true, data: { admin: request.authAdmin } });
});
