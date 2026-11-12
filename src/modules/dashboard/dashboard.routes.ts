import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getDashboardOverview } from './dashboard.service.js';

const recentPatientSchema = z.object({
  id: z.string(),
  patientNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  assignedDoctor: z.string().nullable(),
  createdAt: z.string(),
  status: z.enum(['active', 'inactive']),
});
const overviewSchema = z.object({
  success: z.literal(true),
  data: z.object({
    metrics: z.object({
      totalDoctors: z.number(),
      activeDoctors: z.number(),
      totalPatients: z.number(),
      activePatients: z.number(),
      averagePatientsPerActiveDoctor: z.number(),
      newPatientsThisMonth: z.number(),
      newPatientsLastMonth: z.number(),
      newPatientsChangePercent: z.number(),
      assignedPatients: z.number(),
    }),
    patientGrowth: z.array(z.object({ month: z.string(), patients: z.number() })),
    patientsByDoctor: z.array(z.object({ name: z.string(), patients: z.number() })),
    recentPatients: z.array(recentPatientSchema),
    generatedAt: z.string(),
  }),
});

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);
  app.get(
    '/overview',
    {
      schema: {
        tags: ['Dashboard'],
        summary: 'Get administrator dashboard overview',
        response: { 200: overviewSchema },
      },
    },
    async () => ({ success: true as const, data: await getDashboardOverview() }),
  );
};
