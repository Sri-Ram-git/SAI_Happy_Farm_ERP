import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeReport } from '../../../frontend/src/utils/normalizeDailyReport';

describe('Farmer Remarks Visibility and Preservation Suite', () => {
  describe('1. Data Normalization & Historical Field Fallbacks', () => {
    it('normalizes standard remarks preserving line breaks, whitespace, and punctuation', () => {
      const multilineRemark = 'Flock health is excellent today.\nMortality: 0 birds.\nFeed intake normal; ventilation adjusted at 2 PM.';
      const normalized = normalizeReport('2026-10-12', {
        userId: 'farmer-1',
        farmId: 'AP12',
        flockId: 'FL01',
        birdCount: 2000,
        eggsProduced: 1850,
        feedKg: 240,
        mortality: 0,
        remarks: multilineRemark,
      });

      expect(normalized.remarks).toBe(multilineRemark);
      expect(normalized.remarks).toContain('\n');
      expect(normalized.remarks).toContain('2 PM.');
    });

    it('handles empty, null, and undefined remarks gracefully without fabricated values', () => {
      const withNull = normalizeReport('2026-10-12', { remarks: null });
      const withUndefined = normalizeReport('2026-10-12', {});
      const withEmpty = normalizeReport('2026-10-12', { remarks: '' });

      expect(withNull.remarks).toBe('');
      expect(withUndefined.remarks).toBe('');
      expect(withEmpty.remarks).toBe('');
    });

    it('supports historical alias fields (notes, comment, observations) when remarks is absent', () => {
      const withNotes = normalizeReport('2026-10-10', {
        userId: 'farmer-legacy',
        notes: 'Legacy feed notes from imported sheet.',
      });
      expect(withNotes.remarks).toBe('Legacy feed notes from imported sheet.');

      const withComment = normalizeReport('2026-10-11', {
        userId: 'farmer-legacy-2',
        comment: 'Comment field variant.',
      });
      expect(withComment.remarks).toBe('Comment field variant.');

      const withObservations = normalizeReport('2026-10-12', {
        userId: 'farmer-legacy-3',
        observations: 'Observations from veterinarian inspection.',
      });
      expect(withObservations.remarks).toBe('Observations from veterinarian inspection.');
    });

    it('preserves long remarks without truncation', () => {
      const longText = 'A'.repeat(850) + '\nEnd of notes.';
      const normalized = normalizeReport('2026-10-12', {
        remarks: longText,
      });
      expect(normalized.remarks).toBe(longText);
      expect(normalized.remarks.length).toBe(850 + 14);
    });
  });

  describe('2. UI Code Verification: Admin & Supervisor Dashboards & Drawers', () => {
    const frontendSrc = path.resolve(__dirname, '../../../frontend/src');

    it('AdminFarmDetailPage includes Remarks and Action columns and ReportDetailDrawer', () => {
      const fileContent = fs.readFileSync(
        path.join(frontendSrc, 'pages/admin/AdminFarmDetailPage.tsx'),
        'utf-8'
      );
      expect(fileContent).toContain('<th>Remarks</th>');
      expect(fileContent).toContain('<th>Action</th>');
      expect(fileContent).toContain('remarks-cell-preview');
      expect(fileContent).toContain('No remarks provided');
      expect(fileContent).toContain('ReportDetailDrawer');
      expect(fileContent).toContain('selectedReport');
    });

    it('SupervisorFarmDetailPage includes Remarks and Action columns and ReportDetailDrawer', () => {
      const fileContent = fs.readFileSync(
        path.join(frontendSrc, 'pages/supervisor/SupervisorFarmDetailPage.tsx'),
        'utf-8'
      );
      expect(fileContent).toContain('<th>Remarks</th>');
      expect(fileContent).toContain('<th>Action</th>');
      expect(fileContent).toContain('remarks-cell-preview');
      expect(fileContent).toContain('No remarks provided');
      expect(fileContent).toContain('ReportDetailDrawer');
      expect(fileContent).toContain('selectedReport');
    });

    it('AdminSubmissionsPage includes Remarks and Action columns and ReportDetailDrawer', () => {
      const fileContent = fs.readFileSync(
        path.join(frontendSrc, 'pages/admin/AdminSubmissionsPage.tsx'),
        'utf-8'
      );
      expect(fileContent).toContain('<th>Remarks</th>');
      expect(fileContent).toContain('<th>Action</th>');
      expect(fileContent).toContain('remarks-cell-preview');
      expect(fileContent).toContain('No remarks provided');
      expect(fileContent).toContain('ReportDetailDrawer');
      expect(fileContent).toContain('selectedReportRow');
    });

    it('SupervisorSubmissionsPage includes Remarks and Action columns and ReportDetailDrawer', () => {
      const fileContent = fs.readFileSync(
        path.join(frontendSrc, 'pages/supervisor/SupervisorSubmissionsPage.tsx'),
        'utf-8'
      );
      expect(fileContent).toContain('<th>Remarks</th>');
      expect(fileContent).toContain('<th>Action</th>');
      expect(fileContent).toContain('remarks-cell-preview');
      expect(fileContent).toContain('No remarks provided');
      expect(fileContent).toContain('ReportDetailDrawer');
      expect(fileContent).toContain('selectedReportRow');
    });

    it('DashboardMetricDetailModal submitted reports tab displays Remarks and fallback', () => {
      const fileContent = fs.readFileSync(
        path.join(frontendSrc, 'components/dashboard/DashboardMetricDetailModal.tsx'),
        'utf-8'
      );
      expect(fileContent).toContain('<th>Remarks</th>');
      expect(fileContent).toContain('s.report.remarks');
      expect(fileContent).toContain('No remarks provided');
    });

    it('ReportDetailDrawer component implements dedicated remarks card with pre-wrap formatting and empty state', () => {
      const fileContent = fs.readFileSync(
        path.join(frontendSrc, 'components/dashboard/ReportDetailDrawer.tsx'),
        'utf-8'
      );
      expect(fileContent).toContain('Farmer Remarks');
      expect(fileContent).toContain('report-remarks-card');
      expect(fileContent).toContain('report-remarks-text');
      expect(fileContent).toContain('report-remarks-empty');
      expect(fileContent).toContain('No remarks provided');
      expect(fileContent).toContain('whiteSpace: \'pre-wrap\'');
      expect(fileContent).toContain('overflowWrap: \'anywhere\'');
      expect(fileContent).toContain('wordBreak: \'break-word\'');
    });
  });
});
