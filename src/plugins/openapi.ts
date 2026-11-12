import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: { title: 'Doctor Tracker API', description: 'REST API for the Doctor Tracker administration application', version: '1.0.0' },
      servers: [{ url: 'http://localhost:4000', description: 'Local development' },
      ],
      tags: [
        { name: 'Health', description: 'Service health' },
        { name: 'Auth', description: 'Administrator authentication' },
        { name: 'Doctors', description: 'Doctor management' },
        { name: 'Patients', description: 'Patient management' },
        { name: 'Dashboard', description: 'Dashboard analytics' },
      ],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/documentation' });
}
