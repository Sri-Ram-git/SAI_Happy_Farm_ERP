import { describe, it, expect } from 'vitest';
import { AuditLogEntry } from '../types/reports';
import { UserRole } from '../types/auth';

describe('Types', () => {
  it('should have correct UserRole values', () => {
    expect(UserRole.FARMER).toBe('farmer');
    expect(UserRole.SUPERVISOR).toBe('supervisor');
    expect(UserRole.OFFICE_STAFF).toBe('office_staff');
    expect(UserRole.ADMIN).toBe('admin');
  });

  it('should define AuditLogEntry structure', () => {
    const entry: AuditLogEntry = {
      eventType: 'REPORT_CREATED',
      uid: 'user123',
      farmId: 'AP12',
      resourceId: 'report123',
      timestamp: new Date().toISOString(),
      requestId: 'req123',
    };

    expect(entry.eventType).toBe('REPORT_CREATED');
    expect(entry.uid).toBe('user123');
    expect(entry.farmId).toBe('AP12');
    expect(entry.resourceId).toBe('report123');
    expect(entry.requestId).toBe('req123');
  });
});
