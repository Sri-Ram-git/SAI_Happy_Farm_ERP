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

  async getDailyReportsByDateRange(
    startDate: string,
    endDate: string,
    farmIds?: string[],
  ): Promise<any[]> {
    try {
      const reports: any[] = [];
      const farmFilter = farmIds && farmIds.length > 0 ? new Set(farmIds) : null;

      // 1. Fetch from collectionGroup('dailyLogs')
      try {
        const snap = await this.db.collectionGroup('dailyLogs').get();
        snap.docs.forEach((doc) => {
          const data = doc.data();
          const dateStr = data['submissionDate'] || data['reportDate'];
          const fId = data['farmId'];
          if (dateStr && dateStr >= startDate && dateStr <= endDate) {
            if (!farmFilter || (fId && farmFilter.has(fId))) {
              reports.push(data);
            }
          }
        });
      } catch (e) {
        logger.warn('Failed querying collectionGroup dailyLogs, falling back to dailyReports', { error: e });
      }

      // 2. Fetch from top-level dailyReports collection
      try {
        const snap = await this.db.collection('dailyReports').get();
        snap.docs.forEach((doc) => {
          const data = doc.data();
          const dateStr = data['submissionDate'] || data['reportDate'];
          const fId = data['farmId'];
          if (dateStr && dateStr >= startDate && dateStr <= endDate) {
            if (!farmFilter || (fId && farmFilter.has(fId))) {
              reports.push(data);
            }
          }
        });
      } catch (e) {
        logger.warn('Failed querying dailyReports collection', { error: e });
      }

      // Deduplicate by farmId + submissionDate
      const seen = new Map<string, any>();
      reports.forEach((r) => {
        const key = `${r.farmId}_${r.submissionDate || r.reportDate}`;
        if (!seen.has(key) || (r.submissionVersion || 1) > (seen.get(key).submissionVersion || 1)) {
          seen.set(key, r);
        }
      });

      return Array.from(seen.values());
    } catch (error) {
      logger.error('Failed to fetch daily reports by date range', { error });
      throw new InternalError('Failed to fetch daily reports');
    }
  }
}

