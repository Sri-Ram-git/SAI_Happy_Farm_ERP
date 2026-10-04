import { FarmDoc } from './farmDataService';
export type RecordType = 'DAILY_REPORT' | 'FEED_LOAD' | 'FLOCK_RECORD';
export type StandardFieldKey = 'submissionDate' | 'farmId' | 'flockId' | 'weekNumber' | 'birdCount' | 'feedKg' | 'feedGrams' | 'feedGramsPerBird' | 'mortality' | 'culling' | 'eggsProduced' | 'selectionEggs' | 'damagedEggs' | 'floorEggs' | 'actualProductionPct' | 'standardProductionPct' | 'temperature' | 'tempMin' | 'tempMax' | 'ammoniaPpm' | 'eggWeightMin' | 'eggWeightMax' | 'eggWeightAvg' | 'bodyWeightMin' | 'bodyWeightMax' | 'bodyWeightAvg' | 'remarks' | 'feedLoadQuantityKg' | 'feedLoadNotes' | 'flockName' | 'initialBirds' | 'startDate' | 'breedType' | 'ignore';
export interface FieldDefinition {
    key: StandardFieldKey;
    label: string;
    category: 'core' | 'birds' | 'feed' | 'production' | 'environment' | 'weights' | 'other';
    required?: boolean;
    type: 'date' | 'string' | 'number';
    synonyms: string[];
}
export declare const STANDARD_FIELDS: FieldDefinition[];
export interface ColumnMapping {
    fileHeader: string;
    mappedField: StandardFieldKey;
    confidence: 'HIGH' | 'MEDIUM' | 'AMBIGUOUS' | 'UNMAPPED';
    sampleValues: string[];
}
export interface ParsedRawRow {
    rowNumber: number;
    data: Record<string, string>;
}
export interface ParsedFile {
    id: string;
    file: File;
    name: string;
    size: number;
    format: 'CSV' | 'XML' | 'XLSX';
    sheetName?: string;
    workbookSheets?: string[];
    isSelectedSheet?: boolean;
    isHiddenSheet?: boolean;
    isReferenceSheet?: boolean;
    isTransposed?: boolean;
    dateRange?: {
        minDate: string;
        maxDate: string;
    };
    parentFileName?: string;
    headers: string[];
    mappings: ColumnMapping[];
    rawRows: ParsedRawRow[];
    assignedFarmId?: string;
    dateFormatPreference?: 'AUTO' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    detectedRecordType: RecordType;
    status: 'PARSED' | 'ERROR';
    errorMessage?: string;
    formulaWarningsCount?: number;
    totalFormulaCount?: number;
    formulaErrorCount?: number;
    unusualLayoutWarning?: string;
    ignoredNonDataRows?: Array<{
        rowIdx: number;
        label: string;
        reason: string;
    }>;
    detectedFarmFromSheet?: string;
    detectedFarmFromFilename?: string;
    farmConflict?: {
        sheetFarm?: string;
        filenameFarm?: string;
        reason: string;
    };
}
export interface ValidatedRow {
    fileId: string;
    fileName: string;
    rowNumber: number;
    recordType: RecordType;
    farmId: string;
    submissionDate: string;
    rawDate: string;
    weekNumber?: string | number;
    weekLabel?: string;
    birdCount?: number;
    openingBirdCount?: number;
    closingBirdCount?: number;
    feedKg?: number;
    feedGrams?: number;
    feedGramsPerBird?: number;
    mortality?: number;
    culling?: number;
    eggsProduced?: number;
    selectionEggs?: number;
    damagedEggs?: number;
    floorEggs?: number;
    actualProductionPct?: number;
    standardProductionPct?: number;
    temperature?: number | null;
    ammoniaPpm?: number | null;
    eggWeight?: {
        min: number;
        max: number;
        avg: number;
    };
    bodyWeight?: {
        min: number;
        max: number;
        avg: number;
    };
    remarks?: string;
    flockId?: string;
    feedLoadQuantityKg?: number;
    feedLoadNotes?: string;
    isValid: boolean;
    errors: Array<{
        field: string;
        value: any;
        reason: string;
    }>;
    warnings?: Array<{
        field: string;
        message: string;
    }>;
    conflictStatus?: 'NEW' | 'EXACT_DUPLICATE' | 'CONFLICT';
    existingRecord?: Record<string, any>;
    diff?: Record<string, {
        existing: any;
        proposed: any;
    }>;
    isExcluded?: boolean;
}
export interface ValidationSummary {
    totalFiles: number;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    exactDuplicates: number;
    conflicts: number;
    newRecords: number;
    unmappedColumnsCount: number;
}
/**
 * Parses CSV content, identifying header row even if title rows precede it.
 */
