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
  "Home Usage": "🏡",
  "Food": "🍽️",
  "Gas": "⛽",
  "Shopping": "🛍️",
  "Market": "🧺",
  "Saipan": "🌊",
  "Travel": "✈️",
  "Bill": "🧾",
  "Date": "🍷",
  "Vehicle": "🚘",
  "Cash Back": "💸",
  "Statement Credit": "🏷️",
  "From Korea": "🇰🇷",
  "Subscriptions": "📲",
  "Exchange Currency": "💱",
  "Fine": "⚖️",
  "Tax": "🗂️",
  "Refund": "🔄",
  "ETC": "📦",
  "Payment": "💳",
  "Immigration": "🛂",
  "Investment": "📊",
  "Adjustment": "⚙️",
  "Income": "💰",
  "Interest": "🏦",
  "Incentive": "🎯",
  "Bonus": "⚡",
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

/**
 * 진짜 수입으로 인정하는 카테고리.
 * type:'income'이어도 이 카테고리가 아니면 수입으로 카운트하지 않음.
 */
export const REAL_INCOME_CATEGORIES = new Set<Category>([
  'Income', 'Bonus', 'Incentive', 'From Korea',
  'Interest', 'Investment', 'Apple Cash', 'Recycle',
]);

/**
 * 거래가 진짜 수입인지 판단
 * type:'income' + 수입 카테고리 조합만 인정
 */
export function isRealIncome(t: Transaction): boolean {
  return t.type === 'income' && REAL_INCOME_CATEGORIES.has(t.category);
}

export function isExpense(transaction: Transaction): boolean {
  return transaction.type === 'expense' || transaction.type === 'payment';
}

export function isIncome(transaction: Transaction): boolean {
  return isRealIncome(transaction);
}

export function getMonthTransactions(transactions: Transaction[], year: number, month: number): Transaction[] {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  return transactions.filter(t => t.date.startsWith(monthStr));
}

// ── 환급-지출 자동 연결 ────────────────────────────────────────────────────────
// refundId → { expenseId, refundAmount }
export type RefundLinkMap = Map<string, { expenseId: string; refundAmount: number }>;

/**
 * 모든 거래에서 환급(type='refund')을 같은 카테고리의 최근 지출에 자동 매칭.
 * 부분 환급도 지원: 하나의 지출에 여러 환급이 나뉘어 연결될 수 있음.
 */
export function computeRefundLinks(allTransactions: Transaction[]): RefundLinkMap {
  const links: RefundLinkMap = new Map();
  const usedRefund = new Map<string, number>(); // expenseId → 이미 상계된 금액

  const refunds = allTransactions
    .filter(t => t.type === 'refund' && t.amount < 0)
    .sort((a, b) => b.date.localeCompare(a.date)); // 최신 환급부터

  for (const refund of refunds) {
    const refundAmt = Math.abs(refund.amount);

    // 같은 카테고리, 환급일 이전(이하) 지출, 아직 상계 여력 있는 것 → 최근순
    const candidates = allTransactions
      .filter(e =>
        (e.type === 'expense' || e.type === 'payment') &&
        e.amount > 0 &&
        e.category === refund.category &&
        e.date <= refund.date &&
        (usedRefund.get(e.id) ?? 0) < e.amount
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    if (candidates.length > 0) {
      const match = candidates[0];
      links.set(refund.id, { expenseId: match.id, refundAmount: refundAmt });
      usedRefund.set(match.id, (usedRefund.get(match.id) ?? 0) + refundAmt);
    }
  }

  return links;
}

export function calcMonthSummary(
  transactions: Transaction[],
  refundLinks: RefundLinkMap = new Map()
) {
  // 지출 감소 맵: expenseId → 총 상계 금액 (전체 기간의 환급 링크에서 빌드)
  const expenseReductions = new Map<string, number>();
  for (const [, { expenseId, refundAmount }] of refundLinks) {
    expenseReductions.set(expenseId, (expenseReductions.get(expenseId) ?? 0) + refundAmount);
  }
  const linkedRefundIds = new Set(refundLinks.keys());

  let totalExpenses = 0;
  let totalIncome = 0;
  let totalRefunds = 0;       // 비연결 환급 (cashback 등)
  let totalLinkedRefunds = 0; // 연결 환급 (지출 상계용)

  for (const t of transactions) {
    // ── 진짜 수입 ──────────────────────────────────────────────────
    if (isRealIncome(t)) {
      totalIncome += Math.abs(t.amount);
      continue;
    }
    // ── 신용카드 결제/크레딧 — 예산 계산 완전 제외 ─────────────────
    if (t.amount < 0 && (t.type === 'payment' || t.category === 'Payment' || t.category === 'Statement Credit')) {
      continue;
    }
    // ── 음수 거래 (환급/캐시백 등) ─────────────────────────────────
    if (t.amount < 0) {
      if (linkedRefundIds.has(t.id)) {
        totalLinkedRefunds += Math.abs(t.amount); // 연결됨 → 저축엔 미포함
      } else {
        totalRefunds += Math.abs(t.amount);       // 비연결 → 기존대로
      }
      continue;
    }
    // ── 지출: 상계 금액 차감 ───────────────────────────────────────
    const reduction = Math.min(expenseReductions.get(t.id) ?? 0, t.amount);
    totalExpenses += t.amount - reduction;
  }

  // 저축 = 수입 - 순지출 + 비연결환급 (연결환급은 이미 지출에서 차감됨)
  const totalSaving = totalIncome - totalExpenses + totalRefunds;
  const savingRate = totalIncome > 0 ? (totalSaving / totalIncome) * 100 : 0;
  return { totalExpenses, totalIncome, totalRefunds, totalLinkedRefunds, totalSaving, savingRate };
}

export function calcNetWorth(asset: { apple_saving: number; capital_one: number; chase_checking: number; cash: number; mia_debt: number; need_to_pay: number }): number {
  return asset.apple_saving + asset.capital_one + asset.chase_checking + asset.cash - asset.mia_debt + asset.need_to_pay;
}
