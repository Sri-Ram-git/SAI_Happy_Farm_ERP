"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_FIELDS = void 0;
exports.parseCsvContent = parseCsvContent;
exports.parseXmlContent = parseXmlContent;
exports.excelSerialToIsoDate = excelSerialToIsoDate;
exports.resolveFarmId = resolveFarmId;
exports.detectFarmFromText = detectFarmFromText;
exports.parseXlsxWorkbook = parseXlsxWorkbook;
exports.applyMappingToMatchingFiles = applyMappingToMatchingFiles;
exports.detectColumnMappings = detectColumnMappings;
exports.parseFlexibleDate = parseFlexibleDate;
exports.parseNumberField = parseNumberField;
exports.validateParsedFile = validateParsedFile;
exports.checkServerConflicts = checkServerConflicts;
exports.sanitizeFirestoreData = sanitizeFirestoreData;
exports.executeHistoricalImport = executeHistoricalImport;
exports.saveImportBatchRecord = saveImportBatchRecord;
exports.fetchImportBatches = fetchImportBatches;
exports.generateErrorReportCsv = generateErrorReportCsv;
exports.fetchRevertPreview = fetchRevertPreview;
exports.executeRevertImportBatch = executeRevertImportBatch;
exports.getBatchWorksheets = getBatchWorksheets;
const XLSX = __importStar(require("xlsx"));
const firebase_1 = require("../config/firebase");
exports.STANDARD_FIELDS = [
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
        label: 'Feed Consumed Total (Grams)',
        category: 'feed',
        type: 'number',
        synonyms: [
            'feed (g)', 'feed g', 'feed grams', 'feed (grams)', 'total feed grams', 'feed gm', 'feed gms'
        ],
    },
    {
        key: 'feedGramsPerBird',
        label: 'Feed Consumed (Gms / Bird)',
        category: 'feed',
        type: 'number',
        synonyms: [
            'feed/bird', 'feed per bird', 'feed gms/bird', 'feed gms per bird',
            'feed g/bird', 'g/bird', 'gms/bird', 'feed per hen', 'gm/bird'
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
// ==========================================
// PARSING UTILITIES (CSV & XML)
// ==========================================
function normalizeHeaderStr(str) {
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
function detectDelimiter(text) {
    const lines = text.slice(0, 5000).split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
    if (lines.length === 0)
        return ',';
    const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
    const sample = lines.slice(0, 5);
    sample.forEach((line) => {
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"')
                inQuote = !inQuote;
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
function parseCsvLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuote && line[i + 1] === '"') {
                current += '"';
                i++; // skip escaped quote
            }
            else {
                inQuote = !inQuote;
            }
        }
        else if (char === delimiter && !inQuote) {
            result.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
/**
 * Parses CSV content, identifying header row even if title rows precede it.
 */
function parseCsvContent(content, filename) {
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
            exports.STANDARD_FIELDS.forEach((f) => {
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
    const headers = rawHeaderCols.map((h, i) => {
        const clean = h.trim();
        return clean.length > 0 ? clean : `Column_${i + 1}`;
    });
    const rows = [];
    for (let i = headerRowIndex + 1; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (!line || !line.trim())
            continue;
        const values = parseCsvLine(line, delimiter);
        const rowData = {};
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
function parseXmlContent(content, _filename) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
        throw new Error('Invalid XML document: ' + parseError[0]?.textContent);
    }
    // Find record elements
    const commonTags = ['record', 'row', 'report', 'entry', 'dailylog', 'log', 'item', 'submission'];
    let recordNodes = [];
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
    const headerSet = new Set();
    const parsedRows = [];
    recordNodes.forEach((node) => {
        const rowObj = {};
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
    const rows = parsedRows.map((data, idx) => ({
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
function excelSerialToIsoDate(serial) {
    if (typeof serial !== 'number' || isNaN(serial) || serial < 1 || serial > 2958465) {
        return null;
    }
    // Days from 1899-12-30 to 1970-01-01 = 25569
    const utcDays = Math.floor(serial - 25569);
    const dateObj = new Date(utcDays * 86400 * 1000);
    const y = dateObj.getUTCFullYear();
    const m = dateObj.getUTCMonth() + 1;
    const d = dateObj.getUTCDate();
    if (!isValidDateParts(y, m, d))
        return null;
    return formatDateParts(y, m, d);
}
/**
 * Resolves a raw farm identifier string against existing active farm records.
 * Supports exact farmId, farm name, and verified aliases (e.g. "Farm Alpha 12", "AP 12", "Happy Farm 12").
 * Never silently assigns an unmatched record to another farm.
 */
function resolveFarmId(rawInput, existingFarms, fallbackAssignedFarmId) {
    const farmList = (existingFarms || []).map((f) => typeof f === 'string' ? { farmId: f, name: f, active: true, location: '' } : f);
    const clean = String(rawInput || '').trim();
    // If no row input, try fallback assigned farm if valid
    if (!clean && fallbackAssignedFarmId) {
        const fallbackMatch = farmList.find((f) => f.farmId.toUpperCase() === fallbackAssignedFarmId.trim().toUpperCase());
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
    const directName = farmList.find((f) => f.name && f.name.trim().toUpperCase() === upper);
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
        const aliasMatch = farmList.find((f) => f.farmId.toUpperCase() === normalizedCandidate);
        if (aliasMatch) {
            return { farmId: aliasMatch.farmId.toUpperCase() };
        }
    }
    // 4. Numeric ending match (e.g. "12" if only AP12 exists among known farms)
    const numMatch = clean.match(/(\d{1,4})$/);
    if (numMatch && numMatch[1]) {
        const num = numMatch[1];
        const candidateFarms = farmList.filter((f) => f.farmId.toUpperCase().endsWith(num) || (f.name && f.name.toUpperCase().includes(num)));
        if (candidateFarms.length === 1) {
            return { farmId: candidateFarms[0].farmId.toUpperCase() };
        }
        else if (candidateFarms.length > 1) {
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
function detectFarmFromText(text, knownFarms) {
    if (!text)
        return undefined;
    const clean = text.trim();
    const farmList = (knownFarms || []).map((f) => typeof f === 'string' ? { farmId: f, name: f, active: true, location: '' } : f);
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
/**
 * Parses an Excel (.xlsx) workbook from ArrayBuffer or Uint8Array.
 * Extracts all worksheets, detects horizontal/transposed farm sheets vs standard vertical sheets,
 * detects hidden and standard curve sheets, inspects formulas and cached values,
 * accurately handles Excel date cells and serial numbers without timezone shifts,
 * ignores empty rows/columns, and identifies verified farm codes.
 */
/**
 * Safely formats an Excel cell value for historical import.
 * Handles Excel date serials, formula errors (#DIV/0!, etc.), text dates with format hints, and clean numbers.
 */
function formatExcelCellValue(cell, isDateCell, preference = 'AUTO') {
    if (!cell) {
        return { formatted: '', hasFormula: false, isFormulaError: false };
    }
    const hasFormula = Boolean(cell.f);
    let isFormulaError = false;
    let formatted = '';
    // 1. Formula Error handling
    if (cell.t === 'e' || (typeof cell.v === 'string' && cell.v.startsWith('#'))) {
        isFormulaError = true;
        formatted = cell.w || (typeof cell.v === 'string' ? cell.v : '#ERROR');
        return { formatted, hasFormula, isFormulaError };
    }
    // 2. Date Cell handling
    if (isDateCell) {
        // A. Excel numeric serial date (e.g. 46175)
        if (typeof cell.v === 'number' && cell.v >= 20000 && cell.v <= 60000) {
            const iso = excelSerialToIsoDate(cell.v);
            if (iso) {
                return { formatted: iso, hasFormula, isFormulaError };
            }
        }
        // B. Native JS Date (if cell.t === 'd' or cell.v is Date)
        if (cell.t === 'd' || cell.v instanceof Date) {
            const d = cell.v;
            const y = d.getUTCFullYear();
            const m = d.getUTCMonth() + 1;
            const day = d.getUTCDate();
            if (isValidDateParts(y, m, day)) {
                return { formatted: formatDateParts(y, m, day), hasFormula, isFormulaError };
            }
        }
        // C. Formatted text date with cell.z format hint
        const dateText = cell.w !== undefined ? String(cell.w).trim() : String(cell.v).trim();
        if (dateText) {
            const parsed = parseFlexibleDate(dateText, preference, cell.z);
            if (parsed.isoDate) {
                return { formatted: parsed.isoDate, hasFormula, isFormulaError };
            }
        }
    }
    // 3. General cell formatting
    // Number with date format string in Excel
    if (cell.t === 'n' && typeof cell.v === 'number' && cell.z && XLSX.SSF.is_date(cell.z)) {
        const iso = excelSerialToIsoDate(cell.v);
        if (iso)
            return { formatted: iso, hasFormula, isFormulaError };
    }
    if (cell.w !== undefined) {
        formatted = String(cell.w).trim();
    }
    else if (cell.v !== undefined && cell.v !== null) {
        formatted = String(cell.v).trim();
    }
    return { formatted, hasFormula, isFormulaError };
}
/**
 * Parses an Excel (.xlsx) workbook from ArrayBuffer or Uint8Array.
 * Extracts all worksheets, detects horizontal/transposed farm sheets vs standard vertical sheets,
 * detects hidden and standard curve sheets, inspects formulas and cached values,
 * accurately handles Excel date cells and serial numbers without timezone shifts,
 * ignores empty rows/columns, and identifies verified farm codes.
 */
function parseXlsxWorkbook(data, _filename, knownFarmIds) {
    let workbook;
    try {
        workbook = XLSX.read(data, {
            type: 'array',
            cellDates: false,
            cellNF: true,
            cellFormula: true,
        });
    }
    catch (err) {
        throw new Error(`Failed to read Excel workbook: ${err.message || 'Corrupted or unsupported format'}`);
    }
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excel workbook contains no worksheets');
    }
    const detectedFarmFromFilename = _filename ? detectFarmFromText(_filename, knownFarmIds) : undefined;
    const results = [];
    for (const sheetName of workbook.SheetNames) {
        const sheetMeta = (workbook.Workbook?.Sheets || []).find((s) => s.name === sheetName);
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
        let totalFormulaCount = 0;
        let formulaErrorCount = 0;
        // Detect farm ID from sheet name
        const detectedFarmFromSheet = detectFarmFromText(sheetName, knownFarmIds);
        // Identify farm mismatch / conflict between filename and sheet name
        let farmConflict;
        if (detectedFarmFromFilename && detectedFarmFromSheet && detectedFarmFromFilename !== detectedFarmFromSheet) {
            farmConflict = {
                sheetFarm: detectedFarmFromSheet,
                filenameFarm: detectedFarmFromFilename,
                reason: `Filename indicates farm "${detectedFarmFromFilename}" but worksheet is named "${detectedFarmFromSheet}".`,
            };
        }
        // Default detectedFarmId: sheet name is more specific than filename for multi-sheet workbooks
        let detectedFarmId = detectedFarmFromSheet || detectedFarmFromFilename;
        // Check if worksheet is a reference standard curve (e.g. "CF STD", "FR STD", "Cage Free STD", "Free Range STD")
        const isReferenceSheet = /(?:cage\s*free|free\s*range|cf|fr)?\s*(?:std|standard|curve|template)/i.test(sheetName.trim());
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
        let dateRowIdx = null;
        if (bestScore >= 3 && bestLabelCol >= 0) {
            for (let r = range.s.r; r <= range.e.r; r++) {
                let dateCount = 0;
                for (let c = bestLabelCol + 1; c <= Math.min(range.e.c, bestLabelCol + 15); c++) {
                    const addr = XLSX.utils.encode_cell({ r, c });
                    const cell = ws[addr];
                    if (!cell)
                        continue;
                    if (cell.t === 'd' || cell.v instanceof Date) {
                        dateCount++;
                    }
                    else if (cell.t === 'n' && typeof cell.v === 'number' && (cell.v >= 20000 && cell.v <= 60000)) {
                        dateCount++;
                    }
                    else if (typeof cell.v === 'string' && /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(cell.v.trim())) {
                        dateCount++;
                    }
                    else if (cell.w && /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(cell.w.trim())) {
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
        if (isTransposed && dateRowIdx !== null) {
            // 1. Identify active date columns first to verify which metric rows contain real data
            const dateColumns = [];
            for (let c = bestLabelCol + 1; c <= range.e.c; c++) {
                const addr = XLSX.utils.encode_cell({ r: dateRowIdx, c });
                const cell = ws[addr];
                if (cell && (cell.v !== undefined || cell.w !== undefined)) {
                    const { formatted } = formatExcelCellValue(cell, true, 'AUTO');
                    if (formatted)
                        dateColumns.push(c);
                }
            }
            // 2. Collect metric rows - filter out stray labels/notes that have no data in date columns
            const metricRows = [];
            const ignoredNonDataRows = [];
            const usedLabels = new Set();
            for (let r = range.s.r; r <= range.e.r; r++) {
                const addr = XLSX.utils.encode_cell({ r, c: bestLabelCol });
                const cell = ws[addr];
                let label = cell ? String(cell.w || cell.v || '').trim() : '';
                if (r === dateRowIdx && !label) {
                    label = 'Date';
                }
                if (label) {
                    // Check if this row has at least one cell with content across active date columns
                    let hasContentInDateCols = false;
                    for (const c of dateColumns) {
                        const valAddr = XLSX.utils.encode_cell({ r, c });
                        const valCell = ws[valAddr];
                        if (valCell && valCell.v !== undefined && valCell.v !== null && String(valCell.v).trim() !== '') {
                            hasContentInDateCols = true;
                            break;
                        }
                    }
                    if (r === dateRowIdx || hasContentInDateCols) {
                        let uniqueLabel = label;
                        let counter = 1;
                        while (usedLabels.has(uniqueLabel.toLowerCase())) {
                            uniqueLabel = `${label}_${counter++}`;
                        }
                        usedLabels.add(uniqueLabel.toLowerCase());
                        metricRows.push({ rowIdx: r, label: uniqueLabel });
                    }
                    else {
                        ignoredNonDataRows.push({
                            rowIdx: r + 1,
                            label,
                            reason: 'Row has no data across any date columns (stray label or note)',
                        });
                    }
                }
            }
            const headers = metricRows.map((m) => m.label);
            const rows = [];
            let minDate;
            let maxDate;
            for (let c = bestLabelCol + 1; c <= range.e.c; c++) {
                const rowData = {};
                let colHasData = false;
                metricRows.forEach(({ rowIdx, label }) => {
                    const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
                    const cell = ws[addr];
                    if (!cell || cell.v === undefined || cell.v === null) {
                        rowData[label] = '';
                        return;
                    }
                    const isDateCell = rowIdx === dateRowIdx;
                    const { formatted, hasFormula: cellHasFormula, isFormulaError } = formatExcelCellValue(cell, isDateCell, 'AUTO');
                    if (cellHasFormula) {
                        hasFormulas = true;
                        totalFormulaCount++;
                    }
                    if (isFormulaError) {
                        formulaErrorCount++;
                    }
                    // Special clean formatting for week numbers (preserve decimals e.g. 44.1)
                    let finalVal = formatted;
                    if (typeof cell.v === 'number' && label.toLowerCase().includes('week') && !isFormulaError) {
                        finalVal = String(Number(cell.v.toFixed(1)));
                    }
                    if (finalVal)
                        colHasData = true;
                    if (rowIdx === dateRowIdx && finalVal && /^\d{4}-\d{2}-\d{2}$/.test(finalVal)) {
                        if (!minDate || finalVal < minDate)
                            minDate = finalVal;
                        if (!maxDate || finalVal > maxDate)
                            maxDate = finalVal;
                    }
                    rowData[label] = finalVal;
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
                unusualLayoutWarning: 'Transposed horizontal matrix detected (metrics in rows, dates in columns)',
                hasFormulas,
                formulaWarningCount: formulaErrorCount,
                totalFormulaCount,
                formulaErrorCount,
                ignoredNonDataRows: ignoredNonDataRows.length > 0 ? ignoredNonDataRows : undefined,
                totalRawRowsCount: rows.length,
                detectedFarmFromSheet,
                detectedFarmFromFilename,
                farmConflict,
            });
            continue;
        }
        // -------------------------------------------------------------
        // STANDARD VERTICAL LAYOUT (Row-oriented table)
        // -------------------------------------------------------------
        const rawMatrix = [];
        for (let r = range.s.r; r <= range.e.r; r++) {
            let rowHasContent = false;
            const rowCells = [];
            for (let c = range.s.c; c <= range.e.c; c++) {
                const address = XLSX.utils.encode_cell({ r, c });
                const cell = ws[address];
                if (!cell) {
                    rowCells.push({ formatted: '', raw: null });
                    continue;
                }
                const { formatted, hasFormula: cellHasFormula, isFormulaError } = formatExcelCellValue(cell, false, 'AUTO');
                if (cellHasFormula) {
                    hasFormulas = true;
                    totalFormulaCount++;
                }
                if (isFormulaError) {
                    formulaErrorCount++;
                }
                if (formatted.length > 0) {
                    rowHasContent = true;
                }
                rowCells.push({ formatted, raw: cell.v, formula: cell.f, isError: isFormulaError });
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
                const text = rawMatrix[i].cells.map((c) => c.formatted).join(' ');
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
            const candidateRow = rawMatrix[i];
            let score = 0;
            candidateRow.cells.forEach((cell) => {
                const norm = normalizeHeaderStr(cell.formatted);
                if (!norm)
                    return;
                exports.STANDARD_FIELDS.forEach((f) => {
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
        const headerRow = rawMatrix[bestHeaderIdx];
        const headerNames = [];
        const usedNames = new Set();
        headerRow.cells.forEach((cell, idx) => {
            let name = cell.formatted.trim();
            if (!name)
                name = `Column_${idx + 1}`;
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
        const dataRows = [];
        let minDate;
        let maxDate;
        for (let i = bestHeaderIdx + 1; i < rawMatrix.length; i++) {
            const rowItem = rawMatrix[i];
            const rowData = {};
            let hasData = false;
            headerNames.forEach((header, colIdx) => {
                const cell = rowItem.cells[colIdx];
                const val = cell ? cell.formatted : '';
                if (val)
                    hasData = true;
                rowData[header] = val;
                if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
                    if (!minDate || val < minDate)
                        minDate = val;
                    if (!maxDate || val > maxDate)
                        maxDate = val;
                }
            });
            if (hasData) {
                dataRows.push({
                    rowNumber: rowItem.rowNum,
                    data: rowData,
                });
            }
        }
        let unusualLayoutWarning;
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
            formulaWarningCount: formulaErrorCount,
            totalFormulaCount,
            formulaErrorCount,
            totalRawRowsCount: dataRows.length,
            detectedFarmFromSheet,
            detectedFarmFromFilename,
            farmConflict,
        });
    }
    return results;
}
/**
 * Copies column mappings from a source worksheet to target worksheets that have matching headers.
 */
function applyMappingToMatchingFiles(sourceMappings, sourceHeaders, targetFiles) {
    const sourceHeaderSet = new Set(sourceHeaders.map(normalizeHeaderStr));
    let updatedCount = 0;
    const updatedFileIds = [];
    targetFiles.forEach((file) => {
        // Check if target file has overlapping headers
        const targetHeaderSet = new Set(file.headers.map(normalizeHeaderStr));
        let matchCount = 0;
        targetHeaderSet.forEach((h) => {
            if (sourceHeaderSet.has(h))
                matchCount++;
        });
        // If at least 50% match or at least 3 headers match
        if (matchCount >= Math.min(3, targetHeaderSet.size)) {
            const newMappings = file.headers.map((targetHeader) => {
                const normTarget = normalizeHeaderStr(targetHeader);
                const matchedSource = sourceMappings.find((m) => normalizeHeaderStr(m.fileHeader) === normTarget);
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
                    mappedField: 'ignore',
                    confidence: 'UNMAPPED',
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
function detectColumnMappings(headers, sampleRows) {
    let isFeedLoadCandidate = false;
    let isFlockCandidate = false;
    const assignedKeys = new Set();
    const mappings = headers.map((header) => {
        const normalized = normalizeHeaderStr(header);
        const sampleValues = sampleRows
            .slice(0, 5)
            .map((r) => r.data[header] || '')
            .filter((v) => v.length > 0);
        const isPercentage = normalized.includes('%') || normalized.includes('pct') || normalized.includes('percent');
        const isGenericStat = /^(?:avg|average|min|max|total|sum|std|diff)$/i.test(normalized);
        let bestMatch = 'ignore';
        let highestConfidence = 'UNMAPPED';
        if (isGenericStat) {
            highestConfidence = 'AMBIGUOUS';
        }
        else {
            for (const field of exports.STANDARD_FIELDS) {
                // Prevent percentage columns from mapping to count/mass fields
                const isFieldPercentage = field.key.toLowerCase().includes('pct');
                if (isPercentage && !isFieldPercentage) {
                    continue;
                }
                // 1. Exact match with standard synonyms
                if (field.synonyms.includes(normalized)) {
                    bestMatch = field.key;
                    highestConfidence = 'HIGH';
                    break;
                }
                // 2. Substring match (require substantial match length to avoid spurious collisions)
                if (normalized.length >= 4 && field.synonyms.some((syn) => {
                    if (syn.length < 4)
                        return false;
                    return normalized.includes(syn) || syn.includes(normalized);
                })) {
                    bestMatch = field.key;
                    highestConfidence = 'MEDIUM';
                }
            }
        }
        // Collision check: prevent multiple columns from mapping to the same target field automatically
        if (bestMatch !== 'ignore') {
            if (assignedKeys.has(bestMatch)) {
                bestMatch = 'ignore';
                highestConfidence = 'AMBIGUOUS';
            }
            else {
                assignedKeys.add(bestMatch);
            }
        }
        if (bestMatch === 'feedLoadQuantityKg')
            isFeedLoadCandidate = true;
        if (bestMatch === 'flockName' || bestMatch === 'initialBirds')
            isFlockCandidate = true;
        return {
            fileHeader: header,
            mappedField: bestMatch,
            confidence: highestConfidence,
            sampleValues,
        };
    });
    let detectedType = 'DAILY_REPORT';
    if (isFeedLoadCandidate)
        detectedType = 'FEED_LOAD';
    else if (isFlockCandidate)
        detectedType = 'FLOCK_RECORD';
    return { mappings, detectedType };
}
// ==========================================
// DATE & NUMBER PARSERS
// ==========================================
function parseFlexibleDate(rawVal, preference = 'AUTO', formatPattern) {
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
        const months = {
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
        if (y < 100)
            y += 2000;
        let day = p1;
        let month = p2;
        if (preference === 'MM/DD/YYYY') {
            month = p1;
            day = p2;
        }
        else if (preference === 'DD/MM/YYYY') {
            day = p1;
            month = p2;
        }
        else {
            // AUTO detection:
            // Check Excel number format pattern hint if provided (e.g. "m/d/yy" vs "d/m/yy")
            const cleanPattern = formatPattern ? formatPattern.replace(/\[.*?\]/g, '').toLowerCase() : '';
            const hasMonthBeforeDay = cleanPattern ? /[m]+.*[d]+/i.test(cleanPattern) : false;
            const hasDayBeforeMonth = cleanPattern ? /[d]+.*[m]+/i.test(cleanPattern) : false;
            // If p1 > 12, it MUST be day -> DD/MM/YYYY
            if (p1 > 12) {
                day = p1;
                month = p2;
            }
            // If p2 > 12, it MUST be day -> MM/DD/YYYY
            else if (p2 > 12) {
                month = p1;
                day = p2;
            }
            else if (hasMonthBeforeDay) {
                month = p1;
                day = p2;
            }
            else if (hasDayBeforeMonth) {
                day = p1;
                month = p2;
            }
            else {
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
        if (iso)
            return { isoDate: iso };
    }
    return { isoDate: null, error: `Invalid date format: "${clean}"` };
}
function isValidDateParts(y, m, d) {
    if (y < 1990 || y > 2100)
        return false;
    if (m < 1 || m > 12)
        return false;
    if (d < 1 || d > 31)
        return false;
    // Verify actual calendar days in month
    const daysInMonth = new Date(y, m, 0).getDate();
    return d <= daysInMonth;
}
function formatDateParts(y, m, d) {
    const mm = m < 10 ? `0${m}` : `${m}`;
    const dd = d < 10 ? `0${d}` : `${d}`;
    return `${y}-${mm}-${dd}`;
}
function parseNumberField(val) {
    if (val === undefined || val === null || val === '')
        return undefined;
    const clean = String(val).replace(/,/g, '').replace(/%|kg|g|c|ppm/gi, '').trim();
    if (clean === '')
        return undefined;
    const num = Number(clean);
    return isNaN(num) ? undefined : num;
}
// ==========================================
// VALIDATION ENGINE
// ==========================================
function validateParsedFile(parsedFile, existingFarms) {
    const farmIdSet = new Set(existingFarms.map((f) => f.farmId.toUpperCase()));
    const validatedRows = [];
    // Create lookup of header to mapped field
    const headerMap = new Map();
    parsedFile.mappings.forEach((m) => {
        if (m.mappedField !== 'ignore') {
            headerMap.set(m.fileHeader, m.mappedField);
        }
    });
    parsedFile.rawRows.forEach((rawRow) => {
        const rowErrors = [];
        const rowValues = {};
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
        }
        else {
            const parsedDate = parseFlexibleDate(rawDate, parsedFile.dateFormatPreference);
            if (parsedDate.isoDate) {
                submissionDate = parsedDate.isoDate;
            }
            else {
                rowErrors.push({
                    field: 'submissionDate',
                    value: rawDate,
                    reason: parsedDate.error || 'Invalid date',
                });
            }
        }
        const rowWarnings = [];
        // Helper to validate and parse numeric fields
        const checkNumericField = (fieldName, rawVal, allowNegative = false, isFormulaErrorAllowed = false) => {
            if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
                return undefined;
            }
            const strVal = String(rawVal).trim();
            if (strVal.startsWith('#')) {
                rowWarnings.push({
                    field: fieldName,
                    message: `Formula error (${strVal}) encountered in workbook and safely treated as empty`,
                });
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
        const mappedFeedGmsPerBird = checkNumericField('feedGramsPerBird', rowValues.feedGramsPerBird, false);
        // Preserve Week Number (clean float/decimal formatting) and Week Label
        let weekNumber = undefined;
        let weekLabel = undefined;
        if (rowValues.weekNumber !== undefined && rowValues.weekNumber !== null && String(rowValues.weekNumber).trim() !== '') {
            const rawWk = String(rowValues.weekNumber).trim();
            weekLabel = rawWk;
            const wkNum = Number(rawWk);
            if (!isNaN(wkNum)) {
                weekNumber = Number(wkNum.toFixed(1));
            }
            else {
                weekNumber = rawWk;
            }
        }
        // Feed Unit Normalization & Grams per bird calculation
        if (feedKg === undefined && feedGrams !== undefined && feedGrams > 0) {
            feedKg = parseFloat((feedGrams / 1000).toFixed(2));
        }
        const feedGramsPerBird = mappedFeedGmsPerBird !== undefined
            ? mappedFeedGmsPerBird
            : feedKg !== undefined && birdCount && birdCount > 0
                ? Math.round((feedKg * 1000) / birdCount)
                : feedGrams;
        const openingBirdCount = birdCount;
        const totalDeductions = (mortality || 0) + (culling || 0);
        const closingBirdCount = openingBirdCount !== undefined ? Math.max(0, openingBirdCount - totalDeductions) : undefined;
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
            }
            else if (ammoniaPpm > 10) {
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
        }
        else if (selectionEggs > eggsProduced && eggsProduced > 0) {
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
        // Non-blocking warning for placeholder / future date records where no real production or feed has been entered
        if (parsedFile.detectedRecordType === 'DAILY_REPORT') {
            const hasInputs = Boolean((rowValues.eggsProduced && rowValues.eggsProduced !== '') ||
                (rowValues.feedKg && rowValues.feedKg !== '') ||
                (rowValues.selectionEggs && rowValues.selectionEggs !== '') ||
                (rowValues.mortality && rowValues.mortality !== '') ||
                (rowValues.culling && rowValues.culling !== ''));
            if (!hasInputs && eggsProduced === 0 && feedKg === undefined) {
                rowWarnings.push({
                    field: 'eggsProduced',
                    message: 'No egg production or feed usage logged for this date (future/placeholder row)',
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
            weekLabel,
            birdCount: closingBirdCount ?? openingBirdCount,
            openingBirdCount,
            closingBirdCount,
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
async function checkServerConflicts(rows) {
    const validRows = rows.filter((r) => r.isValid && !r.isExcluded);
    if (validRows.length === 0)
        return rows;
    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const user = firebase_1.auth.currentUser;
    // 1. Try Backend API first if user is logged in
    if (user) {
        try {
            const idToken = await user.getIdToken();
            const recordsPayload = validRows.map((r) => ({
                recordType: r.recordType,
                farmId: r.farmId,
                submissionDate: r.submissionDate,
                birdCount: r.birdCount,
                openingBirdCount: r.openingBirdCount,
                closingBirdCount: r.closingBirdCount,
                feedKg: r.feedKg,
                mortality: r.mortality,
                culling: r.culling,
                eggsProduced: r.eggsProduced,
                selectionEggs: r.selectionEggs,
                temperature: r.temperature,
                weekNumber: typeof r.weekNumber === 'number' ? Math.floor(r.weekNumber) : undefined,
                weekLabel: r.weekLabel,
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
                const results = json.data.results;
                return rows.map((r) => {
                    if (!r.isValid || r.isExcluded)
                        return r;
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
        }
        catch (err) {
            console.warn('[historicalImportService] Backend check-conflicts failed, falling back to direct Firestore check:', err);
        }
    }
    // 2. Fallback: Direct Firestore Query
    const farmIds = Array.from(new Set(validRows.map((r) => r.farmId)));
    const existingLocks = new Map();
    const existingReports = new Map();
    for (const farmId of farmIds) {
        try {
            const lockSnap = await firebase_1.db.collection('dailyReportLocks').where('farmId', '==', farmId).get();
            lockSnap.docs.forEach((d) => {
                const data = d.data();
                existingLocks.set(`${data.farmId}_${data.submissionDate}`, data);
            });
        }
        catch { }
        try {
            const repSnap = await firebase_1.db.collection('dailyReports').where('farmId', '==', farmId).get();
            repSnap.docs.forEach((d) => {
                const data = d.data();
                const dStr = data.submissionDate || data.reportDate;
                if (dStr)
                    existingReports.set(`${data.farmId}_${dStr}`, data);
            });
        }
        catch { }
        try {
            const dailyLogsSnap = await firebase_1.db.collectionGroup('dailyLogs').get();
            dailyLogsSnap.docs.forEach((d) => {
                const data = d.data();
                const fId = data.farmId;
                const dStr = data.submissionDate || data.reportDate;
                if (fId === farmId && dStr) {
                    const key = `${fId}_${dStr}`;
                    if (!existingReports.has(key)) {
                        existingReports.set(key, data);
                    }
                }
            });
        }
        catch { }
    }
    return rows.map((r) => {
        if (!r.isValid || r.isExcluded)
            return r;
        const key = `${r.farmId}_${r.submissionDate}`;
        const existing = existingReports.get(key) || existingLocks.get(key);
        if (!existing) {
            return { ...r, conflictStatus: 'NEW' };
        }
        // Compare fields
        const diff = {};
        let isConflict = false;
        const checkFields = ['birdCount', 'feedKg', 'mortality', 'culling', 'eggsProduced'];
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
/**
 * Recursively sanitizes data before writing to Firestore.
 * Converts any `undefined` properties to `null` to prevent Firebase JS SDK error:
 * "Unsupported field value: undefined".
 */
function sanitizeFirestoreData(data) {
    if (data === undefined) {
        return null;
    }
    if (data === null || typeof data !== 'object') {
        return data;
    }
    if (data instanceof Date) {
        return data;
    }
    if (Array.isArray(data)) {
        return data.map((item) => sanitizeFirestoreData(item));
    }
    const cleanObj = {};
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) {
            cleanObj[key] = null;
        }
        else if (value !== null && typeof value === 'object') {
            cleanObj[key] = sanitizeFirestoreData(value);
        }
        else {
            cleanObj[key] = value;
        }
    }
    return cleanObj;
}
async function executeHistoricalImport(validatedRows, conflictAction, onProgress, options) {
    const rowsToImport = validatedRows.filter((r) => r.isValid && !r.isExcluded);
    if (rowsToImport.length === 0) {
        throw new Error('No valid rows available to import');
    }
    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const user = firebase_1.auth.currentUser;
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
                openingBirdCount: r.openingBirdCount,
                closingBirdCount: r.closingBirdCount,
                feedKg: r.feedKg,
                feedGrams: r.feedGrams,
                feedG: r.feedGrams,
                feedGramsPerBird: r.feedGramsPerBird,
                weekNumber: typeof r.weekNumber === 'number' ? Math.floor(r.weekNumber) : undefined,
                weekLabel: r.weekLabel,
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
            else {
                throw new Error(`Backend import failed: HTTP ${res.status}`);
            }
        }
        catch (err) {
            if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
                throw new Error('Network error during import. The outcome is unknown. Please check your import history before retrying.');
            }
            throw err;
        }
    }
    // 2. Direct Firestore fallback (Bounded Batches)
    const now = new Date().toISOString();
    let importedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    let conflictCount = 0;
    const errors = [];
    const manifest = [];
    // Lookup farmers
    const farmToUsersMap = new Map();
    try {
        const usersSnap = await firebase_1.db.collection('users').where('role', '==', 'farmer').get();
        usersSnap.docs.forEach((u) => {
            const udata = u.data() || {};
            if (udata.active === false)
                return;
            const rawFarmIds = Array.isArray(udata.farmIds)
                ? udata.farmIds
                : typeof udata.farmId === 'string' && udata.farmId.trim()
                    ? [udata.farmId.trim()]
                    : [];
            rawFarmIds.forEach((fId) => {
                if (!fId || typeof fId !== 'string')
                    return;
                const cleanFId = fId.trim().toUpperCase();
                if (!farmToUsersMap.has(cleanFId)) {
                    farmToUsersMap.set(cleanFId, new Set());
                }
                farmToUsersMap.get(cleanFId).add(u.id);
            });
        });
    }
    catch (err) {
        console.warn('[historicalImportService] Error loading farmer map:', err);
    }
    const adminUid = user?.uid || 'admin';
    const BATCH_SIZE = 100; // 100 rows * 3 writes = 300 operations (safe under 500)
    const totalBatches = Math.ceil(rowsToImport.length / BATCH_SIZE);
    for (let b = 0; b < totalBatches; b++) {
        const chunk = rowsToImport.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batch = !options?.dryRun && typeof firebase_1.db?.batch === 'function' ? firebase_1.db.batch() : null;
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
            if (row.recordType === 'DAILY_REPORT') {
                const cleanFId = row.farmId ? row.farmId.trim().toUpperCase() : '';
                const matchedFarmers = Array.from(farmToUsersMap.get(cleanFId) || []);
                if (matchedFarmers.length === 0) {
                    errors.push({
                        file: row.fileName,
                        row: row.rowNumber,
                        reason: `No registered farmer assigned to farm '${row.farmId}'. Cannot resolve report path.`,
                    });
                    return;
                }
                if (matchedFarmers.length > 1) {
                    errors.push({
                        file: row.fileName,
                        row: row.rowNumber,
                        reason: `Ambiguous farmer mapping for farm '${row.farmId}'. Multiple farmers assigned (${matchedFarmers.join(', ')}). Cannot resolve report path.`,
                    });
                    return;
                }
                const assignedUserId = matchedFarmers[0];
                const identityKey = `${row.farmId}_${row.submissionDate}`;
                const docId = row.flockId ? `${row.submissionDate}_${row.flockId}` : row.submissionDate;
                const parentRef = firebase_1.db?.collection ? firebase_1.db.collection('dailyReports').doc(assignedUserId) : null;
                const dailyLogRef = parentRef?.collection ? parentRef.collection('dailyLogs').doc(docId) : null;
                const lockRef = firebase_1.db?.collection ? firebase_1.db.collection('dailyReportLocks').doc(identityKey) : null;
                const openingBirdCount = row.openingBirdCount ?? row.birdCount ?? null;
                const mortality = row.mortality ?? 0;
                const culling = row.culling ?? 0;
                const closingBirdCount = row.closingBirdCount ??
                    (openingBirdCount != null ? Math.max(0, openingBirdCount - (mortality + culling)) : null);
                let intWeekNumber = null;
                if (row.weekNumber != null) {
                    intWeekNumber =
                        typeof row.weekNumber === 'number'
                            ? Math.floor(row.weekNumber)
                            : parseInt(String(row.weekNumber), 10);
                    if (isNaN(intWeekNumber))
                        intWeekNumber = null;
                }
                const weekLabel = row.weekLabel || (row.weekNumber != null ? String(row.weekNumber) : null);
                const reportData = {
                    userId: assignedUserId,
                    submittedBy: adminUid,
                    farmId: row.farmId,
                    flockId: row.flockId || '',
                    submissionDate: row.submissionDate,
                    submissionMethod: 'HISTORICAL_IMPORT',
                    submissionVersion: row.conflictStatus === 'CONFLICT' ? 2 : 1,
                    status: 'submitted',
                    openingBirdCount,
                    closingBirdCount,
                    birdCount: closingBirdCount ?? openingBirdCount ?? null,
                    feedKg: row.feedKg ?? null,
                    feedGrams: row.feedGrams ?? (row.feedKg != null ? row.feedKg * 1000 : null),
                    feedG: row.feedGrams ?? (row.feedKg != null ? row.feedKg * 1000 : null),
                    feedGramsPerBird: row.feedGramsPerBird ??
                        (openingBirdCount && row.feedKg
                            ? Number(((row.feedKg * 1000) / openingBirdCount).toFixed(1))
                            : null),
                    weekNumber: intWeekNumber,
                    weekLabel,
                    mortality,
                    culling,
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
                    eggWeight: row.eggWeight ?? null,
                    bodyWeight: row.bodyWeight ?? null,
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
                    if (row.bodyWeight && (row.bodyWeight.avg > 0 || row.bodyWeight.min > 0) && intWeekNumber) {
                        const weeklyLockRef = firebase_1.db?.collection ? firebase_1.db.collection('dailyReportLocks').doc(`weekly_${row.farmId}_W${intWeekNumber}`) : null;
                        if (weeklyLockRef) {
                            batch.set(weeklyLockRef, {
                                farmId: row.farmId,
                                weekNumber: intWeekNumber,
                                reportDate: row.submissionDate,
                                bodyWeight: row.bodyWeight,
                                ammoniaPpm: row.ammoniaPpm ?? null,
                                submittedBy: assignedUserId,
                                submittedAt: now,
                                updatedAt: now,
                                importBatchId: batchId,
                                isHistorical: true,
                            }, { merge: true });
                        }
                    }
                }
                importedCount++;
                manifest.push({
                    recordType: 'DAILY_REPORT',
                    action: row.conflictStatus === 'CONFLICT' ? 'UPDATED' : 'CREATED',
                    farmId: row.farmId,
                    submissionDate: row.submissionDate,
                    sourceFile: row.fileName,
                    targetDocs: [
                        { collectionPath: `dailyReports/${assignedUserId}/dailyLogs`, docId },
                        { collectionPath: 'dailyReportLocks', docId: identityKey },
                    ],
                    beforeData: row.diff || null,
                    importedAt: now,
                });
            }
            else if (row.recordType === 'FEED_LOAD') {
                const feedLogRef = firebase_1.db?.collection ? firebase_1.db.collection('logs').doc(row.farmId).collection('feedLogs').doc() : null;
                const txRef = firebase_1.db?.collection ? firebase_1.db.collection('farms').doc(row.farmId).collection('feedTransactions').doc() : null;
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
                    sourceFile: row.fileName,
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
    // Build worksheet contributions
    const worksheetKeys = Array.from(new Set(rowsToImport.map((r) => r.fileName)));
    const worksheets = worksheetKeys.map((wsKey) => {
        const wsRows = rowsToImport.filter((r) => r.fileName === wsKey);
        const wsManifest = manifest.filter((m) => m.sourceFile === wsKey);
        const wsErrors = errors.filter((e) => e.file === wsKey);
        const sheetMatch = wsKey.match(/^(.*?)\s*\[(.*?)\]$/);
        const fileName = sheetMatch ? sheetMatch[1].trim() : wsKey;
        const sheetName = sheetMatch ? sheetMatch[2].trim() : null;
        const dates = wsRows.map((r) => r.submissionDate).filter(Boolean).sort();
        const minDate = dates[0] || '';
        const maxDate = dates[dates.length - 1] || '';
        const createdCount = wsManifest.filter((m) => m.action === 'CREATED').length;
        const updatedCount = wsManifest.filter((m) => m.action === 'UPDATED').length;
        const countImported = wsManifest.length;
        const countFailed = wsErrors.length;
        const countSkipped = wsRows.length - countImported - countFailed;
        const farmId = wsRows[0]?.farmId || '';
        return {
            worksheetKey: wsKey,
            fileName,
            sheetName,
            farmId,
            status: (countFailed > 0 ? 'IMPORTED_WITH_ERRORS' : 'IMPORTED'),
            importedCount: countImported,
            createdCount,
            updatedCount,
            skippedCount: Math.max(0, countSkipped),
            failedCount: countFailed,
            dateRange: minDate && maxDate ? { minDate, maxDate } : null,
            importTimestamp: now,
            revertStatus: 'NOT_REVERTED',
            canSafelyRevert: countImported > 0,
        };
    });
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
            worksheets,
            status: 'SIMULATED',
            isDryRun: true,
        };
    }
    // Save batch audit record
    const status = errors.length === 0 ? 'COMPLETED' : importedCount > 0 ? 'PARTIAL_FAILURE' : 'FAILED';
    const rawBatchRecord = {
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
        worksheets,
        revertStatus: 'NOT_REVERTED',
    };
    const batchRecord = sanitizeFirestoreData(rawBatchRecord);
    let historyWriteFailed = false;
    let historyWriteError = undefined;
    if (firebase_1.db?.collection) {
        try {
            await firebase_1.db.collection('importBatches').doc(batchId).set(batchRecord);
        }
        catch (e) {
            historyWriteFailed = true;
            historyWriteError = e instanceof Error ? e.message : String(e);
            console.error('[historicalImportService] CRITICAL: Failed writing importBatches document:', e);
        }
    }
    else {
        historyWriteFailed = true;
        historyWriteError = 'Firestore database client unavailable';
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
        worksheets,
        status,
        historyWriteFailed,
        historyWriteError,
        rawBatchRecord: batchRecord,
    };
}
/**
 * Saves or retries saving an import batch audit record directly to Firestore.
 */
async function saveImportBatchRecord(batchRecord) {
    const clean = sanitizeFirestoreData(batchRecord);
    if (!clean || !clean.batchId) {
        throw new Error('Invalid batch record: missing batchId');
    }
    if (!firebase_1.db?.collection) {
        throw new Error('Firestore database client unavailable');
    }
    await firebase_1.db.collection('importBatches').doc(clean.batchId).set(clean);
}
// ==========================================
// IMPORT HISTORY & AUDIT
// ==========================================
async function fetchImportBatches() {
    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const user = firebase_1.auth.currentUser;
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
        }
        catch { }
    }
    // Direct Firestore fallback
    try {
        const snap = await firebase_1.db.collection('importBatches').orderBy('importTimestamp', 'desc').limit(50).get();
        return snap.docs.map((d) => d.data());
    }
    catch (err) {
        console.error('[fetchImportBatches] Failed:', err);
        throw new Error(`Failed to load import batches from database: ${err instanceof Error ? err.message : String(err)}`);
    }
}
function generateErrorReportCsv(errors) {
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
async function fetchRevertPreview(batchId, worksheetKey) {
    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const user = firebase_1.auth.currentUser;
    if (user) {
        try {
            const idToken = await user.getIdToken();
            const url = `${backendUrl}/api/v1/admin/import/batches/${batchId}/revert-preview${worksheetKey ? `?worksheetKey=${encodeURIComponent(worksheetKey)}` : ''}`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${idToken}` },
            });
            if (res.ok) {
                const json = await res.json();
                return json.data;
            }
        }
        catch (e) {
            console.warn('[fetchRevertPreview] Backend request failed, falling back to direct Firestore:', e);
        }
    }
    // Direct Firestore fallback
    const batchDoc = await firebase_1.db.collection('importBatches').doc(batchId).get();
    if (!batchDoc.exists)
        throw new Error(`Import batch '${batchId}' not found`);
    const batch = batchDoc.data();
    const ws = worksheetKey
        ? batch.worksheets?.find((w) => w.worksheetKey === worksheetKey ||
            w.fileName === worksheetKey ||
            (w.sheetName && w.sheetName === worksheetKey))
        : undefined;
    const isWsAlreadyReverted = ws ? ws.revertStatus === 'REVERTED' : batch.revertStatus === 'REVERTED';
    const isBatchReverting = batch.revertStatus === 'REVERTING';
    if (isWsAlreadyReverted) {
        return {
            batchId,
            worksheetKey,
            worksheetName: ws?.sheetName || ws?.fileName || worksheetKey,
            importTimestamp: batch.importTimestamp,
            filenames: ws ? [ws.fileName] : (batch.filenames || []),
            affectedFarms: ws?.farmId ? [ws.farmId] : (batch.affectedFarms || []),
            totalImported: ws ? ws.importedCount : (batch.importedCount || 0),
            canSafelyRevert: 0,
            requiresReview: 0,
            willDelete: 0,
            willRestore: 0,
            isReversible: false,
            revertStatus: 'REVERTED',
            notReversibleReason: worksheetKey
                ? `Worksheet '${ws?.sheetName || worksheetKey}' has already been reverted.`
                : 'This batch has already been reverted.',
            sampleRecords: [],
        };
    }
    if (isBatchReverting) {
        return {
            batchId,
            worksheetKey,
            worksheetName: ws?.sheetName || ws?.fileName || worksheetKey,
            importTimestamp: batch.importTimestamp,
            filenames: ws ? [ws.fileName] : (batch.filenames || []),
            affectedFarms: ws?.farmId ? [ws.farmId] : (batch.affectedFarms || []),
            totalImported: ws ? ws.importedCount : (batch.importedCount || 0),
            canSafelyRevert: 0,
            requiresReview: 0,
            willDelete: 0,
            willRestore: 0,
            isReversible: false,
            revertStatus: 'REVERTING',
            notReversibleReason: 'This batch is currently being reverted.',
            sampleRecords: [],
        };
    }
    const allManifest = batch.manifest || [];
    const manifest = worksheetKey
        ? allManifest.filter((m) => m.sourceFile === worksheetKey ||
            (ws && m.sourceFile === ws.worksheetKey) ||
            (ws && ws.sheetName && m.sourceFile && m.sourceFile.includes(ws.sheetName)) ||
            (ws && ws.farmId && m.farmId === ws.farmId))
        : allManifest.filter((m) => m.reversalStatus !== 'REVERTED');
    let canSafelyRevert = 0;
    let requiresReview = 0;
    let willDelete = 0;
    let willRestore = 0;
    const sampleRecords = [];
    for (const item of manifest) {
        let isSafe = true;
        let reason;
        // Concurrency check against Firestore
        try {
            for (const tDoc of item.targetDocs || []) {
                const docSnap = await firebase_1.db.collection(tDoc.collectionPath).doc(tDoc.docId).get();
                if (!docSnap.exists)
                    continue;
                const data = docSnap.data() || {};
                if (data.importBatchId && data.importBatchId !== batchId) {
                    isSafe = false;
                    reason = `Record touched by later import '${data.importBatchId}'`;
                    break;
                }
                if (item.action === 'CREATED' && item.submissionVersion && data.submissionVersion && data.submissionVersion > item.submissionVersion) {
                    isSafe = false;
                    reason = `Record has subsequent manual edits (v${data.submissionVersion})`;
                    break;
                }
            }
        }
        catch { }
        if (item.action === 'UPDATED' && !item.beforeData) {
            isSafe = false;
            reason = 'Pre-import state snapshot missing';
        }
        if (isSafe) {
            canSafelyRevert++;
            if (item.action === 'CREATED')
                willDelete++;
            if (item.action === 'UPDATED')
                willRestore++;
        }
        else {
            requiresReview++;
        }
        if (sampleRecords.length < 50) {
            sampleRecords.push({
                farmId: item.farmId,
                submissionDate: item.submissionDate,
                recordType: item.recordType || 'DAILY_REPORT',
                action: item.action || 'CREATED',
                sourceFile: item.sourceFile,
                canSafelyRevert: isSafe,
                reason,
            });
        }
    }
    const affectedFarms = ws?.farmId
        ? [ws.farmId]
        : batch.affectedFarms && batch.affectedFarms.length > 0
            ? batch.affectedFarms
            : Array.from(new Set(manifest.map((m) => m.farmId)));
    return {
        batchId,
        worksheetKey,
        worksheetName: ws?.sheetName || ws?.fileName || worksheetKey,
        importTimestamp: batch.importTimestamp,
        filenames: ws ? [ws.fileName] : (batch.filenames || []),
        affectedFarms,
        totalImported: ws ? ws.importedCount : (batch.importedCount || manifest.length || 0),
        canSafelyRevert,
        requiresReview,
        willDelete,
        willRestore,
        isReversible: canSafelyRevert > 0,
        revertStatus: ws?.revertStatus || batch.revertStatus || 'NOT_REVERTED',
        notReversibleReason: canSafelyRevert === 0 ? 'No reversible records found' : undefined,
        sampleRecords,
    };
}
async function executeRevertImportBatch(batchId, confirmationBatchId, worksheetKey) {
    const backendUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    const user = firebase_1.auth.currentUser;
    if (user) {
        try {
            const idToken = await user.getIdToken();
            const res = await fetch(`${backendUrl}/api/v1/admin/import/batches/${batchId}/revert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ confirmationBatchId, worksheetKey }),
            });
            if (res.ok) {
                const json = await res.json();
                return json.data;
            }
            else {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.message || `Revert failed with status ${res.status}`);
            }
        }
        catch (e) {
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
    const batchRef = firebase_1.db.collection('importBatches').doc(batchId);
    const batchDoc = await batchRef.get();
    if (!batchDoc.exists)
        throw new Error(`Import batch '${batchId}' not found`);
    const batch = batchDoc.data();
    const ws = worksheetKey
        ? batch.worksheets?.find((w) => w.worksheetKey === worksheetKey ||
            w.fileName === worksheetKey ||
            (w.sheetName && w.sheetName === worksheetKey))
        : undefined;
    if (worksheetKey && ws && ws.revertStatus === 'REVERTED') {
        throw new Error(`Worksheet '${ws.sheetName || worksheetKey}' has already been reverted`);
    }
    if (!worksheetKey && batch.revertStatus === 'REVERTED') {
        throw new Error('This batch has already been reverted');
    }
    await batchRef.update({ revertStatus: 'REVERTING' });
    const allManifest = batch.manifest || [];
    const manifestToRevert = worksheetKey
        ? allManifest.filter((m) => m.sourceFile === worksheetKey ||
            (ws && m.sourceFile === ws.worksheetKey) ||
            (ws && ws.sheetName && m.sourceFile && m.sourceFile.includes(ws.sheetName)) ||
            (ws && ws.farmId && m.farmId === ws.farmId))
        : allManifest.filter((m) => m.reversalStatus !== 'REVERTED');
    let deletedCount = 0;
    let restoredCount = 0;
    let conflictCount = 0;
    let failedCount = 0;
    const errors = [];
    for (let i = 0; i < manifestToRevert.length; i += 75) {
        const chunk = manifestToRevert.slice(i, i + 75);
        const writeBatch = firebase_1.db.batch();
        for (const item of chunk) {
            try {
                if (item.action === 'CREATED') {
                    let canDelete = true;
                    const refsToDelete = [];
                    for (const tDoc of item.targetDocs || []) {
                        const docRef = firebase_1.db.collection(tDoc.collectionPath).doc(tDoc.docId);
                        const snap = await docRef.get();
                        if (!snap.exists)
                            continue;
                        const data = snap.data() || {};
                        if (data.importBatchId && data.importBatchId !== batchId) {
                            canDelete = false;
                            errors.push({ docId: tDoc.docId, reason: `Modified by another batch '${data.importBatchId}'` });
                            break;
                        }
                        if (item.submissionVersion && data.submissionVersion && data.submissionVersion > item.submissionVersion) {
                            canDelete = false;
                            errors.push({ docId: tDoc.docId, reason: `Subsequent edits detected (v${data.submissionVersion})` });
                            break;
                        }
                        refsToDelete.push(docRef);
                    }
                    if (!canDelete) {
                        conflictCount++;
                        item.reversalStatus = 'CONFLICT';
                        continue;
                    }
                    for (const ref of refsToDelete) {
                        writeBatch.delete(ref);
                    }
                    item.reversalStatus = 'REVERTED';
                    deletedCount++;
                }
                else if (item.action === 'UPDATED') {
                    if (!item.beforeData) {
                        conflictCount++;
                        item.reversalStatus = 'CONFLICT';
                        errors.push({ docId: `${item.farmId}_${item.submissionDate}`, reason: 'Pre-import state missing' });
                        continue;
                    }
                    for (const tDoc of item.targetDocs || []) {
                        const docRef = firebase_1.db.collection(tDoc.collectionPath).doc(tDoc.docId);
                        const snap = await docRef.get();
                        if (snap.exists) {
                            const data = snap.data() || {};
                            if (data.importBatchId && data.importBatchId !== batchId) {
                                conflictCount++;
                                item.reversalStatus = 'CONFLICT';
                                errors.push({ docId: tDoc.docId, reason: `Modified by another batch '${data.importBatchId}'` });
                                continue;
                            }
                        }
                        const restoreData = { ...item.beforeData };
                        delete restoreData.importBatchId;
                        writeBatch.set(docRef, restoreData);
                    }
                    item.reversalStatus = 'REVERTED';
                    restoredCount++;
                }
            }
            catch (err) {
                failedCount++;
                errors.push({ reason: err.message || 'Item revert failed' });
            }
        }
        await writeBatch.commit();
    }
    const revertTimestamp = new Date().toISOString();
    const wsFinalStatus = failedCount > 0 ? 'REVERT_FAILED' : conflictCount > 0 ? 'REVERT_CONFLICT' : 'REVERTED';
    let updatedWorksheets = batch.worksheets || [];
    if (worksheetKey) {
        updatedWorksheets = updatedWorksheets.map((w) => {
            if (w.worksheetKey === worksheetKey ||
                w.fileName === worksheetKey ||
                (w.sheetName && w.sheetName === worksheetKey) ||
                (ws && w.worksheetKey === ws.worksheetKey)) {
                return {
                    ...w,
                    status: wsFinalStatus,
                    revertStatus: wsFinalStatus,
                    revertTimestamp,
                    revertAudit: {
                        deletedCount,
                        restoredCount,
                        failedCount,
                        conflictsCount: conflictCount,
                    },
                };
            }
            return w;
        });
    }
    else {
        updatedWorksheets = updatedWorksheets.map((w) => ({
            ...w,
            status: wsFinalStatus,
            revertStatus: wsFinalStatus,
            revertTimestamp,
            revertAudit: {
                deletedCount,
                restoredCount,
                failedCount,
                conflictsCount: conflictCount,
            },
        }));
    }
    let overallBatchStatus;
    if (worksheetKey) {
        const allReverted = updatedWorksheets.length > 0 && updatedWorksheets.every((w) => w.revertStatus === 'REVERTED');
        const anyReverted = updatedWorksheets.some((w) => w.revertStatus === 'REVERTED' || w.revertStatus === 'PARTIALLY_REVERTED');
        overallBatchStatus = allReverted
            ? 'REVERTED'
            : anyReverted
                ? 'PARTIALLY_REVERTED'
                : conflictCount > 0
                    ? 'REVERT_REQUIRES_REVIEW'
                    : 'PARTIALLY_REVERTED';
    }
    else {
        overallBatchStatus = failedCount > 0 ? 'PARTIALLY_REVERTED' : conflictCount > 0 ? 'REVERT_REQUIRES_REVIEW' : 'REVERTED';
    }
    await batchRef.update({
        revertStatus: overallBatchStatus,
        worksheets: updatedWorksheets,
        manifest: allManifest,
        revertAudit: {
            revertOperationId: `client_revert_${Date.now()}`,
            revertedByUid: user?.uid || 'admin',
            revertedByEmail: user?.email || null,
            revertTimestamp,
            deletedRecordsCount: (batch.revertAudit?.deletedRecordsCount || 0) + deletedCount,
            restoredRecordsCount: (batch.revertAudit?.restoredRecordsCount || 0) + restoredCount,
            conflictsCount: (batch.revertAudit?.conflictsCount || 0) + conflictCount,
            failedCount: (batch.revertAudit?.failedCount || 0) + failedCount,
        },
    });
    return {
        revertOperationId: `client_revert_${Date.now()}`,
        batchId,
        worksheetKey,
        status: overallBatchStatus,
        worksheetStatus: worksheetKey ? wsFinalStatus : undefined,
        deletedCount,
        restoredCount,
        skippedCount: 0,
        conflictCount,
        failedCount,
        errors,
    };
}
/**
 * Extracts or synthesizes worksheet contributions from an import batch document.
 */
function getBatchWorksheets(batch) {
    if (batch.worksheets && Array.isArray(batch.worksheets) && batch.worksheets.length > 0) {
        return batch.worksheets;
    }
    const filenames = batch.filenames || [];
    if (filenames.length === 0)
        return [];
    return filenames.map((fName, idx) => {
        const sheetMatch = fName.match(/^(.*?)\s*\[(.*?)\]$/);
        const fileName = sheetMatch ? sheetMatch[1].trim() : fName;
        const sheetName = sheetMatch ? sheetMatch[2].trim() : undefined;
        const manifestItems = (batch.manifest || []).filter((m) => m.sourceFile === fName || (sheetName && m.sourceFile && m.sourceFile.includes(sheetName)));
        const importedCount = manifestItems.length > 0 ? manifestItems.length : Math.round((batch.importedCount || 0) / filenames.length);
        const isReverted = batch.revertStatus === 'REVERTED';
        let farmId = manifestItems[0]?.farmId;
        if (!farmId && sheetName && (batch.affectedFarms || []).includes(sheetName)) {
            farmId = sheetName;
        }
        if (!farmId) {
            farmId = batch.affectedFarms?.[idx] || batch.affectedFarms?.[0] || '';
        }
        return {
            worksheetKey: fName,
            fileName,
            sheetName,
            farmId,
            status: (isReverted ? 'REVERTED' : batch.revertStatus === 'PARTIALLY_REVERTED' ? 'PARTIALLY_REVERTED' : 'IMPORTED'),
            importedCount,
            createdCount: manifestItems.filter((m) => m.action === 'CREATED').length,
            updatedCount: manifestItems.filter((m) => m.action === 'UPDATED').length,
            skippedCount: 0,
            failedCount: 0,
            importTimestamp: batch.importTimestamp || '',
            revertStatus: isReverted ? 'REVERTED' : 'NOT_REVERTED',
            canSafelyRevert: !isReverted && importedCount > 0,
        };
    });
}
//# sourceMappingURL=historicalImportService.js.map