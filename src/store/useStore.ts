import { create } from 'zustand';
import type { Transaction, Card, MonthlyAsset, Tab } from '../types';
import type { Lang } from '../lib/i18n';
import { initialCards, initialTransactions, initialAssets } from '../data/seedData';
import { generateId } from '../utils';
import { supabase } from '../lib/supabase';

const LS_LANGUAGE = 'budget-app-language';

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

// ── DB ↔ TypeScript conversion helpers ──────────────────────────────────────

type DbRow = Record<string, unknown>;

function txnToDb(t: Transaction): DbRow {
  return {
    id: t.id, date: t.date, category: t.category, note: t.note,
    amount: t.amount, card_id: t.cardId, user: t.user,
    type: t.type, is_recurring: t.isRecurring ?? false,
  };
}

function dbToTxn(r: DbRow): Transaction {
  return {
    id: r.id as string, date: r.date as string,
    category: r.category as Transaction['category'],
    note: r.note as string, amount: r.amount as number,
    cardId: r.card_id as string, user: r.user as Transaction['user'],
    type: r.type as Transaction['type'], isRecurring: r.is_recurring as boolean,
  };
}

function cardToDb(c: Card): DbRow {
  return {
    id: c.id, name: c.name, owner: c.owner, color: c.color, bank: c.bank,
    type: c.type, is_active: c.isActive,
    pay_due_day: c.payDueDay ?? null, last_four_digits: c.lastFourDigits ?? null,
  };
}

function dbToCard(r: DbRow): Card {
  return {
    id: r.id as string, name: r.name as string, owner: r.owner as Card['owner'],
    color: r.color as string, bank: r.bank as string, type: r.type as Card['type'],
    isActive: r.is_active as boolean,
    payDueDay: r.pay_due_day != null ? (r.pay_due_day as number) : undefined,
    lastFourDigits: r.last_four_digits != null ? (r.last_four_digits as string) : undefined,
  };
}

function assetToDb(a: MonthlyAsset): DbRow {
  return {
    id: `${a.year}-${String(a.month).padStart(2, '0')}`,
    year: a.year, month: a.month,
    apple_saving: a.apple_saving, capital_one: a.capital_one,
    chase_checking: a.chase_checking, cash: a.cash,
    mia_debt: a.mia_debt, need_to_pay: a.need_to_pay,
  };
}

function dbToAsset(r: DbRow): MonthlyAsset {
  return {
    year: r.year as number, month: r.month as number,
    apple_saving: r.apple_saving as number, capital_one: r.capital_one as number,
    chase_checking: r.chase_checking as number, cash: r.cash as number,
    mia_debt: r.mia_debt as number, need_to_pay: r.need_to_pay as number,
  };
}

function getInitialMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// ── Store interface ──────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface StoreState {
  transactions: Transaction[];
  cards: Card[];
  assets: MonthlyAsset[];
  activeTab: Tab;
  selectedDate: string | null;
  currentYear: number;
  currentMonth: number;
  syncStatus: SyncStatus;
  language: Lang;

  setActiveTab: (tab: Tab) => void;
  setLanguage: (lang: Lang) => void;
  setSelectedDate: (date: string | null) => void;
  setCurrentMonth: (year: number, month: number) => void;

  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, t: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;

  addCard: (card: Omit<Card, 'id'>) => void;
  updateCard: (id: string, card: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  toggleCardActive: (id: string) => void;
  reorderCards: (cards: Card[]) => void;

  updateAsset: (year: number, month: number, data: Partial<MonthlyAsset>) => void;

  exportData: () => void;
  importData: (json: string) => void;
  resetToSeedData: () => void;

  initSync: () => Promise<void>;
  uploadToCloud: () => Promise<void>;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<StoreState>((set, get) => {
  const transactions = loadFromStorage(LS_TRANSACTIONS, initialTransactions);
  const { year: initYear, month: initMonth } = getInitialMonth();

  return {
    transactions,
    cards: loadFromStorage(LS_CARDS, initialCards),
    assets: loadFromStorage(LS_ASSETS, initialAssets),
    activeTab: 'dashboard',
    selectedDate: null,
    currentYear: initYear,
    currentMonth: initMonth,
    syncStatus: 'idle',
    language: (loadFromStorage(LS_LANGUAGE, 'ko') as Lang),

    setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedDate: (date) => set({ selectedDate: date }),
    setCurrentMonth: (year, month) => set({ currentYear: year, currentMonth: month }),
    setLanguage: (lang) => { saveToStorage(LS_LANGUAGE, lang); set({ language: lang }); },

    // ── Transactions ──
    addTransaction: (t) => {
      const newT: Transaction = { ...t, id: generateId() };
      const transactions = [...get().transactions, newT];
      saveToStorage(LS_TRANSACTIONS, transactions);
      set({ transactions });
      // upsert (not insert) so retry is safe if insert was interrupted
      supabase.from('transactions').upsert(txnToDb(newT)).then(({ error }) => {
        if (error) console.warn('Transaction sync failed, will retry on next load:', error.message);
      });
    },

    updateTransaction: (id, data) => {
      const transactions = get().transactions.map(t => t.id === id ? { ...t, ...data } : t);
      saveToStorage(LS_TRANSACTIONS, transactions);
      set({ transactions });
      const updated = transactions.find(t => t.id === id);
      if (updated) supabase.from('transactions').upsert(txnToDb(updated)).then(({ error }) => {
        if (error) console.warn('Update sync failed:', error.message);
      });
    },

    deleteTransaction: (id) => {
      const transactions = get().transactions.filter(t => t.id !== id);
      saveToStorage(LS_TRANSACTIONS, transactions);
      set({ transactions });
      supabase.from('transactions').delete().eq('id', id).then(({ error }) => {
        if (error) console.warn('Delete sync failed:', error.message);
      });
    },

    // ── Cards ──
    addCard: (card) => {
      const newCard: Card = { ...card, id: `card_${Date.now()}` };
      const cards = [...get().cards, newCard];
      saveToStorage(LS_CARDS, cards);
      set({ cards });
      supabase.from('cards').upsert(cardToDb(newCard)).then(({ error }) => {
        if (error) console.warn('Card sync failed, will retry on next load:', error.message);
      });
    },

    updateCard: (id, data) => {
      const cards = get().cards.map(c => c.id === id ? { ...c, ...data } : c);
      saveToStorage(LS_CARDS, cards);
      set({ cards });
      const updated = cards.find(c => c.id === id);
      if (updated) supabase.from('cards').upsert(cardToDb(updated)).then(({ error }) => {
        if (error) console.warn('Card update sync failed:', error.message);
      });
    },

    deleteCard: (id) => {
      const cards = get().cards.filter(c => c.id !== id);
      saveToStorage(LS_CARDS, cards);
      set({ cards });
      supabase.from('cards').delete().eq('id', id).then(({ error }) => {
        if (error) console.warn('Card delete sync failed:', error.message);
      });
    },

    toggleCardActive: (id) => {
      const cards = get().cards.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c);
      saveToStorage(LS_CARDS, cards);
      set({ cards });
      const updated = cards.find(c => c.id === id);
      if (updated) supabase.from('cards').upsert(cardToDb(updated)).then(({ error }) => {
        if (error) console.warn('Card toggle sync failed:', error.message);
      });
    },

    reorderCards: (cards) => {
      saveToStorage(LS_CARDS, cards);
      set({ cards });
    },

    // ── Assets ──
    updateAsset: (year, month, data) => {
      let assets = get().assets.map(a =>
        a.year === year && a.month === month ? { ...a, ...data } : a
      );
      if (!assets.find(a => a.year === year && a.month === month)) {
        assets = [...assets, {
          year, month, apple_saving: 0, capital_one: 0,
          chase_checking: 0, cash: 0, mia_debt: 0, need_to_pay: 0, ...data,
        }];
      }
      saveToStorage(LS_ASSETS, assets);
      set({ assets });
      const updated = assets.find(a => a.year === year && a.month === month);
      if (updated) supabase.from('monthly_assets').upsert(assetToDb(updated));
    },

    // ── Import / Export ──
    exportData: () => {
      const { transactions, cards, assets } = get();
      const blob = new Blob(
        [JSON.stringify({ transactions, cards, assets, exportedAt: new Date().toISOString() }, null, 2)],
        { type: 'application/json' }
      );
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
        if (data.transactions) { saveToStorage(LS_TRANSACTIONS, data.transactions); set({ transactions: data.transactions }); }
        if (data.cards) { saveToStorage(LS_CARDS, data.cards); set({ cards: data.cards }); }
        if (data.assets) { saveToStorage(LS_ASSETS, data.assets); set({ assets: data.assets }); }
      } catch {
        alert('Failed to import data: invalid JSON format');
      }
    },

    resetToSeedData: () => {
      saveToStorage(LS_TRANSACTIONS, initialTransactions);
      saveToStorage(LS_CARDS, initialCards);
      saveToStorage(LS_ASSETS, initialAssets);
      set({ transactions: initialTransactions, cards: initialCards, assets: initialAssets });
    },

    // ── Cloud sync ──────────────────────────────────────────────────────────

    uploadToCloud: async () => {
      set({ syncStatus: 'syncing' });
      try {
        const { transactions, cards, assets } = get();
        for (let i = 0; i < transactions.length; i += 50) {
          await supabase.from('transactions').upsert(transactions.slice(i, i + 50).map(txnToDb));
        }
        await supabase.from('cards').upsert(cards.map(cardToDb));
        await supabase.from('monthly_assets').upsert(assets.map(assetToDb));
        set({ syncStatus: 'synced' });
      } catch (err) {
        console.error('Upload failed:', err);
        set({ syncStatus: 'error' });
      }
    },

    initSync: async () => {
      set({ syncStatus: 'syncing' });
      try {
        // Fetch all transactions with pagination (Supabase default limit is 1000)
        async function fetchAll<T>(table: string): Promise<T[]> {
          const PAGE = 1000;
          let all: T[] = [];
          for (let from = 0; ; from += PAGE) {
            const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
            if (error || !data || data.length === 0) break;
            all = all.concat(data as T[]);
            if (data.length < PAGE) break;
          }
          return all;
        }

        const [txnRows, cardRows, assetRows] = await Promise.all([
          fetchAll<DbRow>('transactions'),
          fetchAll<DbRow>('cards'),
          fetchAll<DbRow>('monthly_assets'),
        ]);

        if (txnRows && txnRows.length > 0) {
          // ── Merge: cloud wins for known IDs, local-only items get uploaded ──
          const cloudTxns  = txnRows.map(r => dbToTxn(r));
          const cloudCards = cardRows && cardRows.length > 0 ? cardRows.map(r => dbToCard(r)) : null;

          // Transactions: preserve local-only (not yet synced to cloud)
          const cloudTxnIds = new Set(cloudTxns.map(t => t.id));
          const localOnly   = get().transactions.filter(t => !cloudTxnIds.has(t.id));
          if (localOnly.length > 0) {
            // Push local-only transactions up to cloud
            for (let i = 0; i < localOnly.length; i += 50) {
              await supabase.from('transactions').upsert(localOnly.slice(i, i + 50).map(txnToDb));
            }
          }
          const transactions = [...cloudTxns, ...localOnly];

          // Cards: same merge — local-only cards get pushed up
          const cards = (() => {
            if (!cloudCards) return get().cards;
            const cloudCardIds = new Set(cloudCards.map(c => c.id));
            const localOnlyCards = get().cards.filter(c => !cloudCardIds.has(c.id));
            if (localOnlyCards.length > 0) {
              supabase.from('cards').upsert(localOnlyCards.map(cardToDb));
            }
            return [...cloudCards, ...localOnlyCards];
          })();

          const assets = assetRows && assetRows.length > 0 ? assetRows.map(r => dbToAsset(r)) : get().assets;

          saveToStorage(LS_TRANSACTIONS, transactions);
          saveToStorage(LS_CARDS, cards);
          saveToStorage(LS_ASSETS, assets);
          set({ transactions, cards, assets });
        } else {
          // Cloud is empty → upload local data
          await get().uploadToCloud();
        }

        // ── Real-time subscriptions ──
        supabase.channel('db-sync')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, ({ new: row }) => {
            const t = dbToTxn(row as DbRow);
            if (!get().transactions.find(x => x.id === t.id)) {
              const transactions = [...get().transactions, t];
              saveToStorage(LS_TRANSACTIONS, transactions);
              set({ transactions });
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'transactions' }, ({ new: row }) => {
            const updated = dbToTxn(row as DbRow);
            const transactions = get().transactions.map(t => t.id === updated.id ? updated : t);
            saveToStorage(LS_TRANSACTIONS, transactions);
            set({ transactions });
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'transactions' }, ({ old: row }) => {
            const transactions = get().transactions.filter(t => t.id !== (row as DbRow).id);
            saveToStorage(LS_TRANSACTIONS, transactions);
            set({ transactions });
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cards' }, ({ new: row }) => {
            const newCard = dbToCard(row as DbRow);
            if (!get().cards.find(c => c.id === newCard.id)) {
              const cards = [...get().cards, newCard];
              saveToStorage(LS_CARDS, cards);
              set({ cards });
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cards' }, ({ new: row }) => {
            const updated = dbToCard(row as DbRow);
            const cards = get().cards.map(c => c.id === updated.id ? updated : c);
            saveToStorage(LS_CARDS, cards);
            set({ cards });
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cards' }, ({ old: row }) => {
            const cards = get().cards.filter(c => c.id !== (row as DbRow).id);
            saveToStorage(LS_CARDS, cards);
            set({ cards });
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_assets' }, async () => {
            const { data } = await supabase.from('monthly_assets').select('*');
            if (data) {
              const assets = data.map(r => dbToAsset(r as DbRow));
              saveToStorage(LS_ASSETS, assets);
              set({ assets });
            }
          })
          .subscribe();

        set({ syncStatus: 'synced' });
      } catch (err) {
        console.error('Sync error:', err);
        set({ syncStatus: 'error' });
      }
    },
  };
});
