export interface Boarder {
  id: string;
  name: string;
  roomNo?: string; // e.g. "Room 201", "302-B"
  phone?: string;
  isActive: boolean;
  joinedDate: string; // YYYY-MM-DD
}

export interface Deposit {
  id: string;
  boarderId: string;
  amount: number; // in Taka
  date: string; // YYYY-MM-DD
  note?: string; // e.g. Cash, bKash, Rocket
  createdAt?: string; // ISO timestamp for audit log
}

export interface DailyMealLog {
  date: string; // YYYY-MM-DD
  meals: Record<string, number>; // boarderId -> number of meals (e.g., 0.5, 1, 2, 2.5)
  note?: string; // Optional context like 'Special Lunch', 'Guest Invitation', 'Feast'
  updatedAt?: string; // ISO timestamp for audit log
}

export interface BazaarCost {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // in Taka
  description: string; // items bought
  spentById: string; // boarder ID who spent it (defaults to manager/general)
}

export interface CustomFixedBill {
  id: string;
  name: string; // Category name (e.g., "Dustbin / Waste", "Newspaper", "Security Guard", "Water Jar")
  amount: number; // in Taka
}

export interface MiscellaneousCosts {
  cookerBill: number;
  utilityBill: number; // electricity, water
  gasBill: number;
  wifiBill: number;
  houseRent: number;
  otherCosts: number;
  customBills?: CustomFixedBill[]; // Optional additional categories for fixed bills
}

export interface MessSettings {
  messName: string;
  currentMonth: string; // YYYY-MM (e.g., "2026-07")
  managerPin?: string; // Optional custom PIN for manager authentication (defaults to "1234")
  monthlyBudgetTarget?: number; // Target total monthly expenditure in Taka
}

export interface BoarderSummary {
  boarderId: string;
  boarderName: string;
  roomNo?: string;
  totalMeals: number;
  mealCost: number;
  fixedCostShare: number;
  totalCost: number;
  totalDeposit: number;
  balance: number; // deposit - totalCost (positive is surplus, negative is due)
}

export interface MonthReport {
  month: string;
  totalMeals: number;
  totalBazaarCost: number;
  mealRate: number;
  totalFixedCost: number;
  totalDeposits: number;
  boardersReport: BoarderSummary[];
}
