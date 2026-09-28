import * as XLSX from 'xlsx';
import { db, auth } from '../config/firebase';
import { FarmDoc } from './farmDataService';

export type RecordType = 'DAILY_REPORT' | 'FEED_LOAD' | 'FLOCK_RECORD';

export type StandardFieldKey =
  | 'submissionDate'
  | 'farmId'
  | 'flockId'
  | 'weekNumber'
  | 'birdCount'
  | 'feedKg'
  | 'feedGrams'
  | 'mortality'
  | 'culling'
  | 'eggsProduced'
  | 'selectionEggs'
  | 'damagedEggs'
  | 'floorEggs'
  | 'actualProductionPct'
  | 'standardProductionPct'
  | 'temperature'
  | 'tempMin'
  | 'tempMax'
  | 'ammoniaPpm'
  | 'eggWeightMin'
  | 'eggWeightMax'
  | 'eggWeightAvg'
  | 'bodyWeightMin'
  | 'bodyWeightMax'
  | 'bodyWeightAvg'
  | 'remarks'
  | 'feedLoadQuantityKg'
  | 'feedLoadNotes'
  | 'flockName'
  | 'initialBirds'
  | 'startDate'
  | 'breedType'
  | 'ignore';

export interface FieldDefinition {
  key: StandardFieldKey;
  label: string;
  category: 'core' | 'birds' | 'feed' | 'production' | 'environment' | 'weights' | 'other';
  required?: boolean;
  type: 'date' | 'string' | 'number';
  synonyms: string[];
}

export const STANDARD_FIELDS: FieldDefinition[] = [
  {
    key: 'submissionDate',
    label: 'Report Date',
    category: 'core',
    required: true,
    type: 'date',
    synonyms: ['date', 'report date', 'reporting date', 'submission date', 'log date', 'entry date', 'dt', 'day', 'record date'],
  },
  {
    key: 'farmId',
    label: 'Farm ID / Code',
    category: 'core',
    required: true,
    type: 'string',
    synonyms: ['farm', 'farm id', 'farmid', 'farm code', 'farm name', 'shed', 'shed id', 'unit', 'unit id', 'location', 'farm no'],
  },
  {
    key: 'flockId',
    label: 'Flock / Batch ID',
    category: 'core',
    type: 'string',
    synonyms: ['flock', 'flock id', 'flockid', 'batch', 'batch id', 'batch no', 'batch number', 'flock name', 'lot'],
  },
  {
    key: 'weekNumber',
    label: 'Week Number / Age',
    category: 'core',
    type: 'string',
    synonyms: ['weeks', 'week', 'week no', 'week number', 'age', 'age (weeks)', 'age in weeks', 'wk'],
  },
  {
    key: 'birdCount',
    label: 'Bird Count (Closing / Total)',
    category: 'birds',
    type: 'number',
    synonyms: [
      'birds', 'bird count', 'no. of birds', 'no of birds', 'no.of birds', 'number of birds', 'total birds',
      'closing birds', 'live birds', 'count', 'closing bird count', 'clsg brd', 'birds remaining', 'opening birds'
    ],
  },
  {
    key: 'feedKg',
    label: 'Feed Consumed (Kg)',
    category: 'feed',
    type: 'number',
    synonyms: [
      'feed', 'feed kg', 'feed (kg)', 'feed kgs', 'feed consumed', 'feed usage', 'feed used', 'feed consumed (kg)',
      'daily feed (kg)', 'total feed kg', 'feed consumed kg', 'fd kg'
    ],
  },
  {
    key: 'feedGrams',
    label: 'Feed Consumed (Grams / Bird)',
    category: 'feed',
    type: 'number',
    synonyms: [
      'feed (g)', 'feed g', 'feed grams', 'feed (grams)', 'feed/bird', 'feed per bird',
      'feed gms/bird', 'feed gms per bird', 'feed g/bird', 'g/bird', 'grams'
    ],
  },
  {
    key: 'mortality',
    label: 'Mortality (Dead Birds)',
    category: 'birds',
    type: 'number',
    synonyms: ['mortality', 'dead', 'deaths', 'mort', 'mortality count', 'bird deaths', 'dead birds', 'mor'],
  },
  {
    key: 'culling',
    label: 'Culling (Rejected Birds)',
    category: 'birds',
    type: 'number',
    synonyms: ['culling', 'culled', 'cull', 'rejected birds', 'culls', 'culling count', 'rejected'],
  },
  {
    key: 'eggsProduced',
    label: 'Eggs Produced',
    category: 'production',
    type: 'number',
    synonyms: [
      'eggs', 'egg production', 'total eggs', 'eggs produced', 'production', 'egg count',
      'eggs collected', 'prod', 'daily eggs', 'total egg production'
    ],
  },
  {
    key: 'selectionEggs',
    label: 'Selection Eggs (Graded / Waste)',
    category: 'production',
    type: 'number',
    synonyms: [
      'selection eggs', 'selection', 'selected eggs', 'waste eggs',
      'hatching eggs', 'graded eggs', 'selection egg', 'sel'
    ],
  },
  {
    key: 'damagedEggs',
    label: 'Damaged / Rejected Eggs',
    category: 'production',
    type: 'number',
    synonyms: [
      'damage/rejected', 'damage', 'damaged', 'damaged eggs', 'damaged count',
      'damage count', 'rejected eggs', 'broken eggs', 'dmg'
    ],
  },
  {
    key: 'floorEggs',
    label: 'Floor Eggs',
    category: 'production',
    type: 'number',
    synonyms: ['floor eggs', 'floor egg', 'floor'],
  },
  {
    key: 'actualProductionPct',
    label: 'Actual Production %',
    category: 'production',
    type: 'number',
    synonyms: ['act %', 'act pct', 'actual %', 'actual production %', 'prod %', 'actual rate'],
  },
  {
    key: 'standardProductionPct',
    label: 'Standard Production %',
    category: 'production',
    type: 'number',
    synonyms: ['std %', 'std pct', 'standard %', 'standard production %', 'std rate'],
  },
  {
    key: 'temperature',
    label: 'Shed Temperature (°C)',
    category: 'environment',
    type: 'number',
    synonyms: ['temperature', 'temp', 'shed temp', 'temp (°c)', 'temperature (c)', 'temp (c)', 'ambient temp'],
  },
  {
    key: 'ammoniaPpm',
    label: 'Ammonia (PPM)',
    category: 'environment',
    type: 'number',
    synonyms: ['ammonia', 'ammonia (ppm)', 'ammonia ppm', 'nh3', 'ammonia level', 'ammonia test'],
  },
  {
    key: 'eggWeightAvg',
    label: 'Average Egg Weight (g)',
    category: 'weights',
    type: 'number',
    synonyms: ['egg weight', 'egg wt', 'avg egg weight', 'egg weight (g)', 'average egg weight', 'egg wt (g)'],
  },
  {
    key: 'bodyWeightAvg',
    label: 'Average Body Weight (g)',
    category: 'weights',
    type: 'number',
    synonyms: ['body weight', 'body wt', 'avg body weight', 'bird weight', 'average body weight', 'body wt (g)'],
  },
  {
    key: 'remarks',
    label: 'Remarks / Notes',
    category: 'other',
    type: 'string',
    synonyms: ['remarks', 'notes', 'comments', 'observation', 'observations', 'reason', 'note'],
  },
  {
    key: 'feedLoadQuantityKg',
    label: 'Feed Delivery (Kg)',
    category: 'feed',
    type: 'number',
    synonyms: ['feed load', 'feed loaded', 'feed delivery', 'delivery kg', 'quantity kg', 'load kg', 'feed received'],
  },
  {
    key: 'feedLoadNotes',
    label: 'Feed Delivery Notes',
    category: 'feed',
    type: 'string',
    synonyms: ['delivery notes', 'invoice no', 'feed supplier', 'feed type', 'truck no'],
  },
];

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
  dateRange?: { minDate: string; maxDate: string };
  parentFileName?: string;
  headers: string[];
  mappings: ColumnMapping[];
  rawRows: ParsedRawRow[];
  assignedFarmId?: string; // Fallback if file has no farm column
  dateFormatPreference?: 'AUTO' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  detectedRecordType: RecordType;
  status: 'PARSED' | 'ERROR';
  errorMessage?: string;
  formulaWarningsCount?: number;
  unusualLayoutWarning?: string;
}

