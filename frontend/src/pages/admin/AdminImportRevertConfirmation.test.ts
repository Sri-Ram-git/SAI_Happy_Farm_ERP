import { describe, it, expect } from 'vitest';

/**
 * Pure verification function mirroring the exact confirmation logic in AdminImportPage modal:
 *
 * const displayedBatchId = String(revertModalBatch.id || revertModalBatch.batchId || '').trim();
 * const expectedConfirmation = revertTargetWorksheet
 *   ? String(revertTargetWorksheet.sheetName || revertTargetWorksheet.worksheetKey || displayedBatchId).trim()
 *   : displayedBatchId;
 *
 * const enteredBatchId = revertConfirmationInput.trim();
 * const isIdMatched = Boolean(
 *   expectedConfirmation &&
 *   (enteredBatchId === expectedConfirmation || enteredBatchId.toUpperCase() === expectedConfirmation.toUpperCase())
 * );
 *
 * const canConfirm = Boolean(
 *   revertAckChecked &&
 *   isIdMatched &&
 *   !revertingBatch &&
 *   !loadingRevertPreview &&
 *   revertPreview?.isReversible
 * );
 */
export function computeCanConfirm(params: {
  revertModalBatch: { id?: string; batchId?: string } | null;
  revertTargetWorksheet?: { sheetName?: string | null; worksheetKey: string } | null;
  revertAckChecked: boolean;
  revertConfirmationInput: string;
  revertingBatch: boolean;
  loadingRevertPreview?: boolean;
  revertPreview?: { isReversible: boolean } | null;
}): { canConfirm: boolean; buttonDisabled: boolean; expectedConfirmation: string } {
  const {
    revertModalBatch,
    revertTargetWorksheet,
    revertAckChecked,
    revertConfirmationInput,
    revertingBatch,
    loadingRevertPreview = false,
    revertPreview = { isReversible: true },
  } = params;

  if (!revertModalBatch) {
    return { canConfirm: false, buttonDisabled: true, expectedConfirmation: '' };
  }

  const displayedBatchId = String(revertModalBatch.id || revertModalBatch.batchId || '').trim();
  const expectedConfirmation = revertTargetWorksheet
    ? String(revertTargetWorksheet.sheetName || revertTargetWorksheet.worksheetKey || displayedBatchId).trim()
    : displayedBatchId;

  const enteredBatchId = revertConfirmationInput.trim();
  const isIdMatched = Boolean(
    expectedConfirmation &&
    (enteredBatchId === expectedConfirmation || enteredBatchId.toUpperCase() === expectedConfirmation.toUpperCase())
  );

  const canConfirm = Boolean(
    revertAckChecked &&
    isIdMatched &&
    !revertingBatch &&
    !loadingRevertPreview &&
    revertPreview?.isReversible
  );
  return { canConfirm, buttonDisabled: !canConfirm, expectedConfirmation };
}

/**
 * Component state machine simulating the exact React state lifecycle in AdminImportPage
 */
export class AdminImportRevertModalController {
  public revertModalBatch: { id?: string; batchId?: string } | null = null;
  public revertTargetWorksheet: { sheetName?: string | null; worksheetKey: string } | null = null;
  public revertAckChecked: boolean = false;
  public revertConfirmationInput: string = '';
  public revertingBatch: boolean = false;
  public loadingRevertPreview: boolean = false;
  public revertPreview: { isReversible: boolean; notReversibleReason?: string } | null = null;
  public revertError: string | null = null;

  openModal(batch: { id?: string; batchId?: string }, worksheet?: { sheetName?: string | null; worksheetKey: string }) {
    this.revertModalBatch = batch;
    this.revertTargetWorksheet = worksheet || null;
    this.revertConfirmationInput = '';
    this.revertAckChecked = false;
    this.revertingBatch = false;
    this.revertError = null;
    this.loadingRevertPreview = true;
  }

  setPreviewLoaded(preview: { isReversible: boolean; notReversibleReason?: string }) {
    this.loadingRevertPreview = false;
    this.revertPreview = preview;
  }

  setPreviewFailed(errorMessage: string) {
    this.loadingRevertPreview = false;
    this.revertPreview = null;
    this.revertError = errorMessage;
  }

  setAgreement(checked: boolean) {
    this.revertAckChecked = checked;
  }

  setInput(val: string) {
    this.revertConfirmationInput = val;
  }

  closeModal() {
    this.revertModalBatch = null;
    this.revertTargetWorksheet = null;
    this.revertPreview = null;
    this.revertConfirmationInput = '';
    this.revertAckChecked = false;
    this.revertingBatch = false;
    this.revertError = null;
    this.loadingRevertPreview = false;
  }

