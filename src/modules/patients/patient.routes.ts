import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  createPatient,
  deletePatient,
  getPatient,
  listPatients,
  updatePatient,
} from './patient.service.js';
import {
  patientIdParamsSchema,
  patientInputSchema,
  patientListQuerySchema,
  patientListResponseSchema,
  patientSingleResponseSchema,
  patientUpdateSchema,
} from './patient.schemas.js';

const errorResponse = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});

export const patientRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get(
    '/',
    {
      schema: {
        tags: ['Patients'],
        summary: 'List patients',
        querystring: patientListQuerySchema,
        response: { 200: patientListResponseSchema },
      },
    },
    async (request) => ({
      success: true as const,
      data: await listPatients(request.query),
    }),
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['Patients'],
        summary: 'Get patient',
        params: patientIdParamsSchema,
        response: { 200: patientSingleResponseSchema, 404: errorResponse },
      },
    },
    async (request) => ({
      success: true as const,
      data: { patient: await getPatient(request.params.id) },
    }),
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['Patients'],
        summary: 'Create patient',
        body: patientInputSchema,
        response: { 201: patientSingleResponseSchema, 400: errorResponse },
      },
    },
    async (request, reply) =>
      reply.code(201).send({
        success: true as const,
        data: { patient: await createPatient(request.body) },
      }),
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['Patients'],
        summary: 'Update patient',
        params: patientIdParamsSchema,
        body: patientUpdateSchema,
        response: {
          200: patientSingleResponseSchema,
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request) => ({
      success: true as const,
      data: { patient: await updatePatient(request.params.id, request.body) },
    }),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Patients'],
        summary: 'Delete patient',
        params: patientIdParamsSchema,
        response: {
          200: z.object({ success: z.literal(true) }),
          404: errorResponse,
        },
      },
    },
    async (request) => {
      await deletePatient(request.params.id);
      return { success: true as const };
    },
  );
};