export interface ValidatedRow {
  fileId: string;
  fileName: string;
  rowNumber: number;
  recordType: RecordType;
  farmId: string;
  submissionDate: string; // ISO YYYY-MM-DD
  rawDate: string;
  weekNumber?: string | number;
  birdCount?: number;
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
  eggWeight?: { min: number; max: number; avg: number };
  bodyWeight?: { min: number; max: number; avg: number };
  remarks?: string;
  flockId?: string;
  feedLoadQuantityKg?: number;
  feedLoadNotes?: string;
  isValid: boolean;
  errors: Array<{ field: string; value: any; reason: string }>;
  warnings?: Array<{ field: string; message: string }>;
  conflictStatus?: 'NEW' | 'EXACT_DUPLICATE' | 'CONFLICT';
  existingRecord?: Record<string, any>;
  diff?: Record<string, { existing: any; proposed: any }>;
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

// ==========================================
// PARSING UTILITIES (CSV & XML)
// ==========================================

function normalizeHeaderStr(str: string): string {
  return str
    .toLowerCase()
    .replace(/^\uFEFF/, '') // Strip UTF-8 BOM
    .replace(/[_\-\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects CSV delimiter (, ; \t |)
 */
function detectDelimiter(text: string): string {
  const lines = text.slice(0, 5000).split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return ',';

  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  const sample = lines.slice(0, 5);

  sample.forEach((line) => {
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuote = !inQuote;
      if (!inQuote && counts[char] !== undefined) {
        counts[char]++;
      }
    }
  });

  let best = ',';
  let max = -1;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      best = delim;
    }
  }
  return best;
}

/**
 * Robust CSV Line Parser handling quotes, escaped quotes (""), and custom delimiters.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuote = !inQuote;
      }
    } else if (char === delimiter && !inQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses CSV content, identifying header row even if title rows precede it.
 */
export function parseCsvContent(content: string, filename: string): { headers: string[]; rows: ParsedRawRow[] } {
  const cleanContent = content.replace(/^\uFEFF/, '');
  const rawLines = cleanContent.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const delimiter = detectDelimiter(cleanContent);

  // Scan the first 5 lines to find the true header row by matching against known terms
  let headerRowIndex = 0;
  let maxMatchScore = -1;

  const matchCandidates = rawLines.slice(0, 5);
  matchCandidates.forEach((line, idx) => {
    const cols = parseCsvLine(line, delimiter).map(normalizeHeaderStr);
    let score = 0;
    cols.forEach((col) => {
      STANDARD_FIELDS.forEach((f) => {
        if (f.synonyms.some((syn) => col === syn || col.includes(syn))) {
          score += 2;
        }
      });
    });
    if (score > maxMatchScore) {
      maxMatchScore = score;
      headerRowIndex = idx;
    }
  });

  const rawHeaderCols = parseCsvLine(rawLines[headerRowIndex] || '', delimiter);
  // Ensure header names are unique and non-empty
  const headers: string[] = rawHeaderCols.map((h, i) => {
    const clean = h.trim();
    return clean.length > 0 ? clean : `Column_${i + 1}`;
  });

  const rows: ParsedRawRow[] = [];
  for (let i = headerRowIndex + 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line || !line.trim()) continue;
    const values = parseCsvLine(line, delimiter);
    const rowData: Record<string, string> = {};
    headers.forEach((h, hIdx) => {
      rowData[h] = values[hIdx] !== undefined ? values[hIdx] : '';
    });
    rows.push({
      rowNumber: i + 1,
      data: rowData,
    });
  }

  return { headers, rows };
}

/**
 * Parses XML content using browser DOMParser.
 */
export function parseXmlContent(content: string, _filename: string): { headers: string[]; rows: ParsedRawRow[] } {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(content, 'text/xml');

  const parseError = xmlDoc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new Error('Invalid XML document: ' + parseError[0]?.textContent);
  }

  // Find record elements
  const commonTags = ['record', 'row', 'report', 'entry', 'dailylog', 'log', 'item', 'submission'];
  let recordNodes: Element[] = [];

  for (const tag of commonTags) {
    const found = xmlDoc.getElementsByTagName(tag);
    if (found.length > 0) {
      recordNodes = Array.from(found);
      break;
    }
  }

  // Fallback: If no standard tag, pick children of root if uniform
  if (recordNodes.length === 0 && xmlDoc.documentElement) {
    const children = Array.from(xmlDoc.documentElement.children);
    if (children.length > 0) {
      recordNodes = children;
    }
  }

  if (recordNodes.length === 0) {
    throw new Error('No repeating record nodes found in XML');
  }

  const headerSet = new Set<string>();
  const parsedRows: Array<Record<string, string>> = [];

  recordNodes.forEach((node) => {
    const rowObj: Record<string, string> = {};

    // 1. Collect XML attributes
    if (node.attributes) {
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        if (attr) {
          headerSet.add(attr.name);
          rowObj[attr.name] = attr.value;
        }
      }
    }

    // 2. Collect XML child elements
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child) {
        const tag = child.tagName;
        headerSet.add(tag);
        rowObj[tag] = child.textContent?.trim() || '';
      }
    }

    parsedRows.push(rowObj);
  });

  const headers = Array.from(headerSet);
  const rows: ParsedRawRow[] = parsedRows.map((data, idx) => ({
    rowNumber: idx + 1,
    data,
  }));

  return { headers, rows };
}

// ==========================================
// EXCEL (.XLSX) PARSING UTILITIES
// ==========================================

/**
 * Accurately converts an Excel numeric serial date (e.g. 45321) to an ISO string YYYY-MM-DD.
 * Accounts for Excel's 1900 leap year bug using standard epoch offset (25569 days between 1899-12-30 and 1970-01-01).
 * Uses UTC to ensure date stability regardless of client timezone.
 */
