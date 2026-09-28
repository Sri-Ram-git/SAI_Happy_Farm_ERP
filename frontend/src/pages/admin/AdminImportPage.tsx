import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/dashboard/DashboardLayout';
import { LoadingState } from '../../components/dashboard/LoadingState';
import { getAllFarms, type FarmDoc } from '../../services/farmDataService';
import {
  STANDARD_FIELDS,
  parseCsvContent,
  parseXmlContent,
  detectColumnMappings,
  validateParsedFile,
  checkServerConflicts,
  executeHistoricalImport,
  fetchImportBatches,
  generateErrorReportCsv,
  fetchRevertPreview,
  executeRevertImportBatch,
  parseXlsxWorkbook,
  applyMappingToMatchingFiles,
  type ParsedFile,
  type ValidatedRow,
  type StandardFieldKey,
  type RecordType,
  type RevertPreviewResponse,
  type RevertBatchResponse,
  type XlsxWorksheetInfo,
} from '../../services/historicalImportService';
import { formatDisplayDate } from '../../utils/dateUtils';
import {
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Download,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Calendar,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  Info,
  ShieldCheck,
  RotateCcw,
  Eye,
  BookOpen,
} from 'lucide-react';

export function AdminImportPage() {
  const { userProfile } = useAuth();
  const [farms, setFarms] = useState<FarmDoc[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);

  // Active top tab: 'import' | 'history'
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');

  // Import Wizard Steps: 1 (Files) -> 2 (Mapping) -> 3 (Preview) -> 4 (Execute) -> 5 (Done)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: Files
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3: Validation & Conflict Results
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [validating, setValidating] = useState(false);
  const [rowSearch, setRowSearch] = useState('');
  const [rowFilter, setRowFilter] = useState<'ALL' | 'VALID' | 'INVALID' | 'DUPLICATES' | 'CONFLICTS'>('ALL');
  const [conflictAction, setConflictAction] = useState<'skip' | 'replace'>('skip');
  const [confirmReplaceAuthorized, setConfirmReplaceAuthorized] = useState(false);

  // Step 4 & 5: Import Execution State
  const [importing, setImporting] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [importProgress, setImportProgress] = useState<{ currentBatch: number; totalBatches: number; percentage: number }>({
    currentBatch: 0,
    totalBatches: 0,
    percentage: 0,
  });
  const [importResult, setImportResult] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // History Tab State
  const [importBatches, setImportBatches] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  // Revert Modal State
  const [revertModalBatch, setRevertModalBatch] = useState<any | null>(null);
  const [revertPreview, setRevertPreview] = useState<RevertPreviewResponse | null>(null);
  const [loadingRevertPreview, setLoadingRevertPreview] = useState(false);
  const [revertConfirmationInput, setRevertConfirmationInput] = useState('');
  const [revertAckChecked, setRevertAckChecked] = useState(false);
  const [revertingBatch, setRevertingBatch] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);
  const [revertSuccessResult, setRevertSuccessResult] = useState<RevertBatchResponse | null>(null);
  const [showRevertSample, setShowRevertSample] = useState(false);

  // XLSX Worksheet Preview Modal & Mapping Feedback
  const [sheetPreviewTarget, setSheetPreviewTarget] = useState<ParsedFile | null>(null);
  const [mappingCopyFeedback, setMappingCopyFeedback] = useState<string | null>(null);

  const handleToggleSheetSelect = (fileId: string, isSelected: boolean) => {
    setParsedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, isSelectedSheet: isSelected } : f)),
    );
  };

  const handleCopyMapping = (sourceFile: ParsedFile) => {
    const { updatedCount } = applyMappingToMatchingFiles(
      sourceFile.mappings,
      sourceFile.headers,
      parsedFiles.filter((f) => f.id !== sourceFile.id && f.isSelectedSheet !== false),
    );
    if (updatedCount > 0) {
      setMappingCopyFeedback(`Applied mapping from "${sourceFile.name}" to ${updatedCount} other sheet(s) with matching headers.`);
      setParsedFiles((prev) => [...prev]); // trigger re-render
      setTimeout(() => setMappingCopyFeedback(null), 4000);
    } else {
      setMappingCopyFeedback('No other active worksheets found with matching header signatures.');
      setTimeout(() => setMappingCopyFeedback(null), 3000);
    }
  };

  const handleOpenRevertModal = async (batch: any) => {
    setRevertModalBatch(batch);
    setRevertConfirmationInput('');
    setRevertAckChecked(false);
    setRevertError(null);
    setRevertSuccessResult(null);
    setShowRevertSample(false);
    setLoadingRevertPreview(true);

    try {
      const preview = await fetchRevertPreview(batch.batchId);
      setRevertPreview(preview);
    } catch (err: any) {
      console.error('[handleOpenRevertModal] Failed loading revert preview:', err);
      setRevertError(err.message || 'Failed to load revert preview');
    } finally {
      setLoadingRevertPreview(false);
    }
  };

  const handleCloseRevertModal = () => {
    setRevertModalBatch(null);
    setRevertPreview(null);
    setRevertConfirmationInput('');
    setRevertAckChecked(false);
    setRevertError(null);
    setRevertSuccessResult(null);
  };

  const handleExecuteRevert = async () => {
    if (!revertModalBatch) return;
    if (revertConfirmationInput.trim() !== revertModalBatch.batchId) {
      setRevertError(`Confirmation batch ID mismatch. Expected '${revertModalBatch.batchId}'.`);
      return;
    }
    if (!revertAckChecked) {
      setRevertError('Please check the acknowledgment checkbox');
      return;
    }

    setRevertingBatch(true);
    setRevertError(null);

    try {
      const res = await executeRevertImportBatch(revertModalBatch.batchId, revertConfirmationInput.trim());
      setRevertSuccessResult(res);
      await loadHistory();
    } catch (err: any) {
      console.error('[handleExecuteRevert] Error:', err);
      setRevertError(err.message || 'Failed to revert import batch');
    } finally {
      setRevertingBatch(false);
    }
  };

  // Load existing farms
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const loadedFarms = await getAllFarms();
        if (mounted) setFarms(loadedFarms);
      } catch (err) {
        console.error('[AdminImportPage] Error loading farms:', err);
      } finally {
        if (mounted) setLoadingFarms(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Load history when tab is clicked
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const batches = await fetchImportBatches();
      setImportBatches(batches);
    } catch (err) {
      console.error('[AdminImportPage] Error loading history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ==========================================
  // STEP 1: FILE HANDLING & DRAG-AND-DROP
  // ==========================================

  const handleFilesAdded = async (filesList: FileList | File[]) => {
    const newFiles: ParsedFile[] = [];
    const filesArray = Array.from(filesList);

    for (const file of filesArray) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'csv' && ext !== 'xml' && ext !== 'xlsx') continue;

      try {
        const id = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        if (ext === 'xlsx') {
          const buffer = await file.arrayBuffer();
          const sheets = parseXlsxWorkbook(buffer, file.name, farms);

          sheets.forEach((sheet, sIdx) => {
            const sheetId = `${id}_sheet_${sIdx}`;
            newFiles.push({
              id: sheetId,
              file,
              name: `${file.name} [${sheet.sheetName}]`,
              parentFileName: file.name,
              sheetName: sheet.sheetName,
              workbookSheets: sheets.map((s) => s.sheetName),
              isSelectedSheet: !sheet.isHidden && !sheet.isEmpty && !sheet.isReferenceSheet,
              isHiddenSheet: sheet.isHidden,
              isTransposed: sheet.isTransposed,
              isReferenceSheet: sheet.isReferenceSheet,
              dateRange: sheet.dateRange,
              size: file.size,
              format: 'XLSX',
              headers: sheet.headers,
              mappings: sheet.mappings,
              rawRows: sheet.rows,
              assignedFarmId: sheet.detectedFarmId,
              detectedRecordType: sheet.detectedRecordType,
              formulaWarningsCount: sheet.formulaWarningCount,
              unusualLayoutWarning: sheet.unusualLayoutWarning,
              status: sheet.isEmpty ? 'ERROR' : 'PARSED',
              errorMessage: sheet.isEmpty ? 'Worksheet is completely empty' : undefined,
            });
          });
        } else if (ext === 'csv') {
          const text = await file.text();
          const { headers, rows } = parseCsvContent(text, file.name);
          const { mappings, detectedType } = detectColumnMappings(headers, rows);
          newFiles.push({
            id,
            file,
            name: file.name,
            size: file.size,
            format: 'CSV',
            headers,
            mappings,
            rawRows: rows,
            detectedRecordType: detectedType,
            status: 'PARSED',
            isSelectedSheet: true,
          });
        } else if (ext === 'xml') {
          const text = await file.text();
          const { headers, rows } = parseXmlContent(text, file.name);
          const { mappings, detectedType } = detectColumnMappings(headers, rows);
          newFiles.push({
            id,
            file,
            name: file.name,
            size: file.size,
            format: 'XML',
            headers,
            mappings,
            rawRows: rows,
            detectedRecordType: detectedType,
            status: 'PARSED',
            isSelectedSheet: true,
          });
        }
      } catch (err: any) {
        newFiles.push({
          id: `file_err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          format: ext === 'csv' ? 'CSV' : ext === 'xml' ? 'XML' : 'XLSX',
          headers: [],
          mappings: [],
          rawRows: [],
          detectedRecordType: 'DAILY_REPORT',
          status: 'ERROR',
          errorMessage: err.message || 'Failed to parse file structure',
        });
      }
    }

    setParsedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (fileId: string) => {
    setParsedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleClearAllFiles = () => {
    setParsedFiles([]);
    setStep(1);
    setValidatedRows([]);
    setImportResult(null);
  };

  // ==========================================
  // STEP 2: MAPPING UPDATES
  // ==========================================

  const handleUpdateMapping = (fileId: string, header: string, fieldKey: StandardFieldKey) => {
    setParsedFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const updatedMappings = f.mappings.map((m) => {
          if (m.fileHeader !== header) return m;
          return {
            ...m,
            mappedField: fieldKey,
            confidence: (fieldKey === 'ignore' ? 'UNMAPPED' : 'HIGH') as 'UNMAPPED' | 'HIGH',
          };
        });
        return { ...f, mappings: updatedMappings };
      })
    );
  };

  const handleAssignFarm = (fileId: string, farmId: string) => {
    setParsedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, assignedFarmId: farmId } : f))
    );
  };

  const handleSetDateFormat = (fileId: string, format: 'AUTO' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD') => {
    setParsedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, dateFormatPreference: format } : f))
    );
  };

  const handleSetRecordType = (fileId: string, type: RecordType) => {
    setParsedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, detectedRecordType: type } : f))
    );
  };

  // ==========================================
  // STEP 3: RUN VALIDATION & CONFLICT CHECK
  // ==========================================

  const runValidationAndConflicts = async () => {
    setValidating(true);
    setStep(3);

    try {
      // 1. Client-side syntactic & semantic validation
      let allRows: ValidatedRow[] = [];
      parsedFiles.forEach((f) => {
        if (f.status === 'PARSED') {
          const rows = validateParsedFile(f, farms);
          allRows = allRows.concat(rows);
        }
      });

      // 2. Server-side duplicate & conflict check
      const checkedRows = await checkServerConflicts(allRows);
      setValidatedRows(checkedRows);
    } catch (err: any) {
      console.error('[runValidationAndConflicts] Error:', err);
    } finally {
      setValidating(false);
    }
  };

  // Toggle row exclusion
  const handleToggleExcludeRow = (index: number) => {
    setValidatedRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, isExcluded: !r.isExcluded } : r))
    );
  };

  // Download Error CSV
  const handleDownloadErrors = () => {
    const errorList = validatedRows
      .filter((r) => !r.isValid)
      .flatMap((r) =>
        r.errors.map((e) => ({
          file: r.fileName,
          row: r.rowNumber,
          field: e.field,
          reason: e.reason,
        }))
      );

    const csvContent = generateErrorReportCsv(errorList);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `import_errors_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // STEP 4: EXECUTE & SIMULATE IMPORT
  // ==========================================

  const handleSimulateImport = async () => {
    setSimulating(true);
    setImportError(null);
    setSimulationResult(null);

    try {
      const result = await executeHistoricalImport(
        validatedRows,
        conflictAction,
        (progress) => setImportProgress(progress),
        { dryRun: true },
      );
      setSimulationResult(result);
    } catch (err: any) {
      console.error('[handleSimulateImport] Error:', err);
      setImportError(err.message || 'Dry-run simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleExecuteImport = async () => {
    if (conflictAction === 'replace' && !confirmReplaceAuthorized) {
      alert('Please check the authorization box to proceed with replacing conflicting records.');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const result = await executeHistoricalImport(
        validatedRows,
        conflictAction,
        (progress) => setImportProgress(progress),
        { dryRun: false },
      );

      setImportResult(result);
      setStep(5);
    } catch (err: any) {
      console.error('[handleExecuteImport] Error:', err);
      setImportError(err.message || 'Import execution failed');
    } finally {
      setImporting(false);
    }
  };

  // Filtered Rows for Preview
  const filteredRows = useMemo(() => {
    return validatedRows.filter((row) => {
      // 1. Tab / Status filter
      if (rowFilter === 'VALID' && !row.isValid) return false;
      if (rowFilter === 'INVALID' && row.isValid) return false;
      if (rowFilter === 'DUPLICATES' && row.conflictStatus !== 'EXACT_DUPLICATE') return false;
      if (rowFilter === 'CONFLICTS' && row.conflictStatus !== 'CONFLICT') return false;

      // 2. Search query
      if (rowSearch) {
        const q = rowSearch.toLowerCase();
        const matchFarm = row.farmId.toLowerCase().includes(q);
        const matchDate = row.submissionDate.toLowerCase().includes(q);
        const matchFile = row.fileName.toLowerCase().includes(q);
        return matchFarm || matchDate || matchFile;
      }
      return true;
    });
  }, [validatedRows, rowFilter, rowSearch]);

  // Validation Summary Stats
  const summary = useMemo(() => {
    const total = validatedRows.length;
    const valid = validatedRows.filter((r) => r.isValid && !r.isExcluded).length;
    const invalid = validatedRows.filter((r) => !r.isValid).length;
    const duplicates = validatedRows.filter((r) => r.conflictStatus === 'EXACT_DUPLICATE').length;
    const conflicts = validatedRows.filter((r) => r.conflictStatus === 'CONFLICT').length;
    const newRecords = validatedRows.filter((r) => r.conflictStatus === 'NEW').length;

    return { total, valid, invalid, duplicates, conflicts, newRecords };
  }, [validatedRows]);

  if (loadingFarms) {
    return (
      <DashboardLayout role="admin" userName={userProfile?.name}>
        <LoadingState message="Loading farm configuration..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" userName={userProfile?.name}>
      <div className="mgmt-page historical-import-page">
        {/* Top Header & Section Tabs */}
        <div className="mgmt-page-header" style={{ marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <History size={24} className="text-emerald-700" />
              <h2 style={{ margin: 0 }}>Historical Data Import</h2>
            </div>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
              Import historical spreadsheets & XML logs directly into SAI Happy Farms ERP without reformatting.
            </p>
          </div>

          <div className="import-tab-toggle" style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`btn ${activeTab === 'import' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setActiveTab('import')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
            >
              <UploadCloud size={16} />
              <span>Import Files</span>
            </button>
            <button
              type="button"
              className={`btn ${activeTab === 'history' ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setActiveTab('history')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}
            >
              <History size={16} />
              <span>Import History</span>
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: IMPORT WIZARD */}
        {/* ============================================================== */}
        {activeTab === 'import' && (
          <div className="import-wizard-container">
            {/* Step Progress Bar */}
            <div className="wizard-stepper" style={{ marginBottom: 24 }}>
              {[
                { num: 1, title: 'Select Files' },
                { num: 2, title: 'Map Columns' },
                { num: 3, title: 'Validate & Check' },
                { num: 4, title: 'Confirm & Import' },
                { num: 5, title: 'Summary' },
              ].map((s) => (
                <div
                  key={s.num}
                  className={`wizard-step-pill ${step === s.num ? 'wizard-step-pill--active' : step > s.num ? 'wizard-step-pill--complete' : ''}`}
                >
                  <span className="step-circle">{step > s.num ? <Check size={14} /> : s.num}</span>
                  <span className="step-title">{s.title}</span>
                </div>
              ))}
            </div>

            {/* ---------------------------------------------------------- */}
            {/* STEP 1: SELECT FILES */}
            {/* ---------------------------------------------------------- */}
            {step === 1 && (
              <div className="wizard-card">
                <div
                  className={`drag-drop-zone ${isDragging ? 'drag-drop-zone--active' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept=".csv, .xml, .xlsx, text/csv, application/xml, text/xml, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files) handleFilesAdded(e.target.files);
                    }}
                  />
                  <UploadCloud size={48} className="upload-icon text-emerald-600" />
                  <h3 style={{ margin: '12px 0 4px', fontSize: '1.15rem' }}>
                    Drag & Drop your historical files here, or browse
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
                    Supports <strong>Excel (.xlsx)</strong>, <strong>CSV (.csv)</strong>, and <strong>XML (.xml)</strong> files. Select single or multiple files (up to 200+).
                  </p>
                  <button type="button" className="btn btn--secondary" style={{ marginTop: 16 }}>
                    Select Files from Computer
                  </button>
                </div>

                {parsedFiles.length > 0 && (
                  <div className="files-staged-area" style={{ marginTop: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ margin: 0 }}>
                        Staged Files & Worksheets ({parsedFiles.filter((f) => f.isSelectedSheet !== false).length} active of {parsedFiles.length})
                      </h4>
                      <button
                        type="button"
                        className="btn btn--sm btn--outline-danger"
                        onClick={handleClearAllFiles}
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Trash2 size={14} />
                        Clear All
                      </button>
                    </div>

                    <div className="file-chip-grid">
                      {parsedFiles.map((pf) => (
                        <div
                          key={pf.id}
                          className={`file-staged-chip ${pf.status === 'ERROR' ? 'file-staged-chip--error' : ''}`}
                          style={{
                            opacity: pf.isSelectedSheet === false ? 0.6 : 1,
                            borderColor: pf.format === 'XLSX' ? '#cbd5e1' : undefined,
                          }}
                        >
                          <div className="file-chip-icon">
                            {pf.format === 'XLSX' ? (
                              <FileSpreadsheet size={22} className="text-emerald-700" />
                            ) : pf.format === 'CSV' ? (
                              <FileSpreadsheet size={20} />
                            ) : (
                              <FileCode size={20} />
                            )}
                          </div>
                          <div className="file-chip-info" style={{ flexGrow: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span className="file-chip-name" title={pf.name}>{pf.name}</span>
                              {pf.format === 'XLSX' && pf.isHiddenSheet && (
                                <span className="badge badge--warning" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                  Hidden
                                </span>
                              )}
                              {pf.assignedFarmId && (
                                <span style={{ fontSize: '0.68rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                                  {pf.assignedFarmId}
                                </span>
                              )}
                            </div>
                            <span className="file-chip-meta">
                              {pf.format} • {(pf.size / 1024).toFixed(1)} KB •{' '}
                              {pf.status === 'ERROR' ? (
                                <span className="text-red-600">{pf.errorMessage || 'Error'}</span>
                              ) : (
                                <span>{pf.rawRows.length} rows</span>
                              )}
                              {pf.formulaWarningsCount ? ` • ${pf.formulaWarningsCount} formulas` : ''}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {/* Toggle Include Checkbox */}
                            <label
                              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: '0.78rem', color: '#475569' }}
                              onClick={(e) => e.stopPropagation()}
                              title="Include or exclude this worksheet"
                            >
                              <input
                                type="checkbox"
                                checked={pf.isSelectedSheet !== false}
                                onChange={(e) => handleToggleSheetSelect(pf.id, e.target.checked)}
                              />
                              <span>Include</span>
                            </label>

                            {/* Preview raw data button */}
                            {pf.status === 'PARSED' && (
                              <button
                                type="button"
                                className="btn btn--sm btn--secondary"
                                onClick={() => setSheetPreviewTarget(pf)}
                                style={{ padding: '2px 7px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 3 }}
                                title="Preview worksheet rows"
                              >
                                <Eye size={12} />
                                <span>Preview</span>
                              </button>
                            )}

                            <button
                              type="button"
                              className="file-chip-remove"
                              onClick={() => handleRemoveFile(pf.id)}
                              title="Remove file"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                      <button
                        type="button"
                        className="btn btn--primary"
                        onClick={() => setStep(2)}
                        disabled={parsedFiles.filter((f) => f.status === 'PARSED' && f.isSelectedSheet !== false).length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        <span>Continue to Column Mapping</span>
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---------------------------------------------------------- */}
            {/* STEP 2: COLUMN MAPPING & FARM SELECTION */}
            {/* ---------------------------------------------------------- */}
            {step === 2 && (
              <div className="wizard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Column & Farm Mapping</h3>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                      Review automatically detected columns. If headers are unfamiliar or farm ID is missing in the file, map them here.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setStep(1)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <ArrowLeft size={14} /> Back to Files
                  </button>
                </div>

                {mappingCopyFeedback && (
                  <div className="alert alert--info" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={16} />
                    <span>{mappingCopyFeedback}</span>
                  </div>
                )}

                {parsedFiles.filter((f) => f.status === 'PARSED' && f.isSelectedSheet !== false).map((file) => {
                  const hasFarmColumn = file.mappings.some((m) => m.mappedField === 'farmId');

                  return (
                    <div key={file.id} className="file-mapping-card" style={{ marginBottom: 24, border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
                      <div className="file-mapping-card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a' }}>{file.name}</span>
                          <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, color: '#475569' }}>
                            {file.rawRows.length} rows
                          </span>
                          {file.assignedFarmId && (
                            <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                              Farm: {file.assignedFarmId}
                            </span>
                          )}
                        </div>

                        {/* File Options: Record Type & Date Convention & Copy Mapping */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => handleCopyMapping(file)}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}
                            title="Apply this worksheet's column mapping to other worksheets with matching headers"
                          >
                            <Layers size={13} />
                            <span>Reuse Mapping Across Matching Sheets</span>
                          </button>

                          <label style={{ fontSize: '0.82rem', color: '#475569' }}>
                            Record Type:
                            <select
                              value={file.detectedRecordType}
                              onChange={(e) => handleSetRecordType(file.id, e.target.value as RecordType)}
                              className="input-select-sm"
                              style={{ marginLeft: 6 }}
                            >
                              <option value="DAILY_REPORT">Daily Farm Submissions</option>
                              <option value="FEED_LOAD">Feed Delivery Records</option>
                              <option value="FLOCK_RECORD">Flock History Records</option>
                            </select>
                          </label>

                          <label style={{ fontSize: '0.82rem', color: '#475569' }}>
                            Date Format:
                            <select
                              value={file.dateFormatPreference || 'AUTO'}
                              onChange={(e) => handleSetDateFormat(file.id, e.target.value as any)}
                              className="input-select-sm"
                              style={{ marginLeft: 6 }}
                            >
                              <option value="AUTO">Auto-detect</option>
                              <option value="DD/MM/YYYY">DD/MM/YYYY (Indian/UK)</option>
                              <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
                            </select>
                          </label>
                        </div>
                      </div>

                      {/* Warnings if unusual layout or formulas */}
                      {file.unusualLayoutWarning && (
                        <div className="alert alert--warn" style={{ marginBottom: 12, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AlertTriangle size={16} />
                          <span>{file.unusualLayoutWarning}</span>
                        </div>
                      )}

                      {file.formulaWarningsCount && file.formulaWarningsCount > 0 ? (
                        <div className="alert alert--info" style={{ marginBottom: 12, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Info size={16} />
                          <span>Detected {file.formulaWarningsCount} formula cells. Cached calculated values will be imported.</span>
                        </div>
                      ) : null}

                      {/* If file has no Farm column, provide farm assignment fallback */}
                      {!hasFarmColumn && (
                        <div className="alert alert--warn" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Building2 size={18} />
                            <span>
                              <strong>No Farm Column detected:</strong> Please select an existing farm to assign this file's records to:
                            </span>
                          </div>
                          <select
                            value={file.assignedFarmId || ''}
                            onChange={(e) => handleAssignFarm(file.id, e.target.value)}
                            className="input-select-sm"
                            style={{ fontWeight: 600, background: '#fff' }}
                          >
                            <option value="">-- Choose Farm --</option>
                            {farms.map((farm) => (
                              <option key={farm.farmId} value={farm.farmId}>
                                {farm.farmId} - {farm.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Column Mapping Table */}
                      <div className="table-container">
                        <table className="data-table mapping-table">
                          <thead>
                            <tr>
                              <th>File Header</th>
                              <th>Sample Values</th>
                              <th>Match Status</th>
                              <th>Mapped ERP Field</th>
                            </tr>
                          </thead>
                          <tbody>
                            {file.mappings.map((mapping) => (
                              <tr key={mapping.fileHeader}>
                                <td className="td-bold">{mapping.fileHeader}</td>
                                <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                                  {mapping.sampleValues.slice(0, 3).join(', ') || '--'}
                                </td>
                                <td>
                                  {mapping.mappedField === 'ignore' ? (
                                    <span className="badge badge--neutral">Ignored</span>
                                  ) : mapping.confidence === 'HIGH' ? (
                                    <span className="badge badge--success">Matched</span>
                                  ) : (
                                    <span className="badge badge--warning">Review</span>
                                  )}
                                </td>
                                <td>
                                  <select
                                    value={mapping.mappedField}
                                    onChange={(e) =>
                                      handleUpdateMapping(file.id, mapping.fileHeader, e.target.value as StandardFieldKey)
                                    }
                                    className="mapping-select"
                                  >
                                    <option value="ignore">-- Do not import (Ignore) --</option>
                                    <optgroup label="Core Identifiers">
                                      <option value="submissionDate">Report Date *</option>
                                      <option value="farmId">Farm ID / Code *</option>
                                      <option value="flockId">Flock / Batch ID</option>
                                    </optgroup>
                                    <optgroup label="Bird & Feed">
                                      <option value="birdCount">Bird Count (Closing / Total)</option>
                                      <option value="feedKg">Feed Consumed (Kg)</option>
                                      <option value="feedGrams">Feed Consumed (Grams)</option>
                                      <option value="mortality">Mortality (Dead Birds)</option>
                                      <option value="culling">Culling (Rejected Birds)</option>
                                    </optgroup>
                                    <optgroup label="Production & Quality">
                                      <option value="eggsProduced">Eggs Produced</option>
                                      <option value="selectionEggs">Selection Eggs (Waste)</option>
                                      <option value="eggWeightAvg">Egg Weight Average (g)</option>
                                      <option value="bodyWeightAvg">Body Weight Average (g)</option>
                                    </optgroup>
                                    <optgroup label="Environment & Notes">
                                      <option value="temperature">Shed Temperature (°C)</option>
                                      <option value="ammoniaPpm">Ammonia (PPM)</option>
                                      <option value="remarks">Remarks / Notes</option>
                                    </optgroup>
                                    <optgroup label="Feed Delivery">
                                      <option value="feedLoadQuantityKg">Feed Delivery Quantity (Kg)</option>
                                      <option value="feedLoadNotes">Feed Delivery Notes</option>
                                    </optgroup>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setStep(1)}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>

                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={runValidationAndConflicts}
                    disabled={validating}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {validating ? <RefreshCw className="animate-spin" size={16} /> : null}
                    <span>Validate & Check Duplicates</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------- */}
            {/* STEP 3: VALIDATION, CONFLICTS & ROW PREVIEW */}
            {/* ---------------------------------------------------------- */}
            {step === 3 && (
              <div className="wizard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>Validation & Duplicate Verification</h3>
                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                      Review record verification results. No data will be written to Firebase until final confirmation.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setStep(2)}
                    >
                      <ArrowLeft size={14} /> Back to Mapping
                    </button>
                    {summary.invalid > 0 && (
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={handleDownloadErrors}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Download size={14} /> Download Error CSV
                      </button>
                    )}
                  </div>
                </div>

                {/* KPI Overview Cards */}
                <div className="kpi-grid" style={{ marginBottom: 20 }}>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Total Rows</span>
                    <span className="kpi-card__value">{summary.total}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Valid Rows</span>
                    <span className="kpi-card__value text-emerald-600">{summary.valid}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Invalid Rows</span>
                    <span className={`kpi-card__value ${summary.invalid > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      {summary.invalid}
                    </span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Exact Duplicates</span>
                    <span className="kpi-card__value text-slate-600">{summary.duplicates}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Existing Conflicts</span>
                    <span className={`kpi-card__value ${summary.conflicts > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {summary.conflicts}
                    </span>
                  </div>
                </div>

                {/* Conflict Resolution Strategy Banner */}
                {summary.conflicts > 0 && (
                  <div className="alert alert--warn" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <AlertTriangle size={20} className="text-amber-600" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: '0.95rem' }}>Conflicting Records Detected ({summary.conflicts})</strong>
                        <p style={{ margin: '4px 0 10px', fontSize: '0.88rem' }}>
                          Some records in your files have the same Farm ID and Report Date as existing submissions, but contain differing data values.
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="conflictAction"
                              value="skip"
                              checked={conflictAction === 'skip'}
                              onChange={() => setConflictAction('skip')}
                            />
                            <span><strong>Skip Conflicting Records</strong> (Safe - keep existing data in database)</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input
                              type="radio"
                              name="conflictAction"
                              value="replace"
                              checked={conflictAction === 'replace'}
                              onChange={() => setConflictAction('replace')}
                            />
                            <span><strong>Replace Conflicting Records</strong> (Explicit authorization required)</span>
                          </label>
                        </div>

                        {conflictAction === 'replace' && (
                          <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff', borderRadius: 6, border: '1px solid #fed7aa' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: '#9a3412', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={confirmReplaceAuthorized}
                                onChange={(e) => setConfirmReplaceAuthorized(e.target.checked)}
                              />
                              <span>
                                <strong>I explicitly authorize overwriting conflicting records</strong> in Firestore. An audit log with before-and-after values will be preserved.
                              </span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Worksheet & Farm Reporting Period Breakdown */}
                <div style={{ marginBottom: 24, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: 8, color: '#1e293b' }}>
                    <Layers size={18} className="text-emerald-700" />
                    Worksheet &amp; Farm Reporting Period Breakdown
                  </h4>
                  <div className="table-container" style={{ maxHeight: 260, overflowY: 'auto' }}>
                    <table className="data-table" style={{ fontSize: '0.84rem' }}>
                      <thead>
                        <tr>
                          <th>Worksheet / File</th>
                          <th>Layout</th>
                          <th>Target Farm</th>
                          <th>Reporting Date Range</th>
                          <th>Total</th>
                          <th>Valid</th>
                          <th>Errors</th>
                          <th>Duplicates / Conflicts</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedFiles.filter((f) => f.isSelectedSheet !== false && f.status === 'PARSED').map((file) => {
                          const fileRows = validatedRows.filter((r) => r.fileName === file.name);
                          const validCount = fileRows.filter((r) => r.isValid).length;
                          const errCount = fileRows.filter((r) => !r.isValid).length;
                          const dupeCount = fileRows.filter((r) => r.conflictStatus === 'EXACT_DUPLICATE').length;
                          const conflictCount = fileRows.filter((r) => r.conflictStatus === 'CONFLICT').length;

                          const validDates = fileRows
                            .map((r) => r.submissionDate)
                            .filter(Boolean)
                            .sort();
                          const dateRangeStr = validDates.length > 0
                            ? `${validDates[0]} to ${validDates[validDates.length - 1]}`
                            : file.dateRange
                            ? `${file.dateRange.minDate} to ${file.dateRange.maxDate}`
                            : 'N/A';

                          const targetFarm = file.assignedFarmId || (fileRows.length > 0 ? fileRows[0]?.farmId : 'Unassigned');

                          return (
                            <tr key={file.id}>
                              <td className="td-bold" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.name}>
                                {file.name}
                              </td>
                              <td>
                                {file.isTransposed ? (
                                  <span className="badge badge--warning" style={{ fontSize: '0.74rem' }}>
                                    Horizontal Matrix
                                  </span>
                                ) : (
                                  <span className="badge badge--neutral" style={{ fontSize: '0.74rem' }}>
                                    Vertical Table
                                  </span>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>{targetFarm || 'Unassigned'}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{dateRangeStr}</td>
                              <td>{fileRows.length}</td>
                              <td style={{ color: '#15803d', fontWeight: 600 }}>{validCount}</td>
                              <td style={{ color: errCount > 0 ? '#b91c1c' : '#64748b', fontWeight: errCount > 0 ? 600 : 400 }}>
                                {errCount}
                              </td>
                              <td>
                                {dupeCount > 0 && <span style={{ marginRight: 6 }}>{dupeCount} dup</span>}
                                {conflictCount > 0 && <span style={{ color: '#b45309' }}>{conflictCount} conf</span>}
                                {dupeCount === 0 && conflictCount === 0 && <span style={{ color: '#94a3b8' }}>0</span>}
                              </td>
                              <td>
                                {errCount === 0 && validCount > 0 ? (
                                  <span className="text-emerald-600 font-semibold" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle2 size={14} /> Ready
                                  </span>
                                ) : errCount > 0 && validCount > 0 ? (
                                  <span className="text-amber-600 font-semibold" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <AlertTriangle size={14} /> Partial
                                  </span>
                                ) : (
                                  <span className="text-red-600 font-semibold" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <XCircle size={14} /> Attention
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn--sm ${rowFilter === 'ALL' ? 'btn--primary' : 'btn--secondary'}`}
                      onClick={() => setRowFilter('ALL')}
                    >
                      All ({summary.total})
                    </button>
                    <button
                      type="button"
                      className={`btn btn--sm ${rowFilter === 'VALID' ? 'btn--primary' : 'btn--secondary'}`}
                      onClick={() => setRowFilter('VALID')}
                    >
                      Valid ({summary.valid})
                    </button>
                    {summary.invalid > 0 && (
                      <button
                        type="button"
                        className={`btn btn--sm ${rowFilter === 'INVALID' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setRowFilter('INVALID')}
                      >
                        Errors ({summary.invalid})
                      </button>
                    )}
                    {summary.duplicates > 0 && (
                      <button
                        type="button"
                        className={`btn btn--sm ${rowFilter === 'DUPLICATES' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setRowFilter('DUPLICATES')}
                      >
                        Duplicates ({summary.duplicates})
                      </button>
                    )}
                    {summary.conflicts > 0 && (
                      <button
                        type="button"
                        className={`btn btn--sm ${rowFilter === 'CONFLICTS' ? 'btn--primary' : 'btn--secondary'}`}
                        onClick={() => setRowFilter('CONFLICTS')}
                      >
                        Conflicts ({summary.conflicts})
                      </button>
                    )}
                  </div>

                  <div style={{ position: 'relative', width: 240 }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      placeholder="Search farm, date, file..."
                      value={rowSearch}
                      onChange={(e) => setRowSearch(e.target.value)}
                      className="search-input"
                      style={{ paddingLeft: 34, width: '100%' }}
                    />
                  </div>
                </div>

                {/* Rows Preview Table */}
                <div className="table-container" style={{ maxHeight: 420, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>Incl.</th>
                        <th>File & Row</th>
                        <th>Farm ID</th>
                        <th>Report Date</th>
                        <th>Status</th>
                        <th>Birds</th>
                        <th>Feed (Kg)</th>
                        <th>Mortality</th>
                        <th>Eggs</th>
                        <th>Validation Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.slice(0, 100).map((row) => {
                        const originalIdx = validatedRows.indexOf(row);
                        return (
                          <tr key={`${row.fileId}_${row.rowNumber}`} className={row.isExcluded ? 'row--excluded' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={!row.isExcluded}
                                onChange={() => handleToggleExcludeRow(originalIdx)}
                                title="Toggle include this row"
                              />
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{row.fileName}</span>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Row #{row.rowNumber}</div>
                            </td>
                            <td className="td-bold">{row.farmId || <span className="text-red-500">Missing</span>}</td>
                            <td>
                              {row.submissionDate ? (
                                <span>{row.submissionDate}</span>
                              ) : (
                                <span className="text-red-500">{row.rawDate || '--'}</span>
                              )}
                            </td>
                            <td>
                              {!row.isValid ? (
                                <span className="badge badge--danger">Invalid</span>
                              ) : row.conflictStatus === 'EXACT_DUPLICATE' ? (
                                <span className="badge badge--neutral">Duplicate</span>
                              ) : row.conflictStatus === 'CONFLICT' ? (
                                <span className="badge badge--warning">Conflict</span>
                              ) : (
                                <span className="badge badge--success">Valid (New)</span>
                              )}
                            </td>
                            <td>{row.birdCount ?? '--'}</td>
                            <td>{row.feedKg ?? '--'}</td>
                            <td>{row.mortality ?? '--'}</td>
                            <td>{row.eggsProduced ?? '--'}</td>
                            <td>
                              {row.errors.length > 0 ? (
                                <div style={{ color: '#dc2626', fontSize: '0.8rem' }}>
                                  {row.errors.map((e, idx) => (
                                    <div key={idx}>• {e.reason}</div>
                                  ))}
                                </div>
                              ) : row.conflictStatus === 'CONFLICT' && row.diff ? (
                                <div style={{ color: '#d97706', fontSize: '0.78rem' }}>
                                  {Object.entries(row.diff).map(([f, d]: any) => (
                                    <div key={f}>
                                      • {f}: <s>{d.existing}</s> → <strong>{d.proposed}</strong>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>Ready</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredRows.length > 100 && (
                  <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.82rem', margin: '8px 0 0' }}>
                    Showing first 100 rows of {filteredRows.length}. All valid non-excluded rows will be imported.
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setStep(2)}
                  >
                    <ArrowLeft size={16} /> Back
                  </button>

                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => setStep(4)}
                    disabled={summary.valid === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span>Proceed to Confirmation ({summary.valid} valid records)</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------- */}
            {/* STEP 4: FINAL CONFIRMATION & EXECUTE */}
            {/* ---------------------------------------------------------- */}
            {step === 4 && (
              <div className="wizard-card">
                <h3 style={{ margin: '0 0 12px' }}>Confirm Import Execution</h3>

                <div className="alert alert--info" style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <ShieldCheck size={22} className="text-emerald-700" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.9rem' }}>
                      <strong>Safe Import Safeguards Active:</strong>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        <li>Historical dates are preserved and will not be overwritten with today's date.</li>
                        <li>Current live bird populations and real-time feed stocks on farms will <strong>NOT</strong> be overwritten by summing past historical snapshots.</li>
                        <li>Each report is recorded idempotently with lock verification.</li>
                        <li>An audit record will be logged under your administrator account.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Summary by Farm */}
                <h4 style={{ margin: '16px 0 8px' }}>Import Breakdown by Farm</h4>
                <div className="table-container" style={{ marginBottom: 20 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Farm ID</th>
                        <th>Files Involved</th>
                        <th>Records to Write</th>
                        <th>Duplicates Skipped</th>
                        <th>Conflicts Handled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(validatedRows.filter((r) => r.isValid && !r.isExcluded).map((r) => r.farmId))).map((farmId) => {
                        const farmRows = validatedRows.filter((r) => r.farmId === farmId && r.isValid && !r.isExcluded);
                        const files = Array.from(new Set(farmRows.map((r) => r.fileName)));
                        const dupes = farmRows.filter((r) => r.conflictStatus === 'EXACT_DUPLICATE').length;
                        const conflicts = farmRows.filter((r) => r.conflictStatus === 'CONFLICT').length;
                        const writeCount = conflictAction === 'skip' ? farmRows.length - dupes - conflicts : farmRows.length - dupes;

                        return (
                          <tr key={farmId}>
                            <td className="td-bold">{farmId}</td>
                            <td>{files.join(', ')}</td>
                            <td style={{ fontWeight: 600, color: '#15803d' }}>{writeCount}</td>
                            <td>{dupes}</td>
                            <td>{conflicts} ({conflictAction === 'skip' ? 'Skipped' : 'Replaced'})</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Simulation Result Alert */}
                {simulationResult && (
                  <div className="alert alert--info" style={{ marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <CheckCircle2 size={20} className="text-emerald-700" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <strong style={{ color: '#166534' }}>Dry-Run Simulation Complete:</strong>
                        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#1e293b' }}>
                          Verified <strong>{simulationResult.totalProcessed}</strong> records. 
                          {' '}<strong>{simulationResult.importedCount}</strong> records would be written, 
                          {' '}<strong>{simulationResult.duplicateCount}</strong> exact duplicates skipped, 
                          {' '}<strong>{simulationResult.conflictCount}</strong> conflicts handled ({conflictAction === 'skip' ? 'skipped' : 'overwritten'}).
                          <span style={{ display: 'block', color: '#15803d', fontWeight: 600, marginTop: 4 }}>
                            Zero database writes were executed. The data is valid and ready for live import.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {importError && (
                  <div className="alert alert--error" style={{ marginBottom: 16 }}>
                    {importError}
                  </div>
                )}

                {(importing || simulating) && (
                  <div style={{ margin: '20px 0', padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>
                      <span>{simulating ? 'Simulating import batches...' : 'Writing Firestore bounded batches...'}</span>
                      <span>{importProgress.percentage}%</span>
                    </div>
                    <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${importProgress.percentage}%`,
                          background: simulating ? '#0284c7' : '#15803d',
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: 6 }}>
                      Batch {importProgress.currentBatch} of {importProgress.totalBatches || 1}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => setStep(3)}
                    disabled={importing || simulating}
                  >
                    <ArrowLeft size={16} /> Back to Preview
                  </button>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={handleSimulateImport}
                      disabled={importing || simulating || summary.valid === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {simulating ? <RefreshCw className="animate-spin" size={16} /> : <Eye size={16} />}
                      <span>{simulating ? 'Simulating...' : 'Run Dry-Run Simulation'}</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn--primary btn--lg"
                      onClick={handleExecuteImport}
                      disabled={importing || simulating || summary.valid === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, justifyContent: 'center' }}
                    >
                      {importing ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                      <span>{importing ? 'Importing Data...' : 'Confirm & Execute Import'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------- */}
            {/* STEP 5: SUMMARY & RESULTS */}
            {/* ---------------------------------------------------------- */}
            {step === 5 && importResult && (
              <div className="wizard-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: importResult.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7',
                    color: importResult.status === 'COMPLETED' ? '#15803d' : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <CheckCircle2 size={36} />
                </div>

                <h3 style={{ margin: '0 0 6px', fontSize: '1.4rem' }}>
                  {importResult.status === 'COMPLETED' ? 'Import Successfully Completed!' : 'Import Finished with Partial Warnings'}
                </h3>
                <p style={{ color: '#64748b', margin: '0 0 24px', fontSize: '0.92rem' }}>
                  Batch ID: <code>{importResult.batchId}</code>
                </p>

                <div className="kpi-grid" style={{ maxWidth: 650, margin: '0 auto 28px' }}>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Records Imported</span>
                    <span className="kpi-card__value text-emerald-600">{importResult.importedCount}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Duplicates Skipped</span>
                    <span className="kpi-card__value text-slate-600">{importResult.duplicateCount}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Conflicts Handled</span>
                    <span className="kpi-card__value text-amber-600">{importResult.conflictCount}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Failed Rows</span>
                    <span className={`kpi-card__value ${importResult.failedCount > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      {importResult.failedCount}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={handleClearAllFiles}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <UploadCloud size={16} />
                    <span>Import More Historical Files</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => {
                      setActiveTab('history');
                      loadHistory();
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <History size={16} />
                    <span>View in Import History</span>
                  </button>

                  <a
                    href="/admin/submissions"
                    className="btn btn--secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
                  >
                    <span>View Daily Submissions</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: IMPORT HISTORY & AUDIT LOG */}
        {/* ============================================================== */}
        {activeTab === 'history' && (
          <div className="wizard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Previous Import Batches</h3>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                  Audit log of all historical batch imports executed in the system.
                </p>
              </div>
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={loadHistory}
                disabled={loadingHistory}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
                <span>Refresh History</span>
              </button>
            </div>

            {loadingHistory ? (
              <LoadingState message="Loading import history..." />
            ) : importBatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                <History size={40} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 500 }}>No import batches found yet.</p>
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={() => setActiveTab('import')}
                  style={{ marginTop: 12 }}
                >
                  Start Your First Import
                </button>
              </div>
            ) : (
              <div className="import-history-list">
                {importBatches.map((batch) => {
                  const isExpanded = expandedBatchId === batch.batchId;
                  const dateStr = batch.importTimestamp ? formatDisplayDate(batch.importTimestamp) : '--';

                  return (
                    <div
                      key={batch.batchId}
                      className="import-history-card"
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        marginBottom: 12,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: isExpanded ? '#f8fafc' : '#fff',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedBatchId(isExpanded ? null : batch.batchId)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span
                            className={`badge ${
                              batch.revertStatus === 'REVERTED'
                                ? 'badge--default'
                                : batch.status === 'COMPLETED'
                                ? 'badge--success'
                                : batch.status === 'PARTIAL_FAILURE'
                                ? 'badge--warning'
                                : 'badge--danger'
                            }`}
                            style={batch.revertStatus === 'REVERTED' ? { backgroundColor: '#f1f5f9', color: '#64748b' } : undefined}
                          >
                            {batch.revertStatus === 'REVERTED'
                              ? 'REVERTED'
                              : batch.revertStatus === 'REVERTING'
                              ? 'REVERTING...'
                              : batch.status}
                          </span>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                                Batch {batch.batchId}
                              </span>
                              {batch.affectedFarms && batch.affectedFarms.length > 0 && (
                                <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 4, fontWeight: 500 }}>
                                  {batch.affectedFarms.length} Farm{batch.affectedFarms.length > 1 ? 's' : ''} ({batch.affectedFarms.join(', ')})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                              {dateStr} • By: {batch.adminEmail || batch.adminUid || 'Admin'} •{' '}
                              {(batch.filenames || []).length} file{(batch.filenames || []).length > 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 600, color: batch.revertStatus === 'REVERTED' ? '#64748b' : '#15803d' }}>
                              {batch.importedCount ?? 0} imported
                            </span>
                            <span style={{ color: '#64748b', marginLeft: 8 }}>
                              ({batch.skippedCount ?? 0} skipped, {batch.failedCount ?? 0} failed)
                            </span>
                          </div>

                          {/* Revert Action Button */}
                          {batch.revertStatus === 'REVERTED' ? (
                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '4px 8px' }}>
                              Reverted
                            </span>
                          ) : batch.revertStatus === 'REVERTING' ? (
                            <button
                              type="button"
                              className="btn btn--sm btn--secondary"
                              disabled
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                              <RefreshCw size={13} className="animate-spin" />
                              <span>Reverting...</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn--sm btn--outline-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRevertModal(batch);
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                              title="Revert imported data for this batch"
                            >
                              <RotateCcw size={13} />
                              <span>Revert</span>
                            </button>
                          )}

                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
                          <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 10 }}>
                            <strong>Source Files:</strong> {(batch.filenames || []).join(', ') || 'N/A'}
                          </div>

                          {batch.affectedFarms && batch.affectedFarms.length > 0 && (
                            <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 10 }}>
                              <strong>Affected Farms:</strong> {batch.affectedFarms.join(', ')}
                            </div>
                          )}

                          <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: 12 }}>
                            <strong>Conflict Resolution Chosen:</strong> {batch.conflictActionChosen || 'skip'}
                          </div>

                          {batch.revertAudit && (
                            <div
                              style={{
                                margin: '12px 0',
                                padding: '12px 14px',
                                background: '#f8fafc',
                                borderRadius: 6,
                                border: '1px solid #e2e8f0',
                                fontSize: '0.84rem',
                              }}
                            >
                              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                                Revert Audit Details:
                              </div>
                              <div style={{ color: '#475569' }}>
                                Reverted by: <strong>{batch.revertAudit.revertedByEmail || batch.revertAudit.revertedByUid || 'Admin'}</strong>
                                {' '}on {batch.revertAudit.revertCompletedTimestamp ? formatDisplayDate(batch.revertAudit.revertCompletedTimestamp) : batch.revertAudit.revertTimestamp ? formatDisplayDate(batch.revertAudit.revertTimestamp) : '--'}
                              </div>
                              <div style={{ color: '#475569', marginTop: 3 }}>
                                Records Deleted: <strong>{batch.revertAudit.deletedRecordsCount}</strong> • Records Restored: <strong>{batch.revertAudit.restoredRecordsCount}</strong> • Skipped/Conflicts: <strong>{(batch.revertAudit.skippedRecordsCount || 0) + (batch.revertAudit.conflictsCount || 0)}</strong>
                              </div>
                            </div>
                          )}

                          {batch.errors && batch.errors.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <strong style={{ fontSize: '0.85rem', color: '#dc2626' }}>
                                  Failed / Unresolved Rows ({batch.errors.length}):
                                </strong>
                                <button
                                  type="button"
                                  className="btn btn--sm btn--secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const csv = generateErrorReportCsv(batch.errors);
                                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `error_report_${batch.batchId}.csv`;
                                    a.click();
                                  }}
                                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                                >
                                  <Download size={14} /> Download Error Log (.csv)
                                </button>
                              </div>

                              <div style={{ maxHeight: 180, overflowY: 'auto', background: '#fef2f2', borderRadius: 6, padding: 8 }}>
                                {batch.errors.slice(0, 50).map((err: any, i: number) => (
                                  <div key={i} style={{ fontSize: '0.78rem', color: '#991b1b', marginBottom: 4 }}>
                                    • {err.file}, Row {err.row}: {err.reason}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* WORKSHEET QUICK PREVIEW MODAL */}
      {/* ============================================================== */}
      {sheetPreviewTarget && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => setSheetPreviewTarget(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                  Worksheet Preview: {sheetPreviewTarget.sheetName || sheetPreviewTarget.name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Workbook: <strong>{sheetPreviewTarget.parentFileName || sheetPreviewTarget.name}</strong> • {sheetPreviewTarget.rawRows.length} data rows detected
                  {sheetPreviewTarget.assignedFarmId ? ` • Detected Farm: ${sheetPreviewTarget.assignedFarmId}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheetPreviewTarget(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <XCircle size={22} />
              </button>
            </div>

            <div style={{ marginBottom: 16, fontSize: '0.85rem', color: '#475569' }}>
              <strong>Detected Headers ({sheetPreviewTarget.headers.length}):</strong>{' '}
              {sheetPreviewTarget.headers.join(', ')}
            </div>

            <div className="table-container" style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
              <table className="data-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Row #</th>
                    {sheetPreviewTarget.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheetPreviewTarget.rawRows.slice(0, 10).map((r) => (
                    <tr key={r.rowNumber}>
                      <td className="td-bold">{r.rowNumber}</td>
                      {sheetPreviewTarget.headers.map((h) => (
                        <td key={h}>{r.data[h] ?? '--'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sheetPreviewTarget.rawRows.length > 10 && (
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem', margin: '4px 0 16px' }}>
                Showing first 10 of {sheetPreviewTarget.rawRows.length} rows. All rows will be processed according to column mappings.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setSheetPreviewTarget(null)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REVERT CONFIRMATION MODAL */}
      {/* ============================================================== */}
      {revertModalBatch && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={() => {
            if (!revertingBatch) handleCloseRevertModal();
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Revert Imported Data?</h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Batch ID: <code>{revertModalBatch.batchId}</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseRevertModal}
                disabled={revertingBatch}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <XCircle size={22} />
              </button>
            </div>

            {/* Revert Success State */}
            {revertSuccessResult ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    color: '#15803d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <h4 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#0f172a' }}>
                  Batch Successfully Reverted
                </h4>
                <p style={{ color: '#475569', fontSize: '0.9rem', marginBottom: 20 }}>
                  The records imported in batch <code>{revertModalBatch.batchId}</code> have been safely rolled back.
                </p>

                <div className="kpi-grid" style={{ marginBottom: 24 }}>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Records Deleted</span>
                    <span className="kpi-card__value text-red-600">{revertSuccessResult.deletedCount}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Records Restored</span>
                    <span className="kpi-card__value text-emerald-600">{revertSuccessResult.restoredCount}</span>
                  </div>
                  <div className="kpi-card">
                    <span className="kpi-card__title">Conflicts / Skipped</span>
                    <span className="kpi-card__value text-slate-600">
                      {revertSuccessResult.skippedCount + revertSuccessResult.conflictCount}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleCloseRevertModal}
                  style={{ minWidth: 160 }}
                >
                  Done & Close
                </button>
              </div>
            ) : (
              <>
                {/* Prominent Warning Callout */}
                <div
                  style={{
                    backgroundColor: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    marginBottom: 20,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <AlertTriangle size={22} className="text-rose-600" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: '0.88rem', color: '#881337', lineHeight: 1.5 }}>
                    <strong>Caution: You are about to permanently revert this batch.</strong>
                    <div style={{ marginTop: 4 }}>
                      This action will delete daily reports, logs, and lock records created by this batch, and will restore original pre-import records if they were overwritten. This operation cannot be undone. Live physical farm balances (current bird population and feed inventory) will remain intact.
                    </div>
                  </div>
                </div>

                {/* Loading Revert Preview */}
                {loadingRevertPreview ? (
                  <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <RefreshCw className="animate-spin text-emerald-600" size={32} style={{ margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                      Analyzing batch records and checking for subsequent modifications...
                    </p>
                  </div>
                ) : revertPreview ? (
                  <>
                    {/* Batch Metrics Breakdown */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                        gap: 10,
                        marginBottom: 18,
                      }}
                    >
                      <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total Imported</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                          {revertPreview.totalImported}
                        </div>
                      </div>
                      <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#166534' }}>Safely Reversible</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#15803d' }}>
                          {revertPreview.canSafelyRevert}
                        </div>
                      </div>
                      <div style={{ background: '#eff6ff', padding: 12, borderRadius: 8, border: '1px solid #bfdbfe' }}>
                        <div style={{ fontSize: '0.75rem', color: '#1e40af' }}>Will Delete</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>
                          {revertPreview.willDelete}
                        </div>
                      </div>
                      <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Will Restore</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#d97706' }}>
                          {revertPreview.willRestore}
                        </div>
                      </div>
                      {revertPreview.requiresReview > 0 && (
                        <div style={{ background: '#fef2f2', padding: 12, borderRadius: 8, border: '1px solid #fecaca' }}>
                          <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Requires Review</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>
                            {revertPreview.requiresReview}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Affected Farms */}
                    {revertPreview.affectedFarms.length > 0 && (
                      <div style={{ marginBottom: 16, fontSize: '0.88rem' }}>
                        <span style={{ color: '#64748b' }}>Affected Farms: </span>
                        {revertPreview.affectedFarms.map((fId) => (
                          <span
                            key={fId}
                            style={{
                              display: 'inline-block',
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              marginRight: 6,
                            }}
                          >
                            {fId}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Inspect Sample Records Toggle */}
                    {revertPreview.sampleRecords.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <button
                          type="button"
                          className="btn btn--sm btn--secondary"
                          onClick={() => setShowRevertSample(!showRevertSample)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
                        >
                          <span>{showRevertSample ? 'Hide' : 'Inspect'} Sample Records ({revertPreview.sampleRecords.length})</span>
                          {showRevertSample ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showRevertSample && (
                          <div
                            style={{
                              marginTop: 8,
                              maxHeight: 180,
                              overflowY: 'auto',
                              border: '1px solid #e2e8f0',
                              borderRadius: 6,
                              background: '#f8fafc',
                            }}
                          >
                            <table className="data-table" style={{ fontSize: '0.8rem' }}>
                              <thead>
                                <tr>
                                  <th>Farm</th>
                                  <th>Date</th>
                                  <th>Type</th>
                                  <th>Action</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {revertPreview.sampleRecords.map((r, i) => (
                                  <tr key={i}>
                                    <td className="td-bold">{r.farmId}</td>
                                    <td>{r.submissionDate}</td>
                                    <td>{r.recordType}</td>
                                    <td>
                                      <span className={`badge ${r.action === 'CREATED' ? 'badge--info' : 'badge--warning'}`}>
                                        {r.action === 'CREATED' ? 'Will Delete' : 'Will Restore'}
                                      </span>
                                    </td>
                                    <td>
                                      {r.canSafelyRevert ? (
                                        <span style={{ color: '#15803d' }}>Ready to Revert</span>
                                      ) : (
                                        <span style={{ color: '#dc2626' }}>{r.reason || 'Modified'}</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ineligibility Warning if Not Reversible */}
                    {!revertPreview.isReversible && (
                      <div className="alert alert--error" style={{ marginBottom: 16 }}>
                        {revertPreview.notReversibleReason || 'This batch cannot be safely reverted.'}
                      </div>
                    )}

                    {/* Revert Form Inputs (Only enabled if reversible) */}
                    {revertPreview.isReversible && (
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                        {/* Acknowledgment Checkbox */}
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            cursor: 'pointer',
                            marginBottom: 16,
                            fontSize: '0.88rem',
                            color: '#334155',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={revertAckChecked}
                            onChange={(e) => setRevertAckChecked(e.target.checked)}
                            disabled={revertingBatch}
                            style={{ marginTop: 3 }}
                          />
                          <span>
                            I understand that reverting this batch will permanently remove imported records and restore pre-import data where applicable.
                          </span>
                        </label>

                        {/* Confirmation Phrase Input */}
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'block', fontSize: '0.85rem', color: '#475569', marginBottom: 6 }}>
                            To confirm, type the exact batch ID{' '}
                            <strong style={{ color: '#0f172a' }}>{revertModalBatch.batchId}</strong> below:
                          </label>
                          <input
                            type="text"
                            className="input"
                            value={revertConfirmationInput}
                            onChange={(e) => setRevertConfirmationInput(e.target.value)}
                            placeholder={revertModalBatch.batchId}
                            disabled={revertingBatch}
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              borderColor:
                                revertConfirmationInput && revertConfirmationInput.trim() !== revertModalBatch.batchId
                                  ? '#f87171'
                                  : undefined,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : null}

                {/* Revert Error Display */}
                {revertError && (
                  <div className="alert alert--error" style={{ marginBottom: 16 }}>
                    {revertError}
                  </div>
                )}

                {/* Reverting Progress Bar */}
                {revertingBatch && (
                  <div style={{ margin: '16px 0', padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', color: '#0f172a' }}>
                      <RefreshCw className="animate-spin text-rose-600" size={16} />
                      <span>Reverting batch records and restoring documents... Please wait.</span>
                    </div>
                  </div>
                )}

                {/* Modal Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={handleCloseRevertModal}
                    disabled={revertingBatch}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={handleExecuteRevert}
                    disabled={
                      revertingBatch ||
                      !revertAckChecked ||
                      revertConfirmationInput.trim() !== revertModalBatch.batchId ||
                      loadingRevertPreview ||
                      !revertPreview?.isReversible
                    }
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    {revertingBatch ? (
                      <RefreshCw className="animate-spin" size={16} />
                    ) : (
                      <RotateCcw size={16} />
                    )}
                    <span>{revertingBatch ? 'Reverting...' : 'Confirm & Revert Batch'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
