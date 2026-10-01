import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Firestore Security Rules Contract Verification', () => {
  const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');

  it('should find firestore.rules file', () => {
    expect(rulesContent.length).toBeGreaterThan(0);
  });

  describe('SEC-02: Cross-farm read restriction on /farms/{farmId}', () => {
    it('should require hasFarmAccess(farmId) on /farms/{farmId} read operations', () => {
      // Find the farms collection block
      const farmsBlockMatch = rulesContent.match(/match\s+\/farms\/\{farmId\}[\s\S]*?\{([\s\S]*?)\}/);
      expect(farmsBlockMatch).not.toBeNull();
      const farmsBlock = farmsBlockMatch![1];

      // Read rule must require hasFarmAccess(farmId)
      expect(farmsBlock).toMatch(/allow\s+read:\s*if[\s\S]*?hasFarmAccess\(farmId\)/);
      // Ensure it does not allow unrestricted reads
      expect(farmsBlock).not.toMatch(/allow\s+read:\s*if\s*true/);
    });
  });

  describe('SEC-03: Protected flock fields restriction on /flocks/{flockId}', () => {
    it('should restrict update on flocks to prevent tampering with protected business fields', () => {
      const flocksBlockMatch = rulesContent.match(/match\s+\/flocks\/\{flockId\}[\s\S]*?\{([\s\S]*?)\}/);
      expect(flocksBlockMatch).not.toBeNull();
      const flocksBlock = flocksBlockMatch![1];

      // Must restrict updates using affectedKeys
      expect(flocksBlock).toMatch(/allow\s+update:\s*if[\s\S]*?affectedKeys\(\)/);

      // Must protect critical fields
      const protectedFields = [
        'farmId',
        'flockId',
        'initialBirds',
        'startDate',
        'breedType',
        'productionCurve',
        'batchNumber',
        'isInitialFlock',
        'status',
      ];

      for (const field of protectedFields) {
        expect(flocksBlock).toContain(`'${field}'`);
      }
    });
  });

  describe('SEC-04: Daily report lock deletion restriction', () => {
    it('should restrict daily report lock deletion strictly to Admin', () => {
      const locksBlockMatch = rulesContent.match(/match\s+\/dailyReportLocks\/\{lockId\}[\s\S]*?\{([\s\S]*?)\}/);
      expect(locksBlockMatch).not.toBeNull();
      const locksBlock = locksBlockMatch![1];

      // Delete rule must be isAdmin()
      expect(locksBlock).toMatch(/allow\s+delete:\s*if\s*isAdmin\(\)/);
      // Supervisors or Farmers must NOT have delete permission
      expect(locksBlock).not.toMatch(/allow\s+delete:\s*if[\s\S]*?isSupervisor/);
      expect(locksBlock).not.toMatch(/allow\s+delete:\s*if[\s\S]*?hasFarmAccess/);
    });
  });

  describe('SEC-07: User profile privilege escalation restriction on /users/{userId}', () => {
    it('should prohibit users from modifying role, farmIds, active status, or email on their own profile', () => {
      const usersBlockMatch = rulesContent.match(/match\s+\/users\/\{userId\}[\s\S]*?\{([\s\S]*?)\}/);
      expect(usersBlockMatch).not.toBeNull();
      const usersBlock = usersBlockMatch![1];

      // Update rule must block privilege-bearing fields
      expect(usersBlock).toMatch(/allow\s+update:\s*if[\s\S]*?affectedKeys\(\)/);
      const escalationFields = ['role', 'farmIds', 'active', 'email', 'uid'];

      for (const field of escalationFields) {
        expect(usersBlock).toContain(`'${field}'`);
      }
    });
  });

  describe('CORRECTION-V2: Daily report revisions subcollection rule verification', () => {
    it('should have security rules for revisions subcollection under dailyLogs', () => {
      const revisionsBlockMatch = rulesContent.match(/match\s+\/revisions\/\{revId\}[\s\S]*?\{([\s\S]*?)\}/);
      expect(revisionsBlockMatch).not.toBeNull();
      const revisionsBlock = revisionsBlockMatch![1];

      // Must allow create/update for authorized users with farm access
      expect(revisionsBlock).toMatch(/allow\s+create,\s*update:\s*if[\s\S]*?hasFarmAccess\(request\.resource\.data\.farmId\)/);

      // Must restrict deletion to Admin
      expect(revisionsBlock).toMatch(/allow\s+delete:\s*if\s*isAdmin\(\)/);

      // Must require authentication and active user
      expect(revisionsBlock).toMatch(/isAuthenticated\(\)\s*&&\s*isUserActive\(\)/);
    });

    it('should have collection group query rule for revisions', () => {
      const cgRevisionsMatch = rulesContent.match(/match\s+\/\{path=\*\*\}\/revisions\/\{revDoc\}[\s\S]*?\{([\s\S]*?)\}/);
      expect(cgRevisionsMatch).not.toBeNull();
    });
  });
});
