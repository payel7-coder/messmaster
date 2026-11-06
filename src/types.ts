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
  amount: number; // Total purchase cost in Taka
  description: string; // items bought
  spentById: string; // boarder ID who spent it (defaults to manager/general)
  paidAmount?: number; // Cash actually paid at the time of shopping
  dueAmount?: number; // Outstanding / credit purchase amount (baki)
  dueShopName?: string; // Shop or vendor name (e.g. "Bhai Bhai Grocery", "Ratan Meat")
  isDueSettled?: boolean; // Whether the due has been adjusted / cleared from cash
  settledDate?: string; // Date when due was adjusted to cash (YYYY-MM-DD)
  settledNote?: string; // Optional note regarding cash adjustment
}

export interface CustomFixedBill {
  id: string;
  name: string; // Category name (e.g., "Dustbin / Waste", "Newspaper", "Security Guard", "Water Jar")
  amount: number; // in Taka
  paidFromCash?: boolean; // Whether this bill was given/paid directly from mess cash
  paidDate?: string; // Optional payment date
  paidNote?: string; // Optional note
}

export type StandardFixedBillKey = 'cookerBill' | 'utilityBill' | 'gasBill' | 'wifiBill' | 'houseRent' | 'otherCosts';

export interface MiscellaneousCosts {
  cookerBill: number;
  utilityBill: number; // electricity, water
  gasBill: number;
  wifiBill: number;
  houseRent: number;
  otherCosts: number;
  customBills?: CustomFixedBill[]; // Optional additional categories for fixed bills
  paidFromCash?: {
    cookerBill?: boolean;
    utilityBill?: boolean;
    gasBill?: boolean;
    wifiBill?: boolean;
    houseRent?: boolean;
    otherCosts?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface BreakfastFineRecord {
  id: string;
  boarderId: string;
  month: string; // YYYY-MM
  breakfastDays: number;
  shortfallDays: number;
  fineMeals: number; // Penalty meals applied
  dateApplied: string; // YYYY-MM-DD
  appliedAt: string; // ISO timestamp
  note?: string;
}

export interface MessSettings {
  messName: string;
  currentMonth: string; // YYYY-MM (e.g., "2026-07")
  managerPin?: string; // Optional custom PIN for manager authentication (defaults to "1234")
  monthlyBudgetTarget?: number; // Target total monthly expenditure in Taka
  registeredManagerEmails?: string[]; // Authorized manager emails eligible for Google SSO
  minBreakfastDays?: number; // Minimum breakfast days required per month (defaults to 16)
  breakfastFines?: BreakfastFineRecord[]; // History of applied breakfast shortfall meal fines
}

export interface RegisteredManager {
  email: string;
  name?: string;
  role: 'primary' | 'manager';
  addedAt: string;
  addedBy?: string;
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
