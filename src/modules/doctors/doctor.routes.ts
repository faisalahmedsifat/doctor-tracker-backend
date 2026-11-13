import { Router, type Router as ExpressRouter } from 'express';
import { AppError } from '../../common/errors.js';
import { authenticate } from '../../plugins/authentication.js';
import { createDoctor, deleteDoctor, getDoctor, listDoctors, updateDoctor } from './doctor.service.js';
import { doctorIdParamsSchema, doctorInputSchema, doctorListQuerySchema, doctorUpdateSchema } from './doctor.schemas.js';

export const doctorRoutes: ExpressRouter = Router();
doctorRoutes.use(authenticate);
doctorRoutes.get('/', async (request, response, next) => {
  try { response.json({ success: true, data: await listDoctors(doctorListQuerySchema.parse(request.query)) }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
doctorRoutes.get('/:id', async (request, response, next) => {
  try { const { id } = doctorIdParamsSchema.parse(request.params); response.json({ success: true, data: { doctor: await getDoctor(id) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
doctorRoutes.post('/', async (request, response, next) => {
  try { const input = doctorInputSchema.parse(request.body); response.status(201).json({ success: true, data: { doctor: await createDoctor(input) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
doctorRoutes.patch('/:id', async (request, response, next) => {
  try { const { id } = doctorIdParamsSchema.parse(request.params); const input = doctorUpdateSchema.parse(request.body); response.json({ success: true, data: { doctor: await updateDoctor(id, input) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
doctorRoutes.delete('/:id', async (request, response, next) => {
  try { const { id } = doctorIdParamsSchema.parse(request.params); await deleteDoctor(id); response.json({ success: true }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
