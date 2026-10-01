import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, X } from 'lucide-react';
import { formatDisplayDate } from '../services/reportService';

interface TotalMortalityConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mortality: number;
  birdCount: number;
  farmId: string;
  reportDate: string;
  submitting?: boolean;
}

export function TotalMortalityConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  mortality,
  birdCount,
  farmId,
  reportDate,
  submitting = false,
}: TotalMortalityConfirmationModalProps) {
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
      aria-labelledby="mortality-modal-title"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px',
      }}
    >
      <div
        className="farmer-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1.5px solid #f87171',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            background: '#fef2f2',
            borderBottom: '1px solid #fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={22} color="#dc2626" />
            <h3
              id="mortality-modal-title"
              style={{
                margin: 0,
                fontSize: '17px',
                fontWeight: 700,
                color: '#991b1b',
              }}
            >
              Verify 100% Flock Loss
            </h3>
          </div>
          <button
            type="button"
            className="farmer-modal-close"
            onClick={onClose}
            disabled={submitting}
            aria-label={t('common.close', 'Close')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#991b1b',
              padding: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          <div
            style={{
              background: '#fff1f2',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              border: '1px solid #fecdd3',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#881337' }}>
              You entered a mortality count of{' '}
              <strong style={{ fontSize: '16px', color: '#be123c' }}>
                {mortality.toLocaleString()} birds
              </strong>
              , which equals <strong>100%</strong> of the eligible bird count (
              {birdCount.toLocaleString()} birds) for <strong>{farmId}</strong> on{' '}
              <strong>{formattedDate}</strong>.
            </p>
          </div>

          <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#374151', lineHeight: 1.5 }}>
            This indicates that <strong>the entire flock has been lost</strong> and the remaining
            live bird population will become <strong>0</strong>.
          </p>

          <p style={{ margin: 0, fontSize: '13.5px', color: '#4b5563', lineHeight: 1.5 }}>
            Please confirm that this number is accurate and not a typographical error. If you made
            a mistake, click <strong>Cancel / Edit Form</strong> to adjust the number.
          </p>
        </div>

        <div
          style={{
            padding: '14px 20px',
            background: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            className="btn btn--outline"
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '8px 16px', fontWeight: 600 }}
          >
            Cancel / Edit Form
          </button>
          <button
            type="button"
            className="btn"
            onClick={onConfirm}
            disabled={submitting}
            style={{
              padding: '8px 18px',
              fontWeight: 700,
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {submitting ? <span className="spinner" /> : 'Confirm 100% Flock Loss'}
          </button>
        </div>
      </div>
    </div>
  );
}
