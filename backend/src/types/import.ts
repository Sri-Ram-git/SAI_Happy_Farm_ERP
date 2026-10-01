export interface HistoricalImportRecord {
  recordType: 'DAILY_REPORT' | 'FEED_LOAD' | 'FLOCK_RECORD';
  farmId: string;
  submissionDate: string; // ISO YYYY-MM-DD
  birdCount?: number;
  openingBirdCount?: number;
  closingBirdCount?: number;
  feedKg?: number;
  feedGrams?: number;
  feedG?: number;
  mortality?: number;
  culling?: number;
  eggsProduced?: number;
  selectionEggs?: number;
  temperature?: number | null;
  tempMin?: number | null;
  tempMax?: number | null;
  ammoniaPpm?: number | null;
  eggWeight?: { min: number; max: number; avg: number } | null;
  bodyWeight?: { min: number; max: number; avg: number } | null;
  remarks?: string;
  flockId?: string;
  sourceFile: string;
  sourceRow: number;
  weekNumber?: number;
  weekLabel?: string;
  damagedEggs?: number;
  floorEggs?: number;
  feedGramsPerBird?: number;
  actualProductionPct?: number;
  standardProductionPct?: number;
  // Specific to Feed Loads
  feedLoadQuantityKg?: number;
  feedLoadNotes?: string;
  // Specific to Flock Creation
  flockName?: string;
  initialBirds?: number;
  startDate?: string;
  breedType?: string;
}

export interface ConflictItem {
  index: number;
  farmId: string;
  submissionDate: string;
  status: 'NEW' | 'EXACT_DUPLICATE' | 'CONFLICT';
  existingData?: Record<string, any>;
  diff?: Record<string, { existing: any; proposed: any }>;
}

export interface CheckConflictsRequest {
  records: HistoricalImportRecord[];
}

export interface CheckConflictsResponse {
  results: ConflictItem[];
  summary: {
    total: number;
    newCount: number;
    exactDuplicateCount: number;
    conflictCount: number;
  };
}

export interface ExecuteImportRequest {
  batchId?: string;
  records: HistoricalImportRecord[];
  conflictAction: 'skip' | 'replace';
  sourceFiles: string[];
  dryRun?: boolean;
}

export interface ImportBatchError {
  file: string;
  row: number;
  field?: string;
  reason: string;
  rawData?: Record<string, any>;
}

export interface OverwrittenRecord {
  farmId: string;
  submissionDate: string;
  previousData: Record<string, any>;
  newData: Record<string, any>;
}

export interface ExecuteImportResponse {
  batchId: string;
  totalProcessed: number;
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  conflictCount: number;
  failedCount: number;
  errors: ImportBatchError[];
  status: 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
  isDryRun?: boolean;
  worksheets?: WorksheetImportContribution[];
}

export type RevertBatchStatus =
  | 'NOT_REVERTED'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'REVERTING'
  | 'REVERTED'
  | 'PARTIALLY_REVERTED'
  | 'REVERT_FAILED'
  | 'REVERT_REQUIRES_REVIEW'
  | 'REVERT_CONFLICT'
  | 'NOT_REVERSIBLE';

export interface ImportManifestTargetDoc {
  collectionPath: string;
  docId: string;
}

export interface ImportManifestItem {
  recordType: 'DAILY_REPORT' | 'FEED_LOAD' | 'FLOCK_RECORD';
  action: 'CREATED' | 'UPDATED';
  farmId: string;
  submissionDate: string;
  sourceFile?: string;
  sheetName?: string | null;
  targetDocs: ImportManifestTargetDoc[];
  beforeData?: Record<string, any> | null;
  importedData?: Record<string, any>;
  importedAt: string;
  submissionVersion?: number;
  reversalStatus?: 'PENDING' | 'REVERTED' | 'CONFLICT' | 'SKIPPED';
  reversalError?: string;
}

export interface WorksheetImportContribution {
  worksheetKey: string;
  fileName: string;
  sheetName?: string | null;
  farmId?: string;
  status: 'IMPORTED' | 'IMPORTED_WITH_ERRORS' | 'PARTIALLY_REVERTED' | 'REVERTED' | 'REVERT_FAILED' | 'REVERT_CONFLICT';
  importedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  dateRange?: { minDate: string; maxDate: string } | null;
  importTimestamp: string;
  revertTimestamp?: string;
  revertStatus?: 'NOT_REVERTED' | 'REVERTING' | 'REVERTED' | 'PARTIALLY_REVERTED' | 'REVERT_FAILED' | 'REVERT_CONFLICT';
  canSafelyRevert: boolean;
  notReversibleReason?: string;
  revertAudit?: {
    deletedCount: number;
    restoredCount: number;
    failedCount: number;
    conflictsCount: number;
  };
}

export interface RevertAuditRecord {
  revertOperationId: string;
  revertedByUid: string;
  revertedByEmail: string | null;
  revertTimestamp: string;
  revertCompletedTimestamp?: string;
  deletedRecordsCount: number;
  restoredRecordsCount: number;
  skippedRecordsCount: number;
  conflictsCount: number;
  failedCount: number;
  errors?: Array<{ file?: string; docId?: string; reason: string }>;
}

export interface ImportBatchRecord {
  batchId: string;
  adminUid: string;
  adminEmail: string | null;
  importTimestamp: string;
  filenames: string[];
  affectedFarms?: string[];
  recordType: 'DAILY_REPORT' | 'FEED_LOAD' | 'FLOCK_RECORD' | 'MIXED';
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  conflictCount: number;
  failedCount: number;
  conflictActionChosen: 'skip' | 'replace';
  status: 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED';
  errors: ImportBatchError[];
  overwrittenRecords?: OverwrittenRecord[];
  manifest?: ImportManifestItem[];
  worksheets?: WorksheetImportContribution[];
  revertStatus?: RevertBatchStatus;
  revertAudit?: RevertAuditRecord;
  notReversibleReason?: string;
}

export interface RevertPreviewRecord {
  farmId: string;
  submissionDate: string;
  recordType: string;
  action: 'CREATED' | 'UPDATED';
  sourceFile?: string;
  canSafelyRevert: boolean;
  reason?: string;
}

export interface RevertPreviewResponse {
  batchId: string;
  worksheetKey?: string;
  worksheetName?: string;
  importTimestamp: string;
  filenames: string[];
  affectedFarms: string[];
  totalImported: number;
  canSafelyRevert: number;
  requiresReview: number;
  willDelete: number;
  willRestore: number;
  isReversible: boolean;
  revertStatus: RevertBatchStatus;
  notReversibleReason?: string;
  sampleRecords: RevertPreviewRecord[];
}

export interface RevertBatchRequest {
  confirmationBatchId: string;
  worksheetKey?: string;
}

export interface RevertBatchResponse {
  revertOperationId: string;
  batchId: string;
  worksheetKey?: string;
  status: RevertBatchStatus;
  worksheetStatus?: string;
  deletedCount: number;
  restoredCount: number;
  skippedCount: number;
  conflictCount: number;
  failedCount: number;
  errors: Array<{ docId?: string; reason: string }>;
}
