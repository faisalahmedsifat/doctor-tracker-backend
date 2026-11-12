import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../common/errors.js';
import { getActiveAdmin } from '../modules/auth/auth.service.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; role: 'admin' };
    user: { sub: string; email: string; role: 'admin' };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    authAdmin: { id: string; email: string; role: 'admin' } | null;
  }
}

export async function registerAuthentication(app: FastifyInstance): Promise<void> {
  app.decorateRequest('authAdmin', null);
  app.decorate('authenticate', async function authenticate(request: FastifyRequest): Promise<void> {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }

    const subject = request.user.sub;
    if (!subject) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }

    // Database failures are deliberately not converted into 401 responses.
    // A valid token with an unavailable database is a server/dependency failure.
    request.authAdmin = await getActiveAdmin(subject);
  });
}
