import { getFirestore } from '../config/firebase';
import { DailyReport, DailyReportResponse, Farm } from '../types/reports';
import { NotFoundError, DuplicateError, InternalError } from '../utils/errors';
import { logger } from '../utils/logger';

export class ReportsRepository {
  private get db() {
    return getFirestore();
  }

  async createReport(
    report: DailyReport,
    requestId: string,
  ): Promise<DailyReportResponse> {
    try {
      const lockDocId = `${report.farmId}_${report.submissionDate}`;
      const lockRef = this.db.collection('dailyReportLocks').doc(lockDocId);
      const reportRef = this.db.collection('dailyReports').doc(report.reportId);

      await this.db.runTransaction(async (transaction) => {
        const lockDoc = await lockRef.get();

        if (lockDoc.exists) {
          throw new DuplicateError(
            'A report for this farm on this date already exists',
          );
        }

        transaction.set(lockRef, {
          farmId: report.farmId,
          submissionDate: report.submissionDate,
          reportId: report.reportId,
          createdAt: report.createdAt,
        });

        transaction.set(reportRef, report);
      });

      logger.info('Report created', {
        requestId,
        userId: report.submittedBy,
        farmId: report.farmId,
        reportId: report.reportId,
      });

      return {
        reportId: report.reportId,
        farmId: report.farmId,
        submissionDate: report.submissionDate,
        submissionMethod: report.submissionMethod,
      };
    } catch (error) {
      if (error instanceof DuplicateError) {
        throw error;
      }
      logger.error('Failed to create report', {
        requestId,
        userId: report.submittedBy,
        farmId: report.farmId,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new InternalError('Failed to create report');
    }
  }

  async findDuplicateReport(
    farmId: string,
    submissionDate: string,
    requestId: string,
  ): Promise<DailyReport | null> {
    try {
      const snapshot = await this.db
        .collection('dailyReports')
        .where('farmId', '==', farmId)
        .where('submissionDate', '==', submissionDate)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return doc?.data() as DailyReport;
    } catch (error) {
      logger.error('Failed to check for duplicate report', {
        requestId,
        farmId,
        submissionDate,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });
      throw new InternalError('Failed to check for duplicate report');
    }
  }

  async findReportById(reportId: string): Promise<DailyReport> {
    const doc = await this.db.collection('dailyReports').doc(reportId).get();

    if (!doc.exists) {
      throw new NotFoundError('Report');
    }

    return doc.data() as DailyReport;
  }

  async getFarmById(farmId: string): Promise<Farm> {
    const doc = await this.db.collection('farms').doc(farmId).get();

    if (!doc.exists) {
      throw new NotFoundError('Farm');
    }

    return doc.data() as Farm;
  }
}
