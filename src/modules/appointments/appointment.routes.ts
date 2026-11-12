import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { createAppointment, deleteAppointment, getAppointment, listAppointments, updateAppointment } from './appointment.service.js';
import { appointmentIdParamsSchema, appointmentInputSchema, appointmentListQuerySchema, appointmentListResponseSchema, appointmentSingleResponseSchema, appointmentUpdateSchema } from './appointment.schemas.js';

const errorResponse = z.object({ success: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) });

export const appointmentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.get('/', { schema: { tags: ['Appointments'], summary: 'List appointments', querystring: appointmentListQuerySchema, response: { 200: appointmentListResponseSchema } } },
    async (request) => ({ success: true as const, data: await listAppointments(request.query) }));
  app.get('/:id', { schema: { tags: ['Appointments'], summary: 'Get appointment', params: appointmentIdParamsSchema, response: { 200: appointmentSingleResponseSchema, 404: errorResponse } } },
    async (request) => ({ success: true as const, data: { appointment: await getAppointment(request.params.id) } }));
  app.post('/', { schema: { tags: ['Appointments'], summary: 'Schedule appointment', body: appointmentInputSchema, response: { 201: appointmentSingleResponseSchema, 400: errorResponse, 409: errorResponse } } },
    async (request, reply) => reply.code(201).send({ success: true as const, data: { appointment: await createAppointment(request.body) } }));
  app.patch('/:id', { schema: { tags: ['Appointments'], summary: 'Update appointment', params: appointmentIdParamsSchema, body: appointmentUpdateSchema, response: { 200: appointmentSingleResponseSchema, 400: errorResponse, 404: errorResponse, 409: errorResponse } } },
    async (request) => ({ success: true as const, data: { appointment: await updateAppointment(request.params.id, request.body) } }));
  app.delete('/:id', { schema: { tags: ['Appointments'], summary: 'Delete appointment', params: appointmentIdParamsSchema, response: { 200: z.object({ success: z.literal(true) }), 404: errorResponse } } },
    async (request) => { await deleteAppointment(request.params.id); return { success: true as const }; });
};
