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
  const [date, setDate]           = useState(initialTransaction?.date || initialDate || today);
  const [amount, setAmount]       = useState(initialTransaction ? String(Math.abs(initialTransaction.amount)) : '');
  const [type, setType]           = useState<TransactionType>(initialTransaction?.type || 'expense');
  const [cardId, setCardId]       = useState(initialTransaction?.cardId || activeCards[0]?.id || '');
  const [category, setCategory]   = useState<Category>(initialTransaction?.category || 'Food');
  const [note, setNote]           = useState(initialTransaction?.note || '');
  const [user, setUser]           = useState<'Kyle' | 'Ella' | 'Both' | 'SA'>(initialTransaction?.user || 'Both');
  const [isRecurring, setIsRecurring] = useState(initialTransaction?.isRecurring || false);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  const typeOptions: { value: TransactionType; label: string; icon: string }[] = [
    { value: 'expense',  label: T.t_expense,  icon: '💸' },
    { value: 'income',   label: T.t_income,   icon: '💵' },
    { value: 'cashback', label: T.t_cashback, icon: '💰' },
    { value: 'payment',  label: T.t_payment,  icon: '💳' },
    { value: 'refund',   label: T.t_refund,   icon: '↩️' },
  ];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !cardId) return;
    const numAmount = parseFloat(amount);
    const finalAmount = (type === 'income' || type === 'cashback' || type === 'refund')
      ? -Math.abs(numAmount) : Math.abs(numAmount);
    const data = { date, category, note, amount: finalAmount, cardId, user, type, isRecurring };
    if (initialTransaction) { updateTransaction(initialTransaction.id, data); }
    else { addTransaction(data); }
    onClose?.();
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
      className="bg-[var(--color-surface)] rounded-2xl overflow-hidden">

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

      <form onSubmit={handleSubmit}
        style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}>

        {/* Type buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {typeOptions.map(opt => (
            <button key={opt.value} type="button" onClick={() => setType(opt.value)}
              style={{
                padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
                background: type === opt.value ? 'var(--color-highlight)' : 'rgba(255,255,255,0.1)',
                color: type === opt.value ? 'white' : 'var(--color-muted)',
                border: 'none', cursor: 'pointer',
              }}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>

        {/* Date & Amount — stacked on mobile to prevent overflow */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '3px' }}>{T.date_lbl}</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{
                width: '100%', minWidth: 0, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '6px 8px', fontSize: '12px',
                color: 'var(--color-text)', outline: 'none',
              }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '3px' }}>{T.amount_lbl}</div>
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
              step="0.01" min="0"
              style={{
                width: '100%', minWidth: 0, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '6px 8px', fontSize: '12px',
                color: 'var(--color-text)', outline: 'none', fontFamily: 'monospace',
              }} />
          </div>
        </div>

        {/* Card Selection */}
        <div style={{ width: '100%', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px' }}>{T.card_select}</div>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
            {activeCards.map(card => (
              <button key={card.id} type="button" onClick={() => setCardId(card.id)}
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 500,
                  backgroundColor: card.color + '33', border: `1px solid ${card.color}`,
                  cursor: 'pointer',
                  outline: cardId === card.id ? `2px solid rgba(255,255,255,0.6)` : 'none',
                  outlineOffset: '1px',
                }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: card.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--color-text)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {card.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Grid — 7 cols, fully constrained */}
        <div style={{ width: '100%', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '4px' }}>{T.category_lbl}</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: '3px',
            width: '100%',
          }}>
            {CATEGORIES.map(cat => (
              <button key={cat} type="button" onClick={() => setCategory(cat)} title={cat}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '4px 2px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  minHeight: '40px', minWidth: 0, overflow: 'hidden',
                  background: category === cat ? 'var(--color-accent)' : 'rgba(255,255,255,0.05)',
                }}>
                <span style={{ fontSize: '15px', lineHeight: 1 }}>{getCategoryIcon(cat)}</span>
                <span style={{
                  fontSize: '7px', marginTop: '2px', lineHeight: 1.1,
                  color: 'var(--color-muted)', textAlign: 'center',
                  width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {tCat(lang, cat)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Memo */}
        <div style={{ position: 'relative', width: '100%', minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '3px' }}>{T.memo_lbl}</div>
          <input type="text" placeholder={T.memo_ph} value={note}
            onChange={e => { setNote(e.target.value); setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '6px 10px', fontSize: '12px',
              color: 'var(--color-text)', outline: 'none',
            }} />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', zIndex: 10, width: '100%', marginTop: '4px',
              background: 'var(--color-accent)', borderRadius: '8px', overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              {suggestions.map(s => (
                <button key={s.id} type="button"
                  onMouseDown={() => { setNote(s.note); setCategory(s.category); setCardId(s.cardId); setShowSuggestions(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', fontSize: '12px', background: 'none',
                    border: 'none', cursor: 'pointer', color: 'var(--color-text)',
                  }}>
                  <span>{getCategoryIcon(s.category)}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{s.note}</span>
                  <span style={{ color: 'var(--color-muted)' }}>${Math.abs(s.amount).toFixed(2)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Payer + Recurring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '3px' }}>{T.payer_lbl}</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['Kyle', 'Ella', 'Both', 'SA'] as const).map(u => (
                <button key={u} type="button" onClick={() => setUser(u)}
                  style={{
                    padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 500,
                    border: 'none', cursor: 'pointer',
                    background: user === u
                      ? u === 'Kyle' ? 'var(--color-info)' : u === 'Ella' ? '#ec4899' : 'var(--color-accent)'
                      : 'rgba(255,255,255,0.1)',
                    color: user === u ? 'white' : 'var(--color-muted)',
                  }}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', marginTop: '14px' }}>
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
              style={{ width: '12px', height: '12px' }} />
            <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{T.recurring_lbl}</span>
          </label>
        </div>

        {/* Submit */}
        <button type="submit"
          style={{
            width: '100%', padding: '10px', borderRadius: '12px', border: 'none',
            background: 'var(--color-highlight)', color: 'white', fontSize: '14px',
            fontWeight: 600, cursor: 'pointer',
          }}>
          {initialTransaction ? T.save_edit_lbl : T.save_lbl}
        </button>
      </form>
    </div>
  );
}
