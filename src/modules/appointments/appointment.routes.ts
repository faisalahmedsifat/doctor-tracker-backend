import { Router, type Router as ExpressRouter } from 'express';
import { AppError } from '../../common/errors.js';
import { authenticate } from '../../plugins/authentication.js';
import { createAppointment, deleteAppointment, getAppointment, listAppointments, updateAppointment } from './appointment.service.js';
import { appointmentIdParamsSchema, appointmentInputSchema, appointmentListQuerySchema, appointmentUpdateSchema } from './appointment.schemas.js';

export const appointmentRoutes: ExpressRouter = Router();
appointmentRoutes.use(authenticate);
appointmentRoutes.get('/', async (request, response, next) => {
  try { response.json({ success: true, data: await listAppointments(appointmentListQuerySchema.parse(request.query)) }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
appointmentRoutes.get('/:id', async (request, response, next) => {
  try { const { id } = appointmentIdParamsSchema.parse(request.params); response.json({ success: true, data: { appointment: await getAppointment(id) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
appointmentRoutes.post('/', async (request, response, next) => {
  try { const input = appointmentInputSchema.parse(request.body); response.status(201).json({ success: true, data: { appointment: await createAppointment(input) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
appointmentRoutes.patch('/:id', async (request, response, next) => {
  try { const { id } = appointmentIdParamsSchema.parse(request.params); const input = appointmentUpdateSchema.parse(request.body); response.json({ success: true, data: { appointment: await updateAppointment(id, input) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
appointmentRoutes.delete('/:id', async (request, response, next) => {
  try { const { id } = appointmentIdParamsSchema.parse(request.params); await deleteAppointment(id); response.json({ success: true }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
