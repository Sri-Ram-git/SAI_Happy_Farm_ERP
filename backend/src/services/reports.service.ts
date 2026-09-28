import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedUser } from '../types/auth';
import { DailyReportInput, DailyReport, DailyReportResponse } from '../types/reports';
import { ReportsRepository } from '../repositories/reports.repository';
import { validateDailyReportBusinessRules } from '../validators/report.validator';
import { auditService } from './audit.service';
import { InternalError } from '../utils/errors';
import { logger } from '../utils/logger';


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
      feedGramsPerBird:
        input.feedGramsPerBird ??
        (input.birdCount > 0 && input.feedKg > 0
          ? Number(((input.feedKg * 1000) / input.birdCount).toFixed(1))
          : null),
      mortality: input.mortality,
      culling: input.culling,
      eggsProduced: input.eggsProduced,
      selectionEggs: input.selectionEggs,
      damagedEggs: input.damagedEggs ?? 0,
      floorEggs: input.floorEggs ?? 0,
      temperature: input.temperature,
      eggWeight: {
        min: input.eggWeight.min,
        max: input.eggWeight.max,
        avg: input.eggWeight.avg,
      },
      bodyWeight: input.bodyWeight
        ? {
            min: input.bodyWeight.min,
            max: input.bodyWeight.max,
            avg: input.bodyWeight.avg,
          }
        : null,
      remarks: input.remarks ?? '',
      ammoniaPpm: input.ammoniaPpm ?? null,
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

  async generateProductionCurveExport(
    startDate: string,
    endDate: string,
    requestId: string,
    targetFarmIds?: string[],
  ): Promise<{ buffer: Buffer; filename: string }> {
    const fs = await import('fs');
    const path = await import('path');
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { getFirestore } = await import('../config/firebase');

    const rawReports = await this.reportsRepository.getDailyReportsByDateRange(startDate, endDate, targetFarmIds);
    if (!rawReports || rawReports.length === 0) {
      throw new InternalError('No daily reports found for the selected date range');
    }

    const db = getFirestore();
    const farmsSnap = await db.collection('farms').get();
    const farmMap = new Map<string, { farmId: string; name: string; initialBirds?: number }>();
    farmsSnap.docs.forEach((d) => {
      const data = d.data();
      farmMap.set(d.id, {
        farmId: d.id,
        name: data['name'] || data['farmName'] || d.id,
        initialBirds: data['initialBirdCount'] || data['currentBirdCount'] || 1000,
      });
    });

    const flocksSnap = await db.collection('flocks').get();
    const flockMap = new Map<string, { farmId: string; productionCurve: 'CF_STD' | 'FR_STD'; initialBirds: number; startDate: string }>();
    flocksSnap.docs.forEach((d) => {
      const data = d.data();
      if (data['farmId']) {
        flockMap.set(data['farmId'], {
          farmId: data['farmId'],
          productionCurve: data['productionCurve'] || 'CF_STD',
          initialBirds: data['initialBirds'] || 1000,
          startDate: data['startDate'] || '2026-01-01',
        });
      }
    });

    // Group reports by farm
    const farmReportsMap = new Map<string, any[]>();
    rawReports.forEach((r) => {
      const fId = r.farmId || 'UNKNOWN';
      if (!farmReportsMap.has(fId)) {
        farmReportsMap.set(fId, []);
      }
      farmReportsMap.get(fId)!.push(r);
    });

    // Ensure all target farms are included
    const allFarmIds = new Set<string>([...farmReportsMap.keys()]);
    if (targetFarmIds && targetFarmIds.length > 0) {
      targetFarmIds.forEach((id) => allFarmIds.add(id));
    }

    const farmsPayload: any[] = [];
    for (const fId of allFarmIds) {
      const farmInfo = farmMap.get(fId);
      const flockInfo = flockMap.get(fId);
      const rList = farmReportsMap.get(fId) || [];

      rList.sort((a, b) => (a.submissionDate || a.reportDate || '').localeCompare(b.submissionDate || b.reportDate || ''));

      const initialBirds = flockInfo?.initialBirds || farmInfo?.initialBirds || 1200;
      const curveType = flockInfo?.productionCurve || 'CF_STD';
      const flockStartDateStr = flockInfo?.startDate || rList[0]?.submissionDate || '2026-01-01';

      // Calculate age weeks for each report in W.D poultry notation
      const flockStartMs = new Date(flockStartDateStr + 'T00:00:00+05:30').getTime();
      const startWeek = (flockInfo as any)?.initialAgeWeeks ?? 17;

      const formattedReports = rList.map((rep) => {
        const dateStr = rep.submissionDate || rep.reportDate;
        const repMs = new Date(dateStr + 'T00:00:00+05:30').getTime();
        const daysElapsed = Math.max(0, Math.floor((repMs - flockStartMs) / (24 * 3600 * 1000)));
        const fullWeeks = startWeek + Math.floor(daysElapsed / 7);
        const dayInWeek = daysElapsed % 7;
        const ageWeeks = dayInWeek === 0 ? fullWeeks : Math.round((fullWeeks + dayInWeek * 0.1) * 10) / 10;

        return {
          submissionDate: dateStr,
          ageWeeks,
          openingBirdCount: rep.openingBirdCount ?? rep.birdCount ?? initialBirds,
          eggsProduced: rep.eggsProduced ?? null,
          selectionEggs: rep.selectionEggs ?? null,
          mortality: rep.mortality ?? null,
          culling: rep.culling ?? null,
          temperature: rep.temperature ?? rep.tempAvg ?? null,
          feedKg: rep.feedKg ?? null,
        };
      });

      farmsPayload.push({
        farmId: fId,
        farmName: farmInfo?.name || fId,
        productionCurve: curveType,
        initialBirds,
        reports: formattedReports,
      });
    }

    const payload = { farms: farmsPayload };

    // Resolve project root: __dirname = backend/src/services → go up 3 levels to project root
    const projectRoot = path.resolve(__dirname, '..', '..', '..');
    const tmpDir = path.join(projectRoot, 'scratch');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const inputJsonPath = path.join(tmpDir, `export_in_${Date.now()}_${Math.random().toString(36).substring(7)}.json`);
    const outputXlsxPath = path.join(tmpDir, `export_out_${Date.now()}_${Math.random().toString(36).substring(7)}.xlsx`);

    fs.writeFileSync(inputJsonPath, JSON.stringify(payload, null, 2), 'utf-8');

    // Script lives at <projectRoot>/scripts/generate_production_curve.py
    const scriptPath = path.join(projectRoot, 'scripts', 'generate_production_curve.py');
    logger.info('Generating production curve Excel', { requestId, scriptPath, inputJsonPath, outputXlsxPath, farmCount: farmsPayload.length });
    try {
      const { stdout, stderr } = await execFileAsync('python', [scriptPath, inputJsonPath, outputXlsxPath]);
      if (stdout) logger.info('Python script stdout', { requestId, stdout: stdout.substring(0, 500) });
      if (stderr) logger.warn('Python script stderr', { requestId, stderr: stderr.substring(0, 500) });

      const buffer = fs.readFileSync(outputXlsxPath);

      // Clean up temp files
      try {
        fs.unlinkSync(inputJsonPath);
        fs.unlinkSync(outputXlsxPath);
      } catch (e) {
        // ignore cleanup error
      }

      const filename = `Production_Report_${startDate}_to_${endDate}.xlsx`;
      return { buffer, filename };
    } catch (error: any) {
      const errMsg = error?.stderr || error?.message || String(error);
      logger.error('Failed to generate production curve Excel export', {
        requestId,
        errorMessage: errMsg,
        scriptPath,
        stage: 'PYTHON_EXEC',
      });
      throw new InternalError(`Failed to generate production curve Excel export: ${errMsg.substring(0, 200)}`);
    }
  }
}


export const reportsService = new ReportsService();
