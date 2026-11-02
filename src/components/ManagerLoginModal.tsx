import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  X, 
  ShieldCheck, 
  KeyRound, 
  Loader2, 
  Sparkles,
  CheckCircle2,
  Delete,
  Info,
  Shield,
  User,
  ArrowRight,
  Copy,
  ExternalLink
} from 'lucide-react';
import { signInManagerWithGoogle } from '../firebase';
import { User as FirebaseUser } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

interface ManagerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (googleUser?: FirebaseUser) => void;
  currentPin: string;
}

type AuthTab = 'google' | 'pin' | 'guide';

export default function ManagerLoginModal({
  isOpen,
  onClose,
  onSuccess,
  currentPin,
}: ManagerLoginModalProps) {
  const [activeTab, setActiveTab] = useState<AuthTab>('google');
  
  // PIN 4-digit input state
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isSuccessAnimating, setIsSuccessAnimating] = useState(false);

  const digitInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    if (isOpen) {
      setPinDigits(['', '', '', '']);
      setErrorMsg('');
      setShowPin(false);
      setIsGoogleLoading(false);
      setIsSuccessAnimating(false);
      setIsShaking(false);
      
      // Auto focus on PIN tab if open
      if (activeTab === 'pin') {
        setTimeout(() => {
          digitInputRefs[0].current?.focus();
        }, 150);
      }
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Handle Google SSO login
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMsg('');
    try {
      const user = await signInManagerWithGoogle();
      if (rememberMe) {
        localStorage.setItem('mess_manager_auth', 'true');
      } else {
        sessionStorage.setItem('mess_manager_auth', 'true');
      }
      setIsSuccessAnimating(true);
      setTimeout(() => {
        onSuccess(user);
      }, 500);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'payel7-coder.github.io';
        setUnauthorizedDomain(host);
        setErrorMsg(`Domain "${host}" needs to be added to Authorized Domains in your Firebase Project Console.`);
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Google sign-in popup was dismissed. Click below to try again.');
      } else if (code === 'auth/cancelled-popup-request') {
        // Ignored
      } else if (code === 'auth/popup-blocked') {
        setErrorMsg('Browser blocked the popup window. Please allow popups for this site or use the Security PIN.');
      } else {
        setErrorMsg(err?.message || 'Google authentication failed. Please try again or use the PIN tab.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Handle digit change in 4-box input
  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digit
    const cleanChar = value.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...pinDigits];
    updated[index] = cleanChar;
    setPinDigits(updated);
    if (errorMsg) setErrorMsg('');

    // If entered a digit and not last index, jump to next input
    if (cleanChar && index < 3) {
      digitInputRefs[index + 1].current?.focus();
    }

    // Auto submit if all 4 digits filled
    if (cleanChar && index === 3) {
      const fullPin = updated.join('');
      validateAndSubmitPin(fullPin);
    }
  };

  // Handle backspace navigation in PIN boxes
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      digitInputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      digitInputRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      digitInputRefs[index + 1].current?.focus();
    }
  };

  // Handle paste in PIN boxes
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
    if (pasted.length > 0) {
      const updated = ['', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        updated[i] = pasted[i];
      }
      setPinDigits(updated);
      if (pasted.length === 4) {
        validateAndSubmitPin(pasted);
      } else {
        digitInputRefs[Math.min(pasted.length, 3)].current?.focus();
      }
    }
  };

  // Touch Keypad virtual button click
  const handleKeypadPress = (val: string) => {
    if (val === 'clear') {
      setPinDigits(['', '', '', '']);
      digitInputRefs[0].current?.focus();
      return;
    }
    if (val === 'backspace') {
      const updated = [...pinDigits];
      for (let i = 3; i >= 0; i--) {
        if (updated[i]) {
          updated[i] = '';
          setPinDigits(updated);
          digitInputRefs[i].current?.focus();
          return;
        }
      }
      return;
    }

    // Number key
    const firstEmptyIndex = pinDigits.findIndex(d => d === '');
    if (firstEmptyIndex !== -1) {
      const updated = [...pinDigits];
      updated[firstEmptyIndex] = val;
      setPinDigits(updated);
      if (firstEmptyIndex < 3) {
        digitInputRefs[firstEmptyIndex + 1].current?.focus();
      } else {
        // Complete 4 digits
        validateAndSubmitPin(updated.join(''));
      }
    }
  };

  // Validate entered PIN against current configuration
  const validateAndSubmitPin = (enteredPin: string) => {
    const targetPin = (currentPin || '1234').trim();
    if (enteredPin === targetPin) {
      if (rememberMe) {
        localStorage.setItem('mess_manager_auth', 'true');
      } else {
        sessionStorage.setItem('mess_manager_auth', 'true');
      }
      setIsSuccessAnimating(true);
      setErrorMsg('');
      setTimeout(() => {
        onSuccess();
      }, 400);
    } else {
      setIsShaking(true);
      setErrorMsg('Incorrect Security PIN. Please verify and try again.');
      setPinDigits(['', '', '', '']);
      setTimeout(() => {
        setIsShaking(false);
        digitInputRefs[0].current?.focus();
      }, 500);
    }
  };

  const handleUseDefaultPin = () => {
    const def = '1234';
    setPinDigits(def.split(''));
    validateAndSubmitPin(def);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div 
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full overflow-hidden transition-all duration-200 ${
          isShaking ? 'animate-shake' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-900/50">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">Manager Authentication</h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Cloud Auth
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Administrative access for mess operations & ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Mode Tabs */}
        <div className="bg-slate-100/90 p-1.5 flex gap-1 border-b border-slate-200">
          <button
            type="button"
            onClick={() => { setActiveTab('google'); setErrorMsg(''); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'google'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Google SSO</span>
            <span className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded hidden sm:inline">
              Recommended
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('pin'); setErrorMsg(''); }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'pin'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
            <span>Passcode PIN</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('guide'); setErrorMsg(''); }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'guide'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Access Info</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          
          {/* TAB 1: GOOGLE SINGLE SIGN-ON */}
          {activeTab === 'google' && (
            <div className="space-y-5 animate-fadeIn">
              
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-slate-900">Sign in with your Google Account</h4>
                <p className="text-xs text-slate-500">
                  Instant one-click authentication linked with Google Firebase Identity.
                </p>
              </div>

              {/* Primary Interactive Google Login Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isSuccessAnimating}
                id="btn-interactive-google-login"
                className={`w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-800 font-bold text-sm py-3.5 px-4 rounded-xl border border-slate-300 hover:border-blue-500 shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-60 relative overflow-hidden group`}
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : isSuccessAnimating ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-scaleIn" />
                ) : (
                  <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                )}
                <span>
                  {isGoogleLoading
                    ? 'Connecting with Google...'
                    : isSuccessAnimating
                    ? 'Manager Authenticated!'
                    : 'Continue with Google Account'}
                </span>
              </button>

              {unauthorizedDomain ? (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900 space-y-3 animate-fadeIn shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold text-amber-950 text-sm">Action Required: Authorize Domain in Firebase</h5>
                      <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                        Google OAuth blocks sign-ins until your website domain is whitelisted in Firebase Console under project <span className="font-bold text-amber-950">{firebaseConfig.projectId}</span>.
                      </p>
                    </div>
                  </div>

                  {/* Copyable Domain box */}
                  <div className="flex items-center gap-2 bg-white border border-amber-300 rounded-xl p-2.5">
                    <code className="flex-1 font-mono text-xs font-bold text-slate-900 select-all truncate">
                      {unauthorizedDomain}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        if (unauthorizedDomain) {
                          navigator.clipboard.writeText(unauthorizedDomain);
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 3000);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors shrink-0"
                    >
                      {copiedDomain ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Domain</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Step by step guide */}
                  <ol className="list-decimal list-inside text-[11px] text-amber-900 space-y-1 bg-amber-100/60 p-2.5 rounded-xl border border-amber-200">
                    <li>Open <strong>Authentication → Settings → Authorized domains</strong> in Firebase.</li>
                    <li>Click <strong>Add domain</strong>, paste <code className="font-bold font-mono text-slate-900">{unauthorizedDomain}</code>, and click <strong>Save</strong>.</li>
                  </ol>

                  <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-3 rounded-xl transition-all shadow-xs text-xs text-center"
                    >
                      <span>Open Firebase Console Settings</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('pin');
                        handleUseDefaultPin();
                      }}
                      className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-3 rounded-xl transition-all shadow-xs cursor-pointer text-xs"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Unlock with PIN (1234) Now</span>
                    </button>
                  </div>
                </div>
              ) : errorMsg && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Authentication Notice</p>
                    <p className="mt-0.5 text-rose-700 leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Three Value Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">Zero Passwords</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Biometrics and Google session protection</div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">Device Sync</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Access seamlessly on your mobile or PC</div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left">
                  <div className="w-6 h-6 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 mb-1.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">Manager Profile</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Displays verified avatar & name in reports</div>
                </div>
              </div>

              {/* Session Persistence Toggle */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Keep session signed in across reloads</span>
                </label>

                <button
                  type="button"
                  onClick={() => setActiveTab('pin')}
                  className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer underline text-[11px]"
                >
                  Use PIN instead →
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: PASSCODE PIN & INTERACTIVE KEYPAD */}
          {activeTab === 'pin' && (
            <div className="space-y-4 animate-fadeIn">
              
              <div className="text-center space-y-1">
                <h4 className="text-base font-bold text-slate-900">Enter 4-Digit Security PIN</h4>
                <p className="text-xs text-slate-500">
                  Unlock administrative controls using your configured manager passcode.
                </p>
              </div>

              {/* 4-Box Interactive Digit Cells */}
              <div className="flex items-center justify-center gap-3 py-2">
                {pinDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={digitInputRefs[idx]}
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    className={`w-12 h-14 text-center text-xl font-bold font-mono rounded-xl border-2 transition-all shadow-xs ${
                      digit
                        ? 'border-blue-600 bg-blue-50/40 text-blue-900'
                        : 'border-slate-300 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white'
                    } focus:outline-hidden focus:ring-2 focus:ring-blue-400/40`}
                  />
                ))}

                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-700 flex items-center justify-center gap-2 animate-fadeIn text-center font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Interactive On-Screen Touch Keypad */}
              <div className="max-w-xs mx-auto pt-1">
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num)}
                      className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-blue-100 active:text-blue-700 font-bold text-base text-slate-800 transition-all cursor-pointer shadow-2xs"
                    >
                      {num}
                    </button>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('clear')}
                    className="h-11 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-xs font-bold text-slate-500 transition-all cursor-pointer"
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-blue-100 active:text-blue-700 font-bold text-base text-slate-800 transition-all cursor-pointer shadow-2xs"
                  >
                    0
                  </button>

                  <button
                    type="button"
                    onClick={() => handleKeypadPress('backspace')}
                    className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 flex items-center justify-center text-slate-600 transition-all cursor-pointer"
                    title="Backspace"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Quick helper for default PIN */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleUseDefaultPin}
                  className="text-blue-600 hover:text-blue-700 font-bold text-[11px] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Quick Fill Default PIN (1234)
                </button>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-600 text-[11px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                  <span>Remember PIN</span>
                </label>
              </div>

            </div>
          )}

          {/* TAB 3: ACCESS & ROLES BREAKDOWN */}
          {activeTab === 'guide' && (
            <div className="space-y-4 animate-fadeIn text-xs">
              
              <div className="bg-blue-50 border border-blue-200/80 rounded-xl p-3.5 text-blue-900 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-blue-950">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  Zero-Friction Public Transparency Architecture
                </p>
                <p className="mt-1 text-blue-800 text-[11px]">
                  General boarders never need accounts, emails, or logins to view meals, ledger entries, or download monthly calculation sheets. Manager authentication is strictly reserved for administrative record-keeping.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-2.5">Feature & Tool</th>
                      <th className="p-2.5 text-center">Boarder (Public)</th>
                      <th className="p-2.5 text-center bg-blue-50/50 text-blue-900">Manager Mode</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="p-2.5 font-medium">Daily Meal Log & Rates</td>
                      <td className="p-2.5 text-center text-emerald-600 font-bold">View Only</td>
                      <td className="p-2.5 text-center bg-blue-50/30 text-blue-700 font-bold">Full Edit</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Bazaar Cost Ledger</td>
                      <td className="p-2.5 text-center text-emerald-600 font-bold">View Only</td>
                      <td className="p-2.5 text-center bg-blue-50/30 text-blue-700 font-bold">Add & Delete</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Boarder Roster</td>
                      <td className="p-2.5 text-center text-emerald-600 font-bold">View Only</td>
                      <td className="p-2.5 text-center bg-blue-50/30 text-blue-700 font-bold">Register & Edit</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Fixed Utility Bills & Rent</td>
                      <td className="p-2.5 text-center text-emerald-600 font-bold">View Only</td>
                      <td className="p-2.5 text-center bg-blue-50/30 text-blue-700 font-bold">Manage Bills</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium">Monthly PDF Exports</td>
                      <td className="p-2.5 text-center text-slate-500">Personal View</td>
                      <td className="p-2.5 text-center bg-blue-50/30 text-blue-700 font-bold">Full Master Sheet</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('google')}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-colors"
                >
                  Proceed to Sign In
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            256-bit Cloud TLS · Google Cloud Firestore
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            Stay in Public View
          </button>
        </div>

      </div>
    </div>
  );
}
