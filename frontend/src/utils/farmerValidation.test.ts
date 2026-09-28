import { describe, it, expect } from 'vitest';
import {
  validateStep,
  calculateFeedGramsPerBird,
  isHighAmmonia,
  INITIAL_FARM_FORM_DATA,
  FarmFormData,
} from './formValidation';
import {
  calculateReportingWeek,
  formatReportingWeekLabel,
  calculateWeekNumber,
  getAllowedReportDates,
} from '../services/reportService';

describe('Farmer Login Form Validation & Business Rules Suite', () => {
  const baseData: FarmFormData = {
    ...INITIAL_FARM_FORM_DATA,
    feedQuantity: '250',
    mortality: '10',
    culling: '5',
    eggsProduced: '4500',
    selectionEggs: '4000',
    tempMin: '25',
    tempMax: '32',
    eggWeightMin: '50',
    eggWeightMax: '65',
    eggWeightAvg: '57.5',
    bodyWeightMin: '1500',
    bodyWeightMax: '1900',
    bodyWeightAvg: '1700',
    ammoniaPpm: '8',
    remarks: 'Flock healthy and feeding well',
  };

  const birdCount = 5000;

  describe('1. Egg Production Max Threshold of 95%', () => {
    it('should accept egg production <= 95% of applicable bird count', () => {
      // 5000 birds * 0.95 = 4750 max allowed eggs
      const data: FarmFormData = {
        ...baseData,
        eggsProduced: '4750',
        selectionEggs: '4500',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.eggsProduced).toBeUndefined();
    });

    it('should reject egg production > 95% of applicable bird count', () => {
      // 4751 exceeds 4750
      const data: FarmFormData = {
        ...baseData,
        eggsProduced: '4751',
        selectionEggs: '4500',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.eggsProduced).toBeDefined();
      expect(errors.eggsProduced).toContain('validation.exceedsProductionRate');
    });

    it('should calculate threshold correctly for different bird counts', () => {
      // 1200 birds * 0.95 = 1140
      const data: FarmFormData = {
        ...baseData,
        eggsProduced: '1141',
        selectionEggs: '1000',
      };
      const errors = validateStep(1, data, 1200);
      expect(errors.eggsProduced).toBeDefined();

      const validData: FarmFormData = {
        ...baseData,
        eggsProduced: '1140',
        selectionEggs: '1000',
      };
      const validErrors = validateStep(1, validData, 1200);
      expect(validErrors.eggsProduced).toBeUndefined();
    });

    it('should still reject selection eggs exceeding eggs produced', () => {
      const data: FarmFormData = {
        ...baseData,
        eggsProduced: '4000',
        selectionEggs: '4100',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.selectionEggs).toBeDefined();
    });
  });

  describe('2 & 3. Body Weight Weekly Entry & Range (500g to 3,000g)', () => {
    it('should accept valid body weight between 500g and 3000g inclusive', () => {
      const data: FarmFormData = {
        ...baseData,
        bodyWeightMin: '500',
        bodyWeightMax: '3000',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.bodyWeightMin).toBeUndefined();
      expect(errors.bodyWeightMax).toBeUndefined();
    });

    it('should allow body weight to be omitted on daily submissions (weekly collection workflow)', () => {
      const data: FarmFormData = {
        ...baseData,
        bodyWeightMin: '',
        bodyWeightMax: '',
        bodyWeightAvg: '',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.bodyWeightMin).toBeUndefined();
      expect(errors.bodyWeightMax).toBeUndefined();
    });

    it('should reject body weight min < 500g', () => {
      const data: FarmFormData = {
        ...baseData,
        bodyWeightMin: '499',
        bodyWeightMax: '1800',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.bodyWeightMin).toBe('validation.bodyWeightRange');
    });

    it('should reject body weight max > 3000g', () => {
      const data: FarmFormData = {
        ...baseData,
        bodyWeightMin: '1500',
        bodyWeightMax: '3001',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.bodyWeightMax).toBe('validation.bodyWeightRange');
    });

    it('should reject body weight min > max', () => {
      const data: FarmFormData = {
        ...baseData,
        bodyWeightMin: '2200',
        bodyWeightMax: '1800',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.bodyWeightMin).toBe('validation.minExceedsMax');
    });

    it('should require both min and max if one is provided', () => {
      const dataMinOnly: FarmFormData = {
        ...baseData,
        bodyWeightMin: '1500',
        bodyWeightMax: '',
      };
      const errorsMinOnly = validateStep(2, dataMinOnly, birdCount);
      expect(errorsMinOnly.bodyWeightMax).toBe('validation.required');

      const dataMaxOnly: FarmFormData = {
        ...baseData,
        bodyWeightMin: '',
        bodyWeightMax: '1800',
      };
      const errorsMaxOnly = validateStep(2, dataMaxOnly, birdCount);
      expect(errorsMaxOnly.bodyWeightMin).toBe('validation.required');
    });
  });

  describe('4. Egg Weight Range (30g to 80g)', () => {
    it('should accept egg weights between 30g and 80g inclusive', () => {
      const data: FarmFormData = {
        ...baseData,
        eggWeightMin: '30',
        eggWeightMax: '80',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.eggWeightMin).toBeUndefined();
      expect(errors.eggWeightMax).toBeUndefined();
    });

    it('should reject egg weight min < 30g', () => {
      const data: FarmFormData = {
        ...baseData,
        eggWeightMin: '29.9',
        eggWeightMax: '65',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.eggWeightMin).toBe('validation.eggWeightRange');
    });

    it('should reject egg weight max > 80g', () => {
      const data: FarmFormData = {
        ...baseData,
        eggWeightMin: '55',
        eggWeightMax: '80.5',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.eggWeightMax).toBe('validation.eggWeightRange');
    });

    it('should reject egg weight min > max', () => {
      const data: FarmFormData = {
        ...baseData,
        eggWeightMin: '68',
        eggWeightMax: '52',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.eggWeightMin).toBe('validation.minExceedsMax');
    });

    it('should require egg weights as part of daily report', () => {
      const data: FarmFormData = {
        ...baseData,
        eggWeightMin: '',
        eggWeightMax: '',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.eggWeightMin).toBe('validation.required');
      expect(errors.eggWeightMax).toBe('validation.required');
    });
  });

  describe('Temperature Range (10°C to 50°C)', () => {
    it('should accept temperature values between 10°C and 50°C inclusive', () => {
      const data: FarmFormData = {
        ...baseData,
        tempMin: '10',
        tempMax: '50',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.tempMin).toBeUndefined();
      expect(errors.tempMax).toBeUndefined();
    });

    it('should reject tempMin < 10°C', () => {
      const data: FarmFormData = {
        ...baseData,
        tempMin: '9.9',
        tempMax: '30',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.tempMin).toBe('validation.tempRange');
    });

    it('should reject tempMax > 50°C', () => {
      const data: FarmFormData = {
        ...baseData,
        tempMin: '30',
        tempMax: '50.1',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.tempMax).toBe('validation.tempRange');
    });
  });

  describe('5. Ammonia Range (0 to 50 PPM) & High Alert (> 10 PPM)', () => {
    it('should allow ammonia to be omitted (optional daily/weekly workflow)', () => {
      const data: FarmFormData = {
        ...baseData,
        ammoniaPpm: '',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.ammoniaPpm).toBeUndefined();
    });

    it('should accept ammonia readings between 0 and 50 PPM', () => {
      const data: FarmFormData = {
        ...baseData,
        ammoniaPpm: '50',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.ammoniaPpm).toBeUndefined();
    });

    it('should reject ammonia readings > 50 PPM', () => {
      const data: FarmFormData = {
        ...baseData,
        ammoniaPpm: '51',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.ammoniaPpm).toBe('validation.maxPpm50');
    });

    it('should reject negative ammonia readings', () => {
      const data: FarmFormData = {
        ...baseData,
        ammoniaPpm: '-2',
      };
      const errors = validateStep(2, data, birdCount);
      expect(errors.ammoniaPpm).toBe('validation.invalidNumber');
    });

    it('should verify alert trigger condition: exactly 10 PPM does NOT alert; > 10 PPM alerts', () => {
      expect(isHighAmmonia('0')).toBe(false);
      expect(isHighAmmonia('5')).toBe(false);
      expect(isHighAmmonia('10')).toBe(false); // Exactly 10 PPM does NOT alert
      expect(isHighAmmonia(10)).toBe(false);
      expect(isHighAmmonia('10.1')).toBe(true); // > 10 PPM alerts
      expect(isHighAmmonia('15')).toBe(true);
      expect(isHighAmmonia('50')).toBe(true);
      expect(isHighAmmonia('55')).toBe(false); // Out of valid range
      expect(isHighAmmonia('')).toBe(false);
    });
  });

  describe('6. Feed Conversion: kg to Grams per Bird Calculation', () => {
    it('should dynamically calculate grams per bird accurately', () => {
      // 250 kg feed for 5000 birds -> (250 * 1000) / 5000 = 50.0 g/bird
      expect(calculateFeedGramsPerBird(250, 5000)).toBe(50);
      expect(calculateFeedGramsPerBird('250', 5000)).toBe(50);

      // 120 kg feed for 1000 birds -> 120.0 g/bird
      expect(calculateFeedGramsPerBird(120, 1000)).toBe(120);

      // 187.5 kg feed for 1500 birds -> (187.5 * 1000) / 1500 = 125.0 g/bird
      expect(calculateFeedGramsPerBird(187.5, 1500)).toBe(125);
    });

    it('should recalculate correctly when feed quantity changes', () => {
      const birdCount = 5000;
      expect(calculateFeedGramsPerBird(200, birdCount)).toBe(40);
      expect(calculateFeedGramsPerBird(250, birdCount)).toBe(50);
      expect(calculateFeedGramsPerBird(300, birdCount)).toBe(60);
    });

    it('should recalculate correctly when applicable bird count changes', () => {
      const feedKg = 250;
      expect(calculateFeedGramsPerBird(feedKg, 5000)).toBe(50);
      expect(calculateFeedGramsPerBird(feedKg, 4000)).toBe(62.5);
      expect(calculateFeedGramsPerBird(feedKg, 2500)).toBe(100);
    });

    it('should maintain exact 1-decimal rounding precision', () => {
      // 100 kg for 300 birds -> 100000 / 300 = 333.333... -> 333.3
      expect(calculateFeedGramsPerBird(100, 300)).toBe(333.3);
      // 123.45 kg for 1200 birds -> 123450 / 1200 = 102.875 -> 102.9
      expect(calculateFeedGramsPerBird(123.45, 1200)).toBe(102.9);
    });

    it('should handle zero or missing bird count safely without division by zero or NaN', () => {
      expect(calculateFeedGramsPerBird(250, 0)).toBe(0);
      expect(calculateFeedGramsPerBird(250, -5)).toBe(0);
      expect(calculateFeedGramsPerBird(0, 5000)).toBe(0);
      expect(calculateFeedGramsPerBird('', 5000)).toBe(0);
    });

    it('should reject negative, malformed, or non-numeric feed values', () => {
      expect(calculateFeedGramsPerBird(-50, 5000)).toBe(0);
      expect(calculateFeedGramsPerBird('abc', 5000)).toBe(0);
      expect(calculateFeedGramsPerBird(NaN, 5000)).toBe(0);
    });
  });

  describe('7. Report Week Numbering Format (3, 3.1-3.6, 4, 4.1-4.6, 5, 5.1...)', () => {
    const startDate = '2026-03-01';

    it('should format first reporting period day 0 as 3', () => {
      const res = calculateReportingWeek(startDate, '2026-03-01');
      expect(res.label).toBe('3');
      expect(res.weekNumber).toBe(3);
      expect(res.dayInWeek).toBe(0);
      expect(formatReportingWeekLabel(startDate, '2026-03-01')).toBe('3');
      expect(calculateWeekNumber(startDate, '2026-03-01')).toBe(3);
    });

    it('should format first week subperiods as 3.1 through 3.6', () => {
      expect(formatReportingWeekLabel(startDate, '2026-03-02')).toBe('3.1');
      expect(formatReportingWeekLabel(startDate, '2026-03-03')).toBe('3.2');
      expect(formatReportingWeekLabel(startDate, '2026-03-04')).toBe('3.3');
      expect(formatReportingWeekLabel(startDate, '2026-03-05')).toBe('3.4');
      expect(formatReportingWeekLabel(startDate, '2026-03-06')).toBe('3.5');
      expect(formatReportingWeekLabel(startDate, '2026-03-07')).toBe('3.6');

      // The weekNumber remains 3 for weekly locks during all subperiods
      expect(calculateWeekNumber(startDate, '2026-03-02')).toBe(3);
      expect(calculateWeekNumber(startDate, '2026-03-07')).toBe(3);
    });

    it('should format next main week starting at 4, followed by 4.1 through 4.6', () => {
      // Day 7 = Main week 4
      expect(formatReportingWeekLabel(startDate, '2026-03-08')).toBe('4');
      expect(calculateWeekNumber(startDate, '2026-03-08')).toBe(4);

      // Subperiods 4.1 to 4.6
      expect(formatReportingWeekLabel(startDate, '2026-03-09')).toBe('4.1');
      expect(formatReportingWeekLabel(startDate, '2026-03-10')).toBe('4.2');
      expect(formatReportingWeekLabel(startDate, '2026-03-11')).toBe('4.3');
      expect(formatReportingWeekLabel(startDate, '2026-03-12')).toBe('4.4');
      expect(formatReportingWeekLabel(startDate, '2026-03-13')).toBe('4.5');
      expect(formatReportingWeekLabel(startDate, '2026-03-14')).toBe('4.6');
      expect(calculateWeekNumber(startDate, '2026-03-14')).toBe(4);
    });

    it('should continue dynamically for subsequent weeks (5, 5.1...)', () => {
      // Day 14 = Main week 5
      expect(formatReportingWeekLabel(startDate, '2026-03-15')).toBe('5');
      expect(calculateWeekNumber(startDate, '2026-03-15')).toBe(5);

      // Day 15 = 5.1
      expect(formatReportingWeekLabel(startDate, '2026-03-16')).toBe('5.1');
    });

    it('should handle timestamp objects, ISO strings, and fallback safely without error', () => {
      expect(formatReportingWeekLabel(null, null)).toBe('');
      expect(formatReportingWeekLabel('invalid-date', 'invalid-date')).toBe('');
      expect(calculateWeekNumber(null, null)).toBeNull();

      const dateObj = new Date('2026-03-01T00:00:00Z');
      expect(formatReportingWeekLabel(dateObj, '2026-03-03')).toBe('3.2');
    });

    it('should correctly format reported case: Monday, 28 September 2026 (must produce .1, never .6)', () => {
      // Benchmark placement date 2026-09-01 (Tuesday) with baseWeek 3
      // Week 3 = Aug 30 to Sep 5
      // Week 4 = Sep 6 to Sep 12
      // Week 5 = Sep 13 to Sep 19
      // Week 6 = Sep 20 to Sep 26 (Saturday Sep 26 = 6.6)
      // Week 7 = Sep 27 to Oct 3 (Sunday Sep 27 = 7, Monday Sep 28 = 7.1)
      const res = calculateReportingWeek('2026-09-01', '2026-09-28', 3);
      expect(res.dayInWeek).toBe(1); // Monday is ALWAYS day 1 (.1)
      expect(res.label).toBe('7.1');
      expect(res.label).not.toContain('.6');
      expect(res.weekNumber).toBe(7);

      // If flock started on Monday 2026-09-07 with baseWeek 3:
      const res2 = calculateReportingWeek('2026-09-07', '2026-09-28', 3);
      expect(res2.dayInWeek).toBe(1);
      expect(res2.label).toBe('6.1');
      expect(res2.weekNumber).toBe(6);
    });

    it('should test full week progression (Mon .1 to Sat .6, Sunday whole number)', () => {
      // Week of Sep 27 to Oct 3, 2026 (flock startDate 2026-09-01)
      expect(formatReportingWeekLabel('2026-09-01', '2026-09-27')).toBe('7');   // Sunday
      expect(formatReportingWeekLabel('2026-09-01', '2026-09-28')).toBe('7.1'); // Monday
      expect(formatReportingWeekLabel('2026-09-01', '2026-09-29')).toBe('7.2'); // Tuesday
      expect(formatReportingWeekLabel('2026-09-01', '2026-09-30')).toBe('7.3'); // Wednesday
      expect(formatReportingWeekLabel('2026-09-01', '2026-10-01')).toBe('7.4'); // Thursday
      expect(formatReportingWeekLabel('2026-09-01', '2026-10-02')).toBe('7.5'); // Friday
      expect(formatReportingWeekLabel('2026-09-01', '2026-10-03')).toBe('7.6'); // Saturday
      expect(formatReportingWeekLabel('2026-09-01', '2026-10-04')).toBe('8');   // Next Sunday
    });

    it('should handle seamless week boundary transition from Saturday N.6 to Sunday N+1 to Monday (N+1).1', () => {
      // Transition from Week 6 to Week 7:
      // Saturday 26 Sep 2026 -> 6.6
      // Sunday 27 Sep 2026 -> 7
      // Monday 28 Sep 2026 -> 7.1
      const sat = calculateReportingWeek('2026-09-01', '2026-09-26', 3);
      expect(sat.label).toBe('6.6');
      expect(sat.weekNumber).toBe(6);
      expect(sat.dayInWeek).toBe(6);

      const sun = calculateReportingWeek('2026-09-01', '2026-09-27', 3);
      expect(sun.label).toBe('7');
      expect(sun.weekNumber).toBe(7);
      expect(sun.dayInWeek).toBe(0);

      const mon = calculateReportingWeek('2026-09-01', '2026-09-28', 3);
      expect(mon.label).toBe('7.1');
      expect(mon.weekNumber).toBe(7);
      expect(mon.dayInWeek).toBe(1);
    });

    it('should handle flock start date alignment across Sunday, Monday, and mid-week Wednesday', () => {
      // 1. Starts on Sunday (2026-03-01)
      expect(formatReportingWeekLabel('2026-03-01', '2026-03-01')).toBe('3');
      expect(formatReportingWeekLabel('2026-03-01', '2026-03-02')).toBe('3.1');

      // 2. Starts on Monday (2026-03-02)
      expect(formatReportingWeekLabel('2026-03-02', '2026-03-02')).toBe('3.1');
      expect(formatReportingWeekLabel('2026-03-02', '2026-03-03')).toBe('3.2');
      expect(formatReportingWeekLabel('2026-03-02', '2026-03-08')).toBe('4');

      // 3. Starts mid-week Wednesday (2026-03-04)
      expect(formatReportingWeekLabel('2026-03-04', '2026-03-04')).toBe('3.3');
      expect(formatReportingWeekLabel('2026-03-04', '2026-03-05')).toBe('3.4');
      expect(formatReportingWeekLabel('2026-03-04', '2026-03-07')).toBe('3.6');
      expect(formatReportingWeekLabel('2026-03-04', '2026-03-08')).toBe('4');
      expect(formatReportingWeekLabel('2026-03-04', '2026-03-09')).toBe('4.1');
    });

    it('should handle leap year transitions properly (e.g. Feb 28 -> Feb 29 -> Mar 1, 2028)', () => {
      // 2028 is a leap year. Feb 28 = Mon, Feb 29 = Tue, Mar 1 = Wed
      expect(formatReportingWeekLabel('2028-02-01', '2028-02-28')).toBe('7.1');
      expect(formatReportingWeekLabel('2028-02-01', '2028-02-29')).toBe('7.2');
      expect(formatReportingWeekLabel('2028-02-01', '2028-03-01')).toBe('7.3');
    });

    it('should handle year boundary transitions seamlessly (e.g. Dec 31 -> Jan 1)', () => {
      // Dec 31, 2026 is Thursday, Jan 1, 2027 is Friday, Jan 2, 2027 is Saturday, Jan 3, 2027 is Sunday
      expect(formatReportingWeekLabel('2026-03-01', '2026-12-31')).toBe('46.4');
      expect(formatReportingWeekLabel('2026-03-01', '2027-01-01')).toBe('46.5');
      expect(formatReportingWeekLabel('2026-03-01', '2027-01-02')).toBe('46.6');
      expect(formatReportingWeekLabel('2026-03-01', '2027-01-03')).toBe('47');
      expect(formatReportingWeekLabel('2026-03-01', '2027-01-04')).toBe('47.1');
    });

    it('should be timezone-safe across 23:59 IST and 00:01 IST boundaries without midnight drift', () => {
      // 00:01 IST on 2026-09-28 is 18:31 UTC on 2026-09-27
      const justAfterMidnight = new Date('2026-09-27T18:31:00.000Z');
      // 23:59 IST on 2026-09-28 is 18:29 UTC on 2026-09-28
      const justBeforeMidnight = new Date('2026-09-28T18:29:00.000Z');

      const resAfterMidnight = calculateReportingWeek('2026-09-01', justAfterMidnight, 3);
      const resBeforeMidnight = calculateReportingWeek('2026-09-01', justBeforeMidnight, 3);

      expect(resAfterMidnight.label).toBe('7.1');
      expect(resAfterMidnight.dayInWeek).toBe(1);

      expect(resBeforeMidnight.label).toBe('7.1');
      expect(resBeforeMidnight.dayInWeek).toBe(1);
    });
  });

  describe('8. Separate Damaged Eggs and Floor Eggs Validation', () => {
    it('should accept valid non-negative whole numbers for damagedEggs and floorEggs', () => {
      const data: FarmFormData = {
        ...baseData,
        damagedEggs: '15',
        floorEggs: '8',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.damagedEggs).toBeUndefined();
      expect(errors.floorEggs).toBeUndefined();
    });

    it('should allow damagedEggs and floorEggs to be 0', () => {
      const data: FarmFormData = {
        ...baseData,
        damagedEggs: '0',
        floorEggs: '0',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.damagedEggs).toBeUndefined();
      expect(errors.floorEggs).toBeUndefined();
    });

    it('should allow damagedEggs and floorEggs to be omitted / empty (optional collection)', () => {
      const data: FarmFormData = {
        ...baseData,
        damagedEggs: '',
        floorEggs: '',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.damagedEggs).toBeUndefined();
      expect(errors.floorEggs).toBeUndefined();
    });

    it('should reject negative values for damagedEggs', () => {
      const data: FarmFormData = {
        ...baseData,
        damagedEggs: '-5',
        floorEggs: '10',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.damagedEggs).toBe('validation.invalidWholeNumber');
      expect(errors.floorEggs).toBeUndefined();
    });

    it('should reject negative values for floorEggs', () => {
      const data: FarmFormData = {
        ...baseData,
        damagedEggs: '10',
        floorEggs: '-1',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.damagedEggs).toBeUndefined();
      expect(errors.floorEggs).toBe('validation.invalidWholeNumber');
    });

    it('should reject non-integer decimal values for damagedEggs and floorEggs', () => {
      const data: FarmFormData = {
        ...baseData,
        damagedEggs: '3.5',
        floorEggs: '2.1',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.damagedEggs).toBe('validation.invalidWholeNumber');
      expect(errors.floorEggs).toBe('validation.invalidWholeNumber');
    });

    it('should reject non-numeric text for damagedEggs and floorEggs', () => {
      const data: FarmFormData = {
        ...baseData,
        damagedEggs: 'ten',
        floorEggs: 'five',
      };
      const errors = validateStep(1, data, birdCount);
      expect(errors.damagedEggs).toBe('validation.invalidWholeNumber');
      expect(errors.floorEggs).toBe('validation.invalidWholeNumber');
    });

    it('should maintain independent state for damagedEggs and floorEggs without combining', () => {
      const data: FarmFormData = {
        ...baseData,
        selectionEggs: '4000',
        damagedEggs: '25',
        floorEggs: '12',
      };
      expect(data.selectionEggs).toBe('4000');
      expect(data.damagedEggs).toBe('25');
      expect(data.floorEggs).toBe('12');
    });
  });

  describe('9. Authoritative Farmer User CreatedAt Reporting Anchor', () => {
    it('should calculate Week 7.1 for user createdat 2026-09-01 and report date 2026-09-28 (Monday)', () => {
      // Farmer created on Tuesday, Sep 1, 2026
      // Calendar week of Sep 1 starts on Sunday, Aug 30, 2026 (Week 3)
      // Calendar week of Sep 28 starts on Sunday, Sep 27, 2026 (Week 7)
      // Monday, Sep 28, 2026 is Day 1 of Week 7 -> Week 7.1
      const res = calculateReportingWeek('2026-09-01', '2026-09-28', 3);
      expect(res.isValid).toBe(true);
      expect(res.weekNumber).toBe(7);
      expect(res.dayInWeek).toBe(1);
      expect(res.label).toBe('7.1');
    });

    it('should calculate Sunday 2026-09-27 as integer Week 7', () => {
      const res = calculateReportingWeek('2026-09-01', '2026-09-27', 3);
      expect(res.isValid).toBe(true);
      expect(res.weekNumber).toBe(7);
      expect(res.dayInWeek).toBe(0);
      expect(res.label).toBe('7');
    });

    it('should calculate Saturday 2026-09-26 as Week 6.6', () => {
      const res = calculateReportingWeek('2026-09-01', '2026-09-26', 3);
      expect(res.isValid).toBe(true);
      expect(res.weekNumber).toBe(6);
      expect(res.dayInWeek).toBe(6);
      expect(res.label).toBe('6.6');
    });

    it('should support Firestore Timestamp objects for createdat', () => {
      // Simulate Firestore Timestamp for 2026-09-01
      const firestoreTimestamp = {
        seconds: 1788220800, // 2026-09-01T00:00:00Z
        nanoseconds: 0,
        toDate: () => new Date('2026-09-01T00:00:00Z'),
      };
      const res = calculateReportingWeek(firestoreTimestamp, '2026-09-28', 3);
      expect(res.isValid).toBe(true);
      expect(res.weekNumber).toBe(7);
      expect(res.label).toBe('7.1');
    });

    it('should support numeric timestamp milliseconds for createdat', () => {
      const epochMs = new Date('2026-09-01T10:00:00+05:30').getTime();
      const res = calculateReportingWeek(epochMs, '2026-09-28', 3);
      expect(res.isValid).toBe(true);
      expect(res.weekNumber).toBe(7);
      expect(res.label).toBe('7.1');
    });

    it('should return isValid: false and nulls when createdat is null or missing (never fabricate default week)', () => {
      const nullRes = calculateReportingWeek(null, '2026-09-28', 3);
      expect(nullRes.isValid).toBe(false);
      expect(nullRes.weekNumber).toBeNull();
      expect(nullRes.dayInWeek).toBeNull();
      expect(nullRes.label).toBe('');
      expect(nullRes.error).toBeDefined();

      const undefRes = calculateReportingWeek(undefined, '2026-09-28', 3);
      expect(undefRes.isValid).toBe(false);
      expect(undefRes.weekNumber).toBeNull();
      expect(undefRes.label).toBe('');
    });

    it('should return isValid: false when createdat or report date is invalid string', () => {
      const invalidDateRes = calculateReportingWeek('invalid-date-string', '2026-09-28', 3);
      expect(invalidDateRes.isValid).toBe(false);
      expect(invalidDateRes.weekNumber).toBeNull();
      expect(invalidDateRes.label).toBe('');

      const invalidReportRes = calculateReportingWeek('2026-09-01', 'not-a-date', 3);
      expect(invalidReportRes.isValid).toBe(false);
      expect(invalidReportRes.weekNumber).toBeNull();
      expect(invalidReportRes.label).toBe('');
    });

    it('should reject report dates prior to the farmer creation date calendar week', () => {
      const priorRes = calculateReportingWeek('2026-09-01', '2026-08-01', 3);
      expect(priorRes.isValid).toBe(false);
      expect(priorRes.weekNumber).toBeNull();
      expect(priorRes.label).toBe('');
    });

    it('should dynamically calculate distinct reporting weeks for farmers created on different dates', () => {
      // Farmer A created 2026-08-01
      const farmerA = calculateReportingWeek('2026-08-01', '2026-09-28', 3);
      // Farmer B created 2026-09-15
      const farmerB = calculateReportingWeek('2026-09-15', '2026-09-28', 3);

      expect(farmerA.isValid).toBe(true);
      expect(farmerB.isValid).toBe(true);
      expect(farmerA.label).not.toBe(farmerB.label);
      expect(farmerA.weekNumber).toBeGreaterThan(farmerB.weekNumber!);
    });

    it('should recalculate dynamically when the selected report date changes', () => {
      const userCreatedAt = '2026-09-01';
      const monday = calculateReportingWeek(userCreatedAt, '2026-09-28', 3);
      const tuesday = calculateReportingWeek(userCreatedAt, '2026-09-29', 3);
      const nextSunday = calculateReportingWeek(userCreatedAt, '2026-10-04', 3);

      expect(monday.label).toBe('7.1');
      expect(tuesday.label).toBe('7.2');
      expect(nextSunday.label).toBe('8');
    });
  });

  describe('10. Restrict Report Dates to Yesterday, Today, Tomorrow (3-Day Window)', () => {
    it('should dynamically return exactly three allowed report date options (Yesterday, Today, Tomorrow)', () => {
      const options = getAllowedReportDates('2026-09-28'); // Monday
      expect(options).toHaveLength(3);

      const [yesterday, today, tomorrow] = options;

      expect(yesterday.key).toBe('yesterday');
      expect(yesterday.isoDate).toBe('2026-09-27');
      expect(yesterday.dayOfWeekName).toBe('Sun');

      expect(today.key).toBe('today');
      expect(today.isoDate).toBe('2026-09-28');
      expect(today.dayOfWeekName).toBe('Mon');

      expect(tomorrow.key).toBe('tomorrow');
      expect(tomorrow.isoDate).toBe('2026-09-29');
      expect(tomorrow.dayOfWeekName).toBe('Tue');
    });

    it('should handle month-end transitions properly (e.g. Sep 30 -> Oct 01)', () => {
      const options = getAllowedReportDates('2026-09-30'); // Wednesday
      expect(options[0].isoDate).toBe('2026-09-29'); // Yesterday
      expect(options[1].isoDate).toBe('2026-09-30'); // Today
      expect(options[2].isoDate).toBe('2026-10-01'); // Tomorrow
    });

    it('should handle year-end transitions properly (e.g. Dec 31 -> Jan 01)', () => {
      const options = getAllowedReportDates('2026-12-31'); // Thursday
      expect(options[0].isoDate).toBe('2026-12-30'); // Yesterday
      expect(options[1].isoDate).toBe('2026-12-31'); // Today
      expect(options[2].isoDate).toBe('2027-01-01'); // Tomorrow
    });

    it('should handle leap year Feb 28 -> Feb 29 -> Mar 01 transition in 2028', () => {
      const options = getAllowedReportDates('2028-02-29'); // Leap Day
      expect(options[0].isoDate).toBe('2028-02-28'); // Yesterday
      expect(options[1].isoDate).toBe('2028-02-29'); // Today
      expect(options[2].isoDate).toBe('2028-03-01'); // Tomorrow
    });

    it('should synchronize reporting week calculation for Yesterday, Today, and Tomorrow', () => {
      const userCreatedAt = '2026-09-01';
      const options = getAllowedReportDates('2026-09-28');

      const yesterdayWeek = calculateReportingWeek(userCreatedAt, options[0].isoDate, 3);
      const todayWeek = calculateReportingWeek(userCreatedAt, options[1].isoDate, 3);
      const tomorrowWeek = calculateReportingWeek(userCreatedAt, options[2].isoDate, 3);

      expect(yesterdayWeek.label).toBe('7'); // Sunday 27 Sep
      expect(todayWeek.label).toBe('7.1'); // Monday 28 Sep
      expect(tomorrowWeek.label).toBe('7.2'); // Tuesday 29 Sep
    });
  });
});
