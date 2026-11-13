import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Calendar, 
  RefreshCw, 
  Lock, 
  LogOut, 
  Globe, 
  ChevronDown, 
  Settings, 
  LayoutDashboard,
  ShieldCheck,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { Boarder } from '../types';

interface GoogleUserInfo {
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  uid?: string;
}

interface RoleSelectorProps {
  role: 'manager' | 'boarder';
  setRole: (role: 'manager' | 'boarder') => void;
  selectedBoarderId: string;
  setSelectedBoarderId: (id: string) => void;
  boarders: Boarder[];
  currentMonth: string;
  onSimulateData: () => void;
  hasData: boolean;
  isManagerAuthenticated: boolean;
  googleUser?: GoogleUserInfo | null;
  onRequireManagerLogin: () => void;
  onManagerLogout: () => void;
  onNavigateTab?: (tab: 'dashboard' | 'report' | 'settings') => void;
}

export default function RoleSelector({
  role,
  setRole,
  selectedBoarderId,
  setSelectedBoarderId,
  boarders,
  currentMonth,
  onSimulateData,
  hasData,
  isManagerAuthenticated,
  googleUser,
  onRequireManagerLogin,
  onManagerLogout,
  onNavigateTab,
}: RoleSelectorProps) {
  const activeBoarders = boarders.filter(b => b.isActive);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  const handleManagerClick = () => {
    if (isManagerAuthenticated) {
      setRole('manager');
      if (onNavigateTab) onNavigateTab('dashboard');
    } else {
      onRequireManagerLogin();
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between min-h-16 py-2.5 gap-4">
          
          {/* Zone 1: Clean Brand Lockup */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-base tracking-tight select-none">
              M
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none whitespace-nowrap">
                MessMaster
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-1 whitespace-nowrap">
                <span>{role === 'manager' ? 'Manager Workspace' : 'Public Ledger'}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-mono tabular-nums text-slate-700 font-semibold">
                  {currentMonth}
                </span>
              </div>
            </div>
          </div>

          {/* Center Empty State Shortcut */}
          {!hasData && (
            <div className="hidden lg:flex items-center gap-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg px-3 py-1.5 text-amber-900 text-xs">
              <span>No active logs for {currentMonth}</span>
              <button
                onClick={onSimulateData}
                className="flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Load Sample Data</span>
              </button>
            </div>
          )}

          {/* Zone 2 & 3: Mode Switcher, Boarder Selector, and Auth */}
          <div className="flex flex-wrap items-center gap-2.5 ml-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/60">
              
              {/* Boarder / Public Dashboard Button */}
              <button
                onClick={() => {
                  setRole('boarder');
                  if (activeBoarders.length > 0 && !selectedBoarderId) {
                    setSelectedBoarderId(activeBoarders[0].id);
                  }
                  if (onNavigateTab) onNavigateTab('dashboard');
                }}
                id="btn-role-boarder"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                  role === 'boarder'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Public read-only view for boarders"
              >
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Boarder View</span>
              </button>

              {/* Manager Portal Button */}
              <button
                onClick={handleManagerClick}
                id="btn-role-manager"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                  role === 'manager'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isManagerAuthenticated ? "Access Manager Console" : "Manager authentication required"}
              >
                {isManagerAuthenticated ? (
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Manager</span>
              </button>
            </div>

            {/* Boarder selector dropdown when in Boarder role */}
            {role === 'boarder' && activeBoarders.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg">
                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Member:</span>
                <select
                  value={selectedBoarderId}
                  onChange={(e) => setSelectedBoarderId(e.target.value)}
                  id="select-boarder-view"
                  className="bg-transparent text-slate-900 text-xs font-semibold cursor-pointer focus:outline-hidden max-w-[160px] truncate"
                >
                  {activeBoarders.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.roomNo ? ` (${b.roomNo})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Authenticated Manager Identity & Dropdown Menu */}
            {isManagerAuthenticated ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  id="btn-manager-profile-menu"
                  className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl transition-all cursor-pointer shadow-2xs"
                  title="Manager account options"
                >
                  {googleUser?.photoURL ? (
                    <img 
                      src={googleUser.photoURL} 
                      alt="Google Avatar" 
                      className="w-5 h-5 rounded-full object-cover border border-emerald-400"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                      {(googleUser?.displayName || googleUser?.email || 'M').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="text-left hidden sm:block">
                    <div className="text-[11px] font-bold text-slate-900 leading-tight truncate max-w-[110px]">
                      {googleUser?.displayName || 'Mess Manager'}
                    </div>
                    <div className="text-[9px] text-emerald-700 leading-tight flex items-center gap-1">
                      {googleUser ? (
                        <>
                          <svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span>Google Auth</span>
                        </>
                      ) : (
                        <span>PIN Session</span>
                      )}
                    </div>
                  </div>

                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Card */}
                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-scaleIn">
                    {/* Header profile info */}
                    <div className="px-4 py-3 border-b border-slate-100 flex items-start gap-3">
                      {googleUser?.photoURL ? (
                        <img 
                          src={googleUser.photoURL} 
                          alt="Avatar" 
                          className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {(googleUser?.displayName || 'M').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {googleUser?.displayName || 'Authenticated Manager'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {googleUser?.email || 'Security PIN Mode'}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                            Full Admin Rights
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Shortcuts */}
                    <div className="p-1 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setRole('manager');
                          if (onNavigateTab) onNavigateTab('dashboard');
                          setShowProfileMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer text-left"
                      >
                        <LayoutDashboard className="w-4 h-4 text-blue-600" />
                        <span>Go to Manager Console</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigateTab) onNavigateTab('settings');
                          setShowProfileMenu(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer text-left"
                      >
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span>Mess Settings & PIN</span>
                      </button>

                      {!googleUser && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileMenu(false);
                            onRequireManagerLogin();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-blue-700 hover:bg-blue-50 font-bold cursor-pointer text-left"
                        >
                          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span>Sign in with Google</span>
                        </button>
                      )}
                    </div>

                    {/* Footer sign out */}
                    <div className="p-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          onManagerLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-700 hover:bg-rose-50 font-bold cursor-pointer text-left text-xs"
                      >
                        <LogOut className="w-4 h-4 text-rose-600" />
                        <span>Sign Out / Lock Manager Mode</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onRequireManagerLogin}
                id="btn-header-manager-signin"
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 hover:border-blue-500 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                title="Sign in with Google as Manager"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Manager Sign In</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
