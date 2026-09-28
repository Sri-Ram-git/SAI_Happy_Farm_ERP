import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { formatDisplayDate } from '../services/reportService';

interface OverwriteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  reportDate: string;
  farmId: string;
  submitting?: boolean;
}

export function OverwriteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  reportDate,
  farmId,
  submitting = false,
}: OverwriteConfirmationModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, submitting]);

  if (!isOpen) return null;

  const formattedDate = formatDisplayDate(reportDate);

  return (
    <div
      className="farmer-modal-overlay"
      onClick={() => {
        if (!submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="overwrite-modal-title"
    >
      <div className="farmer-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="farmer-modal-close"
          onClick={onClose}
          disabled={submitting}
          aria-label={t('common.close', 'Close')}
        >
          <X size={18} />
        </button>

        <div
          className="farmer-modal-icon-badge"
          style={{ background: '#fffbeb', color: '#d97706', borderColor: '#fde68a' }}
        >
          <AlertTriangle size={26} strokeWidth={2.5} />
        </div>

        <h3 id="overwrite-modal-title" className="farmer-modal-title">
          {t('farmer.overwriteModalTitle', 'Report Already Submitted')}
        </h3>

        <p className="farmer-modal-desc" style={{ color: '#475569', lineHeight: 1.5 }}>
          {t(
            'farmer.overwriteModalDesc',
            'A report for {{date}} already exists for farm {{farmId}}. Submitting again will overwrite the existing report. Do you want to continue?',
            { date: formattedDate, farmId }
          )}
        </p>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', width: '100%' }}>
          <button
            type="button"
            className="btn btn--outline"
            style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', fontWeight: 600 }}
            onClick={onClose}
            disabled={submitting}
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{
              flex: 1.2,
              padding: '10px 14px',
              borderRadius: '10px',
              fontWeight: 700,
              background: '#d97706',
              borderColor: '#d97706',
            }}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <span className="spinner" />
            ) : (
              t('farmer.confirmOverwrite', 'Confirm Overwrite')
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
