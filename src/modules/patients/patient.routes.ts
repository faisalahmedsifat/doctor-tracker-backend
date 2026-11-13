import { Router, type Router as ExpressRouter } from 'express';
import { AppError } from '../../common/errors.js';
import { authenticate } from '../../plugins/authentication.js';
import { createPatient, deletePatient, getPatient, listPatients, updatePatient } from './patient.service.js';
import { patientIdParamsSchema, patientInputSchema, patientListQuerySchema, patientUpdateSchema } from './patient.schemas.js';

export const patientRoutes: ExpressRouter = Router();
patientRoutes.use(authenticate);
patientRoutes.get('/', async (request, response, next) => {
  try { response.json({ success: true, data: await listPatients(patientListQuerySchema.parse(request.query)) }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
patientRoutes.get('/:id', async (request, response, next) => {
  try { const { id } = patientIdParamsSchema.parse(request.params); response.json({ success: true, data: { patient: await getPatient(id) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
patientRoutes.post('/', async (request, response, next) => {
  try { const input = patientInputSchema.parse(request.body); response.status(201).json({ success: true, data: { patient: await createPatient(input) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
patientRoutes.patch('/:id', async (request, response, next) => {
  try { const { id } = patientIdParamsSchema.parse(request.params); const input = patientUpdateSchema.parse(request.body); response.json({ success: true, data: { patient: await updatePatient(id, input) } }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
patientRoutes.delete('/:id', async (request, response, next) => {
  try { const { id } = patientIdParamsSchema.parse(request.params); await deletePatient(id); response.json({ success: true }); }
  catch (error) { next(error instanceof Error && 'issues' in error ? new AppError(400, 'VALIDATION_ERROR', error.message) : error); }
});
