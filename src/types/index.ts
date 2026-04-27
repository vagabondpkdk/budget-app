export type CardOwner = "Kyle" | "Ella" | "Both";

export type Card = {
  id: string;
  name: string;
  owner: CardOwner;
  color: string;
  bank: string;
  type: "credit" | "debit" | "saving" | "cash";
  isActive: boolean;
  payDueDay?: number;
  lastFourDigits?: string;
};

export type Category =
  | "Home Usage" | "Food" | "Gas" | "Shopping" | "Market"
  | "Saipan" | "Travel" | "Bill" | "Date" | "Vehicle"
  | "Cash Back" | "Statement Credit" | "From Korea"
  | "Subscriptions" | "Exchange Currency" | "Fine"
  | "Tax" | "Refund" | "ETC" | "Payment" | "Immigration"
  | "Investment" | "Adjustment" | "Income" | "Interest"
  | "Incentive" | "Bonus" | "Recycle" | "Apple Cash";

export type TransactionType = "expense" | "income" | "payment" | "cashback" | "interest" | "refund";

export type Transaction = {
  id: string;
  date: string; // ISO "2024-01-01"
  category: Category;
  note: string;
  amount: number; // positive=expense, negative=income/cashback
  cardId: string;
  user: "Kyle" | "Ella" | "Both" | "SA";
  type: TransactionType;
  isRecurring?: boolean;
};

export type MonthlySummary = {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  totalSaving: number;
  savingRate: number;
  previousAsset: number;
  currentAsset: number;
  debt: number;
  transactions: Transaction[];
};

export type MonthlyAsset = {
  month: number;
  year: number;
  apple_saving: number;
  capital_one: number;
  chase_checking: number;
  cash: number;
  mia_debt: number;
  need_to_pay: number;
};

export type Tab = "dashboard" | "daily" | "cards" | "analytics" | "add";
