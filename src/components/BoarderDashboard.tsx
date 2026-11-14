import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generatePersonalVoucherPdf } from '../utils/pdfGenerator';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Utensils, 
  Activity, 
  AlertCircle,
  FileText,
  CalendarDays,
  CreditCard,
  Calculator,
  Receipt,
  Printer,
  Download,
  X,
  CheckCircle2,
  Lock,
  Coffee,
  Sparkles,
  UtensilsCrossed
} from 'lucide-react';
import { Boarder, Deposit, DailyMealLog, MonthReport, BoarderSummary, MessSettings, BazaarCost, MiscellaneousCosts } from '../types';
import { formatReadableDate, formatReadableMonth, didBoarderEatBreakfast } from '../utils';

interface BoarderDashboardProps {
  boarder: Boarder;
  report: MonthReport;
  deposits: Deposit[];
  mealLogs: DailyMealLog[];
  allBoarders: Boarder[];
  bazaarCosts?: BazaarCost[];
  miscCosts?: MiscellaneousCosts;
  settings?: MessSettings;
}

export default function BoarderDashboard({
  boarder,
  report,
  deposits,
  mealLogs,
  allBoarders,
  bazaarCosts,
  settings,
}: BoarderDashboardProps) {
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [isDownloadingSlip, setIsDownloadingSlip] = useState(false);
  const personalSlipRef = useRef<HTMLDivElement>(null);

  const handleDownloadPersonalSlipPdf = () => {
    try {
      setIsDownloadingSlip(true);
      const cleanName = boarder.name.replace(/[^a-zA-Z0-9]/g, '_');
      const doc = generatePersonalVoucherPdf(
        boarder,
        report,
        deposits,
        settings || { messName: 'Mess', currentMonth: report.month }
      );
      doc.save(`Voucher_${cleanName}_${report.month}.pdf`);
    } catch (err) {
      console.error('Error generating personal voucher PDF:', err);
      alert('Could not download voucher slip as PDF. Please try again.');
    } finally {
      setIsDownloadingSlip(false);
    }
  };

  // Find the summary of this specific boarder
  const summary = report.boardersReport.find(r => r.boarderId === boarder.id) || {
    boarderId: boarder.id,
    boarderName: boarder.name,
    totalMeals: 0,
    mealCost: 0,
    fixedCostShare: 0,
    totalCost: 0,
    totalDeposit: 0,
    balance: 0,
  } as BoarderSummary;

  // Filter deposits of this specific boarder for the active month
  const myDeposits = deposits
    .filter(d => d.boarderId === boarder.id && d.date.startsWith(report.month))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Filter meal logs of this specific boarder for the active month
  const myMealLogs = mealLogs
    .filter(log => log.date.startsWith(report.month))
    .map(log => ({
      date: log.date,
      count: log.meals[boarder.id] || 0,
      breakdown: log.mealBreakdown?.[boarder.id],
      ateBreakfast: didBoarderEatBreakfast(log, boarder.id),
      note: log.note,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Calculate percentage of budget utilized
  const budgetUtilization = summary.totalDeposit > 0 
    ? Math.min(100, Math.round((summary.totalCost / summary.totalDeposit) * 100))
    : 0;

  // Minimum breakfast rule check (default 16 days)
  const minBreakfastDays = settings?.minBreakfastDays || 16;
  const myBreakfastDays = myMealLogs.filter(m => m.ateBreakfast).length;
  const breakfastShortfall = Math.max(0, minBreakfastDays - myBreakfastDays);
  const isBreakfastShort = myBreakfastDays < minBreakfastDays;
  const breakfastPct = Math.min(100, Math.round((myBreakfastDays / minBreakfastDays) * 100));
  const myFineRecord = (settings?.breakfastFines || []).find(
    f => f.boarderId === boarder.id && f.month === report.month
  );
  const hasSpecialMeal = (summary.specialMealCost || 0) > 0;

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800">
      
      {/* Executive Boarder Statement Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="text-blue-400 font-semibold">Boarder Statement</span>
            <span aria-hidden="true">·</span>
            <span>{formatReadableMonth(report.month)}</span>
            {boarder.roomNo && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-300">Room {boarder.roomNo}</span>
              </>
            )}
            {boarder.phone && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-slate-400">{boarder.phone}</span>
              </>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2 text-white">
            Assalamu Alaikum, {boarder.name}
          </h2>
          <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">
            Personal meal consumption, itemized utility share, and closing balance for <span className="font-semibold text-white">{formatReadableMonth(report.month)}</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSlipModal(true)}
            id="btn-boarder-view-slip"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <Receipt className="w-4 h-4" />
            <span>View & Download Voucher Slip</span>
          </button>
        </div>
      </div>

      {/* Main Core Financial Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Deposits Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Your Deposits</p>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            ৳ {summary.totalDeposit.toLocaleString('en-IN')}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1.5">
            Cash & digital deposits logged
          </p>
        </div>

        {/* Total Meals Eaten Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Meals</p>
            <Utensils className="w-4 h-4 text-slate-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {summary.totalMeals} <span className="text-xs text-slate-400 font-sans font-normal">meals</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1.5 font-mono tabular-nums">
            Active rate: ৳{report.mealRate.toFixed(2)} / meal
          </p>
        </div>

        {/* Total Expenses / Cost Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Charged</p>
            <FileText className="w-4 h-4 text-slate-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            ৳ {summary.totalCost.toLocaleString('en-IN')}
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1.5 font-mono tabular-nums truncate">
            Meals ৳{summary.mealCost.toFixed(0)} · Bills ৳{summary.fixedCostShare.toFixed(0)}
            {hasSpecialMeal && ` · Feast ৳${(summary.specialMealCost || 0).toFixed(0)}`}
          </p>
        </div>

        {/* Current Balance Card */}
        <div className={`p-5 rounded-xl border ${
          summary.balance >= 0 
            ? 'bg-emerald-50/40 border-emerald-200' 
            : 'bg-rose-50/40 border-rose-200'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Net Statement</p>
            {summary.balance >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-700" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-700" />
            )}
          </div>
          <h3 className={`text-2xl font-bold font-mono tabular-nums ${
            summary.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {summary.balance >= 0 ? '+' : '-'}৳ {Math.abs(summary.balance).toLocaleString('en-IN')}
          </h3>
          <p className={`text-xs font-semibold mt-1.5 ${
            summary.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {summary.balance >= 0 ? 'Surplus (Refundable)' : 'Due (Payable Now)'}
          </p>
        </div>

      </div>

      {/* Financial Health Progress Block */}
      {summary.totalDeposit > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Deposit Utilization</h4>
              <p className="text-xs text-slate-500">Share of your advance deposit consumed by month-to-date charges</p>
            </div>
            <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
              budgetUtilization > 90 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-800'
            }`}>
              {budgetUtilization}% Utilized
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                budgetUtilization > 90 ? 'bg-rose-600' : budgetUtilization > 75 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${budgetUtilization}%` }}
            />
          </div>
          {summary.balance < 0 && (
            <div className="flex items-start gap-2 mt-3 text-xs text-rose-800 bg-rose-50/70 p-3 rounded-lg border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>Your charges exceed your deposit by <strong className="font-mono">৳ {Math.abs(summary.balance).toLocaleString('en-IN')}</strong>. Please settle this balance with the manager.</span>
            </div>
          )}
        </div>
      )}

      {/* Breakfast Attendance Rule (16 Days Minimum) Card */}
      <div className={`p-5 rounded-xl border ${
        isBreakfastShort 
          ? 'bg-amber-50/30 border-amber-200' 
          : 'bg-white border-slate-200/90'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isBreakfastShort ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                Breakfast Attendance (Minimum {minBreakfastDays} Days)
              </h4>
              <p className="text-xs text-slate-500">
                Mess rule requires eating breakfast on at least {minBreakfastDays} days per month
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border self-start sm:self-auto ${
            isBreakfastShort 
              ? 'bg-rose-50 text-rose-800 border-rose-200' 
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            {isBreakfastShort ? `${breakfastShortfall} Days Short` : `Compliant (${myBreakfastDays} Days)`}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              Breakfasts Attended: <strong className="text-slate-900">{myBreakfastDays}</strong> of {minBreakfastDays} required days
            </span>
            <span className={`font-bold ${isBreakfastShort ? 'text-rose-600' : 'text-emerald-700'}`}>
              {breakfastPct}%
            </span>
          </div>
          <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isBreakfastShort ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${breakfastPct}%` }}
            />
          </div>
        </div>

        {myFineRecord && (
          <div className="mt-3 p-2.5 bg-amber-100/70 border border-amber-300 text-amber-900 text-xs rounded-lg flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Penalty Meal Fine Applied:</strong> +{myFineRecord.fineMeals} meals on {formatReadableDate(myFineRecord.dateApplied)} ({myFineRecord.note || 'Breakfast shortfall'}).
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Detailed calculation breakdown audit sheet */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <Calculator className="w-4 h-4 text-blue-600" />
          Detailed Calculation Audit Sheet
        </h3>
        <p className="text-xs text-slate-500">
          This is the exact mathematical step-by-step breakdown of how your current dues and statement balances are calculated.
        </p>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasSpecialMeal ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 pt-1`}>
          {/* Step 1: Meal Cost (A) */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Step 1: Meals Expense (A)</span>
            <div className="text-xl font-bold text-slate-900">৳ {summary.mealCost.toFixed(2)}</div>
            <p className="text-xs text-slate-500 leading-normal">
              Your logged meals ({summary.totalMeals}) multiplied by the active meal rate (৳{report.mealRate.toFixed(4)})
            </p>
            <div className="font-mono text-[11px] text-slate-400 border-t border-slate-200/60 pt-2">
              Formula: {summary.totalMeals} * ৳{report.mealRate.toFixed(4)}
            </div>
          </div>

          {/* Step 2: Fixed Common Bills Share (B) */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Step 2: Shared Bills (B)</span>
            <div className="text-xl font-bold text-slate-900">৳ {summary.fixedCostShare.toFixed(2)}</div>
            <p className="text-xs text-slate-500 leading-normal">
              The total mess fixed costs (৳{report.totalFixedCost.toLocaleString('en-IN')}) divided equally among active members ({allBoarders.filter(b => b.isActive).length})
            </p>
            <div className="font-mono text-[11px] text-slate-400 border-t border-slate-200/60 pt-2">
              Formula: ৳{report.totalFixedCost.toFixed(2)} / {allBoarders.filter(b => b.isActive).length}
            </div>
          </div>

          {/* Step 3: Special Feast Share (C) - Only shown if participated */}
          {hasSpecialMeal && (
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-2">
              <span className="text-[10px] uppercase font-bold text-purple-700 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" />
                Step 3: Special Feast (C)
              </span>
              <div className="text-xl font-bold text-purple-950">৳ {(summary.specialMealCost || 0).toFixed(2)}</div>
              <p className="text-xs text-purple-800 leading-normal">
                Your distributed share of month-end grand feast(s). Excluded from regular daily meal rate.
              </p>
              <div className="font-mono text-[11px] text-purple-600 border-t border-purple-200 pt-2">
                Shared only among feast diners
              </div>
            </div>
          )}

          {/* Step 3/4: Total Charged */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {hasSpecialMeal ? 'Step 4: Total Charged' : 'Step 3: Total Charged'}
            </span>
            <div className="text-xl font-bold text-slate-900">৳ {summary.totalCost.toFixed(2)}</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              The summation of your meal expenses, equal fixed bills share{hasSpecialMeal ? ', and feast share' : ''}
            </p>
            <div className="font-mono text-[11px] text-slate-400 border-t border-slate-200/60 pt-2">
              Formula: ৳{summary.mealCost.toFixed(2)} + ৳{summary.fixedCostShare.toFixed(2)}{hasSpecialMeal ? ` + ৳${(summary.specialMealCost || 0).toFixed(2)}` : ''}
            </div>
          </div>

          {/* Step 4/5: Net Balance Closing */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">
              {hasSpecialMeal ? 'Step 5: Net Statement' : 'Step 4: Net Statement'}
            </span>
            <div className={`text-xl font-bold ${summary.balance >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
              {summary.balance >= 0 ? '+' : ''}৳ {summary.balance.toFixed(2)}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your total cash deposited (৳{summary.totalDeposit.toLocaleString('en-IN')}) minus your total charged cost
            </p>
            <div className="font-mono text-[11px] text-slate-400 border-t border-slate-200/60 pt-2">
              Formula: ৳{summary.totalDeposit.toFixed(2)} - ৳{summary.totalCost.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Split layout: Transparency & Bills vs Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Transparency and Mess Stats */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Transparent Mess Rates
            </h3>
            
            <div className="space-y-3.5">
              
              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Live Meal Rate</span>
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  ৳ {report.mealRate.toFixed(4)} / meal
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Bazaar Cost</span>
                <span className="font-semibold text-slate-800">৳ {report.totalBazaarCost.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Active Meals Eaten</span>
                <span className="font-semibold text-slate-800">{report.totalMeals} meals</span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Total Mess Common Bills</span>
                <span className="font-semibold text-slate-800">৳ {report.totalFixedCost.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-center justify-between text-xs py-1.5">
                <span className="text-slate-500">Your Shared Common Bill</span>
                <span className="font-bold text-slate-800">৳ {summary.fixedCostShare.toLocaleString('en-IN')}</span>
              </div>

            </div>
          </div>

          {/* Quick Expense visual list */}
          <div className="border-t border-slate-100 pt-5">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Your Cost Breakdown</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Meal Costs</span>
                  <span className="font-semibold text-slate-800">৳{summary.mealCost}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full" 
                    style={{ width: `${summary.totalCost > 0 ? (summary.mealCost / summary.totalCost) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Common Bills Share</span>
                  <span className="font-semibold text-slate-800">৳{summary.fixedCostShare}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div 
                    className="bg-slate-400 h-1.5 rounded-full" 
                    style={{ width: `${summary.totalCost > 0 ? (summary.fixedCostShare / summary.totalCost) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {hasSpecialMeal && (
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span className="flex items-center gap-1 text-purple-700 font-medium">
                      <Sparkles className="w-3 h-3 text-purple-600" />
                      Special Feast Share
                    </span>
                    <span className="font-semibold text-purple-800">৳{(summary.specialMealCost || 0).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div 
                      className="bg-purple-600 h-1.5 rounded-full" 
                      style={{ width: `${summary.totalCost > 0 ? ((summary.specialMealCost || 0) / summary.totalCost) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
              * Common bills include cooker rent, wifi, electricity, water, gas and house rents shared equally among all active members.
            </p>
          </div>
        </div>

        {/* Right Columns: Deposits & Meals Logs */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* My Deposits Log */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-600" />
              Deposit Statement
            </h3>
            
            {myDeposits.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-400">No deposits logged for this month yet.</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[350px] space-y-2.5 pr-1">
                {myDeposits.map((dep) => (
                  <div key={dep.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-slate-800">৳ {dep.amount}</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{dep.note || 'Regular Deposit'}</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {formatReadableDate(dep.date)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My Meals Log */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              Daily Meals Log
            </h3>
            
            {myMealLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-400">No meals logged for this month yet.</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[350px] space-y-2 pr-1">
                {myMealLogs.map((log) => (
                  <div key={log.date} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition-colors gap-2">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-[11px] font-medium text-slate-700">
                        {formatReadableDate(log.date)}
                      </span>
                      {log.breakdown && log.count > 0 && (
                        <span className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                          B:{log.breakdown.breakfast}
                          {log.breakdown.breakfast >= 1 ? ` (${Math.round((log.breakdown.breakfast / 0.5) * 10) / 10}x)` : ''}
                          {' '}· L:{log.breakdown.lunch} · D:{log.breakdown.dinner}
                        </span>
                      )}
                      {log.note && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block truncate max-w-[200px]">
                          {log.note}
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-md font-mono tabular-nums ${
                      log.count > 0 
                        ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {log.count} {log.count === 1 ? 'meal' : 'meals'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Personal Monthly Voucher Slip Modal for the Boarder */}
      {showSlipModal && createPortal(
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-6 py-8 sm:py-10 print:p-0 print:bg-white print:static print:overflow-visible animate-fadeIn">
          <div className="bg-white w-full max-w-2xl my-auto rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col print:border-none print:shadow-none print:rounded-none">
            
            {/* Modal Actions Header (Hidden in Print) */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 print:hidden shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">My Monthly Financial Voucher Slip</h3>
                  <p className="text-[11px] text-slate-400">Personal meal statement & verified expense voucher</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPersonalSlipPdf}
                  disabled={isDownloadingSlip}
                  id="btn-download-personal-slip"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors shadow-xs disabled:opacity-50"
                  title="Download individual voucher slip as PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloadingSlip ? 'Downloading...' : 'Download PDF Slip'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSlipModal(false)}
                  id="btn-close-personal-slip"
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Voucher Slip Printable Card */}
            <div className="p-6 sm:p-8 bg-slate-50/50 print:bg-white print:p-0">
              <div ref={personalSlipRef} className="bg-white border-2 border-slate-900 rounded-xl p-6 shadow-sm print:shadow-none">
                {/* Slip Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
                      {settings?.messName || 'Mess'}
                    </h2>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mt-0.5">
                      Official Monthly Meal Voucher & Financial Slip
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                      <span>Month: <strong>{formatReadableMonth(report.month)}</strong></span>
                      {boarder.roomNo && (
                        <>
                          <span>•</span>
                          <span>Room: <strong>{boarder.roomNo}</strong></span>
                        </>
                      )}
                    </div>
                  </div>

                  <span className={`text-xs font-extrabold px-3 py-1 rounded-md border font-mono tracking-wider ${
                    summary.balance >= 0 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                      : 'bg-rose-50 text-rose-800 border-rose-300'
                  }`}>
                    {summary.balance >= 0 ? 'REFUNDABLE' : 'DUE TO PAY'}
                  </span>
                </div>

                {/* Member Profile */}
                <div className="py-3 border-b border-slate-200 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-500">Member Name: </span>
                    <strong className="text-slate-900 text-sm font-semibold">{boarder.name}</strong>
                  </div>
                  {boarder.phone && (
                    <div className="text-slate-500 font-mono text-[11px]">
                      Phone: {boarder.phone}
                    </div>
                  )}
                </div>

                {/* Financial Breakdown Table */}
                <div className="py-3 text-xs space-y-2">
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-600">
                      1. Meal Consumption ({summary.totalMeals} meals @ ৳{report.mealRate.toFixed(4)}/meal)
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      ৳ {summary.mealCost.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-600">
                      2. Shared Overhead Bills (House Rent, Cooker, Gas, Utility, WiFi share)
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      ৳ {summary.fixedCostShare.toFixed(2)}
                    </span>
                  </div>

                  {hasSpecialMeal && (
                    <div className="flex justify-between items-center py-1 border-b border-slate-100 text-purple-900 bg-purple-50/50 px-2 rounded">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>3. Special Feast Share (সমাপনী ফিস্ট - অংশগ্রহণকারী হিসেবে)</span>
                      </span>
                      <span className="font-mono font-bold text-purple-800">
                        ৳ {(summary.specialMealCost || 0).toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-1.5 border-b-2 border-slate-200 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>Total Charged for Month {hasSpecialMeal ? '(1 + 2 + 3)' : '(1 + 2)'}</span>
                    <span className="font-mono text-sm">৳ {summary.totalCost.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 text-blue-700 font-bold px-2">
                    <span>Total Cash / Bank Deposits Received</span>
                    <span className="font-mono text-sm">৳ {summary.totalDeposit.toFixed(2)}</span>
                  </div>
                </div>

                {/* Net Closing Statement */}
                <div className={`mt-2 p-3 rounded-lg border-2 flex justify-between items-center text-xs ${
                  summary.balance >= 0 
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-400' 
                    : 'bg-rose-50 text-rose-950 border-rose-400'
                }`}>
                  <div>
                    <div className="font-bold text-sm">
                      {summary.balance >= 0 ? 'Closing Refundable Amount:' : 'Net Outstanding Due:'}
                    </div>
                    <div className="text-[10px] opacity-80">
                      {summary.balance >= 0 
                        ? 'This surplus credit can be refunded or adjusted in next month.' 
                        : 'Please clear your dues by the 5th of next month via bKash or Cash.'}
                    </div>
                  </div>
                  <div className="text-xl font-black font-mono">
                    ৳ {Math.abs(summary.balance).toFixed(2)}
                  </div>
                </div>

                {/* Signature Blocks */}
                <div className="pt-8 mt-6 border-t border-slate-300 flex justify-between items-end text-xs">
                  <div className="text-center w-40">
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-700 text-[11px]">
                      Boarder Signature
                    </div>
                    <div className="text-[9px] text-slate-400">{boarder.name}</div>
                  </div>

                  <div className="text-center w-40">
                    <div className="border-t border-slate-800 pt-1 font-bold text-slate-700 text-[11px]">
                      Manager Verification & Seal
                    </div>
                    <div className="text-[9px] text-slate-400">Mess Management</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
