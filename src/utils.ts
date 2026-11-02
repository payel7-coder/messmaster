import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, MonthReport, BoarderSummary } from './types';

/**
 * Checks if a YYYY-MM-DD date string belongs to the active YYYY-MM month.
 */
export function isSameMonth(dateStr: string, activeMonth: string): boolean {
  return dateStr.startsWith(activeMonth);
}

/**
 * Calculates the complete financial and meal report for the mess for a specific month.
 */
export function calculateReport(
  boarders: Boarder[],
  deposits: Deposit[],
  mealLogs: DailyMealLog[],
  bazaarCosts: BazaarCost[],
  miscCosts: MiscellaneousCosts,
  settings: MessSettings
): MonthReport {
  const activeMonth = settings.currentMonth;
  const activeBoarders = boarders.filter(b => b.isActive);
  const activeBoarderIds = new Set(activeBoarders.map(b => b.id));

  // 1. Filter and Sum Bazaar Costs
  const filteredBazaar = bazaarCosts.filter(c => isSameMonth(c.date, activeMonth));
  const totalBazaarCost = filteredBazaar.reduce((sum, item) => sum + item.amount, 0);

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

  // 3. Calculate Meal Rate (Taka per meal)
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

  // 6. Build Individual Summaries
  const boardersReport: BoarderSummary[] = boarders.map(b => {
    const isBoarderActive = b.isActive;
    const meals = boarderMealCounts[b.id] || 0;
    
    // An inactive boarder might have meals logged or deposits made, but usually doesn't share fixed costs
    const mealCost = isBoarderActive ? Number((meals * mealRate).toFixed(2)) : 0;
    const share = isBoarderActive ? fixedCostShare : 0;
    const totalCost = Number((mealCost + share).toFixed(2));
    const totalDep = boarderDeposits[b.id] || 0;
    const balance = Number((totalDep - totalCost).toFixed(2));

    return {
      boarderId: b.id,
      boarderName: b.name,
      roomNo: b.roomNo,
      totalMeals: meals,
      mealCost,
      fixedCostShare: share,
      totalCost,
      totalDeposit: totalDep,
      balance,
    };
  });

  return {
    month: activeMonth,
    totalMeals: Number(totalMeals.toFixed(1)),
    totalBazaarCost,
    mealRate,
    totalFixedCost,
    totalDeposits,
    boardersReport,
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
