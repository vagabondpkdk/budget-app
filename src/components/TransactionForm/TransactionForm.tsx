import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { Transaction, Category, TransactionType } from '../../types';
import { CATEGORIES, getCategoryIcon } from '../../utils';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { TRANSLATIONS, tCat } from '../../lib/i18n';

interface Props {
  initialDate?: string;
  initialTransaction?: Transaction;
  onClose?: () => void;
}

export function TransactionForm({ initialDate, initialTransaction, onClose }: Props) {
  const { cards, addTransaction, updateTransaction } = useStore();
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const activeCards = cards.filter(c => c.isActive);

  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(initialTransaction?.date || initialDate || today);
  const [amount, setAmount] = useState(initialTransaction ? String(Math.abs(initialTransaction.amount)) : '');
  const [type, setType] = useState<TransactionType>(initialTransaction?.type || 'expense');
  const [cardId, setCardId] = useState(initialTransaction?.cardId || activeCards[0]?.id || '');
  const [category, setCategory] = useState<Category>(initialTransaction?.category || 'Food');
  const [note, setNote] = useState(initialTransaction?.note || '');
  const [user, setUser] = useState<'Kyle' | 'Ella' | 'Both' | 'SA'>(initialTransaction?.user || 'Both');
  const [isRecurring, setIsRecurring] = useState(initialTransaction?.isRecurring || false);

  const allTransactions = useStore(s => s.transactions);
  const suggestions = useMemo(() => {
    if (note.length < 2) return [];
    const lower = note.toLowerCase();
    const seen = new Set<string>();
    return allTransactions
      .filter(t => t.note.toLowerCase().includes(lower) && t.note !== note)
      .filter(t => { if (seen.has(t.note)) return false; seen.add(t.note); return true; })
      .slice(0, 4);
  }, [note, allTransactions]);

  const [showSuggestions, setShowSuggestions] = useState(false);

  const typeOptions: { value: TransactionType; label: string; icon: string }[] = [
    { value: 'expense', label: T.t_expense, icon: '💸' },
    { value: 'income', label: T.t_income, icon: '💵' },
    { value: 'cashback', label: T.t_cashback, icon: '💰' },
    { value: 'payment', label: T.t_payment, icon: '💳' },
    { value: 'refund', label: T.t_refund, icon: '↩️' },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !cardId) return;
    const numAmount = parseFloat(amount);
    const finalAmount = (type === 'income' || type === 'cashback' || type === 'refund')
      ? -Math.abs(numAmount) : Math.abs(numAmount);
    const data = { date, category, note, amount: finalAmount, cardId, user, type, isRecurring };
    if (initialTransaction) {
      updateTransaction(initialTransaction.id, data);
    } else {
      addTransaction(data);
    }
    onClose?.();
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <h3 className="font-semibold text-[var(--color-text)] text-sm">
          {initialTransaction ? T.edit_tx : T.add_tx}
        </h3>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-[var(--color-muted)]">
            <X size={16} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 space-y-2">
        {/* Type buttons - compact single row */}
        <div className="flex gap-1.5 flex-wrap">
          {typeOptions.map(opt => (
            <button key={opt.value} type="button" onClick={() => setType(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                type === opt.value
                  ? 'bg-[var(--color-highlight)] text-white'
                  : 'bg-white/10 text-[var(--color-muted)] hover:bg-white/15'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        {/* Date & Amount */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-0.5 block">{T.date_lbl}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]" />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-0.5 block">{T.amount_lbl}</label>
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
              step="0.01" min="0"
              className="w-full bg-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]" />
          </div>
        </div>

        {/* Card Selection */}
        <div>
          <label className="text-xs text-[var(--color-muted)] mb-1 block">{T.card_select}</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {activeCards.map(card => (
              <button key={card.id} type="button" onClick={() => setCardId(card.id)}
                className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                  cardId === card.id ? 'ring-2 ring-white/60' : 'opacity-60 hover:opacity-90'
                }`}
                style={{ backgroundColor: card.color + '33', border: `1px solid ${card.color}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: card.color }} />
                <span className="text-[var(--color-text)] truncate max-w-[90px]">{card.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Grid - compact */}
        <div>
          <label className="text-xs text-[var(--color-muted)] mb-1 block">{T.category_lbl}</label>
          <div className="grid grid-cols-7 gap-1">
            {CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} title={cat}
                className={`flex flex-col items-center justify-center gap-0 py-1 px-0.5 rounded-md transition-colors ${
                  category === cat
                    ? 'bg-[var(--color-accent)] text-[var(--color-text)]'
                    : 'bg-white/5 text-[var(--color-muted)] hover:bg-white/10'
                }`}
                style={{ minHeight: '42px' }}
              >
                <span style={{ fontSize: '16px', lineHeight: 1 }}>{getCategoryIcon(cat)}</span>
                <span className="leading-tight text-center w-full overflow-hidden" style={{ fontSize: '7px', marginTop: '2px' }}>
                  {tCat(lang, cat)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Memo */}
        <div className="relative">
          <label className="text-xs text-[var(--color-muted)] mb-0.5 block">{T.memo_lbl}</label>
          <input type="text" placeholder={T.memo_ph} value={note}
            onChange={e => { setNote(e.target.value); setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-full bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-[var(--color-accent)] rounded-lg shadow-xl overflow-hidden border border-white/10">
              {suggestions.map(s => (
                <button key={s.id} type="button"
                  onMouseDown={() => { setNote(s.note); setCategory(s.category); setCardId(s.cardId); setShowSuggestions(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 text-[var(--color-text)]"
                >
                  <span>{getCategoryIcon(s.category)}</span>
                  <span className="flex-1 text-left">{s.note}</span>
                  <span className="text-[var(--color-muted)]">${Math.abs(s.amount).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payer + Recurring - single row */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-[var(--color-muted)] mb-0.5 block">{T.payer_lbl}</label>
            <div className="flex gap-1">
              {(['Kyle', 'Ella', 'Both', 'SA'] as const).map(u => (
                <button key={u} type="button" onClick={() => setUser(u)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                    user === u
                      ? u === 'Kyle' ? 'bg-[var(--color-info)] text-white'
                        : u === 'Ella' ? 'bg-pink-500 text-white'
                        : 'bg-[var(--color-accent)] text-white'
                      : 'bg-white/10 text-[var(--color-muted)] hover:bg-white/15'
                  }`}
                >{u}</button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer mt-4">
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded w-3 h-3" />
            <span className="text-xs text-[var(--color-muted)]">{T.recurring_lbl}</span>
          </label>
        </div>

        {/* Submit */}
        <button type="submit"
          className="w-full py-2.5 rounded-xl font-semibold text-white text-sm bg-[var(--color-highlight)] hover:bg-red-500 active:scale-95 transition-all"
        >
          {initialTransaction ? T.save_edit_lbl : T.save_lbl}
        </button>
      </form>
    </div>
  );
}