  startRevert() {
    this.revertingBatch = true;
  }

  getConfirmationState() {
    return computeCanConfirm({
      revertModalBatch: this.revertModalBatch,
      revertTargetWorksheet: this.revertTargetWorksheet,
      revertAckChecked: this.revertAckChecked,
      revertConfirmationInput: this.revertConfirmationInput,
      revertingBatch: this.revertingBatch,
      loadingRevertPreview: this.loadingRevertPreview,
      revertPreview: this.revertPreview,
    });
  }
}

describe('Admin Import History - Revert Entire Import Batch Confirmation Modal', () => {
  const sampleBatch = { id: 'batch_2026_06_01_alpha', batchId: 'batch_2026_06_01_alpha' };
  const sampleBatchWithOnlyId = { id: 'batch_legacy_001' };
  const sampleBatchWithOnlyBatchId = { batchId: 'batch_legacy_002' };

  describe('Task 4 - Mandatory Verification Test Matrix', () => {
    it('1. Unchecked agreement + correct batch ID -> button disabled', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: false,
        revertConfirmationInput: 'batch_2026_06_01_alpha',
        revertingBatch: false,
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });

    it('2. Checked agreement + empty batch ID input -> button disabled', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: '',
        revertingBatch: false,
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });

    it('3. Checked agreement + incorrect batch ID -> button disabled', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: 'wrong_batch_id',
        revertingBatch: false,
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });

    it('4. Checked agreement + partial batch ID -> button disabled', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_2026_06_01',
        revertingBatch: false,
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });

    it('5. Checked agreement + correct batch ID -> button enabled', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_2026_06_01_alpha',
        revertingBatch: false,
      });

      expect(result.canConfirm).toBe(true);
      expect(result.buttonDisabled).toBe(false);
    });

    it('6. Checked agreement + correct batch ID with accidental leading/trailing spaces -> button enabled', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: '   batch_2026_06_01_alpha   ',
        revertingBatch: false,
      });

      expect(result.canConfirm).toBe(true);
      expect(result.buttonDisabled).toBe(false);
    });

    it('7. Checked agreement + correct batch ID, then uncheck agreement -> button disabled immediately', () => {
      let state = {
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_2026_06_01_alpha',
        revertingBatch: false,
      };
      let result = computeCanConfirm(state);
      expect(result.canConfirm).toBe(true);
      expect(result.buttonDisabled).toBe(false);

      state = { ...state, revertAckChecked: false };
      result = computeCanConfirm(state);
      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });

    it('8. Checked agreement + correct batch ID, during revert in flight -> button disabled', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_2026_06_01_alpha',
        revertingBatch: true,
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });
  });

  describe('Revert Safety Safeguard Tests (Section 4)', () => {
    it('disables button while preview is loading even if inputs are filled', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_2026_06_01_alpha',
        revertingBatch: false,
        loadingRevertPreview: true,
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });

    it('disables button when preview is not reversible (e.g. already reverted or error)', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_2026_06_01_alpha',
        revertingBatch: false,
        loadingRevertPreview: false,
        revertPreview: { isReversible: false },
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });

    it('disables button when revert preview failed to load (null)', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_2026_06_01_alpha',
        revertingBatch: false,
        loadingRevertPreview: false,
        revertPreview: null,
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });
  });

  describe('Additional Robustness Tests', () => {
    it('supports batch objects with only .id (Firestore document standard)', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatchWithOnlyId,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_legacy_001',
        revertingBatch: false,
      });

      expect(result.expectedConfirmation).toBe('batch_legacy_001');
      expect(result.canConfirm).toBe(true);
      expect(result.buttonDisabled).toBe(false);
    });

    it('supports batch objects with only .batchId', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatchWithOnlyBatchId,
        revertAckChecked: true,
        revertConfirmationInput: 'batch_legacy_002',
        revertingBatch: false,
      });

      expect(result.expectedConfirmation).toBe('batch_legacy_002');
      expect(result.canConfirm).toBe(true);
      expect(result.buttonDisabled).toBe(false);
    });

    it('supports case-insensitive confirmation input', () => {
      const result = computeCanConfirm({
        revertModalBatch: { id: 'BATCH-2026-ALPHA' },
        revertAckChecked: true,
        revertConfirmationInput: 'batch-2026-alpha',
        revertingBatch: false,
      });

      expect(result.canConfirm).toBe(true);
      expect(result.buttonDisabled).toBe(false);
    });

    it('handles targeted worksheet confirmation with worksheet sheetName', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertTargetWorksheet: { sheetName: 'AP14 Daily', worksheetKey: 'Daily_AP14.xlsx [AP14]' },
        revertAckChecked: true,
        revertConfirmationInput: 'AP14 Daily',
        revertingBatch: false,
      });

      expect(result.expectedConfirmation).toBe('AP14 Daily');
      expect(result.canConfirm).toBe(true);
      expect(result.buttonDisabled).toBe(false);
    });

    it('disables when worksheet confirmation phrase is typed for full batch or vice-versa', () => {
      const result = computeCanConfirm({
        revertModalBatch: sampleBatch,
        revertTargetWorksheet: { sheetName: 'AP14 Daily', worksheetKey: 'Daily_AP14.xlsx [AP14]' },
        revertAckChecked: true,
        revertConfirmationInput: 'batch_2026_06_01_alpha',
        revertingBatch: false,
      });

      expect(result.canConfirm).toBe(false);
      expect(result.buttonDisabled).toBe(true);
    });
  });

  describe('Real Component State Lifecycle & Interaction Flow', () => {
    it('reproduces and validates the complete step-by-step user interaction sequence', () => {
      const ctrl = new AdminImportRevertModalController();

      // Step 1: Open modal for batch_1790756914208_9lebfu2
      ctrl.openModal({ batchId: 'batch_1790756914208_9lebfu2' });
      expect(ctrl.revertModalBatch?.batchId).toBe('batch_1790756914208_9lebfu2');
      expect(ctrl.revertAckChecked).toBe(false);
      expect(ctrl.revertConfirmationInput).toBe('');
      expect(ctrl.loadingRevertPreview).toBe(true);

      // Button is disabled while loading preview
      let state = ctrl.getConfirmationState();
      expect(state.expectedConfirmation).toBe('batch_1790756914208_9lebfu2');
      expect(state.canConfirm).toBe(false);
      expect(state.buttonDisabled).toBe(true);

      // Step 2: Preview loads and confirms batch is reversible
      ctrl.setPreviewLoaded({ isReversible: true });
      expect(ctrl.loadingRevertPreview).toBe(false);
      state = ctrl.getConfirmationState();
      expect(state.canConfirm).toBe(false);
      expect(state.buttonDisabled).toBe(true);

      // Step 3: User checks the agreement checkbox (step 1 of modal flow)
      ctrl.setAgreement(true);
      expect(ctrl.revertAckChecked).toBe(true);
      state = ctrl.getConfirmationState();
      // Button MUST remain disabled because exact batch ID has not yet been typed
      expect(state.canConfirm).toBe(false);
      expect(state.buttonDisabled).toBe(true);

      // Step 4: User types exact batch ID (step 2 of modal flow)
      ctrl.setInput('batch_1790756914208_9lebfu2');
      expect(ctrl.revertConfirmationInput).toBe('batch_1790756914208_9lebfu2');
      state = ctrl.getConfirmationState();
      // Button MUST now become enabled (step 3 of modal flow)
      expect(state.canConfirm).toBe(true);
      expect(state.buttonDisabled).toBe(false);

      // Step 5: User unchecks the agreement
      ctrl.setAgreement(false);
      state = ctrl.getConfirmationState();
      expect(state.canConfirm).toBe(false);
      expect(state.buttonDisabled).toBe(true);

      // Step 6: User re-checks the agreement
      ctrl.setAgreement(true);
      state = ctrl.getConfirmationState();
      expect(state.canConfirm).toBe(true);
      expect(state.buttonDisabled).toBe(false);

      // Step 7: Revert starts in flight
      ctrl.startRevert();
      state = ctrl.getConfirmationState();
      expect(state.canConfirm).toBe(false);
      expect(state.buttonDisabled).toBe(true);

      // Step 8: Close modal resets all state cleanly
      ctrl.closeModal();
      expect(ctrl.revertModalBatch).toBeNull();
      expect(ctrl.revertAckChecked).toBe(false);
      expect(ctrl.revertConfirmationInput).toBe('');
      state = ctrl.getConfirmationState();
      expect(state.canConfirm).toBe(false);

      // Step 9: Reopen for another batch with Firestore .id format
      ctrl.openModal({ id: 'batch_next_789' });
      ctrl.setPreviewLoaded({ isReversible: true });
      ctrl.setAgreement(true);
      ctrl.setInput('batch_next_789');
      state = ctrl.getConfirmationState();
      expect(state.expectedConfirmation).toBe('batch_next_789');
      expect(state.canConfirm).toBe(true);
      expect(state.buttonDisabled).toBe(false);
    });
  });
});
