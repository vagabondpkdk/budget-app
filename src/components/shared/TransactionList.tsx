import type { Transaction } from '../../types';
import { CardBadge } from './CardBadge';
import { AmountText } from './AmountText';
import { CategoryIcon } from './CategoryIcon';
import { Trash2 } from 'lucide-react';
import { formatDate } from '../../utils';

interface Props {
  transactions: Transaction[];
  showDate?: boolean;
  onEdit?: (t: Transaction) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}

export function TransactionList({ transactions, showDate = false, onEdit, onDelete, compact = false }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-muted)]">
        <p className="text-2xl mb-2">📭</p>
        <p className="text-sm">No transactions</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {transactions.map(t => (
        <div
          key={t.id}
          onClick={() => onEdit?.(t)}
          className={`flex items-center gap-3 rounded-lg transition-colors cursor-pointer active:bg-white/10 hover:bg-white/5 ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}
        >
          <CategoryIcon category={t.category} size={compact ? 'sm' : 'md'} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <CardBadge cardId={t.cardId} />
              <span className={`text-[var(--color-text)] truncate ${compact ? 'text-xs' : 'text-sm'}`}>
                {t.note || t.category}
              </span>
              {t.isRecurring && (
                <span className="text-xs text-[var(--color-warning)]">↻</span>
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
      ))}
    </div>
  );
}
