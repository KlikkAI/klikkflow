/**
 * Enterprise Security API Routes
 * Provides secure access to enterprise security features
 */

import {
  AcknowledgeAlertSchema,
  AlertQuerySchema,
  CreateThreatSchema,
  fromSecurityEvidenceDTO,
  ScanQuerySchema,
  StartVulnerabilityScanSchema,
  ThreatQuerySchema,
  toSecurityAlertDTO,
  toSecurityComplianceFrameworkDTO,
  toSecurityMetricsDTO,
  toSecurityThreatDTO,
  toVulnerabilityScanDTO,
  UpdateThreatStatusSchema,
} from '@klikkflow/shared';
import { type Request, type Response, Router } from 'express';
import { moderateRateLimit, relaxedRateLimit } from '../middleware/rate-limit.middleware';
import { enterpriseSecurityService } from '../services/EnterpriseSecurityService';

const router = Router();

/**
 * GET /api/security/metrics
 * Get current security metrics
 */
router.get('/metrics', relaxedRateLimit, async (_req: Request, res: Response) => {
  try {
    const metrics = enterpriseSecurityService.getSecurityMetrics();
    const metricsDTO = toSecurityMetricsDTO(metrics);

    return res.json({
      success: true,
      data: metricsDTO,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get security metrics',
    });
  }
});

/**
 * GET /api/security/threats
 * Get security threats
 */
router.get('/threats', relaxedRateLimit, async (req: Request, res: Response) => {
  try {
    const { status } = ThreatQuerySchema.parse(req.query);
    const threats = enterpriseSecurityService.getSecurityThreats(status);
    const threatsDTO = threats.map(toSecurityThreatDTO);

    return res.json({
      success: true,
      data: threatsDTO,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid query parameters',
    });
  }
});

/**
 * POST /api/security/threats
 * Create a new security threat
 */
router.post('/threats', moderateRateLimit, async (req: Request, res: Response) => {
  try {
    const threatData = CreateThreatSchema.parse(req.body);

    // Convert timestamp strings to Date objects
    const processedThreatData = {
      ...threatData,
      evidence: threatData.evidence.map((e) =>
        fromSecurityEvidenceDTO({
          ...e,
          timestamp: e.timestamp,
        })
      ),
    };

    const threat = await enterpriseSecurityService.createThreat(processedThreatData);
    const threatDTO = toSecurityThreatDTO(threat);

    return res.status(201).json({
      success: true,
      data: threatDTO,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create threat',
    });
  }
});

/**
 * PUT /api/security/threats/:id/status
 * Update threat status
 */
router.put('/threats/:id/status', moderateRateLimit, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, resolution, assignedTo } = UpdateThreatStatusSchema.parse(req.body);

    const threat = await enterpriseSecurityService.updateThreatStatus(
      id,
      status,
      resolution,
      assignedTo
    );

    if (!threat) {
      return res.status(404).json({
        success: false,
        error: 'Threat not found',
      });
    }

    const threatDTO = toSecurityThreatDTO(threat);

    return res.json({
      success: true,
      data: threatDTO,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update threat status',
    });
  }
});

/**
 * POST /api/security/scans
 * Start vulnerability scan
 */
router.post('/scans', moderateRateLimit, async (req: Request, res: Response) => {
  try {
    const { type, metadata = {} } = StartVulnerabilityScanSchema.parse(req.body);

    const scan = await enterpriseSecurityService.startVulnerabilityScan(type, metadata);
    const scanDTO = toVulnerabilityScanDTO(scan);

    return res.status(201).json({
      success: true,
      data: scanDTO,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start vulnerability scan',
    });
  }
});

/**
 * GET /api/security/scans
 * Get vulnerability scans
 */
router.get('/scans', relaxedRateLimit, async (req: Request, res: Response) => {
  try {
    const { type } = ScanQuerySchema.parse(req.query);
    const scans = enterpriseSecurityService.getVulnerabilityScans(type);
    const scansDTO = scans.map(toVulnerabilityScanDTO);

    return res.json({
      success: true,
      data: scansDTO,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid query parameters',
    });
  }
});

/**
 * GET /api/security/alerts
 * Get security alerts
 */
router.get('/alerts', relaxedRateLimit, async (req: Request, res: Response) => {
  try {
    const { acknowledged } = AlertQuerySchema.parse(req.query);
    const alerts = enterpriseSecurityService.getSecurityAlerts(acknowledged);
    const alertsDTO = alerts.map(toSecurityAlertDTO);

    return res.json({
      success: true,
      data: alertsDTO,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Invalid query parameters',
    });
  }
});

/**
 * POST /api/security/alerts/:id/acknowledge
 * Acknowledge security alert
 */
router.post('/alerts/:id/acknowledge', moderateRateLimit, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = AcknowledgeAlertSchema.parse(req.body);

    const alert = await enterpriseSecurityService.acknowledgeAlert(id, acknowledgedBy);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    const alertDTO = toSecurityAlertDTO(alert);

    return res.json({
      success: true,
      data: alertDTO,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge alert',
    });
  }
});

/**
 * GET /api/security/compliance
 * Get compliance frameworks
 */
router.get('/compliance', relaxedRateLimit, async (_req: Request, res: Response) => {
  try {
    const frameworks = enterpriseSecurityService.getComplianceFrameworks();
    const frameworksDTO = frameworks.map(toSecurityComplianceFrameworkDTO);

    return res.json({
      success: true,
      data: frameworksDTO,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get compliance frameworks',
    });
  }
});

/**
 * POST /api/security/compliance/:id/assess
 * Assess compliance for a framework
 */
router.post('/compliance/:id/assess', moderateRateLimit, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const framework = await enterpriseSecurityService.assessCompliance(id);

    if (!framework) {
      return res.status(404).json({
        success: false,
        error: 'Compliance framework not found',
      });
    }

    const frameworkDTO = toSecurityComplianceFrameworkDTO(framework);

    return res.json({
      success: true,
      data: frameworkDTO,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assess compliance',
    });
  }
});

export default router;
