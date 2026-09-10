import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Calendar, 
  CalendarDays, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getIstDate, getDaysAgo, formatDisplayDate } from '../../utils/dateUtils';
import { 
  exportDailyReportsToExcel, 
  getWeekDates, 
  getMonthDates, 
  type ExportResult 
} from '../../services/excelExportService';

export function ExportReportsCard() {
  const { userProfile } = useAuth();

  // Mode Selection: 'range' | 'weekly' | 'monthly'
  const [mode, setMode] = useState<'range' | 'weekly' | 'monthly'>('range');

  // Date Range state
  const [startDate, setStartDate] = useState(getDaysAgo(30));
  const [endDate, setEndDate] = useState(getIstDate());

  // Weekly state (default to today)
  const [selectedWeekDate, setSelectedWeekDate] = useState(getIstDate());

  // Monthly state (default to current month YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(getIstDate().substring(0, 7));

  // Status & Feedback state
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Security Check: Only Admin can access
  if (userProfile?.role !== 'admin') {
    return null;
  }

  const handleModeChange = (newMode: 'range' | 'weekly' | 'monthly') => {
    setMode(newMode);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleExportDateRange = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    // Validation
    if (!startDate) {
      setErrorMessage('Start date is required.');
      return;
    }
    if (!endDate) {
      setErrorMessage('End date is required.');
      return;
    }
    if (startDate > endDate) {
      setErrorMessage('Start date cannot be after end date.');
      return;
    }

    setLoading(true);
    try {
      const result: ExportResult = await exportDailyReportsToExcel(startDate, endDate, 'range');
      if (result.success) {
        setStatusMessage(`Export completed successfully! Downloaded ${result.filename} (${result.count} report${result.count > 1 ? 's' : ''}).`);
      } else {
        setErrorMessage(result.error || 'No reports found for the selected period.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during export.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportWeekly = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    const weekInfo = getWeekDates(selectedWeekDate);
    setLoading(true);
    try {
      const result: ExportResult = await exportDailyReportsToExcel(
        weekInfo.startDate, 
        weekInfo.endDate, 
        'weekly'
      );
      if (result.success) {
        setStatusMessage(`Weekly report exported successfully! Downloaded ${result.filename} (${result.count} report${result.count > 1 ? 's' : ''}).`);
      } else {
        setErrorMessage(result.error || 'No reports found for the selected week.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during weekly export.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMonthly = async () => {
    setStatusMessage(null);
    setErrorMessage(null);

    const monthInfo = getMonthDates(selectedMonth);
    setLoading(true);
    try {
      const result: ExportResult = await exportDailyReportsToExcel(
        monthInfo.startDate, 
        monthInfo.endDate, 
        'monthly'
      );
      if (result.success) {
        setStatusMessage(`Monthly report exported successfully! Downloaded ${result.filename} (${result.count} report${result.count > 1 ? 's' : ''}).`);
      } else {
        setErrorMessage(result.error || 'No reports found for the selected month.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during monthly export.');
    } finally {
      setLoading(false);
    }
  };

  const currentWeekInfo = getWeekDates(selectedWeekDate);
  const currentMonthInfo = getMonthDates(selectedMonth);

  return (
    <div className="section-card export-reports-card">
      <div className="export-card-header">
        <div className="export-card-info">
          <div className="export-card-icon">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h3>EXPORT DAILY REPORTS</h3>
            <p>Download real daily farm submission logs directly to Excel (.xlsx) files</p>
          </div>
        </div>

        {/* Export Mode Toggle Tabs */}
        <div className="export-card-tabs">
          <button
            type="button"
            className={`export-tab-btn ${mode === 'range' ? 'export-tab-btn--active' : ''}`}
            onClick={() => handleModeChange('range')}
          >
            <Calendar size={15} />
            <span>Date Range</span>
          </button>
          <button
            type="button"
            className={`export-tab-btn ${mode === 'weekly' ? 'export-tab-btn--active' : ''}`}
            onClick={() => handleModeChange('weekly')}
          >
            <CalendarDays size={15} />
            <span>Weekly</span>
          </button>
          <button
            type="button"
            className={`export-tab-btn ${mode === 'monthly' ? 'export-tab-btn--active' : ''}`}
            onClick={() => handleModeChange('monthly')}
          >
            <FileSpreadsheet size={15} />
            <span>Monthly</span>
          </button>
        </div>
      </div>

      {/* Alert Messages */}
      {statusMessage && (
        <div className="alert alert--success export-alert">
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="alert alert--error export-alert">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* MODE 1: DATE RANGE */}
      {mode === 'range' && (
        <div className="export-card-body">
          <div className="export-card-row">
            <div className="form-group export-field">
              <label>Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="form-group export-field">
              <label>End Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="export-btn-wrap">
              <button
                type="button"
                className="btn btn-primary export-action-btn"
                onClick={handleExportDateRange}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-icon" />
                    <span>Preparing Excel...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Export Date Range</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: WEEKLY EXPORT */}
      {mode === 'weekly' && (
        <div className="export-card-body">
          <div className="export-card-row">
            <div className="export-period-summary">
              <div className="export-period-label">
                <Clock size={14} />
                Selected Week Range
              </div>
              <div className="export-period-val">
                {currentWeekInfo.label}
              </div>
              <div className="export-period-sub">
                All daily logs submitted Monday through Sunday for this week
              </div>
            </div>

            <div className="form-group export-field">
              <label>Jump to Target Week (Pick any Date in Week)</label>
              <input
                type="date"
                className="form-input"
                value={selectedWeekDate}
                onChange={(e) => setSelectedWeekDate(e.target.value)}
              />
            </div>

            <div className="export-btn-wrap">
              <button
                type="button"
                className="btn btn-primary export-action-btn"
                onClick={handleExportWeekly}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-icon" />
                    <span>Preparing Weekly Excel...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Export Weekly Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: MONTHLY EXPORT */}
      {mode === 'monthly' && (
        <div className="export-card-body">
          <div className="export-card-row">
            <div className="export-period-summary">
              <div className="export-period-label">
                <Clock size={14} />
                Selected Month
              </div>
              <div className="export-period-val">
                {currentMonthInfo.label}
              </div>
              <div className="export-period-sub">
                Full monthly period: {formatDisplayDate(currentMonthInfo.startDate)} to {formatDisplayDate(currentMonthInfo.endDate)}
              </div>
            </div>

            <div className="form-group export-field">
              <label>Select Specific Month</label>
              <input
                type="month"
                className="form-input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>

            <div className="export-btn-wrap">
              <button
                type="button"
                className="btn btn-primary export-action-btn"
                onClick={handleExportMonthly}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-icon" />
                    <span>Preparing Monthly Excel...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    <span>Export Monthly Report</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
