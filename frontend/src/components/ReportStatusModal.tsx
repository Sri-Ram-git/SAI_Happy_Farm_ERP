import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';

interface ReportStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissionVersion: number;
  maxVersions?: number;
}

export function ReportStatusModal({
  isOpen,
  onClose,
  submissionVersion,
  maxVersions = 2,
}: ReportStatusModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentVersion = submissionVersion || 1;
  const remainingCorrections = Math.max(0, maxVersions - currentVersion);
  const isFinalized = currentVersion >= maxVersions;

  return (
    <div className="farmer-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="farmer-modal-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="farmer-modal-close"
          onClick={onClose}
          aria-label={t('common.close') || 'Close'}
        >
          <X size={18} />
        </button>

        <div className="farmer-modal-icon-badge">
          <Check size={26} strokeWidth={2.5} />
        </div>

        <h3 className="farmer-modal-title">
          {t('farmer.modalReportSubmitted') || 'Report Submitted'}
        </h3>

        <p className="farmer-modal-desc">
          {!isFinalized
            ? (t('farmer.modalV1Desc') || 'Your report for today has already been submitted. You can review and update your report if necessary.')
            : (t('farmer.modalV2Desc') || 'Your report for today has been finalized. No further corrections are allowed for today.')}
        </p>

        <div className="farmer-modal-tiles">
          <div className="farmer-modal-tile">
            <span className="farmer-modal-tile-label">
              {t('farmer.currentReportLabel') || 'CURRENT REPORT'}
            </span>
            <span className="farmer-modal-tile-value">
              {t('farmer.versionText', { current: currentVersion, max: maxVersions }) || `Version ${currentVersion} of ${maxVersions}`}
            </span>
          </div>

          <div className="farmer-modal-tile">
            <span className="farmer-modal-tile-label">
              {t('farmer.correctionsLabel') || 'CORRECTIONS'}
            </span>
            <span className="farmer-modal-tile-value">
              {t('farmer.correctionsCount', { count: remainingCorrections }) || `${remainingCorrections} ${remainingCorrections === 1 ? 'correction remaining' : 'corrections remaining'}`}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="farmer-modal-action-btn"
          onClick={onClose}
        >
          {t('farmer.okContinue') || 'OK, Continue'}
        </button>
      </div>
    </div>
  );
}
