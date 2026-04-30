import type { Transaction } from '../../types';
import { CardBadge } from './CardBadge';
import { AmountText } from './AmountText';
import { CategoryIcon } from './CategoryIcon';
import { Trash2 } from 'lucide-react';
import { formatDate, formatCurrency } from '../../utils';

interface Props {
  transactions: Transaction[];
  showDate?: boolean;
  onEdit?: (t: Transaction) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
  /** expenseId → 상계된 금액 (지출 행에 🔄 배지 표시) */
  refundedMap?: Map<string, number>;
}

export function TransactionList({ transactions, showDate = false, onEdit, onDelete, compact = false, refundedMap }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-muted)]">
        <p className="text-2xl mb-2">📭</p>
        <p className="text-sm">No transactions</p>
      </div>
    );
  }

  return (
    <div className="divide-y" style={{ borderColor: 'var(--color-divider)' }}>
      {transactions.map(t => {
        const refundedAmt = refundedMap?.get(t.id);
        const isRefunded = !!refundedAmt && t.amount > 0;
        const isFullyRefunded = isRefunded && refundedAmt! >= t.amount;
        return (
          <div
            key={t.id}
            onClick={() => onEdit?.(t)}
            className={`flex items-center gap-3 rounded-lg transition-colors cursor-pointer active:bg-white/10 hover:bg-white/5 ${compact ? 'px-2 py-2' : 'px-3 py-3'} ${isFullyRefunded ? 'opacity-50' : ''}`}
          >
            <CategoryIcon category={t.category} size={compact ? 'sm' : 'md'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <CardBadge cardId={t.cardId} />
                <span className={`text-[var(--color-text)] truncate ${compact ? 'text-xs' : 'text-sm'} ${isFullyRefunded ? 'line-through' : ''}`}>
                  {t.note || t.category}
                </span>
                {t.isRecurring && (
                  <span className="text-xs text-[var(--color-warning)]">↻</span>
                )}
                {isRefunded && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--color-success)', fontSize: '10px' }}>
                    🔄 {isFullyRefunded ? '전액상계' : `${formatCurrency(refundedAmt!)} 상계`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {showDate && (
                  <span className="text-xs text-[var(--color-muted)]">{formatDate(t.date)}</span>
                )}
                <span className={`text-xs font-medium ${
                  t.user === 'Kyle' ? 'text-[var(--color-info)]' :
                  t.user === 'Ella' ? 'text-pink-400' : 'text-[var(--color-muted)]'
                }`}>
                  {t.user}
                </span>
              </div>
            </div>
            <AmountText amount={t.amount} size="sm" />
            {onDelete && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  if (confirm('Delete this transaction?')) onDelete(t.id);
                }}
                className="p-1.5 rounded hover:bg-white/10 text-[var(--color-muted)] hover:text-[var(--color-highlight)] flex-shrink-0"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