export declare function parseCsvContent(content: string, filename: string): {
    headers: string[];
    rows: ParsedRawRow[];
};
/**
 * Parses XML content using browser DOMParser.
 */
export declare function parseXmlContent(content: string, _filename: string): {
    headers: string[];
    rows: ParsedRawRow[];
};
/**
 * Accurately converts an Excel numeric serial date (e.g. 45321) to an ISO string YYYY-MM-DD.
 * Accounts for Excel's 1900 leap year bug using standard epoch offset (25569 days between 1899-12-30 and 1970-01-01).
 * Uses UTC to ensure date stability regardless of client timezone.
 */
export declare function excelSerialToIsoDate(serial: number): string | null;
export interface FarmResolutionResult {
    farmId?: string;
    isAmbiguous?: boolean;
    reason?: string;
}
/**
 * Resolves a raw farm identifier string against existing active farm records.
 * Supports exact farmId, farm name, and verified aliases (e.g. "Farm Alpha 12", "AP 12", "Happy Farm 12").
 * Never silently assigns an unmatched record to another farm.
 */
export declare function resolveFarmId(rawInput: string | undefined, existingFarms: FarmDoc[] | string[], fallbackAssignedFarmId?: string): FarmResolutionResult;
/**
 * Detects likely farm codes (e.g. 'AP12', 'AP-13', 'Farm Alpha 12') from sheet names or metadata cells.
 */
export declare function detectFarmFromText(text: string, knownFarms?: string[] | FarmDoc[]): string | undefined;
export interface XlsxWorksheetInfo {
    sheetName: string;
    isHidden: boolean;
    isEmpty: boolean;
    isReferenceSheet?: boolean;
    isTransposed?: boolean;
    dateRange?: {
        minDate: string;
        maxDate: string;
    };
    headers: string[];
    rows: ParsedRawRow[];
    detectedFarmId?: string;
    detectedRecordType: RecordType;
    mappings: ColumnMapping[];
    unusualLayoutWarning?: string;
    hasFormulas?: boolean;
    formulaWarningCount?: number;
    totalFormulaCount?: number;
    formulaErrorCount?: number;
    ignoredNonDataRows?: Array<{
        rowIdx: number;
        label: string;
        reason: string;
    }>;
    totalRawRowsCount?: number;
    detectedFarmFromSheet?: string;
    detectedFarmFromFilename?: string;
    farmConflict?: {
        sheetFarm?: string;
        filenameFarm?: string;
        reason: string;
    };
}
/**
 * Parses an Excel (.xlsx) workbook from ArrayBuffer or Uint8Array.
 * Extracts all worksheets, detects horizontal/transposed farm sheets vs standard vertical sheets,
 * detects hidden and standard curve sheets, inspects formulas and cached values,
 * accurately handles Excel date cells and serial numbers without timezone shifts,
 * ignores empty rows/columns, and identifies verified farm codes.
 */
export declare function parseXlsxWorkbook(data: ArrayBuffer | Uint8Array, _filename: string, knownFarmIds?: string[] | FarmDoc[]): XlsxWorksheetInfo[];
/**
 * Copies column mappings from a source worksheet to target worksheets that have matching headers.
 */
