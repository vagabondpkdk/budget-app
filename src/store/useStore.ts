import { create } from 'zustand';
import type { Transaction, Card, MonthlyAsset, Tab } from '../types';
import { initialCards, initialTransactions, initialAssets } from '../data/seedData';
import { generateId } from '../utils';

const LS_TRANSACTIONS = 'budget-app-transactions';
const LS_CARDS = 'budget-app-cards';
const LS_ASSETS = 'budget-app-assets';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

interface StoreState {
  transactions: Transaction[];
  cards: Card[];
  assets: MonthlyAsset[];
  activeTab: Tab;
  selectedDate: string | null;
  currentYear: number;
  currentMonth: number; // 1-based

  // Actions
  setActiveTab: (tab: Tab) => void;
  setSelectedDate: (date: string | null) => void;
  setCurrentMonth: (year: number, month: number) => void;

  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, t: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  addCard: (card: Omit<Card, 'id'>) => void;
  updateCard: (id: string, card: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  toggleCardActive: (id: string) => void;

  updateAsset: (year: number, month: number, data: Partial<MonthlyAsset>) => void;

  exportData: () => void;
  importData: (json: string) => void;
  resetToSeedData: () => void;
}

function getInitialMonth(txns: Transaction[]): { year: number; month: number } {
  if (txns.length === 0) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const latest = txns.reduce((a, b) => a.date > b.date ? a : b);
  const d = new Date(latest.date + 'T00:00:00');
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export const useStore = create<StoreState>((set, get) => {
  const transactions = loadFromStorage(LS_TRANSACTIONS, initialTransactions);
  const { year: initYear, month: initMonth } = getInitialMonth(transactions);
  return {
  transactions,
  cards: loadFromStorage(LS_CARDS, initialCards),
  assets: loadFromStorage(LS_ASSETS, initialAssets),
  activeTab: 'dashboard',
  selectedDate: null,
  currentYear: initYear,
  currentMonth: initMonth,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setCurrentMonth: (year, month) => set({ currentYear: year, currentMonth: month }),

  addTransaction: (t) => {
    const newT: Transaction = { ...t, id: generateId() };
    const transactions = [...get().transactions, newT];
    saveToStorage(LS_TRANSACTIONS, transactions);
    set({ transactions });
  },

  updateTransaction: (id, data) => {
    const transactions = get().transactions.map(t => t.id === id ? { ...t, ...data } : t);
    saveToStorage(LS_TRANSACTIONS, transactions);
    set({ transactions });
  },

  deleteTransaction: (id) => {
    const transactions = get().transactions.filter(t => t.id !== id);
    saveToStorage(LS_TRANSACTIONS, transactions);
    set({ transactions });
  },

  addCard: (card) => {
    const newCard: Card = { ...card, id: `card_${Date.now()}` };
    const cards = [...get().cards, newCard];
    saveToStorage(LS_CARDS, cards);
    set({ cards });
  },

  updateCard: (id, data) => {
    const cards = get().cards.map(c => c.id === id ? { ...c, ...data } : c);
    saveToStorage(LS_CARDS, cards);
    set({ cards });
  },

  deleteCard: (id) => {
    const cards = get().cards.filter(c => c.id !== id);
    saveToStorage(LS_CARDS, cards);
    set({ cards });
  },

  toggleCardActive: (id) => {
    const cards = get().cards.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
    saveToStorage(LS_CARDS, cards);
    set({ cards });
  },

  updateAsset: (year, month, data) => {
    const assets = get().assets.map(a =>
      a.year === year && a.month === month ? { ...a, ...data } : a
    );
    if (!assets.find(a => a.year === year && a.month === month)) {
      assets.push({ year, month, apple_saving: 0, capital_one: 0, chase_checking: 0, cash: 0, mia_debt: 0, need_to_pay: 0, ...data });
    }
    saveToStorage(LS_ASSETS, assets);
    set({ assets });
  },

  exportData: () => {
    const { transactions, cards, assets } = get();
    const data = { transactions, cards, assets, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: (json) => {
    try {
      const data = JSON.parse(json);
      if (data.transactions) {
        saveToStorage(LS_TRANSACTIONS, data.transactions);
        set({ transactions: data.transactions });
      }
      if (data.cards) {
        saveToStorage(LS_CARDS, data.cards);
        set({ cards: data.cards });
      }
      if (data.assets) {
        saveToStorage(LS_ASSETS, data.assets);
        set({ assets: data.assets });
      }
    } catch (e) {
      alert('Failed to import data: invalid JSON format');
    }
  },

  resetToSeedData: () => {
    saveToStorage(LS_TRANSACTIONS, initialTransactions);
    saveToStorage(LS_CARDS, initialCards);
    saveToStorage(LS_ASSETS, initialAssets);
    set({ transactions: initialTransactions, cards: initialCards, assets: initialAssets });
  },
  };
});
