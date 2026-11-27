import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Shield,
  RefreshCw,
  Lock,
  LogOut,
  ChevronDown,
  Settings,
  LayoutDashboard,
  Menu,
  X,
  BarChart3,
  ReceiptText,
  Cloud,
  Utensils,
  ShoppingCart,
  DollarSign,
  Receipt,
  Users,
  UtensilsCrossed,
  ArrowRightLeft,
  KeyRound,
  FileSpreadsheet,
  FileText,
  Database,
} from 'lucide-react';
import { Boarder, QuickManagerAction } from '../types';

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
  activeTab?: 'dashboard' | 'analytics' | 'report' | 'settings';
  onNavigateTab?: (tab: 'dashboard' | 'analytics' | 'report' | 'settings') => void;
  hideBoardersWithoutPin?: boolean;
  isSelectedBoarderUnlocked?: boolean;
  onLockBoarder?: () => void;
  isCloudSynced?: boolean;
  isCloudLoading?: boolean;
  onOpenCloudModal?: () => void;
  onQuickManagerAction?: (action: QuickManagerAction) => void;
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
  activeTab = 'dashboard',
  onNavigateTab,
  hideBoardersWithoutPin = false,
  isSelectedBoarderUnlocked = false,
  onLockBoarder,
  isCloudSynced = false,
  isCloudLoading = false,
  onOpenCloudModal,
  onQuickManagerAction,
}: RoleSelectorProps) {
  const activeBoarders = boarders.filter(b => b.isActive);
  const selectedBoarderObj = activeBoarders.find(b => b.id === selectedBoarderId);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close desktop profile dropdown when clicking outside
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

  // Close mobile menu bar on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setShowProfileMenu(false);
      }
    };
    if (mobileMenuOpen || showProfileMenu) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, showProfileMenu]);

  const handleManagerClick = () => {
    setMobileMenuOpen(false);
    if (isManagerAuthenticated) {
      setRole('manager');
      if (onNavigateTab) onNavigateTab('dashboard');
    } else {
      onRequireManagerLogin();
    }
  };

  const handleBoarderClick = () => {
    setRole('boarder');
    if (activeBoarders.length > 0 && !selectedBoarderId) {
      setSelectedBoarderId(activeBoarders[0].id);
    }
    if (onNavigateTab) onNavigateTab('dashboard');
    setMobileMenuOpen(false);
  };

  const handleMobileNav = (tab: 'dashboard' | 'analytics' | 'report' | 'settings') => {
    if (onNavigateTab) onNavigateTab(tab);
    setMobileMenuOpen(false);
  };

  const handleMobileQuickAction = (action: QuickManagerAction) => {
    setMobileMenuOpen(false);
    if (onQuickManagerAction) {
      onQuickManagerAction(action);
    }
  };

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-14 md:min-h-16 py-2 gap-3">
          
          {/* Zone 1: Clean Brand Lockup */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm sm:text-base tracking-tight select-none">
              M
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none whitespace-nowrap">
                MessMaster
              </h1>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5 sm:mt-1 whitespace-nowrap">
                <span>{role === 'manager' ? 'Manager Workspace' : 'Public Ledger'}</span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="font-mono tabular-nums text-slate-700 font-semibold">
                  {currentMonth}
                </span>
              </div>
            </div>
          </div>

          {/* Center Empty State Shortcut (Desktop) */}
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

          {/* Zone 2 & 3 (Desktop): Mode Switcher, Boarder Selector, and Auth */}
          <div className="hidden md:flex items-center gap-2.5 ml-auto">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/60">
              
              {/* Boarder / Public Dashboard Button */}
              <button
                onClick={handleBoarderClick}
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
              hideBoardersWithoutPin && !isManagerAuthenticated ? (
                isSelectedBoarderUnlocked && selectedBoarderObj ? (
                  <div className="flex items-center gap-2 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg">
                    <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Member:</span>
                    <span className="text-xs font-semibold text-slate-900 max-w-[140px] truncate">
                      {selectedBoarderObj.name}
                    </span>
                    {onLockBoarder && (
                      <button
                        type="button"
                        onClick={onLockBoarder}
                        className="ml-0.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        title="Lock & switch member"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Lock</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                    <Lock className="w-3 h-3 text-slate-500" />
                    <span>PIN Protected</span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg">
                  <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Member:</span>
                  <select
                    value={selectedBoarderId}
                    onChange={(e) => setSelectedBoarderId(e.target.value)}
                    id="select-boarder-view"
                    className="bg-transparent text-slate-900 text-xs font-semibold cursor-pointer focus:outline-hidden max-w-[175px] truncate"
                  >
                    {activeBoarders.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}{b.roomNo ? ` (${b.roomNo})` : ''}{b.pin ? ' 🔒' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
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

                  <div className="text-left hidden lg:block">
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
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 hover:border-blue-500 shadow-2xs hover:shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
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

          {/* Mobile Compact Status + Menu Bar Trigger */}
          <div className="flex md:hidden items-center gap-2 ml-auto shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                role === 'manager' && isManagerAuthenticated
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {role === 'manager' && isManagerAuthenticated ? (
                <Shield className="w-3 h-3 text-emerald-600" />
              ) : (
                <User className="w-3 h-3 text-blue-600" />
              )}
              <span>{role === 'manager' ? 'Manager' : 'Boarder'}</span>
            </span>

            <button
              type="button"
              id="btn-mobile-menu-toggle"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu bar' : 'Open menu bar'}
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                mobileMenuOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              <span>{mobileMenuOpen ? 'Close' : 'Menu'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Collapsible Menu Bar Drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 top-14 bg-slate-900/30 backdrop-blur-[1px] z-20 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            id="mobile-menu-drawer"
            className="md:hidden relative z-30 bg-white border-t border-slate-200/90 shadow-xl max-h-[calc(100vh-3.75rem)] overflow-y-auto animate-fadeIn"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-5">

              {/* Section 1: Workspace Mode & Member */}
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Workspace Mode
                </p>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
                  <button
                    type="button"
                    onClick={handleBoarderClick}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      role === 'boarder'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    <span>Boarder View</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleManagerClick}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      role === 'manager'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    {isManagerAuthenticated ? (
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>Manager Portal</span>
                  </button>
                </div>

                {/* Member Selector inside Mobile Menu */}
                {role === 'boarder' && activeBoarders.length > 0 && (
                  hideBoardersWithoutPin && !isManagerAuthenticated ? (
                    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {isSelectedBoarderUnlocked && selectedBoarderObj
                            ? `Unlocked: ${selectedBoarderObj.name}`
                            : 'Directory PIN Protected'}
                        </span>
                      </div>
                      {isSelectedBoarderUnlocked && onLockBoarder && (
                        <button
                          type="button"
                          onClick={() => {
                            onLockBoarder();
                            setMobileMenuOpen(false);
                          }}
                          className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer shrink-0"
                        >
                          Lock Statement
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-slate-500 shrink-0">Member:</span>
                      <select
                        value={selectedBoarderId}
                        onChange={(e) => {
                          setSelectedBoarderId(e.target.value);
                          setMobileMenuOpen(false);
                        }}
                        className="flex-1 bg-transparent text-slate-900 text-xs font-semibold cursor-pointer focus:outline-hidden text-right truncate"
                      >
                        {activeBoarders.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}{b.roomNo ? ` (${b.roomNo})` : ''}{b.pin ? ' 🔒' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                )}
              </div>

              {/* Section 2: Primary Navigation */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Navigation
                </p>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleMobileNav('dashboard')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer text-left border transition-colors ${
                      activeTab === 'dashboard'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    <span>{role === 'manager' ? 'Manager Console' : 'My Statement'}</span>
                  </button>

                  {role === 'manager' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMobileNav('analytics')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer text-left border transition-colors ${
                          activeTab === 'analytics'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4 shrink-0" />
                        <span>Analytics & Trends</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleMobileNav('report')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer text-left border transition-colors ${
                          activeTab === 'report'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                        }`}
                      >
                        <ReceiptText className="w-4 h-4 shrink-0" />
                        <span>Month-End Bills & Memos</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleMobileNav('settings')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer text-left border transition-colors ${
                      activeTab === 'settings'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    <span>Mess Settings</span>
                  </button>
                </div>
              </div>

              {/* Section 3: Manager Operations & PDF Statements */}
              {role === 'manager' && isManagerAuthenticated && onQuickManagerAction && (
                <>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Manager Operations
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('meals')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer text-left"
                      >
                        <Utensils className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Daily Meals</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('bazaar')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer text-left"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>+ Daily Cost</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('deposits')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer text-left"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>+ Deposit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('fixed')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer text-left"
                      >
                        <Receipt className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>Fixed Bills</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('boarders')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer text-left"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>Boarders & PIN</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('special-feast')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-50 text-xs font-semibold text-purple-800 cursor-pointer text-left"
                      >
                        <UtensilsCrossed className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>Special Feast</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('handover')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 text-xs font-semibold text-emerald-800 cursor-pointer text-left"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Handover</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('security-pin')}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer text-left"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>Security PIN</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Export PDF Statements
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('meal-sheet-pdf')}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer text-left"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Meal Sheet PDF (By Room)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('deposit-pdf')}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer text-left"
                      >
                        <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>All-Boarders Deposit Statement PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMobileQuickAction('financial-pdf')}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer text-left"
                      >
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>Financial Audit & Vouchers PDF</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Section 4: Cloud Sync & Account */}
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                {role === 'manager' && isManagerAuthenticated && onOpenCloudModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenCloudModal();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                      isCloudSynced
                        ? 'bg-slate-50 text-slate-700 border-slate-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Cloud className={`w-4 h-4 ${isCloudSynced ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <span>Cloud Sync Status</span>
                    </span>
                    <span className="font-bold">
                      {isCloudLoading ? 'Syncing…' : isCloudSynced ? 'Firestore Synced' : 'Offline Cache'}
                    </span>
                  </button>
                )}

                {!hasData && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSimulateData();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Database className="w-4 h-4" />
                    <span>Load Sample Data for {currentMonth}</span>
                  </button>
                )}

                {isManagerAuthenticated ? (
                  <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {googleUser?.displayName || 'Authenticated Manager'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        {googleUser?.email || 'Security PIN Session'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onManagerLogout();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onRequireManagerLogin();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Manager Sign In</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
