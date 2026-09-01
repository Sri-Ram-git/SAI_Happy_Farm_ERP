import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedUser } from '../types/auth';
import { DailyReportInput, DailyReport, DailyReportResponse } from '../types/reports';
import { ReportsRepository } from '../repositories/reports.repository';
import { validateDailyReportBusinessRules } from '../validators/report.validator';
import { auditService } from './audit.service';
import { InternalError } from '../utils/errors';

export class ReportsService {
  private reportsRepository = new ReportsRepository();

  async createDailyReport(
    input: DailyReportInput,
    user: AuthenticatedUser,
    requestId: string,
  ): Promise<DailyReportResponse> {
    validateDailyReportBusinessRules(input);

    const today = new Date().toISOString().split('T')[0];
    if (!today) {
      throw new InternalError('Failed to generate date');
    }

    const report: DailyReport = {
      reportId: uuidv4(),
      farmId: input.farmId,
      birdCount: input.birdCount,
      feedKg: input.feedKg,
      mortality: input.mortality,
      culling: input.culling,
      eggsProduced: input.eggsProduced,
      selectionEggs: input.selectionEggs,
      temperature: input.temperature,
      eggWeight: {
        min: input.eggWeight.min,
        max: input.eggWeight.max,
        avg: input.eggWeight.avg,
      },
      bodyWeight: {
        min: input.bodyWeight.min,
        max: input.bodyWeight.max,
        avg: input.bodyWeight.avg,
      },
      remarks: input.remarks ?? '',
      ammoniaPpm: input.ammoniaPpm,
      submittedBy: user.uid,
      submissionDate: today,
      submissionMethod: 'DIGITAL_FORM',
      createdAt: new Date().toISOString(),
    };

    const result = await this.reportsRepository.createReport(report, requestId);

    await auditService.logReportCreated(user.uid, input.farmId, result.reportId, requestId);

    return result;
  }

  async getReportById(reportId: string, _user: AuthenticatedUser): Promise<DailyReport> {
    return this.reportsRepository.findReportById(reportId);
  }
}

export const reportsService = new ReportsService();