export function excelSerialToIsoDate(serial: number): string | null {
  if (typeof serial !== 'number' || isNaN(serial) || serial < 1 || serial > 2958465) {
    return null;
  }
  // Days from 1899-12-30 to 1970-01-01 = 25569
  const utcDays = Math.floor(serial - 25569);
  const dateObj = new Date(utcDays * 86400 * 1000);
  const y = dateObj.getUTCFullYear();
  const m = dateObj.getUTCMonth() + 1;
  const d = dateObj.getUTCDate();
  if (!isValidDateParts(y, m, d)) return null;
  return formatDateParts(y, m, d);
}

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
export function resolveFarmId(
  rawInput: string | undefined,
  existingFarms: FarmDoc[] | string[],
  fallbackAssignedFarmId?: string,
): FarmResolutionResult {
  const farmList: FarmDoc[] = (existingFarms || []).map((f) =>
    typeof f === 'string' ? ({ farmId: f, name: f, active: true, location: '' } as FarmDoc) : f,
  );

  const clean = String(rawInput || '').trim();

  // If no row input, try fallback assigned farm if valid
  if (!clean && fallbackAssignedFarmId) {
    const fallbackMatch = farmList.find(
      (f) => f.farmId.toUpperCase() === fallbackAssignedFarmId.trim().toUpperCase(),
    );
    if (fallbackMatch) {
      return { farmId: fallbackMatch.farmId.toUpperCase() };
    }
  }

  if (!clean) {
    return { reason: 'Missing Farm ID (row has no farm identifier and no valid farm was assigned)' };
  }

  const upper = clean.toUpperCase();

  // 1. Exact match on farmId
  const directId = farmList.find((f) => f.farmId.toUpperCase() === upper);
  if (directId) {
    return { farmId: directId.farmId.toUpperCase() };
  }

  // 2. Exact match on farm name (e.g. "Farm Alpha 12", "AP12 Farm", "Happy Farm 12")
  const directName = farmList.find(
    (f) => f.name && f.name.trim().toUpperCase() === upper,
  );
  if (directName) {
    return { farmId: directName.farmId.toUpperCase() };
  }

  // 3. Normalize common poultry aliases:
  // e.g. "Farm Alpha 12", "Alpha 12", "AP 12", "Happy Farm 12", "Unit AP-12"
  const normalizedCandidate = clean
    .replace(/\b(?:farm|shed|unit|happy\s*farm)\b/gi, '')
    .replace(/\balpha\b/gi, 'AP')
    .replace(/[\s-_#:]+/g, '')
    .toUpperCase();

  if (normalizedCandidate) {
    const aliasMatch = farmList.find(
      (f) => f.farmId.toUpperCase() === normalizedCandidate,
    );
    if (aliasMatch) {
      return { farmId: aliasMatch.farmId.toUpperCase() };
    }
  }

  // 4. Numeric ending match (e.g. "12" if only AP12 exists among known farms)
  const numMatch = clean.match(/(\d{1,4})$/);
  if (numMatch && numMatch[1]) {
    const num = numMatch[1];
    const candidateFarms = farmList.filter(
      (f) => f.farmId.toUpperCase().endsWith(num) || (f.name && f.name.toUpperCase().includes(num)),
    );
    if (candidateFarms.length === 1) {
      return { farmId: candidateFarms[0]!.farmId.toUpperCase() };
    } else if (candidateFarms.length > 1) {
      return {
        isAmbiguous: true,
        reason: `Ambiguous farm identifier "${clean}". Matches multiple farms: ${candidateFarms.map((f) => f.farmId).join(', ')}`,
      };
    }
  }

  // 5. Unmatched - NEVER silently assign to another farm
  const validList = farmList.map((f) => f.farmId).join(', ');
  return {
    reason: `Unknown Farm ID "${clean}". Must match an existing active farm (${validList || 'None found'}) or verified alias.`,
  };
}

/**
 * Detects likely farm codes (e.g. 'AP12', 'AP-13', 'Farm Alpha 12') from sheet names or metadata cells.
 */
export function detectFarmFromText(
  text: string,
  knownFarms?: string[] | FarmDoc[],
): string | undefined {
  if (!text) return undefined;
  const clean = text.trim();

  const farmList: FarmDoc[] = (knownFarms || []).map((f) =>
    typeof f === 'string' ? ({ farmId: f, name: f, active: true, location: '' } as FarmDoc) : f,
  );

  const res = resolveFarmId(clean, farmList);
  if (res.farmId && !res.isAmbiguous) {
    return res.farmId;
  }

  // Generic fallback: match code pattern (AP12, AP-12, etc.)
  const genericMatch = clean.match(/\b(?:farm|shed|unit)?\s*[-_:]?\s*([A-Za-z]{2,4}\s*[-_]?\s*\d{1,4})\b/i);
  if (genericMatch && genericMatch[1]) {
    const rawCode = genericMatch[1].replace(/[\s-_]+/g, '').toUpperCase();
    if (farmList.length === 0 || farmList.some((f) => f.farmId.toUpperCase() === rawCode)) {
      return rawCode;
    }
  }

  // Check for "Alpha 12" -> "AP12"
  const alphaMatch = clean.match(/\balpha\s*[-_:]?\s*(\d{1,4})\b/i);
  if (alphaMatch && alphaMatch[1]) {
    const rawCode = `AP${alphaMatch[1]}`;
    if (farmList.length === 0 || farmList.some((f) => f.farmId.toUpperCase() === rawCode)) {
      return rawCode;
    }
  }

  return undefined;
}

export interface XlsxWorksheetInfo {
  sheetName: string;
  isHidden: boolean;
  isEmpty: boolean;
  isReferenceSheet?: boolean;
  isTransposed?: boolean;
  dateRange?: { minDate: string; maxDate: string };
  headers: string[];
  rows: ParsedRawRow[];
  detectedFarmId?: string;
  detectedRecordType: RecordType;
  mappings: ColumnMapping[];
  unusualLayoutWarning?: string;
  hasFormulas?: boolean;
  formulaWarningCount?: number;
  totalRawRowsCount?: number;
}

/**
 * Parses an Excel (.xlsx) workbook from ArrayBuffer or Uint8Array.
 * Extracts all worksheets, detects horizontal/transposed farm sheets vs standard vertical sheets,
 * detects hidden and standard curve sheets, inspects formulas and cached values,
 * accurately handles Excel date cells and serial numbers without timezone shifts,
 * ignores empty rows/columns, and identifies verified farm codes.
 */
export function parseXlsxWorkbook(
  data: ArrayBuffer | Uint8Array,
  _filename: string,
  knownFarmIds?: string[] | FarmDoc[],
): XlsxWorksheetInfo[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, {
      type: 'array',
      cellDates: true,
      cellNF: true,
      cellFormula: true,
    });
  } catch (err: any) {
    throw new Error(`Failed to read Excel workbook: ${err.message || 'Corrupted or unsupported format'}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel workbook contains no worksheets');
  }

  const results: XlsxWorksheetInfo[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheetMeta = (workbook.Workbook?.Sheets || []).find((s: any) => s.name === sheetName);
    const isHidden = Boolean(sheetMeta?.Hidden === 1 || sheetMeta?.Hidden === 2);

    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws['!ref']) {
      // Empty sheet
      results.push({
        sheetName,
        isHidden,
        isEmpty: true,
        headers: [],
        rows: [],
        detectedRecordType: 'DAILY_REPORT',
        mappings: [],
        unusualLayoutWarning: 'Worksheet is completely empty',
      });
      continue;
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    let hasFormulas = false;
    let formulaWarningCount = 0;

    // Detect farm ID from sheet name
    let detectedFarmId = detectFarmFromText(sheetName, knownFarmIds);

    // Check if worksheet is a reference standard curve (e.g. "CF STD", "FR STD", "Standard Curve")
    const isReferenceSheet = /^(?:cf|fr)?\s*(?:std|standard|curve|template)\b/i.test(sheetName.trim());

    // -------------------------------------------------------------
    // TRANSPOSED (HORIZONTAL LAYOUT) DETECTION
    // Handles customer spreadsheets where metrics are in rows and dates in columns
    // -------------------------------------------------------------
    const metricKeywords = ['week', 'bird', 'prod', 'select', 'damage', 'mort', 'temp', 'feed', 'act %', 'std %', 'date'];
    let bestLabelCol = -1;
    let bestScore = 0;

    for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 2); c++) {
      let score = 0;
      for (let r = range.s.r; r <= range.e.r; r++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        const val = String(cell ? (cell.w || cell.v || '') : '').toLowerCase().trim();
        if (metricKeywords.some((k) => val === k || val.includes(k))) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestLabelCol = c;
      }
    }

    let dateRowIdx: number | null = null;
    if (bestScore >= 3 && bestLabelCol >= 0) {
      for (let r = range.s.r; r <= range.e.r; r++) {
        let dateCount = 0;
        for (let c = bestLabelCol + 1; c <= Math.min(range.e.c, bestLabelCol + 15); c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr];
          if (!cell) continue;
          if (cell.t === 'd' || cell.v instanceof Date) {
            dateCount++;
          } else if (cell.t === 'n' && typeof cell.v === 'number' && cell.z && XLSX.SSF.is_date(cell.z)) {
            dateCount++;
          } else if (typeof cell.v === 'string' && /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(cell.v.trim())) {
            dateCount++;
          } else if (cell.w && /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(cell.w.trim())) {
            dateCount++;
          }
        }
        if (dateCount >= 2) {
          dateRowIdx = r;
          break;
        }
      }
    }

    const isTransposed = bestScore >= 3 && dateRowIdx !== null;

    if (isTransposed) {
      // 1. Collect metric rows
      const metricRows: Array<{ rowIdx: number; label: string }> = [];
      const usedLabels = new Set<string>();

      for (let r = range.s.r; r <= range.e.r; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: bestLabelCol });
        const cell = ws[addr];
        let label = cell ? String(cell.w || cell.v || '').trim() : '';
        if (r === dateRowIdx && !label) {
          label = 'Date';
        }
        if (label) {
          let uniqueLabel = label;
          let counter = 1;
          while (usedLabels.has(uniqueLabel.toLowerCase())) {
            uniqueLabel = `${label}_${counter++}`;
          }
          usedLabels.add(uniqueLabel.toLowerCase());
          metricRows.push({ rowIdx: r, label: uniqueLabel });
        }
      }

      const headers = metricRows.map((m) => m.label);
      const rows: ParsedRawRow[] = [];
      let minDate: string | undefined;
      let maxDate: string | undefined;

      for (let c = bestLabelCol + 1; c <= range.e.c; c++) {
        const rowData: Record<string, string> = {};
        let colHasData = false;

        metricRows.forEach(({ rowIdx, label }) => {
          const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
          const cell = ws[addr];
          if (!cell || cell.v === undefined || cell.v === null) {
            rowData[label] = '';
            return;
          }

          let formatted = '';
          if (cell.f) {
            hasFormulas = true;
            if (cell.t === 'e' || (typeof cell.v === 'string' && cell.v.startsWith('#'))) {
              formulaWarningCount++;
              formatted = String(cell.v || '#ERROR');
            }
          }

          if (!formatted) {
            if (cell.w !== undefined && /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$|^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(cell.w.trim())) {
              const parsed = parseFlexibleDate(cell.w.trim());
              formatted = parsed.isoDate || cell.w.trim();
            } else if (cell.t === 'd' || cell.v instanceof Date) {
              if (cell.w && /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(cell.w.trim())) {
                const parsed = parseFlexibleDate(cell.w.trim());
                formatted = parsed.isoDate || cell.w.trim();
              } else {
                const d = cell.v as Date;
                formatted = formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
              }
            } else if (cell.t === 'n' && typeof cell.v === 'number' && cell.z && XLSX.SSF.is_date(cell.z)) {
              formatted = excelSerialToIsoDate(cell.v) || (cell.w ? String(cell.w).trim() : String(cell.v));
            } else if (typeof cell.v === 'number' && label.toLowerCase().includes('week')) {
              formatted = String(Number(cell.v.toFixed(1)));
            } else if (cell.w !== undefined) {
              formatted = String(cell.w).trim();
            } else {
              formatted = String(cell.v).trim();
            }
          }

          if (formatted) colHasData = true;
          if (rowIdx === dateRowIdx && formatted && /^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
            if (!minDate || formatted < minDate) minDate = formatted;
            if (!maxDate || formatted > maxDate) maxDate = formatted;
          }

          rowData[label] = formatted;
        });

        if (colHasData) {
          rows.push({
            rowNumber: c + 1,
            data: rowData,
          });
        }
      }

      const { mappings, detectedType } = detectColumnMappings(headers, rows);

      results.push({
        sheetName,
        isHidden,
        isEmpty: rows.length === 0,
        isReferenceSheet,
        isTransposed: true,
        dateRange: minDate && maxDate ? { minDate, maxDate } : undefined,
        headers,
        rows,
        detectedFarmId,
        detectedRecordType: detectedType,
        mappings,
        unusualLayoutWarning: 'Transposed horizontal layout detected and normalized (metrics in rows, dates in columns)',
        hasFormulas,
        formulaWarningCount,
        totalRawRowsCount: rows.length,
      });

      continue;
    }

    // -------------------------------------------------------------
    // STANDARD VERTICAL LAYOUT (Row-oriented table)
    // -------------------------------------------------------------
    const rawMatrix: Array<{ rowNum: number; cells: Array<{ formatted: string; raw: any; formula?: string; isError?: boolean }> }> = [];

    for (let r = range.s.r; r <= range.e.r; r++) {
      let rowHasContent = false;
      const rowCells: Array<{ formatted: string; raw: any; formula?: string; isError?: boolean }> = [];

      for (let c = range.s.c; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        const cell = ws[address];

        if (!cell) {
          rowCells.push({ formatted: '', raw: null });
          continue;
        }

        let formatted = '';
        const raw = cell.v;
        let formula: string | undefined;
        let isError = false;

        if (cell.f) {
          hasFormulas = true;
          formula = cell.f;
          if (cell.t === 'e' || (typeof cell.v === 'string' && cell.v.startsWith('#'))) {
            formulaWarningCount++;
            isError = true;
            formatted = String(cell.v || '#ERROR');
          }
        }

        if (!isError) {
          if (cell.w !== undefined && /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$|^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(cell.w.trim())) {
            const parsed = parseFlexibleDate(cell.w.trim());
            formatted = parsed.isoDate || cell.w.trim();
          } else if (cell.t === 'd' || cell.v instanceof Date) {
            if (cell.w && /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(cell.w.trim())) {
              const parsed = parseFlexibleDate(cell.w.trim());
              formatted = parsed.isoDate || cell.w.trim();
            } else {
              const d = cell.v as Date;
              formatted = formatDateParts(d.getFullYear(), d.getMonth() + 1, d.getDate());
            }
          } else if (cell.t === 'n' && typeof cell.v === 'number' && cell.z && XLSX.SSF.is_date(cell.z)) {
            const iso = excelSerialToIsoDate(cell.v);
            formatted = iso || (cell.w ? String(cell.w).trim() : String(cell.v));
          } else if (cell.w !== undefined) {
            formatted = String(cell.w).trim();
          } else if (cell.v !== undefined && cell.v !== null) {
            formatted = String(cell.v).trim();
          }
        }

        if (formatted.length > 0) {
          rowHasContent = true;
        }

        rowCells.push({ formatted, raw, formula, isError });
      }

      // Skip completely empty rows
      if (rowHasContent) {
        rawMatrix.push({ rowNum: r + 1, cells: rowCells });
      }
    }

    if (rawMatrix.length === 0) {
      results.push({
        sheetName,
        isHidden,
        isEmpty: true,
        headers: [],
        rows: [],
        detectedRecordType: 'DAILY_REPORT',
        mappings: [],
        unusualLayoutWarning: 'All rows in this sheet are empty',
      });
      continue;
    }

    // Check top 3 rows for farm ID if not detected from sheet name
    if (!detectedFarmId) {
      for (let i = 0; i < Math.min(3, rawMatrix.length); i++) {
        const text = rawMatrix[i]!.cells.map((c) => c.formatted).join(' ');
        const found = detectFarmFromText(text, knownFarmIds);
        if (found) {
          detectedFarmId = found;
          break;
        }
      }
    }

    // Detect header row by scanning first 10 rows for match against standard fields
    let bestHeaderIdx = 0;
    let maxMatchScore = -1;

    for (let i = 0; i < Math.min(10, rawMatrix.length); i++) {
      const candidateRow = rawMatrix[i]!;
      let score = 0;
      candidateRow.cells.forEach((cell) => {
        const norm = normalizeHeaderStr(cell.formatted);
        if (!norm) return;
        STANDARD_FIELDS.forEach((f) => {
          if (f.synonyms.some((syn) => norm === syn || norm.includes(syn))) {
            score += 2;
          }
        });
      });
      if (score > maxMatchScore) {
        maxMatchScore = score;
        bestHeaderIdx = i;
      }
    }

    // Header row found
    const headerRow = rawMatrix[bestHeaderIdx]!;
    const headerNames: string[] = [];
    const usedNames = new Set<string>();

    headerRow.cells.forEach((cell, idx) => {
      let name = cell.formatted.trim();
      if (!name) name = `Column_${idx + 1}`;
      // Deduplicate header names
      let finalName = name;
      let counter = 2;
      while (usedNames.has(finalName)) {
        finalName = `${name}_${counter}`;
        counter++;
      }
      usedNames.add(finalName);
      headerNames.push(finalName);
    });

    // Build ParsedRawRow[] for data rows after header row
    const dataRows: ParsedRawRow[] = [];
    let minDate: string | undefined;
    let maxDate: string | undefined;

    for (let i = bestHeaderIdx + 1; i < rawMatrix.length; i++) {
      const rowItem = rawMatrix[i]!;
      const rowData: Record<string, string> = {};
      let hasData = false;

      headerNames.forEach((header, colIdx) => {
        const cell = rowItem.cells[colIdx];
        const val = cell ? cell.formatted : '';
        if (val) hasData = true;
        rowData[header] = val;

        if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
          if (!minDate || val < minDate) minDate = val;
          if (!maxDate || val > maxDate) maxDate = val;
        }
      });

      if (hasData) {
        dataRows.push({
          rowNumber: rowItem.rowNum,
          data: rowData,
        });
      }
    }

    let unusualLayoutWarning: string | undefined;
    if (maxMatchScore <= 0) {
      unusualLayoutWarning = 'No standard headers recognized in this sheet. Please review column mappings carefully.';
    }

    const { mappings, detectedType } = detectColumnMappings(headerNames, dataRows);

    results.push({
      sheetName,
      isHidden,
      isEmpty: dataRows.length === 0,
      isReferenceSheet,
      isTransposed: false,
      dateRange: minDate && maxDate ? { minDate, maxDate } : undefined,
      headers: headerNames,
      rows: dataRows,
      detectedFarmId,
      detectedRecordType: detectedType,
      mappings,
      unusualLayoutWarning,
      hasFormulas,
      formulaWarningCount,
      totalRawRowsCount: dataRows.length,
    });
  }

  return results;
}

/**
 * Copies column mappings from a source worksheet to target worksheets that have matching headers.
 */
export function applyMappingToMatchingFiles(
  sourceMappings: ColumnMapping[],
  sourceHeaders: string[],
  targetFiles: ParsedFile[],
): { updatedCount: number; updatedFileIds: string[] } {
  const sourceHeaderSet = new Set(sourceHeaders.map(normalizeHeaderStr));
  let updatedCount = 0;
  const updatedFileIds: string[] = [];

  targetFiles.forEach((file) => {
    // Check if target file has overlapping headers
    const targetHeaderSet = new Set(file.headers.map(normalizeHeaderStr));
    let matchCount = 0;
    targetHeaderSet.forEach((h) => {
      if (sourceHeaderSet.has(h)) matchCount++;
    });

    // If at least 50% match or at least 3 headers match
    if (matchCount >= Math.min(3, targetHeaderSet.size)) {
      const newMappings = file.headers.map((targetHeader) => {
        const normTarget = normalizeHeaderStr(targetHeader);
        const matchedSource = sourceMappings.find(
          (m) => normalizeHeaderStr(m.fileHeader) === normTarget,
        );
        if (matchedSource && matchedSource.mappedField !== 'ignore') {
          return {
            ...matchedSource,
            fileHeader: targetHeader,
          };
        }
        // Keep existing mapping if not in source
        const existing = file.mappings.find((m) => m.fileHeader === targetHeader);
        return existing || {
          fileHeader: targetHeader,
          mappedField: 'ignore' as StandardFieldKey,
          confidence: 'UNMAPPED' as const,
          sampleValues: [],
        };
      });

      file.mappings = newMappings;
      updatedCount++;
      updatedFileIds.push(file.id);
    }
  });

  return { updatedCount, updatedFileIds };
}

// ==========================================
// COLUMN MAPPING DETECTOR
// ==========================================

export function detectColumnMappings(
  headers: string[],
  sampleRows: ParsedRawRow[],
): { mappings: ColumnMapping[]; detectedType: RecordType } {
  let isFeedLoadCandidate = false;
  let isFlockCandidate = false;

  const mappings: ColumnMapping[] = headers.map((header) => {
    const normalized = normalizeHeaderStr(header);
    const sampleValues = sampleRows
      .slice(0, 5)
      .map((r) => r.data[header] || '')
      .filter((v) => v.length > 0);

    let bestMatch: StandardFieldKey = 'ignore';
    let highestConfidence: 'HIGH' | 'MEDIUM' | 'AMBIGUOUS' | 'UNMAPPED' = 'UNMAPPED';

    for (const field of STANDARD_FIELDS) {
      // 1. Exact match with standard synonyms
      if (field.synonyms.includes(normalized)) {
        bestMatch = field.key;
        highestConfidence = 'HIGH';
        break;
      }
      // 2. Substring match
      if (field.synonyms.some((syn) => normalized.includes(syn) || syn.includes(normalized))) {
        bestMatch = field.key;
        highestConfidence = 'MEDIUM';
      }
    }

    if (bestMatch === 'feedLoadQuantityKg') isFeedLoadCandidate = true;
    if (bestMatch === 'flockName' || bestMatch === 'initialBirds') isFlockCandidate = true;

    return {
      fileHeader: header,
      mappedField: bestMatch,
      confidence: highestConfidence,
      sampleValues,
    };
  });

  let detectedType: RecordType = 'DAILY_REPORT';
  if (isFeedLoadCandidate) detectedType = 'FEED_LOAD';
  else if (isFlockCandidate) detectedType = 'FLOCK_RECORD';

  return { mappings, detectedType };
}

// ==========================================
// DATE & NUMBER PARSERS
// ==========================================

export function parseFlexibleDate(
  rawVal: string,
  preference: 'AUTO' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' = 'AUTO',
): { isoDate: string | null; error?: string } {
  if (!rawVal || !rawVal.trim()) {
    return { isoDate: null, error: 'Empty date' };
  }

  const clean = rawVal.trim();

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1] || '0', 10);
    const m = parseInt(isoMatch[2] || '0', 10);
    const d = parseInt(isoMatch[3] || '0', 10);
    if (isValidDateParts(y, m, d)) {
      return { isoDate: formatDateParts(y, m, d) };
    }
  }

  // 2. Textual month: 05-Jan-2026 or 5 January 2026
  const textMonthMatch = clean.match(/^(\d{1,2})[-/\s]([A-Za-z]+)[-/\s](\d{4})$/);
  if (textMonthMatch) {
    const d = parseInt(textMonthMatch[1] || '0', 10);
    const mStr = (textMonthMatch[2] || '').toLowerCase().slice(0, 3);
    const y = parseInt(textMonthMatch[3] || '0', 10);
    const months: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };
    const m = months[mStr];
    if (m && isValidDateParts(y, m, d)) {
      return { isoDate: formatDateParts(y, m, d) };
    }
  }

  // 3. Delimited numbers: DD/MM/YYYY or MM/DD/YYYY
  const delMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (delMatch) {
    let p1 = parseInt(delMatch[1] || '0', 10);
    let p2 = parseInt(delMatch[2] || '0', 10);
    let y = parseInt(delMatch[3] || '0', 10);
    if (y < 100) y += 2000;

    let day = p1;
    let month = p2;

    if (preference === 'MM/DD/YYYY') {
      month = p1;
      day = p2;
    } else if (preference === 'DD/MM/YYYY') {
      day = p1;
      month = p2;
    } else {
      // AUTO detection:
      // If p1 > 12, it MUST be day -> DD/MM/YYYY
      if (p1 > 12) {
        day = p1;
        month = p2;
      }
      // If p2 > 12, it MUST be day -> MM/DD/YYYY
      else if (p2 > 12) {
        month = p1;
        day = p2;
      } else {
        // Standard Indian / British convention for Happy Farms is DD/MM/YYYY
        day = p1;
        month = p2;
      }
    }

    if (isValidDateParts(y, month, day)) {
      return { isoDate: formatDateParts(y, month, day) };
    }
  }

  // 4. Excel numeric serial date (e.g. 45321)
  const numVal = Number(clean);
  if (!isNaN(numVal) && numVal >= 20000 && numVal < 60000) {
    const iso = excelSerialToIsoDate(numVal);
    if (iso) return { isoDate: iso };
  }

  return { isoDate: null, error: `Invalid date format: "${clean}"` };
}

function isValidDateParts(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  // Verify actual calendar days in month
  const daysInMonth = new Date(y, m, 0).getDate();
  return d <= daysInMonth;
}

function formatDateParts(y: number, m: number, d: number): string {
  const mm = m < 10 ? `0${m}` : `${m}`;
  const dd = d < 10 ? `0${d}` : `${d}`;
  return `${y}-${mm}-${dd}`;
}

export function parseNumberField(val: string | undefined): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  const clean = String(val).replace(/,/g, '').replace(/%|kg|g|c|ppm/gi, '').trim();
  if (clean === '') return undefined;
  const num = Number(clean);
  return isNaN(num) ? undefined : num;
}

// ==========================================
// VALIDATION ENGINE
// ==========================================

export function validateParsedFile(
  parsedFile: ParsedFile,
  existingFarms: FarmDoc[],
): ValidatedRow[] {
  const farmIdSet = new Set(existingFarms.map((f) => f.farmId.toUpperCase()));
  const validatedRows: ValidatedRow[] = [];

  // Create lookup of header to mapped field
  const headerMap = new Map<string, StandardFieldKey>();
  parsedFile.mappings.forEach((m) => {
    if (m.mappedField !== 'ignore') {
      headerMap.set(m.fileHeader, m.mappedField);
    }
  });

  parsedFile.rawRows.forEach((rawRow) => {
    const rowErrors: Array<{ field: string; value: any; reason: string }> = [];
    const rowValues: Partial<Record<StandardFieldKey, any>> = {};

    // Extract values based on mapping
    for (const [header, val] of Object.entries(rawRow.data)) {
      const fieldKey = headerMap.get(header);
      if (fieldKey) {
        rowValues[fieldKey] = val;
      }
    }

    // 1. Resolve Farm ID using verified aliases and exact matches
    const rawFarm = String(rowValues.farmId || parsedFile.assignedFarmId || '').trim();
    const farmRes = resolveFarmId(rawFarm, existingFarms, parsedFile.assignedFarmId);
    let farmId = farmRes.farmId || '';

    if (!farmId) {
      rowErrors.push({
        field: 'farmId',
        value: rawFarm,
        reason: farmRes.reason || 'Missing or unknown Farm ID',
      });
    }

    // 2. Resolve & Validate Date
    const rawDate = String(rowValues.submissionDate || '').trim();
    let submissionDate = '';

    if (!rawDate) {
      rowErrors.push({
        field: 'submissionDate',
        value: rawDate,
        reason: 'Report Date is missing',
      });
    } else {
      const parsedDate = parseFlexibleDate(rawDate, parsedFile.dateFormatPreference);
      if (parsedDate.isoDate) {
        submissionDate = parsedDate.isoDate;
      } else {
        rowErrors.push({
          field: 'submissionDate',
          value: rawDate,
          reason: parsedDate.error || 'Invalid date',
        });
      }
    }

    const rowWarnings: Array<{ field: string; message: string }> = [];

    // Helper to validate and parse numeric fields
    const checkNumericField = (
      fieldName: string,
      rawVal: any,
      allowNegative = false,
      isFormulaErrorAllowed = false,
    ): number | undefined => {
      if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
        return undefined;
      }
      const strVal = String(rawVal).trim();
      if (isFormulaErrorAllowed && strVal.startsWith('#')) {
        return undefined;
      }
      const parsed = parseNumberField(rawVal);
      if (parsed === undefined) {
        rowErrors.push({
          field: fieldName,
          value: rawVal,
          reason: `Invalid number "${rawVal}" for ${fieldName}`,
        });
        return undefined;
      }
      if (!allowNegative && parsed < 0) {
        rowErrors.push({
          field: fieldName,
          value: rawVal,
          reason: `${fieldName} cannot be negative`,
        });
      }
      return parsed;
    };

    // 3. Parse & Validate Numeric Fields
    const birdCount = checkNumericField('birdCount', rowValues.birdCount, false);
    let feedKg = checkNumericField('feedKg', rowValues.feedKg, false);
    const feedGrams = checkNumericField('feedGrams', rowValues.feedGrams, false);
    const mortality = checkNumericField('mortality', rowValues.mortality, false) ?? 0;
    const culling = checkNumericField('culling', rowValues.culling, false) ?? 0;
    const eggsProduced = checkNumericField('eggsProduced', rowValues.eggsProduced, false) ?? 0;
    const selectionEggs = checkNumericField('selectionEggs', rowValues.selectionEggs, false) ?? 0;
    const damagedEggs = checkNumericField('damagedEggs', rowValues.damagedEggs, false) ?? 0;
    const floorEggs = checkNumericField('floorEggs', rowValues.floorEggs, false) ?? 0;
    const temperature = checkNumericField('temperature', rowValues.temperature, true) ?? null;
    const ammoniaPpm = checkNumericField('ammoniaPpm', rowValues.ammoniaPpm, false) ?? null;
    const eggWeightAvg = checkNumericField('eggWeightAvg', rowValues.eggWeightAvg, false);
    const bodyWeightAvg = checkNumericField('bodyWeightAvg', rowValues.bodyWeightAvg, false);
    const actualProductionPct = checkNumericField('actualProductionPct', rowValues.actualProductionPct, false, true);
    const standardProductionPct = checkNumericField('standardProductionPct', rowValues.standardProductionPct, false, true);

    // Preserve Week Number (clean float/decimal formatting)
    let weekNumber: string | number | undefined = undefined;
    if (rowValues.weekNumber !== undefined && rowValues.weekNumber !== null && String(rowValues.weekNumber).trim() !== '') {
      const wkNum = Number(rowValues.weekNumber);
      if (!isNaN(wkNum)) {
        weekNumber = Number(wkNum.toFixed(1));
      } else {
        weekNumber = String(rowValues.weekNumber).trim();
      }
    }

    // Feed Unit Normalization & Grams per bird calculation
    if (feedKg === undefined && feedGrams !== undefined && feedGrams > 0) {
      feedKg = parseFloat((feedGrams / 1000).toFixed(2));
    }
    const feedGramsPerBird =
      feedKg !== undefined && birdCount && birdCount > 0
        ? Math.round((feedKg * 1000) / birdCount)
        : feedGrams;

    // Mortality & Culling checks
    if (birdCount !== undefined && mortality + culling > birdCount) {
      rowErrors.push({
        field: 'mortality',
        value: `${mortality} + ${culling}`,
        reason: `Combined mortality (${mortality}) and culling (${culling}) exceeds total bird count (${birdCount})`,
      });
    }

    // Customer Domain Validations:
    // Egg Production Maximum Threshold: 95%
    if (birdCount !== undefined && birdCount > 0 && eggsProduced > 0) {
      const rate = eggsProduced / birdCount;
      if (rate > 0.95) {
        rowErrors.push({
          field: 'eggsProduced',
          value: eggsProduced,
          reason: `Egg production (${eggsProduced}, ${(rate * 100).toFixed(1)}%) exceeds maximum allowed threshold of 95% for bird count of ${birdCount}`,
        });
      }
    }

    // Egg Weight: 30 - 80 g
    if (eggWeightAvg !== undefined && (eggWeightAvg < 30 || eggWeightAvg > 80)) {
      rowErrors.push({
        field: 'eggWeightAvg',
        value: eggWeightAvg,
        reason: `Average egg weight (${eggWeightAvg}g) must be between 30g and 80g`,
      });
    }

    // Body Weight: 500 - 3,000 g (collected weekly, optional for daily records)
    if (bodyWeightAvg !== undefined && (bodyWeightAvg < 500 || bodyWeightAvg > 3000)) {
      rowErrors.push({
        field: 'bodyWeightAvg',
        value: bodyWeightAvg,
        reason: `Average body weight (${bodyWeightAvg}g) must be between 500g and 3000g`,
      });
    }

    // Temperature: 10 - 50 °C
    if (temperature !== null && (temperature < 10 || temperature > 50)) {
      rowErrors.push({
        field: 'temperature',
        value: temperature,
        reason: `Shed temperature (${temperature}°C) must be between 10°C and 50°C`,
      });
    }

    // Ammonia: 0 - 50 PPM, alert when > 10 PPM
    if (ammoniaPpm !== null) {
      if (ammoniaPpm > 50) {
        rowErrors.push({
          field: 'ammoniaPpm',
          value: ammoniaPpm,
          reason: `Ammonia level (${ammoniaPpm} PPM) cannot exceed 50 PPM`,
        });
      } else if (ammoniaPpm > 10) {
        rowWarnings.push({
          field: 'ammoniaPpm',
          message: `Ammonia level (${ammoniaPpm} PPM) exceeds recommended safety threshold of 10 PPM`,
        });
      }
    }

    // Selection & Damaged eggs checks
    if (selectionEggs + damagedEggs > eggsProduced && eggsProduced > 0) {
      rowErrors.push({
        field: 'selectionEggs',
        value: `${selectionEggs} + ${damagedEggs}`,
        reason: `Combined selection (${selectionEggs}) and damaged (${damagedEggs}) eggs exceeds total eggs produced (${eggsProduced})`,
      });
    } else if (selectionEggs > eggsProduced && eggsProduced > 0) {
      rowErrors.push({
        field: 'selectionEggs',
        value: selectionEggs,
        reason: `Selection eggs (${selectionEggs}) cannot exceed total eggs produced (${eggsProduced})`,
      });
    }

    // Specific to Feed Loads
    const feedLoadQty = checkNumericField('feedLoadQuantityKg', rowValues.feedLoadQuantityKg, false);
    if (parsedFile.detectedRecordType === 'FEED_LOAD') {
      if (!feedLoadQty && !feedKg) {
        rowErrors.push({
          field: 'feedLoadQuantityKg',
          value: '',
          reason: 'Feed delivery quantity is required for feed load records',
        });
      }
    }

    validatedRows.push({
      fileId: parsedFile.id,
      fileName: parsedFile.name,
      rowNumber: rawRow.rowNumber,
      recordType: parsedFile.detectedRecordType,
      farmId,
      submissionDate,
      rawDate,
      weekNumber,
      birdCount,
      feedKg,
      feedGrams: feedGrams ?? (feedKg != null ? feedKg * 1000 : undefined),
      feedGramsPerBird,
      mortality,
      culling,
      eggsProduced,
      selectionEggs,
      damagedEggs,
      floorEggs,
      actualProductionPct,
      standardProductionPct,
      temperature,
      ammoniaPpm,
      eggWeight: eggWeightAvg ? { min: eggWeightAvg, max: eggWeightAvg, avg: eggWeightAvg } : undefined,
      bodyWeight: bodyWeightAvg ? { min: bodyWeightAvg, max: bodyWeightAvg, avg: bodyWeightAvg } : undefined,
      remarks: rowValues.remarks || '',
      flockId: rowValues.flockId || '',
      feedLoadQuantityKg: feedLoadQty ?? feedKg,
      feedLoadNotes: rowValues.feedLoadNotes || rowValues.remarks || '',
      isValid: rowErrors.length === 0,
      errors: rowErrors,
      warnings: rowWarnings,
      isExcluded: false,
    });
  });

  return validatedRows;
}

// ==========================================
// CONFLICT & DUPLICATE CHECKER (API & DIRECT FALLBACK)
// ==========================================

export async function checkServerConflicts(
  rows: ValidatedRow[],
): Promise<ValidatedRow[]> {
  const validRows = rows.filter((r) => r.isValid && !r.isExcluded);
  if (validRows.length === 0) return rows;

  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const user = auth.currentUser;

  // 1. Try Backend API first if user is logged in
  if (user) {
    try {
      const idToken = await user.getIdToken();
      const recordsPayload = validRows.map((r) => ({
        recordType: r.recordType,
        farmId: r.farmId,
        submissionDate: r.submissionDate,
        birdCount: r.birdCount,
        feedKg: r.feedKg,
        mortality: r.mortality,
        culling: r.culling,
        eggsProduced: r.eggsProduced,
        selectionEggs: r.selectionEggs,
        temperature: r.temperature,
        sourceFile: r.fileName,
        sourceRow: r.rowNumber,
      }));

      const res = await fetch(`${backendUrl}/api/v1/admin/import/check-conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ records: recordsPayload }),
      });

      if (res.ok) {
        const json = await res.json();
        const results: Array<{ index: number; status: 'NEW' | 'EXACT_DUPLICATE' | 'CONFLICT'; diff?: any; existingData?: any }> = json.data.results;

        return rows.map((r) => {
          if (!r.isValid || r.isExcluded) return r;
          const matchIdx = validRows.findIndex((vr) => vr === r);
          const serverResult = results[matchIdx];
          if (serverResult) {
            return {
              ...r,
              conflictStatus: serverResult.status,
              diff: serverResult.diff,
              existingRecord: serverResult.existingData,
            };
          }
          return r;
        });
      }
    } catch (err) {
      console.warn('[historicalImportService] Backend check-conflicts failed, falling back to direct Firestore check:', err);
    }
  }

  // 2. Fallback: Direct Firestore Query
  const farmIds = Array.from(new Set(validRows.map((r) => r.farmId)));
  const existingLocks = new Map<string, any>();
  const existingReports = new Map<string, any>();

  for (const farmId of farmIds) {
    try {
      const lockSnap = await db.collection('dailyReportLocks').where('farmId', '==', farmId).get();
      lockSnap.docs.forEach((d: any) => {
        const data = d.data();
        existingLocks.set(`${data.farmId}_${data.submissionDate}`, data);
      });
    } catch {}

    try {
      const repSnap = await db.collection('dailyReports').where('farmId', '==', farmId).get();
      repSnap.docs.forEach((d: any) => {
        const data = d.data();
        const dStr = data.submissionDate || data.reportDate;
        if (dStr) existingReports.set(`${data.farmId}_${dStr}`, data);
      });
    } catch {}
  }

  return rows.map((r) => {
    if (!r.isValid || r.isExcluded) return r;
    const key = `${r.farmId}_${r.submissionDate}`;
    const existing = existingReports.get(key) || existingLocks.get(key);

    if (!existing) {
      return { ...r, conflictStatus: 'NEW' };
    }

    // Compare fields
    const diff: Record<string, { existing: any; proposed: any }> = {};
    let isConflict = false;

    const checkFields = ['birdCount', 'feedKg', 'mortality', 'culling', 'eggsProduced'] as const;
    checkFields.forEach((f) => {
      const propVal = r[f];
      const exVal = existing[f];
      if (propVal !== undefined && exVal !== undefined && Number(propVal) !== Number(exVal)) {
        isConflict = true;
        diff[f] = { existing: exVal, proposed: propVal };
      }
    });

    if (isConflict) {
      return { ...r, conflictStatus: 'CONFLICT', diff, existingRecord: existing };
    }
    return { ...r, conflictStatus: 'EXACT_DUPLICATE', existingRecord: existing };
  });
}

