import { getFirestore } from '../config/firebase';
import { AuditLogEntry } from '../types/reports';
import { logger } from '../utils/logger';

export class AuditService {
  private get db() {
    return getFirestore();
  }

  async log(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
    try {
      const fullEntry: AuditLogEntry = {
        ...entry,
        timestamp: new Date().toISOString(),
      };

      await this.db.collection('auditLogs').add(fullEntry);

      logger.info('Audit log recorded', {
        requestId: entry.requestId,
        userId: entry.uid,
        eventType: entry.eventType,
        farmId: entry.farmId,
        resourceId: entry.resourceId,
      });
    } catch (error) {
      logger.error('Failed to record audit log', {
        requestId: entry.requestId,
        userId: entry.uid,
        eventType: entry.eventType,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });
    }
  }

  async logLogin(uid: string, requestId: string): Promise<void> {
    await this.log({
      eventType: 'LOGIN',
      uid,
      requestId,
    });
  }

  async logReportCreated(
    uid: string,
    farmId: string,
    reportId: string,
    requestId: string,
  ): Promise<void> {
    await this.log({
      eventType: 'REPORT_CREATED',
      uid,
      farmId,
      resourceId: reportId,
      requestId,
    });
  }

  async logReportUpdated(
    uid: string,
    farmId: string,
    reportId: string,
    requestId: string,
  ): Promise<void> {
    await this.log({
      eventType: 'REPORT_UPDATED',
      uid,
      farmId,
      resourceId: reportId,
      requestId,
    });
  }

  async logReportRejected(
    uid: string,
    farmId: string,
    reportId: string,
    requestId: string,
  ): Promise<void> {
    await this.log({
      eventType: 'REPORT_REJECTED',
      uid,
      farmId,
      resourceId: reportId,
      requestId,
    });
  }
}

export const auditService = new AuditService();
