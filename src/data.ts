import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings } from './types';

export const INITIAL_SETTINGS: MessSettings = {
  messName: "Green Valley Mess",
  currentMonth: "2026-07",
  managerPin: "1234",
  monthlyBudgetTarget: 22000,
};

export const INITIAL_MISC_COSTS: MiscellaneousCosts = {
  cookerBill: 2500,
  utilityBill: 1200,
  gasBill: 975,
  wifiBill: 500,
  houseRent: 8000,
  otherCosts: 300,
  customBills: [
    { id: "cb_waste", name: "Waste Disposal / Dustbin", amount: 150 },
    { id: "cb_news", name: "Newspaper & Welfare", amount: 100 }
  ]
};

export function generateSampleData() {
  const boarders: Boarder[] = [
    { id: "b1", name: "Md. Karim", roomNo: "Room 101", phone: "01712345678", isActive: true, joinedDate: "2026-07-01" },
    { id: "b2", name: "Abu Bakar", roomNo: "Room 102", phone: "01812345679", isActive: true, joinedDate: "2026-07-01" },
    { id: "b3", name: "Yeasin Arafat", roomNo: "Room 201", phone: "01912345680", isActive: true, joinedDate: "2026-07-01" },
    { id: "b4", name: "Shakib Al Hasan", roomNo: "Room 202", phone: "01512345681", isActive: true, joinedDate: "2026-07-01" },
    { id: "b5", name: "Tanvir Rahman", roomNo: "Room 301", phone: "01612345682", isActive: true, joinedDate: "2026-07-01" },
  ];

  const deposits: Deposit[] = [
    { id: "d1", boarderId: "b1", amount: 3500, date: "2026-07-01", note: "bKash Deposit", createdAt: "2026-07-01T10:15:00Z" },
    { id: "d2", boarderId: "b2", amount: 3000, date: "2026-07-01", note: "Cash", createdAt: "2026-07-01T11:30:00Z" },
    { id: "d3", boarderId: "b3", amount: 4000, date: "2026-07-01", note: "Cash", createdAt: "2026-07-01T14:45:00Z" },
    { id: "d4", boarderId: "b4", amount: 3500, date: "2026-07-02", note: "Bank Transfer", createdAt: "2026-07-02T09:20:00Z" },
    { id: "d5", boarderId: "b5", amount: 3000, date: "2026-07-01", note: "Rocket Deposit", createdAt: "2026-07-01T16:10:00Z" },
    
    { id: "d6", boarderId: "b1", amount: 1500, date: "2026-07-15", note: "Cash (2nd Installment)", createdAt: "2026-07-15T18:00:00Z" },
    { id: "d7", boarderId: "b2", amount: 2000, date: "2026-07-14", note: "bKash", createdAt: "2026-07-14T12:10:00Z" },
    { id: "d8", boarderId: "b4", amount: 1000, date: "2026-07-18", note: "Cash", createdAt: "2026-07-18T19:30:00Z" },
    { id: "d9", boarderId: "b5", amount: 2000, date: "2026-07-12", note: "bKash", createdAt: "2026-07-12T15:45:00Z" },
  ];

  const bazaarCosts: BazaarCost[] = [
    { id: "c1", date: "2026-07-01", amount: 850, description: "Rice (25kg), Soyabean Oil (2L)", spentById: "b1" },
    { id: "c2", date: "2026-07-03", amount: 550, description: "Chicken (2kg), Eggs (12 pcs)", spentById: "b2" },
    { id: "c3", date: "2026-07-06", amount: 420, description: "Fish (Rui), Potatoes, Onions", spentById: "b3" },
    { id: "c4", date: "2026-07-09", amount: 650, description: "Beef (1kg), Spices, Garlic", spentById: "b4" },
    { id: "c5", date: "2026-07-12", amount: 380, description: "Chicken, Lentils (Dal), Green Chilli", spentById: "b5" },
    { id: "c6", date: "2026-07-15", amount: 920, description: "Rice (25kg), Soyabean Oil, Eggs (24 pcs)", spentById: "b1" },
    { id: "c7", date: "2026-07-18", amount: 480, description: "Fish, Vegetables (Pumpkin, Brinjal)", spentById: "b2" },
    { id: "c8", date: "2026-07-21", amount: 580, description: "Chicken, Potato, Onions, Salt", spentById: "b3" },
    { id: "c9", date: "2026-07-24", amount: 350, description: "Eggs (30 pcs), Dal, Lemon", spentById: "b4" },
    { id: "c10", date: "2026-07-27", amount: 720, description: "Beef (1kg), Vegetables, Salad", spentById: "b5" },
  ];

  // Programmatically generate meal logs for July 1st to July 28th
  const mealLogs: DailyMealLog[] = [];
  
  for (let day = 1; day <= 28; day++) {
    const dateStr = `2026-07-${day < 10 ? '0' + day : day}`;
    const meals: Record<string, number> = {};
    
    boarders.forEach((b) => {
      // Simulate random but realistic meal pattern (breakfast: 0.5, lunch: 1, dinner: 1)
      // Friday (day % 7 === 5 or 6) might have fewer meals as boarders go home
      const isWeekend = day % 7 === 5 || day % 7 === 6;
      if (isWeekend) {
        if (b.id === "b3") {
          // Boarder 3 goes home on weekends (0 meals)
          meals[b.id] = 0;
        } else {
          // Others eat some meals
          meals[b.id] = Math.random() > 0.3 ? (Math.random() > 0.5 ? 2 : 1.5) : 0;
        }
      } else {
        // Weekdays: Karim (b1) and Bakar (b2) eat regularly
        if (b.id === "b1" || b.id === "b2") {
          meals[b.id] = 2.5; // breakfast + lunch + dinner
        } else {
          // Others random daily variation: 1.5, 2.0 or 2.5
          meals[b.id] = [1.5, 2.0, 2.5][(day + b.name.length) % 3];
        }
      }
    });

    let note: string | undefined = undefined;
    if (day === 10) {
      note = 'Special Friday Feast';
    } else if (day === 20) {
      note = 'Guest Invitation & Dinner';
    }

    mealLogs.push({
      date: dateStr,
      meals,
      note,
      updatedAt: `${dateStr}T21:30:00Z`
    });
  }

  return {
    boarders,
    deposits,
    bazaarCosts,
    mealLogs,
    miscCosts: INITIAL_MISC_COSTS,
    settings: INITIAL_SETTINGS
  };
}
