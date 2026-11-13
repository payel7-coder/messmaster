import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  DollarSign, 
  Utensils, 
  Calendar, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Clock, 
  StickyNote, 
  CheckCircle2, 
  Filter,
  User,
  Home
} from 'lucide-react';
import { Boarder, Deposit, DailyMealLog } from '../types';
import { formatReadableDate } from '../utils';

interface RecentActivitiesSectionProps {
  deposits: Deposit[];
  mealLogs: DailyMealLog[];
  boarders: Boarder[];
  currentMonth: string;
  onNavigateToTab: (tab: 'deposits' | 'meals') => void;
  onSelectMealDate: (date: string) => void;
}

export type ActivityType = 'all' | 'deposits' | 'meals';

interface UnifiedActivity {
  id: string;
  type: 'deposit' | 'meal';
  dateStr: string; // YYYY-MM-DD
  rawTimestamp: number; // for sorting
  timestampDisplay: string;
  title: string;
  subtitle: string;
  badgeText: string;
  badgeStyle: 'emerald' | 'blue';
  note?: string;
  roomNo?: string;
  boarderName?: string;
  boarderId?: string;
  amount?: number;
  totalMeals?: number;
  eatersCount?: number;
}

export default function RecentActivitiesSection({
  deposits,
  mealLogs,
  boarders,
  currentMonth,
  onNavigateToTab,
  onSelectMealDate
}: RecentActivitiesSectionProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<ActivityType>('all');
  const [scopeMonthOnly, setScopeMonthOnly] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Helper to format ISO timestamp or date into friendly readable string
  const formatFriendlyTimestamp = (dateStr: string, isoTimestamp?: string): string => {
    if (isoTimestamp) {
      try {
        const d = new Date(isoTimestamp);
        if (!isNaN(d.getTime())) {
          const today = new Date();
          const isToday = d.toDateString() === today.toDateString();
          const yesterday = new Date();
          yesterday.setDate(today.getDate() - 1);
          const isYesterday = d.toDateString() === yesterday.toDateString();

          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (isToday) return `Today, ${timeStr}`;
          if (isYesterday) return `Yesterday, ${timeStr}`;

          return `${formatReadableDate(dateStr)}, ${timeStr}`;
        }
      } catch {
        // fallback
      }
    }
    return formatReadableDate(dateStr);
  };

  // Compile unified chronological audit trail
  const activities: UnifiedActivity[] = useMemo(() => {
    const list: UnifiedActivity[] = [];

    // 1. Process Deposits
    deposits.forEach((dep) => {
      if (scopeMonthOnly && !dep.date.startsWith(currentMonth)) {
        return;
      }

      const boarder = boarders.find(b => b.id === dep.boarderId);
      const boarderName = boarder?.name || 'Unknown Boarder';
      const roomNo = boarder?.roomNo;
      
      const parsedTime = dep.createdAt ? new Date(dep.createdAt).getTime() : new Date(`${dep.date}T12:00:00`).getTime();
      const timestampDisplay = formatFriendlyTimestamp(dep.date, dep.createdAt);

      list.push({
        id: `act_dep_${dep.id}`,
        type: 'deposit',
        dateStr: dep.date,
        rawTimestamp: isNaN(parsedTime) ? 0 : parsedTime,
        timestampDisplay,
        title: `Deposit received: +৳${dep.amount.toLocaleString('en-IN')}`,
        subtitle: `Deposited by ${boarderName}${roomNo ? ` (${roomNo})` : ''}`,
        badgeText: `+৳${dep.amount.toLocaleString('en-IN')}`,
        badgeStyle: 'emerald',
        note: dep.note,
        roomNo,
        boarderName,
        boarderId: dep.boarderId,
        amount: dep.amount
      });
    });

    // 2. Process Meal Logs (only days with meals entered or notes)
    mealLogs.forEach((log) => {
      if (scopeMonthOnly && !log.date.startsWith(currentMonth)) {
        return;
      }

      const activeIds = new Set(boarders.filter(b => b.isActive).map(b => b.id));
      const boarderMeals = Object.entries(log.meals || {});
      const totalMeals = boarderMeals
        .filter(([bId]) => activeIds.has(bId))
        .reduce((sum, [, count]) => sum + count, 0);

      const eatersCount = boarderMeals
        .filter(([bId, count]) => activeIds.has(bId) && count > 0).length;

      // Only display if meals were actually logged or a special note exists
      if (totalMeals === 0 && !log.note) {
        return;
      }

      const parsedTime = log.updatedAt ? new Date(log.updatedAt).getTime() : new Date(`${log.date}T20:00:00`).getTime();
      const timestampDisplay = formatFriendlyTimestamp(log.date, log.updatedAt);

      list.push({
        id: `act_meal_${log.date}`,
        type: 'meal',
        dateStr: log.date,
        rawTimestamp: isNaN(parsedTime) ? 0 : parsedTime,
        timestampDisplay,
        title: `Daily Meal Register: ${totalMeals} meals logged`,
        subtitle: `${eatersCount} boarders served • ${formatReadableDate(log.date)}`,
        badgeText: `${totalMeals} Meals`,
        badgeStyle: 'blue',
        note: log.note,
        totalMeals,
        eatersCount
      });
    });

    // Sort descending (newest timestamp / date first)
    list.sort((a, b) => {
      if (b.rawTimestamp !== a.rawTimestamp) {
        return b.rawTimestamp - a.rawTimestamp;
      }
      return b.dateStr.localeCompare(a.dateStr);
    });

    return list;
  }, [deposits, mealLogs, boarders, currentMonth, scopeMonthOnly]);

  // Filter based on selected filter and search query
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Type filter
      if (filterType === 'deposits' && act.type !== 'deposit') return false;
      if (filterType === 'meals' && act.type !== 'meal') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = act.title.toLowerCase().includes(q);
        const matchSub = act.subtitle.toLowerCase().includes(q);
        const matchBoarder = act.boarderName?.toLowerCase().includes(q) || false;
        const matchRoom = act.roomNo?.toLowerCase().includes(q) || false;
        const matchNote = act.note?.toLowerCase().includes(q) || false;
        const matchDate = act.dateStr.toLowerCase().includes(q) || act.timestampDisplay.toLowerCase().includes(q);
        const matchAmount = act.amount?.toString().includes(q) || false;

        if (!matchTitle && !matchSub && !matchBoarder && !matchRoom && !matchNote && !matchDate && !matchAmount) {
          return false;
        }
      }

      return true;
    });
  }, [activities, filterType, searchQuery]);

  // Summary counts
  const totalDepositsCount = activities.filter(a => a.type === 'deposit').length;
  const totalMealsCount = activities.filter(a => a.type === 'meal').length;
  const totalDepositAmount = filteredActivities
    .filter(a => a.type === 'deposit')
    .reduce((sum, a) => sum + (a.amount || 0), 0);
  const totalMealsSum = filteredActivities
    .filter(a => a.type === 'meal')
    .reduce((sum, a) => sum + (a.totalMeals || 0), 0);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden transition-all">
      {/* Top Header / Bar */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200/80">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                Recent Activities
              </h3>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-xs font-mono text-slate-500 font-medium tabular-nums">
                {activities.length} Events
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Timestamped audit trail of latest deposits & meal logs
            </p>
          </div>
        </div>

        {/* Quick controls on the right */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Month scope toggle */}
          <button
            onClick={() => setScopeMonthOnly(!scopeMonthOnly)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              scopeMonthOnly
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle between current billing month and all records"
          >
            {scopeMonthOnly ? 'Active Month Only' : 'All Records'}
          </button>

          {/* Minimize / Expand Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            title={isExpanded ? 'Collapse Activities' : 'Expand Activities'}
            id="btn-toggle-recent-activities"
          >
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Expanded Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-3.5 animate-fadeIn">
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setFilterType('all')}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                  filterType === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({activities.length})
              </button>
              <button
                onClick={() => setFilterType('deposits')}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                  filterType === 'deposits'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Deposits ({totalDepositsCount})
              </button>
              <button
                onClick={() => setFilterType('meals')}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                  filterType === 'meals'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                Meal Logs ({totalMealsCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member, room, note, or date..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick Auditing Metrics Bar */}
          <div className="flex flex-wrap items-center justify-between text-[11px] font-medium text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 gap-2">
            <div className="flex items-center gap-4">
              <span>
                Audited Deposits: <strong className="text-emerald-700">৳ {totalDepositAmount.toLocaleString('en-IN')}</strong>
              </span>
              <span>•</span>
              <span>
                Audited Meals: <strong className="text-blue-700">{totalMealsSum.toFixed(1)} meals</strong>
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Showing {filteredActivities.length} matching audit logs
            </span>
          </div>

          {/* Scrollable Activities Feed */}
          <div 
            id="recent-activities-scroll-feed"
            className="max-h-72 sm:max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-2xs"
          >
            {filteredActivities.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No activities found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {searchQuery 
                    ? `No entries matched "${searchQuery}". Try clearing search.`
                    : 'No deposits or meal logs recorded for this period yet.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    Clear Search Filter
                  </button>
                )}
              </div>
            ) : (
              filteredActivities.map((act) => {
                const isDeposit = act.type === 'deposit';

                return (
                  <div
                    key={act.id}
                    className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group"
                  >
                    {/* Left: Icon & Main Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Event Type Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isDeposit
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {isDeposit ? (
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Utensils className="w-4 h-4 text-blue-600" />
                        )}
                      </div>

                      {/* Text content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">
                            {isDeposit ? act.boarderName : 'Meal Consumption Entry'}
                          </span>

                          {act.roomNo && (
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                              <Home className="w-2.5 h-2.5 text-slate-400" />
                              {act.roomNo}
                            </span>
                          )}

                          <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded-md tracking-wider ${
                            isDeposit 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isDeposit ? 'Deposit' : 'Meal Register'}
                          </span>
                        </div>

                        {/* Subtitle & details */}
                        <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {act.timestampDisplay}
                          </span>

                          {act.note && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.2 rounded-md text-[10px] font-medium max-w-xs truncate">
                              <StickyNote className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              <span className="truncate">{act.note}</span>
                            </span>
                          )}

                          {!isDeposit && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              • {act.eatersCount} boarders served
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amount/Meals Badge & Quick Audit Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pl-11 sm:pl-0">
                      <div className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border ${
                        isDeposit
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        {act.badgeText}
                      </div>

                      {/* Direct Audit jump button */}
                      {isDeposit ? (
                        <button
                          onClick={() => onNavigateToTab('deposits')}
                          className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                          title="Open Deposits ledger to verify"
                        >
                          <span>Audit</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onSelectMealDate(act.dateStr);
                            onNavigateToTab('meals');
                          }}
                          className="text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                          title={`Jump to meal register for ${act.dateStr}`}
                        >
                          <span>Audit & Edit</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
