import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Utensils, 
  ShoppingCart, 
  Users, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  PieChart, 
  BarChart3, 
  LineChart, 
  Clock, 
  Copy, 
  Filter, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldAlert, 
  ShieldCheck,
  Coffee, 
  Building2, 
  Receipt, 
  Info,
  Check,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, MonthReport, BoarderSummary, SpecialMeal } from '../types';
import { formatReadableDate, formatReadableMonth, didBoarderEatBreakfast } from '../utils';

interface ManagerAnalyticsDashboardProps {
  boarders: Boarder[];
  deposits: Deposit[];
  mealLogs: DailyMealLog[];
  bazaarCosts: BazaarCost[];
  miscCosts: MiscellaneousCosts;
  settings: MessSettings;
  report: MonthReport;
  onNavigateToTab?: (tab: 'meals' | 'bazaar' | 'deposits' | 'fixed' | 'boarders') => void;
  onOpenBreakfastModal?: () => void;
  onOpenSpecialMealModal?: () => void;
  onOpenReportModal?: () => void;
}

type TimeframeFilter = 'all' | 'last7' | 'last14' | 'w1' | 'w2' | 'w3' | 'w4';
type RiskFilter = 'all' | 'high_due' | 'zero_deposit' | 'surplus';

export default function ManagerAnalyticsDashboard({
  boarders,
  deposits,
  mealLogs,
  bazaarCosts,
  miscCosts,
  settings,
  report,
  onNavigateToTab,
  onOpenBreakfastModal,
  onOpenSpecialMealModal,
  onOpenReportModal,
}: ManagerAnalyticsDashboardProps) {
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [searchMember, setSearchMember] = useState('');
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState<string | null>(null);
  const [hoveredChartDay, setHoveredChartDay] = useState<{
    date: string;
    dayNum: number;
    meals: number;
    bazaar: number;
    eatersCount: number;
  } | null>(null);

  // Month parsing
  const [yearStr, monthStr] = settings.currentMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const activeMonthStr = formatReadableMonth(settings.currentMonth);

  // All dates of active month
  const allMonthDates = useMemo(() => {
    const list: { date: string; day: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const padded = d < 10 ? `0${d}` : `${d}`;
      list.push({ date: `${settings.currentMonth}-${padded}`, day: d });
    }
    return list;
  }, [daysInMonth, settings.currentMonth]);

  // Filter dates based on timeframe
  const filteredDates = useMemo(() => {
    if (timeframe === 'all') return allMonthDates;
    if (timeframe === 'last7') return allMonthDates.slice(-7);
    if (timeframe === 'last14') return allMonthDates.slice(-14);
    if (timeframe === 'w1') return allMonthDates.slice(0, 7);
    if (timeframe === 'w2') return allMonthDates.slice(7, 14);
    if (timeframe === 'w3') return allMonthDates.slice(14, 21);
    if (timeframe === 'w4') return allMonthDates.slice(21);
    return allMonthDates;
  }, [timeframe, allMonthDates]);

  // Current month's records
  const currentMonthBazaars = useMemo(() => {
    return bazaarCosts.filter(b => b.date.startsWith(settings.currentMonth));
  }, [bazaarCosts, settings.currentMonth]);

  const currentMonthDeposits = useMemo(() => {
    return deposits.filter(d => d.date.startsWith(settings.currentMonth));
  }, [deposits, settings.currentMonth]);

  const currentMonthLogs = useMemo(() => {
    return mealLogs.filter(l => l.date.startsWith(settings.currentMonth));
  }, [mealLogs, settings.currentMonth]);

  const currentMonthSpecialMeals = useMemo(() => {
    return (settings.specialMeals || []).filter(sm => sm.date.startsWith(settings.currentMonth));
  }, [settings.specialMeals, settings.currentMonth]);

  // Financial calculations
  const totalBazaarSpent = report.totalBazaarCost;
  const totalFixedCost = report.totalFixedCost;
  const totalSpecialMealCost = report.totalSpecialMealCost || 0;
  const grandTotalCost = totalBazaarSpent + totalFixedCost + totalSpecialMealCost;
  const totalDepositsCollected = report.totalDeposits;

  // Actual Cash in Hand calculation
  const totalBazaarCashPaid = useMemo(() => {
    return currentMonthBazaars.reduce((sum, b) => {
      if (b.paidAmount !== undefined) return sum + b.paidAmount;
      if (b.dueAmount && !b.isDueSettled) return sum + (b.amount - b.dueAmount);
      return sum + b.amount;
    }, 0);
  }, [currentMonthBazaars]);

  const totalFixedBillsPaidFromCash = useMemo(() => {
    let sum = 0;
    const p = miscCosts.paidFromCash || {};
    if (p.houseRent) sum += (miscCosts.houseRent || 0);
    if (p.cookerBill) sum += (miscCosts.cookerBill || 0);
    if (p.utilityBill) sum += (miscCosts.utilityBill || 0);
    if (p.gasBill) sum += (miscCosts.gasBill || 0);
    if (p.wifiBill) sum += (miscCosts.wifiBill || 0);
    if (p.otherCosts) sum += (miscCosts.otherCosts || 0);
    (miscCosts.customBills || []).forEach(cb => {
      if (cb.paidFromCash) sum += (cb.amount || 0);
    });
    return sum;
  }, [miscCosts]);

  const totalSpecialMealsPaidFromCash = useMemo(() => {
    return currentMonthSpecialMeals.reduce((sum, sm) => {
      return sum + (sm.paidFromCash ? (sm.totalCost || 0) : 0);
    }, 0);
  }, [currentMonthSpecialMeals]);

  const netCashInHand = totalDepositsCollected - totalBazaarCashPaid - totalFixedBillsPaidFromCash - totalSpecialMealsPaidFromCash;

  // Bazaar burn rate & Runway
  const daysWithBazaar = useMemo(() => {
    const dates = new Set(currentMonthBazaars.map(b => b.date));
    return Math.max(1, dates.size);
  }, [currentMonthBazaars]);

  const avgDailyBazaarCost = totalBazaarSpent / daysWithBazaar;
  const estimatedDaysRunway = avgDailyBazaarCost > 0 ? Math.max(0, netCashInHand / avgDailyBazaarCost) : 30;

  // Meal Rate & Projections
  const currentMealRate = report.mealRate;
  const totalMealsCount = report.totalMeals;
  const avgMealsPerDay = daysInMonth > 0 ? totalMealsCount / daysInMonth : 0;

  // Dues vs Surplus summary
  const boardersReport = report.boardersReport || [];
  const activeBoarders = useMemo(() => boarders.filter(b => b.isActive), [boarders]);

  const { totalOutstandingDues, totalSurplusCredit, dueBoardersCount, surplusBoardersCount, zeroDepositCount } = useMemo(() => {
    let dues = 0;
    let surplus = 0;
    let dueCount = 0;
    let surplusCount = 0;
    let zeroDep = 0;

    boardersReport.forEach(b => {
      if (b.balance < 0) {
        dues += Math.abs(b.balance);
        dueCount++;
      } else {
        surplus += b.balance;
        surplusCount++;
      }
      if (b.totalDeposit === 0 && b.totalMeals > 0) {
        zeroDep++;
      }
    });

    return {
      totalOutstandingDues: dues,
      totalSurplusCredit: surplus,
      dueBoardersCount: dueCount,
      surplusBoardersCount: surplusCount,
      zeroDepositCount: zeroDep,
    };
  }, [boardersReport]);

  const collectionEfficiency = grandTotalCost > 0 ? (totalDepositsCollected / grandTotalCost) * 100 : 0;

  // Breakfast rule audit calculation
  const minBreakfastDays = settings.minBreakfastDays || 16;
  const breakfastDefaulters = useMemo(() => {
    return activeBoarders.filter(b => {
      const bDays = currentMonthLogs.filter(l => didBoarderEatBreakfast(l, b.id)).length;
      return bDays < minBreakfastDays;
    });
  }, [activeBoarders, currentMonthLogs, minBreakfastDays]);

  const breakfastComplianceRate = activeBoarders.length > 0 
    ? ((activeBoarders.length - breakfastDefaulters.length) / activeBoarders.length) * 100 
    : 100;

  // Pending Shop Dues (বাকি)
  const totalPendingShopDues = useMemo(() => {
    return currentMonthBazaars.reduce((sum, b) => {
      if (b.dueAmount && !b.isDueSettled) return sum + b.dueAmount;
      return sum;
    }, 0);
  }, [currentMonthBazaars]);

  // Daily statistics for charts (responds dynamically to selected timeframe)
  const dailySeriesData = useMemo(() => {
    return filteredDates.map(({ date, day }) => {
      const log = currentMonthLogs.find(l => l.date === date);
      let dayMeals = 0;
      let eatersCount = 0;
      if (log?.meals) {
        Object.values(log.meals).forEach((val) => {
          const num = Number(val) || 0;
          if (num > 0) {
            dayMeals += num;
            eatersCount++;
          }
        });
      }

      const dayBazaars = currentMonthBazaars.filter(b => b.date === date);
      const dayBazaarCost = dayBazaars.reduce((sum, b) => sum + b.amount, 0);

      return {
        date,
        dayNum: day,
        meals: dayMeals,
        bazaar: dayBazaarCost,
        eatersCount,
      };
    });
  }, [filteredDates, currentMonthLogs, currentMonthBazaars]);

  // Max values for chart scaling
  const maxMealsOnDay = useMemo(() => {
    const max = Math.max(...dailySeriesData.map(d => d.meals), 1);
    return Math.ceil(max * 1.15);
  }, [dailySeriesData]);

  const maxBazaarOnDay = useMemo(() => {
    const max = Math.max(...dailySeriesData.map(d => d.bazaar), 500);
    return Math.ceil(max * 1.15);
  }, [dailySeriesData]);

  // Category breakdown for expenditure donut
  const expenseCategories = useMemo(() => {
    const items = [
      { name: 'Kitchen Bazaar', amount: totalBazaarSpent, color: '#2563EB', bg: 'bg-blue-600' },
      { name: 'House Rent', amount: miscCosts.houseRent || 0, color: '#7C3AED', bg: 'bg-purple-600' },
      { name: 'Cooker / Maid', amount: miscCosts.cookerBill || 0, color: '#059669', bg: 'bg-emerald-600' },
      { name: 'Gas Cylinder', amount: miscCosts.gasBill || 0, color: '#EA580C', bg: 'bg-orange-600' },
      { name: 'Electricity & Utilities', amount: miscCosts.utilityBill || 0, color: '#D97706', bg: 'bg-amber-600' },
      { name: 'WiFi Internet', amount: miscCosts.wifiBill || 0, color: '#0284C7', bg: 'bg-sky-600' },
    ];

    if (totalSpecialMealCost > 0) {
      items.push({ name: 'Special Feasts', amount: totalSpecialMealCost, color: '#DB2777', bg: 'bg-pink-600' });
    }

    if (miscCosts.otherCosts && miscCosts.otherCosts > 0) {
      items.push({ name: 'Other Fixed', amount: miscCosts.otherCosts, color: '#64748B', bg: 'bg-slate-500' });
    }

    (miscCosts.customBills || []).forEach(cb => {
      if (cb.amount > 0) {
        items.push({ name: cb.name, amount: cb.amount, color: '#4F46E5', bg: 'bg-indigo-600' });
      }
    });

    const total = items.reduce((acc, curr) => acc + curr.amount, 0);
    return items.map(item => ({
      ...item,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    })).filter(i => i.amount > 0);
  }, [totalBazaarSpent, miscCosts, totalSpecialMealCost]);

  // Top Shoppers Analysis
  const shopperStats = useMemo(() => {
    const map: Record<string, { boarderId: string; name: string; count: number; totalAmount: number }> = {};
    currentMonthBazaars.forEach(b => {
      const shopper = boarders.find(m => m.id === b.spentById);
      const name = shopper?.name || (b.spentById === 'manager' ? 'Mess Manager' : 'General / Other');
      const key = b.spentById || 'manager';
      if (!map[key]) {
        map[key] = { boarderId: key, name, count: 0, totalAmount: 0 };
      }
      map[key].count += 1;
      map[key].totalAmount += b.amount;
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [currentMonthBazaars, boarders]);

  // Filtered boarders for Risk Matrix
  const filteredRiskBoarders = useMemo(() => {
    let list = [...boardersReport];

    // Filter by risk category
    if (riskFilter === 'high_due') {
      list = list.filter(b => b.balance < -1000);
    } else if (riskFilter === 'zero_deposit') {
      list = list.filter(b => b.totalDeposit === 0 && b.totalMeals > 0);
    } else if (riskFilter === 'surplus') {
      list = list.filter(b => b.balance >= 0);
    }

    // Search filter
    if (searchMember.trim()) {
      const q = searchMember.toLowerCase();
      list = list.filter(b => {
        const bd = boarders.find(m => m.id === b.boarderId);
        return b.boarderName.toLowerCase().includes(q) || (bd?.roomNo && bd.roomNo.toLowerCase().includes(q));
      });
    }

    // Sort by largest dues first
    return list.sort((a, b) => a.balance - b.balance);
  }, [boardersReport, riskFilter, searchMember, boarders]);

  // Copy Executive Briefing to clipboard
  const handleCopyBriefing = () => {
    const runwayStr = estimatedDaysRunway < 99 ? `${estimatedDaysRunway.toFixed(1)} days` : 'Healthy';
    let text = `📊 *${settings.messName || 'Mess'} - Executive Financial & Operational Briefing*\n`;
    text += `📅 *Month:* ${activeMonthStr}\n`;
    text += `------------------------------------\n`;
    text += `💵 *Cash-in-Hand:* ৳${netCashInHand.toLocaleString('en-IN')} (${runwayStr} bazaar runway)\n`;
    text += `🍛 *Total Meals Consumed:* ${totalMealsCount.toFixed(1)} (Avg: ${avgMealsPerDay.toFixed(1)}/day)\n`;
    text += `💰 *Calculated Meal Rate:* ৳${currentMealRate.toFixed(4)} / meal\n`;
    text += `🛒 *Total Bazaar Spent:* ৳${totalBazaarSpent.toLocaleString('en-IN')}\n`;
    text += `🏢 *Shared Fixed Overhead:* ৳${totalFixedCost.toLocaleString('en-IN')}\n`;
    if (totalSpecialMealCost > 0) {
      text += `🎉 *Special Feasts:* ৳${totalSpecialMealCost.toLocaleString('en-IN')}\n`;
    }
    text += `📥 *Total Deposits Collected:* ৳${totalDepositsCollected.toLocaleString('en-IN')}\n`;
    text += `------------------------------------\n`;
    text += `⚠️ *Receivables (Total Dues):* ৳${totalOutstandingDues.toLocaleString('en-IN')} across ${dueBoardersCount} members\n`;
    text += `✅ *Surplus Advance Balance:* ৳${totalSurplusCredit.toLocaleString('en-IN')} across ${surplusBoardersCount} members\n`;
    if (breakfastDefaulters.length > 0) {
      text += `🍳 *Breakfast Policy Notice:* ${breakfastDefaulters.length} boarder(s) currently under ${minBreakfastDays} days minimum.\n`;
    }
    if (totalPendingShopDues > 0) {
      text += `🏪 *Outstanding Vendor Dues (বাকি):* ৳${totalPendingShopDues.toLocaleString('en-IN')}\n`;
    }
    text += `\n_Generated via MessMaster Manager Console at ${new Date().toLocaleDateString('en-GB')}_`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedBriefing(true);
      setTimeout(() => setCopiedBriefing(false), 3000);
    });
  };

  // Copy individual boarder payment reminder
  const handleCopyReminder = (b: BoarderSummary) => {
    const dueAmount = Math.abs(b.balance);
    const msg = `Salam ${b.boarderName}, this is a gentle mess update for ${activeMonthStr}. You have consumed ${b.totalMeals} meals (৳${b.mealCost.toFixed(0)}) and your current balance is ৳${dueAmount.toFixed(0)} due. Please deposit at your earliest convenience to keep our mess cashflow running smoothly. Thank you!`;
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedMemberId(b.boarderId);
      setTimeout(() => setCopiedMemberId(null), 3000);
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* =========================================================================
          TOP EXECUTIVE HEADER & CONTROLS
          ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500 text-xs font-medium mb-1 font-mono tabular-nums">
            <span>Mess Analytics</span>
            <span aria-hidden="true">·</span>
            <span>{activeMonthStr}</span>
            <span aria-hidden="true">·</span>
            <span>{activeBoarders.length} Active Boarders</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span>Manager Analytics & Intelligence</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time cashflow runway, meal rate dynamics, kitchen consumption patterns, and member risk matrix.
          </p>
        </div>

        {/* Timeframe & Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Timeframe Filter */}
          <div className="flex items-center gap-0.5 p-1 bg-slate-100 border border-slate-200/70 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                timeframe === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Month
            </button>
            <button
              onClick={() => setTimeframe('last7')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                timeframe === 'last7' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setTimeframe('last14')}
              className={`px-3 py-1.5 rounded-md cursor-pointer transition-all whitespace-nowrap shrink-0 hidden sm:block ${
                timeframe === 'last14' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 14 Days
            </button>
          </div>

          {/* Copy Briefing Button */}
          <button
            onClick={handleCopyBriefing}
            id="btn-copy-analytics-brief"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            title="Copy complete structured executive briefing for WhatsApp or records"
          >
            {copiedBriefing ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Briefing Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-300" />
                <span>Copy Briefing</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: 6 CORE EXECUTIVE HEALTH INDICATORS (KPI MATRIX)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        {/* KPI 1: Cash in Hand & Runway */}
        <div className={`p-4 rounded-xl border transition-all ${
          netCashInHand >= 2000 
            ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950' 
            : netCashInHand >= 0 
            ? 'bg-amber-50/50 border-amber-200/80 text-amber-950' 
            : 'bg-rose-50/50 border-rose-200/80 text-rose-950'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Cash in Hand</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              estimatedDaysRunway >= 5 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {estimatedDaysRunway < 99 ? `${estimatedDaysRunway.toFixed(1)}d runway` : 'Stable'}
            </span>
          </div>
          <div className="text-xl font-black mt-1 font-mono tabular-nums">
            ৳ {netCashInHand.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Avg burn: ৳{avgDailyBazaarCost.toFixed(0)}/day</span>
          </div>
        </div>

        {/* KPI 2: Meal Rate */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Meal Rate</span>
            <span className="text-[10px] text-blue-600 font-mono font-bold">Active</span>
          </div>
          <div className="text-xl font-black text-blue-600 mt-1 font-mono tabular-nums">
            ৳ {currentMealRate.toFixed(4)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 truncate">
            ৳ {totalBazaarSpent.toLocaleString('en-IN')} ÷ {totalMealsCount.toFixed(1)} meals
          </div>
        </div>

        {/* KPI 3: Total Outflow */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Total Expenditure</span>
            <span className="text-[10px] text-slate-400 font-mono">Bazaar+Bills</span>
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono tabular-nums">
            ৳ {grandTotalCost.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Deposited: ৳{totalDepositsCollected.toLocaleString('en-IN')}
          </div>
        </div>

        {/* KPI 4: Outstanding Receivables */}
        <div className={`p-4 rounded-xl border ${
          totalOutstandingDues > 0 ? 'bg-rose-50/40 border-rose-200 text-rose-950' : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Receivables (Dues)</span>
            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded font-mono">
              {dueBoardersCount} members
            </span>
          </div>
          <div className="text-xl font-black text-rose-700 mt-1 font-mono tabular-nums">
            ৳ {totalOutstandingDues.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Surplus credit: ৳{totalSurplusCredit.toLocaleString('en-IN')}
          </div>
        </div>

        {/* KPI 5: Total Meals Volume */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Total Meals</span>
            <span className="text-[10px] text-slate-400 font-mono">Consumption</span>
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono tabular-nums">
            {totalMealsCount.toFixed(1)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Avg: {avgMealsPerDay.toFixed(1)} meals / day
          </div>
        </div>

        {/* KPI 6: Breakfast Compliance */}
        <div className={`p-4 rounded-xl border cursor-pointer hover:border-slate-400 transition-colors ${
          breakfastDefaulters.length > 0 ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200'
        }`}
        onClick={onOpenBreakfastModal}
        title="Click to open Breakfast Audit & Fines Modal"
        >
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
            <span>Breakfast Rule</span>
            <Coffee className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono tabular-nums">
            {breakfastComplianceRate.toFixed(0)}%
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
            <span className={breakfastDefaulters.length > 0 ? 'text-amber-800 font-semibold' : ''}>
              {breakfastDefaulters.length} under 16d
            </span>
            <span className="text-blue-600 hover:underline">Audit →</span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          SECTION 2: DATA VISUALIZATIONS & CHARTS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART 1: DAILY MEAL CONSUMPTION TIMELINE (2 COLUMNS) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-blue-600" />
                  <span>Daily Meal Consumption Timeline</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Kitchen attendance across {dailySeriesData.length} displayed day{dailySeriesData.length !== 1 ? 's' : ''} of {activeMonthStr}.
                </p>
              </div>

              {/* Legend & Hover Info */}
              <div className="flex items-center gap-3 text-xs">
                {hoveredChartDay ? (
                  <div className="bg-slate-900 text-white px-2.5 py-1 rounded-md text-xs font-mono tabular-nums flex items-center gap-2">
                    <span>Day {hoveredChartDay.dayNum}:</span>
                    <strong className="text-blue-300">{hoveredChartDay.meals} meals</strong>
                    <span className="text-slate-400">({hoveredChartDay.eatersCount} eaters)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-blue-600 rounded-xs inline-block" />
                      Meals Logged
                    </span>
                    <span className="flex items-center gap-1.5 font-mono tabular-nums">
                      <span className="w-3 h-0.5 border-t border-dashed border-slate-400 inline-block" />
                      Avg ({avgMealsPerDay.toFixed(1)})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Pure SVG Responsive Bar Chart */}
            <div className="mt-4 pt-2">
              <div className="relative h-44 sm:h-52 w-full">
                <svg
                  className="w-full h-full overflow-visible"
                  viewBox={`0 0 ${Math.max(1, dailySeriesData.length) * 14 + 16} 100`}
                  preserveAspectRatio="none"
                >
                  {/* Grid Lines */}
                  <line x1="0" y1="25" x2={Math.max(1, dailySeriesData.length) * 14 + 16} y2="25" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1="50" x2={Math.max(1, dailySeriesData.length) * 14 + 16} y2="50" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1="75" x2={Math.max(1, dailySeriesData.length) * 14 + 16} y2="75" stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1="99" x2={Math.max(1, dailySeriesData.length) * 14 + 16} y2="99" stroke="#CBD5E1" strokeWidth="1" />

                  {/* Daily Average Dotted Reference Line */}
                  {maxMealsOnDay > 0 && (
                    <line 
                      x1="0" 
                      y1={99 - (avgMealsPerDay / maxMealsOnDay) * 90} 
                      x2={Math.max(1, dailySeriesData.length) * 14 + 16} 
                      y2={99 - (avgMealsPerDay / maxMealsOnDay) * 90} 
                      stroke="#94A3B8" 
                      strokeWidth="0.8" 
                      strokeDasharray="3,3" 
                    />
                  )}

                  {/* Bars for Each Day */}
                  {dailySeriesData.map((d, index) => {
                    const barHeight = maxMealsOnDay > 0 ? (d.meals / maxMealsOnDay) * 90 : 0;
                    const x = index * 14 + 6;
                    const y = 99 - barHeight;
                    const isHovered = hoveredChartDay?.date === d.date;

                    return (
                      <g 
                        key={d.date} 
                        className="cursor-pointer transition-opacity"
                        onMouseEnter={() => setHoveredChartDay(d)}
                        onMouseLeave={() => setHoveredChartDay(null)}
                      >
                        <rect x={x - 2} y="0" width="14" height="100" fill="transparent" />
                        <rect 
                          x={x} 
                          y={y} 
                          width="9" 
                          height={Math.max(1, barHeight)} 
                          rx="1.5"
                          fill={isHovered ? '#1D4ED8' : d.meals > avgMealsPerDay * 1.2 ? '#2563EB' : '#60A5FA'}
                          className="transition-all duration-200"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Dynamic Day Labels Under Chart */}
              {dailySeriesData.length > 0 && (
                <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-400 mt-2 px-1">
                  <span>Day {dailySeriesData[0].dayNum}</span>
                  {dailySeriesData.length > 6 && (
                    <span>Day {dailySeriesData[Math.floor(dailySeriesData.length / 3)].dayNum}</span>
                  )}
                  {dailySeriesData.length > 3 && (
                    <span>Day {dailySeriesData[Math.floor((dailySeriesData.length * 2) / 3)].dayNum}</span>
                  )}
                  <span>Day {dailySeriesData[dailySeriesData.length - 1].dayNum}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
            <span>
              Peak Day: <strong className="text-slate-900 font-mono tabular-nums">{Math.max(0, ...dailySeriesData.map(d => d.meals))} meals</strong>
            </span>
            <span>
              Active Days: <strong className="text-slate-900 font-mono tabular-nums">{dailySeriesData.filter(d => d.meals > 0).length} of {dailySeriesData.length}</strong>
            </span>
            <button
              onClick={() => onNavigateToTab?.('meals')}
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              Open Daily Meal Log →
            </button>
          </div>
        </div>

        {/* CHART 2: EXPENDITURE BREAKDOWN (DONUT & PERCENTAGES) */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <PieChart className="w-4 h-4 text-purple-600" />
                <span>Cost Share Distribution</span>
              </h3>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                Monthly expenditure total: ৳{grandTotalCost.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Proportional Stack Bar */}
            <div className="mt-4">
              <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/60">
                {expenseCategories.map((cat, idx) => (
                  <div
                    key={idx}
                    style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                    title={`${cat.name}: ৳${cat.amount.toLocaleString('en-IN')} (${cat.percentage.toFixed(1)}%)`}
                    className="h-full transition-all duration-300"
                  />
                ))}
              </div>
            </div>

            {/* Itemized Legend List */}
            <div className="mt-4 space-y-2 overflow-y-auto max-h-56 pr-1 text-xs">
              {expenseCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium text-slate-700 truncate max-w-[130px]" title={cat.name}>
                      {cat.name}
                    </span>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <span className="font-semibold text-slate-900">৳ {cat.amount.toLocaleString('en-IN')}</span>
                    <span className="text-[11px] text-slate-400 ml-1.5">({cat.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono tabular-nums">Fixed Bills: ৳{totalFixedCost.toLocaleString('en-IN')}</span>
            <button
              onClick={() => onNavigateToTab?.('fixed')}
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              Manage Bills →
            </button>
          </div>
        </div>

      </div>

      {/* =========================================================================
          SECTION 3: DAILY BAZAAR SHOPPING & CASH OUTFLOW CURVE
          ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-emerald-600" />
              <span>Daily Bazaar Expense & Shopping Outflow</span>
            </h3>
            <p className="text-xs text-slate-500">
              Purchases across {currentMonthBazaars.length} shopping runs ({dailySeriesData.length}-day window).
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">
              Window Bazaar: <strong className="text-slate-900 font-mono tabular-nums">৳ {dailySeriesData.reduce((s, d) => s + d.bazaar, 0).toLocaleString('en-IN')}</strong>
            </span>
            {totalPendingShopDues > 0 && (
              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-mono tabular-nums text-[11px]">
                Pending Vendor Due: ৳{totalPendingShopDues.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* Bazaar Bar Wave SVG */}
        <div className="mt-4 pt-1">
          <div className="relative h-36 sm:h-44 w-full">
            <svg
              className="w-full h-full overflow-visible"
              viewBox={`0 0 ${Math.max(1, dailySeriesData.length) * 14 + 16} 100`}
              preserveAspectRatio="none"
            >
              <line x1="0" y1="50" x2={Math.max(1, dailySeriesData.length) * 14 + 16} y2="50" stroke="#F1F5F9" strokeWidth="0.8" />
              <line x1="0" y1="99" x2={Math.max(1, dailySeriesData.length) * 14 + 16} y2="99" stroke="#CBD5E1" strokeWidth="1" />

              {dailySeriesData.map((d, index) => {
                const barHeight = maxBazaarOnDay > 0 ? (d.bazaar / maxBazaarOnDay) * 90 : 0;
                const x = index * 14 + 6;
                const y = 99 - barHeight;

                return (
                  <g key={`bazaar-${d.date}`} className="cursor-pointer">
                    <title>{`Day ${d.dayNum}: ৳${d.bazaar.toLocaleString('en-IN')}`}</title>
                    <rect 
                      x={x} 
                      y={y} 
                      width="9" 
                      height={Math.max(barHeight > 0 ? 2 : 0, barHeight)} 
                      rx="1.5"
                      fill={d.bazaar > avgDailyBazaarCost * 1.5 ? '#059669' : '#34D399'}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {dailySeriesData.length > 0 && (
            <div className="flex justify-between text-[10px] font-mono tabular-nums text-slate-400 mt-2 px-1">
              <span>Day {dailySeriesData[0].dayNum}</span>
              {dailySeriesData.length > 6 && (
                <span>Day {dailySeriesData[Math.floor(dailySeriesData.length / 2)].dayNum}</span>
              )}
              <span>Day {dailySeriesData[dailySeriesData.length - 1].dayNum}</span>
            </div>
          )}
        </div>

        {/* Shoppers Summary Strip */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Top Shoppers:</span>
            {shopperStats.slice(0, 3).map((s, idx) => (
              <span key={s.boarderId} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium">
                {s.name}: <strong className="font-mono text-slate-900">৳{s.totalAmount.toLocaleString('en-IN')}</strong> ({s.count} runs)
              </span>
            ))}
          </div>

          <button
            onClick={() => onNavigateToTab?.('bazaar')}
            className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
          >
            Open Bazaar Ledger →
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: BOARDER FINANCIAL RISK MATRIX (EARLY WARNING)
          ========================================================================= */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
        
        {/* Header & Matrix Filter Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Member Financial Health & Receivables Matrix</span>
            </h3>
            <p className="text-xs text-slate-500">
              Ranked member balances to identify overdue accounts, zero-deposit warnings, and advance credits.
            </p>
          </div>

          {/* Search & Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search member or room..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-blue-500 focus:bg-white w-44"
              />
            </div>

            <div className="flex items-center gap-0.5 bg-slate-100 border border-slate-200/70 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setRiskFilter('all')}
                className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                  riskFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({boardersReport.length})
              </button>
              <button
                onClick={() => setRiskFilter('high_due')}
                className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                  riskFilter === 'high_due' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Heavy Due (&gt;৳1k)
              </button>
              <button
                onClick={() => setRiskFilter('zero_deposit')}
                className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                  riskFilter === 'zero_deposit' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Zero Deposit ({zeroDepositCount})
              </button>
              <button
                onClick={() => setRiskFilter('surplus')}
                className={`px-2.5 py-1 rounded-md cursor-pointer whitespace-nowrap shrink-0 ${
                  riskFilter === 'surplus' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Surplus ({surplusBoardersCount})
              </button>
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                <th className="p-2.5 text-center w-8">#</th>
                <th className="p-2.5">Member Name</th>
                <th className="p-2.5 text-center">Meals</th>
                <th className="p-2.5 text-right">Meal Cost</th>
                <th className="p-2.5 text-right">Fixed Bills</th>
                <th className="p-2.5 text-right">Total Charged</th>
                <th className="p-2.5 text-right">Total Paid</th>
                <th className="p-2.5 text-right">Current Balance</th>
                <th className="p-2.5 text-center">Status</th>
                <th className="p-2.5 text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredRiskBoarders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400">
                    No members match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredRiskBoarders.map((b, idx) => {
                  const bd = boarders.find(m => m.id === b.boarderId);
                  const isDue = b.balance < 0;
                  const isSevereDue = b.balance < -1500;
                  const isZeroDep = b.totalDeposit === 0 && b.totalMeals > 0;

                  return (
                    <tr key={b.boarderId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-2.5 text-center text-slate-400 font-mono tabular-nums">{idx + 1}</td>
                      <td className="p-2.5 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{b.boarderName}</span>
                          {bd?.roomNo && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium">
                              {bd.roomNo}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5 text-center font-semibold font-mono tabular-nums">{b.totalMeals}</td>
                      <td className="p-2.5 text-right font-mono tabular-nums text-slate-600">৳ {b.mealCost.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono tabular-nums text-slate-600">৳ {b.fixedCostShare.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono tabular-nums font-bold text-slate-900">৳ {b.totalCost.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono tabular-nums font-bold text-blue-700">৳ {b.totalDeposit.toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono tabular-nums font-bold">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${
                          isDue ? 'text-rose-700 bg-rose-50' : 'text-emerald-700 bg-emerald-50'
                        }`}>
                          {isDue ? '-' : '+'}৳ {Math.abs(b.balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        {isZeroDep ? (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded whitespace-nowrap">
                            Zero Deposit
                          </span>
                        ) : isSevereDue ? (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded whitespace-nowrap">
                            Heavy Due
                          </span>
                        ) : isDue ? (
                          <span className="text-[10px] bg-slate-100 text-slate-700 font-medium px-2 py-0.5 rounded whitespace-nowrap">
                            Standard Due
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded whitespace-nowrap">
                            Surplus
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        {isDue ? (
                          <button
                            onClick={() => handleCopyReminder(b)}
                            className="text-[11px] font-semibold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 w-full whitespace-nowrap"
                            title="Copy custom WhatsApp reminder message for this member"
                          >
                            {copiedMemberId === b.boarderId ? (
                              <span className="text-emerald-600 font-bold">Copied</span>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-slate-500" />
                                <span>Reminder</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Paid in Full</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* =========================================================================
          SECTION 5: SYNTHESIZED EXECUTIVE RECOMMENDATIONS & OPERATIONAL INSIGHTS
          ========================================================================= */}
      <div className="bg-slate-900 text-white rounded-xl p-5 sm:p-6 border border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Automated Operational Insights & Action Plan
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Rule-Based Audit Intelligence
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          
          {/* Insight 1: Cashflow Action */}
          <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-blue-300">
              <DollarSign className="w-4 h-4 text-blue-400" />
              <span>Cashflow Health</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {netCashInHand < 2000 
                ? `Cash buffer is critical at ৳${netCashInHand.toLocaleString('en-IN')}. Collect deposits from the ${dueBoardersCount} members with outstanding balances to fund daily bazaar.` 
                : `Healthy liquid reserve of ৳${netCashInHand.toLocaleString('en-IN')} available. Current funds can sustain ~${estimatedDaysRunway.toFixed(1)} days of regular bazaar without additional collections.`}
            </p>
          </div>

          {/* Insight 2: Meal Rate Stability */}
          <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Utensils className="w-4 h-4 text-emerald-400" />
              <span>Meal Rate Trajectory</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Active meal rate is <strong>৳{currentMealRate.toFixed(4)}</strong> per meal across {totalMealsCount.toFixed(1)} total meals. Consistently logging daily attendance keeps the meal rate mathematically transparent.
            </p>
          </div>

          {/* Insight 3: Policy Compliance */}
          <div className="bg-slate-800/80 border border-slate-700/80 p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>Breakfast Rule & Fines</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              {breakfastDefaulters.length > 0 
                ? `${breakfastDefaulters.length} boarder(s) have consumed breakfast on fewer than ${minBreakfastDays} days this month. Use the Breakfast Audit tool to verify and apply meal fines.` 
                : `100% compliance! All active boarders have met the ${minBreakfastDays}-day minimum breakfast requirement.`}
            </p>
          </div>

        </div>

        {/* Quick jump actions footer */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 border-t border-slate-800/80">
          <div className="flex items-center gap-4">
            <button
              onClick={onOpenBreakfastModal}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Breakfast Fines Audit</span>
              <ChevronRight className="w-3 h-3 text-slate-500" />
            </button>
            <button
              onClick={onOpenSpecialMealModal}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Special Feasts</span>
              <ChevronRight className="w-3 h-3 text-slate-500" />
            </button>
            <button
              onClick={onOpenReportModal}
              className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Printable PDF Report</span>
              <ChevronRight className="w-3 h-3 text-slate-500" />
            </button>
          </div>

          <span className="font-mono text-[10px] text-slate-500">
            MessMaster Enterprise Analytics Engine
          </span>
        </div>
      </div>

    </div>
  );
}
