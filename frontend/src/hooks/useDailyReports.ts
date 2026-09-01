import { useState, useEffect, useRef, useCallback } from 'react';
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

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    const unsub = subscribeToAllDailyReports(
      startDate,
      endDate,
      (data) => {
        if (mountedRef.current) {
          setReports(data);
          setLastUpdated(new Date());
          setLoading(false);
        }
      },
      (err) => {
        if (mountedRef.current) {
          setError('Unable to load reports. Please try again.');
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

  useEffect(() => {
    mountedRef.current = true;

    if (farmIds.length === 0) {
      setReports([]);
      setLoading(false);
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
          setReports(data);
          setLastUpdated(new Date());
          setLoading(false);
        }
      },
      (err) => {
        if (mountedRef.current) {
          setError('Unable to load reports. Please try again.');
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

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    const unsub = subscribeToDailyReportsByDate(
      submissionDate,
      (data) => {
        if (mountedRef.current) {
          setReports(data);
          setLastUpdated(new Date());
          setLoading(false);
        }
      },
      (err) => {
        if (mountedRef.current) {
          setError('Unable to load reports. Please try again.');
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
