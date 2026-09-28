import { z } from 'zod';
import { UserRole } from './auth';

export const DailyReportInputSchema = z
  .object({
    farmId: z.string().min(1, 'farmId is required'),
    birdCount: z.number().int().min(0, 'birdCount must be non-negative'),
    feedKg: z.number().min(0, 'feedKg must be non-negative'),
    mortality: z.number().int().min(0, 'mortality must be non-negative'),
    culling: z.number().int().min(0, 'culling must be non-negative'),
    eggsProduced: z.number().int().min(0, 'eggsProduced must be non-negative'),
    selectionEggs: z.number().int().min(0, 'selectionEggs must be non-negative'),
    damagedEggs: z.number().int().min(0, 'damagedEggs must be non-negative').optional().nullable(),
    floorEggs: z.number().int().min(0, 'floorEggs must be non-negative').optional().nullable(),
    temperature: z.number().min(10, 'temperature must be between 10 and 50 degrees').max(50, 'temperature must be between 10 and 50 degrees'),
    eggWeight: z.object({
      min: z.number().min(30, 'eggWeight min must be at least 30g').max(80, 'eggWeight min cannot exceed 80g'),
      max: z.number().min(30, 'eggWeight max must be at least 30g').max(80, 'eggWeight max cannot exceed 80g'),
      avg: z.number().min(30, 'eggWeight avg must be at least 30g').max(80, 'eggWeight avg cannot exceed 80g'),
    }),
    bodyWeight: z
      .object({
        min: z.number().min(500, 'bodyWeight min must be between 500g and 3000g').max(3000, 'bodyWeight min must be between 500g and 3000g'),
        max: z.number().min(500, 'bodyWeight max must be between 500g and 3000g').max(3000, 'bodyWeight max must be between 500g and 3000g'),
        avg: z.number().min(500, 'bodyWeight avg must be between 500g and 3000g').max(3000, 'bodyWeight avg must be between 500g and 3000g'),
      })
      .optional()
      .nullable(),
    remarks: z.string().max(1000, 'remarks must be 1000 characters or fewer').optional(),
    ammoniaPpm: z.number().finite().nonnegative().max(50, 'ammoniaPpm cannot exceed 50').optional().nullable(),
    feedGramsPerBird: z.number().finite().nonnegative().optional().nullable(),
    weekNumber: z.number().int().optional().nullable(),
    weekLabel: z.string().optional().nullable(),
  })
  .strict();

export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

export interface DailyReport {
  reportId: string;
  farmId: string;
  birdCount: number;
  feedKg: number;
  feedGramsPerBird?: number | null;
  mortality: number;
  culling: number;
  eggsProduced: number;
  selectionEggs: number;
  damagedEggs?: number;
  floorEggs?: number;
  temperature: number;
  eggWeight: {
    min: number;
    max: number;
    avg: number;
  };
  bodyWeight?: {
    min: number;
    max: number;
    avg: number;
  } | null;
  remarks: string;
  ammoniaPpm?: number | null;
  submittedBy: string;
  submissionDate: string;
  submissionMethod: 'DIGITAL_FORM' | 'WHATSAPP_OCR';
  createdAt: string;
}

export interface DailyReportResponse {
  reportId: string;
  farmId: string;
  submissionDate: string;
  submissionMethod: 'DIGITAL_FORM' | 'WHATSAPP_OCR';
}

export interface Farm {
  farmId: string;
  name: string;
  location: string;
  active: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export interface AuditLogEntry {
  eventType: string;
  uid: string;
  farmId?: string;
  resourceId?: string;
  timestamp: string;
  requestId: string;
  metadata?: Record<string, unknown>;
}

export interface UserRecord {
  uid: string;
  email: string;
  role: UserRole;
  farmIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
