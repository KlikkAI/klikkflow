/**
 * Backend API Routes Index
 * Centralized route configuration for all backend services
 */

import { Router } from 'express';
import authRoutes from '../domains/auth/routes/authRoutes.js';
import collaborationRoutes from '../domains/collaboration/routes/collaborationRoutes.js';
import credentialRoutes from '../domains/credentials/routes/credentialRoutes.js';
import nodeExecutionRoutes from '../domains/executions/routes/nodeExecutionRoutes.js';
import oauthRoutes from '../domains/oauth/routes/oauthRoutes.js';
// Import domain routes
import workflowRoutes from '../domains/workflows/routes/workflowRoutes.js';
import auditRoutes from './audit.js';
import instanceRoutes from './instances.js';
import marketplaceRoutes from './marketplace.js';
import scheduleRoutes from './schedules.js';
import securityRoutes from './security.js';
import triggerRoutes from './triggers.js';
import workflowOptimizationRoutes from './workflow-optimization.js';

const router = Router();

// Mount route modules
router.use('/audit', auditRoutes);
router.use('/instances', instanceRoutes);
router.use('/triggers', triggerRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/security', securityRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/workflow-optimization', workflowOptimizationRoutes);

// Mount domain routes
router.use('/auth', authRoutes);
router.use('/workflows', workflowRoutes);
router.use('/executions', nodeExecutionRoutes);
router.use('/credentials', credentialRoutes);
router.use('/collaboration', collaborationRoutes);
router.use('/oauth', oauthRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Backend API is healthy',
    timestamp: new Date().toISOString(),
    services: {
      auth: 'operational',
      workflows: 'operational',
      executions: 'operational',
      credentials: 'operational',
      collaboration: 'operational',
      oauth: 'operational',
      audit: 'operational',
      instances: 'operational',
      triggers: 'operational',
      schedules: 'operational',
      security: 'operational',
      marketplace: 'operational',
      workflowOptimization: 'operational',
    },
  });
});

// API info endpoint
router.get('/info', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'KlikkFlow Backend API',
      version: '1.0.0',
      description: 'Backend services for workflow automation platform',
      endpoints: {
        auth: '/api/auth',
        workflows: '/api/workflows',
        executions: '/api/executions',
        credentials: '/api/credentials',
        collaboration: '/api/collaboration',
        oauth: '/api/oauth',
        audit: '/api/audit',
        instances: '/api/instances',
        triggers: '/api/triggers',
        schedules: '/api/schedules',
        security: '/api/security',
        marketplace: '/api/marketplace',
        workflowOptimization: '/api/workflow-optimization',
      },
    },
  });
});

export default router;
