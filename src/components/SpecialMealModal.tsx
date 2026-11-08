import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  UtensilsCrossed,
  Sparkles,
  Users,
  Calendar,
  DollarSign,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Info,
  CheckCircle2,
  AlertCircle,
  Search,
  CheckSquare,
  Square,
  Receipt
} from 'lucide-react';
import { Boarder, MessSettings, SpecialMeal, BazaarCost } from '../types';
import { formatReadableDate, formatReadableMonth, getDatesInMonth } from '../utils';
import { syncSettingsToFirestore, syncBazaarToFirestore } from '../services/firestoreService';

interface SpecialMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  boarders: Boarder[];
  settings: MessSettings;
  setSettings: React.Dispatch<React.SetStateAction<MessSettings>>;
  bazaarCosts?: BazaarCost[];
  setBazaarCosts?: React.Dispatch<React.SetStateAction<BazaarCost[]>>;
}

export default function SpecialMealModal({
  isOpen,
  onClose,
  boarders,
  settings,
  setSettings,
  bazaarCosts,
  setBazaarCosts,
}: SpecialMealModalProps) {
  if (!isOpen) return null;

  const currentMonth = settings.currentMonth;
  const datesInMonth = useMemo(() => getDatesInMonth(currentMonth), [currentMonth]);
  const lastDateInMonth = datesInMonth[datesInMonth.length - 1] || `${currentMonth}-31`;

  const activeBoarders = useMemo(() => boarders.filter(b => b.isActive), [boarders]);

  // Active month's special meals
  const monthSpecialMeals = useMemo(() => {
    return (settings.specialMeals || []).filter(sm => sm.date.startsWith(currentMonth));
  }, [settings.specialMeals, currentMonth]);

  // Form mode: 'list' | 'add' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'create'>(monthSpecialMeals.length === 0 ? 'create' : 'list');
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('Month-End Grand Feast');
  const [date, setDate] = useState(lastDateInMonth);
  const [costInput, setCostInput] = useState('');
  const [description, setDescription] = useState('');
  const [paidFromCash, setPaidFromCash] = useState(true);
  const [spentById, setSpentById] = useState('');
  const [selectedBoarderIds, setSelectedBoarderIds] = useState<string[]>(() => activeBoarders.map(b => b.id));
  const [boarderSearch, setBoarderSearch] = useState('');

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Live calculation
  const totalCost = parseFloat(costInput) || 0;
  const participantCount = selectedBoarderIds.length;
  const costPerHead = participantCount > 0 ? Number((totalCost / participantCount).toFixed(2)) : 0;

  // Reset form
  const resetForm = () => {
    setTitle('Month-End Grand Feast');
    setDate(lastDateInMonth);
    setCostInput('');
    setDescription('');
    setPaidFromCash(true);
    setSpentById('');
    setSelectedBoarderIds(activeBoarders.map(b => b.id));
    setEditingMealId(null);
  };

  // Open edit for a meal
  const handleStartEdit = (meal: SpecialMeal) => {
    setEditingMealId(meal.id);
    setTitle(meal.title);
    setDate(meal.date);
    setCostInput(String(meal.totalCost));
    setDescription(meal.description || '');
    setPaidFromCash(meal.paidFromCash ?? true);
    setSpentById(meal.spentById || '');
    setSelectedBoarderIds([...meal.participantIds]);
    setViewMode('create');
  };

  // Toggle boarder selection
  const handleToggleBoarder = (id: string) => {
    setSelectedBoarderIds(prev =>
      prev.includes(id) ? prev.filter(bId => bId !== id) : [...prev, id]
    );
  };

  // Select / Deselect all
  const handleSelectAll = () => {
    setSelectedBoarderIds(activeBoarders.map(b => b.id));
  };

  const handleDeselectAll = () => {
    setSelectedBoarderIds([]);
  };

  // Save Special Meal
  const handleSaveMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalCost <= 0) {
      setFeedback({ type: 'error', text: 'Please enter a valid cost greater than 0.' });
      return;
    }
    if (participantCount === 0) {
      setFeedback({ type: 'error', text: 'Please select at least one participating boarder.' });
      return;
    }
    if (!title.trim()) {
      setFeedback({ type: 'error', text: 'Please enter a title for the special meal.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const mealId = editingMealId || `sp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newSpecialMeal: SpecialMeal = {
      id: mealId,
      title: title.trim(),
      date,
      totalCost,
      description: description.trim() || undefined,
      spentById: spentById || undefined,
      paidFromCash,
      participantIds: selectedBoarderIds,
      costPerPerson: costPerHead,
      createdAt: nowIso,
    };

    const currentMeals = settings.specialMeals || [];
    let updatedMeals: SpecialMeal[];

    if (editingMealId) {
      updatedMeals = currentMeals.map(m => m.id === editingMealId ? newSpecialMeal : m);
    } else {
      updatedMeals = [...currentMeals, newSpecialMeal];
    }

    const updatedSettings: MessSettings = {
      ...settings,
      specialMeals: updatedMeals,
    };

    setSettings(updatedSettings);
    localStorage.setItem('mess_settings', JSON.stringify(updatedSettings));
    syncSettingsToFirestore(updatedSettings);

    setFeedback({
      type: 'success',
      text: `Successfully ${editingMealId ? 'updated' : 'added'} "${newSpecialMeal.title}" (৳${totalCost.toLocaleString('en-IN')}) distributed among ${participantCount} boarders (৳${costPerHead}/person). Excluded from regular meal rate!`,
    });

    resetForm();
    setViewMode('list');
    setTimeout(() => setFeedback(null), 5000);
  };

  // Delete Special Meal
  const handleDeleteMeal = (mealId: string, mealTitle: string) => {
    if (!window.confirm(`Delete special meal "${mealTitle}"? This will remove the distributed cost from all participants.`)) {
      return;
    }

    const updatedMeals = (settings.specialMeals || []).filter(m => m.id !== mealId);
    const updatedSettings: MessSettings = {
      ...settings,
      specialMeals: updatedMeals,
    };

    setSettings(updatedSettings);
    localStorage.setItem('mess_settings', JSON.stringify(updatedSettings));
    syncSettingsToFirestore(updatedSettings);

    setFeedback({
      type: 'info',
      text: `Removed "${mealTitle}". Participant balances have been recalculated.`,
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Filter boarders for checklist
  const filteredActiveBoarders = useMemo(() => {
    if (!boarderSearch.trim()) return activeBoarders;
    const q = boarderSearch.toLowerCase().trim();
    return activeBoarders.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.roomNo || '').toLowerCase().includes(q)
    );
  }, [activeBoarders, boarderSearch]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Special Meal & Feast Manager (স্পেশাল ফিস্ট বণ্টন)
                </h2>
                <span className="text-[11px] font-mono font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                  {formatReadableMonth(currentMonth)}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cost of this meal is <strong className="text-slate-800 font-semibold">excluded from the daily meal rate</strong> and distributed strictly among members who ate it.
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

        {/* Feedback message banner */}
        {feedback && (
          <div className={`px-5 py-2.5 text-xs font-medium flex items-center gap-2 border-b animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setViewMode('list'); setEditingMealId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Recorded Feasts ({monthSpecialMeals.length})
            </button>
            <button
              onClick={() => { setViewMode('create'); if (!editingMealId) resetForm(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'create'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{editingMealId ? 'Edit Feast' : 'Add New Special Meal'}</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden sm:block">
            Total Feast Spent: <strong className="text-purple-700 font-bold">৳{monthSpecialMeals.reduce((s, m) => s + m.totalCost, 0).toLocaleString('en-IN')}</strong>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          
          {/* VIEW MODE: LIST */}
          {viewMode === 'list' && (
            <div className="space-y-4">
              {monthSpecialMeals.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                  <UtensilsCrossed className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">No Special Meals Recorded for {formatReadableMonth(currentMonth)}</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
                    Did you eat a special meal on the last day or host a feast? Click <strong>"Add New Special Meal"</strong> to distribute the cost only among participating boarders without inflating the general meal rate.
                  </p>
                  <button
                    onClick={() => { resetForm(); setViewMode('create'); }}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors shadow-2xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Special Meal</span>
                  </button>
                </div>
              ) : (
                monthSpecialMeals.map(meal => {
                  const participants = activeBoarders.filter(b => meal.participantIds.includes(b.id));
                  const nonParticipants = activeBoarders.filter(b => !meal.participantIds.includes(b.id));

                  return (
                    <div
                      key={meal.id}
                      className="border border-purple-200 bg-purple-50/20 rounded-xl p-4.5 space-y-3.5 transition-all shadow-xs"
                    >
                      {/* Top Header of Card */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-slate-900">{meal.title}</h3>
                            <span className="text-[11px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-semibold border border-purple-200">
                              {formatReadableDate(meal.date)}
                            </span>
                            {meal.paidFromCash && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                                Paid from Mess Cash
                              </span>
                            )}
                          </div>
                          {meal.description && (
                            <p className="text-xs text-slate-600 mt-1">{meal.description}</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            onClick={() => handleStartEdit(meal)}
                            className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteMeal(meal.id, meal.title)}
                            className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Stat Breakdown Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-white border border-slate-200 rounded-xl p-3">
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Expense</span>
                          <span className="text-base font-black text-slate-900">৳{meal.totalCost.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Participants</span>
                          <span className="text-base font-black text-purple-700">{meal.participantIds.length} <span className="text-xs font-normal text-slate-500">members</span></span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Cost Per Head</span>
                          <span className="text-base font-black text-emerald-700">৳{meal.costPerPerson.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Regular Meal Rate</span>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                            Not Affected (৳0 added)
                          </span>
                        </div>
                      </div>

                      {/* Participants tags list */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-purple-600" />
                            <span>Participating Members ({participants.length}):</span>
                          </span>
                          {nonParticipants.length > 0 && (
                            <span className="text-[10px] text-slate-400">
                              {nonParticipants.length} non-participants pay ৳0
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {participants.map(p => (
                            <span
                              key={p.id}
                              className="text-[11px] font-medium bg-white text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs"
                            >
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>{p.name}</span>
                              {p.roomNo && <span className="text-[10px] text-slate-400">({p.roomNo})</span>}
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* VIEW MODE: CREATE / EDIT */}
          {viewMode === 'create' && (
            <form onSubmit={handleSaveMeal} className="space-y-5 animate-fadeIn">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Feast / Special Meal Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Month-End Grand Feast / সমাপনী ফিস্ট"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                  {/* Quick title pills */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">Quick suggestions:</span>
                    <button
                      type="button"
                      onClick={() => setTitle('Month-End Grand Feast')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                    >
                      Month-End Feast
                    </button>
                    <button
                      type="button"
                      onClick={() => setTitle('Special Beef & Polao Dinner')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                    >
                      Beef & Polao
                    </button>
                    <button
                      type="button"
                      onClick={() => setTitle('Friday Special Lunch')}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                    >
                      Friday Lunch
                    </button>
                  </div>
                </div>

                {/* Total Cost */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Total Expense Amount (৳ Taka) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="e.g. 3500"
                      value={costInput}
                      onChange={(e) => setCostInput(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    This amount will be completely excluded from the regular meal rate calculation.
                  </p>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Feast Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-slate-400">Quick set:</span>
                    <button
                      type="button"
                      onClick={() => setDate(lastDateInMonth)}
                      className="text-[10px] px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium cursor-pointer"
                    >
                      Last Day ({lastDateInMonth})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(new Date().toISOString().split('T')[0])}
                      className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                    >
                      Today
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Items / Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Beef 4kg, Polao Rice 3kg, Drinks, Curd"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

              </div>

              {/* Paid from Cash Checkbox */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Disbursed directly from Mess Cash in hand?
                  </span>
                  <span className="text-[11px] text-slate-500">
                    If checked, this expense will deduct from remaining physical cash balance.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paidFromCash}
                    onChange={(e) => setPaidFromCash(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Real-time Calculation Summary Card */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-purple-950 uppercase tracking-wider block">
                      Distribution Preview
                    </span>
                    <p className="text-xs text-purple-800">
                      <strong>৳{totalCost.toLocaleString('en-IN')}</strong> ÷ <strong>{participantCount} participants</strong> = <strong className="text-sm font-black text-purple-900">৳{costPerHead.toLocaleString('en-IN')} per head</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right sm:text-right">
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 rounded-full">
                    Regular Meal Rate: ৳0 added
                  </span>
                </div>
              </div>

              {/* Participating Boarders Checklist */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>Select Participating Boarders ({selectedBoarderIds.length} of {activeBoarders.length})</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Check only the boarders who ate this special meal. Non-participating boarders will not be charged.
                    </p>
                  </div>

                  {/* Actions & Search */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                    >
                      Select All ({activeBoarders.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                    >
                      Deselect All
                    </button>
                    <div className="relative w-36 sm:w-44">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search name..."
                        value={boarderSearch}
                        onChange={(e) => setBoarderSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-[11px] focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Grid of Boarders Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
                  {filteredActiveBoarders.map(b => {
                    const isSelected = selectedBoarderIds.includes(b.id);
                    return (
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => handleToggleBoarder(b.id)}
                        className={`p-2.5 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-purple-50 border-purple-300 text-purple-950 font-bold shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-1">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <div className="truncate">
                            <span className="text-xs truncate block">{b.name}</span>
                            {b.roomNo && <span className="text-[10px] text-slate-400 font-normal">{b.roomNo}</span>}
                          </div>
                        </div>

                        {isSelected && totalCost > 0 && participantCount > 0 && (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded shrink-0">
                            +৳{costPerHead}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => { resetForm(); setViewMode('list'); }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingMealId ? 'Update & Save Distribution' : 'Save & Distribute Special Meal'}</span>
                </button>
              </div>

            </form>
          )}

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
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
