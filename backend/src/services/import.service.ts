import { v4 as uuidv4 } from 'uuid';
import { getFirestore } from '../config/firebase';
import { AuthenticatedUser } from '../types/auth';
import {
  HistoricalImportRecord,
  ConflictItem,
  CheckConflictsRequest,
  CheckConflictsResponse,
  ExecuteImportRequest,
  ExecuteImportResponse,
  ImportBatchRecord,
  ImportBatchError,
  OverwrittenRecord,
  ImportManifestItem,
  ImportManifestTargetDoc,
  RevertPreviewResponse,
  RevertPreviewRecord,
  RevertBatchRequest,
  RevertBatchResponse,
  RevertBatchStatus,
} from '../types/import';
import { auditService } from './audit.service';
import { logger } from '../utils/logger';
import { InternalError, NotFoundError, ValidationError, DuplicateError } from '../utils/errors';

export class ImportService {
  private get db() {
    return getFirestore();
  }

  /**
   * Checks for existing records in Firestore matching farmId + submissionDate.
   * Categorizes each record as NEW, EXACT_DUPLICATE, or CONFLICT.
   */
  async checkConflicts(
    req: CheckConflictsRequest,
    _user: AuthenticatedUser,
    requestId: string,
  ): Promise<CheckConflictsResponse> {
    try {
      const records = req.records;
      const farmIds = Array.from(new Set(records.map((r) => r.farmId)));

      // Pre-fetch all dailyReportLocks for these farms to check duplicates fast
      const locksMap = new Map<string, any>();
      for (const farmId of farmIds) {
        const snap = await this.db
          .collection('dailyReportLocks')
          .where('farmId', '==', farmId)
          .get();
        snap.docs.forEach((doc) => {
          const d = doc.data();
          const key = `${d['farmId']}_${d['submissionDate']}`;
          locksMap.set(key, d);
        });
      }

      // Pre-fetch reports from top-level dailyReports for content comparison
      const reportsMap = new Map<string, any>();
      for (const farmId of farmIds) {
        const snap = await this.db
          .collection('dailyReports')
          .where('farmId', '==', farmId)
          .get();
        snap.docs.forEach((doc) => {
          const d = doc.data();
          const dateStr = d['submissionDate'] || d['reportDate'];
          if (dateStr) {
            const key = `${d['farmId']}_${dateStr}`;
            reportsMap.set(key, d);
          }
        });
      }

      // Also pre-fetch dailyLogs subcollections if needed
      try {
        const dailyLogsSnap = await this.db.collectionGroup('dailyLogs').get();
        dailyLogsSnap.docs.forEach((doc) => {
          const d = doc.data();
          const fId = d['farmId'];
          const dateStr = d['submissionDate'] || d['reportDate'];
          if (fId && dateStr && farmIds.includes(fId)) {
            const key = `${fId}_${dateStr}`;
            if (!reportsMap.has(key)) {
              reportsMap.set(key, d);
            }
          }
        });
      } catch (err) {
        logger.warn('Could not query collectionGroup dailyLogs in checkConflicts', { error: err });
      }

      const results: ConflictItem[] = [];
      let newCount = 0;
      let exactDuplicateCount = 0;
      let conflictCount = 0;

      records.forEach((record, index) => {
        const key = `${record.farmId}_${record.submissionDate}`;
        const hasLock = locksMap.has(key);
        const existingData = reportsMap.get(key) || (hasLock ? locksMap.get(key) : null);

        if (!existingData && !hasLock) {
          results.push({
            index,
            farmId: record.farmId,
            submissionDate: record.submissionDate,
            status: 'NEW',
          });
          newCount++;
          return;
        }

        // Compare values
        const diff: Record<string, { existing: any; proposed: any }> = {};
        let hasDifferences = false;

        const compareFields = [
          'birdCount',
          'feedKg',
          'mortality',
          'culling',
          'eggsProduced',
          'selectionEggs',
        ] as const;

        compareFields.forEach((field) => {
          const proposedVal = record[field];
          if (proposedVal !== undefined && proposedVal !== null) {
            const existingVal = existingData ? existingData[field] : undefined;
            if (existingVal !== undefined && Number(proposedVal) !== Number(existingVal)) {
              hasDifferences = true;
              diff[field] = { existing: existingVal, proposed: proposedVal };
            }
          }
        });

        if (hasDifferences) {
          results.push({
            index,
            farmId: record.farmId,
            submissionDate: record.submissionDate,
            status: 'CONFLICT',
            existingData,
            diff,
          });
          conflictCount++;
        } else {
          results.push({
            index,
            farmId: record.farmId,
            submissionDate: record.submissionDate,
            status: 'EXACT_DUPLICATE',
            existingData,
          });
          exactDuplicateCount++;
        }
      });

      return {
        results,
        summary: {
          total: records.length,
          newCount,
          exactDuplicateCount,
          conflictCount,
        },
      };
    } catch (error) {
      logger.error('Failed to check conflicts for historical import', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new InternalError('Failed to check import conflicts');
    }
  }

  /**
   * Executes the historical data import using bounded Firestore write batches.
   * Ensures idempotency, audit trail, and preserves master inventory safety.
   */
  async executeImport(
    req: ExecuteImportRequest,
    user: AuthenticatedUser,
    requestId: string,
  ): Promise<ExecuteImportResponse> {
    const batchId = req.batchId || `batch_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const now = new Date().toISOString();
    const records = req.records;
    const errors: ImportBatchError[] = [];
    const overwrittenRecords: OverwrittenRecord[] = [];
    const manifest: ImportManifestItem[] = [];

    let importedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    let conflictCount = 0;

    try {
      // 1. Verify all farms exist
      const farmIds = Array.from(new Set(records.map((r) => r.farmId)));
      const farmDocMap = new Map<string, any>();
      for (const farmId of farmIds) {
        const farmDoc = await this.db.collection('farms').doc(farmId).get();
        if (farmDoc.exists) {
          farmDocMap.set(farmId, farmDoc.data());
        }
      }

      // 2. Fetch existing farmers to map assigned userId
      const farmerUserMap = new Map<string, string>();
      const usersSnap = await this.db.collection('users').where('role', '==', 'farmer').get();
      usersSnap.docs.forEach((u) => {
        const udata = u.data();
        const uFarmIds: string[] = udata['farmIds'] || [];
        uFarmIds.forEach((fId) => {
          if (!farmerUserMap.has(fId)) {
            farmerUserMap.set(fId, u.id);
          }
        });
      });

      // 3. Pre-fetch existing locks and reports to check idempotency and handle conflicts
      const existingLocksMap = new Map<string, any>();
      for (const farmId of farmIds) {
        const lockSnap = await this.db
          .collection('dailyReportLocks')
          .where('farmId', '==', farmId)
          .get();
        lockSnap.docs.forEach((d) => {
          const lData = d.data();
          existingLocksMap.set(`${lData['farmId']}_${lData['submissionDate']}`, lData);
        });
      }

      const existingReportsMap = new Map<string, any>();
      for (const farmId of farmIds) {
        const repSnap = await this.db
          .collection('dailyReports')
          .where('farmId', '==', farmId)
          .get();
        repSnap.docs.forEach((d) => {
          const rData = d.data();
          const dStr = rData['submissionDate'] || rData['reportDate'];
          if (dStr) {
            existingReportsMap.set(`${rData['farmId']}_${dStr}`, rData);
          }
        });
      }

      // Bounded batch configuration (safe under Firestore's 500 ops limit)
      const OPERATIONS_PER_BATCH_LIMIT = 300;
      let currentBatch = this.db.batch();
      let operationsInCurrentBatch = 0;

      const commitCurrentBatch = async () => {
        if (operationsInCurrentBatch > 0) {
          if (!req.dryRun) {
            await currentBatch.commit();
          }
          currentBatch = this.db.batch();
          operationsInCurrentBatch = 0;
        }
      };

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        if (!record) continue;

        // Check if farm exists
        if (!farmDocMap.has(record.farmId)) {
          errors.push({
            file: record.sourceFile,
            row: record.sourceRow,
            field: 'farmId',
            reason: `Farm '${record.farmId}' does not exist in system`,
            rawData: record as any,
          });
          continue;
        }

        const identityKey = `${record.farmId}_${record.submissionDate}`;
        const existingLock = existingLocksMap.get(identityKey);
        const existingReport = existingReportsMap.get(identityKey);

        if (existingLock || existingReport) {
          // Check if exact duplicate or conflict
          const existingData = existingReport || existingLock;
          let isConflict = false;

          const checkFields = ['birdCount', 'feedKg', 'mortality', 'culling', 'eggsProduced'] as const;
          for (const f of checkFields) {
            if (record[f] != null && existingData[f] != null && Number(record[f]) !== Number(existingData[f])) {
              isConflict = true;
              break;
            }
          }

          if (!isConflict) {
            duplicateCount++;
            skippedCount++;
            continue;
          }

          // It's a conflict
          conflictCount++;
          if (req.conflictAction === 'skip') {
            skippedCount++;
            continue;
          }

          // Conflict action is 'replace' -> log overwrite
          overwrittenRecords.push({
            farmId: record.farmId,
            submissionDate: record.submissionDate,
            previousData: existingData,
            newData: record as any,
          });
        }

        // Write Record based on type
        if (record.recordType === 'DAILY_REPORT') {
          const assignedUserId = farmerUserMap.get(record.farmId) || user.uid;
          const docId = record.flockId
            ? `${record.submissionDate}_${record.flockId}`
            : record.submissionDate;

          const parentRef = this.db.collection('dailyReports').doc(assignedUserId);
          const dailyLogRef = parentRef.collection('dailyLogs').doc(docId);
          const lockRef = this.db.collection('dailyReportLocks').doc(identityKey);
          const topLevelReportRef = this.db.collection('dailyReports').doc(identityKey);

          const reportData: Record<string, any> = {
            userId: assignedUserId,
            submittedBy: user.uid,
            farmId: record.farmId,
            flockId: record.flockId || '',
            submissionDate: record.submissionDate,
            submissionMethod: 'HISTORICAL_IMPORT',
            submissionVersion: existingReport ? Number(existingReport.submissionVersion || 1) + 1 : 1,
            status: 'submitted',
            birdCount: record.birdCount ?? null,
            openingBirdCount: record.birdCount ?? null,
            closingBirdCount: record.birdCount ?? null,
            feedKg: record.feedKg ?? null,
            feedGrams: record.feedGrams ?? (record.feedKg != null ? record.feedKg * 1000 : null),
            feedG: record.feedG ?? (record.feedKg != null ? record.feedKg * 1000 : null),
            feedGramsPerBird: record.feedGramsPerBird ?? null,
            weekNumber: record.weekNumber ?? null,
            mortality: record.mortality ?? 0,
            culling: record.culling ?? 0,
            eggsProduced: record.eggsProduced ?? 0,
            selectionEggs: record.selectionEggs ?? 0,
            damagedEggs: record.damagedEggs ?? 0,
            floorEggs: record.floorEggs ?? 0,
            actualProductionPct: record.actualProductionPct ?? null,
            standardProductionPct: record.standardProductionPct ?? null,
            temperature: record.temperature ?? null,
            tempMin: record.tempMin ?? record.temperature ?? null,
            tempMax: record.tempMax ?? record.temperature ?? null,
            ammoniaPpm: record.ammoniaPpm ?? null,
            eggWeight: record.eggWeight ?? { min: 0, max: 0, avg: 0 },
            bodyWeight: record.bodyWeight ?? { min: 0, max: 0, avg: 0 },
            remarks: record.remarks ?? '',
            isHistorical: true,
            importBatchId: batchId,
            sourceFile: record.sourceFile,
            sourceRow: record.sourceRow,
            createdAt: now,
            updatedAt: now,
          };

          currentBatch.set(parentRef, {
            userId: assignedUserId,
            farmId: record.farmId,
            updatedAt: now,
          }, { merge: true });

          currentBatch.set(dailyLogRef, reportData, { merge: true });

          currentBatch.set(lockRef, {
            farmId: record.farmId,
            submissionDate: record.submissionDate,
            reportId: docId,
            importBatchId: batchId,
            createdAt: now,
            updatedAt: now,
          });

          currentBatch.set(topLevelReportRef, reportData, { merge: true });

          operationsInCurrentBatch += 4;
          importedCount++;

          const isExisting = Boolean(existingReport || existingLock);
          const action = isExisting ? 'UPDATED' : 'CREATED';
          manifest.push({
            recordType: 'DAILY_REPORT',
            action,
            farmId: record.farmId,
            submissionDate: record.submissionDate,
            targetDocs: [
              { collectionPath: `dailyReports/${assignedUserId}/dailyLogs`, docId },
              { collectionPath: 'dailyReportLocks', docId: identityKey },
              { collectionPath: 'dailyReports', docId: identityKey },
            ],
            beforeData: isExisting ? { ...(existingReport || {}), ...(existingLock || {}) } : undefined,
            importedData: reportData,
            importedAt: now,
            submissionVersion: reportData.submissionVersion,
          });

        } else if (record.recordType === 'FEED_LOAD') {
          // Historical feed load: safely preserve delivery date and notes
          // Crucial rule: Do not inflate master farm live currentFeedKg
          const feedLogRef = this.db.collection('logs').doc(record.farmId).collection('feedLogs').doc();
          const txRef = this.db.collection('farms').doc(record.farmId).collection('feedTransactions').doc();

          const qty = record.feedLoadQuantityKg || record.feedKg || 0;

          currentBatch.set(feedLogRef, {
            logId: feedLogRef.id,
            farmId: record.farmId,
            quantityKg: qty,
            loadedAt: record.submissionDate,
            recordedBy: user.uid,
            notes: record.feedLoadNotes || record.remarks || 'Historical Feed Load Import',
            type: 'FEED_LOAD',
            isHistorical: true,
            importBatchId: batchId,
          });

          currentBatch.set(txRef, {
            farmId: record.farmId,
            type: 'FEED_LOAD',
            feedKg: qty,
            reportDate: record.submissionDate,
            createdAt: now,
            loadedBy: user.uid,
            notes: record.feedLoadNotes || record.remarks || 'Historical Feed Load Import',
            isHistorical: true,
            importBatchId: batchId,
          });

          operationsInCurrentBatch += 2;
          importedCount++;

          manifest.push({
            recordType: 'FEED_LOAD',
            action: 'CREATED',
            farmId: record.farmId,
            submissionDate: record.submissionDate,
            targetDocs: [
              { collectionPath: `logs/${record.farmId}/feedLogs`, docId: feedLogRef.id },
              { collectionPath: `farms/${record.farmId}/feedTransactions`, docId: txRef.id },
            ],
            importedData: { logId: feedLogRef.id, farmId: record.farmId, quantityKg: qty, loadedAt: record.submissionDate },
            importedAt: now,
          });

        } else if (record.recordType === 'FLOCK_RECORD') {
          // Historical flock creation
          const flockRef = this.db.collection('flocks').doc();
          currentBatch.set(flockRef, {
            flockId: flockRef.id,
            farmId: record.farmId,
            flockName: record.flockName || 'Historical Flock',
            initialBirds: record.initialBirds || record.birdCount || 0,
            currentBirds: record.birdCount || record.initialBirds || 0,
            totalMortality: record.mortality || 0,
            totalCulling: record.culling || 0,
            totalEggs: record.eggsProduced || 0,
            startDate: record.startDate || record.submissionDate,
            breedType: record.breedType || 'BV-300',
            productionCurve: 'CF_STD',
            status: 'completed',
            isHistorical: true,
            importBatchId: batchId,
            notes: record.remarks || 'Historical Flock Import',
            createdAt: now,
            updatedAt: now,
          });

          operationsInCurrentBatch += 1;
          importedCount++;

          manifest.push({
            recordType: 'FLOCK_RECORD',
            action: 'CREATED',
            farmId: record.farmId,
            submissionDate: record.submissionDate,
            targetDocs: [
              { collectionPath: 'flocks', docId: flockRef.id },
            ],
            importedData: { flockId: flockRef.id, farmId: record.farmId, flockName: record.flockName || 'Historical Flock' },
            importedAt: now,
          });
        }

        // Commit batch if limit reached
        if (operationsInCurrentBatch >= OPERATIONS_PER_BATCH_LIMIT) {
          await commitCurrentBatch();
        }
      }

      // Commit any remaining operations
      await commitCurrentBatch();

      if (req.dryRun) {
        return {
          batchId: `dry_run_${batchId}`,
          totalProcessed: records.length,
          importedCount,
          skippedCount,
          duplicateCount,
          conflictCount,
          failedCount: errors.length,
          errors,
          status: 'COMPLETED',
          isDryRun: true,
        };
      }

      // 4. Record Audit Log & Batch Record
      const status: 'COMPLETED' | 'PARTIAL_FAILURE' | 'FAILED' =
        errors.length === 0
          ? 'COMPLETED'
          : importedCount > 0
            ? 'PARTIAL_FAILURE'
            : 'FAILED';

      const batchRecord: ImportBatchRecord = {
        batchId,
        adminUid: user.uid,
        adminEmail: user.email,
        importTimestamp: now,
        filenames: req.sourceFiles,
        affectedFarms: farmIds,
        recordType: determineRecordType(records),
        totalRows: records.length,
        importedCount,
        skippedCount,
        duplicateCount,
        conflictCount,
        failedCount: errors.length,
        conflictActionChosen: req.conflictAction,
        status,
        errors,
        overwrittenRecords,
        manifest,
        revertStatus: 'NOT_REVERTED',
      };

      await this.db.collection('importBatches').doc(batchId).set(batchRecord);

      await auditService.log({
        eventType: 'HISTORICAL_IMPORT',
        uid: user.uid,
        resourceId: batchId,
        requestId,
        metadata: {
          batchId,
          totalRows: records.length,
          importedCount,
          skippedCount,
          duplicateCount,
          conflictCount,
          failedCount: errors.length,
          status,
        },
      });

      logger.info('Historical data import completed', {
        requestId,
        batchId,
        importedCount,
        skippedCount,
        failedCount: errors.length,
      });

      return {
        batchId,
        totalProcessed: records.length,
        importedCount,
        skippedCount,
        duplicateCount,
        conflictCount,
        failedCount: errors.length,
        errors,
        status,
      };
    } catch (error) {
      logger.error('Historical data import failed during batch execution', {
        requestId,
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new InternalError('Historical data import failed');
    }
  }

  /**
   * Retrieves previous import batches.
   */
  async getImportBatches(): Promise<ImportBatchRecord[]> {
    try {
      const snap = await this.db
        .collection('importBatches')
        .orderBy('importTimestamp', 'desc')
        .limit(50)
        .get();

      return snap.docs.map((doc) => doc.data() as ImportBatchRecord);
    } catch (error) {
      logger.error('Failed to get import batches', { error });
      throw new InternalError('Failed to fetch import history');
    }
  }

  /**
   * Retrieves a specific import batch with all errors and overwritten records.
   */
  async getImportBatchById(batchId: string): Promise<ImportBatchRecord | null> {
    try {
      const doc = await this.db.collection('importBatches').doc(batchId).get();
      if (!doc.exists) return null;
      return doc.data() as ImportBatchRecord;
    } catch (error) {
      logger.error('Failed to get import batch by ID', { batchId, error });
      throw new InternalError('Failed to fetch import batch details');
    }
  }

  /**
   * Generates a preview of the revert operation for an import batch.
   * Checks whether records still belong to this batch, whether any subsequent edits occurred,
   * and whether original pre-import snapshots can be cleanly restored.
   */
  async getRevertPreview(
    batchId: string,
    _user: AuthenticatedUser,
    requestId: string,
  ): Promise<RevertPreviewResponse> {
    try {
      const batchDoc = await this.db.collection('importBatches').doc(batchId).get();
      if (!batchDoc.exists) {
        throw new NotFoundError(`Import batch '${batchId}'`);
      }

      const batch = batchDoc.data() as ImportBatchRecord;

      if (batch.revertStatus === 'REVERTED') {
        return {
          batchId,
          importTimestamp: batch.importTimestamp,
          filenames: batch.filenames || [],
          affectedFarms: batch.affectedFarms || [],
          totalImported: batch.importedCount || 0,
          canSafelyRevert: 0,
          requiresReview: 0,
          willDelete: 0,
          willRestore: 0,
          isReversible: false,
          revertStatus: 'REVERTED',
          notReversibleReason: 'This batch has already been reverted.',
          sampleRecords: [],
        };
      }

      if (batch.revertStatus === 'REVERTING') {
        return {
          batchId,
          importTimestamp: batch.importTimestamp,
          filenames: batch.filenames || [],
          affectedFarms: batch.affectedFarms || [],
          totalImported: batch.importedCount || 0,
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

      const manifestItems = await this.resolveBatchItems(batch);

      let canSafelyRevert = 0;
      let requiresReview = 0;
      let willDelete = 0;
      let willRestore = 0;
      const sampleRecords: RevertPreviewRecord[] = [];

      for (const item of manifestItems) {
        let isSafe = true;
        let reason: string | undefined;

        for (const tDoc of item.targetDocs) {
          const docRef = this.db.doc(`${tDoc.collectionPath}/${tDoc.docId}`);
          const snap = await docRef.get();
          if (!snap.exists) {
            continue;
          }
          const data = snap.data() || {};
          if (data['importBatchId'] && data['importBatchId'] !== batchId) {
            isSafe = false;
            reason = `Document was subsequently touched by import '${data['importBatchId']}'`;
            break;
          }

          if (item.action === 'CREATED') {
            if (item.submissionVersion && data['submissionVersion'] && data['submissionVersion'] > item.submissionVersion) {
              isSafe = false;
              reason = `Record has subsequent edits (v${data['submissionVersion']})`;
              break;
            }
          }
        }

        if (item.action === 'UPDATED' && !item.beforeData) {
          isSafe = false;
          reason = 'Original pre-import snapshot missing; cannot restore original state safely';
        }

        if (isSafe) {
          canSafelyRevert++;
          if (item.action === 'CREATED') willDelete++;
          if (item.action === 'UPDATED') willRestore++;
        } else {
          requiresReview++;
        }

        if (sampleRecords.length < 50) {
          sampleRecords.push({
            farmId: item.farmId,
            submissionDate: item.submissionDate,
            recordType: item.recordType,
            action: item.action,
            canSafelyRevert: isSafe,
            reason,
          });
        }
      }

      const affectedFarms = batch.affectedFarms && batch.affectedFarms.length > 0
        ? batch.affectedFarms
        : Array.from(new Set(manifestItems.map((m) => m.farmId)));

      return {
        batchId,
        importTimestamp: batch.importTimestamp,
        filenames: batch.filenames || [],
        affectedFarms,
        totalImported: batch.importedCount || manifestItems.length,
        canSafelyRevert,
        requiresReview,
        willDelete,
        willRestore,
        isReversible: canSafelyRevert > 0,
        revertStatus: batch.revertStatus || 'NOT_REVERTED',
        notReversibleReason: canSafelyRevert === 0 ? 'No reversible records found in this batch' : undefined,
        sampleRecords,
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to get revert preview', {
        requestId,
        batchId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new InternalError('Failed to generate revert preview');
    }
  }

  /**
   * Reverts a specific historical import batch.
   * Ensures that live farm balances are never touched,
   * only records tagged with this importBatchId are deleted or restored,
   * and concurrent revert calls are blocked.
   */
  async revertImportBatch(
    batchId: string,
    req: RevertBatchRequest,
    user: AuthenticatedUser,
    requestId: string,
  ): Promise<RevertBatchResponse> {
    if (!req.confirmationBatchId || req.confirmationBatchId.trim() !== batchId) {
      throw new ValidationError(
        `Confirmation batch ID mismatch. Expected '${batchId}', received '${req.confirmationBatchId || ''}'.`,
      );
    }

    const batchRef = this.db.collection('importBatches').doc(batchId);
    const batchDoc = await batchRef.get();
    if (!batchDoc.exists) {
      throw new NotFoundError(`Import batch '${batchId}'`);
    }

    const batch = batchDoc.data() as ImportBatchRecord;

    if (batch.revertStatus === 'REVERTING') {
      throw new DuplicateError('Revert operation is already in progress for this batch');
    }
    if (batch.revertStatus === 'REVERTED') {
      throw new DuplicateError('This batch has already been reverted');
    }

    const revertOperationId = `revert_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const revertTimestamp = new Date().toISOString();

    // Set status to REVERTING immediately as concurrency guard
    await batchRef.update({
      revertStatus: 'REVERTING',
      'revertAudit.revertOperationId': revertOperationId,
      'revertAudit.revertedByUid': user.uid,
      'revertAudit.revertTimestamp': revertTimestamp,
    });

    const manifestItems = await this.resolveBatchItems(batch);

    let deletedCount = 0;
    let restoredCount = 0;
    let skippedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;
    const errors: Array<{ docId?: string; reason: string }> = [];

    const OPERATIONS_PER_BATCH_LIMIT = 300;
    let currentBatch = this.db.batch();
    let operationsInCurrentBatch = 0;

    const commitBatch = async () => {
      if (operationsInCurrentBatch > 0) {
        await currentBatch.commit();
        currentBatch = this.db.batch();
        operationsInCurrentBatch = 0;
      }
    };

    try {
      for (const item of manifestItems) {
        try {
          if (item.action === 'CREATED') {
            let canDelete = true;
            const refsToDelete: FirebaseFirestore.DocumentReference[] = [];

            for (const tDoc of item.targetDocs) {
              const docRef = this.db.doc(`${tDoc.collectionPath}/${tDoc.docId}`);
              const snap = await docRef.get();
              if (!snap.exists) continue;

              const data = snap.data() || {};
              if (data['importBatchId'] && data['importBatchId'] !== batchId) {
                canDelete = false;
                errors.push({
                  docId: tDoc.docId,
                  reason: `Record modified by another batch '${data['importBatchId']}'. Skipped deletion.`,
                });
                break;
              }
              if (item.submissionVersion && data['submissionVersion'] && data['submissionVersion'] > item.submissionVersion) {
                canDelete = false;
                errors.push({
                  docId: tDoc.docId,
                  reason: `Record has subsequent manual edits (version ${data['submissionVersion']}). Skipped deletion.`,
                });
                break;
              }

              refsToDelete.push(docRef);
            }

            if (!canDelete) {
              conflictCount++;
              continue;
            }

            if (refsToDelete.length === 0) {
              skippedCount++;
              continue;
            }

            for (const ref of refsToDelete) {
              currentBatch.delete(ref);
              operationsInCurrentBatch++;
              if (operationsInCurrentBatch >= OPERATIONS_PER_BATCH_LIMIT) {
                await commitBatch();
              }
            }

            deletedCount++;
          } else if (item.action === 'UPDATED') {
            if (!item.beforeData) {
              conflictCount++;
              errors.push({
                docId: `${item.farmId}_${item.submissionDate}`,
                reason: 'No original snapshot exists to restore. Skipped.',
              });
              continue;
            }

            for (const tDoc of item.targetDocs) {
              const docRef = this.db.doc(`${tDoc.collectionPath}/${tDoc.docId}`);
              const snap = await docRef.get();
              if (snap.exists) {
                const data = snap.data() || {};
                if (data['importBatchId'] && data['importBatchId'] !== batchId) {
                  conflictCount++;
                  errors.push({
                    docId: tDoc.docId,
                    reason: `Record was subsequently modified by another batch '${data['importBatchId']}'. Skipped restore.`,
                  });
                  continue;
                }
              }

              const restorePayload = { ...item.beforeData };
              delete restorePayload['importBatchId'];
              restorePayload['updatedAt'] = new Date().toISOString();

              currentBatch.set(docRef, restorePayload);
              operationsInCurrentBatch++;
              if (operationsInCurrentBatch >= OPERATIONS_PER_BATCH_LIMIT) {
                await commitBatch();
              }
            }

            restoredCount++;
          }
        } catch (itemErr: any) {
          failedCount++;
          errors.push({
            reason: itemErr instanceof Error ? itemErr.message : 'Unknown item error',
          });
        }
      }

      await commitBatch();

      const finalStatus: RevertBatchStatus =
        failedCount > 0
          ? 'PARTIALLY_REVERTED'
          : conflictCount > 0
            ? 'REVERT_REQUIRES_REVIEW'
            : 'REVERTED';

      const revertAudit = {
        revertOperationId,
        revertedByUid: user.uid,
        revertedByEmail: user.email,
        revertTimestamp,
        revertCompletedTimestamp: new Date().toISOString(),
        deletedRecordsCount: deletedCount,
        restoredRecordsCount: restoredCount,
        skippedRecordsCount: skippedCount,
        conflictsCount: conflictCount,
        failedCount,
        errors,
      };

      await batchRef.update({
        revertStatus: finalStatus,
        revertAudit,
      });

      await auditService.log({
        eventType: 'HISTORICAL_IMPORT_REVERT',
        uid: user.uid,
        resourceId: batchId,
        requestId,
        metadata: {
          batchId,
          revertOperationId,
          deletedCount,
          restoredCount,
          skippedCount,
          conflictCount,
          failedCount,
          finalStatus,
        },
      });

      logger.info('Historical import batch reverted', {
        requestId,
        batchId,
        revertOperationId,
        deletedCount,
        restoredCount,
        finalStatus,
      });

      return {
        revertOperationId,
        batchId,
        status: finalStatus,
        deletedCount,
        restoredCount,
        skippedCount,
        conflictCount,
        failedCount,
        errors,
      };
    } catch (err: any) {
      logger.error('Failed executing batch revert', {
        requestId,
        batchId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      await batchRef.update({
        revertStatus: 'REVERT_FAILED',
        'revertAudit.failedCount': failedCount + 1,
        'revertAudit.errors': [...errors, { reason: err?.message || 'Revert failed during execution' }],
      });
      throw new InternalError('Failed to revert import batch');
    }
  }

  /**
   * Helper to resolve all manifest items for a batch,
   * falling back to Firestore queries for legacy batches.
   */
  private async resolveBatchItems(batch: ImportBatchRecord): Promise<ImportManifestItem[]> {
    if (batch.manifest && batch.manifest.length > 0) {
      return batch.manifest;
    }

    const items: ImportManifestItem[] = [];
    const overwrittenMap = new Map<string, any>();
    if (batch.overwrittenRecords) {
      for (const ov of batch.overwrittenRecords) {
        overwrittenMap.set(`${ov.farmId}_${ov.submissionDate}`, ov.previousData);
      }
    }

    const locksSnap = await this.db
      .collection('dailyReportLocks')
      .where('importBatchId', '==', batch.batchId)
      .get();

    for (const doc of locksSnap.docs) {
      const data = doc.data();
      const identityKey = doc.id;
      const farmId = data['farmId'];
      const submissionDate = data['submissionDate'];
      const beforeData = overwrittenMap.get(identityKey);
      const action = beforeData ? 'UPDATED' : 'CREATED';

      const reportSnap = await this.db.collection('dailyReports').doc(identityKey).get();
      const reportData = reportSnap.exists ? reportSnap.data() : null;
      const assignedUserId = reportData?.['userId'];

      const targetDocs: ImportManifestTargetDoc[] = [
        { collectionPath: 'dailyReportLocks', docId: identityKey },
        { collectionPath: 'dailyReports', docId: identityKey },
      ];
      if (assignedUserId) {
        targetDocs.push({
          collectionPath: `dailyReports/${assignedUserId}/dailyLogs`,
          docId: data['reportId'] || submissionDate,
        });
      }

      items.push({
        recordType: 'DAILY_REPORT',
        action,
        farmId,
        submissionDate,
        targetDocs,
        beforeData,
        importedData: reportData || undefined,
        importedAt: batch.importTimestamp,
      });
    }

    const flocksSnap = await this.db
      .collection('flocks')
      .where('importBatchId', '==', batch.batchId)
      .get();
    for (const fDoc of flocksSnap.docs) {
      const fData = fDoc.data();
      items.push({
        recordType: 'FLOCK_RECORD',
        action: 'CREATED',
        farmId: fData['farmId'],
        submissionDate: fData['startDate'] || batch.importTimestamp.split('T')[0],
        targetDocs: [{ collectionPath: 'flocks', docId: fDoc.id }],
        importedData: fData,
        importedAt: batch.importTimestamp,
      });
    }

    if (items.length === 0 && (batch.recordType === 'FEED_LOAD' || batch.recordType === 'MIXED')) {
      const farmsSnap = await this.db.collection('farms').get();
      for (const farmDoc of farmsSnap.docs) {
        const txSnap = await farmDoc.ref
          .collection('feedTransactions')
          .where('importBatchId', '==', batch.batchId)
          .get();
        for (const tx of txSnap.docs) {
          const txData = tx.data();
          items.push({
            recordType: 'FEED_LOAD',
            action: 'CREATED',
            farmId: farmDoc.id,
            submissionDate: txData['reportDate'] || batch.importTimestamp.split('T')[0],
            targetDocs: [{ collectionPath: `farms/${farmDoc.id}/feedTransactions`, docId: tx.id }],
            importedData: txData,
            importedAt: batch.importTimestamp,
          });
        }
      }
    }

    return items;
  }
}

function determineRecordType(records: HistoricalImportRecord[]): 'DAILY_REPORT' | 'FEED_LOAD' | 'FLOCK_RECORD' | 'MIXED' {
  const types = new Set(records.map((r) => r.recordType));
  if (types.size === 1) {
    return Array.from(types)[0] as any;
  }
  return 'MIXED';
}

export const importService = new ImportService();
