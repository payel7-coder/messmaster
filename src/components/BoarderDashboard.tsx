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
  Coffee
} from 'lucide-react';
import { Boarder, Deposit, DailyMealLog, MonthReport, BoarderSummary, MessSettings, BazaarCost, MiscellaneousCosts } from '../types';
import { formatReadableDate, formatReadableMonth } from '../utils';

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
      note: log.note,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Calculate percentage of budget utilized
  const budgetUtilization = summary.totalDeposit > 0 
    ? Math.min(100, Math.round((summary.totalCost / summary.totalDeposit) * 100))
    : 0;

  // Minimum breakfast rule check (default 16 days)
  const minBreakfastDays = settings?.minBreakfastDays || 16;
  const myBreakfastDays = myMealLogs.filter(m => {
    const c = m.count;
    return (c % 1 >= 0.45 && c % 1 <= 0.55) || c === 0.5;
  }).length;
  const breakfastShortfall = Math.max(0, minBreakfastDays - myBreakfastDays);
  const isBreakfastShort = myBreakfastDays < minBreakfastDays;
  const breakfastPct = Math.min(100, Math.round((myBreakfastDays / minBreakfastDays) * 100));
  const myFineRecord = (settings?.breakfastFines || []).find(
    f => f.boarderId === boarder.id && f.month === report.month
  );

  return (
    <div className="space-y-6 animate-fadeIn text-slate-800">
      
      {/* Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 text-white shadow-xs relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="absolute inset-0 bg-linear-to-r from-blue-900/40 to-slate-900/10 pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <span className="bg-blue-500/20 text-blue-300 font-semibold text-xs uppercase px-2.5 py-1 rounded-full border border-blue-500/30">
            Boarder Console
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-3">
            Assalamu Alaikum, {boarder.name}!
          </h2>
          <p className="text-slate-300 text-sm mt-1.5 leading-relaxed">
            Here is your personal meal statement, ledger, and share of bills for <span className="font-semibold text-white">{formatReadableMonth(report.month)}</span>.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
            {boarder.roomNo && (
              <span className="bg-blue-600/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded font-mono font-medium">
                Room: {boarder.roomNo}
              </span>
            )}
            {boarder.phone && (
              <span className="text-slate-400 font-mono">
                Contact: {boarder.phone}
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowSlipModal(true)}
            id="btn-boarder-view-slip"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-3 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-950/40 active:scale-98"
          >
            <Receipt className="w-4 h-4" />
            <span>View & Download My Voucher Slip</span>
          </button>
        </div>
      </div>

      {/* Main Core Financial Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Deposits Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50/50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105 duration-300" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 mb-4">
              <DollarSign className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Your Deposits</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              ৳ {summary.totalDeposit.toLocaleString('en-IN')}
            </h3>
            <p className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-2">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Paid this month</span>
            </p>
          </div>
        </div>

        {/* Total Meals Eaten Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105 duration-300" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-4">
              <Utensils className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Meals</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {summary.totalMeals} <span className="text-xs text-slate-400 font-normal">meals</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-2">
              <Activity className="w-3.5 h-3.5" />
              <span>Active meal counter</span>
            </p>
          </div>
        </div>

        {/* Total Expenses / Cost Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-slate-50 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-105 duration-300" />
          <div className="relative z-10">
            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Bills</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              ৳ {summary.totalCost.toLocaleString('en-IN')}
            </h3>
            <p className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-2">
              <span>Meals: ৳{summary.mealCost} + Bills: ৳{summary.fixedCostShare}</span>
            </p>
          </div>
        </div>

        {/* Current Balance Card */}
        <div className={`p-5 rounded-xl border shadow-xs relative overflow-hidden group ${
          summary.balance >= 0 
            ? 'bg-blue-50/30 border-blue-100' 
            : 'bg-rose-50/40 border-rose-100'
        }`}>
          <div className="relative z-10">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
              summary.balance >= 0 ? 'bg-blue-100/80 text-blue-700' : 'bg-rose-100/80 text-rose-700'
            }`}>
              {summary.balance >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Net Statement</p>
            <h3 className={`text-2xl font-bold mt-1 ${
              summary.balance >= 0 ? 'text-blue-700' : 'text-rose-700'
            }`}>
              ৳ {Math.abs(summary.balance).toLocaleString('en-IN')}
            </h3>
            <p className="text-xs font-semibold flex items-center gap-1 mt-2">
              {summary.balance >= 0 ? (
                <span className="text-blue-700">Surplus (Receivable)</span>
              ) : (
                <span className="text-rose-700">Due (Payable Immediately)</span>
              )}
            </p>
          </div>
        </div>

      </div>

      {/* Financial Health Progress Block */}
      {summary.totalDeposit > 0 && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Deposit Consumption</h4>
              <p className="text-xs text-slate-500">How much of your deposited Taka has been consumed by costs</p>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              budgetUtilization > 90 ? 'bg-rose-100 text-rose-800' : 'bg-blue-50 text-blue-800'
            }`}>
              {budgetUtilization}% Spent
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                budgetUtilization > 90 ? 'bg-rose-600' : budgetUtilization > 75 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${budgetUtilization}%` }}
            />
          </div>
          {summary.balance < 0 && (
            <div className="flex items-start gap-1.5 mt-3 text-xs text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>You have exceeded your deposited amount by <strong>৳ {Math.abs(summary.balance)}</strong>. Please deposit cash to clear your dues.</span>
            </div>
          )}
        </div>
      )}

      {/* Breakfast Attendance Rule (16 Days Minimum) Card */}
      <div className={`p-5 rounded-xl border shadow-xs ${
        isBreakfastShort 
          ? 'bg-amber-50/40 border-amber-200' 
          : 'bg-emerald-50/30 border-emerald-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isBreakfastShort ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              <Coffee className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Breakfast Attendance (Minimum {minBreakfastDays} Days Rule)
              </h4>
              <p className="text-xs text-slate-500">
                Mess rule requires every member to eat breakfast on at least {minBreakfastDays} days monthly
              </p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border self-start sm:self-auto ${
            isBreakfastShort 
              ? 'bg-rose-100 text-rose-800 border-rose-300' 
              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
          }`}>
            {isBreakfastShort ? `${breakfastShortfall} Days Short of Rule` : `Rule Met (${myBreakfastDays} Days)`}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
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

          {/* Step 3: Total Charged (A+B) */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Step 3: Total Charged</span>
            <div className="text-xl font-bold text-slate-900">৳ {summary.totalCost.toFixed(2)}</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              The summation of your individual meal expenses and your equal share of the fixed bills
            </p>
            <div className="font-mono text-[11px] text-slate-400 border-t border-slate-200/60 pt-2">
              Formula: ৳{summary.mealCost.toFixed(2)} + ৳{summary.fixedCostShare.toFixed(2)}
            </div>
          </div>

          {/* Step 4: Net Balance Closing */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Step 4: Net Statement</span>
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
                  <div key={log.date} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="text-[11px] font-medium text-slate-700">
                        {formatReadableDate(log.date)}
                      </span>
                      {log.note && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded font-medium mt-0.5 inline-block truncate max-w-[200px]">
                          {log.note}
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
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

                  <div className="flex justify-between items-center py-1.5 border-b-2 border-slate-200 font-bold text-slate-900 bg-slate-50 px-2 rounded">
                    <span>Total Charged for Month (1 + 2)</span>
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
