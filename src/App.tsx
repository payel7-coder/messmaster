/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ReceiptText, 
  Settings, 
  Sparkles, 
  Info,
  Calendar,
  Building,
  Lock,
  Unlock,
  KeyRound,
  ShieldCheck,
  Check,
  Globe,
  Target,
  Cloud,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
  UploadCloud,
  UserCheck,
  UserPlus,
  Users,
  ArrowRightLeft,
  BarChart3
} from 'lucide-react';

import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, RegisteredManager, MonthClosureRecord } from './types';
import { calculateReport, formatReadableMonth } from './utils';
import { INITIAL_SETTINGS, INITIAL_MISC_COSTS, generateSampleData } from './data';
import { testFirestoreConnection, auth, signOutManager } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  loadInitialData, 
  subscribeToFirestoreUpdates, 
  syncSettingsToFirestore,
  syncDepositToFirestore,
  syncMiscCostsToFirestore,
  seedFirestore,
  clearBrowserLocalStorageCache,
  forceFetchFromServer,
  PRIMARY_MANAGER_EMAIL,
  verifyManagerEmail,
  fetchRegisteredManagers,
  registerNewManager,
  unregisterManager,
  subscribeToRegisteredManagers
} from './services/firestoreService';
import firebaseConfig from '../firebase-applet-config.json';

import RoleSelector from './components/RoleSelector';
import BoarderDashboard from './components/BoarderDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import MonthEndReport from './components/MonthEndReport';
import ManagerAnalyticsDashboard from './components/ManagerAnalyticsDashboard';
import ManagerLoginModal from './components/ManagerLoginModal';
import CloudSyncModal from './components/CloudSyncModal';
import WipeDataModal from './components/WipeDataModal';
import MonthCloseHandoverModal from './components/MonthCloseHandoverModal';

type NavTab = 'dashboard' | 'analytics' | 'report' | 'settings';