export declare function applyMappingToMatchingFiles(sourceMappings: ColumnMapping[], sourceHeaders: string[], targetFiles: ParsedFile[]): {
    updatedCount: number;
    updatedFileIds: string[];
};
export declare function detectColumnMappings(headers: string[], sampleRows: ParsedRawRow[]): {
    mappings: ColumnMapping[];
    detectedType: RecordType;
};
export declare function parseFlexibleDate(rawVal: string, preference?: 'AUTO' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD', formatPattern?: string): {
    isoDate: string | null;
    error?: string;
};
export declare function parseNumberField(val: string | undefined): number | undefined;
export declare function validateParsedFile(parsedFile: ParsedFile, existingFarms: FarmDoc[]): ValidatedRow[];
export declare function checkServerConflicts(rows: ValidatedRow[]): Promise<ValidatedRow[]>;
/**
 * Recursively sanitizes data before writing to Firestore.
 * Converts any `undefined` properties to `null` to prevent Firebase JS SDK error:
 * "Unsupported field value: undefined".
 */
export declare function sanitizeFirestoreData<T>(data: T): T;
export interface ImportExecutionOptions {
    dryRun?: boolean;
}
export interface ExecuteImportClientResult {
    batchId: string;
    totalProcessed: number;
    importedCount: number;
    skippedCount: number;
    duplicateCount: number;
    conflictCount: number;
    failedCount: number;
    errors: Array<{
        file: string;
        row: number;
        reason: string;
    }>;
    worksheets?: WorksheetImportContribution[];
    status: 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED' | 'SIMULATED';
    isDryRun?: boolean;
    historyWriteFailed?: boolean;
    historyWriteError?: string;
    rawBatchRecord?: any;
}
export declare function executeHistoricalImport(validatedRows: ValidatedRow[], conflictAction: 'skip' | 'replace', onProgress?: (progress: {
    currentBatch: number;
    totalBatches: number;
    percentage: number;
}) => void, options?: ImportExecutionOptions): Promise<ExecuteImportClientResult>;
/**
 * Saves or retries saving an import batch audit record directly to Firestore.
 */
export declare function saveImportBatchRecord(batchRecord: any): Promise<void>;
export declare function fetchImportBatches(): Promise<any[]>;
export declare function generateErrorReportCsv(errors: Array<{
    file: string;
    row: number;
    field?: string;
    reason: string;
}>): string;
export type RevertBatchStatus = 'NOT_REVERTED' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'REVERTING' | 'REVERTED' | 'PARTIALLY_REVERTED' | 'REVERT_FAILED' | 'REVERT_REQUIRES_REVIEW' | 'REVERT_CONFLICT' | 'NOT_REVERSIBLE';
export interface WorksheetImportContribution {
    worksheetKey: string;
    fileName: string;
    sourceFile?: string;
    sheetName?: string | null;
    farmId?: string;
    status: 'IMPORTED' | 'IMPORTED_WITH_ERRORS' | 'PARTIALLY_REVERTED' | 'REVERTED' | 'REVERT_FAILED' | 'REVERT_CONFLICT';
    importedCount: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    dateRange?: {
        minDate: string;
        maxDate: string;
    } | null;
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
    errors: Array<{
        docId?: string;
        reason: string;
    }>;
    worksheets?: WorksheetImportContribution[];
    updatedBatch?: any;
}
export declare function fetchRevertPreview(batchId: string, worksheetKey?: string): Promise<RevertPreviewResponse>;
export declare function executeRevertImportBatch(batchId: string, confirmationBatchId: string, worksheetKey?: string): Promise<RevertBatchResponse>;
/**
 * Extracts or synthesizes worksheet contributions from an import batch document.
 */
export declare function getBatchWorksheets(batch: any): WorksheetImportContribution[];
//# sourceMappingURL=historicalImportService.d.ts.map