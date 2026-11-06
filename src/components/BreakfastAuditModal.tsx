import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Utensils,
  Coffee,
  AlertTriangle,
  CheckCircle2,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  Search,
  Filter,
  Info,
  Scale,
  Sparkles,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { Boarder, DailyMealLog, MessSettings, BreakfastFineRecord } from '../types';
import { formatReadableDate, formatReadableMonth, getDatesInMonth } from '../utils';
import { syncMealLogToFirestore, syncSettingsToFirestore } from '../services/firestoreService';

interface BreakfastAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  boarders: Boarder[];
  mealLogs: DailyMealLog[];
  setMealLogs: React.Dispatch<React.SetStateAction<DailyMealLog[]>>;
  settings: MessSettings;
  setSettings: React.Dispatch<React.SetStateAction<MessSettings>>;
}

export default function BreakfastAuditModal({
  isOpen,
  onClose,
  boarders,
  mealLogs,
  setMealLogs,
  settings,
  setSettings,
}: BreakfastAuditModalProps) {
  if (!isOpen) return null;

  const currentMonth = settings.currentMonth;
  const minRequiredDays = settings.minBreakfastDays || 16;
  const datesInMonth = useMemo(() => getDatesInMonth(currentMonth), [currentMonth]);
  const lastDateInMonth = datesInMonth[datesInMonth.length - 1] || `${currentMonth}-28`;

  // Filter state
  const [filterMode, setFilterMode] = useState<'all' | 'defaulters' | 'compliant' | 'fined'>('defaulters');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTargetDate, setSelectedTargetDate] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return today.startsWith(currentMonth) ? today : lastDateInMonth;
  });
  
  // Custom threshold edit state
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(minRequiredDays.toString());

  // Individual fine inputs: boarderId -> custom fine meals (e.g. 2.0, 2.5)
  const [customFineInputs, setCustomFineInputs] = useState<Record<string, number>>({});

  // Expanded boarders for calendar breakdown
  const [expandedBoarders, setExpandedBoarders] = useState<Record<string, boolean>>({});

  // Feedback banner
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Month-filtered meal logs
  const monthMealLogs = useMemo(() => {
    return mealLogs.filter(log => log.date.startsWith(currentMonth));
  }, [mealLogs, currentMonth]);

  // Existing applied fines for current month
  const currentMonthFines = useMemo(() => {
    return (settings.breakfastFines || []).filter(f => f.month === currentMonth);
  }, [settings.breakfastFines, currentMonth]);

  // Helper to check if a meal count on a day included breakfast
  // Standard convention: Breakfast = 0.5, Lunch = 1.0, Dinner = 1.0 -> Breakfast included when meals % 1 === 0.5 or meals === 0.5
  const hasBreakfast = (mealCount: number | undefined): boolean => {
    if (!mealCount || mealCount <= 0) return false;
    const rem = Number((mealCount % 1).toFixed(2));
    return rem >= 0.45 && rem <= 0.55;
  };

  // Compute breakfast attendance for each active boarder
  const auditData = useMemo(() => {
    const activeBoarders = boarders.filter(b => b.isActive);

    return activeBoarders.map(boarder => {
      // Find days breakfast was taken
      const attendedDates: string[] = [];
      const skippedDates: string[] = [];

      datesInMonth.forEach(dateStr => {
        const log = monthMealLogs.find(l => l.date === dateStr);
        const mealCount = log?.meals[boarder.id] || 0;
        if (hasBreakfast(mealCount)) {
          attendedDates.push(dateStr);
        } else {
          skippedDates.push(dateStr);
        }
      });

      const breakfastDays = attendedDates.length;
      const shortfallDays = Math.max(0, minRequiredDays - breakfastDays);
      const isBelowMinimum = breakfastDays < minRequiredDays;
      
      // Recommended meal fine: shortfall * 0.5 meals (since 1 breakfast = 0.5 meal)
      const recommendedFineMeals = Number((shortfallDays * 0.5).toFixed(1));

      // Check if fine is already recorded for this boarder in current month
      const appliedFine = currentMonthFines.find(f => f.boarderId === boarder.id);

      return {
        boarder,
        breakfastDays,
        shortfallDays,
        isBelowMinimum,
        recommendedFineMeals,
        attendedDates,
        skippedDates,
        appliedFine,
      };
    });
  }, [boarders, datesInMonth, monthMealLogs, minRequiredDays, currentMonthFines]);

  // Stats
  const totalActive = auditData.length;
  const defaultersList = useMemo(() => auditData.filter(d => d.isBelowMinimum), [auditData]);
  const compliantList = useMemo(() => auditData.filter(d => !d.isBelowMinimum), [auditData]);
  const finedList = useMemo(() => auditData.filter(d => d.appliedFine !== undefined), [auditData]);

  // Filtered view
  const displayedBoarders = useMemo(() => {
    return auditData.filter(item => {
      // Filter tab
      if (filterMode === 'defaulters' && !item.isBelowMinimum) return false;
      if (filterMode === 'compliant' && item.isBelowMinimum) return false;
      if (filterMode === 'fined' && !item.appliedFine) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.boarder.name.toLowerCase().includes(q);
        const matchesRoom = (item.boarder.roomNo || '').toLowerCase().includes(q);
        const matchesPhone = (item.boarder.phone || '').toLowerCase().includes(q);
        return matchesName || matchesRoom || matchesPhone;
      }

      return true;
    });
  }, [auditData, filterMode, searchQuery]);

  // Save minimum threshold update
  const handleSaveThreshold = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(thresholdInput, 10);
    if (isNaN(val) || val <= 0 || val > 31) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid threshold between 1 and 31 days.' });
      return;
    }
    const updated = { ...settings, minBreakfastDays: val };
    setSettings(updated);
    localStorage.setItem('mess_settings', JSON.stringify(updated));
    syncSettingsToFirestore(updated);
    setIsEditingThreshold(false);
    setFeedbackMsg({ type: 'success', text: `Minimum breakfast target updated to ${val} days.` });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Toggle calendar detail expansion
  const toggleExpand = (boarderId: string) => {
    setExpandedBoarders(prev => ({
      ...prev,
      [boarderId]: !prev[boarderId]
    }));
  };

  // Apply fine to a specific boarder
  const handleApplyFine = (item: (typeof auditData)[0], customMeals?: number) => {
    const fineAmount = customMeals !== undefined 
      ? customMeals 
      : (customFineInputs[item.boarder.id] !== undefined ? customFineInputs[item.boarder.id] : item.recommendedFineMeals);

    if (fineAmount <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Meal fine amount must be greater than 0.' });
      return;
    }

    const fineDate = selectedTargetDate;
    const nowIso = new Date().toISOString();

    // 1. Prepare new fine record
    const newFineRecord: BreakfastFineRecord = {
      id: `fine_${item.boarder.id}_${currentMonth}_${Date.now()}`,
      boarderId: item.boarder.id,
      month: currentMonth,
      breakfastDays: item.breakfastDays,
      shortfallDays: item.shortfallDays,
      fineMeals: fineAmount,
      dateApplied: fineDate,
      appliedAt: nowIso,
      note: `Breakfast shortfall fine (${item.breakfastDays}/${minRequiredDays} days, ${item.shortfallDays} days short)`
    };

    // 2. Update meal log on fineDate
    const existingLog = mealLogs.find(l => l.date === fineDate);
    const prevMeals = existingLog ? { ...existingLog.meals } : {};
    const currentBoarderMeals = prevMeals[item.boarder.id] || 0;
    const updatedBoarderMeals = Number((currentBoarderMeals + fineAmount).toFixed(2));
    const updatedMeals = { ...prevMeals, [item.boarder.id]: updatedBoarderMeals };

    // Update note on the day to document the fine
    const fineNoteTag = `[Breakfast Fine: +${fineAmount}m for ${item.boarder.name}]`;
    const updatedNote = existingLog?.note
      ? (existingLog.note.includes(fineNoteTag) ? existingLog.note : `${existingLog.note} ${fineNoteTag}`.trim())
      : fineNoteTag;

    const updatedLog: DailyMealLog = {
      date: fineDate,
      meals: updatedMeals,
      note: updatedNote,
      updatedAt: nowIso
    };

    setMealLogs(prev => {
      const exists = prev.some(l => l.date === fineDate);
      if (exists) {
        return prev.map(l => l.date === fineDate ? updatedLog : l);
      } else {
        return [...prev, updatedLog];
      }
    });
    syncMealLogToFirestore(updatedLog);

    // 3. Update settings.breakfastFines
    const otherFines = (settings.breakfastFines || []).filter(
      f => !(f.boarderId === item.boarder.id && f.month === currentMonth)
    );
    const updatedFines = [...otherFines, newFineRecord];
    const updatedSettings: MessSettings = {
      ...settings,
      breakfastFines: updatedFines
    };
    setSettings(updatedSettings);
    localStorage.setItem('mess_settings', JSON.stringify(updatedSettings));
    syncSettingsToFirestore(updatedSettings);

    setFeedbackMsg({
      type: 'success',
      text: `Successfully applied meal fine of +${fineAmount} meals to ${item.boarder.name} on ${formatReadableDate(fineDate)}!`
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Batch apply fine to all defaulters who haven't been fined yet
  const handleBatchApplyFines = () => {
    const pendingDefaulters = defaultersList.filter(d => !d.appliedFine);
    if (pendingDefaulters.length === 0) {
      setFeedbackMsg({ type: 'info', text: 'All defaulters already have meal fines applied.' });
      return;
    }

    if (!window.confirm(`Apply breakfast shortfall meal fines for ${pendingDefaulters.length} boarder(s) on ${formatReadableDate(selectedTargetDate)}?`)) {
      return;
    }

    const fineDate = selectedTargetDate;
    const nowIso = new Date().toISOString();

    // Work on target day log
    const existingLog = mealLogs.find(l => l.date === fineDate);
    const updatedMeals = existingLog ? { ...existingLog.meals } : {};
    const fineTags: string[] = [];

    const newFineRecords: BreakfastFineRecord[] = [];

    pendingDefaulters.forEach(item => {
      const fineAmount = customFineInputs[item.boarder.id] !== undefined
        ? customFineInputs[item.boarder.id]
        : item.recommendedFineMeals;

      if (fineAmount > 0) {
        const cur = updatedMeals[item.boarder.id] || 0;
        updatedMeals[item.boarder.id] = Number((cur + fineAmount).toFixed(2));
        fineTags.push(`+${fineAmount}m (${item.boarder.name})`);

        newFineRecords.push({
          id: `fine_${item.boarder.id}_${currentMonth}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          boarderId: item.boarder.id,
          month: currentMonth,
          breakfastDays: item.breakfastDays,
          shortfallDays: item.shortfallDays,
          fineMeals: fineAmount,
          dateApplied: fineDate,
          appliedAt: nowIso,
          note: `Breakfast shortfall fine (${item.breakfastDays}/${minRequiredDays} days)`
        });
      }
    });

    const appendedNote = fineTags.length > 0 ? `[Breakfast Fines: ${fineTags.join(', ')}]` : '';
    const updatedNote = existingLog?.note
      ? `${existingLog.note} ${appendedNote}`.trim()
      : appendedNote;

    const updatedLog: DailyMealLog = {
      date: fineDate,
      meals: updatedMeals,
      note: updatedNote,
      updatedAt: nowIso
    };

    setMealLogs(prev => {
      const exists = prev.some(l => l.date === fineDate);
      if (exists) {
        return prev.map(l => l.date === fineDate ? updatedLog : l);
      } else {
        return [...prev, updatedLog];
      }
    });
    syncMealLogToFirestore(updatedLog);

    // Save fine records in settings
    const existingOtherFines = (settings.breakfastFines || []).filter(
      f => !pendingDefaulters.some(p => p.boarder.id === f.boarderId && f.month === currentMonth)
    );
    const updatedSettings: MessSettings = {
      ...settings,
      breakfastFines: [...existingOtherFines, ...newFineRecords]
    };
    setSettings(updatedSettings);
    localStorage.setItem('mess_settings', JSON.stringify(updatedSettings));
    syncSettingsToFirestore(updatedSettings);

    setFeedbackMsg({
      type: 'success',
      text: `Successfully applied meal fines to ${pendingDefaulters.length} boarders on ${formatReadableDate(fineDate)}!`
    });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Revoke / Undo an applied fine
  const handleRevokeFine = (fine: BreakfastFineRecord, boarderName: string) => {
    if (!window.confirm(`Undo meal fine of ${fine.fineMeals} meals for ${boarderName}? This will deduct ${fine.fineMeals} meals from ${formatReadableDate(fine.dateApplied)}.`)) {
      return;
    }

    const fineDate = fine.dateApplied;
    const targetLog = mealLogs.find(l => l.date === fineDate);

    if (targetLog) {
      const curMeals = targetLog.meals[fine.boarderId] || 0;
      const revisedMeals = Math.max(0, Number((curMeals - fine.fineMeals).toFixed(2)));
      const updatedMeals = { ...targetLog.meals, [fine.boarderId]: revisedMeals };
      const nowIso = new Date().toISOString();

      const updatedLog: DailyMealLog = {
        ...targetLog,
        meals: updatedMeals,
        updatedAt: nowIso
      };

      setMealLogs(prev => prev.map(l => l.date === fineDate ? updatedLog : l));
      syncMealLogToFirestore(updatedLog);
    }

    // Remove from settings
    const updatedFines = (settings.breakfastFines || []).filter(f => f.id !== fine.id);
    const updatedSettings = { ...settings, breakfastFines: updatedFines };
    setSettings(updatedSettings);
    localStorage.setItem('mess_settings', JSON.stringify(updatedSettings));
    syncSettingsToFirestore(updatedSettings);

    setFeedbackMsg({
      type: 'info',
      text: `Revoked fine of ${fine.fineMeals} meals for ${boarderName}.`
    });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
              <Coffee className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Breakfast Audit & Minimum Meal Penalty
                </h2>
                <span className="text-[11px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  {formatReadableMonth(currentMonth)}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Rule: Boarders must eat breakfast on at least <strong className="text-slate-800 font-semibold">{minRequiredDays} days</strong> per month.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div className={`px-5 py-2.5 text-xs font-medium flex items-center gap-2 border-b animate-fadeIn ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : feedbackMsg.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedbackMsg.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            {/* Rule Target Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rule Threshold</span>
                <button
                  onClick={() => setIsEditingThreshold(!isEditingThreshold)}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                >
                  {isEditingThreshold ? 'Cancel' : 'Change'}
                </button>
              </div>
              {isEditingThreshold ? (
                <form onSubmit={handleSaveThreshold} className="mt-2 flex items-center gap-1.5">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-bold cursor-pointer hover:bg-blue-700"
                  >
                    Save
                  </button>
                </form>
              ) : (
                <div className="mt-1">
                  <span className="text-xl font-black text-slate-800">{minRequiredDays}</span>
                  <span className="text-xs text-slate-500 font-medium"> days min</span>
                </div>
              )}
              <span className="text-[10px] text-slate-400 mt-1">Breakfast = 0.5 meal</span>
            </div>

            {/* Below 16 Days (Defaulters) */}
            <div className={`border rounded-xl p-3.5 flex flex-col justify-between ${
              defaultersList.length > 0 
                ? 'bg-rose-50/70 border-rose-200' 
                : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className={`w-3 h-3 ${defaultersList.length > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
                Below {minRequiredDays} Days
              </span>
              <div className="mt-1">
                <span className={`text-xl font-black ${defaultersList.length > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                  {defaultersList.length}
                </span>
                <span className="text-xs text-slate-500 font-medium"> / {totalActive} members</span>
              </div>
              <span className={`text-[10px] font-medium ${defaultersList.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                {defaultersList.length > 0 ? 'Requires meal fine penalty' : 'All members compliant'}
              </span>
            </div>

            {/* Compliant Boarders */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Passed ({minRequiredDays}+ Days)
              </span>
              <div className="mt-1">
                <span className="text-xl font-black text-emerald-700">{compliantList.length}</span>
                <span className="text-xs text-slate-500 font-medium"> members</span>
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">
                {totalActive > 0 ? `${Math.round((compliantList.length / totalActive) * 100)}% pass rate` : '0%'}
              </span>
            </div>

            {/* Fines Applied */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Scale className="w-3 h-3 text-amber-600" />
                Fines Applied
              </span>
              <div className="mt-1">
                <span className="text-xl font-black text-amber-800">{finedList.length}</span>
                <span className="text-xs text-slate-500 font-medium"> boarders</span>
              </div>
              <span className="text-[10px] text-amber-700 font-medium">
                Total: +{currentMonthFines.reduce((s, f) => s + f.fineMeals, 0)} fine meals
              </span>
            </div>

          </div>

          {/* Action Bar & Date Selector */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Fine Target Date Picker */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  Target Date to Add Penalty Meals:
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    type="date"
                    value={selectedTargetDate}
                    onChange={(e) => setSelectedTargetDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <span className="text-[10px] text-slate-400">
                    (Usually month-end date: {lastDateInMonth})
                  </span>
                </div>
              </div>
            </div>

            {/* Batch Action */}
            {defaultersList.filter(d => !d.appliedFine).length > 0 && (
              <button
                onClick={handleBatchApplyFines}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors shadow-xs shrink-0"
                title="Batch apply recommended meal fine to all pending defaulters"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply Fines to All {defaultersList.filter(d => !d.appliedFine).length} Defaulters</span>
              </button>
            )}

          </div>

          {/* Filter Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setFilterMode('defaulters')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  filterMode === 'defaulters'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Below {minRequiredDays} Days ({defaultersList.length})</span>
              </button>

              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Members ({totalActive})
              </button>

              <button
                onClick={() => setFilterMode('compliant')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterMode === 'compliant'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Passed ({compliantList.length})
              </button>

              <button
                onClick={() => setFilterMode('fined')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  filterMode === 'fined'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Fined ({finedList.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search boarder name or room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-3">
            {displayedBoarders.length === 0 ? (
              <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                <Coffee className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium">No boarders match the selected criteria.</p>
                {filterMode === 'defaulters' && (
                  <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
                    Great news! Every active boarder has met the minimum {minRequiredDays}-day breakfast rule!
                  </p>
                )}
              </div>
            ) : (
              displayedBoarders.map(item => {
                const isExpanded = !!expandedBoarders[item.boarder.id];
                const pct = Math.min(100, Math.round((item.breakfastDays / minRequiredDays) * 100));
                const currentFineInput = customFineInputs[item.boarder.id] !== undefined 
                  ? customFineInputs[item.boarder.id] 
                  : item.recommendedFineMeals;

                return (
                  <div
                    key={item.boarder.id}
                    className={`border rounded-xl transition-all ${
                      item.isBelowMinimum
                        ? item.appliedFine
                          ? 'border-amber-200 bg-amber-50/20'
                          : 'border-rose-200 bg-rose-50/15'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {/* Main Row */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      
                      {/* Boarder Info & Progress */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-900">{item.boarder.name}</h4>
                          {item.boarder.roomNo && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                              {item.boarder.roomNo}
                            </span>
                          )}
                          {item.boarder.phone && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.boarder.phone}
                            </span>
                          )}

                          {/* Status Badge */}
                          {item.isBelowMinimum ? (
                            item.appliedFine ? (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-amber-600" />
                                Fine Applied (+{item.appliedFine.fineMeals} meals)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                {item.shortfallDays} Days Short
                              </span>
                            )
                          ) : (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Rule Met ({item.breakfastDays} days)
                            </span>
                          )}
                        </div>

                        {/* Progress Bar & Days Count */}
                        <div className="mt-2.5 max-w-md">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-slate-700">
                              Breakfast Attended: <strong className="text-slate-900 font-bold">{item.breakfastDays}</strong> / {minRequiredDays} days
                            </span>
                            <span className={`font-bold ${
                              item.isBelowMinimum ? 'text-rose-600' : 'text-emerald-700'
                            }`}>
                              {pct}%
                            </span>
                          </div>
                          
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                item.isBelowMinimum
                                  ? pct < 50 ? 'bg-rose-500' : 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        {/* Expandable Breakdown Trigger */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.boarder.id)}
                          className="mt-2 text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Hide Calendar Days Breakdown</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>View Attended & Missed Dates ({item.breakfastDays} of {datesInMonth.length} days)</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right Action / Fine Controls */}
                      <div className="shrink-0 flex items-center gap-3">
                        {item.appliedFine ? (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                            <div className="text-left">
                              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                                Fine Recorded
                              </span>
                              <p className="text-xs font-bold text-amber-900">
                                +{item.appliedFine.fineMeals} meals on {formatReadableDate(item.appliedFine.dateApplied)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRevokeFine(item.appliedFine!, item.boarder.name)}
                              className="flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer"
                              title="Undo/revoke this fine"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Undo Fine</span>
                            </button>
                          </div>
                        ) : item.isBelowMinimum ? (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Penalty Meals:
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0.5"
                                  value={currentFineInput}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setCustomFineInputs(prev => ({
                                      ...prev,
                                      [item.boarder.id]: val
                                    }));
                                  }}
                                  className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-800 focus:ring-1 focus:ring-rose-500"
                                  title="Customizable fine meal count"
                                />
                                <span className="text-xs font-semibold text-slate-600">meals</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleApplyFine(item, currentFineInput)}
                              className="mt-1 sm:mt-0 flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors shadow-xs"
                              title={`Apply fine of +${currentFineInput} meals on ${selectedTargetDate}`}
                            >
                              <Scale className="w-3.5 h-3.5" />
                              <span>Apply Fine (+{currentFineInput}m)</span>
                            </button>
                          </div>
                        ) : (
                          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Compliant</span>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* Detailed Day-by-day Breakdown Accordion */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-100 bg-slate-50/70 rounded-b-xl space-y-3 animate-fadeIn">
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span className="font-semibold">
                            Full Calendar Breakfast Audit for {formatReadableMonth(currentMonth)}:
                          </span>
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="flex items-center gap-1 text-emerald-700 font-bold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Ate Breakfast ({item.attendedDates.length})
                            </span>
                            <span className="flex items-center gap-1 text-slate-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-slate-300" />
                              No Breakfast ({item.skippedDates.length})
                            </span>
                          </div>
                        </div>

                        {/* Calendar Day Grid */}
                        <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-16 gap-1.5">
                          {datesInMonth.map((dateStr) => {
                            const dayNum = parseInt(dateStr.split('-')[2], 10);
                            const didEat = item.attendedDates.includes(dateStr);
                            const dayLog = monthMealLogs.find(l => l.date === dateStr);
                            const count = dayLog?.meals[item.boarder.id] || 0;

                            return (
                              <div
                                key={dateStr}
                                title={`${formatReadableDate(dateStr)}: ${count} meals logged ${didEat ? '(Breakfast Included)' : '(No Breakfast)'}`}
                                className={`p-1.5 rounded-lg border text-center transition-all ${
                                  didEat
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold shadow-2xs'
                                    : 'bg-white border-slate-200 text-slate-400 font-normal'
                                }`}
                              >
                                <div className="text-[9px] uppercase font-mono">{dayNum}</div>
                                <div className="text-[10px] font-bold mt-0.5">
                                  {count > 0 ? `${count}m` : '-'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>

          {/* Informational Footer Note */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-500">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-700">How Meal Fines Work in Mess Master:</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Standard daily meal allocation: Breakfast = 0.5 meal, Lunch = 1.0 meal, Dinner = 1.0 meal. Any day where meals include a 0.5 fraction (0.5, 1.5, 2.5) counts as breakfast eaten.
                When you click <strong>Apply Fine</strong>, the penalty meals are added to that boarder's record on the selected target date (e.g. month-end), which updates their total monthly meals and calculates their billing balance automatically.
              </p>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            Active Month: <strong className="text-slate-800 font-semibold">{formatReadableMonth(currentMonth)}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-2xs"
          >
            Close Audit
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