// ==========================================
// BATCH EXECUTION & IMPORT
// ==========================================

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
  errors: Array<{ file: string; row: number; reason: string }>;
  status: 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED' | 'SIMULATED';
  isDryRun?: boolean;
}

export async function executeHistoricalImport(
  validatedRows: ValidatedRow[],
  conflictAction: 'skip' | 'replace',
  onProgress?: (progress: { currentBatch: number; totalBatches: number; percentage: number }) => void,
  options?: ImportExecutionOptions,
): Promise<ExecuteImportClientResult> {
  const rowsToImport = validatedRows.filter((r) => r.isValid && !r.isExcluded);
  if (rowsToImport.length === 0) {
    throw new Error('No valid rows available to import');
  }

  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const user = auth.currentUser;
  const sourceFiles = Array.from(new Set(rowsToImport.map((r) => r.fileName)));
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // 1. Try Backend API
  if (user) {
    try {
      const idToken = await user.getIdToken();
      const recordsPayload = rowsToImport.map((r) => ({
        recordType: r.recordType,
        farmId: r.farmId,
        submissionDate: r.submissionDate,
        birdCount: r.birdCount,
        feedKg: r.feedKg,
        feedGrams: r.feedGrams,
        feedG: r.feedGrams,
        feedGramsPerBird: r.feedGramsPerBird,
        weekNumber: r.weekNumber,
        mortality: r.mortality,
        culling: r.culling,
        eggsProduced: r.eggsProduced,
        selectionEggs: r.selectionEggs,
        damagedEggs: r.damagedEggs,
        floorEggs: r.floorEggs,
        actualProductionPct: r.actualProductionPct,
        standardProductionPct: r.standardProductionPct,
        temperature: r.temperature,
        ammoniaPpm: r.ammoniaPpm,
        eggWeight: r.eggWeight,
        bodyWeight: r.bodyWeight,
        remarks: r.remarks,
        flockId: r.flockId,
        sourceFile: r.fileName,
        sourceRow: r.rowNumber,
        feedLoadQuantityKg: r.feedLoadQuantityKg,
        feedLoadNotes: r.feedLoadNotes,
      }));

      onProgress?.({ currentBatch: 1, totalBatches: 1, percentage: 50 });

      const res = await fetch(`${backendUrl}/api/v1/admin/import/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          batchId,
          records: recordsPayload,
          conflictAction,
          sourceFiles,
          dryRun: options?.dryRun ?? false,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        onProgress?.({ currentBatch: 1, totalBatches: 1, percentage: 100 });
        return json.data;
      }
    } catch (err) {
      console.warn('[historicalImportService] Backend execution failed, falling back to direct client batch:', err);
    }
  }

  // 2. Direct Firestore fallback (Bounded Batches)
  const now = new Date().toISOString();
  let importedCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;
  let conflictCount = 0;
  const errors: Array<{ file: string; row: number; reason: string }> = [];
  const manifest: any[] = [];

  // Lookup farmers
  const farmerUserMap = new Map<string, string>();
  try {
    const usersSnap = await db.collection('users').where('role', '==', 'farmer').get();
    usersSnap.docs.forEach((u: any) => {
      const udata = u.data();
      const uFarmIds: string[] = udata.farmIds || [];
      uFarmIds.forEach((fId) => farmerUserMap.set(fId, u.id));
    });
  } catch {}

  const adminUid = user?.uid || 'admin';
  const BATCH_SIZE = 75; // 75 rows * 4 writes = 300 operations (safe under 500)
  const totalBatches = Math.ceil(rowsToImport.length / BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    const chunk = rowsToImport.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const batch = !options?.dryRun && typeof db?.batch === 'function' ? db.batch() : null;

    chunk.forEach((row) => {
      if (row.conflictStatus === 'EXACT_DUPLICATE') {
        duplicateCount++;
        skippedCount++;
        return;
      }

      if (row.conflictStatus === 'CONFLICT') {
        conflictCount++;
        if (conflictAction === 'skip') {
          skippedCount++;
          return;
        }
      }

      const assignedUserId = farmerUserMap.get(row.farmId) || adminUid;
      const identityKey = `${row.farmId}_${row.submissionDate}`;

      if (row.recordType === 'DAILY_REPORT') {
        const docId = row.flockId ? `${row.submissionDate}_${row.flockId}` : row.submissionDate;
        const parentRef = db?.collection ? db.collection('dailyReports').doc(assignedUserId) : null;
        const dailyLogRef = parentRef?.collection ? parentRef.collection('dailyLogs').doc(docId) : null;
        const lockRef = db?.collection ? db.collection('dailyReportLocks').doc(identityKey) : null;
        const topLevelReportRef = db?.collection ? db.collection('dailyReports').doc(identityKey) : null;

        const reportData = {
          userId: assignedUserId,
          submittedBy: adminUid,
          farmId: row.farmId,
          flockId: row.flockId || '',
          submissionDate: row.submissionDate,
          submissionMethod: 'HISTORICAL_IMPORT',
          submissionVersion: row.conflictStatus === 'CONFLICT' ? 2 : 1,
          status: 'submitted',
          birdCount: row.birdCount ?? null,
          openingBirdCount: row.birdCount ?? null,
          closingBirdCount: row.birdCount ?? null,
          feedKg: row.feedKg ?? null,
          feedGrams: row.feedGrams ?? (row.feedKg != null ? row.feedKg * 1000 : null),
          feedG: row.feedGrams ?? (row.feedKg != null ? row.feedKg * 1000 : null),
          feedGramsPerBird: row.feedGramsPerBird ?? null,
          weekNumber: row.weekNumber ?? null,
          mortality: row.mortality ?? 0,
          culling: row.culling ?? 0,
          eggsProduced: row.eggsProduced ?? 0,
          selectionEggs: row.selectionEggs ?? 0,
          damagedEggs: row.damagedEggs ?? 0,
          floorEggs: row.floorEggs ?? 0,
          actualProductionPct: row.actualProductionPct ?? null,
          standardProductionPct: row.standardProductionPct ?? null,
          temperature: row.temperature ?? null,
          tempMin: row.temperature ?? null,
          tempMax: row.temperature ?? null,
          ammoniaPpm: row.ammoniaPpm ?? null,
          eggWeight: row.eggWeight ?? { min: 0, max: 0, avg: 0 },
          bodyWeight: row.bodyWeight ?? { min: 0, max: 0, avg: 0 },
          remarks: row.remarks || '',
          isHistorical: true,
          importBatchId: batchId,
          sourceFile: row.fileName,
          sourceRow: row.rowNumber,
          createdAt: now,
          updatedAt: now,
        };

        if (batch) {
          batch.set(parentRef, { userId: assignedUserId, farmId: row.farmId, updatedAt: now }, { merge: true });
          batch.set(dailyLogRef, reportData, { merge: true });
          batch.set(lockRef, { farmId: row.farmId, submissionDate: row.submissionDate, reportId: docId, importBatchId: batchId, createdAt: now });
          batch.set(topLevelReportRef, reportData, { merge: true });
        }
        importedCount++;

        manifest.push({
          recordType: 'DAILY_REPORT',
          action: row.conflictStatus === 'CONFLICT' ? 'UPDATED' : 'CREATED',
          farmId: row.farmId,
          submissionDate: row.submissionDate,
          targetDocs: [
            { collectionPath: `dailyReports/${assignedUserId}/dailyLogs`, docId },
            { collectionPath: 'dailyReportLocks', docId: identityKey },
            { collectionPath: 'dailyReports', docId: identityKey },
          ],
          beforeData: row.diff,
          importedAt: now,
        });

      } else if (row.recordType === 'FEED_LOAD') {
        const feedLogRef = db?.collection ? db.collection('logs').doc(row.farmId).collection('feedLogs').doc() : null;
        const txRef = db?.collection ? db.collection('farms').doc(row.farmId).collection('feedTransactions').doc() : null;
        const qty = row.feedLoadQuantityKg || row.feedKg || 0;

        if (batch) {
          batch.set(feedLogRef, {
            logId: feedLogRef?.id || '',
            farmId: row.farmId,
            quantityKg: qty,
            loadedAt: row.submissionDate,
            recordedBy: adminUid,
            notes: row.feedLoadNotes || row.remarks || 'Historical Feed Load Import',
            type: 'FEED_LOAD',
            isHistorical: true,
            importBatchId: batchId,
          });

          batch.set(txRef, {
            farmId: row.farmId,
            type: 'FEED_LOAD',
            feedKg: qty,
            reportDate: row.submissionDate,
            createdAt: now,
            loadedBy: adminUid,
            notes: row.feedLoadNotes || row.remarks || 'Historical Feed Load Import',
            isHistorical: true,
            importBatchId: batchId,
          });
        }
        importedCount++;

        manifest.push({
          recordType: 'FEED_LOAD',
          action: 'CREATED',
          farmId: row.farmId,
          submissionDate: row.submissionDate,
          targetDocs: [
            { collectionPath: `logs/${row.farmId}/feedLogs`, docId: feedLogRef?.id || '' },
            { collectionPath: `farms/${row.farmId}/feedTransactions`, docId: txRef?.id || '' },
          ],
          importedAt: now,
        });
      }
    });

    if (!options?.dryRun && batch) {
      await batch.commit();
    }
    const percentage = Math.round(((b + 1) / totalBatches) * 100);
    onProgress?.({ currentBatch: b + 1, totalBatches, percentage });
  }

  if (options?.dryRun) {
    return {
      batchId: `dry_run_${batchId}`,
      totalProcessed: rowsToImport.length,
      importedCount,
      skippedCount,
      duplicateCount,
      conflictCount,
      failedCount: errors.length,
      errors,
      status: 'SIMULATED',
      isDryRun: true,
    };
  }

  // Save batch audit record
  const status = errors.length === 0 ? 'COMPLETED' : importedCount > 0 ? 'PARTIAL_FAILURE' : 'FAILED';
  const batchRecord = {
    batchId,
    adminUid,
    adminEmail: user?.email || null,
    importTimestamp: now,
    filenames: sourceFiles,
    affectedFarms: Array.from(new Set(rowsToImport.map((r) => r.farmId))),
    recordType: 'DAILY_REPORT',
    totalRows: rowsToImport.length,
    importedCount,
    skippedCount,
    duplicateCount,
    conflictCount,
    failedCount: errors.length,
    conflictActionChosen: conflictAction,
    status,
    errors,
    manifest,
    revertStatus: 'NOT_REVERTED',
  };

  try {
    await db.collection('importBatches').doc(batchId).set(batchRecord);
  } catch (e) {
    console.warn('[historicalImportService] Failed writing importBatches document:', e);
  }

  return {
    batchId,
    totalProcessed: rowsToImport.length,
    importedCount,
    skippedCount,
    duplicateCount,
    conflictCount,
    failedCount: errors.length,
    errors,
    status,
  };
}

// ==========================================
// IMPORT HISTORY & AUDIT
// ==========================================

export async function fetchImportBatches(): Promise<any[]> {
  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const user = auth.currentUser;

  if (user) {
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`${backendUrl}/api/v1/admin/import/batches`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch {}
  }

  // Direct Firestore fallback
  try {
    const snap = await db.collection('importBatches').orderBy('importTimestamp', 'desc').limit(50).get();
    return snap.docs.map((d: any) => d.data());
  } catch (err) {
    console.error('[fetchImportBatches] Failed:', err);
    return [];
  }
}

export function generateErrorReportCsv(errors: Array<{ file: string; row: number; field?: string; reason: string }>): string {
  const headers = ['File Name', 'Row Number', 'Field', 'Error Reason'];
  const csvRows = [headers.join(',')];

  errors.forEach((err) => {
    const row = [
      `"${(err.file || '').replace(/"/g, '""')}"`,
      err.row,
      `"${(err.field || '').replace(/"/g, '""')}"`,
      `"${(err.reason || '').replace(/"/g, '""')}"`,
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\r\n');
}

// ==========================================
// REVERT IMPORT BATCH SUPPORT
// ==========================================

export type RevertBatchStatus =
  | 'NOT_REVERTED'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'REVERTING'
  | 'REVERTED'
  | 'PARTIALLY_REVERTED'
  | 'REVERT_FAILED'
  | 'REVERT_REQUIRES_REVIEW'
  | 'NOT_REVERSIBLE';

export interface RevertPreviewRecord {
  farmId: string;
  submissionDate: string;
  recordType: string;
  action: 'CREATED' | 'UPDATED';
  canSafelyRevert: boolean;
  reason?: string;
}

export interface RevertPreviewResponse {
  batchId: string;
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
  status: RevertBatchStatus;
  deletedCount: number;
  restoredCount: number;
  skippedCount: number;
  conflictCount: number;
  failedCount: number;
  errors: Array<{ docId?: string; reason: string }>;
}

export async function fetchRevertPreview(batchId: string): Promise<RevertPreviewResponse> {
  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const user = auth.currentUser;

  if (user) {
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`${backendUrl}/api/v1/admin/import/batches/${batchId}/revert-preview`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch (e) {
      console.warn('[fetchRevertPreview] Backend request failed, falling back to direct Firestore:', e);
    }
  }

  // Direct Firestore fallback
  const batchDoc = await db.collection('importBatches').doc(batchId).get();
  if (!batchDoc.exists) throw new Error(`Import batch '${batchId}' not found`);
  const batch = batchDoc.data();

  const manifest = batch.manifest || [];
  let canSafelyRevert = 0;
  let willDelete = 0;
  let willRestore = 0;
  const sampleRecords: RevertPreviewRecord[] = [];

  for (const item of manifest.slice(0, 50)) {
    sampleRecords.push({
      farmId: item.farmId,
      submissionDate: item.submissionDate,
      recordType: item.recordType || 'DAILY_REPORT',
      action: item.action || 'CREATED',
      canSafelyRevert: true,
    });
  }

  manifest.forEach((m: any) => {
    canSafelyRevert++;
    if (m.action === 'CREATED') willDelete++;
    if (m.action === 'UPDATED') willRestore++;
  });

  const isAlreadyReverted = batch.revertStatus === 'REVERTED';
  const isReverting = batch.revertStatus === 'REVERTING';

  return {
    batchId,
    importTimestamp: batch.importTimestamp,
    filenames: batch.filenames || [],
    affectedFarms: batch.affectedFarms || [],
    totalImported: batch.importedCount || manifest.length || 0,
    canSafelyRevert: isAlreadyReverted || isReverting ? 0 : (canSafelyRevert || batch.importedCount || 0),
    requiresReview: 0,
    willDelete: isAlreadyReverted ? 0 : (willDelete || batch.importedCount || 0),
    willRestore: isAlreadyReverted ? 0 : willRestore,
    isReversible: !isAlreadyReverted && !isReverting && (canSafelyRevert > 0 || batch.importedCount > 0),
    revertStatus: batch.revertStatus || 'NOT_REVERTED',
    notReversibleReason: isAlreadyReverted
      ? 'This batch has already been reverted.'
      : isReverting
      ? 'This batch is currently being reverted.'
      : undefined,
    sampleRecords,
  };
}

export async function executeRevertImportBatch(
  batchId: string,
  confirmationBatchId: string,
): Promise<RevertBatchResponse> {
  const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const user = auth.currentUser;

  if (user) {
    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`${backendUrl}/api/v1/admin/import/batches/${batchId}/revert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ confirmationBatchId }),
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Revert failed with status ${res.status}`);
      }
    } catch (e: any) {
      if (e?.message && !e.message.includes('fetch')) {
        throw e;
      }
      console.warn('[executeRevertImportBatch] Backend request failed, falling back to direct Firestore:', e);
    }
  }

  // Direct Firestore fallback
  if (confirmationBatchId.trim() !== batchId.trim()) {
    throw new Error(`Confirmation batch ID mismatch. Expected '${batchId}'.`);
  }

  const batchRef = db.collection('importBatches').doc(batchId);
  const batchDoc = await batchRef.get();
  if (!batchDoc.exists) throw new Error(`Import batch '${batchId}' not found`);
  const batch = batchDoc.data();

  if (batch.revertStatus === 'REVERTED') {
    throw new Error('This batch has already been reverted');
  }

  await batchRef.update({ revertStatus: 'REVERTING' });

  const manifest = batch.manifest || [];
  let deletedCount = 0;
  let restoredCount = 0;

  for (let i = 0; i < manifest.length; i += 75) {
    const chunk = manifest.slice(i, i + 75);
    const writeBatch = db.batch();

    for (const item of chunk) {
      if (item.action === 'CREATED') {
        for (const tDoc of item.targetDocs || []) {
          writeBatch.delete(db.doc(`${tDoc.collectionPath}/${tDoc.docId}`));
        }
        deletedCount++;
      } else if (item.action === 'UPDATED' && item.beforeData) {
        for (const tDoc of item.targetDocs || []) {
          const restoreData = { ...item.beforeData };
          delete restoreData.importBatchId;
          writeBatch.set(db.doc(`${tDoc.collectionPath}/${tDoc.docId}`), restoreData);
        }
        restoredCount++;
      }
    }
    await writeBatch.commit();
  }

  await batchRef.update({
    revertStatus: 'REVERTED',
    revertAudit: {
      revertOperationId: `client_revert_${Date.now()}`,
      revertedByUid: user?.uid || 'admin',
      revertedByEmail: user?.email || null,
      revertTimestamp: new Date().toISOString(),
      deletedRecordsCount: deletedCount,
      restoredRecordsCount: restoredCount,
      conflictsCount: 0,
      failedCount: 0,
    },
  });

  return {
    revertOperationId: `client_revert_${Date.now()}`,
    batchId,
    status: 'REVERTED',
    deletedCount,
    restoredCount,
    skippedCount: 0,
    conflictCount: 0,
    failedCount: 0,
    errors: [],
  };
}
