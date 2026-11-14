import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, MonthReport, BoarderSummary, SpecialMeal, MealBreakdown } from './types';

/**
 * Checks if a YYYY-MM-DD date string belongs to the active YYYY-MM month.
 */
export function isSameMonth(dateStr: string, activeMonth: string): boolean {
  return dateStr.startsWith(activeMonth);
}

/**
 * Calculates the complete financial and meal report for the mess for a specific month.
 * Special feast / special meals are excluded from the regular daily meal rate, and their
 * cost is distributed strictly among the participating members who ate that meal.
 */
export function calculateReport(
  boarders: Boarder[],
  deposits: Deposit[],
  mealLogs: DailyMealLog[],
  bazaarCosts: BazaarCost[],
  miscCosts: MiscellaneousCosts,
  settings: MessSettings,
  specialMeals?: SpecialMeal[]
): MonthReport {
  const activeMonth = settings.currentMonth;
  const activeBoarders = boarders.filter(b => b.isActive);
  const activeBoarderIds = new Set(activeBoarders.map(b => b.id));

  // Identify special meals active in this month
  const monthSpecialMeals = (specialMeals || settings.specialMeals || []).filter(sm => isSameMonth(sm.date, activeMonth));
  const specialBazaarIds = new Set(
    monthSpecialMeals.map(sm => sm.bazaarCostId).filter(Boolean) as string[]
  );

  // 1. Filter and Sum Regular Bazaar Costs (Excluding Special Feast Meals)
  const filteredBazaar = bazaarCosts.filter(c => isSameMonth(c.date, activeMonth));
  const regularBazaar = filteredBazaar.filter(c => !c.isSpecialMeal && !specialBazaarIds.has(c.id));
  const totalBazaarCost = regularBazaar.reduce((sum, item) => sum + item.amount, 0);

  // Total special meals / feast cost for the month
  const totalSpecialMealCost = Number(
    monthSpecialMeals.reduce((sum, sm) => sum + (sm.totalCost || 0), 0).toFixed(2)
  );

  // 2. Filter and Sum Meals
  const filteredMeals = mealLogs.filter(log => isSameMonth(log.date, activeMonth));
  
  // Calculate total meals of all active boarders
  let totalMeals = 0;
  const boarderMealCounts: Record<string, number> = {};
  
  // Initialize
  boarders.forEach(b => {
    boarderMealCounts[b.id] = 0;
  });

  filteredMeals.forEach(log => {
    Object.entries(log.meals).forEach(([boarderId, count]) => {
      // Only count meals for boarders that exist
      if (boarderMealCounts[boarderId] !== undefined) {
        boarderMealCounts[boarderId] += count;
        // Only add to total meals if the boarder is currently active in calculations
        if (activeBoarderIds.has(boarderId)) {
          totalMeals += count;
        }
      }
    });
  });

  // 3. Calculate Regular Meal Rate (Taka per meal) - strictly using regular bazaar costs
  const mealRate = totalMeals > 0 ? Number((totalBazaarCost / totalMeals).toFixed(4)) : 0;

  // 4. Calculate Shared Fixed Costs
  const customBillsTotal = (miscCosts.customBills || []).reduce(
    (sum, bill) => sum + (Number(bill.amount) || 0),
    0
  );

  const totalFixedCost = 
    miscCosts.cookerBill + 
    miscCosts.utilityBill + 
    miscCosts.gasBill + 
    miscCosts.wifiBill + 
    miscCosts.houseRent + 
    miscCosts.otherCosts + 
    customBillsTotal;

  const fixedCostShare = activeBoarders.length > 0 ? Number((totalFixedCost / activeBoarders.length).toFixed(2)) : 0;

  // 5. Filter and Sum Deposits
  const filteredDeposits = deposits.filter(d => isSameMonth(d.date, activeMonth));
  const boarderDeposits: Record<string, number> = {};
  
  boarders.forEach(b => {
    boarderDeposits[b.id] = 0;
  });

  filteredDeposits.forEach(d => {
    if (boarderDeposits[d.boarderId] !== undefined) {
      boarderDeposits[d.boarderId] += d.amount;
    }
  });

  const totalDeposits = filteredDeposits.reduce((sum, item) => sum + item.amount, 0);

  // 6. Build Individual Summaries with Special Meal Distribution
  const boardersReport: BoarderSummary[] = boarders.map(b => {
    const isBoarderActive = b.isActive;
    const meals = boarderMealCounts[b.id] || 0;
    
    // Regular meal cost
    const mealCost = isBoarderActive ? Number((meals * mealRate).toFixed(2)) : 0;
    const share = isBoarderActive ? fixedCostShare : 0;

    // Distribute special meal costs ONLY among boarders who participated
    let boarderSpecialMealShare = 0;
    monthSpecialMeals.forEach(sm => {
      if (sm.participantIds.includes(b.id)) {
        const participantCount = sm.participantIds.length;
        const individualShare = sm.customShares?.[b.id] !== undefined
          ? sm.customShares[b.id]
          : (participantCount > 0 ? (sm.totalCost / participantCount) : 0);
        boarderSpecialMealShare += individualShare;
      }
    });

    const specialMealCost = Number(boarderSpecialMealShare.toFixed(2));
    const totalCost = Number((mealCost + share + specialMealCost).toFixed(2));
    const totalDep = boarderDeposits[b.id] || 0;
    const balance = Number((totalDep - totalCost).toFixed(2));

    return {
      boarderId: b.id,
      boarderName: b.name,
      roomNo: b.roomNo,
      totalMeals: meals,
      mealCost,
      fixedCostShare: share,
      specialMealCost,
      totalCost,
      totalDeposit: totalDep,
      balance,
    };
  });

  return {
    month: activeMonth,
    totalMeals: Number(totalMeals.toFixed(1)),
    totalBazaarCost,
    totalSpecialMealCost,
    mealRate,
    totalFixedCost,
    totalDeposits,
    boardersReport,
    specialMeals: monthSpecialMeals,
  };
}

