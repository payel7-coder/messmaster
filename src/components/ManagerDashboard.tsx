import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Utensils, 
  ShoppingCart, 
  DollarSign, 
  Users, 
  Receipt, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  ArrowRight, 
  Info,
  Calendar,
  Zap,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  Copy,
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  KeyRound,
  ShieldCheck,
  StickyNote,
  Activity,
  Lock,
  Unlock,
  Target,
  Coffee,
  UtensilsCrossed,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';
import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, MonthReport, CustomFixedBill, StandardFixedBillKey, SpecialMeal } from '../types';
import { getDatesInMonth, formatReadableDate, formatReadableMonth } from '../utils';
import PrintablePdfReportModal from './PrintablePdfReportModal';
import BoarderMealSheetModal from './BoarderMealSheetModal';
import BreakfastAuditModal from './BreakfastAuditModal';
import SpecialMealModal from './SpecialMealModal';
import RecentActivitiesSection from './RecentActivitiesSection';
import {
  syncBoarderToFirestore,
  deleteBoarderFromFirestore,
  syncDepositToFirestore,
  deleteDepositFromFirestore,
  syncBazaarToFirestore,
  deleteBazaarFromFirestore,
  syncMealLogToFirestore,
  syncSettingsToFirestore,
  syncMiscCostsToFirestore,
} from '../services/firestoreService';

interface ManagerDashboardProps {
  boarders: Boarder[];
  setBoarders: React.Dispatch<React.SetStateAction<Boarder[]>>;
  deposits: Deposit[];
  setDeposits: React.Dispatch<React.SetStateAction<Deposit[]>>;
  mealLogs: DailyMealLog[];
  setMealLogs: React.Dispatch<React.SetStateAction<DailyMealLog[]>>;
  bazaarCosts: BazaarCost[];
  setBazaarCosts: React.Dispatch<React.SetStateAction<BazaarCost[]>>;
  miscCosts: MiscellaneousCosts;
  setMiscCosts: React.Dispatch<React.SetStateAction<MiscellaneousCosts>>;
  settings: MessSettings;
  setSettings: React.Dispatch<React.SetStateAction<MessSettings>>;
  report: MonthReport;
  onOpenHandoverModal?: () => void;
}

type TabType = 'meals' | 'bazaar' | 'deposits' | 'fixed' | 'boarders';

