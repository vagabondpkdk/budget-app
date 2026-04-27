import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { groupByDate, getMonthTransactions, formatCurrency } from '../../utils';
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { TransactionList } from '../shared/TransactionList';
import { TransactionForm } from '../TransactionForm/TransactionForm';
import type { Transaction } from '../../types';

export function DailyView() {
  const { transactions, currentYear, currentMonth, setCurrentMonth, selectedDate, setSelectedDate } = useStore();
  const [editingT, setEditingT] = useState<Transaction | null>(null);
  const [addingForDate, setAddingForDate] = useState<string | null>(null);

  const monthTxns = useMemo(
    () => getMonthTransactions(transactions, currentYear, currentMonth),
    [transactions, currentYear, currentMonth]
  );

  const grouped = useMemo(() => groupByDate(monthTxns), [monthTxns]);

  const daysInMonth = getDaysInMonth(new Date(currentYear, currentMonth - 1));
  const firstDow = getDay(startOfMonth(new Date(currentYear, currentMonth - 1))); // 0=Sun

  // Daily totals for heatmap
  const dailyTotals: Record<string, number> = {};
  Object.entries(grouped).forEach(([date, txns]) => {
    dailyTotals[date] = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  });

  const maxDaily = Math.max(...Object.values(dailyTotals), 1);

  function heatmapColor(amount: number): string {
    if (!amount) return '';
    const intensity = Math.min(amount / maxDaily, 1);
    if (intensity < 0.25) return 'bg-red-900/30';
    if (intensity < 0.5) return 'bg-red-800/50';
    if (intensity < 0.75) return 'bg-red-600/60';
    return 'bg-[var(--color-highlight)]/70';
  }

  function prevMonth() {
    const d = subMonths(new Date(currentYear, currentMonth - 1), 1);
    setCurrentMonth(d.getFullYear(), d.getMonth() + 1);
  }
  function nextMonth() {
    const d = addMonths(new Date(currentYear, currentMonth - 1), 1);
    setCurrentMonth(d.getFullYear(), d.getMonth() + 1);
  }

  const selectedTxns = selectedDate ? (grouped[selectedDate] || []) : [];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-full hover:bg-white/10 text-[var(--color-muted)]">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-bold text-[var(--color-text)]">
          {format(new Date(currentYear, currentMonth - 1), 'yyyy년 M월')}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-full hover:bg-white/10 text-[var(--color-muted)]">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['일', '월', '화', '수', '목', '금', '토'].map(d => (
            <div key={d} className="text-center text-xs text-[var(--color-muted)] py-1 font-medium">{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {/* Empty cells for month start */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const total = dailyTotals[dateStr] || 0;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all
                  ${heatmapColor(total)}
                  ${isSelected ? 'ring-2 ring-white/60 scale-105' : 'hover:bg-white/10'}
                `}
              >
                <span className={`font-medium ${isToday ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'}`}>
                  {day}
                </span>
                {total > 0 && (
                  <span className="text-[9px] font-mono text-[var(--color-muted)] leading-none">
                    {total >= 1000 ? `$${(total / 1000).toFixed(1)}k` : `$${total.toFixed(0)}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Panel */}
      {selectedDate && (
        <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div>
              <h3 className="font-semibold text-[var(--color-text)]">
                {format(new Date(selectedDate + 'T00:00:00'), 'M월 d일 (EEE)', { locale: undefined })}
              </h3>
              <p className="text-xs text-[var(--color-muted)]">
                총 지출: {formatCurrency(selectedTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddingForDate(selectedDate)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-highlight)] text-white text-sm font-medium"
              >
                <Plus size={14} /> 추가
              </button>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-muted)]"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="p-3">
            <TransactionList
              transactions={selectedTxns}
              onEdit={setEditingT}
              onDelete={id => useStore.getState().deleteTransaction(id)}
            />
          </div>
        </div>
      )}

      {/* Monthly total */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-3 flex justify-between items-center">
        <span className="text-sm text-[var(--color-muted)]">이번 달 총 지출</span>
        <span className="font-mono font-bold text-[var(--color-highlight)]">
          {formatCurrency(monthTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
        </span>
      </div>

      {/* Add/Edit Modal */}
      {(addingForDate || editingT) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <TransactionForm
              initialDate={addingForDate || undefined}
              initialTransaction={editingT || undefined}
              onClose={() => { setAddingForDate(null); setEditingT(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