/**
 * Gets dates for a given month (YYYY-MM).
 * Returns array of YYYY-MM-DD strings.
 */
export function getDatesInMonth(yearMonth: string): string[] {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed (1-12)
  
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    dates.push(`${yearMonth}-${dayStr}`);
  }
  
  return dates;
}

/**
 * Formats a date to a readable string (e.g. "06 Jul 2026")
 */
export function formatReadableDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format month string (e.g. "2026-07" -> "July, 2026")
 */
export function formatReadableMonth(yearMonth: string): string {
  try {
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return yearMonth;
  }
}

/**
 * Resolves a boarder's slot breakdown (breakfast, lunch, dinner) for a day.
 * Uses explicit `mealBreakdown` when available, and gracefully infers slots for legacy numeric logs.
 */
export function getBoarderMealBreakdown(log: DailyMealLog | undefined, boarderId: string): MealBreakdown {
  const explicit = log?.mealBreakdown?.[boarderId];
  if (explicit) {
    return {
      breakfast: Math.max(0, Number(explicit.breakfast) || 0),
      lunch: Math.max(0, Number(explicit.lunch) || 0),
      dinner: Math.max(0, Number(explicit.dinner) || 0),
    };
  }

  const total = Math.max(0, Number(log?.meals?.[boarderId]) || 0);
  if (total === 0) {
    return { breakfast: 0, lunch: 0, dinner: 0 };
  }

  const rem = Number((total % 1).toFixed(2));
  const hasHalf = rem >= 0.45 && rem <= 0.55;
  const breakfast = hasHalf ? 0.5 : 0;
  const remaining = Number((total - breakfast).toFixed(2));
  const lunch = remaining >= 1 ? 1 : remaining;
  const dinner = Number(Math.max(0, remaining - lunch).toFixed(2));

  return { breakfast, lunch, dinner };
}

/**
 * Determines whether a boarder ate breakfast on a given daily log.
 * Checks explicit `mealBreakdown[boarderId].breakfast > 0` first (supports 2+ breakfasts such as 1.0),
 * falling back to the legacy `.5` remainder rule for older logs without slot breakdown.
 */
export function didBoarderEatBreakfast(log: DailyMealLog | undefined, boarderId: string): boolean {
  if (!log) return false;

  const explicit = log.mealBreakdown?.[boarderId];
  if (explicit !== undefined) {
    return (Number(explicit.breakfast) || 0) > 0;
  }

  const mealCount = Number(log.meals?.[boarderId]) || 0;
  if (mealCount <= 0) return false;
  const rem = Number((mealCount % 1).toFixed(2));
  return rem >= 0.45 && rem <= 0.55;
}

/**
 * Returns the breakfast meal units for a boarder on a given day (e.g., 0, 0.5, 1.0 for 2x breakfast).
 */
export function getBreakfastMealCount(log: DailyMealLog | undefined, boarderId: string): number {
  if (!log) return 0;

  const explicit = log.mealBreakdown?.[boarderId];
  if (explicit !== undefined) {
    return Math.max(0, Number(explicit.breakfast) || 0);
  }

  const mealCount = Number(log.meals?.[boarderId]) || 0;
  if (mealCount <= 0) return 0;
  const rem = Number((mealCount % 1).toFixed(2));
  return rem >= 0.45 && rem <= 0.55 ? 0.5 : 0;
}

