import React from 'react';

export interface FormLoadingOverlayProps {
  title: string;
  subtitle?: string;
  role?: 'farmer' | 'supervisor' | 'admin' | 'generic';
}

export function FormLoadingOverlay({
  title,
  subtitle = 'Please wait while we securely save the account details.',
  role = 'generic',
}: FormLoadingOverlayProps) {
  // Theme accents based on role / operation
  const accentColor =
    role === 'farmer'
      ? '#059669' // Emerald
      : role === 'supervisor'
      ? '#0284c7' // Sky blue
      : role === 'admin'
      ? '#7c3aed' // Violet
      : '#059669';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'inherit',
        padding: '24px 16px',
        animation: 'formOverlayFadeIn 0.2s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes formOverlayFadeIn {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes formOverlaySpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes formOverlayPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: '360px',
          padding: '24px 28px',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Animated Custom Ring Spinner */}
        <div
          style={{
            position: 'relative',
            width: '48px',
            height: '48px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: `3.5px solid ${accentColor}20`,
              borderTopColor: accentColor,
              animation: 'formOverlaySpin 0.8s linear infinite',
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: '6px',
            letterSpacing: '-0.01em',
            animation: 'formOverlayPulse 2s ease-in-out infinite',
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: '13px',
              color: '#64748b',
              lineHeight: 1.45,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
