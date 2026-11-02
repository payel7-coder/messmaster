import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, X, ShieldCheck, KeyRound } from 'lucide-react';

interface ManagerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setErrorMsg('');
      setShowPin(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
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
              <p className="text-xs text-slate-400">Restricted administrative access</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-800">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Public Boarder Mode is Active</p>
              <p className="text-blue-700 mt-0.5 text-[11px] leading-relaxed">
                All boarders can view their meal ledger, calculations, and monthly PDFs without logging in. Manager authentication is required only to modify records and mess settings.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                Enter Manager PIN
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
                className={`w-full bg-slate-50 border ${
                  errorMsg ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300 focus:ring-blue-500'
                } rounded-xl px-4 py-3 text-sm font-mono tracking-widest text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 transition-all`}
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
              Cancel (Stay Public)
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-200 hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Unlock Manager
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-[11px] text-slate-500 flex justify-between items-center">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            Manager Protection Active
          </span>
          <span className="text-slate-400">Authorized Personnel Only</span>
        </div>
      </div>
    </div>
  );
}
