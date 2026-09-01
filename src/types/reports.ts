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
    temperature: z.number(),
    eggWeight: z.object({
      min: z.number().min(0, 'eggWeight min must be non-negative'),
      max: z.number().min(0, 'eggWeight max must be non-negative'),
      avg: z.number().min(0, 'eggWeight avg must be non-negative'),
    }),
    bodyWeight: z.object({
      min: z.number().min(0, 'bodyWeight min must be non-negative'),
      max: z.number().min(0, 'bodyWeight max must be non-negative'),
      avg: z.number().min(0, 'bodyWeight avg must be non-negative'),
    }),
    remarks: z.string().max(1000, 'remarks must be 1000 characters or fewer').optional(),
    ammoniaPpm: z.number().finite().nonnegative().max(100),
  })
  .strict();

export type DailyReportInput = z.infer<typeof DailyReportInputSchema>;

export interface DailyReport {
  reportId: string;
  farmId: string;
  birdCount: number;
  feedKg: number;
  mortality: number;
  culling: number;
  eggsProduced: number;
  selectionEggs: number;
  temperature: number;
  eggWeight: {
    min: number;
    max: number;
    avg: number;
  };
  bodyWeight: {
    min: number;
    max: number;
    avg: number;
  };
  remarks: string;
  ammoniaPpm: number;
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
