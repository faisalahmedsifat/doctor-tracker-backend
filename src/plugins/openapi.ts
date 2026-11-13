import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const ok = (description: string) => ({ description });
const error = (description: string) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });
const idParam = [{ name: 'id', in: 'path', required: true, schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }];
const protectedOperation = (tags: string[], summary: string, responses: Record<string, unknown>) => ({
  tags, summary, security: [{ accessCookie: [] }], responses,
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Doctor Tracker API',
    description: 'REST API for the Doctor Tracker administration application',
    version: '1.0.0',
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
  tags: [
    { name: 'Health', description: 'Liveness and dependency readiness' },
    { name: 'Auth', description: 'Administrator authentication' },
    { name: 'Doctors', description: 'Doctor management' },
    { name: 'Patients', description: 'Patient management' },
    { name: 'Dashboard', description: 'Dashboard analytics' },
    { name: 'Appointments', description: 'Appointment scheduling and management' },
  ],
  components: {
    securitySchemes: {
      accessCookie: { type: 'apiKey', in: 'cookie', name: 'doctor_tracker_access', description: 'Signed HTTP-only administrator access cookie' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } }, required: ['code', 'message'] },
        },
        required: ['success', 'error'],
      },
    },
  },
  paths: {
    '/': { get: { tags: ['Health'], summary: 'API information', responses: { '200': ok('API name, version, docs and health URLs') } } },
    '/api/v1/health/live': { get: { tags: ['Health'], summary: 'Liveness probe', responses: { '200': ok('Process is alive') } } },
    '/api/v1/health/ready': { get: { tags: ['Health'], summary: 'Readiness probe', responses: { '200': ok('MongoDB replica set and Redis are ready'), '503': error('One or more dependencies are unavailable') } } },
    '/api/v1/auth/login': { post: { tags: ['Auth'], summary: 'Sign in as administrator', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 12 } } } } } }, responses: { '200': ok('Authenticated; sets signed access cookie'), '400': error('Invalid payload'), '401': error('Invalid credentials'), '429': error('Login rate limit exceeded') } } },
    '/api/v1/auth/logout': { post: { tags: ['Auth'], summary: 'Sign out and clear access cookie', responses: { '200': ok('Logged out') } } },
    '/api/v1/auth/me': { get: { ...protectedOperation(['Auth'], 'Get the current administrator', { '200': ok('Current administrator'), '401': error('Unauthenticated') }) } },
    '/api/v1/doctors': {
      get: { ...protectedOperation(['Doctors'], 'List, search, filter, sort and paginate doctors', { '200': ok('Doctor collection and pagination'), '400': error('Invalid query') }), parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] } }] },
      post: { ...protectedOperation(['Doctors'], 'Create a doctor', { '201': ok('Doctor created'), '400': error('Invalid payload'), '409': error('Duplicate doctor data') }), requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', description: 'Doctor input; see doctorInputSchema in source.' } } } } },
    },
    '/api/v1/doctors/{id}/patients': { get: { ...protectedOperation(['Doctors'], 'List patients assigned to a doctor', { '200': ok('Assigned patient collection and pagination'), '404': error('Doctor not found') }), parameters: idParam } },
    '/api/v1/doctors/{id}/patients/{patientId}': { delete: { ...protectedOperation(['Doctors'], 'Unassign a patient without deleting the patient record', { '200': ok('Patient unassigned'), '404': error('Assignment not found') }), parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'patientId', in: 'path', required: true, schema: { type: 'string' } }] } },
    '/api/v1/doctors/{id}': {
      get: { ...protectedOperation(['Doctors'], 'Get a doctor', { '200': ok('Doctor details'), '404': error('Doctor not found') }), parameters: idParam },
      patch: { ...protectedOperation(['Doctors'], 'Update a doctor', { '200': ok('Doctor updated'), '400': error('Invalid payload'), '404': error('Doctor not found'), '409': error('Conflicting doctor data') }), parameters: idParam, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', description: 'Partial doctor update; see doctorUpdateSchema in source.' } } } } },
      delete: { ...protectedOperation(['Doctors'], 'Delete a doctor', { '200': ok('Doctor deleted'), '404': error('Doctor not found'), '409': error('Doctor has appointments') }), parameters: idParam },
    },
    '/api/v1/patients': {
      get: { ...protectedOperation(['Patients'], 'List, search, filter, sort and paginate patients', { '200': ok('Patient collection and pagination'), '400': error('Invalid query') }), parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] } }] },
      post: { ...protectedOperation(['Patients'], 'Create a patient', { '201': ok('Patient created'), '400': error('Invalid payload') }), requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', description: 'Patient input; see patientInputSchema in source.' } } } } },
    },
    '/api/v1/patients/{id}': {
      get: { ...protectedOperation(['Patients'], 'Get a patient', { '200': ok('Patient details'), '404': error('Patient not found') }), parameters: idParam },
      patch: { ...protectedOperation(['Patients'], 'Update a patient', { '200': ok('Patient updated'), '400': error('Invalid payload'), '404': error('Patient not found') }), parameters: idParam, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', description: 'Partial patient update; see patientUpdateSchema in source.' } } } } },
      delete: { ...protectedOperation(['Patients'], 'Delete a patient', { '200': ok('Patient deleted'), '404': error('Patient not found'), '409': error('Patient has appointments') }), parameters: idParam },
    },
    '/api/v1/dashboard/overview': { get: { ...protectedOperation(['Dashboard'], 'Get live dashboard metrics and analytics', { '200': ok('Metrics, patient growth, doctor distribution and recent patients'), '401': error('Unauthenticated') }) } },
    '/api/v1/appointments': {
      get: { ...protectedOperation(['Appointments'], 'List appointments with filters and pagination', { '200': ok('Appointment collection and pagination'), '400': error('Invalid query') }), parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] } }, { name: 'doctorId', in: 'query', schema: { type: 'string' } }, { name: 'patientId', in: 'query', schema: { type: 'string' } }, { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date-time' } }] },
      post: { ...protectedOperation(['Appointments'], 'Schedule an appointment', { '201': ok('Appointment created'), '400': error('Invalid payload'), '409': error('Scheduling conflict or lock contention'), '503': error('Scheduling coordinator unavailable') }), requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['patientId', 'doctorId', 'startAt'], properties: { patientId: { type: 'string' }, doctorId: { type: 'string' }, startAt: { type: 'string', format: 'date-time' }, durationMinutes: { type: 'integer', default: 30 }, reason: { type: 'string' }, notes: { type: 'string' }, scheduleOverrideReason: { type: 'string', description: 'Required when booking outside configured doctor working hours.' } } } } } } },
    },
    '/api/v1/appointments/{id}': {
      get: { ...protectedOperation(['Appointments'], 'Get an appointment', { '200': ok('Appointment details'), '404': error('Appointment not found') }), parameters: idParam },
      patch: { ...protectedOperation(['Appointments'], 'Update an appointment', { '200': ok('Appointment updated'), '400': error('Invalid payload'), '404': error('Appointment not found'), '409': error('Scheduling conflict') }), parameters: idParam, requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', description: 'Partial appointment update; see appointmentUpdateSchema in source.' } } } } },
      delete: { ...protectedOperation(['Appointments'], 'Delete an appointment', { '200': ok('Appointment deleted'), '404': error('Appointment not found') }), parameters: idParam },
    },
  },
};

export function registerOpenApi(app: Express): void {
  app.get('/documentation/json', (_request, response) => response.json(openApiDocument));
  app.use('/documentation', swaggerUi.serve, swaggerUi.setup(openApiDocument));
}