export default function ManagerDashboard({
  boarders,
  setBoarders,
  deposits,
  setDeposits,
  mealLogs,
  setMealLogs,
  bazaarCosts,
  setBazaarCosts,
  miscCosts,
  setMiscCosts,
  settings,
  setSettings,
  report,
  onOpenHandoverModal,
}: ManagerDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('meals');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showMealSheetModal, setShowMealSheetModal] = useState(false);
  const [showBreakfastAuditModal, setShowBreakfastAuditModal] = useState(false);
  const [showSpecialMealModal, setShowSpecialMealModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [dashboardPinInput, setDashboardPinInput] = useState(settings.managerPin || '1234');
  const [dashboardPinSuccess, setDashboardPinSuccess] = useState(false);

  // Active month's special meals / feasts
  const monthSpecialMeals = useMemo(() => {
    return (settings.specialMeals || []).filter(sm => sm.date.startsWith(settings.currentMonth));
  }, [settings.specialMeals, settings.currentMonth]);

  const totalSpecialMealsCost = useMemo(() => {
    return monthSpecialMeals.reduce((sum, sm) => sum + (sm.totalCost || 0), 0);
  }, [monthSpecialMeals]);

  // Compute number of active boarders below minimum breakfast rule for current month
  const minBreakfastDays = settings.minBreakfastDays || 16;
  const breakfastDefaultersCount = useMemo(() => {
    const activeBoarders = boarders.filter(b => b.isActive);
    const monthLogs = mealLogs.filter(l => l.date.startsWith(settings.currentMonth));
    return activeBoarders.filter(b => {
      const bDays = monthLogs.filter(l => {
        const m = l.meals[b.id] || 0;
        return (m % 1 >= 0.45 && m % 1 <= 0.55) || m === 0.5;
      }).length;
      return bDays < minBreakfastDays;
    }).length;
  }, [boarders, mealLogs, settings.currentMonth, minBreakfastDays]);

  useEffect(() => {
    setDashboardPinInput(settings.managerPin || '1234');
  }, [settings.managerPin]);

  const handleUpdateDashboardPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = dashboardPinInput.trim();
    if (cleanPin.length < 4) {
      alert("Manager PIN must be at least 4 digits or characters.");
      return;
    }
    const updated = { ...settings, managerPin: cleanPin };
    setSettings(updated);
    localStorage.setItem('mess_settings', JSON.stringify(updated));
    syncSettingsToFirestore(updated);
    setDashboardPinSuccess(true);
    setTimeout(() => {
      setDashboardPinSuccess(false);
      setShowPinModal(false);
    }, 1500);
  };

  // Helper: Get best default date for the active month (today if matching, or 1st of month)
  const getInitialDateForMonth = (monthStr: string): string => {
    const today = new Date().toISOString().split('T')[0];
    if (today.startsWith(monthStr)) {
      return today;
    }
    return `${monthStr}-01`;
  };

  // --- Meal Log State ---
  const datesInActiveMonth = getDatesInMonth(settings.currentMonth);
  const [selectedMealDate, setSelectedMealDate] = useState<string>(
    datesInActiveMonth[0] || getInitialDateForMonth(settings.currentMonth)
  );
  // Protection against accidental meal updates: locked by default until manager clicks "Edit Meals"
  const [isEditingMeals, setIsEditingMeals] = useState<boolean>(false);

  // Automatically lock meals whenever a different date is selected
  useEffect(() => {
    setIsEditingMeals(false);
  }, [selectedMealDate, settings.currentMonth]);

  // --- Bazaar Add Form State ---
  const [bazaarAmount, setBazaarAmount] = useState<string>('');
  const [bazaarDate, setBazaarDate] = useState<string>(() => getInitialDateForMonth(settings.currentMonth));
  const [bazaarDesc, setBazaarDesc] = useState<string>('');
  const [bazaarBuyer, setBazaarBuyer] = useState<string>('');
  const [bazaarSuccessMsg, setBazaarSuccessMsg] = useState<string | null>(null);
  const [bazaarErrorMsg, setBazaarErrorMsg] = useState<string | null>(null);
  const [bazaarFilterScope, setBazaarFilterScope] = useState<'month' | 'all'>('month');

  // Shop Due / Credit (দোকান বাকি) States
  const [bazaarHasDue, setBazaarHasDue] = useState<boolean>(false);
  const [bazaarPaidAmount, setBazaarPaidAmount] = useState<string>('');
  const [bazaarDueAmount, setBazaarDueAmount] = useState<string>('');
  const [bazaarDueShop, setBazaarDueShop] = useState<string>('');

  // Settle / Adjust Due Modal State
  const [adjustingBazaar, setAdjustingBazaar] = useState<BazaarCost | null>(null);
  const [adjustCashAmount, setAdjustCashAmount] = useState<string>('');
  const [adjustCashDate, setAdjustCashDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [adjustCashNote, setAdjustCashNote] = useState<string>('');
  const [isAdjustingLoading, setIsAdjustingLoading] = useState<boolean>(false);

  // --- Deposit Add Form State ---
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>(() => getInitialDateForMonth(settings.currentMonth));
  const [depositNote, setDepositNote] = useState<string>('');
  const [depositBoarderId, setDepositBoarderId] = useState<string>('');
  const [depositSuccessMsg, setDepositSuccessMsg] = useState<string | null>(null);
  const [depositErrorMsg, setDepositErrorMsg] = useState<string | null>(null);
  const [depositFilterScope, setDepositFilterScope] = useState<'month' | 'all'>('month');

  // Synchronize boarder selection for deposit and bazaar
  useEffect(() => {
    if (boarders.length > 0) {
      if (!depositBoarderId || !boarders.some(b => b.id === depositBoarderId)) {
        const firstActive = boarders.find(b => b.isActive) || boarders[0];
        if (firstActive) setDepositBoarderId(firstActive.id);
      }
    }
  }, [boarders, depositBoarderId]);

  // Synchronize form dates when settings.currentMonth changes
  useEffect(() => {
    if (!bazaarDate.startsWith(settings.currentMonth)) {
      setBazaarDate(getInitialDateForMonth(settings.currentMonth));
    }
    if (!depositDate.startsWith(settings.currentMonth)) {
      setDepositDate(getInitialDateForMonth(settings.currentMonth));
    }
    const dates = getDatesInMonth(settings.currentMonth);
    if (!dates.includes(selectedMealDate)) {
      setSelectedMealDate(dates[0] || getInitialDateForMonth(settings.currentMonth));
    }
  }, [settings.currentMonth]);

  // --- Boarder Add Form State ---
  const [newBoarderName, setNewBoarderName] = useState<string>('');
  const [newBoarderRoomNo, setNewBoarderRoomNo] = useState<string>('');
  const [newBoarderPhone, setNewBoarderPhone] = useState<string>('');

  // --- Boarder Edit Form State ---
  const [editingBoarder, setEditingBoarder] = useState<Boarder | null>(null);
  const [editBoarderName, setEditBoarderName] = useState<string>('');
  const [editBoarderRoomNo, setEditBoarderRoomNo] = useState<string>('');
  const [editBoarderPhone, setEditBoarderPhone] = useState<string>('');
  const [editBoarderActive, setEditBoarderActive] = useState<boolean>(true);

  const handleOpenEditBoarder = (b: Boarder) => {
    setEditingBoarder(b);
    setEditBoarderName(b.name);
    setEditBoarderRoomNo(b.roomNo || '');
    setEditBoarderPhone(b.phone || '');
    setEditBoarderActive(b.isActive);
  };

  const handleSaveEditedBoarder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoarder || !editBoarderName.trim()) return;

    const updated: Boarder = {
      ...editingBoarder,
      name: editBoarderName.trim(),
      roomNo: editBoarderRoomNo.trim() || undefined,
      phone: editBoarderPhone.trim() || undefined,
      isActive: editBoarderActive
    };

    setBoarders(prev => prev.map(b => b.id === updated.id ? updated : b));
    syncBoarderToFirestore(updated);
    setEditingBoarder(null);
  };

  // --- Bazaar Edit Form State ---
  const [editingBazaar, setEditingBazaar] = useState<BazaarCost | null>(null);
  const [editBazaarAmount, setEditBazaarAmount] = useState<string>('');
  const [editBazaarDate, setEditBazaarDate] = useState<string>('');
  const [editBazaarDesc, setEditBazaarDesc] = useState<string>('');
  const [editBazaarBuyer, setEditBazaarBuyer] = useState<string>('');
  const [editBazaarHasDue, setEditBazaarHasDue] = useState<boolean>(false);
  const [editBazaarPaidAmount, setEditBazaarPaidAmount] = useState<string>('');
  const [editBazaarDueAmount, setEditBazaarDueAmount] = useState<string>('');
  const [editBazaarDueShop, setEditBazaarDueShop] = useState<string>('');

  const handleOpenEditBazaar = (cost: BazaarCost) => {
    setEditingBazaar(cost);
    setEditBazaarAmount(String(cost.amount));
    setEditBazaarDate(cost.date);
    setEditBazaarDesc(cost.description);
    setEditBazaarBuyer(cost.spentById || '');
    const hasDue = (cost.dueAmount !== undefined && cost.dueAmount > 0) || (cost.paidAmount !== undefined && cost.paidAmount < cost.amount);
    setEditBazaarHasDue(hasDue);
    setEditBazaarPaidAmount(cost.paidAmount !== undefined ? String(cost.paidAmount) : String(cost.amount));
    setEditBazaarDueAmount(cost.dueAmount !== undefined ? String(cost.dueAmount) : '0');
    setEditBazaarDueShop(cost.dueShopName || '');
  };

  const handleEditBazaarAmountChange = (val: string) => {
    setEditBazaarAmount(val);
    if (editBazaarHasDue) {
      const total = parseFloat(val) || 0;
      const paid = parseFloat(editBazaarPaidAmount) || 0;
      const due = Math.max(0, total - paid);
      setEditBazaarDueAmount(due > 0 ? String(due) : '0');
    }
  };

  const handleEditBazaarPaidChange = (val: string) => {
    setEditBazaarPaidAmount(val);
    const total = parseFloat(editBazaarAmount) || 0;
    const paid = parseFloat(val) || 0;
    const due = Math.max(0, total - paid);
    setEditBazaarDueAmount(due > 0 ? String(due) : '0');
  };

  const handleEditBazaarDueChange = (val: string) => {
    setEditBazaarDueAmount(val);
    const total = parseFloat(editBazaarAmount) || 0;
    const due = parseFloat(val) || 0;
    const paid = Math.max(0, total - due);
    setEditBazaarPaidAmount(paid > 0 ? String(paid) : '0');
  };

  const handleSaveEditedBazaar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBazaar) return;

    const amt = parseFloat(editBazaarAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid expense amount greater than 0.");
      return;
    }
    if (!editBazaarDesc.trim()) {
      alert("Please enter items or description of the shopping.");
      return;
    }
    if (!editBazaarDate) {
      alert("Please select a valid shopping date.");
      return;
    }

    let paid = amt;
    let due = 0;
    let shopName = '';
    let isSettled = true;

    if (editBazaarHasDue) {
      const p = parseFloat(editBazaarPaidAmount);
      paid = !isNaN(p) && p >= 0 ? p : 0;
      const d = parseFloat(editBazaarDueAmount);
      due = !isNaN(d) && d >= 0 ? d : Math.max(0, amt - paid);
      if (Math.abs((paid + due) - amt) > 0.5) {
        due = Math.max(0, amt - paid);
      }
      shopName = editBazaarDueShop.trim() || 'Local Shop';
      isSettled = due <= 0;
    }

    const updated: BazaarCost = {
      ...editingBazaar,
      date: editBazaarDate,
      amount: amt,
      description: editBazaarDesc.trim(),
      spentById: editBazaarBuyer,
      paidAmount: paid,
      dueAmount: due,
      dueShopName: shopName || undefined,
      isDueSettled: isSettled,
      settledDate: isSettled && due > 0 ? (editingBazaar.settledDate || editBazaarDate) : (isSettled ? editingBazaar.settledDate : undefined),
      settledNote: isSettled ? editingBazaar.settledNote : undefined
    };

    setBazaarCosts(prev => prev.map(c => c.id === updated.id ? updated : c));
    syncBazaarToFirestore(updated);
    setEditingBazaar(null);

    setBazaarSuccessMsg(`✓ Updated bazaar purchase "${updated.description}" (৳${amt.toLocaleString('en-IN')})`);
    setTimeout(() => setBazaarSuccessMsg(null), 5000);
  };

  // --- Deposit Edit Form State ---
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [editDepositBoarderId, setEditDepositBoarderId] = useState<string>('');
  const [editDepositAmount, setEditDepositAmount] = useState<string>('');
  const [editDepositDate, setEditDepositDate] = useState<string>('');
  const [editDepositNote, setEditDepositNote] = useState<string>('');

  const handleOpenEditDeposit = (dep: Deposit) => {
    setEditingDeposit(dep);
    setEditDepositBoarderId(dep.boarderId);
    setEditDepositAmount(String(dep.amount));
    setEditDepositDate(dep.date);
    setEditDepositNote(dep.note || '');
  };

  const handleSaveEditedDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeposit) return;

    const amt = parseFloat(editDepositAmount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid deposit amount greater than 0.");
      return;
    }
    if (!editDepositBoarderId) {
      alert("Please select a boarder who made the deposit.");
      return;
    }
    if (!editDepositDate) {
      alert("Please select a valid deposit date.");
      return;
    }

    const updated: Deposit = {
      ...editingDeposit,
      boarderId: editDepositBoarderId,
      amount: amt,
      date: editDepositDate,
      note: editDepositNote.trim() || undefined
    };

    setDeposits(prev => prev.map(d => d.id === updated.id ? updated : d));
    syncDepositToFirestore(updated);
    setEditingDeposit(null);

    const depositor = boarders.find(b => b.id === editDepositBoarderId);
    setDepositSuccessMsg(`✓ Updated deposit for ${depositor?.name || 'Boarder'} (৳${amt.toLocaleString('en-IN')})`);
    setTimeout(() => setDepositSuccessMsg(null), 5000);
  };

  const handleUpdateStandardFixedCost = (field: StandardFixedBillKey, val: number) => {
    const updated = {
      ...miscCosts,
      [field]: isNaN(val) ? 0 : Math.max(0, val)
    };
    setMiscCosts(updated);
    syncMiscCostsToFirestore(updated);
  };

  const handleToggleStandardFixedPaidFromCash = (field: StandardFixedBillKey, paid: boolean) => {
    const currentPaid = miscCosts.paidFromCash || {};
    const updatedPaid = {
      ...currentPaid,
      [field]: paid
    };
    const updated: MiscellaneousCosts = {
      ...miscCosts,
      paidFromCash: updatedPaid
    };
    setMiscCosts(updated);
    syncMiscCostsToFirestore(updated);
  };

  // --- Custom Fixed Bill Category State ---
  const [newFixedCategoryName, setNewFixedCategoryName] = useState<string>('');
  const [newFixedCategoryAmount, setNewFixedCategoryAmount] = useState<string>('');
  const [newFixedCategoryPaidFromCash, setNewFixedCategoryPaidFromCash] = useState<boolean>(false);
  const [customFixedError, setCustomFixedError] = useState<string | null>(null);
  const [customFixedSuccess, setCustomFixedSuccess] = useState<string | null>(null);
  const [showAddCustomForm, setShowAddCustomForm] = useState<boolean>(false);

  const handleAddCustomBill = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomFixedError(null);
    setCustomFixedSuccess(null);

    const name = newFixedCategoryName.trim();
    if (!name) {
      setCustomFixedError('Please enter a category name (e.g. Waste Disposal, Newspaper, Security).');
      return;
    }

    const amt = parseFloat(newFixedCategoryAmount);
    if (isNaN(amt) || amt < 0) {
      setCustomFixedError('Please enter a valid bill amount in Taka (0 or greater).');
      return;
    }

    const currentBills = miscCosts.customBills || [];
    if (currentBills.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      setCustomFixedError(`A category named "${name}" already exists.`);
      return;
    }

    const newBill: CustomFixedBill = {
      id: `cb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      amount: amt,
      paidFromCash: newFixedCategoryPaidFromCash
    };

    const updatedBills = [...(miscCosts.customBills || []), newBill];
    const updated: MiscellaneousCosts = {
      ...miscCosts,
      customBills: updatedBills
    };
    setMiscCosts(updated);
    syncMiscCostsToFirestore(updated);

    setNewFixedCategoryName('');
    setNewFixedCategoryAmount('');
    setNewFixedCategoryPaidFromCash(false);
    setCustomFixedSuccess(`Added category "${name}" (৳${amt}) to shared fixed bills${newBill.paidFromCash ? ' [Paid from Cash]' : ''}!`);
    setShowAddCustomForm(false);
    setTimeout(() => setCustomFixedSuccess(null), 3000);
  };

  const handleUpdateCustomBillAmount = (id: string, amount: number) => {
    const updatedBills = (miscCosts.customBills || []).map(b => 
      b.id === id ? { ...b, amount: isNaN(amount) ? 0 : Math.max(0, amount) } : b
    );
    const updated: MiscellaneousCosts = {
      ...miscCosts,
      customBills: updatedBills
    };
    setMiscCosts(updated);
    syncMiscCostsToFirestore(updated);
  };

  const handleToggleCustomBillPaidFromCash = (id: string, paid: boolean) => {
    const updatedBills = (miscCosts.customBills || []).map(b => 
      b.id === id ? { ...b, paidFromCash: paid } : b
    );
    const updated: MiscellaneousCosts = {
      ...miscCosts,
      customBills: updatedBills
    };
    setMiscCosts(updated);
    syncMiscCostsToFirestore(updated);
  };

  const handleDeleteCustomBill = (id: string) => {
    const updatedBills = (miscCosts.customBills || []).filter(b => b.id !== id);
    const updated: MiscellaneousCosts = {
      ...miscCosts,
      customBills: updatedBills
    };
    setMiscCosts(updated);
    syncMiscCostsToFirestore(updated);
  };

  // Find or create meal log for the selected date
  const currentDayLog: DailyMealLog = mealLogs.find(log => log.date === selectedMealDate) || {
    date: selectedMealDate,
    meals: {}
  };

  const handleUpdateMeal = (boarderId: string, value: number) => {
    const updatedMeals = { ...currentDayLog.meals, [boarderId]: Math.max(0, value) };
    const nowIso = new Date().toISOString();
    
    setMealLogs(prev => {
      const exists = prev.some(log => log.date === selectedMealDate);
      if (exists) {
        return prev.map(log => log.date === selectedMealDate ? { ...log, meals: updatedMeals, updatedAt: nowIso } : log);
      } else {
        return [...prev, { date: selectedMealDate, meals: updatedMeals, note: currentDayLog.note, updatedAt: nowIso }];
      }
    });

    syncMealLogToFirestore({
      date: selectedMealDate,
      meals: updatedMeals,
      note: currentDayLog.note,
      updatedAt: nowIso
    });
  };

  const handleBulkMeals = (type: 'all-regular' | 'all-zero' | 'copy-yesterday') => {
    const activeBoarders = boarders.filter(b => b.isActive);
    const updatedMeals = { ...currentDayLog.meals };

    if (type === 'all-regular') {
      activeBoarders.forEach(b => {
        updatedMeals[b.id] = 2.5; // Breakfast 0.5, Lunch 1, Dinner 1
      });
    } else if (type === 'all-zero') {
      activeBoarders.forEach(b => {
        updatedMeals[b.id] = 0;
      });
    } else if (type === 'copy-yesterday') {
      const [year, month, day] = selectedMealDate.split('-');
      const prevDay = parseInt(day, 10) - 1;
      if (prevDay > 0) {
        const prevDayStr = `${year}-${month}-${prevDay < 10 ? '0' + prevDay : prevDay}`;
        const prevLog = mealLogs.find(l => l.date === prevDayStr);
        if (prevLog) {
          activeBoarders.forEach(b => {
            updatedMeals[b.id] = prevLog.meals[b.id] ?? 0;
          });
        }
      }
    }

    const nowIso = new Date().toISOString();
    setMealLogs(prev => {
      const exists = prev.some(log => log.date === selectedMealDate);
      if (exists) {
        return prev.map(log => log.date === selectedMealDate ? { ...log, meals: updatedMeals, updatedAt: nowIso } : log);
      } else {
        return [...prev, { date: selectedMealDate, meals: updatedMeals, note: currentDayLog.note, updatedAt: nowIso }];
      }
    });

    syncMealLogToFirestore({
      date: selectedMealDate,
      meals: updatedMeals,
      note: currentDayLog.note,
      updatedAt: nowIso
    });
  };

  const handleUpdateMealNote = (noteText: string) => {
    const nowIso = new Date().toISOString();
    setMealLogs(prev => {
      const exists = prev.some(log => log.date === selectedMealDate);
      if (exists) {
        return prev.map(log =>
          log.date === selectedMealDate ? { ...log, note: noteText, updatedAt: nowIso } : log
        );
      } else {
        return [...prev, { date: selectedMealDate, meals: {}, note: noteText, updatedAt: nowIso }];
      }
    });

    syncMealLogToFirestore({
      date: selectedMealDate,
      meals: currentDayLog.meals,
      note: noteText,
      updatedAt: nowIso
    });
  };

  // Form helpers for due amount auto-calculation
  const handleBazaarAmountChange = (val: string) => {
    setBazaarAmount(val);
    if (bazaarErrorMsg) setBazaarErrorMsg(null);
    if (bazaarHasDue) {
      const total = parseFloat(val) || 0;
      const paid = parseFloat(bazaarPaidAmount) || 0;
      const due = Math.max(0, total - paid);
      setBazaarDueAmount(due > 0 ? String(due) : '0');
    }
  };

  const handlePaidAmountChange = (val: string) => {
    setBazaarPaidAmount(val);
    const total = parseFloat(bazaarAmount) || 0;
    const paid = parseFloat(val) || 0;
    const due = Math.max(0, total - paid);
    setBazaarDueAmount(due > 0 ? String(due) : '0');
  };

  const handleDueAmountChange = (val: string) => {
    setBazaarDueAmount(val);
    const total = parseFloat(bazaarAmount) || 0;
    const due = parseFloat(val) || 0;
    const paid = Math.max(0, total - due);
    setBazaarPaidAmount(paid > 0 ? String(paid) : '0');
  };

  // Add Bazaar Cost
  const handleAddBazaar = (e: React.FormEvent) => {
    e.preventDefault();
    setBazaarErrorMsg(null);
    setBazaarSuccessMsg(null);

    const amt = parseFloat(bazaarAmount);
    if (isNaN(amt) || amt <= 0) {
      setBazaarErrorMsg('Please enter a valid expense amount greater than 0.');
      return;
    }
    if (!bazaarDesc.trim()) {
      setBazaarErrorMsg('Please enter items or description of the shopping.');
      return;
    }
    if (!bazaarDate) {
      setBazaarErrorMsg('Please select a valid shopping date.');
      return;
    }

    let paid = amt;
    let due = 0;
    let shopName = '';
    let isSettled = true;

    if (bazaarHasDue) {
      const p = parseFloat(bazaarPaidAmount);
      paid = !isNaN(p) && p >= 0 ? p : 0;
      const d = parseFloat(bazaarDueAmount);
      due = !isNaN(d) && d >= 0 ? d : Math.max(0, amt - paid);

      if (Math.abs((paid + due) - amt) > 0.5) {
        due = Math.max(0, amt - paid);
      }

      shopName = bazaarDueShop.trim() || 'Local Shop';
      isSettled = due <= 0;
    }

    const newBazaar: BazaarCost = {
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      date: bazaarDate,
      amount: amt,
      description: bazaarDesc.trim(),
      spentById: bazaarBuyer,
      paidAmount: paid,
      dueAmount: due,
      dueShopName: shopName || undefined,
      isDueSettled: isSettled,
      settledDate: isSettled && due > 0 ? bazaarDate : undefined
    };

    setBazaarCosts(prev => [newBazaar, ...prev]);
    syncBazaarToFirestore(newBazaar);
    
    // Reset form states
    setBazaarAmount('');
    setBazaarDesc('');
    setBazaarHasDue(false);
    setBazaarPaidAmount('');
    setBazaarDueAmount('');
    setBazaarDueShop('');

    const spenderName = boarders.find(b => b.id === bazaarBuyer)?.name || 'Manager / Mess Cash';
    const isCurrentMonth = bazaarDate.startsWith(settings.currentMonth);
    const dueInfo = due > 0 ? ` [Shop Due: ৳${due.toLocaleString('en-IN')} at ${shopName}]` : '';
    setBazaarSuccessMsg(
      `✓ Added ৳${amt.toLocaleString('en-IN')} for "${newBazaar.description}" (Buyer: ${spenderName}, Date: ${bazaarDate})${dueInfo}${!isCurrentMonth ? ' (Note: Date belongs to another month. Use "All Months" to view)' : ''}`
    );
    setTimeout(() => setBazaarSuccessMsg(null), 5000);
  };

  const handleOpenAdjustModal = (cost: BazaarCost) => {
    setAdjustingBazaar(cost);
    const remainingDue = (cost.dueAmount !== undefined) ? cost.dueAmount : Math.max(0, cost.amount - (cost.paidAmount || 0));
    setAdjustCashAmount(String(remainingDue > 0 ? remainingDue : cost.amount));
    setAdjustCashDate(new Date().toISOString().split('T')[0]);
    setAdjustCashNote(cost.dueShopName ? `Cleared due for ${cost.dueShopName}` : 'Paid from mess cash');
  };

  const handleConfirmAdjustToCash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingBazaar) return;

    const amtToSettle = parseFloat(adjustCashAmount);
    if (isNaN(amtToSettle) || amtToSettle <= 0) {
      alert("Please enter a valid adjustment amount greater than 0.");
      return;
    }

    setIsAdjustingLoading(true);
    const currentPaid = adjustingBazaar.paidAmount !== undefined ? adjustingBazaar.paidAmount : (adjustingBazaar.amount - (adjustingBazaar.dueAmount || 0));
    const currentDue = adjustingBazaar.dueAmount !== undefined ? adjustingBazaar.dueAmount : (adjustingBazaar.amount - currentPaid);

    const newPaid = Math.min(adjustingBazaar.amount, currentPaid + amtToSettle);
    const newDue = Math.max(0, currentDue - amtToSettle);
    const isNowSettled = newDue <= 0;

    const updatedCost: BazaarCost = {
      ...adjustingBazaar,
      paidAmount: newPaid,
      dueAmount: newDue,
      isDueSettled: isNowSettled,
      settledDate: adjustCashDate || new Date().toISOString().split('T')[0],
      settledNote: adjustCashNote.trim() || undefined
    };

    setBazaarCosts(prev => prev.map(c => c.id === updatedCost.id ? updatedCost : c));
    syncBazaarToFirestore(updatedCost);
    setIsAdjustingLoading(false);
    setAdjustingBazaar(null);

    setBazaarSuccessMsg(
      `✓ Adjusted ৳${amtToSettle.toLocaleString('en-IN')} to cash for "${updatedCost.description}"! ${isNowSettled ? 'Shop due is now fully cleared.' : `Remaining due: ৳${newDue.toLocaleString('en-IN')}`}`
    );
    setTimeout(() => setBazaarSuccessMsg(null), 5000);
  };

  const handleAdjustAllDuesToCash = () => {
    const unadjusted = bazaarCosts.filter(c => c.date.startsWith(settings.currentMonth) && (c.dueAmount || 0) > 0 && !c.isDueSettled);
    if (unadjusted.length === 0) {
      alert("No pending shop dues to adjust in this month.");
      return;
    }
    const totalDue = unadjusted.reduce((sum, c) => sum + (c.dueAmount || 0), 0);
    const confirmMsg = `Are you sure you want to adjust all ${unadjusted.length} shop dues (Total: ৳${totalDue.toLocaleString('en-IN')}) using mess cash in hand?`;
    if (!confirm(confirmMsg)) return;

    const today = new Date().toISOString().split('T')[0];
    const updatedCosts = bazaarCosts.map(c => {
      if (c.date.startsWith(settings.currentMonth) && (c.dueAmount || 0) > 0 && !c.isDueSettled) {
        const updatedItem: BazaarCost = {
          ...c,
          paidAmount: c.amount,
          dueAmount: 0,
          isDueSettled: true,
          settledDate: today,
          settledNote: c.settledNote || 'Adjusted in bulk to mess cash'
        };
        syncBazaarToFirestore(updatedItem);
        return updatedItem;
      }
      return c;
    });

    setBazaarCosts(updatedCosts);
    setBazaarSuccessMsg(`✓ Successfully adjusted all ${unadjusted.length} shop dues (৳${totalDue.toLocaleString('en-IN')}) to mess cash!`);
    setTimeout(() => setBazaarSuccessMsg(null), 5000);
  };

  const handleDeleteBazaar = (id: string) => {
    setBazaarCosts(prev => prev.filter(c => c.id !== id));
    deleteBazaarFromFirestore(id);
  };

  // Add Deposit
  const handleAddDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    setDepositErrorMsg(null);
    setDepositSuccessMsg(null);

    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      setDepositErrorMsg('Please enter a valid deposit amount greater than 0.');
      return;
    }
    if (!depositBoarderId) {
      setDepositErrorMsg('Please select a boarder who made the deposit.');
      return;
    }
    if (!depositDate) {
      setDepositErrorMsg('Please select a valid deposit date.');
      return;
    }

    const newDep: Deposit = {
      id: `d_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      boarderId: depositBoarderId,
      amount: amt,
      date: depositDate,
      note: depositNote.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    setDeposits(prev => [newDep, ...prev]);
    syncDepositToFirestore(newDep);
    setDepositAmount('');
    setDepositNote('');

    const depositor = boarders.find(b => b.id === depositBoarderId);
    const isCurrentMonth = depositDate.startsWith(settings.currentMonth);
    setDepositSuccessMsg(
      `✓ Recorded ৳${amt.toLocaleString('en-IN')} deposit for ${depositor?.name || 'Boarder'} on ${depositDate}${!isCurrentMonth ? ' (Note: Date belongs to another month. Use "All Months" to view)' : ''}`
    );
    setTimeout(() => setDepositSuccessMsg(null), 5000);
  };

  const handleDeleteDeposit = (id: string) => {
    setDeposits(prev => prev.filter(d => d.id !== id));
    deleteDepositFromFirestore(id);
  };

  // Add Boarder
  const handleAddBoarder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoarderName.trim()) return;

    const newB: Boarder = {
      id: `b_${Date.now()}`,
      name: newBoarderName.trim(),
      roomNo: newBoarderRoomNo.trim() || undefined,
      phone: newBoarderPhone.trim() || undefined,
      isActive: true,
      joinedDate: new Date().toISOString().split('T')[0]
    };

    setBoarders(prev => [...prev, newB]);
    syncBoarderToFirestore(newB);
    setNewBoarderName('');
    setNewBoarderRoomNo('');
    setNewBoarderPhone('');
    
    if (!depositBoarderId) setDepositBoarderId(newB.id);
    if (!bazaarBuyer) setBazaarBuyer(newB.id);
  };

  const handleToggleBoarderActive = (id: string) => {
    const target = boarders.find(b => b.id === id);
    if (target) {
      syncBoarderToFirestore({ ...target, isActive: !target.isActive });
    }
    setBoarders(prev => prev.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b));
  };

  const handleDeleteBoarder = (id: string) => {
    if (confirm("Are you sure you want to delete this boarder? This will NOT delete their previous meal logs or deposits, but they won't appear in lists.")) {
      setBoarders(prev => prev.filter(b => b.id !== id));
      deleteBoarderFromFirestore(id);
    }
  };

  // Manage Mess cash balance with Shop Dues adjustment
  const currentMonthBazaars = bazaarCosts.filter(c => c.date.startsWith(settings.currentMonth));
  const totalBazaarSpent = report.totalBazaarCost;
  const totalBazaarCashPaid = currentMonthBazaars.reduce((sum, c) => {
    if (c.paidAmount !== undefined) {
      return sum + c.paidAmount;
    }
    return sum + c.amount;
  }, 0);
  const totalPendingBazaarDues = currentMonthBazaars.reduce((sum, c) => {
    if (c.dueAmount && !c.isDueSettled) {
      return sum + c.dueAmount;
    }
    return sum;
  }, 0);
  const totalCashDeposited = report.totalDeposits;

  // Fixed Bills Outflow (Bills marked as paid directly from mess cash in hand)
  const standardFixedBillsPaidFromCash = (
    (miscCosts.paidFromCash?.cookerBill ? (miscCosts.cookerBill || 0) : 0) +
    (miscCosts.paidFromCash?.utilityBill ? (miscCosts.utilityBill || 0) : 0) +
    (miscCosts.paidFromCash?.gasBill ? (miscCosts.gasBill || 0) : 0) +
    (miscCosts.paidFromCash?.wifiBill ? (miscCosts.wifiBill || 0) : 0) +
    (miscCosts.paidFromCash?.houseRent ? (miscCosts.houseRent || 0) : 0) +
    (miscCosts.paidFromCash?.otherCosts ? (miscCosts.otherCosts || 0) : 0)
  );

  const customFixedBillsPaidFromCash = (miscCosts.customBills || []).reduce(
    (sum, b) => sum + (b.paidFromCash ? (b.amount || 0) : 0),
    0
  );

  const totalFixedBillsPaidFromCash = standardFixedBillsPaidFromCash + customFixedBillsPaidFromCash;

  // Standalone special feast costs paid from cash that are not already in bazaar costs
  const standaloneSpecialMealsPaidFromCash = monthSpecialMeals
    .filter(sm => sm.paidFromCash && !sm.bazaarCostId)
    .reduce((sum, sm) => sum + (sm.totalCost || 0), 0);

  const remainingCash = totalCashDeposited - totalBazaarCashPaid - totalFixedBillsPaidFromCash - standaloneSpecialMealsPaidFromCash;

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Top Action & Monthly PDF Export Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Manager Operations & Audit
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 font-mono">
                {formatReadableMonth(settings.currentMonth)}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Track daily bazaar, meal consumption, fixed bills, and generate certified monthly statements.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveTab('bazaar')}
            id="btn-quick-daily-cost"
            className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Daily Cost</span>
          </button>

          <button
            onClick={() => setActiveTab('deposits')}
            id="btn-quick-deposit"
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-3.5 py-2.5 rounded-xl cursor-pointer transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Deposit</span>
          </button>

          <button
            onClick={() => setShowSpecialMealModal(true)}
            id="btn-manager-special-meal"
            className="flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-pointer transition-all shrink-0 shadow-2xs"
            title="Manage Special Feast / Meal costs distributed strictly among participating boarders (excluded from regular meal rate)"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Special Feast</span>
            {monthSpecialMeals.length > 0 && (
              <span className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {monthSpecialMeals.length}
              </span>
            )}
          </button>

          {onOpenHandoverModal && (
            <button
              onClick={onOpenHandoverModal}
              id="btn-manager-handover"
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs shrink-0"
              title="Close month, settle balances, and handover management to new manager"
            >
              <ArrowRightLeft className="w-4 h-4 text-emerald-100" />
              <span>Close & Handover</span>
            </button>
          )}

          <button
            onClick={() => setShowMealSheetModal(true)}
            id="btn-manager-meal-sheet-pdf"
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs hover:shadow-md shrink-0"
            title="Generate and export the monthly 31-day meal sheet for all boarders"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Meal Sheet PDF</span>
          </button>

          <button
            onClick={() => setShowPdfModal(true)}
            id="btn-manager-generate-pdf"
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs hover:shadow-md shrink-0"
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>Financial PDF</span>
          </button>

          <button
            onClick={() => {
              setDashboardPinInput('');
              setDashboardPinSuccess(false);
              setShowPinModal(true);
            }}
            id="btn-manager-quick-pin"
            className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs px-3.5 py-2.5 rounded-xl cursor-pointer transition-all shrink-0 border border-slate-200"
            title="Manage Security PIN"
          >
            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold">Security PIN</span>
          </button>
        </div>
      </div>

      {/* Top Level Financial Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        <div className="bg-blue-600 text-white p-4 rounded-xl shadow-xs">
          <span className="text-[10px] text-blue-100 uppercase font-bold">Cash Deposits</span>
          <p className="text-xl font-bold mt-1">৳ {totalCashDeposited.toLocaleString('en-IN')}</p>
          <span className="text-[9.5px] text-blue-200">Total collected</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Bazaar Costs</span>
          <p className="text-xl font-bold text-slate-800 mt-1">৳ {totalBazaarSpent.toLocaleString('en-IN')}</p>
          <span className="text-[9.5px] text-slate-400">Total consumption</span>
        </div>

        <div className={`p-4 rounded-xl shadow-xs border transition-colors ${
          totalPendingBazaarDues > 0 ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Shop Dues (বাকি)</span>
            {totalPendingBazaarDues > 0 && (
              <span className="text-[8.5px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full">
                Pending
              </span>
            )}
          </div>
          <p className={`text-xl font-bold mt-1 ${totalPendingBazaarDues > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
            ৳ {totalPendingBazaarDues.toLocaleString('en-IN')}
          </p>
          <span className="text-[9.5px] text-slate-400">
            {totalPendingBazaarDues > 0 ? 'To adjust to cash' : 'Zero shop debt'}
          </span>
        </div>

        <div className={`p-4 rounded-xl shadow-xs border transition-colors ${
          remainingCash >= 0 ? 'bg-blue-50/40 border-blue-100' : 'bg-rose-50 border-rose-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Actual Cash</span>
            {totalFixedBillsPaidFromCash > 0 && (
              <span className="text-[8.5px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-mono" title={`৳${totalFixedBillsPaidFromCash.toLocaleString('en-IN')} paid out for fixed bills`}>
                -৳{totalFixedBillsPaidFromCash.toLocaleString('en-IN')} bills
              </span>
            )}
          </div>
          <p className={`text-xl font-bold mt-1 ${remainingCash >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            ৳ {remainingCash.toLocaleString('en-IN')}
          </p>
          <span 
            className="text-[9.5px] text-slate-500 font-medium block truncate cursor-help" 
            title={`Actual Cash in Hand = Total Deposits (৳${totalCashDeposited.toLocaleString('en-IN')}) - Bazaar Cash (৳${totalBazaarCashPaid.toLocaleString('en-IN')}) - Fixed Bills Cash (৳${totalFixedBillsPaidFromCash.toLocaleString('en-IN')})`}
          >
            Cash in Hand (হাতে নগদ)
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Meal Rate</span>
          <p className="text-xl font-extrabold text-blue-600 mt-1">৳ {report.mealRate.toFixed(4)}</p>
          <span className="text-[9.5px] text-slate-400">Per meal share</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Fixed Bills</span>
            {totalFixedBillsPaidFromCash > 0 && (
              <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-full font-mono">
                ৳{totalFixedBillsPaidFromCash} cash
              </span>
            )}
          </div>
          <p className="text-xl font-bold text-slate-800 mt-1">৳ {report.totalFixedCost.toLocaleString('en-IN')}</p>
          <span className="text-[9.5px] text-slate-400">
            {totalFixedBillsPaidFromCash > 0 ? `৳${totalFixedBillsPaidFromCash.toLocaleString('en-IN')} paid from cash` : 'Shared utilities'}
          </span>
        </div>

      </div>

      {/* --- MONTHLY BUDGET TARGET PROGRESS BAR --- */}
      {(() => {
        const totalExpensesSpent = totalBazaarSpent + report.totalFixedCost;
        const budgetTarget = settings.monthlyBudgetTarget || 0;
        const budgetSpentPct = budgetTarget > 0 ? (totalExpensesSpent / budgetTarget) * 100 : 0;
        const remainingBudget = budgetTarget - totalExpensesSpent;
        const isOverBudget = budgetTarget > 0 && totalExpensesSpent > budgetTarget;

        return (
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
            budgetTarget === 0 
              ? 'bg-slate-50 border-slate-200'
              : isOverBudget 
              ? 'bg-rose-50/70 border-rose-200' 
              : budgetSpentPct >= 85 
              ? 'bg-amber-50/70 border-amber-200' 
              : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  budgetTarget === 0
                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                    : isOverBudget
                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                    : budgetSpentPct >= 85
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      Monthly Budget Target ({formatReadableMonth(settings.currentMonth)})
                    </h4>
                    {budgetTarget > 0 && (
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isOverBudget 
                          ? 'bg-rose-100 text-rose-800 animate-pulse' 
                          : budgetSpentPct >= 85
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isOverBudget ? 'Over Budget' : `${budgetSpentPct.toFixed(1)}% Spent`}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Bazaar Spent (৳{totalBazaarSpent.toLocaleString('en-IN')}) + Fixed Bills (৳{report.totalFixedCost.toLocaleString('en-IN')})
                  </p>
                </div>
              </div>

              {/* Budget Numbers / Quick Action */}
              <div className="flex items-center gap-3 self-end sm:self-auto">
                {budgetTarget > 0 ? (
                  <div className="text-right">
                    <div className="text-sm sm:text-base font-extrabold text-slate-900">
                      ৳ {totalExpensesSpent.toLocaleString('en-IN')}{' '}
                      <span className="text-xs text-slate-400 font-normal">
                        / ৳ {budgetTarget.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className={`text-[11px] font-semibold ${
                      isOverBudget 
                        ? 'text-rose-600 font-bold' 
                        : remainingBudget < budgetTarget * 0.15 
                        ? 'text-amber-600' 
                        : 'text-slate-500'
                    }`}>
                      {isOverBudget
                        ? `⚠️ Exceeded budget by ৳ ${Math.abs(remainingBudget).toLocaleString('en-IN')}`
                        : `৳ ${remainingBudget.toLocaleString('en-IN')} remaining`}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 italic">No budget target set</span>
                  </div>
                )}

                {/* Quick Edit Budget Button */}
                <button
                  onClick={() => {
                    const targetVal = prompt('Set Monthly Budget Target (in Taka):', budgetTarget > 0 ? String(budgetTarget) : '25000');
                    if (targetVal !== null) {
                      const parsed = parseFloat(targetVal);
                      if (!isNaN(parsed) && parsed >= 0) {
                        const updated = { ...settings, monthlyBudgetTarget: parsed };
                        setSettings(updated);
                        localStorage.setItem('mess_settings', JSON.stringify(updated));
                        syncSettingsToFirestore(updated);
                      }
                    }
                  }}
                  id="btn-quick-edit-budget-target"
                  className="text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors shrink-0"
                  title="Set or update monthly budget target"
                >
                  {budgetTarget > 0 ? 'Edit Target' : '+ Set Target'}
                </button>
              </div>
            </div>

            {/* Progress Bar Container */}
            {budgetTarget > 0 ? (
              <div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200/60 relative">
                  {/* Bazaar segment */}
                  <div
                    style={{ width: `${Math.min(100, (totalBazaarSpent / budgetTarget) * 100)}%` }}
                    className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-rose-500' : 'bg-blue-600'}`}
                    title={`Bazaar Expenses: ৳${totalBazaarSpent.toLocaleString('en-IN')}`}
                  />
                  {/* Fixed Bills segment */}
                  <div
                    style={{ width: `${Math.min(Math.max(0, 100 - (totalBazaarSpent / budgetTarget) * 100), (report.totalFixedCost / budgetTarget) * 100)}%` }}
                    className={`h-full transition-all duration-500 ${isOverBudget ? 'bg-rose-400' : 'bg-indigo-500'}`}
                    title={`Shared Fixed Costs: ৳${report.totalFixedCost.toLocaleString('en-IN')}`}
                  />
                </div>

                {/* Sub-bar Breakdown Legend */}
                <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 mt-2 font-medium">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${isOverBudget ? 'bg-rose-500' : 'bg-blue-600'}`} />
                      Bazaar: ৳{totalBazaarSpent.toLocaleString('en-IN')} ({((totalBazaarSpent / budgetTarget) * 100).toFixed(0)}%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${isOverBudget ? 'bg-rose-400' : 'bg-indigo-500'}`} />
                      Fixed Bills: ৳{report.totalFixedCost.toLocaleString('en-IN')} ({((report.totalFixedCost / budgetTarget) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <span className="font-mono">
                    {budgetSpentPct.toFixed(1)}% of ৳{budgetTarget.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">
                Setting a budget target helps mess managers monitor monthly bazaar and utility expenditures to prevent overspending.
              </p>
            )}
          </div>
        );
      })()}

      {/* --- RECENT ACTIVITIES AUDIT SECTION --- */}
      <RecentActivitiesSection
        deposits={deposits}
        mealLogs={mealLogs}
        boarders={boarders}
        currentMonth={settings.currentMonth}
        onNavigateToTab={(tab) => {
          setActiveTab(tab);
          setTimeout(() => {
            const el = document.getElementById(`tab-${tab}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 50);
        }}
        onSelectMealDate={(date) => {
          setSelectedMealDate(date);
          setIsEditingMeals(true);
        }}
      />

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap items-center -mb-px gap-2">
          
          <button
            onClick={() => setActiveTab('meals')}
            id="tab-meals"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm cursor-pointer transition-colors ${
              activeTab === 'meals'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Daily Meals</span>
            {breakfastDefaultersCount > 0 && (
              <span 
                className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1"
                title={`${breakfastDefaultersCount} boarder(s) below ${minBreakfastDays} days breakfast`}
              >
                <Coffee className="w-2.5 h-2.5 text-amber-700" />
                <span>{breakfastDefaultersCount} below 16d</span>
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('bazaar')}
            id="tab-bazaar"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm cursor-pointer transition-colors ${
              activeTab === 'bazaar'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Bazaar Log
          </button>

          <button
            onClick={() => setActiveTab('deposits')}
            id="tab-deposits"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm cursor-pointer transition-colors ${
              activeTab === 'deposits'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Deposits
          </button>

          <button
            onClick={() => setActiveTab('fixed')}
            id="tab-fixed"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm cursor-pointer transition-colors ${
              activeTab === 'fixed'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Utility & Fixed Bills
          </button>

          <button
            onClick={() => setActiveTab('boarders')}
            id="tab-boarders"
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-xs sm:text-sm cursor-pointer transition-colors ${
              activeTab === 'boarders'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Boarder Profiles
          </button>

          {/* Quick jump to audit feed button on tab strip */}
          <div className="ml-auto pb-2 sm:pb-0">
            <button
              onClick={() => {
                const el = document.getElementById('recent-activities-scroll-feed');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }}
              id="tab-quick-activities-jump"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-lg cursor-pointer transition-colors shadow-2xs"
              title="Jump to Recent Activities audit trail"
            >
              <Activity className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span>Audit Feed</span>
            </button>
          </div>

        </nav>
      </div>

      {/* --- TAB 1: MEALS LOGGER --- */}
      {activeTab === 'meals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Left panel: Days selection calendar scroll */}
          <div className="bg-white border border-gray-100 rounded-xl shadow-xs p-4 h-[500px] flex flex-col">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Date to Edit</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Click any day to update members' meal counts</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                <button
                  onClick={() => setShowBreakfastAuditModal(true)}
                  id="btn-meals-tab-breakfast-audit"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
                  title="Breakfast Audit: Check boarders below 16 days & apply meal fines"
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-700" />
                  <span>Breakfast Audit</span>
                  {breakfastDefaultersCount > 0 && (
                    <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full">
                      {breakfastDefaultersCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowMealSheetModal(true)}
                  id="btn-meals-tab-meal-sheet"
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
                  title="View & Export full 31-day meal sheet PDF"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Meal Sheet PDF</span>
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 divide-y divide-gray-50 pr-1">
              {datesInActiveMonth.map((dateStr) => {
                const log = mealLogs.find(l => l.date === dateStr);
                const activeIds = boarders.filter(b => b.isActive).map(b => b.id);
                // Calculate total meals logged on this day
                const dayTotal = log 
                  ? Object.entries(log.meals)
                      .filter(([bId]) => activeIds.includes(bId))
                      .reduce((sum, [, count]) => sum + count, 0)
                  : 0;

                return (
                  <button
                    key={dateStr}
                    id={`day-select-${dateStr}`}
                    onClick={() => setSelectedMealDate(dateStr)}
                    className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                      selectedMealDate === dateStr
                        ? 'bg-emerald-50 text-emerald-800 font-semibold'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-1">
                      <span className="truncate">{formatReadableDate(dateStr)}</span>
                      {log?.note && (
                        <span className="text-[10px] text-amber-600 font-medium truncate flex items-center gap-1 mt-0.5">
                          <StickyNote className="w-2.5 h-2.5 shrink-0 text-amber-500" />
                          <span className="truncate">{log.note}</span>
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      dayTotal > 0 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-gray-100 text-gray-400 font-normal'
                    }`}>
                      {dayTotal} meals
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Day editor */}
          <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl shadow-xs p-6 flex flex-col justify-between">
            <div>
              {/* Header with Title and Edit Mode Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-4 mb-4 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-emerald-600" />
                      Meals for {formatReadableDate(selectedMealDate)}
                    </h3>

                    {/* Mode Status Badge */}
                    {isEditingMeals ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-lg shadow-2xs animate-pulse">
                        <Unlock className="w-3 h-3 text-emerald-600" />
                        Editing Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                        <Lock className="w-3 h-3 text-slate-500" />
                        Locked (Protected)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isEditingMeals 
                      ? 'Adjust meal counts or add context. Click "Done & Lock" when finished.'
                      : 'Protected against accidental changes. Click "Edit Meals" to modify.'}
                  </p>
                </div>

                {/* Primary Edit / Lock Buttons & Bulk Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isEditingMeals ? (
                    <>
                      {/* Bulk Actions in Edit Mode */}
                      <div className="flex flex-wrap gap-1.5 mr-1">
                        <button
                          onClick={() => handleBulkMeals('all-regular')}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1.5 rounded border border-emerald-200 cursor-pointer transition-colors"
                          title="Set 2.5 meals for all active boarders"
                        >
                          Set All 2.5
                        </button>
                        <button
                          onClick={() => handleBulkMeals('all-zero')}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-1.5 rounded cursor-pointer transition-colors"
                          title="Set 0 meals for all active boarders"
                        >
                          Reset All 0
                        </button>
                        <button
                          onClick={() => handleBulkMeals('copy-yesterday')}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1.5 rounded border border-blue-200 cursor-pointer transition-colors flex items-center gap-0.5"
                          title="Copy meals from the previous day"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          Copy Yesterday
                        </button>
                      </div>

                      {/* Done / Lock Button */}
                      <button
                        onClick={() => setIsEditingMeals(false)}
                        id="btn-lock-daily-meals"
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl cursor-pointer transition-all shadow-xs hover:shadow-md shrink-0"
                        title="Lock meals and prevent accidental changes"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done & Lock</span>
                      </button>
                    </>
                  ) : (
                    /* Edit Meals Button in View Mode */
                    <button
                      onClick={() => setIsEditingMeals(true)}
                      id="btn-edit-daily-meals"
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-all shadow-xs hover:shadow-md shrink-0"
                      title="Unlock this day to make meal adjustments"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Meals</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Alert Banner for Boarders below 16 days breakfast */}
              {breakfastDefaultersCount > 0 && (
                <div className="mb-4 bg-amber-50/90 border border-amber-300/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Coffee className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <span className="font-bold text-amber-950">Breakfast Attendance Alert: </span>
                      <span className="text-amber-800 text-[11px]">
                        <strong>{breakfastDefaultersCount} boarder(s)</strong> have eaten breakfast on fewer than {minBreakfastDays} days this month.
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBreakfastAuditModal(true)}
                    className="self-end sm:self-auto flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
                  >
                    <span>Audit & Apply Meal Fine</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Informational Banner when Locked */}
              {!isEditingMeals ? (
                <div className="mb-5 bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-950">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4 text-blue-700" />
                    </div>
                    <div>
                      <span className="font-bold text-blue-900 block sm:inline">Protected against accidental edits: </span>
                      <span className="text-blue-800/90 text-[11px]">Meal buttons are locked. Click <strong>Edit Meals</strong> to adjust counts.</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEditingMeals(true)}
                    className="self-end sm:self-auto flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Unlock & Edit</span>
                  </button>
                </div>
              ) : (
                <div className="mb-5 bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-emerald-950">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Editing mode enabled. When finished, click <strong>Done & Lock</strong> to prevent accidental taps.</span>
                  </div>
                  <button
                    onClick={() => setIsEditingMeals(false)}
                    className="flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Done & Lock</span>
                  </button>
                </div>
              )}

              {/* Day Note Field (Editable in Edit Mode, Readable in View Mode) */}
              {isEditingMeals ? (
                <div className="mb-5 bg-amber-50/40 border border-amber-200/70 rounded-xl p-3.5 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                    <label htmlFor="meal-day-note" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                      <span>Meal Note / Context <span className="text-[11px] font-normal text-slate-500">(Optional)</span></span>
                    </label>
                    {currentDayLog.note?.trim() && (
                      <span className="text-[10px] text-amber-700 font-semibold bg-amber-100/70 border border-amber-300/60 px-2 py-0.5 rounded-full self-start sm:self-auto flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Note Saved
                      </span>
                    )}
                  </div>
                  
                  <div className="relative">
                    <input
                      id="meal-day-note"
                      type="text"
                      value={currentDayLog.note ?? ''}
                      onChange={(e) => handleUpdateMealNote(e.target.value)}
                      placeholder="e.g. Special Lunch, Guest Invitation, Friday Feast, Picnic"
                      className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
                    />
                    {currentDayLog.note && (
                      <button
                        type="button"
                        onClick={() => handleUpdateMealNote('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                        title="Clear note"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Add context for this day's meals (e.g., "Special Lunch", "Guest Invitation") to display across reports and boarder views.
                  </p>
                </div>
              ) : (
                currentDayLog.note?.trim() ? (
                  <div className="mb-5 bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">Context Note</span>
                        <p className="text-xs font-semibold text-slate-800">{currentDayLog.note}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditingMeals(true)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </div>
                ) : null
              )}

              {/* Members Inputs List */}
              <div className="space-y-3.5">
                {boarders.filter(b => b.isActive).length === 0 ? (
                  <div className="text-center p-8 bg-gray-50 rounded-lg text-gray-400 text-xs">
                    Please add active boarders first under the "Boarder Profiles" tab.
                  </div>
                ) : (
                  boarders.filter(b => b.isActive).map((boarder) => {
                    const currentMealVal = currentDayLog.meals[boarder.id] ?? 0;

                    return (
                      <div 
                        key={boarder.id} 
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl border transition-all gap-3 ${
                          isEditingMeals 
                            ? 'border-gray-200 bg-white hover:border-gray-300 shadow-2xs' 
                            : 'border-gray-100 bg-gray-50/60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-gray-800">{boarder.name}</p>
                            {boarder.roomNo && (
                              <span className="text-[10px] bg-slate-200/80 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                                {boarder.roomNo}
                              </span>
                            )}
                          </div>
                          {boarder.phone && <p className="text-[10px] text-gray-400 font-mono">{boarder.phone}</p>}
                        </div>

                        {/* Increment controllers (Edit Mode) vs Protected Display (View Mode) */}
                        {isEditingMeals ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleUpdateMeal(boarder.id, currentMealVal - 0.5)}
                              className="w-8 h-8 rounded-lg bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 transition-colors shadow-xs"
                              title="Decrease 0.5"
                            >
                              -0.5
                            </button>

                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={currentMealVal === 0 ? '0' : currentMealVal}
                              onChange={(e) => handleUpdateMeal(boarder.id, parseFloat(e.target.value) || 0)}
                              className="w-16 h-8 text-center bg-white border border-gray-200 rounded-lg text-xs font-bold focus:ring-1 focus:ring-emerald-500"
                            />

                            <button
                              onClick={() => handleUpdateMeal(boarder.id, currentMealVal + 0.5)}
                              className="w-8 h-8 rounded-lg bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 transition-colors shadow-xs"
                              title="Increase 0.5"
                            >
                              +0.5
                            </button>

                            <div className="h-4 w-[1px] bg-gray-200 mx-1 hidden sm:block" />

                            <button
                              onClick={() => handleUpdateMeal(boarder.id, currentMealVal + 1)}
                              className="px-2.5 h-8 rounded-lg bg-white border border-gray-200 hover:border-gray-300 flex items-center justify-center text-xs font-bold text-gray-600 transition-colors shadow-xs"
                              title="Increase 1.0"
                            >
                              +1
                            </button>

                            <button
                              onClick={() => handleUpdateMeal(boarder.id, 2.5)}
                              className="px-2.5 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 transition-colors"
                              title="Set 2.5 full meals"
                            >
                              2.5 Full
                            </button>
                          </div>
                        ) : (
                          /* View Mode: Clean protected badge */
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                              currentMealVal === 0
                                ? 'bg-slate-100 text-slate-500 border-slate-200 font-normal'
                                : currentMealVal === 2.5
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 font-extrabold'
                                : 'bg-blue-50 text-blue-800 border-blue-200 font-extrabold'
                            }`}>
                              {currentMealVal === 2.5 ? '2.5 Full' : `${currentMealVal} meals`}
                            </span>

                            <button
                              onClick={() => setIsEditingMeals(true)}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Unlock to edit meals"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Quick Lock Button when in Edit Mode */}
              {isEditingMeals && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Done making changes for {formatReadableDate(selectedMealDate)}?
                  </span>
                  <button
                    onClick={() => setIsEditingMeals(false)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all shadow-xs"
                  >
                    <Check className="w-4 h-4" />
                    <span>Done & Lock Meals</span>
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 mt-6 flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Standard rates: Breakfast (0.5), Lunch (1.0), Dinner (1.0) = 2.5 full meals daily per boarder.</span>
            </div>
          </div>

        </div>
      )}

      {/* --- TAB 2: BAZAAR LOGS --- */}
      {activeTab === 'bazaar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Add Expense Form */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                Add Bazaar Shopping
              </h3>
              <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {formatReadableMonth(settings.currentMonth)}
              </span>
            </div>

            {/* Error & Success Feedback Banners */}
            {bazaarErrorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{bazaarErrorMsg}</span>
              </div>
            )}
            {bazaarSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-medium">{bazaarSuccessMsg}</span>
              </div>
            )}
            
            <form onSubmit={handleAddBazaar} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Amount (৳ Taka) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="e.g. 850"
                    value={bazaarAmount}
                    onChange={(e) => handleBazaarAmountChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Shopping Date <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatReadableMonth(settings.currentMonth)}
                  </span>
                </div>
                <input
                  type="date"
                  required
                  value={bazaarDate}
                  onChange={(e) => {
                    setBazaarDate(e.target.value);
                    if (bazaarErrorMsg) setBazaarErrorMsg(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />

                {/* Quick Date Pickers */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-400">Quick set:</span>
                  <button
                    type="button"
                    onClick={() => setBazaarDate(`${settings.currentMonth}-01`)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    1st of Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setBazaarDate(`${settings.currentMonth}-15`)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    15th
                  </button>
                  <button
                    type="button"
                    onClick={() => setBazaarDate(new Date().toISOString().split('T')[0])}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                </div>

                {!bazaarDate.startsWith(settings.currentMonth) && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5 mt-2 leading-tight">
                    Notice: Date ({bazaarDate}) is outside active calculation month ({settings.currentMonth}). Use the "All Months" filter on the right to view it.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Items Purchased <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Chicken 2kg, Eggs 12, Potatoes, Cooking Oil"
                  value={bazaarDesc}
                  onChange={(e) => {
                    setBazaarDesc(e.target.value);
                    if (bazaarErrorMsg) setBazaarErrorMsg(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Paid By (Boarder)</label>
                <select
                  value={bazaarBuyer}
                  onChange={(e) => setBazaarBuyer(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">Manager / Mess Cash</option>
                  {boarders.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.roomNo ? ` (${b.roomNo})` : ''} {b.isActive ? '' : '(Inactive)'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Leave as "Manager / Mess Cash" if spent directly from common pool.
                </p>
              </div>

              {/* Option: Shop Due / Credit (দোকান বাকি) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="chk-bazaar-has-due" className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      id="chk-bazaar-has-due"
                      checked={bazaarHasDue}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setBazaarHasDue(checked);
                        if (checked) {
                          const total = parseFloat(bazaarAmount) || 0;
                          setBazaarPaidAmount('0');
                          setBazaarDueAmount(total > 0 ? String(total) : '0');
                        } else {
                          setBazaarPaidAmount('');
                          setBazaarDueAmount('');
                          setBazaarDueShop('');
                        }
                      }}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Has Shop Due / Credit (দোকান বাকি)?</span>
                  </label>
                  {bazaarHasDue && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 border border-amber-300/60 px-1.5 py-0.2 rounded font-mono">
                      Credit Purchase
                    </span>
                  )}
                </div>

                {bazaarHasDue && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/80 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Cash Paid Now (৳)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={bazaarPaidAmount}
                          onChange={(e) => handlePaidAmountChange(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                          Shop Due / Baki (৳)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Amount due"
                          value={bazaarDueAmount}
                          onChange={(e) => handleDueAmountChange(e.target.value)}
                          className="w-full bg-white border border-amber-300 rounded-md p-2 text-xs font-bold text-amber-900 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Shop / Vendor Name (দোকানের নাম)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bhai Bhai Grocery, Alam Meat Store"
                        value={bazaarDueShop}
                        onChange={(e) => setBazaarDueShop(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <p className="text-[10.5px] text-slate-500 leading-tight">
                      Meals will count the full ৳{bazaarAmount || 0} purchase. Only the cash paid (৳{bazaarPaidAmount || 0}) is deducted from mess cash today. Outstanding due (৳{bazaarDueAmount || 0}) can be adjusted to cash anytime.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                id="btn-submit-bazaar"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add Bazaar Purchase
              </button>

            </form>
          </div>

          {/* Bazaar Ledger List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs p-5 flex flex-col h-[560px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Bazaar Expense History</span>
                  <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {bazaarFilterScope === 'month' 
                      ? `${bazaarCosts.filter(c => c.date.startsWith(settings.currentMonth)).length} items` 
                      : `${bazaarCosts.length} items`}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Total Spent: <strong className="text-slate-700 font-mono">
                    ৳ {bazaarCosts
                        .filter(c => bazaarFilterScope === 'all' || c.date.startsWith(settings.currentMonth))
                        .reduce((acc, c) => acc + c.amount, 0)
                        .toLocaleString('en-IN')}
                  </strong>
                </p>
              </div>

              {/* Scope Switcher */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setBazaarFilterScope('month')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer text-xs ${
                    bazaarFilterScope === 'month'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  This Month ({formatReadableMonth(settings.currentMonth)})
                </button>
                <button
                  type="button"
                  onClick={() => setBazaarFilterScope('all')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer text-xs ${
                    bazaarFilterScope === 'all'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Months ({bazaarCosts.length})
                </button>
              </div>
            </div>
            
            {/* Month-End Special Meal Banner */}
            {monthSpecialMeals.length > 0 ? (
              <div className="mb-3 p-3 bg-purple-50/90 border border-purple-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn shrink-0">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0 mt-0.5">
                    <UtensilsCrossed className="w-4 h-4 text-purple-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-950 uppercase tracking-wide flex items-center gap-1.5">
                        Special Feasts (সমাপনী ফিস্ট)
                      </span>
                      <span className="text-[10px] font-bold bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-full font-mono">
                        {monthSpecialMeals.length} Recorded
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-800 mt-0.5 leading-snug">
                      Total <strong className="font-mono text-purple-950 font-bold">৳ {totalSpecialMealsCost.toLocaleString('en-IN')}</strong> distributed strictly among participants. Excluded from general meal rate!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSpecialMealModal(true)}
                  className="self-start sm:self-auto flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Manage Feasts</span>
                </button>
              </div>
            ) : null}

            {/* Outstanding Shop Dues Summary Banner */}
            {totalPendingBazaarDues > 0 && (
              <div className="mb-3 p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn shrink-0">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Receipt className="w-4 h-4 text-amber-800" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        Outstanding Shop Dues (দোকান বকেয়া)
                      </span>
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full font-mono">
                        {currentMonthBazaars.filter(c => (c.dueAmount || 0) > 0 && !c.isDueSettled).length} Pending
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-snug">
                      Total <strong className="font-mono text-amber-950 font-bold">৳ {totalPendingBazaarDues.toLocaleString('en-IN')}</strong> in grocery/vendor credit. You can adjust items individually or settle all from cash in hand (৳{remainingCash.toLocaleString('en-IN')}).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAdjustAllDuesToCash}
                  className="self-start sm:self-auto flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
                  title="Settle all pending shop dues using mess cash in hand"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Adjust All to Cash</span>
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1">
              {(() => {
                const visibleCosts = bazaarCosts
                  .filter(c => bazaarFilterScope === 'all' || c.date.startsWith(settings.currentMonth))
                  .sort((a, b) => b.date.localeCompare(a.date));

                if (visibleCosts.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 text-xs space-y-2">
                      <ShoppingCart className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <p className="font-medium text-slate-600">No bazaar expenses logged yet</p>
                      <p className="text-[11px] max-w-xs">
                        Use the form on the left to add your first grocery shopping cost for {formatReadableMonth(settings.currentMonth)}.
                      </p>
                    </div>
                  );
                }

                return visibleCosts.map((cost) => {
                  const spender = boarders.find(b => b.id === cost.spentById);
                  const isCurrentMonth = cost.date.startsWith(settings.currentMonth);
                  const hasDue = (cost.dueAmount !== undefined && cost.dueAmount > 0) && !cost.isDueSettled;
                  const isSettled = cost.isDueSettled && cost.settledDate;

                  return (
                    <div key={cost.id} className="py-3 flex items-start justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900 font-mono">৳ {cost.amount.toLocaleString('en-IN')}</span>
                          {cost.isSpecialMeal && (
                            <span className="text-[10px] bg-purple-100 text-purple-900 border border-purple-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 font-mono">
                              <Sparkles className="w-3 h-3 text-purple-600" />
                              স্পেশাল ফিস্ট (মিল রেট মুক্ত)
                            </span>
                          )}
                          {!isCurrentMonth && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                              Other Month
                            </span>
                          )}
                          {hasDue && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                              দোকান বাকি: ৳{cost.dueAmount?.toLocaleString('en-IN')} {cost.dueShopName ? `(${cost.dueShopName})` : ''}
                            </span>
                          )}
                          {isSettled && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-medium flex items-center gap-1 font-mono" title={cost.settledNote || 'Adjusted to cash'}>
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              ক্যাশ সমন্বিত ({formatReadableDate(cost.settledDate!)})
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 font-medium">{cost.description}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                            {formatReadableDate(cost.date)}
                          </span>
                          <span>•</span>
                          <span>Buyer: <strong className="text-slate-600">{spender ? spender.name : 'Mess Cash'}</strong></span>
                          {cost.paidAmount !== undefined && cost.paidAmount < cost.amount && (
                            <>
                              <span>•</span>
                              <span className="text-slate-600 font-mono">নগদ পরিশোধ: ৳{cost.paidAmount.toLocaleString('en-IN')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        {hasDue && (
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustModal(cost)}
                            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                            title="Adjust this shop due to mess cash (ক্যাশ থেকে বকেয়া সমন্বয়)"
                          >
                            <Zap className="w-3 h-3" />
                            <span>Adjust to Cash</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditBazaar(cost)}
                          className="text-slate-400 hover:text-blue-600 p-1.5 rounded-md transition-colors cursor-pointer shrink-0"
                          title="Edit bazaar purchase"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBazaar(cost.id)}
                          className="text-slate-300 hover:text-red-600 p-1.5 rounded-md transition-colors cursor-pointer shrink-0"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

        </div>
      )}

      {/* --- TAB 3: DEPOSITS --- */}
      {activeTab === 'deposits' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Add Deposit Form */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                Log Member Deposit
              </h3>
              <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {formatReadableMonth(settings.currentMonth)}
              </span>
            </div>

            {/* Error & Success Feedback Banners */}
            {depositErrorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{depositErrorMsg}</span>
              </div>
            )}
            {depositSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-medium">{depositSuccessMsg}</span>
              </div>
            )}
            
            <form onSubmit={handleAddDeposit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Depositor Boarder <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={depositBoarderId}
                  onChange={(e) => {
                    setDepositBoarderId(e.target.value);
                    if (depositErrorMsg) setDepositErrorMsg(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">Select Boarder...</option>
                  {boarders.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.roomNo ? ` (${b.roomNo})` : ''} {b.isActive ? '' : '(Inactive)'}
                    </option>
                  ))}
                </select>
                {boarders.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    No boarders found. Please add a boarder in the "Boarders" tab first.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Amount (৳ Taka) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="e.g. 3000"
                    value={depositAmount}
                    onChange={(e) => {
                      setDepositAmount(e.target.value);
                      if (depositErrorMsg) setDepositErrorMsg(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Deposit Date <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatReadableMonth(settings.currentMonth)}
                  </span>
                </div>
                <input
                  type="date"
                  required
                  value={depositDate}
                  onChange={(e) => {
                    setDepositDate(e.target.value);
                    if (depositErrorMsg) setDepositErrorMsg(null);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />

                {/* Quick Date Pickers */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-400">Quick set:</span>
                  <button
                    type="button"
                    onClick={() => setDepositDate(`${settings.currentMonth}-01`)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    1st of Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositDate(`${settings.currentMonth}-15`)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors cursor-pointer"
                  >
                    15th
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepositDate(new Date().toISOString().split('T')[0])}
                    className="text-[10px] px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition-colors cursor-pointer"
                  >
                    Today
                  </button>
                </div>

                {!depositDate.startsWith(settings.currentMonth) && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5 mt-2 leading-tight">
                    Notice: Date ({depositDate}) is outside active calculation month ({settings.currentMonth}). Use the "All Deposits" filter on the right to view it.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Method / Note</label>
                <input
                  type="text"
                  placeholder="e.g. bKash, Cash, Rocket, Bank"
                  value={depositNote}
                  onChange={(e) => setDepositNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                
                {/* Quick tags */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-slate-400">Suggestions:</span>
                  {['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setDepositNote(tag)}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                id="btn-submit-deposit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Record Member Deposit
              </button>

            </form>
          </div>

          {/* Deposits List */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs p-5 flex flex-col h-[560px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span>Deposits Ledger</span>
                  <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {depositFilterScope === 'month' 
                      ? `${deposits.filter(d => d.date.startsWith(settings.currentMonth)).length} records` 
                      : `${deposits.length} records`}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Total Collected: <strong className="text-slate-700 font-mono">
                    ৳ {deposits
                        .filter(d => depositFilterScope === 'all' || d.date.startsWith(settings.currentMonth))
                        .reduce((acc, d) => acc + d.amount, 0)
                        .toLocaleString('en-IN')}
                  </strong>
                </p>
              </div>

              {/* Scope Switcher */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setDepositFilterScope('month')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer text-xs ${
                    depositFilterScope === 'month'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  This Month ({formatReadableMonth(settings.currentMonth)})
                </button>
                <button
                  type="button"
                  onClick={() => setDepositFilterScope('all')}
                  className={`px-3 py-1 font-medium rounded-md transition-colors cursor-pointer text-xs ${
                    depositFilterScope === 'all'
                      ? 'bg-white text-blue-600 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Deposits ({deposits.length})
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 pr-1">
              {(() => {
                const visibleDeposits = deposits
                  .filter(d => depositFilterScope === 'all' || d.date.startsWith(settings.currentMonth))
                  .sort((a, b) => b.date.localeCompare(a.date));

                if (visibleDeposits.length === 0) {
                  return (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 text-xs space-y-2">
                      <DollarSign className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <p className="font-medium text-slate-600">No member deposits recorded yet</p>
                      <p className="text-[11px] max-w-xs">
                        Use the form on the left to record advance cash or digital deposits for {formatReadableMonth(settings.currentMonth)}.
                      </p>
                    </div>
                  );
                }

                return visibleDeposits.map((dep) => {
                  const boarder = boarders.find(b => b.id === dep.boarderId);
                  const isCurrentMonth = dep.date.startsWith(settings.currentMonth);
                  return (
                    <div key={dep.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-blue-700 font-mono">৳ {dep.amount.toLocaleString('en-IN')}</span>
                          <span className="text-xs font-semibold text-slate-800">
                            by {boarder ? boarder.name : 'Unknown Boarder'}
                          </span>
                          {!isCurrentMonth && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                              Other Month
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{dep.note || 'Regular cash deposit'}</p>
                        <div className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded inline-block font-semibold">
                          {formatReadableDate(dep.date)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDeposit(dep)}
                          className="text-slate-400 hover:text-blue-600 p-1.5 rounded-md transition-colors cursor-pointer shrink-0"
                          title="Edit deposit record"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDeposit(dep.id)}
                          className="text-slate-300 hover:text-red-600 p-1.5 rounded-md transition-colors cursor-pointer shrink-0"
                          title="Delete deposit"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

        </div>
      )}

      {/* --- TAB 4: UTILITY & SHARED FIXED BILLS --- */}
      {activeTab === 'fixed' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 animate-fadeIn">
          <div className="max-w-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  Shared Fixed Monthly Expenses
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  These fixed costs are tallied for the entire month and then <strong>divided equally</strong> among all active boarders automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddCustomForm(prev => !prev);
                  setCustomFixedError(null);
                }}
                id="btn-toggle-add-fixed-category"
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddCustomForm ? 'Close Add Form' : 'Add Another Category'}</span>
              </button>
            </div>

            {/* Error & Success Feedback Banners */}
            {customFixedError && (
              <div className="my-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{customFixedError}</span>
              </div>
            )}
            {customFixedSuccess && (
              <div className="my-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-medium">{customFixedSuccess}</span>
              </div>
            )}

            {/* Form to Add New Fixed Category */}
            {showAddCustomForm && (
              <div className="my-5 p-4 bg-slate-50 border border-blue-200 rounded-xl shadow-xs animate-fadeIn">
                <div className="flex items-center justify-between mb-3 border-b border-slate-200/80 pb-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-600" />
                    Add Fixed Bill for Another Category
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddCustomForm(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddCustomBill} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Category Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Waste Disposal, Newspaper, Security"
                        value={newFixedCategoryName}
                        onChange={(e) => {
                          setNewFixedCategoryName(e.target.value);
                          if (customFixedError) setCustomFixedError(null);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Monthly Amount (৳ Taka) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                        <input
                          type="number"
                          required
                          min="0"
                          step="any"
                          placeholder="e.g. 200"
                          value={newFixedCategoryAmount}
                          onChange={(e) => {
                            setNewFixedCategoryAmount(e.target.value);
                            if (customFixedError) setCustomFixedError(null);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Given from Cash Checkbox for Custom Category */}
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      checked={newFixedCategoryPaidFromCash}
                      onChange={(e) => setNewFixedCategoryPaidFromCash(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <span>
                      Given directly from Cash? (ক্যাশ থেকে দেওয়া হয়েছে - deducts from cash in hand)
                    </span>
                  </label>

                  {/* Category Suggestions */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium block mb-1">Quick Suggestions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Waste Disposal / Dustbin',
                        'Newspaper & Magazines',
                        'Security Guard Salary',
                        'Water Jar / Filter',
                        'Generator / Fuel',
                        'Sweeper / Cleaning',
                        'Masjid / Mess Welfare',
                        'Refrigerator Maintenance'
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setNewFixedCategoryName(suggestion)}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-600 transition-colors cursor-pointer"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/60">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomForm(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      id="btn-save-custom-fixed-category"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Save Category
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Cash Flow Impact of Fixed Bills Overview */}
            <div className="my-5 p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 rounded-xl shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Fixed Bills Paid From Cash (ক্যাশ থেকে দেওয়া বিল)
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    Toggle <strong>"Given from Cash"</strong> on any bill below to mark it as disbursed from your physical mess cash. Marked bills are deducted automatically from your cash in hand.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 bg-white border border-slate-200/80 p-2.5 rounded-xl shadow-2xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Bills Paid from Cash:</span>
                    <span className="font-extrabold text-emerald-700 font-mono text-xs sm:text-sm">
                      ৳ {totalFixedBillsPaidFromCash.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="h-7 w-px bg-slate-200" />
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Actual Cash in Hand:</span>
                    <span className={`font-extrabold font-mono text-xs sm:text-sm ${remainingCash >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                      ৳ {remainingCash.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Standard 6 Categories Grid */}
            <div className="mt-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Standard Mess Fixed Bills
                </h4>
                <span className="text-[11px] text-slate-500">
                  {Object.values(miscCosts.paidFromCash || {}).filter(Boolean).length} of 6 paid from cash
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 1. Cooker Bill */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  miscCosts.paidFromCash?.cookerBill
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' 
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <label className="text-xs font-bold text-slate-800">Cooker / Maid Salary</label>
                    <button
                      type="button"
                      onClick={() => handleToggleStandardFixedPaidFromCash('cookerBill', !miscCosts.paidFromCash?.cookerBill)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                        miscCosts.paidFromCash?.cookerBill
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={miscCosts.paidFromCash?.cookerBill ? "Click to mark as unpaid from cash" : "Click to mark as paid from cash"}
                    >
                      <DollarSign className="w-2.5 h-2.5" />
                      <span>{miscCosts.paidFromCash?.cookerBill ? 'Paid from Cash ✓' : 'Given from Cash?'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      value={miscCosts.cookerBill === 0 ? '' : miscCosts.cookerBill}
                      onChange={(e) => handleUpdateStandardFixedCost('cookerBill', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className={miscCosts.paidFromCash?.cookerBill ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {miscCosts.paidFromCash?.cookerBill ? 'Deducted from cash in hand' : 'Not deducted from cash'}
                    </span>
                  </div>
                </div>

                {/* 2. Utility Bill */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  miscCosts.paidFromCash?.utilityBill
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' 
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <label className="text-xs font-bold text-slate-800">Utility Bill (Electricity, Water)</label>
                    <button
                      type="button"
                      onClick={() => handleToggleStandardFixedPaidFromCash('utilityBill', !miscCosts.paidFromCash?.utilityBill)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                        miscCosts.paidFromCash?.utilityBill
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={miscCosts.paidFromCash?.utilityBill ? "Click to mark as unpaid from cash" : "Click to mark as paid from cash"}
                    >
                      <DollarSign className="w-2.5 h-2.5" />
                      <span>{miscCosts.paidFromCash?.utilityBill ? 'Paid from Cash ✓' : 'Given from Cash?'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      value={miscCosts.utilityBill === 0 ? '' : miscCosts.utilityBill}
                      onChange={(e) => handleUpdateStandardFixedCost('utilityBill', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className={miscCosts.paidFromCash?.utilityBill ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {miscCosts.paidFromCash?.utilityBill ? 'Deducted from cash in hand' : 'Not deducted from cash'}
                    </span>
                  </div>
                </div>

                {/* 3. Gas Cylinder Bill */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  miscCosts.paidFromCash?.gasBill
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' 
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <label className="text-xs font-bold text-slate-800">Gas Cylinder Bill</label>
                    <button
                      type="button"
                      onClick={() => handleToggleStandardFixedPaidFromCash('gasBill', !miscCosts.paidFromCash?.gasBill)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                        miscCosts.paidFromCash?.gasBill
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={miscCosts.paidFromCash?.gasBill ? "Click to mark as unpaid from cash" : "Click to mark as paid from cash"}
                    >
                      <DollarSign className="w-2.5 h-2.5" />
                      <span>{miscCosts.paidFromCash?.gasBill ? 'Paid from Cash ✓' : 'Given from Cash?'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      value={miscCosts.gasBill === 0 ? '' : miscCosts.gasBill}
                      onChange={(e) => handleUpdateStandardFixedCost('gasBill', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className={miscCosts.paidFromCash?.gasBill ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {miscCosts.paidFromCash?.gasBill ? 'Deducted from cash in hand' : 'Not deducted from cash'}
                    </span>
                  </div>
                </div>

                {/* 4. WiFi Internet Bill */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  miscCosts.paidFromCash?.wifiBill
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' 
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <label className="text-xs font-bold text-slate-800">WiFi Internet Bill</label>
                    <button
                      type="button"
                      onClick={() => handleToggleStandardFixedPaidFromCash('wifiBill', !miscCosts.paidFromCash?.wifiBill)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                        miscCosts.paidFromCash?.wifiBill
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={miscCosts.paidFromCash?.wifiBill ? "Click to mark as unpaid from cash" : "Click to mark as paid from cash"}
                    >
                      <DollarSign className="w-2.5 h-2.5" />
                      <span>{miscCosts.paidFromCash?.wifiBill ? 'Paid from Cash ✓' : 'Given from Cash?'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      value={miscCosts.wifiBill === 0 ? '' : miscCosts.wifiBill}
                      onChange={(e) => handleUpdateStandardFixedCost('wifiBill', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className={miscCosts.paidFromCash?.wifiBill ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {miscCosts.paidFromCash?.wifiBill ? 'Deducted from cash in hand' : 'Not deducted from cash'}
                    </span>
                  </div>
                </div>

                {/* 5. House Rent */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  miscCosts.paidFromCash?.houseRent
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' 
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <label className="text-xs font-bold text-slate-800">House / Room Rent</label>
                    <button
                      type="button"
                      onClick={() => handleToggleStandardFixedPaidFromCash('houseRent', !miscCosts.paidFromCash?.houseRent)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                        miscCosts.paidFromCash?.houseRent
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={miscCosts.paidFromCash?.houseRent ? "Click to mark as unpaid from cash" : "Click to mark as paid from cash"}
                    >
                      <DollarSign className="w-2.5 h-2.5" />
                      <span>{miscCosts.paidFromCash?.houseRent ? 'Paid from Cash ✓' : 'Given from Cash?'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      value={miscCosts.houseRent === 0 ? '' : miscCosts.houseRent}
                      onChange={(e) => handleUpdateStandardFixedCost('houseRent', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className={miscCosts.paidFromCash?.houseRent ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {miscCosts.paidFromCash?.houseRent ? 'Deducted from cash in hand' : 'Not deducted from cash'}
                    </span>
                  </div>
                </div>

                {/* 6. Other Miscellaneous */}
                <div className={`p-3.5 rounded-xl border transition-all ${
                  miscCosts.paidFromCash?.otherCosts
                    ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' 
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <label className="text-xs font-bold text-slate-800">Other / Miscellaneous</label>
                    <button
                      type="button"
                      onClick={() => handleToggleStandardFixedPaidFromCash('otherCosts', !miscCosts.paidFromCash?.otherCosts)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                        miscCosts.paidFromCash?.otherCosts
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={miscCosts.paidFromCash?.otherCosts ? "Click to mark as unpaid from cash" : "Click to mark as paid from cash"}
                    >
                      <DollarSign className="w-2.5 h-2.5" />
                      <span>{miscCosts.paidFromCash?.otherCosts ? 'Paid from Cash ✓' : 'Given from Cash?'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      min="0"
                      value={miscCosts.otherCosts === 0 ? '' : miscCosts.otherCosts}
                      onChange={(e) => handleUpdateStandardFixedCost('otherCosts', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px]">
                    <span className={miscCosts.paidFromCash?.otherCosts ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {miscCosts.paidFromCash?.otherCosts ? 'Deducted from cash in hand' : 'Not deducted from cash'}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Custom Fixed Categories Section */}
            {miscCosts.customBills && miscCosts.customBills.length > 0 && (
              <div className="mb-6 pt-5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Additional Fixed Bill Categories</span>
                    <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-0.2 rounded-full border border-blue-200">
                      {miscCosts.customBills.length} {miscCosts.customBills.length === 1 ? 'category' : 'categories'}
                    </span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {miscCosts.customBills.filter(b => b.paidFromCash).length} of {miscCosts.customBills.length} paid from cash
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {miscCosts.customBills.map((bill) => (
                    <div 
                      key={bill.id} 
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        bill.paidFromCash 
                          ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' 
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5 gap-2">
                          <label className="block text-xs font-bold text-slate-800 truncate" title={bill.name}>
                            {bill.name}
                          </label>
                          <button
                            type="button"
                            onClick={() => handleToggleCustomBillPaidFromCash(bill.id, !bill.paidFromCash)}
                            className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shrink-0 ${
                              bill.paidFromCash
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title={bill.paidFromCash ? "Click to mark as unpaid from cash" : "Click to mark as paid from cash"}
                          >
                            <DollarSign className="w-2.5 h-2.5" />
                            <span>{bill.paidFromCash ? 'Paid from Cash ✓' : 'Given from Cash?'}</span>
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={bill.amount === 0 ? '' : bill.amount}
                            onChange={(e) => handleUpdateCustomBillAmount(bill.id, parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                            placeholder="0"
                          />
                        </div>
                        <div className="mt-1 text-[9.5px]">
                          <span className={bill.paidFromCash ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                            {bill.paidFromCash ? 'Deducted from cash in hand' : 'Not deducted from cash'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCustomBill(bill.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer self-center"
                        title={`Delete category: ${bill.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Add Banner if empty and form not opened */}
            {(!miscCosts.customBills || miscCosts.customBills.length === 0) && !showAddCustomForm && (
              <div className="mb-6 p-4 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                <p className="text-xs text-slate-500 mb-2">
                  Need to include another shared fixed bill like waste disposal, newspaper, or security guard?
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddCustomForm(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-white border border-blue-200 hover:border-blue-300 px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Fixed Bill for Another Category
                </button>
              </div>
            )}

            {/* Live Calculation Breakdown */}
            <div className="mt-8 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
              <h4 className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                Live Calculation Breakdown
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 text-xs">
                <div>
                  <span className="text-slate-500">Total Fixed Costs</span>
                  <p className="font-bold text-slate-800 mt-0.5">৳ {report.totalFixedCost.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <span className="text-slate-500">Active Members</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {boarders.filter(b => b.isActive).length} active
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-blue-700 font-semibold">Share per Member</span>
                  <p className="font-extrabold text-blue-700 mt-0.5">৳ {report.boardersReport[0]?.fixedCostShare || 0}</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- TAB 5: BOARDERS MANAGEMENT --- */}
      {activeTab === 'boarders' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* Add Boarder Form */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 h-fit">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Register New Boarder</h3>
            
            <form onSubmit={handleAddBoarder} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kazi Jahid"
                  value={newBoarderName}
                  onChange={(e) => setNewBoarderName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Room No / Bed
                </label>
                <input
                  type="text"
                  placeholder="e.g. Room 204 or Bed 3B"
                  value={newBoarderRoomNo}
                  onChange={(e) => setNewBoarderRoomNo(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 01700000000"
                  value={newBoarderPhone}
                  onChange={(e) => setNewBoarderPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Register Boarder
              </button>

            </form>
          </div>

          {/* Boarders List Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Boarders Registry</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 font-bold">Name</th>
                    <th className="py-2.5 font-bold">Room No</th>
                    <th className="py-2.5 font-bold">Contact</th>
                    <th className="py-2.5 font-bold">Status</th>
                    <th className="py-2.5 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {boarders.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50">
                      <td className="py-3">
                        <span className="font-bold text-slate-800">{b.name}</span>
                        <div className="text-[9px] text-slate-400 mt-0.5">Joined: {formatReadableDate(b.joinedDate)}</div>
                      </td>
                      <td className="py-3">
                        {b.roomNo ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 font-mono">
                            {b.roomNo}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </td>
                      <td className="py-3 font-mono text-slate-500">{b.phone || 'N/A'}</td>
                      <td className="py-3">
                        <button
                          onClick={() => handleToggleBoarderActive(b.id)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                            b.isActive 
                              ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                          title="Click to toggle status"
                        >
                          {b.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenEditBoarder(b)}
                          className="text-slate-400 hover:text-blue-600 p-1 rounded-md transition-colors cursor-pointer mr-1.5"
                          title="Edit Boarder details"
                        >
                          <Edit3 className="w-4 h-4 inline-block" />
                        </button>
                        <button
                          onClick={() => handleDeleteBoarder(b.id)}
                          className="text-slate-300 hover:text-red-600 p-1 rounded-md transition-colors cursor-pointer"
                          title="Delete Boarder"
                        >
                          <Trash2 className="w-4 h-4 inline-block" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
              * Inactive boarders do not get billed for shared utility fees or house rent. Use inactive status if a member goes on vacation or leaves temporarily for the entire month.
            </p>
          </div>

        </div>
      )}

      {/* Printable PDF Report Modal */}
      <PrintablePdfReportModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        report={report}
        boarders={boarders}
        deposits={deposits}
        mealLogs={mealLogs}
        bazaarCosts={bazaarCosts}
        miscCosts={miscCosts}
        settings={settings}
      />

      {/* Boarder Daily Meal Sheet PDF Modal */}
      <BoarderMealSheetModal
        isOpen={showMealSheetModal}
        onClose={() => setShowMealSheetModal(false)}
        boarders={boarders}
        mealLogs={mealLogs}
        settings={settings}
        report={report}
      />

      {/* Breakfast 16-Day Attendance Audit & Meal Fine Modal */}
      <BreakfastAuditModal
        isOpen={showBreakfastAuditModal}
        onClose={() => setShowBreakfastAuditModal(false)}
        boarders={boarders}
        mealLogs={mealLogs}
        setMealLogs={setMealLogs}
        settings={settings}
        setSettings={setSettings}
      />

      {/* Special Feast / Month-End Meal Modal */}
      <SpecialMealModal
        isOpen={showSpecialMealModal}
        onClose={() => setShowSpecialMealModal(false)}
        boarders={boarders}
        settings={settings}
        setSettings={setSettings}
        bazaarCosts={bazaarCosts}
        setBazaarCosts={setBazaarCosts}
      />

      {/* Quick Security PIN Modal */}
      {showPinModal && createPortal(
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 py-8 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full my-auto overflow-hidden animate-scaleIn">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Manager Security PIN</h3>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateDashboardPin} className="p-5 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Status:</span>
                {settings.managerPin && settings.managerPin !== '1234' ? (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold text-[11px] flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Custom PIN Configured
                  </span>
                ) : (
                  <span className="text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-semibold text-[11px]">
                    Default PIN Active
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Change Manager PIN
                </label>
                <input
                  type="password"
                  value={dashboardPinInput}
                  onChange={(e) => setDashboardPinInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">Must be at least 4 digits or characters.</p>
              </div>

              {dashboardPinSuccess && (
                <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1 animate-fadeIn">
                  <Check className="w-4 h-4" />
                  PIN updated successfully!
                </p>
              )}

              <div className="flex items-center gap-2 pt-2">
                {settings.managerPin && settings.managerPin !== '1234' && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...settings, managerPin: '1234' };
                      setSettings(updated);
                      setDashboardPinInput('');
                      localStorage.setItem('mess_settings', JSON.stringify(updated));
                      setDashboardPinSuccess(true);
                      setTimeout(() => {
                        setDashboardPinSuccess(false);
                        setShowPinModal(false);
                      }, 1200);
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer underline"
                  >
                    Reset to Default
                  </button>
                )}
                <div className="flex-1 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPinModal(false)}
                    className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs"
                  >
                    Save PIN
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Boarder Modal */}
      {editingBoarder && createPortal(
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 py-8 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full my-auto overflow-hidden animate-scaleIn">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white">Edit Boarder Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBoarder(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedBoarder} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editBoarderName}
                  onChange={(e) => setEditBoarderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Room No / Bed</label>
                <input
                  type="text"
                  value={editBoarderRoomNo}
                  onChange={(e) => setEditBoarderRoomNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editBoarderPhone}
                  onChange={(e) => setEditBoarderPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-edit-active"
                  checked={editBoarderActive}
                  onChange={(e) => setEditBoarderActive(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="chk-edit-active" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Active Member (Billed for utilities & rent)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBoarder(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  Save & Sync Cloud
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Adjust Shop Due to Cash */}
      {adjustingBazaar && createPortal(
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 py-8 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full my-auto shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Adjust Shop Due to Cash (ক্যাশ থেকে সমন্বয়)</h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingBazaar(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAdjustToCash} className="p-5 space-y-4 text-xs">
              
              {/* Purchase Overview Box */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-amber-800">Shopping Details</span>
                    <h4 className="font-bold text-slate-900 text-xs mt-0.5">{adjustingBazaar.description}</h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Date: {formatReadableDate(adjustingBazaar.date)} • Shop: <strong>{adjustingBazaar.dueShopName || 'Local Shop'}</strong>
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    Total: ৳{adjustingBazaar.amount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="border-t border-amber-200/80 pt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Paid at Shopping:</span>
                    <div className="font-bold text-slate-800 font-mono">
                      ৳{(adjustingBazaar.paidAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span className="text-amber-800 font-bold">Outstanding Due:</span>
                    <div className="font-extrabold text-amber-700 font-mono text-sm">
                      ৳{(adjustingBazaar.dueAmount !== undefined ? adjustingBazaar.dueAmount : (adjustingBazaar.amount - (adjustingBazaar.paidAmount || 0))).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cash in Hand Info */}
              <div className="flex items-center justify-between p-2.5 bg-blue-50/60 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-1.5 text-blue-900 font-medium">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                  <span>Available Mess Cash in Hand:</span>
                </div>
                <span className="font-mono font-bold text-blue-700 text-xs">
                  ৳{remainingCash.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Input: Cash Amount to Deduct/Adjust */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cash Amount to Disburse (৳ Taka) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    required
                    min="1"
                    max={adjustingBazaar.dueAmount || adjustingBazaar.amount}
                    step="any"
                    value={adjustCashAmount}
                    onChange={(e) => setAdjustCashAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                  <span>Quick amount:</span>
                  <button
                    type="button"
                    onClick={() => setAdjustCashAmount(String(adjustingBazaar.dueAmount || adjustingBazaar.amount))}
                    className="text-blue-600 font-bold hover:underline cursor-pointer"
                  >
                    Full Due (৳{(adjustingBazaar.dueAmount || adjustingBazaar.amount).toLocaleString('en-IN')})
                  </button>
                </div>
              </div>

              {/* Input: Adjustment Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Settlement Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={adjustCashDate}
                  onChange={(e) => setAdjustCashDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Input: Settlement Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Settlement Note / Voucher (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid in cash to shopkeeper from mess balance"
                  value={adjustCashNote}
                  onChange={(e) => setAdjustCashNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustingBazaar(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdjustingLoading}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{isAdjustingLoading ? 'Adjusting...' : 'Confirm & Deduct Cash'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* --- EDIT BAZAAR PURCHASE MODAL (PORTALED TO BODY) --- */}
      {editingBazaar && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-fadeIn my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Edit Bazaar Purchase</h3>
                  <p className="text-[11px] text-slate-500">Update cost, description, buyer, or shop dues</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingBazaar(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedBazaar} className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Amount & Date in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Amount (৳ Taka) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={editBazaarAmount}
                      onChange={(e) => handleEditBazaarAmountChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Shopping Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editBazaarDate}
                    onChange={(e) => setEditBazaarDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Items / Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Items Purchased / Description <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editBazaarDesc}
                  onChange={(e) => setEditBazaarDesc(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Paid / Spent By */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Spent By (Shopper / Disburser)
                </label>
                <select
                  value={editBazaarBuyer}
                  onChange={(e) => setEditBazaarBuyer(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">Mess Cash in Hand (মেস ক্যাশ তহবিল)</option>
                  {boarders.map(b => (
                    <option key={b.id} value={b.id}>{b.name}{b.roomNo ? ` (${b.roomNo})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Has Due / Credit Section */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editBazaarHasDue}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditBazaarHasDue(checked);
                      if (checked) {
                        const total = parseFloat(editBazaarAmount) || 0;
                        setEditBazaarPaidAmount(String(total));
                        setEditBazaarDueAmount('0');
                      }
                    }}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    দোকান বাকি / বকেয়া ছিল? (Has Shop Due / Credit)
                  </span>
                </label>

                {editBazaarHasDue && (
                  <div className="pt-2 border-t border-slate-200 space-y-3 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        দোকানের নাম (Shop Name)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. ভাই ভাই স্টোর, কাঁচা বাজার"
                        value={editBazaarDueShop}
                        onChange={(e) => setEditBazaarDueShop(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          নগদ পরিশোধ (Paid)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">৳</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editBazaarPaidAmount}
                            onChange={(e) => handleEditBazaarPaidChange(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                          বাকি পরিমাণ (Due)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs font-bold text-amber-500">৳</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editBazaarDueAmount}
                            onChange={(e) => handleEditBazaarDueChange(e.target.value)}
                            className="w-full bg-amber-50/70 border border-amber-300 rounded-lg pl-6 pr-2 py-1.5 text-xs font-bold text-amber-900 focus:ring-1 focus:ring-amber-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBazaar(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>

          </div>
        </div>,
        document.body
      )}

      {/* --- EDIT DEPOSIT MODAL (PORTALED TO BODY) --- */}
      {editingDeposit && createPortal(
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 py-8 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-fadeIn my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Edit Member Deposit</h3>
                  <p className="text-[11px] text-slate-500">Update deposit amount, boarder, or date</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDeposit(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedDeposit} className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Boarder selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deposited By (Boarder) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={editDepositBoarderId}
                  onChange={(e) => setEditDepositBoarderId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="">Select Boarder</option>
                  {boarders.map(b => (
                    <option key={b.id} value={b.id}>{b.name}{b.roomNo ? ` (${b.roomNo})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deposit Amount (৳ Taka) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={editDepositAmount}
                      onChange={(e) => setEditDepositAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deposit Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editDepositDate}
                    onChange={(e) => setEditDepositDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Note / Memo */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Note / Memo (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. bKash payment, Cash advance, 1st installment"
                  value={editDepositNote}
                  onChange={(e) => setEditDepositNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDeposit(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Deposit</span>
                </button>
              </div>
            </form>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
