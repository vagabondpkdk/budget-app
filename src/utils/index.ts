import type { Transaction, Category } from '../types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, getWeek } from 'date-fns';

export function formatCurrency(amount: number, showSign = false): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  if (showSign && amount < 0) return `+${formatted}`;
  if (showSign && amount > 0) return `-${formatted}`;
  return formatted;
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

export function getWeekNumber(date: Date): number {
  return getWeek(date, { weekStartsOn: 0 });
}

export function groupByDate(transactions: Transaction[]): Record<string, Transaction[]> {
  return transactions.reduce((acc, t) => {
    if (!acc[t.date]) acc[t.date] = [];
    acc[t.date].push(t);
    return acc;
  }, {} as Record<string, Transaction[]>);
}

export function getWeekRange(date: Date) {
  return {
    start: startOfWeek(date, { weekStartsOn: 0 }),
    end: endOfWeek(date, { weekStartsOn: 0 }),
  };
}

export function getDaysInWeek(date: Date): Date[] {
  const { start, end } = getWeekRange(date);
  return eachDayOfInterval({ start, end });
}

export function generateId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const CATEGORY_ICONS: Record<Category, string> = {
  "Home Usage": "🏠",
  "Food": "🍔",
  "Gas": "⛽",
  "Shopping": "🛍️",
  "Market": "🛒",
  "Saipan": "🌊",
  "Travel": "✈️",
  "Bill": "📄",
  "Date": "💑",
  "Vehicle": "🚗",
  "Cash Back": "💰",
  "Statement Credit": "📋",
  "From Korea": "🇰🇷",
  "Subscriptions": "📱",
  "Exchange Currency": "💱",
  "Fine": "⚖️",
  "Tax": "💸",
  "Refund": "↩️",
  "ETC": "💼",
  "Payment": "💳",
  "Immigration": "🛂",
  "Investment": "📈",
  "Adjustment": "🔧",
  "Income": "💵",
  "Interest": "🏦",
  "Incentive": "🎁",
  "Bonus": "⭐",
  "Recycle": "♻️",
  "Apple Cash": "🍎",
};

export function getCategoryIcon(category: Category): string {
  return CATEGORY_ICONS[category] || "💼";
}

export const CATEGORIES: Category[] = [
  "Food", "Market", "Shopping", "Home Usage", "Bill",
  "Gas", "Vehicle", "Date", "Travel", "Subscriptions",
  "Income", "Cash Back", "Statement Credit", "Refund", "Payment",
  "Investment", "Tax", "ETC", "From Korea", "Saipan",
  "Exchange Currency", "Fine", "Immigration", "Adjustment",
  "Interest", "Incentive", "Bonus", "Recycle", "Apple Cash",
];

export function isExpense(transaction: Transaction): boolean {
  return transaction.type === "expense" || transaction.type === "payment";
}

export function isIncome(transaction: Transaction): boolean {
  return transaction.type === "income" || transaction.type === "cashback" ||
    transaction.type === "refund" || transaction.amount < 0;
}

export function getMonthTransactions(transactions: Transaction[], year: number, month: number): Transaction[] {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  return transactions.filter(t => t.date.startsWith(monthStr));
}

export function calcMonthSummary(transactions: Transaction[]) {
  let totalExpenses = 0;
  let totalIncome = 0;
  for (const t of transactions) {
    if (t.amount > 0) totalExpenses += t.amount;
    else totalIncome += Math.abs(t.amount);
  }
  const totalSaving = totalIncome - totalExpenses;
  const savingRate = totalIncome > 0 ? (totalSaving / totalIncome) * 100 : 0;
  return { totalExpenses, totalIncome, totalSaving, savingRate };
}

export function calcNetWorth(asset: { apple_saving: number; capital_one: number; chase_checking: number; cash: number; mia_debt: number; need_to_pay: number }): number {
  return asset.apple_saving + asset.capital_one + asset.chase_checking + asset.cash - asset.mia_debt + asset.need_to_pay;
}
