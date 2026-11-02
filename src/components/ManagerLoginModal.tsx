import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, X, ShieldCheck, KeyRound, Loader2, Sparkles } from 'lucide-react';
import { signInManagerWithGoogle } from '../firebase';
import { User } from 'firebase/auth';

interface ManagerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (googleUser?: User) => void;
  currentPin: string;
}

export default function ManagerLoginModal({
  isOpen,
  onClose,
  onSuccess,
  currentPin,
}: ManagerLoginModalProps) {
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg('');
      setShowPin(false);
      setIsGoogleLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMsg('');
    try {
      const user = await signInManagerWithGoogle();
      // Store auth session
      if (rememberMe) {
        localStorage.setItem('mess_manager_auth', 'true');
      } else {
        sessionStorage.setItem('mess_manager_auth', 'true');
      }
      onSuccess(user);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed. Please try again.');
      } else if (code === 'auth/cancelled-popup-request') {
        // Ignored
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg('Browser blocked the popup window. Please allow popups for this site.');
      } else {
        setErrorMsg(err?.message || 'Google sign-in failed. Please try again or use PIN.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const targetPin = (currentPin || '1234').trim();
    if (pinInput.trim() === targetPin) {
      // Store auth session
      if (rememberMe) {
        localStorage.setItem('mess_manager_auth', 'true');
      } else {
        sessionStorage.setItem('mess_manager_auth', 'true');
      }
      setErrorMsg('');
      onSuccess();
    } else {
      setErrorMsg('Incorrect PIN! Please try again.');
      setPinInput('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Lock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Manager Authentication</h3>
              <p className="text-xs text-slate-400">Sign in with Google or unlock via PIN</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Public Mode Notice */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-800">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Public Boarder Mode is Active</p>
              <p className="text-blue-700 mt-0.5 text-[11px] leading-relaxed">
                All boarders can freely view their meal logs and balances without logging in. Manager login is required only to edit logs, deposits, and mess settings.
              </p>
            </div>
          </div>

          {/* Primary Action: Google Sign-In */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              id="btn-google-signin"
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              )}
              <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google as Manager'}</span>
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Instant one-click authentication linked to your verified Google account
            </p>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] font-bold text-slate-600 uppercase tracking-wider shrink-0">
              Or unlock with Manager PIN
            </span>
            <div className="border-t border-slate-200 w-full" />
          </div>

          {/* PIN Form */}
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  Manager PIN
                </span>
              </label>

              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPin ? "text" : "password"}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  autoComplete="current-password"
                  placeholder="Enter 4-digit PIN"
                  className={`w-full bg-slate-50 border ${
                    errorMsg ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-blue-500'
                  } rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 transition-all`}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1 animate-fadeIn">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errorMsg}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Remember login on this browser</span>
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-submit-manager-pin"
                className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-200 hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                Unlock with PIN
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-[11px] text-slate-500 flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            Secure Authentication
          </span>
          <span className="text-slate-400">Authorized Personnel Only</span>
        </div>
      </div>
    </div>
  );
}
