import { useState, useEffect, useRef, type FormEvent } from 'react';
import { sendPhoneOtp, confirmPhoneOtp } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { getFriendlyError } from '../utils/firebaseErrors';

const f = (window as any).firebase;

export function PhoneLoginForm() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const { authError, clearAuthError } = useAuth();
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const verifierRef = useRef<any>(null);
  const confirmationRef = useRef<any>(null);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  useEffect(() => {
    return () => {
      if (verifierRef.current) {
        try { verifierRef.current.clear(); } catch {}
      }
    };
  }, []);

  const getVerifier = () => {
    if (!verifierRef.current && recaptchaRef.current) {
      verifierRef.current = new f.auth.RecaptchaVerifier(recaptchaRef.current, {
        size: 'invisible',
      });
    }
    return verifierRef.current;
  };

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    clearAuthError();

    const fullNumber = phoneNumber.startsWith('+') ? phoneNumber : '+91' + phoneNumber;

    if (fullNumber.length < 12) {
      setError('Enter a valid phone number with country code');
      return;
    }

    setSubmitting(true);
    try {
      const verifier = getVerifier();
      const confirmation = await sendPhoneOtp(fullNumber, verifier);
      confirmationRef.current = confirmation;
      setOtpSent(true);
      setResendTimer(30);
      console.log('[PhoneForm] OTP sent to', fullNumber);
    } catch (err: any) {
      console.error('[PhoneForm] Send OTP error:', err.code);
      setError(getFriendlyError(err.code || 'unknown'));
      if (verifierRef.current) {
        try { verifierRef.current.clear(); } catch {}
        verifierRef.current = null;
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await confirmPhoneOtp(confirmationRef.current, otp);
      console.log('[PhoneForm] OTP verified — AuthContext will handle redirect');
    } catch (err: any) {
      console.error('[PhoneForm] Verify OTP error:', err.code);
      setError('Invalid verification code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError('');
    const fullNumber = phoneNumber.startsWith('+') ? phoneNumber : '+91' + phoneNumber;
    setSubmitting(true);
    try {
      if (verifierRef.current) {
        try { verifierRef.current.clear(); } catch {}
        verifierRef.current = null;
      }
      const verifier = getVerifier();
      const confirmation = await sendPhoneOtp(fullNumber, verifier);
      confirmationRef.current = confirmation;
      setResendTimer(30);
    } catch (err: any) {
      setError(getFriendlyError(err.code || 'unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = error || authError;

  return (
    <div className="auth-card">
      {!otpSent ? (
        <form onSubmit={handleSendOtp}>
          <div className="field">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 98765 43210"
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={submitting}
          >
            {submitting ? <span className="spinner" /> : 'Send OTP'}
          </button>

          <div ref={recaptchaRef} />
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp}>
          <p className="otp-info">
            Code sent to <strong>{phoneNumber.startsWith('+') ? phoneNumber : '+91' + phoneNumber}</strong>
          </p>

          <div className="field">
            <label htmlFor="otp">Enter 6-digit OTP</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              required
              disabled={submitting}
              className="otp-input"
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary btn--full"
            disabled={submitting || otp.length !== 6}
          >
            {submitting ? <span className="spinner" /> : 'Verify & Sign In'}
          </button>

          <button
            type="button"
            className="btn--link"
            onClick={handleResend}
            disabled={resendTimer > 0 || submitting}
          >
            {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
          </button>

          <button
            type="button"
            className="btn--link"
            onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
            disabled={submitting}
          >
            Change phone number
          </button>
        </form>
      )}

      {displayError && <div className="alert alert--error">{displayError}</div>}
    </div>
  );
}
