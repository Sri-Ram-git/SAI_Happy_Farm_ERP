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
    const { auth } = await import('../config/firebase');
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : '';

    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const requestUrl = `${backendUrl}/api/v1/reports/export-production-curve?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      let filename = customFilename;
      if (!filename) {
        if (mode === 'monthly') {
          const mInfo = getMonthDates(startDate.substring(0, 7));
          filename = `Production_Report_${mInfo.monthName}_${mInfo.year}.xlsx`;
        } else if (mode === 'weekly') {
          filename = `Production_Report_Week_${startDate}_to_${endDate}.xlsx`;
        } else {
          filename = `Production_Report_${startDate}_to_${endDate}.xlsx`;
        }
      }
      if (!filename.endsWith('.xlsx')) filename += '.xlsx';

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      return {
        success: true,
        count: 1,
        filename,
      };
    }

    // Fallback: If backend endpoint returns an error, load reports & notify user
    const reports = await getAllReports(startDate, endDate);
    if (!reports || reports.length === 0) {
      return {
        success: false,
        count: 0,
        error: 'No reports found for the selected period.',
      };
    }

    const responseData = await response.json().catch(() => ({}));
    return {
      success: false,
      count: 0,
      error: responseData?.error?.message || 'Failed to generate Production Curve Excel export from server.',
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

