import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { groupByDate, getMonthTransactions, formatCurrency } from '../../utils';
import { getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { Plus, X } from 'lucide-react';
import { TransactionList } from '../shared/TransactionList';
import { TransactionForm } from '../TransactionForm/TransactionForm';
import { MonthPicker } from '../shared/MonthPicker';
import type { Transaction } from '../../types';
import { TRANSLATIONS } from '../../lib/i18n';

export function DailyView() {
  const { transactions, currentYear, currentMonth, selectedDate, setSelectedDate } = useStore();
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const [editingT, setEditingT] = useState<Transaction | null>(null);
  const [addingForDate, setAddingForDate] = useState<string | null>(null);

  const monthTxns = useMemo(
    () => getMonthTransactions(transactions, currentYear, currentMonth),
    [transactions, currentYear, currentMonth]
  );

  const grouped = useMemo(() => groupByDate(monthTxns), [monthTxns]);

  const daysInMonth = getDaysInMonth(new Date(currentYear, currentMonth - 1));
  const firstDow = getDay(startOfMonth(new Date(currentYear, currentMonth - 1)));

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

  const selectedTxns = selectedDate ? (grouped[selectedDate] || []) : [];

  const selectedDateLabel = selectedDate
    ? (() => {
        const d = new Date(selectedDate + 'T00:00:00');
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const dow = T.dow[d.getDay()];
        return lang === 'ko' ? `${m}월 ${day}일 (${dow})` : `${T.months_ko[m - 1]} ${day} (${dow})`;
      })()
    : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <MonthPicker />
      </div>

      {/* Calendar Grid */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-3">
        <div className="grid grid-cols-7 mb-1">
          {T.dow.map((d, i) => (
            <div key={i} className={`text-center text-xs py-1 font-medium ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-[var(--color-muted)]'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const total = dailyTotals[dateStr] || 0;
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all
                  ${heatmapColor(total)}
                  ${isSelected ? 'ring-2 ring-white/60 scale-105' : 'hover:bg-white/10'}`}
              >
                <span className={`font-medium ${isToday ? 'text-[var(--color-warning)]' : 'text-[var(--color-text)]'}`}>{day}</span>
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
              <h3 className="font-semibold text-[var(--color-text)]">{selectedDateLabel}</h3>
              <p className="text-xs text-[var(--color-muted)]">
                {T.total_label} {formatCurrency(selectedTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAddingForDate(selectedDate)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-highlight)] text-white text-sm font-medium"
              >
                <Plus size={14} /> {T.add}
              </button>
              <button onClick={() => setSelectedDate(null)} className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-muted)]">
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="p-3">
            <TransactionList transactions={selectedTxns}
              onEdit={setEditingT}
              onDelete={id => useStore.getState().deleteTransaction(id)}
            />
          </div>
        </div>
      )}

      <div className="bg-[var(--color-surface)] rounded-2xl p-3 flex justify-between items-center">
        <span className="text-sm text-[var(--color-muted)]">{T.total_month_label}</span>
        <span className="font-mono font-bold text-[var(--color-highlight)]">
          {formatCurrency(monthTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
        </span>
      </div>

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
