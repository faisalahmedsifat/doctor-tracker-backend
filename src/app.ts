import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { AppError } from './common/errors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { registerOpenApi } from './plugins/openapi.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { doctorRoutes } from './modules/doctors/doctor.routes.js';
import { patientRoutes } from './modules/patients/patient.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { appointmentRoutes } from './modules/appointments/appointment.routes.js';

export function buildApp(): Express {
  const app = express();
  if (env.NODE_ENV === 'production') app.set('trust proxy', true);

  app.use(helmet());
  app.use(cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }));
  app.use((request, _response, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && origin !== env.FRONTEND_ORIGIN) {
        next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.'));
        return;
      }
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_request, response) => response.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded. Retry in 1 minute.' },
    }),
  }));

  app.get('/', (_request, response) => response.json({
    name: 'Doctor Tracker API',
    version: '1.0.0',
    documentation: '/documentation',
    health: '/api/v1/health/live',
  }));

  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/doctors', doctorRoutes);
  app.use('/api/v1/patients', patientRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  registerOpenApi(app);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
