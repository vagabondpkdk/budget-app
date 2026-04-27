import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { Transaction, Category, TransactionType } from '../../types';
import { CATEGORIES, getCategoryIcon } from '../../utils';
import { X } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  initialDate?: string;
  initialTransaction?: Transaction;
  onClose?: () => void;
}

export function TransactionForm({ initialDate, initialTransaction, onClose }: Props) {
  const { cards, addTransaction, updateTransaction } = useStore();
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
      .slice(0, 5);
  }, [note, allTransactions]);

  const [showSuggestions, setShowSuggestions] = useState(false);

  const typeOptions: { value: TransactionType; label: string; icon: string }[] = [
    { value: 'expense', label: '지출', icon: '💸' },
    { value: 'income', label: '수입', icon: '💵' },
    { value: 'cashback', label: '캐시백', icon: '💰' },
    { value: 'payment', label: '결제', icon: '💳' },
    { value: 'refund', label: '환급', icon: '↩️' },
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="font-semibold text-[var(--color-text)]">
          {initialTransaction ? '거래 수정' : '거래 추가'}
        </h3>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-[var(--color-muted)]">
            <X size={18} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Transaction Type */}
        <div className="flex gap-2 flex-wrap">
          {typeOptions.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setType(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                type === opt.value
                  ? 'bg-[var(--color-highlight)] text-white'
                  : 'bg-white/10 text-[var(--color-muted)] hover:bg-white/15'
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        {/* Date & Amount Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">날짜</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">금액 ($)</label>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              step="0.01"
              min="0"
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm font-mono text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]"
            />
          </div>
        </div>

        {/* Card Selection */}
        <div>
          <label className="text-xs text-[var(--color-muted)] mb-2 block">카드 선택</label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {activeCards.map(card => (
              <button
                key={card.id}
                type="button"
                onClick={() => setCardId(card.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  cardId === card.id
                    ? 'ring-2 ring-white/60 scale-105'
                    : 'opacity-60 hover:opacity-90'
                }`}
                style={{ backgroundColor: card.color + '33', borderColor: card.color, border: `1px solid ${card.color}` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                <span className="text-[var(--color-text)] truncate max-w-[100px]">{card.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Grid */}
        <div>
          <label className="text-xs text-[var(--color-muted)] mb-2 block">카테고리</label>
          <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                title={cat}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg text-xs transition-colors ${
                  category === cat
                    ? 'bg-[var(--color-accent)] text-[var(--color-text)]'
                    : 'bg-white/5 text-[var(--color-muted)] hover:bg-white/10'
                }`}
              >
                <span className="text-base">{getCategoryIcon(cat)}</span>
                <span className="leading-tight text-center" style={{ fontSize: '9px' }}>
                  {cat.length > 8 ? cat.substring(0, 7) + '…' : cat}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Note with Autocomplete */}
        <div className="relative">
          <label className="text-xs text-[var(--color-muted)] mb-1 block">메모 (가게명)</label>
          <input
            type="text"
            placeholder="예: Costco, 이마트..."
            value={note}
            onChange={e => { setNote(e.target.value); setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-[var(--color-accent)] rounded-lg shadow-xl overflow-hidden border border-white/10">
              {suggestions.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => {
                    setNote(s.note);
                    setCategory(s.category);
                    setCardId(s.cardId);
                    setShowSuggestions(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 text-[var(--color-text)]"
                >
                  <span>{getCategoryIcon(s.category)}</span>
                  <span className="flex-1 text-left">{s.note}</span>
                  <span className="text-[var(--color-muted)] text-xs">${Math.abs(s.amount).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User & Recurring */}
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="text-xs text-[var(--color-muted)] mb-1 block">결제자</label>
            <div className="flex gap-1">
              {(['Kyle', 'Ella', 'Both', 'SA'] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUser(u)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    user === u
                      ? u === 'Kyle' ? 'bg-[var(--color-info)] text-white'
                        : u === 'Ella' ? 'bg-pink-500 text-white'
                        : 'bg-[var(--color-accent)] text-white'
                      : 'bg-white/10 text-[var(--color-muted)] hover:bg-white/15'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-[var(--color-muted)]">반복</span>
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-3 rounded-xl font-semibold text-white bg-[var(--color-highlight)] hover:bg-red-500 active:scale-95 transition-all"
        >
          {initialTransaction ? '수정 저장' : '저장'}
        </button>
      </form>
    </div>
  );
}
