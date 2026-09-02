import { useState, useEffect, useRef } from 'react';
import {
  subscribeToAllDailyReports,
  subscribeToDailyReportsByFarms,
  subscribeToDailyReportsByDate,
  type ReportDoc,
} from '../services/reportDataService';

interface UseDailyReportsResult {
  reports: ReportDoc[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
}

export function useAllDailyReports(startDate: string, endDate: string): UseDailyReportsResult {
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const gotDataRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    gotDataRef.current = false;
    setLoading(true);
    setError(null);

    const unsub = subscribeToAllDailyReports(
      startDate,
      endDate,
      (data) => {
        if (mountedRef.current) {
          gotDataRef.current = true;
          setReports(data);
          setLastUpdated(new Date());
          setLoading(false);
          setError(null);
        }
      },
      (err) => {
        if (mountedRef.current && !gotDataRef.current) {
          console.error('[useAllDailyReports] Error:', err.message);
          setError(`Report query failed: ${err.message}. Check browser console for Firestore index/permission errors.`);
          setLoading(false);
        }
      },
    );

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [startDate, endDate]);

  return { reports, loading, error, lastUpdated, refetch: () => {} };
}

export function useDailyReportsByFarms(
  farmIds: string[],
  startDate: string,
  endDate: string,
): UseDailyReportsResult {
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const gotDataRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    gotDataRef.current = false;

    if (farmIds.length === 0) {
      setReports([]);
      setLoading(false);
      setError(null);
      return () => {};
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeToDailyReportsByFarms(
      farmIds,
      startDate,
      endDate,
      (data) => {
        if (mountedRef.current) {
          gotDataRef.current = true;
          setReports(data);
          setLastUpdated(new Date());
          setLoading(false);
          setError(null);
        }
      },
      (err) => {
        if (mountedRef.current && !gotDataRef.current) {
          console.error('[useDailyReportsByFarms] Error:', err.message);
          setError(`Report query failed: ${err.message}. Check browser console for details.`);
          setLoading(false);
        }
      },
    );

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [farmIds.join(','), startDate, endDate]);

  return { reports, loading, error, lastUpdated, refetch: () => {} };
}

export function useDailyReportsByDate(submissionDate: string): UseDailyReportsResult {
  const [reports, setReports] = useState<ReportDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mountedRef = useRef(true);
  const gotDataRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    gotDataRef.current = false;
    setLoading(true);
    setError(null);

    const unsub = subscribeToDailyReportsByDate(
      submissionDate,
      (data) => {
        if (mountedRef.current) {
          gotDataRef.current = true;
          setReports(data);
          setLastUpdated(new Date());
          setLoading(false);
          setError(null);
        }
      },
      (err) => {
        if (mountedRef.current && !gotDataRef.current) {
          console.error('[useDailyReportsByDate] Error:', err.message);
          setError(`Report query failed: ${err.message}. Check browser console for details.`);
          setLoading(false);
        }
      },
    );

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [submissionDate]);

  return { reports, loading, error, lastUpdated, refetch: () => {} };
}