export default function App() {
  // --- Manager Authentication State ---
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('mess_manager_auth') === 'true' ||
           sessionStorage.getItem('mess_manager_auth') === 'true';
  });
  const [googleUser, setGoogleUser] = useState<{
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    uid: string;
  } | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showWipeModal, setShowWipeModal] = useState<boolean>(false);
  const [showHandoverModal, setShowHandoverModal] = useState<boolean>(false);

  // --- Active Role / Selected Profiles ---
  // Defaults to public 'boarder' view unless manager has already logged in on this browser
  const [role, setRole] = useState<'manager' | 'boarder'>(() => {
    const isAuth = localStorage.getItem('mess_manager_auth') === 'true' ||
                   sessionStorage.getItem('mess_manager_auth') === 'true';
    return isAuth ? 'manager' : 'boarder';
  });
  
  const [selectedBoarderId, setSelectedBoarderId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');

  // --- Core Application State (Synchronized with Firestore as single source of truth) ---
  const [boarders, setBoarders] = useState<Boarder[]>(() => {
    const raw = localStorage.getItem('mess_boarders');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [deposits, setDeposits] = useState<Deposit[]>(() => {
    const raw = localStorage.getItem('mess_deposits');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [mealLogs, setMealLogs] = useState<DailyMealLog[]>(() => {
    const raw = localStorage.getItem('mess_mealLogs');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [bazaarCosts, setBazaarCosts] = useState<BazaarCost[]>(() => {
    const raw = localStorage.getItem('mess_bazaarCosts');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [miscCosts, setMiscCosts] = useState<MiscellaneousCosts>(() => {
    const raw = localStorage.getItem('mess_miscCosts');
    return raw ? JSON.parse(raw) : { cookerBill: 0, utilityBill: 0, gasBill: 0, wifiBill: 0, houseRent: 0, otherCosts: 0 };
  });

  const [settings, setSettings] = useState<MessSettings>(() => {
    const raw = localStorage.getItem('mess_settings');
    const parsed = raw ? JSON.parse(raw) : { messName: 'Shajahan Villa', currentMonth: '2026-11', managerPin: '1234' };
    if (!parsed.managerPin) {
      parsed.managerPin = '1234';
    }
    return parsed;
  });

  // Cloud Firestore Sync State
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(false);
  const [showCloudModal, setShowCloudModal] = useState<boolean>(false);
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(true);
  const [isInitialBoot, setIsInitialBoot] = useState<boolean>(true);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [cloudToast, setCloudToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Settings PIN management local state
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState<boolean>(false);

  // Registered Managers state (Google SSO RBAC)
  const [registeredManagers, setRegisteredManagers] = useState<RegisteredManager[]>([]);
  const [newManagerEmailInput, setNewManagerEmailInput] = useState<string>('');
  const [newManagerNameInput, setNewManagerNameInput] = useState<string>('');
  const [isRegisteringManager, setIsRegisteringManager] = useState<boolean>(false);
  const [managerActionMsg, setManagerActionMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // --- Cloud Actions ---
  const handleForceRefresh = async () => {
    setIsCloudLoading(true);
    setCloudError(null);
    try {
      const res = await forceFetchFromServer();
      setBoarders(res.boarders);
      setDeposits(res.deposits);
      setBazaarCosts(res.bazaarCosts);
      setMealLogs(res.mealLogs);
      setSettings(res.settings);
      setMiscCosts(res.miscCosts);
      setIsCloudSynced(true);
      setLastSyncedAt(res.stats.fetchedAt);
      setCloudToast({
        message: `Directly fetched from Cloud Firestore: ${res.boarders.length} boarders, ${res.deposits.length} deposits, ${res.bazaarCosts.length} bazaar costs, ${res.mealLogs.length} meal days.`,
        type: 'success'
      });
      setTimeout(() => setCloudToast(null), 5000);
    } catch (err: any) {
      const msg = err?.message || 'Failed to force fetch from Firestore';
      setCloudError(msg);
      setCloudToast({ message: `Cloud fetch failed: ${msg}`, type: 'error' });
      setTimeout(() => setCloudToast(null), 6000);
      throw err;
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handlePurgeCacheAndReload = async () => {
    setIsCloudLoading(true);
    setCloudError(null);
    try {
      clearBrowserLocalStorageCache();
      const res = await forceFetchFromServer();
      setBoarders(res.boarders);
      setDeposits(res.deposits);
      setBazaarCosts(res.bazaarCosts);
      setMealLogs(res.mealLogs);
      setSettings(res.settings);
      setMiscCosts(res.miscCosts);
      setIsCloudSynced(true);
      setLastSyncedAt(res.stats.fetchedAt);
      setCloudToast({
        message: 'Browser cache purged! Fresh data repopulated directly from Google Cloud Firestore server.',
        type: 'success'
      });
      setTimeout(() => setCloudToast(null), 5000);
    } catch (err: any) {
      const msg = err?.message || 'Purge & reload failed';
      setCloudError(msg);
      throw err;
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handlePushAllToCloud = async () => {
    setIsCloudLoading(true);
    setCloudError(null);
    try {
      await seedFirestore({
        boarders,
        deposits,
        mealLogs,
        bazaarCosts,
        miscCosts,
        settings
      });
      setIsCloudSynced(true);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setCloudToast({
        message: 'Successfully pushed all local data to Google Cloud Firestore database!',
        type: 'success'
      });
      setTimeout(() => setCloudToast(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Failed to push data to Cloud';
      setCloudError(msg);
      throw err;
    } finally {
      setIsCloudLoading(false);
    }
  };

  const handleResetDemoData = async () => {
    setIsCloudLoading(true);
    try {
      const sample = generateSampleData();
      await seedFirestore(sample);
      setBoarders(sample.boarders);
      setDeposits(sample.deposits);
      setMealLogs(sample.mealLogs);
      setBazaarCosts(sample.bazaarCosts);
      setMiscCosts(sample.miscCosts);
      setSettings(sample.settings);
      setIsCloudSynced(true);
      setLastSyncedAt(new Date().toLocaleTimeString());
      setCloudToast({
        message: 'Pristine demo dataset re-seeded to Google Cloud Firestore!',
        type: 'success'
      });
      setTimeout(() => setCloudToast(null), 4000);
    } catch (err: any) {
      const msg = err?.message || 'Failed to reset demo dataset';
      setCloudError(msg);
      throw err;
    } finally {
      setIsCloudLoading(false);
    }
  };

  // --- Initialize and Subscribe to Cloud Firestore ---
  useEffect(() => {
    testFirestoreConnection();
    setIsCloudLoading(true);

    // Fetch initial dataset directly from Cloud Firestore as single source of truth
    loadInitialData().then((cloudResult) => {
      setIsCloudLoading(false);
      setIsInitialBoot(false);
      if (cloudResult.isFromCloud) {
        setBoarders(cloudResult.boarders);
        setDeposits(cloudResult.deposits);
        setMealLogs(cloudResult.mealLogs);
        setBazaarCosts(cloudResult.bazaarCosts);
        setMiscCosts(cloudResult.miscCosts);
        setSettings(cloudResult.settings);
        setIsCloudSynced(true);
        setLastSyncedAt(new Date().toLocaleTimeString());
      } else if (cloudResult.error) {
        setCloudError(cloudResult.error);
      }
    }).catch((err) => {
      setIsCloudLoading(false);
      setIsInitialBoot(false);
      setCloudError(err instanceof Error ? err.message : String(err));
    });

    // Real-time updates subscription across sessions/devices
    const unsubscribe = subscribeToFirestoreUpdates({
      onBoardersUpdate: (b) => {
        setBoarders(b);
        setIsCloudSynced(true);
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onDepositsUpdate: (d) => {
        setDeposits(d);
        setIsCloudSynced(true);
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onBazaarUpdate: (bc) => {
        setBazaarCosts(bc);
        setIsCloudSynced(true);
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onMealsUpdate: (m) => {
        setMealLogs(m);
        setIsCloudSynced(true);
        setLastSyncedAt(new Date().toLocaleTimeString());
      },
      onSettingsUpdate: (s) => {
        setSettings(s);
        setIsCloudSynced(true);
      },
      onMiscUpdate: (mc) => {
        setMiscCosts(mc);
        setIsCloudSynced(true);
      },
    });

    // Fetch initial registered managers
    fetchRegisteredManagers().then((mgrs) => {
      setRegisteredManagers(mgrs);
    }).catch(console.warn);

    // Real-time subscription to registered managers collection
    const managersUnsub = subscribeToRegisteredManagers((mgrs) => {
      setRegisteredManagers(mgrs);
    });

    // Listen to Firebase Google Auth state across reloads/sessions with strict RBAC
    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (firebaseUser.email) {
          try {
            const check = await verifyManagerEmail(firebaseUser.email);
            if (check.isAllowed) {
              setGoogleUser({
                displayName: firebaseUser.displayName,
                email: firebaseUser.email,
                photoURL: firebaseUser.photoURL,
                uid: firebaseUser.uid,
              });
              setIsManagerAuthenticated(true);
              localStorage.setItem('mess_manager_auth', 'true');
            } else {
              // Strictly reject unregistered Google accounts
              await signOutManager();
              setGoogleUser(null);
              setIsManagerAuthenticated(false);
              localStorage.removeItem('mess_manager_auth');
              sessionStorage.removeItem('mess_manager_auth');
              setRole('boarder');
              setCloudToast({
                message: `Access Denied: Google account (${firebaseUser.email}) is not an authorized manager.`,
                type: 'error'
              });
              setTimeout(() => setCloudToast(null), 8000);
            }
          } catch (e) {
            console.warn('Manager verification on auth state change encountered error:', e);
          }
        } else {
          await signOutManager();
          setGoogleUser(null);
        }
      } else {
        setGoogleUser(null);
      }
    });

    return () => {
      unsubscribe();
      authUnsubscribe();
      managersUnsub();
    };
  }, []);

  // --- Synchronization with LocalStorage ---
  useEffect(() => {
    localStorage.setItem('mess_boarders', JSON.stringify(boarders));
  }, [boarders]);

  useEffect(() => {
    localStorage.setItem('mess_deposits', JSON.stringify(deposits));
  }, [deposits]);

  useEffect(() => {
    localStorage.setItem('mess_mealLogs', JSON.stringify(mealLogs));
  }, [mealLogs]);

  useEffect(() => {
    localStorage.setItem('mess_bazaarCosts', JSON.stringify(bazaarCosts));
  }, [bazaarCosts]);

  useEffect(() => {
    localStorage.setItem('mess_miscCosts', JSON.stringify(miscCosts));
  }, [miscCosts]);

  useEffect(() => {
    localStorage.setItem('mess_settings', JSON.stringify(settings));
  }, [settings]);

  // Set default boarder ID when boarders load or toggle
  useEffect(() => {
    const active = boarders.filter(b => b.isActive);
    if (active.length > 0 && (!selectedBoarderId || !active.some(b => b.id === selectedBoarderId))) {
      setSelectedBoarderId(active[0].id);
    }
  }, [boarders, selectedBoarderId]);

  // Privacy Guard: Prevent boarders from accessing Month-End Bills & Memos tab or Analytics
  useEffect(() => {
    if (role === 'boarder' && (activeTab === 'report' || activeTab === 'analytics')) {
      setActiveTab('dashboard');
    }
  }, [role, activeTab]);

  // --- Mathematical calculations ---
  const report = calculateReport(boarders, deposits, mealLogs, bazaarCosts, miscCosts, settings);

  // --- Authentication Handlers ---
  const handleRequireManagerLogin = () => {
    setShowLoginModal(true);
  };

  const handleLoginSuccess = (user?: User) => {
    if (user) {
      setGoogleUser({
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        uid: user.uid,
      });
      setCloudToast({
        message: `Signed in as Manager via Google (${user.email || user.displayName})`,
        type: 'success'
      });
    } else {
      setCloudToast({
        message: 'Manager mode unlocked via Security PIN.',
        type: 'success'
      });
    }
    setIsManagerAuthenticated(true);
    setRole('manager');
    setShowLoginModal(false);
    setTimeout(() => setCloudToast(null), 4000);
  };

  const handleManagerLogout = async () => {
    try {
      await signOutManager();
    } catch (err) {
      console.error("Sign out error:", err);
    }
    localStorage.removeItem('mess_manager_auth');
    sessionStorage.removeItem('mess_manager_auth');
    setGoogleUser(null);
    setIsManagerAuthenticated(false);
    setRole('boarder');
    setActiveTab('dashboard');
    setCloudToast({
      message: 'Manager mode locked and signed out.',
      type: 'info'
    });
    setTimeout(() => setCloudToast(null), 3000);
  };

  const handleRoleChange = (newRole: 'manager' | 'boarder') => {
    if (newRole === 'manager') {
      if (isManagerAuthenticated) {
        setRole('manager');
      } else {
        handleRequireManagerLogin();
      }
    } else {
      setRole('boarder');
      if (activeTab === 'report' || activeTab === 'analytics') {
        setActiveTab('dashboard');
      }
    }
  };

  const handleUpdateSettings = (partial: Partial<MessSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    localStorage.setItem('mess_settings', JSON.stringify(updated));
    syncSettingsToFirestore(updated);
  };

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = newPinInput.trim();
    if (cleanPin.length < 4) {
      alert("Manager PIN must be at least 4 digits or characters.");
      return;
    }
    const updated = { ...settings, managerPin: cleanPin };
    setSettings(updated);
    setNewPinInput('');
    localStorage.setItem('mess_settings', JSON.stringify(updated));
    syncSettingsToFirestore(updated);
    setPinChangeSuccess(true);
    setTimeout(() => setPinChangeSuccess(false), 3500);
  };

  const handleResetPinToDefault = () => {
    if (confirm("Reset manager security PIN to default?")) {
      const updated = { ...settings, managerPin: '1234' };
      setSettings(updated);
      setNewPinInput('');
      localStorage.setItem('mess_settings', JSON.stringify(updated));
      syncSettingsToFirestore(updated);
      setPinChangeSuccess(true);
      setTimeout(() => setPinChangeSuccess(false), 3500);
    }
  };

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = newManagerEmailInput.trim().toLowerCase();
    if (!cleanEmail) return;
    setIsRegisteringManager(true);
    setManagerActionMsg(null);
    try {
      await registerNewManager(
        cleanEmail,
        newManagerNameInput.trim() || undefined,
        googleUser?.email || 'Manager'
      );
      setNewManagerEmailInput('');
      setNewManagerNameInput('');
      setManagerActionMsg({ text: `Authorized ${cleanEmail}! They can now sign in with Google SSO.` });
      setTimeout(() => setManagerActionMsg(null), 5000);
    } catch (err: any) {
      setManagerActionMsg({ text: err?.message || 'Failed to register manager.', isError: true });
    } finally {
      setIsRegisteringManager(false);
    }
  };

  const handleRemoveManager = async (emailToRemove: string) => {
    if (emailToRemove === PRIMARY_MANAGER_EMAIL) return;
    if (!window.confirm(`Revoke manager privileges for ${emailToRemove}? They will no longer be able to log in with Google.`)) {
      return;
    }
    try {
      await unregisterManager(emailToRemove);
      setCloudToast({ message: `Revoked manager access for ${emailToRemove}`, type: 'info' });
      setTimeout(() => setCloudToast(null), 4000);
    } catch (err: any) {
      setCloudToast({ message: `Error: ${err?.message || 'Could not remove manager'}`, type: 'error' });
    }
  };

  // --- Data Handlers ---
  const handleSimulateData = () => {
    if (!isManagerAuthenticated) {
      handleRequireManagerLogin();
      return;
    }
    const sample = generateSampleData();
    const updatedSettings = {
      ...sample.settings,
      managerPin: settings.managerPin || '1234',
    };
    setBoarders(sample.boarders);
    setDeposits(sample.deposits);
    setMealLogs(sample.mealLogs);
    setBazaarCosts(sample.bazaarCosts);
    setMiscCosts(sample.miscCosts);
    setSettings(updatedSettings);
    // Push directly to Firestore as live truth
    seedFirestore({
      ...sample,
      settings: updatedSettings
    });
    setRole('manager');
    setActiveTab('dashboard');
  };

  const handleWipeSuccess = (wipeType: 'all' | 'month') => {
    if (wipeType === 'all') {
      setBoarders([]);
      setDeposits([]);
      setBazaarCosts([]);
      setMealLogs([]);
      setSettings(prev => ({
        ...prev,
        monthlyBudgetTarget: 0
      }));
      setMiscCosts({
        cookerBill: 0,
        utilityBill: 0,
        gasBill: 0,
        wifiBill: 0,
        houseRent: 0,
        otherCosts: 0,
        customBills: []
      });
      setCloudToast({
        message: 'All boarders, deposits, meals, and bazaar records permanently wiped from Cloud Firestore and local storage.',
        type: 'info'
      });
    } else {
      const activeMonth = settings.currentMonth;
      setDeposits(prev => prev.filter(d => !d.date.startsWith(activeMonth)));
      setBazaarCosts(prev => prev.filter(c => !c.date.startsWith(activeMonth)));
      setMealLogs(prev => prev.filter(m => !m.date.startsWith(activeMonth)));
      setCloudToast({
        message: `All records for ${activeMonth} permanently wiped from Cloud Firestore. Boarder accounts preserved.`,
        type: 'info'
      });
    }
    setTimeout(() => setCloudToast(null), 5000);
  };

  const handleImportBackup = (imported: any) => {
    if (!isManagerAuthenticated) {
      handleRequireManagerLogin();
      return;
    }
    if (imported.boarders) setBoarders(imported.boarders);
    if (imported.deposits) setDeposits(imported.deposits);
    if (imported.mealLogs) setMealLogs(imported.mealLogs);
    if (imported.bazaarCosts) setBazaarCosts(imported.bazaarCosts);
    if (imported.miscCosts) setMiscCosts(imported.miscCosts);
    const updatedSettings = imported.settings ? {
      ...imported.settings,
      managerPin: imported.settings.managerPin || settings.managerPin || '1234'
    } : settings;
    setSettings(updatedSettings);

    // Auto-save backup to Firestore
    seedFirestore({
      boarders: imported.boarders || boarders,
      deposits: imported.deposits || deposits,
      mealLogs: imported.mealLogs || mealLogs,
      bazaarCosts: imported.bazaarCosts || bazaarCosts,
      miscCosts: imported.miscCosts || miscCosts,
      settings: updatedSettings
    });
  };

  // --- Month Close & Handover Handler ---
  const handleConfirmHandover = async (payload: {
    closureRecord: MonthClosureRecord;
    nextMonth: string;
    newManagerName: string;
    newManagerPhone?: string;
    newManagerPin?: string;
    carryForwardDeposits?: Deposit[];
    updatedMiscCosts?: MiscellaneousCosts;
  }) => {
    const {
      closureRecord,
      nextMonth,
      newManagerName,
      newManagerPhone,
      newManagerPin,
      carryForwardDeposits,
      updatedMiscCosts,
    } = payload;

    const currentHistory = settings.closureHistory || [];
    const updatedHistory = [closureRecord, ...currentHistory.filter(h => h.month !== closureRecord.month)];

    const updatedSettings: MessSettings = {
      ...settings,
      currentMonth: nextMonth,
      currentManagerName: newManagerName,
      currentManagerPhone: newManagerPhone || '',
      managerPin: newManagerPin || settings.managerPin || '1234',
      closureHistory: updatedHistory,
    };

    setSettings(updatedSettings);
    localStorage.setItem('mess_settings', JSON.stringify(updatedSettings));
    syncSettingsToFirestore(updatedSettings);

    if (carryForwardDeposits && carryForwardDeposits.length > 0) {
      const updatedDeposits = [...deposits, ...carryForwardDeposits];
      setDeposits(updatedDeposits);
      localStorage.setItem('mess_deposits', JSON.stringify(updatedDeposits));
      for (const dep of carryForwardDeposits) {
        syncDepositToFirestore(dep);
      }
    }

    if (updatedMiscCosts) {
      setMiscCosts(updatedMiscCosts);
      localStorage.setItem('mess_miscCosts', JSON.stringify(updatedMiscCosts));
      syncMiscCostsToFirestore(updatedMiscCosts);
    }

    setCloudToast({
      message: `Month ${formatReadableMonth(closureRecord.month)} closed! Handed over to ${newManagerName} for ${formatReadableMonth(nextMonth)}.`,
      type: 'success',
    });
    setTimeout(() => setCloudToast(null), 6000);
  };

  // Check if there is active data logged for the active month
  const activeMonth = settings.currentMonth;
  const hasActiveMonthData = 
    deposits.some(d => d.date.startsWith(activeMonth)) ||
    bazaarCosts.some(c => c.date.startsWith(activeMonth)) ||
    mealLogs.some(m => m.date.startsWith(activeMonth));

  // Find currently selected boarder details
  const selectedBoarder = boarders.find(b => b.id === selectedBoarderId && b.isActive);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* Top Navigation Selector Bar */}
      <RoleSelector
        role={role}
        setRole={handleRoleChange}
        selectedBoarderId={selectedBoarderId}
        setSelectedBoarderId={setSelectedBoarderId}
        boarders={boarders}
        currentMonth={settings.currentMonth}
        onSimulateData={handleSimulateData}
        hasData={hasActiveMonthData}
        isManagerAuthenticated={isManagerAuthenticated}
        googleUser={googleUser}
        onRequireManagerLogin={handleRequireManagerLogin}
        onManagerLogout={handleManagerLogout}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Main Core Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 print:py-0 print:px-0">
        
        {/* Workspace Sub-Navigation Strip */}
        <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-slate-200/90">
          
          {/* Primary Workspace Views */}
          <nav className="flex items-center gap-1 overflow-x-auto -mb-px">
            <button
              onClick={() => setActiveTab('dashboard')}
              id="nav-tab-dashboard"
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>{role === 'manager' ? 'Manager Console' : 'My Statement'}</span>
            </button>
            
            {role === 'manager' && (
              <button
                onClick={() => setActiveTab('analytics')}
                id="nav-tab-analytics"
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'analytics'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Analytics & Trends</span>
              </button>
            )}

            {role === 'manager' && (
              <button
                onClick={() => setActiveTab('report')}
                id="nav-tab-report"
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'report'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <ReceiptText className="w-4 h-4" />
                <span>Month-End Bills & Memos</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('settings')}
              id="nav-tab-settings"
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>

          {/* Cloud Firestore Status Control */}
          {role === 'manager' && isManagerAuthenticated && (
            <div className="flex items-center gap-2 pb-2.5 sm:pb-0 shrink-0">
              <button
                onClick={() => setShowCloudModal(true)}
                id="btn-cloud-sync-status"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isCloudSynced 
                    ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200' 
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                }`}
                title="View Google Cloud Firestore sync status or force refresh"
              >
                <Cloud className={`w-3.5 h-3.5 ${isCloudSynced ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span className="font-semibold">{isCloudLoading ? 'Syncing…' : isCloudSynced ? 'Firestore Synced' : 'Offline Cache'}</span>
              </button>

              {!hasActiveMonthData && (
                <button
                  onClick={handleSimulateData}
                  id="btn-quick-simulation"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Load Sample Data</span>
                </button>
              )}
            </div>
          )}

        </div>

        {/* Tab View Router */}
        <div className="space-y-6">
          
          {/* SCREEN 1: THE CORE DASHBOARDS */}
          {activeTab === 'dashboard' && (
            role === 'manager' ? (
              isManagerAuthenticated ? (
                <ManagerDashboard
                  boarders={boarders}
                  setBoarders={setBoarders}
                  deposits={deposits}
                  setDeposits={setDeposits}
                  mealLogs={mealLogs}
                  setMealLogs={setMealLogs}
                  bazaarCosts={bazaarCosts}
                  setBazaarCosts={setBazaarCosts}
                  miscCosts={miscCosts}
                  setMiscCosts={setMiscCosts}
                  settings={settings}
                  setSettings={setSettings}
                  report={report}
                  onOpenHandoverModal={() => setShowHandoverModal(true)}
                />
              ) : (
                /* Interactive Professional Manager Authentication Portal */
                <div className="bg-white border border-slate-200 rounded-2xl max-w-xl mx-auto overflow-hidden shadow-sm animate-fadeIn">
                  <div className="bg-slate-900 text-white p-6 sm:p-8 text-center relative overflow-hidden">
                    <div className="w-14 h-14 bg-blue-600/30 border border-blue-500/40 rounded-2xl flex items-center justify-center text-blue-400 mx-auto mb-3 shadow-inner">
                      <Lock className="w-7 h-7 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Manager Authentication Required</h3>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
                      This console controls boarder registrations, daily meal counts, bazaar market receipts, and mess utilities. Choose a method to unlock.
                    </p>
                  </div>

                  <div className="p-6 sm:p-8 space-y-5">
                    {/* Primary Option: Google Sign In */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-blue-400 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-xs shrink-0">
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <span>Google Account SSO</span>
                            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">Recommended</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">Instant one-click authentication linked to Google Cloud</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRequireManagerLogin}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                      >
                        Sign in with Google
                      </button>
                    </div>

                    {/* Secondary Option: Passcode PIN */}
                    <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-xs shrink-0">
                          <KeyRound className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">4-Digit Security PIN</div>
                          <p className="text-[11px] text-slate-500 mt-0.5">Use your configured mess passcode (Default: 1234)</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleRequireManagerLogin}
                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                      >
                        Enter PIN
                      </button>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                      <span className="text-xs text-slate-500">Just checking meals or your balance?</span>
                      <button
                        type="button"
                        onClick={() => setRole('boarder')}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        Switch to Boarder Dashboard (Public) →
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              selectedBoarder ? (
                <BoarderDashboard
                  boarder={selectedBoarder}
                  report={report}
                  deposits={deposits}
                  mealLogs={mealLogs}
                  allBoarders={boarders}
                  bazaarCosts={bazaarCosts}
                  miscCosts={miscCosts}
                  settings={settings}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 shadow-xs">
                  <div className="max-w-xs mx-auto text-slate-400">
                    <Info className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-slate-800">No active boarders registered!</p>
                    <p className="text-xs text-slate-500 mt-1">Please log in to the Manager Portal to register boarders and set up your mess.</p>
                  </div>
                  <button
                    onClick={handleRequireManagerLogin}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    Unlock Manager Portal
                  </button>
                </div>
              )
            )
          )}

          {/* SCREEN: ANALYTICS & TRENDS - Strictly Manager Mode */}
          {activeTab === 'analytics' && role === 'manager' && (
            isManagerAuthenticated ? (
              <ManagerAnalyticsDashboard
                boarders={boarders}
                deposits={deposits}
                mealLogs={mealLogs}
                bazaarCosts={bazaarCosts}
                miscCosts={miscCosts}
                settings={settings}
                report={report}
                onNavigateToTab={(tab) => {
                  setActiveTab('dashboard');
                }}
                onOpenReportModal={() => setActiveTab('report')}
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl max-w-xl mx-auto overflow-hidden shadow-sm animate-fadeIn p-8 text-center">
                <Lock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h3 className="text-base font-bold text-slate-900">Manager Authentication Required</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">Please log in as a manager to view mess operational analytics.</p>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                >
                  Unlock Manager Portal
                </button>
              </div>
            )
          )}

          {/* SCREEN 2: MONTH END REPORTS AND PDFS - Strictly Manager Mode */}
          {activeTab === 'report' && role === 'manager' && (
            <MonthEndReport
              report={report}
              boarders={boarders}
              deposits={deposits}
              mealLogs={mealLogs}
              bazaarCosts={bazaarCosts}
              miscCosts={miscCosts}
              settings={settings}
              onClearData={() => setShowWipeModal(true)}
              onSimulateData={handleSimulateData}
              onImportBackup={handleImportBackup}
              isManager={isManagerAuthenticated}
              onRequireManagerLogin={handleRequireManagerLogin}
              onOpenHandoverModal={() => setShowHandoverModal(true)}
              onSelectMonth={(m) => handleUpdateSettings({ currentMonth: m })}
            />
          )}

          {/* SCREEN 3: PROFILE CONFIGURATIONS */}
          {activeTab === 'settings' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl mx-auto shadow-xs animate-fadeIn print:hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-5">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  Mess Administration & Security
                </h3>
                {isManagerAuthenticated ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Manager Mode Unlocked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                    <Globe className="w-3.5 h-3.5" />
                    Public View (Read-Only)
                  </span>
                )}
              </div>

              {!isManagerAuthenticated ? (
                /* Unauthenticated view of settings */
                <div className="space-y-5">
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
                    <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Manager PIN Required for Modifications</p>
                      <p className="text-amber-800 mt-1 leading-relaxed">
                        General boarders can view current settings below. To change the mess name, billing cycle, or manager PIN, please unlock Manager Mode.
                      </p>
                      <button
                        onClick={handleRequireManagerLogin}
                        className="mt-3 inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Enter Manager PIN
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Mess / Hall Name</label>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800">
                        {settings.messName || 'Not Set'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Active Calculation Month</label>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 font-mono">
                        {settings.currentMonth}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Monthly Budget Target</label>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800">
                        {settings.monthlyBudgetTarget ? `৳ ${settings.monthlyBudgetTarget.toLocaleString('en-IN')}` : 'Not Set'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Authenticated Manager Settings Form */
                <div className="space-y-5">
                  {/* Google Manager Profile Status Card */}
                  <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3">
                      {googleUser?.photoURL ? (
                        <img
                          src={googleUser.photoURL}
                          alt="Google Avatar"
                          className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                          {googleUser?.displayName ? googleUser.displayName.charAt(0).toUpperCase() : <ShieldCheck className="w-5 h-5 text-emerald-600" />}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">
                            {googleUser ? (googleUser.displayName || 'Google Manager') : 'Security PIN Manager'}
                          </span>
                          {googleUser ? (
                            googleUser.email?.toLowerCase() === PRIMARY_MANAGER_EMAIL ? (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5 text-emerald-700" />
                                Root Primary Manager
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-blue-600" />
                                Authorized Manager
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded-full">
                              PIN Session
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {googleUser?.email || 'Logged in via Master PIN'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!googleUser ? (
                        <button
                          type="button"
                          onClick={handleRequireManagerLogin}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          Link Google Account
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleManagerLogout}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                        >
                          Sign Out of Google
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Mess / Hall Name</label>
                    <input
                      type="text"
                      required
                      value={settings.messName}
                      onChange={(e) => handleUpdateSettings({ messName: e.target.value })}
                      id="input-mess-name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      placeholder="e.g. Green Valley Mess"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">Active Calculation Month</label>
                    <input
                      type="month"
                      required
                      value={settings.currentMonth}
                      onChange={(e) => handleUpdateSettings({ currentMonth: e.target.value })}
                      id="input-current-month"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                      * Changing the month shifts the filter for all logs, ledger deposits, and meal records. Previous months' histories are preserved when switching back.
                    </p>
                  </div>

                  {/* Current Active Manager & Handover Section */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            Current Appointed Manager: {settings.currentManagerName || 'Mess Manager'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {settings.currentManagerPhone ? `Contact: ${settings.currentManagerPhone} • ` : ''}Month: {formatReadableMonth(settings.currentMonth)}
                          </span>
                        </div>
                      </div>

                      {isManagerAuthenticated && (
                        <button
                          type="button"
                          onClick={() => setShowHandoverModal(true)}
                          id="btn-settings-handover-modal"
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Close & Handover</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Monthly Budget Target */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-blue-600" />
                      <span>Monthly Budget Target (৳ Taka)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">৳</span>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={settings.monthlyBudgetTarget ?? ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleUpdateSettings({
                            monthlyBudgetTarget: isNaN(val) ? undefined : Math.max(0, val)
                          });
                        }}
                        id="input-monthly-budget-target"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                        placeholder="e.g. 22000"
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                      * Sets the monthly expenditure ceiling to track Bazaar and Miscellaneous costs with a live progress bar. Auto-saves directly to Cloud Firestore.
                    </p>
                  </div>

                  {/* Manager PIN Configuration Section */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-blue-600" />
                        Manager Security PIN
                      </label>
                      <div className="flex items-center gap-2">
                        {settings.managerPin && settings.managerPin !== '1234' ? (
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Custom PIN Configured
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                            Default Security Active
                          </span>
                        )}
                        {settings.managerPin && settings.managerPin !== '1234' && (
                          <button
                            type="button"
                            onClick={handleResetPinToDefault}
                            className="text-[11px] text-slate-500 hover:text-rose-600 underline cursor-pointer"
                            title="Reset PIN back to default"
                          >
                            Reset to Default
                          </button>
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleUpdatePin} className="flex gap-2">
                      <input
                        type="password"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value)}
                        id="input-manager-pin"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
                      >
                        Update PIN
                      </button>
                    </form>
                    {pinChangeSuccess && (
                      <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 mt-1.5 animate-fadeIn">
                        <Check className="w-3.5 h-3.5" />
                        Manager PIN updated successfully!
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                      * This PIN locks access to the Manager Console. Boarders can continue viewing everything in public mode without a password.
                    </p>
                  </div>

                  {/* Registered Managers (Google SSO Authorized RBAC) */}
                  <div className="pt-5 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>Registered Managers (Google SSO)</span>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                            {registeredManagers.length || 1} Authorized
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Only verified Google accounts listed here or the primary manager can sign in via Google SSO. Unregistered accounts are strictly blocked.
                        </p>
                      </div>
                    </div>

                    {/* Authorized Managers list */}
                    <div className="space-y-2 mb-4">
                      {registeredManagers.length === 0 ? (
                        <div className="flex items-center justify-between p-2.5 rounded-lg border text-xs bg-emerald-50/60 border-emerald-200/80 text-emerald-950">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              H
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold truncate">Primary Root Manager</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  Root Primary
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">{PRIMARY_MANAGER_EMAIL}</div>
                            </div>
                          </div>
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded shrink-0">
                            Immutable
                          </span>
                        </div>
                      ) : (
                        registeredManagers.map((mgr) => {
                          const isPrimary = mgr.email === PRIMARY_MANAGER_EMAIL || mgr.role === 'primary';
                          return (
                            <div
                              key={mgr.email}
                              className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                                isPrimary 
                                  ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-950'
                                  : 'bg-slate-50 border-slate-200 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isPrimary ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {mgr.name ? mgr.name.charAt(0).toUpperCase() : mgr.email.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold truncate">{mgr.name || mgr.email}</span>
                                    {isPrimary ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-1">
                                        <Lock className="w-2.5 h-2.5" />
                                        Root Primary
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                                        Authorized Manager
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono truncate">{mgr.email}</div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {isPrimary ? (
                                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                                    Immutable
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveManager(mgr.email)}
                                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 cursor-pointer transition-colors flex items-center gap-1"
                                    title={`Revoke manager privileges for ${mgr.email}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Revoke
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add new manager form */}
                    <form onSubmit={handleAddManager} className="bg-slate-50/80 p-3 rounded-lg border border-slate-200 space-y-2.5">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                        Authorize New Manager Google Account
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="email"
                          required
                          placeholder="Google Account Email (e.g. name@gmail.com)"
                          value={newManagerEmailInput}
                          onChange={(e) => setNewManagerEmailInput(e.target.value)}
                          className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Manager Name (optional)"
                          value={newManagerNameInput}
                          onChange={(e) => setNewManagerNameInput(e.target.value)}
                          className="bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                        <span className="text-[10px] text-slate-400">
                          * Authorized email can sign in with Google Single Sign-On and manage this mess.
                        </span>
                        <button
                          type="submit"
                          disabled={isRegisteringManager || !newManagerEmailInput.trim()}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors flex items-center gap-1 self-end sm:self-auto shrink-0 shadow-2xs"
                        >
                          {isRegisteringManager ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          <span>Authorize Manager</span>
                        </button>
                      </div>
                      {managerActionMsg && (
                        <p className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
                          managerActionMsg.isError ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {managerActionMsg.isError ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          {managerActionMsg.text}
                        </p>
                      )}
                    </form>
                  </div>

                  {/* Danger Zone: Wipe Database */}
                  <div className="pt-4 border-t border-rose-200 mt-4 bg-rose-50/70 p-4 rounded-xl border border-rose-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                          <Trash2 className="w-4 h-4 text-rose-600" />
                          Danger Zone: Wipe Database & Records
                        </h4>
                        <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                          Permanently wipe all boarders, deposits, meals, and bazaar records from Google Cloud Firestore, or wipe the active month only. Protected by manager PIN and typed confirmation.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowWipeModal(true)}
                        id="btn-settings-wipe-data"
                        className="px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-xs transition-colors shrink-0"
                      >
                        Wipe Data...
                      </button>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Need to lock manager mode on this device?</span>
                    <button
                      onClick={handleManagerLogout}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition-all"
                    >
                      Lock Manager Mode
                    </button>
                  </div>
                </div>
              )}

              {/* Cloud Firestore & Browser Cache Management Card - Strictly Manager Mode */}
              {isManagerAuthenticated && role === 'manager' && (
                <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                        <Cloud className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          Google Cloud Firestore & Cache
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isCloudSynced 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {isCloudSynced ? 'Live Synced' : 'Offline / Cached'}
                          </span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          Manage cloud synchronization, purge browser cache, and view live database statistics.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowCloudModal(true)}
                      id="btn-open-cloud-sync-modal"
                      className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all shadow-xs shrink-0"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Open Cloud Manager</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Database Connection</div>
                      <div className="font-semibold text-slate-800">Firestore: {firebaseConfig.firestoreDatabaseId || '(default)'}</div>
                      <div className="text-slate-500 text-[11px]">Last Synced: {lastSyncedAt || 'At boot'}</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/70 space-y-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Storage Statistics</div>
                      <div className="font-semibold text-slate-800">
                        {boarders.length} Boarders · {deposits.length} Deposits · {bazaarCosts.length} Bazaar Costs · {mealLogs.length} Meals
                      </div>
                      <div className="text-slate-500 text-[11px]">Two-way sync active on changes</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 mt-4 pt-3 border-t border-slate-100">
                    <button
                      onClick={handleForceRefresh}
                      disabled={isCloudLoading}
                      className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCloudLoading ? 'animate-spin' : ''}`} />
                      <span>Force Refresh from Cloud</span>
                    </button>

                    <button
                      onClick={handlePurgeCacheAndReload}
                      disabled={isCloudLoading}
                      className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purge Browser Cache & Hard Reload</span>
                    </button>

                    <button
                      onClick={handlePushAllToCloud}
                      disabled={isCloudLoading}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Push Local to Firestore</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </main>

      {/* Floating Cloud Notification Toast */}
      {cloudToast && (
        <aside aria-label="Notification" className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-xl border max-w-sm flex items-start gap-3 animate-fadeIn ${
          cloudToast.type === 'success' 
            ? 'bg-slate-900 text-white border-emerald-500/50' 
            : cloudToast.type === 'error'
            ? 'bg-rose-950 text-white border-rose-500/50'
            : 'bg-slate-900 text-white border-slate-700'
        }`}>
          {cloudToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs">
            <div className="font-bold">
              {cloudToast.type === 'success' ? 'Google Cloud Firestore' : 'Sync Status'}
            </div>
            <div className="text-slate-300 mt-0.5 leading-relaxed">{cloudToast.message}</div>
          </div>
          <button 
            onClick={() => setCloudToast(null)} 
            className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}

      {/* Footer (Hidden on print) */}
      <footer className="bg-white border-t border-slate-200/80 py-5 text-center text-xs text-slate-500 mt-12 print:hidden">
        <p>© 2026 {settings.messName || 'MessMaster'}. Operationalized for transparent meal & ledger accounting.</p>
      </footer>

      {/* Manager Login Modal */}
      <ManagerLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
        currentPin={settings.managerPin || '1234'}
      />

      {/* Cloud Sync & Browser Storage Modal */}
      <CloudSyncModal
        isOpen={showCloudModal}
        onClose={() => setShowCloudModal(false)}
        isCloudSynced={isCloudSynced}
        isLoading={isCloudLoading}
        lastSyncedAt={lastSyncedAt}
        counts={{
          boarders: boarders.length,
          deposits: deposits.length,
          bazaar: bazaarCosts.length,
          meals: mealLogs.length,
        }}
        onForceRefresh={handleForceRefresh}
        onPurgeCacheAndReload={handlePurgeCacheAndReload}
        onPushAllToCloud={handlePushAllToCloud}
        onResetDemoData={handleResetDemoData}
        errorMessage={cloudError}
      />

      {/* Wipe Data Modal (Firestore & LocalStorage) */}
      <WipeDataModal
        isOpen={showWipeModal}
        onClose={() => setShowWipeModal(false)}
        currentMonth={settings.currentMonth}
        settings={settings}
        onSuccess={handleWipeSuccess}
      />

      {/* Month Closing & Manager Handover Modal */}
      <MonthCloseHandoverModal
        isOpen={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        report={report}
        boarders={boarders}
        settings={settings}
        miscCosts={miscCosts}
        onConfirmHandover={handleConfirmHandover}
      />

    </div>
  );
}
