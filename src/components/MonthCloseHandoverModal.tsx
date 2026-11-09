import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Receipt, 
  Calendar, 
  UserCheck, 
  Coins, 
  KeyRound, 
  AlertCircle, 
  FileText, 
  Lock,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { 
  Boarder, 
  MonthReport, 
  MessSettings, 
  Deposit, 
  MonthClosureRecord,
  MiscellaneousCosts 
} from '../types';
import { formatReadableMonth } from '../utils';

interface MonthCloseHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: MonthReport;
  boarders: Boarder[];
  settings: MessSettings;
  miscCosts: MiscellaneousCosts;
  onConfirmHandover: (payload: {
    closureRecord: MonthClosureRecord;
    nextMonth: string;
    newManagerName: string;
    newManagerPhone?: string;
    newManagerPin?: string;
    carryForwardDeposits?: Deposit[];
    updatedMiscCosts?: MiscellaneousCosts;
  }) => void;
  onOpenPdfModal?: () => void;
}

export default function MonthCloseHandoverModal({
  isOpen,
  onClose,
  report,
  boarders,
  settings,
  miscCosts,
  onConfirmHandover,
  onOpenPdfModal,
}: MonthCloseHandoverModalProps) {
  const activeMonthStr = formatReadableMonth(report.month);

  // Compute next month default string (e.g. "2026-11" -> "2026-12", "2026-12" -> "2027-01")
  const defaultNextMonth = useMemo(() => {
    const [yearStr, monthStr] = report.month.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    return `${year}-${month < 10 ? '0' + month : month}`;
  }, [report.month]);

  // Financial metrics
  const grandTotalSpent = report.totalBazaarCost + report.totalFixedCost + (report.totalSpecialMealCost || 0);
  const netMessBalance = Number((report.totalDeposits - grandTotalSpent).toFixed(2));
  const surplusBoarders = report.boardersReport.filter(b => b.balance > 0);
  const dueBoarders = report.boardersReport.filter(b => b.balance < 0);
  const totalSurplus = surplusBoarders.reduce((acc, b) => acc + b.balance, 0);
  const totalDues = Math.abs(dueBoarders.reduce((acc, b) => acc + b.balance, 0));

  // Form states
  const [outgoingManagerName, setOutgoingManagerName] = useState(
    settings.currentManagerName || 'Outgoing Manager'
  );
  const [outgoingManagerPhone, setOutgoingManagerPhone] = useState(
    settings.currentManagerPhone || ''
  );

  const [selectedBoarderId, setSelectedBoarderId] = useState<string>('');
  const [incomingManagerName, setIncomingManagerName] = useState('');
  const [incomingManagerPhone, setIncomingManagerPhone] = useState('');

  const [settlementType, setSettlementType] = useState<'carried_forward' | 'cash_settled'>('carried_forward');
  const [cashHandoverAmount, setCashHandoverAmount] = useState<number>(
    netMessBalance > 0 ? netMessBalance : 0
  );
  const [nextMonth, setNextMonth] = useState(defaultNextMonth);
  const [changePin, setChangePin] = useState(false);
  const [newManagerPin, setNewManagerPin] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  if (!isOpen) return null;

  // Handle boarder selection
  const handleSelectBoarder = (boarderId: string) => {
    setSelectedBoarderId(boarderId);
    if (!boarderId) return;
    const b = boarders.find(item => item.id === boarderId);
    if (b) {
      setIncomingManagerName(b.name);
      if (b.phone) setIncomingManagerPhone(b.phone);
    }
  };

  const handleProceedToStep2 = () => {
    if (!incomingManagerName.trim()) {
      alert('Please enter or select the incoming new manager name.');
      return;
    }
    setStep(2);
  };

  const handleFinalSubmit = () => {
    if (!confirmationChecked) {
      alert('Please confirm that the monthly calculations and handover information are accurate.');
      return;
    }

    try {
      setIsSubmitting(true);

      const closureRecord: MonthClosureRecord = {
        id: `closure_${report.month}_${Date.now()}`,
        month: report.month,
        closedAt: new Date().toISOString(),
        outgoingManagerName: outgoingManagerName.trim() || 'Mess Manager',
        outgoingManagerPhone: outgoingManagerPhone.trim() || undefined,
        incomingManagerName: incomingManagerName.trim(),
        incomingManagerPhone: incomingManagerPhone.trim() || undefined,
        incomingManagerBoarderId: selectedBoarderId || undefined,
        totalMeals: report.totalMeals,
        totalBazaarCost: report.totalBazaarCost,
        totalSpecialMealCost: report.totalSpecialMealCost || 0,
        mealRate: report.mealRate,
        totalFixedCost: report.totalFixedCost,
        totalDeposits: report.totalDeposits,
        netMessBalance,
        cashHandoverAmount: Number(cashHandoverAmount) || 0,
        balanceSettlementType: settlementType,
        handoverNotes: handoverNotes.trim() || undefined,
      };

      // Prepare carryover deposits if option A is chosen
      let carryForwardDeposits: Deposit[] | undefined = undefined;
      if (settlementType === 'carried_forward') {
        carryForwardDeposits = report.boardersReport
          .filter(b => b.balance !== 0)
          .map(b => {
            const isCredit = b.balance > 0;
            return {
              id: `carry_${report.month}_${b.boarderId}_${Date.now().toString().slice(-4)}`,
              boarderId: b.boarderId,
              amount: b.balance, // positive or negative opening balance
              date: `${nextMonth}-01`,
              note: isCredit
                ? `পূর্ববর্তী মাসের উদ্বৃত্ত / Opening Surplus from ${formatReadableMonth(report.month)}`
                : `পূর্ববর্তী মাসের বকেয়া / Opening Due from ${formatReadableMonth(report.month)}`,
              createdAt: new Date().toISOString(),
            };
          });
      }

      // Reset cash paid checklist for the fresh new month
      const updatedMiscCosts: MiscellaneousCosts = {
        ...miscCosts,
        paidFromCash: {},
      };

      onConfirmHandover({
        closureRecord,
        nextMonth,
        newManagerName: incomingManagerName.trim(),
        newManagerPhone: incomingManagerPhone.trim() || undefined,
        newManagerPin: changePin && newManagerPin.trim().length >= 4 ? newManagerPin.trim() : undefined,
        carryForwardDeposits,
        updatedMiscCosts,
      });

      onClose();
    } catch (err) {
      console.error('Error executing month closure and handover:', err);
      alert('Could not complete handover. Please check all fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn">
        
        {/* Top Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Month Closing & Manager Handover
                </h2>
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-mono">
                  {activeMonthStr}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                মাস সমাপ্তি, হিসাব ক্লোজিং ও পরবর্তী ম্যানেজারের নিকট দায়িত্ব হস্তান্তর
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800 flex-1">
          
          {/* STEP 1: REVIEW AUDIT & ENTER NEW MANAGER */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Financial Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    1. Outgoing Final Statement ({activeMonthStr})
                  </h3>
                  {onOpenPdfModal && (
                    <button
                      type="button"
                      onClick={onOpenPdfModal}
                      className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Audit PDF
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Meals</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{report.totalMeals.toFixed(1)}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Meal Rate</span>
                    <span className="text-sm font-bold text-blue-700 mt-0.5 block">৳ {report.mealRate.toFixed(4)}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Total Spent</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">৳ {grandTotalSpent.toLocaleString('en-IN')}</span>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${
                    netMessBalance >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <span className="text-[10px] font-semibold uppercase block">
                      {netMessBalance >= 0 ? 'Cash in Hand (Surplus)' : 'Mess Deficit'}
                    </span>
                    <span className="text-sm font-black mt-0.5 block">
                      {netMessBalance >= 0 ? '+' : ''}৳ {netMessBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Member balances snapshot */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 text-[11px] text-slate-600">
                  <span>
                    👥 <strong>{report.boardersReport.length}</strong> Total Boarders
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-700 font-medium">
                      🟢 {surplusBoarders.length} with Refunds (+৳{totalSurplus.toFixed(0)})
                    </span>
                    <span className="text-rose-700 font-medium">
                      🔴 {dueBoarders.length} with Dues (-৳{totalDues.toFixed(0)})
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement Method Choice */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  2. Boarder Balance Settlement for New Month (বোর্ডারদের ব্যালেন্স সমন্বয়)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    settlementType === 'carried_forward' 
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="settlementType"
                      checked={settlementType === 'carried_forward'}
                      onChange={() => setSettlementType('carried_forward')}
                      className="mt-0.5 text-blue-600 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Carry Forward to Next Month (Recommended)
                      </span>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        বোর্ডারদের উদ্ধৃত্ত ব্যালেন্স নতুন মাসের ১ তারিখে জমা হিসেবে এবং বকেয়া বকেয়া হিসেবে স্বয়ংক্রিয়ভাবে স্থানান্তরিত হবে।
                      </p>
                    </div>
                  </label>

                  <label className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    settlementType === 'cash_settled' 
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}>
                    <input
                      type="radio"
                      name="settlementType"
                      checked={settlementType === 'cash_settled'}
                      onChange={() => setSettlementType('cash_settled')}
                      className="mt-0.5 text-blue-600 cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-xs text-slate-900 block flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-emerald-600" />
                        Cash Settled (নগদে সম্পূর্ণ নিষ্পত্তি)
                      </span>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        বিদায়ী ম্যানেজার নগদ টাকায় সমস্ত পাওনা/বকেয়া পরিশোধ ও গ্রহণ করবেন। নতুন মাসে সবার ব্যালেন্স ০ থেকে শুরু হবে।
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Handover Details */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  3. New Incoming Manager Appointment (নতুন ম্যানেজার নির্বাচন)
                </label>

                {/* Select boarder */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Select New Manager from Active Boarders
                  </label>
                  <select
                    value={selectedBoarderId}
                    onChange={(e) => handleSelectBoarder(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-blue-500"
                  >
                    <option value="">-- Choose from active boarders list --</option>
                    {boarders.filter(b => b.isActive).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.roomNo ? `(Room: ${b.roomNo})` : ''} {b.phone ? `- ${b.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      New Manager Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={incomingManagerName}
                      onChange={(e) => setIncomingManagerName(e.target.value)}
                      placeholder="e.g. Tanvir Ahmed"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      New Manager Phone / bKash
                    </label>
                    <input
                      type="text"
                      value={incomingManagerPhone}
                      onChange={(e) => setIncomingManagerPhone(e.target.value)}
                      placeholder="e.g. 01700-112233"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 font-medium focus:bg-white focus:outline-blue-500"
                    />
                  </div>
                </div>

                {/* Cash handover amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Cash in Hand Handed Over (নগদ ক্যাশ হস্তান্তর) ৳
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={cashHandoverAmount}
                      onChange={(e) => setCashHandoverAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 font-bold font-mono focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Calculated Surplus Cash: ৳{Math.max(0, netMessBalance).toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Next Active Month (নতুন মাস)
                    </label>
                    <input
                      type="month"
                      required
                      value={nextMonth}
                      onChange={(e) => setNextMonth(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 font-bold focus:bg-white focus:outline-blue-500"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      New management takes effect from this month
                    </span>
                  </div>
                </div>

              </div>

              {/* Step 1 Actions */}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceedToStep2}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>Continue to Verification</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* STEP 2: SECURITY PIN & FINAL CONFIRMATION */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Handover Summary & Execution Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                  <div>
                    <span className="text-slate-500">Closing Month:</span>{' '}
                    <strong>{activeMonthStr}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Advancing To:</span>{' '}
                    <strong className="text-blue-700">{formatReadableMonth(nextMonth)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Outgoing Manager:</span>{' '}
                    <strong>{outgoingManagerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Incoming Manager:</span>{' '}
                    <strong className="text-emerald-700">{incomingManagerName}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Balance Settlement:</span>{' '}
                    <strong>{settlementType === 'carried_forward' ? 'Carry Forward to Next Month' : 'Cash Settled'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Cash Handed Over:</span>{' '}
                    <strong className="font-mono">৳ {cashHandoverAmount.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              {/* Optional New PIN Setup for Incoming Manager */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      New Manager Security PIN (পাসওয়ার্ড পরিবর্তন)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Transfer with current PIN or set a private new PIN for {incomingManagerName}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={changePin}
                      onChange={(e) => setChangePin(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-blue-700">Set New PIN</span>
                  </label>
                </div>

                {changePin && (
                  <div className="pt-2 border-t border-slate-200">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      New Manager 4-Digit Security PIN *
                    </label>
                    <input
                      type="password"
                      maxLength={8}
                      value={newManagerPin}
                      onChange={(e) => setNewManagerPin(e.target.value)}
                      placeholder="e.g. 5678"
                      className="w-full sm:w-64 bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold tracking-widest text-slate-900 focus:outline-blue-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Give this PIN to {incomingManagerName} so they can log in to the manager console.
                    </p>
                  </div>
                )}
              </div>

              {/* Handover remarks/notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Manager Handover Notes & Instructions (হস্তান্তর নোট / রিমার্কস)
                </label>
                <textarea
                  rows={3}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="e.g. All bazaar due slips cleared. Bismillah general store due ৳650. Rice sack remaining in store: 1.5 sacks..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-blue-500 resize-none leading-relaxed"
                />
              </div>

              {/* Final acknowledgment checkbox */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmationChecked}
                    onChange={(e) => setConfirmationChecked(e.target.checked)}
                    className="mt-0.5 rounded text-amber-600 cursor-pointer focus:ring-0"
                  />
                  <div className="text-xs text-amber-900">
                    <span className="font-bold block">Final Confirmation & Handover Acknowledgment</span>
                    <span className="text-[11px] text-amber-800 leading-normal block mt-0.5">
                      I confirm that month <strong>{activeMonthStr}</strong> audit statement and balance calculations are finalized. 
                      Upon confirming, management will transition to <strong>{incomingManagerName}</strong> for <strong>{formatReadableMonth(nextMonth)}</strong>. 
                      Historical data of {activeMonthStr} will remain permanently preserved in the archives.
                    </span>
                  </div>
                </label>
              </div>

              {/* Step 2 Actions */}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Back
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={!confirmationChecked || isSubmitting}
                    onClick={handleFinalSubmit}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? 'Closing & Handing Over...' : 'Confirm Month Close & Handover'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>,
    document.body
  );
}
