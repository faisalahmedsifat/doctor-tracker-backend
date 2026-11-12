import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createDoctor, deleteDoctor, getDoctor, listDoctors, updateDoctor } from './doctor.service.js';
import {
  doctorIdParamsSchema, doctorInputSchema, doctorListQuerySchema, doctorListResponseSchema,
  doctorSingleResponseSchema, doctorUpdateSchema,
} from './doctor.schemas.js';

const errorResponse = z.object({
  success: z.literal(false), error: z.object({ code: z.string(), message: z.string() }),
});
export const doctorRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.get('/', {
    schema: { tags: ['Doctors'], summary: 'List doctors', querystring: doctorListQuerySchema,
      response: { 200: doctorListResponseSchema } },
  }, async (request) => ({ success: true as const, data: await listDoctors(request.query) }));
  app.get('/:id', {
    schema: { tags: ['Doctors'], summary: 'Get doctor', params: doctorIdParamsSchema,
      response: { 200: doctorSingleResponseSchema, 404: errorResponse } },
  }, async (request) => ({ success: true as const, data: { doctor: await getDoctor(request.params.id) } }));
  app.post('/', {
    schema: { tags: ['Doctors'], summary: 'Create doctor', body: doctorInputSchema,
      response: { 201: doctorSingleResponseSchema, 400: errorResponse, 409: errorResponse } },
  }, async (request, reply) => reply.code(201).send({
    success: true as const, data: { doctor: await createDoctor(request.body) },
  }));
  app.patch('/:id', {
    schema: { tags: ['Doctors'], summary: 'Update doctor', params: doctorIdParamsSchema,
      body: doctorUpdateSchema, response: { 200: doctorSingleResponseSchema, 400: errorResponse, 404: errorResponse, 409: errorResponse } },
  }, async (request) => ({ success: true as const,
    data: { doctor: await updateDoctor(request.params.id, request.body) } }));
  app.delete('/:id', {
    schema: { tags: ['Doctors'], summary: 'Delete doctor', params: doctorIdParamsSchema,
      response: { 200: z.object({ success: z.literal(true) }), 404: errorResponse } },
  }, async (request) => { await deleteDoctor(request.params.id); return { success: true as const }; });
};
