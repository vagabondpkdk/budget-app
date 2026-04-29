import { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { getMonthTransactions, calcMonthSummary, formatCurrency, getCategoryIcon, isRealIncome } from '../../utils';
import { getDaysInMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TransactionList } from '../shared/TransactionList';
import { TransactionForm } from '../TransactionForm/TransactionForm';
import { MonthPicker } from '../shared/MonthPicker';
import { useState } from 'react';
import type { Transaction } from '../../types';
import { TRANSLATIONS, tCat } from '../../lib/i18n';

const CHART_COLORS = ['var(--color-highlight)', 'var(--color-info)', 'var(--color-success)', 'var(--color-warning)', '#A78BFA', '#F472B6'];

export function Dashboard() {
  const { transactions, currentYear, currentMonth, setActiveTab } = useStore();
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const [editingT, setEditingT] = useState<Transaction | null>(null);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<'income' | 'expense' | 'refund' | 'saving' | null>(null);

  const monthTxns = useMemo(
    () => getMonthTransactions(transactions, currentYear, currentMonth),
    [transactions, currentYear, currentMonth]
  );

  const { totalIncome, totalExpenses, totalRefunds, totalSaving } = useMemo(
    () => calcMonthSummary(monthTxns),
    [monthTxns]
  );

  const weeklyData = useMemo(() => {
    const daysInMonth = getDaysInMonth(new Date(currentYear, currentMonth - 1));
    const weeks: { week: string; amount: number }[] = [];
    for (let w = 0; w < 5; w++) {
      const start = w * 7 + 1;
      const end = Math.min(start + 6, daysInMonth);
      let total = 0;
      for (let d = start; d <= end; d++) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        monthTxns.filter(t => t.date === dateStr && t.amount > 0).forEach(t => total += t.amount);
      }
      if (start <= daysInMonth) weeks.push({ week: `W${w + 1}`, amount: total });
    }
    return weeks;
  }, [monthTxns, currentYear, currentMonth]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxns.filter(t => t.amount > 0).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value, label: tCat(lang, name), icon: getCategoryIcon(name as any) }));
  }, [monthTxns, lang]);

  const recent = useMemo(
    () => [...monthTxns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [monthTxns]
  );

  const drillTxns = useMemo(() => {
    const sorted = (arr: Transaction[]) => [...arr].sort((a, b) => b.date.localeCompare(a.date));
    if (drillDown === 'income')  return sorted(monthTxns.filter(t => isRealIncome(t)));
    if (drillDown === 'expense') return sorted(monthTxns.filter(t => t.amount > 0));
    if (drillDown === 'refund')  return sorted(monthTxns.filter(t => t.amount < 0 && !isRealIncome(t) && t.type !== 'payment' && t.category !== 'Payment' && t.category !== 'Statement Credit'));
    return [];
  }, [drillDown, monthTxns]);

  const drillLabel = drillDown === 'income' ? T.income : drillDown === 'expense' ? T.expense : '환급';
  const drillTotal = drillDown === 'income' ? totalIncome
    : drillDown === 'expense' ? totalExpenses
    : totalRefunds;

  // 저축률: (수입 + 환급) 대비 저축 비율. 둘 다 0이면 지출이 있을 경우 -100%
  const effectiveIncome = totalIncome + totalRefunds;
  const displaySavingRate = effectiveIncome > 0
    ? Math.min(Math.max((totalSaving / effectiveIncome) * 100, -100), 100)
    : totalSaving >= 0 ? 0 : -100;

  const daysLeft = getDaysInMonth(new Date(currentYear, currentMonth - 1)) - new Date().getDate();
  const savingColor = displaySavingRate >= 70 ? 'var(--color-success)' : displaySavingRate >= 50 ? 'var(--color-warning)' : displaySavingRate >= 0 ? 'var(--color-highlight)' : '#888';
  const circumference = 2 * Math.PI * 30;
  const savingOffset = circumference - (Math.max(displaySavingRate, 0) / 100) * circumference;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <MonthPicker />
        <span className="text-xs text-[var(--color-muted)] bg-white/10 px-2 py-1 rounded-full">
          {daysLeft > 0 ? T.days_left(daysLeft) : T.this_month}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label={T.income}  value={totalIncome}   color="var(--color-success)"   onClick={() => setDrillDown('income')} />
        <SummaryCard label={T.expense} value={totalExpenses} color="var(--color-highlight)" onClick={() => setDrillDown('expense')} />
        <SummaryCard label="환급"      value={totalRefunds}  color="var(--color-warning)"   onClick={() => setDrillDown('refund')} />
        <SummaryCard label={T.saving}  value={totalSaving}   color={totalSaving >= 0 ? 'var(--color-info)' : 'var(--color-highlight)'} onClick={() => setDrillDown('saving')} />
      </div>

      <div className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, var(--color-surface) 0%, color-mix(in srgb, var(--color-highlight) 6%, var(--color-surface)) 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <svg className="w-20 h-20 flex-shrink-0 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle cx="40" cy="40" r="30" fill="none" stroke={savingColor} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={savingOffset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        </svg>
        <div>
          <p className="text-3xl font-mono font-bold" style={{ color: savingColor }}>{displaySavingRate.toFixed(1)}%</p>
          <p className="text-sm text-[var(--color-muted)]">{T.saving_rate}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">{T.saving_label} {formatCurrency(Math.abs(totalSaving))}</p>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-muted)', opacity: 0.7 }}>{T.weekly_expense}</h3>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={weeklyData} barSize={32}>
            <XAxis dataKey="week" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: 'var(--color-accent)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 12 }}
              formatter={(v: unknown) => [formatCurrency(Number(v ?? 0)), T.expense]}
              labelStyle={{ color: 'var(--color-muted)' }}
            />
            <Bar dataKey="amount" radius={[6, 6, 2, 2]}>
              {weeklyData.map((_, i) => (
                <Cell key={i}
                  fill={i === Math.floor((new Date().getDate() - 1) / 7)
                    ? 'var(--color-highlight)'
                    : 'color-mix(in srgb, var(--color-highlight) 22%, var(--color-accent))'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {categoryData.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-muted)', opacity: 0.7 }}>{T.category_expense}</h3>
          <div className="flex items-center gap-2">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={categoryData} cx={65} cy={65} innerRadius={35} outerRadius={60} dataKey="value" paddingAngle={2}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {categoryData.map((item, i) => (
                <button key={item.name}
                  onClick={() => setFilterCat(item.name)}
                  className="w-full flex items-center gap-2 hover:bg-white/5 active:bg-white/10 rounded px-1 py-0.5 transition-colors">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-xs text-[var(--color-muted)] flex-1 truncate text-left">{item.icon} {item.label}</span>
                  <span className="text-xs font-mono text-[var(--color-text)]">{formatCurrency(item.value)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-muted)', opacity: 0.7 }}>{T.recent_tx}</h3>
          <button onClick={() => setActiveTab('daily')} className="text-xs text-[var(--color-info)] hover:underline">
            {T.view_all}
          </button>
        </div>
        <TransactionList transactions={recent} showDate compact
          onEdit={setEditingT}
          onDelete={id => useStore.getState().deleteTransaction(id)}
        />
      </div>

      {editingT && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md">
            <TransactionForm initialTransaction={editingT} onClose={() => setEditingT(null)} />
          </div>
        </div>
      )}

      {drillDown && drillDown !== 'saving' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setDrillDown(null)}>
          <div className="w-full max-w-md max-h-[80vh] flex flex-col bg-[var(--color-surface)] rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div>
                <h3 className="font-semibold text-[var(--color-text)] text-sm">{drillLabel} 내역</h3>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  {drillTxns.length}건 · {formatCurrency(drillTotal)}
                </p>
              </div>
              <button onClick={() => setDrillDown(null)}
                className="text-[var(--color-muted)] px-2 py-1 rounded hover:bg-white/10">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {drillTxns.length === 0
                ? <p className="text-sm text-[var(--color-muted)] text-center py-8">해당 항목 없음</p>
                : <TransactionList transactions={drillTxns} showDate
                    onEdit={t => { setDrillDown(null); setEditingT(t); }}
                    onDelete={id => useStore.getState().deleteTransaction(id)}
                  />
              }
            </div>
          </div>
        </div>
      )}

      {drillDown === 'saving' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setDrillDown(null)}>
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="font-semibold text-[var(--color-text)] text-sm">저축 계산</h3>
              <button onClick={() => setDrillDown(null)}
                className="text-[var(--color-muted)] px-2 py-1 rounded hover:bg-white/10">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {/* 공식 분해 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-muted)]">수입</span>
                  <span className="font-mono text-sm text-[var(--color-success)]">+{formatCurrency(totalIncome)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-sm text-[var(--color-muted)]">환급</span>
                  <span className="font-mono text-sm text-[var(--color-warning)]">+{formatCurrency(totalRefunds)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/10">
                  <span className="text-sm text-[var(--color-muted)]">지출</span>
                  <span className="font-mono text-sm text-[var(--color-highlight)]">−{formatCurrency(totalExpenses)}</span>
                </div>
                <div className="flex justify-between items-center py-2.5 bg-white/5 rounded-xl px-3">
                  <span className="text-sm font-semibold text-[var(--color-text)]">순 저축</span>
                  <span className={`font-mono text-base font-bold ${totalSaving >= 0 ? 'text-[var(--color-info)]' : 'text-[var(--color-highlight)]'}`}>
                    {totalSaving >= 0 ? '' : '−'}{formatCurrency(Math.abs(totalSaving))}
                  </span>
                </div>
              </div>
              {/* 저축률 */}
              <p className="text-xs text-[var(--color-muted)] text-center">
                저축률 {displaySavingRate.toFixed(1)}%
                {effectiveIncome > 0 && <span className="ml-1 opacity-60">({formatCurrency(effectiveIncome)} 기준)</span>}
              </p>
              {/* 바로가기 버튼 */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(['income','expense','refund'] as const).map(k => (
                  <button key={k} onClick={() => setDrillDown(k)}
                    className="py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-[var(--color-muted)] transition-colors">
                    {k === 'income' ? '수입 내역' : k === 'expense' ? '지출 내역' : '환급 내역'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {filterCat && (() => {
        const catTxns = monthTxns.filter(t => t.category === filterCat);
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
            onClick={() => setFilterCat(null)}>
            <div className="w-full max-w-md max-h-[80vh] overflow-y-auto bg-[var(--color-surface)] rounded-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div>
                  <h3 className="font-semibold text-[var(--color-text)] text-sm">
                    {getCategoryIcon(filterCat as any)} {T.filtered_tx(filterCat)}
                  </h3>
                  <p className="text-xs text-[var(--color-muted)]">
                    {formatCurrency(catTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0))}
                  </p>
                </div>
                <button onClick={() => setFilterCat(null)} className="text-[var(--color-muted)] px-2 py-1 rounded hover:bg-white/10">✕</button>
              </div>
              <div className="p-3">
                <TransactionList transactions={catTxns} showDate
                  onEdit={t => { setFilterCat(null); setEditingT(t); }}
                  onDelete={id => useStore.getState().deleteTransaction(id)}
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SummaryCard({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl p-4 text-left w-full transition-all active:scale-95"
      style={{
        background: `color-mix(in srgb, ${color} 10%, var(--color-surface))`,
        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
      }}
    >
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>{label}</p>
      <p className="text-base font-mono font-bold truncate" style={{ color }}>{formatCurrency(Math.abs(value))}</p>
    </button>
  );
}
