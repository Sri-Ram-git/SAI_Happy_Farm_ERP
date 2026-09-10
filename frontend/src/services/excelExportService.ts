import * as XLSX from 'xlsx';
import { getAllReports } from './reportDataService';
import { getAllFarms, type FarmDoc } from './farmDataService';
import { getAllUsers, type UserDoc } from './userDataService';
import { 
  calcProductionRate, 
  calcMortalityRate, 
  calcCullingRate, 
  calcSelectionRate 
} from '../utils/kpiCalculations';
import { formatDisplayDate } from '../utils/dateUtils';

export interface ExportResult {
  success: boolean;
  count: number;
  filename?: string;
  error?: string;
}

export function getWeekDates(dateStr?: string): { startDate: string; endDate: string; label: string } {
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const dayOfWeek = base.getDay(); // 0 is Sunday, 1 is Monday
  const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(base);
  monday.setDate(base.getDate() + distanceToMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const formatIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const startIso = formatIso(monday);
  const endIso = formatIso(sunday);

  return {
    startDate: startIso,
    endDate: endIso,
    label: `${formatDisplayDate(startIso)} — ${formatDisplayDate(endIso)}`,
  };
}

export function getMonthDates(yearMonthStr?: string): { startDate: string; endDate: string; label: string; monthName: string; year: string } {
  let year: number;
  let monthIndex: number;

  if (yearMonthStr) {
    const [y, m] = yearMonthStr.split('-');
    year = parseInt(y, 10);
    monthIndex = parseInt(m, 10) - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    monthIndex = now.getMonth();
  }

  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  const formatIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const startIso = formatIso(firstDay);
  const endIso = formatIso(lastDay);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[monthIndex];

  return {
    startDate: startIso,
    endDate: endIso,
    label: `${monthName} ${year}`,
    monthName,
    year: String(year),
  };
}

export async function exportDailyReportsToExcel(
  startDate: string,
  endDate: string,
  mode: 'range' | 'weekly' | 'monthly',
  customFilename?: string
): Promise<ExportResult> {
  try {
    // 1. Fetch real reports directly from Firestore for the date range
    const reports = await getAllReports(startDate, endDate);

    if (!reports || reports.length === 0) {
      return {
        success: false,
        count: 0,
        error: 'No reports found for the selected period.',
      };
    }

    // 2. Fetch farm and user metadata to enrich report rows
    let farms: FarmDoc[] = [];
    let users: UserDoc[] = [];
    try {
      [farms, users] = await Promise.all([getAllFarms(), getAllUsers()]);
    } catch (err) {
      console.warn('[ExcelExport] Metadata load warning:', err);
    }

    const farmMap = new Map<string, string>();
    farms.forEach((f) => farmMap.set(f.farmId, f.name || f.farmId));

    const userMap = new Map<string, string>();
    users.forEach((u) => userMap.set(u.uid, u.name || u.email));

    // 3. Map Firestore reports to formatted Excel rows
    const excelRows = reports.map((r) => {
      const openingBirds = r.openingBirdCount || r.birdCount || 0;
      const farmName = farmMap.get(r.farmId) || r.farmId;
      const farmerName = userMap.get(r.userId) || userMap.get(r.submittedBy) || r.userId || 'Unknown';

      const prodRate = calcProductionRate(r.eggsProduced ?? 0, openingBirds);
      const mortRate = calcMortalityRate(r.mortality ?? 0, openingBirds);
      const cullRate = calcCullingRate(r.culling ?? 0, openingBirds);
      const selRate = calcSelectionRate(r.selectionEggs ?? 0, r.eggsProduced ?? 0);

      return {
        'Report Date': r.submissionDate,
        'Farm ID': r.farmId,
        'Farm Name': farmName,
        'Farmer Name': farmerName,
        'Opening Bird Count': openingBirds,
        'Closing Bird Count': r.closingBirdCount || r.birdCount || 0,
        'Feed Consumed (KG)': r.feedKg ?? 0,
        'Feed Consumed (Grams)': (r as any).feedGrams ?? (r.feedKg ? r.feedKg * 1000 : 0),
        'Mortality Count': r.mortality ?? 0,
        'Mortality Rate (%)': mortRate,
        'Culling Count': r.culling ?? 0,
        'Culling Rate (%)': cullRate,
        'Eggs Produced': r.eggsProduced ?? 0,
        'Production Rate (%)': prodRate,
        'Selection Eggs': r.selectionEggs ?? 0,
        'Selection Rate (%)': selRate,
        'Min Temp (°C)': r.tempMin ?? r.temperature ?? '--',
        'Max Temp (°C)': r.tempMax ?? r.temperature ?? '--',
        'Avg Temp (°C)': r.temperature ?? '--',
        'Egg Weight Min (g)': r.eggWeight?.min ?? '--',
        'Egg Weight Max (g)': r.eggWeight?.max ?? '--',
        'Egg Weight Avg (g)': r.eggWeight?.avg ?? '--',
        'Body Weight Min (g)': r.bodyWeight?.min ?? '--',
        'Body Weight Max (g)': r.bodyWeight?.max ?? '--',
        'Body Weight Avg (g)': r.bodyWeight?.avg ?? '--',
        'Ammonia Test (PPM)': r.ammoniaPpm ?? '--',
        'Remarks': r.remarks || '--',
        'Submission Version': r.submissionVersion || 1,
        'Submission Method': r.submissionMethod || 'DIGITAL_FORM',
        'Submitted At': r.createdAt || (r as any).submittedAt || '--',
      };
    });

    // 4. Create Workbook and Worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Reports');

    // 5. Freeze top header row
    worksheet['!views'] = [{ state: 'frozen', ySplit: 1 }];

    // 6. Calculate column widths dynamically
    const firstRow = excelRows[0];
    const colKeys = Object.keys(firstRow);
    const colWidths = colKeys.map((key) => {
      let maxLen = key.length;
      excelRows.forEach((row) => {
        const val = String((row as any)[key] ?? '');
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 3, 12), 45) };
    });
    worksheet['!cols'] = colWidths;

    // 7. Determine Filename based on mode or custom input
    let filename = customFilename;
    if (!filename) {
      if (mode === 'monthly') {
        const mInfo = getMonthDates(startDate.substring(0, 7));
        filename = `Daily_Reports_${mInfo.monthName}_${mInfo.year}.xlsx`;
      } else if (mode === 'weekly') {
        filename = `Daily_Reports_Week_${startDate}_to_${endDate}.xlsx`;
      } else {
        filename = `Daily_Reports_${startDate}_to_${endDate}.xlsx`;
      }
    }

    if (!filename.endsWith('.xlsx')) {
      filename += '.xlsx';
    }

    // 8. Download Excel file client-side
    XLSX.writeFile(workbook, filename);

    return {
      success: true,
      count: reports.length,
      filename,
    };
  } catch (err: any) {
    console.error('[excelExportService] Export failed:', err);
    return {
      success: false,
      count: 0,
      error: err.message || 'An error occurred while generating the Excel report.',
    };
  }
}
