import { Router, type Router as ExpressRouter } from 'express';
import { authenticate } from '../../plugins/authentication.js';
import { getDashboardOverview } from './dashboard.service.js';

export const dashboardRoutes: ExpressRouter = Router();
dashboardRoutes.use(authenticate);
dashboardRoutes.get('/overview', async (_request, response) => {
  response.json({ success: true, data: await getDashboardOverview() });
});
