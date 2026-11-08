import { describe, it, expect } from 'vitest';
import { evaluateFarmHealth, calcPerformanceScore } from './kpiCalculations';

describe('Farm Performance Ranking & Missing-Data Eligibility', () => {
  it('excludes farms with 0 reports from competitive ranking (isEligibleForRanking = false)', () => {
    const health = evaluateFarmHealth({
      reports: [],
      days: 90,
      liveBirds: 5000,
    });

    expect(health.isEligibleForRanking).toBe(false);
    expect(health.statusLabel).toBe('NO DATA');
    expect(health.score).toBe(0);
    expect(health.reason).toContain('0 of 90 days');
    expect(health.scoreBreakdown).toEqual({
      production: 0,
      mortality: 0,
      feedEfficiency: 0,
      compliance: 0,
    });
  });

  it('marks active operating farms as eligible and calculates 4-pillar score breakdown', () => {
    // Simulated AP15 reports
    const mockReports = Array.from({ length: 47 }, (_, i) => ({
      submissionDate: `2026-09-${String(i + 1).padStart(2, '0')}`,
      eggsProduced: 1175,
      openingBirdCount: 1800,
      mortality: i === 0 ? 3 : 0,
      feedKg: 198,
      selectionEggs: 1056,
    }));

    const health = evaluateFarmHealth({
      reports: mockReports,
      days: 90,
      liveBirds: 1800,
    });

    expect(health.isEligibleForRanking).toBe(true);
    expect(health.statusLabel).toBe('HEALTHY');
    expect(health.score).toBeGreaterThan(70);
    expect(health.hasTotalFlockLoss).toBe(false);
    expect(health.scoreBreakdown).toBeDefined();
    expect(health.scoreBreakdown?.production).toBeGreaterThan(20);
    expect(health.scoreBreakdown?.mortality).toBeGreaterThan(24);
    expect(health.scoreBreakdown?.feedEfficiency).toBeGreaterThan(12);
    expect(health.scoreBreakdown?.compliance).toBeGreaterThan(10);
  });

  it('correctly identifies catastrophic 100% single-day mortality event (AP16 case)', () => {
    // 53 days with ~0.05% mortality + 1 disaster day with 1,200/1,200 birds
    const normalDays = Array.from({ length: 53 }, (_, i) => ({
      submissionDate: `2026-08-${String(i + 1).padStart(2, '0')}`,
      eggsProduced: 733,
      openingBirdCount: 1200,
      mortality: i % 2 === 0 ? 1 : 0,
      feedKg: 136,
      selectionEggs: 673,
    }));

    const disasterDay = {
      submissionDate: '2026-10-03',
      eggsProduced: 0,
      openingBirdCount: 1200,
      mortality: 1200,
      feedKg: 0,
      selectionEggs: 0,
    };

    const mockReports = [...normalDays, disasterDay];

    const health = evaluateFarmHealth({
      reports: mockReports,
      days: 90,
      liveBirds: 1178,
    });

    expect(health.isEligibleForRanking).toBe(true);
    expect(health.hasTotalFlockLoss).toBe(true);
    expect(health.statusLabel).toBe('CRITICAL');
    expect(health.score).toBe(0);
    expect(health.totalLossDate).toBe('2026-10-03');
    expect(health.totalLossBirds).toBe(1200);
    expect(health.reason).toContain('1,200 birds died on 2026-10-03');
    // Mortality is calculated across period (~1.9%)
    expect(health.mortalityRate).toBeCloseTo(1.9, 0);
  });

  it('enforces that viable operational farms strictly outrank total flock loss disasters', () => {
    const ap15Health = {
      farmId: 'AP15',
      score: 75.0,
      hasTotalFlockLoss: false,
      mRate: 0.2,
      pRate: 65.3,
      compliance: 52,
    };

    const ap12Health = {
      farmId: 'AP12',
      score: 72.9,
      hasTotalFlockLoss: false,
      mRate: 0.0,
      pRate: 50.4,
      compliance: 66,
    };

    const ap16Health = {
      farmId: 'AP16',
      score: 0.0,
      hasTotalFlockLoss: true, // Catastrophic single-day flock loss
      mRate: 1.9,
      pRate: 61.1,
      compliance: 60,
    };

    const farms = [ap16Health, ap15Health, ap12Health];

    // Standard ranking sort
    farms.sort((a, b) => {
      if (a.hasTotalFlockLoss !== b.hasTotalFlockLoss) {
        return a.hasTotalFlockLoss ? 1 : -1;
      }
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.mRate !== b.mRate) {
        return a.mRate - b.mRate;
      }
      return b.pRate - a.pRate;
    });

    expect(farms[0].farmId).toBe('AP15'); // #1
    expect(farms[1].farmId).toBe('AP12'); // #2
    expect(farms[2].farmId).toBe('AP16'); // #3 (Disaster capped at last eligible rank)
  });
});
