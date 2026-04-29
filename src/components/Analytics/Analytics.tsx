import { useState, useMemo, type ReactNode } from 'react';
import { useStore } from '../../store/useStore';
import { formatCurrency, getMonthTransactions, calcMonthSummary, getCategoryIcon, calcNetWorth } from '../../utils';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subDays } from 'date-fns';
import { TRANSLATIONS, tCat } from '../../lib/i18n';
import type { Transaction } from '../../types';
import { TransactionList } from '../shared/TransactionList';
import { TransactionForm } from '../TransactionForm/TransactionForm';
import { MonthPicker } from '../shared/MonthPicker';

type Period = 'weekly' | 'monthly' | 'yearly';
type DetailModal =
  | { type: 'day'; date: string }
  | { type: 'month'; month: number }
  | { type: 'month-user'; month: number }
  | { type: 'annual-summary'; kind: 'income' | 'expense' | 'saving' };

const COLORS = ['#E94560', '#74B9FF', '#00B894', '#FDCB6E', '#A29BFE', '#FD79A8', '#55EFC4', '#FF7675'];

export function Analytics() {
  const { transactions, assets, cards, currentYear, currentMonth } = useStore();
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const [period, setPeriod] = useState<Period>('monthly');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [editingT, setEditingT] = useState<Transaction | null>(null);
  const [detailModal, setDetailModal] = useState<DetailModal | null>(null);

  const months = T.months_ko;

  // ── Monthly data ──
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const txns = getMonthTransactions(transactions, currentYear, m);
      const { totalIncome, totalExpenses, totalSaving, savingRate } = calcMonthSummary(txns);
      return { month: months[i], totalIncome, totalExpenses, totalSaving, savingRate };
    });
  }, [transactions, currentYear, months]);

  // ── Weekly data ──
  const weeklyData = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({
      start: startOfWeek(today, { weekStartsOn: 0 }),
      end: endOfWeek(today, { weekStartsOn: 0 }),
    });
    return days.map((day, i) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTxns = transactions.filter(t => t.date === dateStr && t.amount > 0);
      const amount = dayTxns.reduce((s, t) => s + t.amount, 0);
      return { day: T.dow[i], amount, date: dateStr };
    });
  }, [transactions, T.dow]);

  const lastWeekData = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({
      start: startOfWeek(subDays(today, 7), { weekStartsOn: 0 }),
      end: endOfWeek(subDays(today, 7), { weekStartsOn: 0 }),
    });
    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const amount = transactions.filter(t => t.date === dateStr && t.amount > 0).reduce((s, t) => s + t.amount, 0);
      return { amount };
    });
  }, [transactions]);

  const thisWeekTotal = weeklyData.reduce((s, d) => s + d.amount, 0);
  const lastWeekTotal = lastWeekData.reduce((s, d) => s + d.amount, 0);
  const weekDiff = lastWeekTotal > 0 ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100 : 0;

  // ── Category data for current month ──
  const categoryData = useMemo(() => {
    const txns = getMonthTransactions(transactions, currentYear, currentMonth);
    const map: Record<string, number> = {};
    txns.filter(t => t.amount > 0).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [transactions, currentYear, currentMonth]);

  // ── Yearly category ──
  const yearlyCategoryData = useMemo(() => {
    const txns = transactions.filter(t => t.date.startsWith(String(currentYear)));
    const map: Record<string, number> = {};
    txns.filter(t => t.amount > 0).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [transactions, currentYear]);

  // ── Current assets ──
  const latestAsset = assets
    .filter(a => a.year === currentYear)
    .sort((a, b) => b.month - a.month)[0];

  const netWorth = latestAsset ? calcNetWorth(latestAsset) : 0;

  // ── Asset trend ──
  const assetTrend = useMemo(() => {
    return assets
      .filter(a => a.year === currentYear)
      .sort((a, b) => a.month - b.month)
      .map(a => ({
        month: months[a.month - 1],
        netWorth: calcNetWorth(a),
        saving: a.apple_saving + a.capital_one,
      }));
  }, [assets, currentYear, months]);

  // ── User (Kyle/Ella/Both/SA) breakdown for current month ──
  const USER_COLORS: Record<string, string> = {
    Kyle: 'var(--color-info)',
    Ella: '#ec4899',
    Both: '#A29BFE',
    SA:   '#FDCB6E',
  };
  const USERS = ['Kyle', 'Ella', 'Both', 'SA'] as const;

  const userMonthData = useMemo(() => {
    const txns = getMonthTransactions(transactions, currentYear, currentMonth);
    return USERS.map(u => ({
      user: u,
      amount: txns.filter(t => t.user === u && t.amount > 0).reduce((s, t) => s + t.amount, 0),
    }));
  }, [transactions, currentYear, currentMonth]);

  const userYearlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const txns = getMonthTransactions(transactions, currentYear, m);
      const row: Record<string, number | string> = { month: months[i] };
      USERS.forEach(u => {
        row[u] = txns.filter(t => t.user === u && t.amount > 0).reduce((s, t) => s + t.amount, 0);
      });
      return row;
    });
  }, [transactions, currentYear, months]);

  // ── Card spend for current month ──
  const cardMonthData = useMemo(() => {
    const txns = getMonthTransactions(transactions, currentYear, currentMonth);
    const map: Record<string, number> = {};
    txns.filter(t => t.amount > 0).forEach(t => {
      map[t.cardId] = (map[t.cardId] || 0) + t.amount;
    });
    return cards
      .filter(c => map[c.id])
      .map(c => ({ name: c.name.replace(/\(.*?\)/, '').trim(), value: map[c.id], color: c.color }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, cards, currentYear, currentMonth]);

  // ── Filtered transactions for detail view ──
  const filteredTxns = useMemo(() => {
    if (!filterCat) return [];
    return transactions.filter(t => t.category === filterCat && t.date.startsWith(`${currentYear}-`));
  }, [filterCat, transactions, currentYear]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-[var(--color-accent)] rounded-lg px-3 py-2 text-xs border border-white/10 shadow-xl">
          <p className="text-[var(--color-muted)] mb-1">{label}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color }}>{p.name}: {formatCurrency(p.value)}</p>
          ))}
        </div>
      );
    }
    return null;
  };

  // ── Detail modal content ──
  let detailTitle = '';
  let detailBody: ReactNode = null;

  if (detailModal) {
    const dm = detailModal; // stable const for TS narrowing inside branches
    if (dm.type === 'day') {
      const d = new Date(dm.date + 'T12:00:00');
      detailTitle = lang === 'ko'
        ? `${d.getMonth() + 1}월 ${d.getDate()}일`
        : format(d, 'MMM d, yyyy');
      const dayTxns = transactions.filter(t => t.date === dm.date);
      const total = dayTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      detailBody = (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--color-muted)]">{T.total_label}</span>
            <span className="text-sm font-mono font-bold text-[var(--color-highlight)]">{formatCurrency(total)}</span>
          </div>
          <TransactionList transactions={dayTxns} showDate={false}
            onEdit={t => { setDetailModal(null); setEditingT(t); }}
            onDelete={id => useStore.getState().deleteTransaction(id)} />
        </>
      );
    } else if (dm.type === 'month' || dm.type === 'month-user') {
      const mTxns = getMonthTransactions(transactions, currentYear, dm.month);
      const { totalIncome, totalExpenses, totalRefunds, totalSaving } = calcMonthSummary(mTxns);
      detailTitle = lang === 'ko'
        ? `${currentYear}년 ${dm.month}월`
        : `${months[dm.month - 1]} ${currentYear}`;
      detailBody = (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-[var(--color-accent)] rounded-xl p-2.5">
              <p className="text-xs text-[var(--color-muted)]">{T.income}</p>
              <p className="text-sm font-mono font-bold text-[var(--color-success)]">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="bg-[var(--color-accent)] rounded-xl p-2.5">
              <p className="text-xs text-[var(--color-muted)]">{T.expense}</p>
              <p className="text-sm font-mono font-bold text-[var(--color-highlight)]">{formatCurrency(totalExpenses)}</p>
            </div>
            {totalRefunds > 0 && (
              <div className="bg-[var(--color-accent)] rounded-xl p-2.5">
                <p className="text-xs text-[var(--color-muted)]">{T.t_refund}</p>
                <p className="text-sm font-mono font-bold text-[var(--color-warning)]">{formatCurrency(totalRefunds)}</p>
              </div>
            )}
            <div className="bg-[var(--color-accent)] rounded-xl p-2.5">
              <p className="text-xs text-[var(--color-muted)]">{T.saving}</p>
              <p className={`text-sm font-mono font-bold ${totalSaving >= 0 ? 'text-[var(--color-info)]' : 'text-[var(--color-highlight)]'}`}>
                {formatCurrency(totalSaving)}
              </p>
            </div>
            {dm.type === 'month-user' && USERS.map(u => {
              const amt = mTxns.filter(t => t.user === u && t.amount > 0).reduce((s, t) => s + t.amount, 0);
              if (!amt) return null;
              return (
                <div key={u} className="rounded-xl p-2.5"
                  style={{ backgroundColor: USER_COLORS[u] + '22', border: `1px solid ${USER_COLORS[u]}44` }}>
                  <p className="text-xs font-medium" style={{ color: USER_COLORS[u] }}>{u}</p>
                  <p className="text-sm font-mono font-bold text-[var(--color-text)]">{formatCurrency(amt)}</p>
                </div>
              );
            })}
          </div>
          <TransactionList transactions={mTxns.filter(t => t.amount > 0)} showDate
            onEdit={t => { setDetailModal(null); setEditingT(t); }}
            onDelete={id => useStore.getState().deleteTransaction(id)} />
        </>
      );
    } else if (dm.type === 'annual-summary') {
      const kindColor =
        dm.kind === 'income'  ? 'var(--color-success)' :
        dm.kind === 'expense' ? 'var(--color-highlight)' : 'var(--color-info)';
      const kindLabel =
        dm.kind === 'income'  ? T.an_annual_income :
        dm.kind === 'expense' ? T.an_annual_expense : T.an_annual_saving;
      const dataKey =
        dm.kind === 'income'  ? 'totalIncome' :
        dm.kind === 'expense' ? 'totalExpenses' : 'totalSaving';
      const total = monthlyData.reduce((s, m) => s + (m as any)[dataKey], 0);
      detailTitle = `${currentYear} ${kindLabel}`;
      detailBody = (
        <>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs text-[var(--color-muted)]">
              {lang === 'ko' ? '연간 합계' : 'Annual Total'}
            </span>
            <span className="text-base font-mono font-bold" style={{ color: kindColor }}>
              {formatCurrency(Math.abs(total))}
            </span>
          </div>
          <div className="space-y-1">
            {monthlyData.map((m, i) => {
              const value = (m as any)[dataKey] as number;
              const absTotal = Math.abs(total);
              const pct = absTotal > 0 ? Math.abs(value) / absTotal * 100 : 0;
              return (
                <button key={i}
                  onClick={() => setDetailModal({ type: 'month', month: i + 1 })}
                  className="w-full flex items-center gap-3 hover:bg-white/5 rounded-lg px-2 py-1.5 transition-colors">
                  <span className="text-xs text-[var(--color-muted)] w-8 text-right">{m.month}</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: kindColor }} />
                  </div>
                  <span className="text-xs font-mono w-20 text-right" style={{ color: kindColor }}>
                    {Math.abs(value) > 0 ? formatCurrency(Math.abs(value)) : '—'}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-center text-[var(--color-muted)] mt-3 opacity-60">
            {lang === 'ko' ? '월 클릭 시 상세 내역' : 'Tap month for transactions'}
          </p>
        </>
      );
    }
  }

  return (
    <div className="space-y-4">
      <MonthPicker />

      {/* Period Toggle */}
      <div className="flex gap-1 bg-[var(--color-surface)] rounded-xl p-1">
        {(['weekly', 'monthly', 'yearly'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p ? 'bg-[var(--color-highlight)] text-white' : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {p === 'weekly' ? T.an_weekly : p === 'monthly' ? T.an_monthly : T.an_yearly}
          </button>
        ))}
      </div>

      {/* ─── WEEKLY ─── */}
      {period === 'weekly' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--color-surface)] rounded-2xl p-3 col-span-2">
              <p className="text-xs text-[var(--color-muted)]">{T.an_this_week}</p>
              <p className="text-xl font-mono font-bold text-[var(--color-highlight)]">{formatCurrency(thisWeekTotal)}</p>
            </div>
            <div className={`rounded-2xl p-3 ${weekDiff > 0 ? 'bg-red-900/30' : 'bg-green-900/30'}`}>
              <p className="text-xs text-[var(--color-muted)]">{T.an_vs_last}</p>
              <p className={`text-lg font-mono font-bold ${weekDiff > 0 ? 'text-[var(--color-highlight)]' : 'text-[var(--color-success)]'}`}>
                {weekDiff > 0 ? '▲' : '▼'}{Math.abs(weekDiff).toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-1">{T.an_daily_this_week}</h3>
            <p className="text-xs text-[var(--color-muted)] mb-3 opacity-60">
              {lang === 'ko' ? '막대 클릭 시 상세 내역' : 'Tap bar for details'}
            </p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} barSize={28}>
                <XAxis dataKey="day" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name={T.an_expense_label} radius={[4, 4, 0, 0]}
                  style={{ cursor: 'pointer' }}
                  onClick={(data: any) => data?.date && setDetailModal({ type: 'day', date: data.date })}>
                  {weeklyData.map((entry, i) => (
                    <Cell key={i} fill={entry.date === format(new Date(), 'yyyy-MM-dd') ? 'var(--color-highlight)' : 'var(--color-accent)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.an_month_category}</h3>
            <div className="flex gap-2">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={categoryData} cx={55} cy={55} innerRadius={28} outerRadius={52} dataKey="value" paddingAngle={2}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1 text-xs">
                {categoryData.slice(0, 5).map((item, i) => (
                  <button key={item.name}
                    onClick={() => setFilterCat(filterCat === item.name ? null : item.name)}
                    className="w-full flex items-center gap-2 hover:bg-white/5 rounded px-1 py-0.5 transition-colors">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[var(--color-muted)] flex-1 truncate text-left">{getCategoryIcon(item.name as any)} {tCat(lang, item.name)}</span>
                    <span className="font-mono text-[var(--color-text)]">{formatCurrency(item.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── MONTHLY ─── */}
      {period === 'monthly' && (
        <>
          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.an_income_expense(currentYear)}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="totalIncome" name={T.an_income_label} stroke="var(--color-success)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="totalExpenses" name={T.an_expense_label} stroke="var(--color-highlight)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="totalSaving" name={T.an_saving_label} stroke="var(--color-info)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center">
              {[
                [T.an_income_label, 'var(--color-success)'],
                [T.an_expense_label, 'var(--color-highlight)'],
                [T.an_saving_label, 'var(--color-info)'],
              ].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.an_saving_rate}</h3>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`, T.an_saving_rate]} />
                <Line type="monotone" dataKey="savingRate" name={T.an_saving_rate} stroke="var(--color-warning)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.an_card_monthly}</h3>
            <div className="space-y-2">
              {cardMonthData.map(c => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-xs text-[var(--color-muted)] w-28 truncate">{c.name}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(c.value / (cardMonthData[0]?.value || 1)) * 100}%`, backgroundColor: c.color }} />
                  </div>
                  <span className="text-xs font-mono text-[var(--color-text)] w-20 text-right">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Member breakdown this month ── */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.an_user_month}</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {userMonthData.map(({ user, amount }) => (
                <div key={user} className="rounded-xl p-3" style={{ backgroundColor: USER_COLORS[user] + '22', border: `1px solid ${USER_COLORS[user]}44` }}>
                  <p className="text-xs font-medium mb-1" style={{ color: USER_COLORS[user] }}>{user}</p>
                  <p className="text-base font-mono font-bold text-[var(--color-text)]">{formatCurrency(amount)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {userMonthData.filter(d => d.amount > 0).sort((a, b) => b.amount - a.amount).map(({ user, amount }) => {
                const max = Math.max(...userMonthData.map(d => d.amount), 1);
                return (
                  <div key={user} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-8" style={{ color: USER_COLORS[user] }}>{user}</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(amount / max) * 100}%`, backgroundColor: USER_COLORS[user] }} />
                    </div>
                    <span className="text-xs font-mono text-[var(--color-text)] w-20 text-right">{formatCurrency(amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ─── YEARLY ─── */}
      {period === 'yearly' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {([
              { label: T.an_annual_income,  value: monthlyData.reduce((s, m) => s + m.totalIncome, 0),   color: 'var(--color-success)',   kind: 'income'  as const },
              { label: T.an_annual_expense, value: monthlyData.reduce((s, m) => s + m.totalExpenses, 0), color: 'var(--color-highlight)', kind: 'expense' as const },
              { label: T.an_annual_saving,  value: monthlyData.reduce((s, m) => s + m.totalSaving, 0),   color: 'var(--color-info)',      kind: 'saving'  as const },
            ]).map(item => (
              <button key={item.label}
                onClick={() => setDetailModal({ type: 'annual-summary', kind: item.kind })}
                className="bg-[var(--color-surface)] rounded-2xl p-3 text-left hover:bg-white/5 transition-colors">
                <p className="text-xs text-[var(--color-muted)]">{item.label}</p>
                <p className="text-sm font-mono font-bold" style={{ color: item.color }}>
                  {formatCurrency(Math.abs(item.value))}
                </p>
              </button>
            ))}
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-1">{T.an_heatmap}</h3>
            <p className="text-xs text-[var(--color-muted)] mb-3 opacity-60">
              {lang === 'ko' ? '월 클릭 시 상세 내역' : 'Tap month for details'}
            </p>
            <div className="grid grid-cols-6 gap-2">
              {monthlyData.map((m, i) => {
                const max = Math.max(...monthlyData.map(d => d.totalExpenses), 1);
                const intensity = m.totalExpenses / max;
                return (
                  <button key={i} onClick={() => setDetailModal({ type: 'month', month: i + 1 })}
                    className="text-center w-full">
                    <div className="h-10 rounded-lg mb-1 flex items-center justify-center text-xs font-mono text-white hover:opacity-75 transition-opacity"
                      style={{ backgroundColor: `rgba(233, 69, 96, ${intensity * 0.9 + 0.1})` }}>
                      {m.totalExpenses > 0 ? `$${(m.totalExpenses / 1000).toFixed(1)}k` : '—'}
                    </div>
                    <span className="text-xs text-[var(--color-muted)]">{m.month}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Member breakdown by month (yearly) ── */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-1">{T.an_user_year}</h3>
            <p className="text-xs text-[var(--color-muted)] mb-3 opacity-60">
              {lang === 'ko' ? '막대 클릭 시 월별 상세' : 'Tap bar for monthly detail'}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={userYearlyData} barSize={12} style={{ cursor: 'pointer' }}
                onClick={(data: any) => {
                  if (data?.activeTooltipIndex != null) {
                    setDetailModal({ type: 'month-user', month: data.activeTooltipIndex + 1 });
                  }
                }}>
                <XAxis dataKey="month" tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                {USERS.map(u => (
                  <Bar key={u} dataKey={u} name={u} stackId="a" fill={USER_COLORS[u]} radius={u === 'SA' ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center flex-wrap">
              {USERS.map(u => (
                <div key={u} className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: USER_COLORS[u] }} />
                  {u}
                </div>
              ))}
            </div>
          </div>

          {assetTrend.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.an_asset_trend}</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={assetTrend}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="netWorth" name={T.an_net_worth_label} stroke="var(--color-success)" strokeWidth={2} dot={{ fill: 'var(--color-success)', r: 3 }} />
                  <Line type="monotone" dataKey="saving" name={T.an_saving_label2} stroke="var(--color-info)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.an_yearly_category}</h3>
            <div className="flex gap-2">
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie data={yearlyCategoryData} cx={60} cy={60} innerRadius={30} outerRadius={58} dataKey="value" paddingAngle={2}>
                    {yearlyCategoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 text-xs">
                {yearlyCategoryData.slice(0, 6).map((item, i) => (
                  <button key={item.name}
                    onClick={() => setFilterCat(filterCat === item.name ? null : item.name)}
                    className="w-full flex items-center gap-2 hover:bg-white/5 rounded px-1 py-0.5 transition-colors">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[var(--color-muted)] flex-1 truncate text-left">{getCategoryIcon(item.name as any)} {tCat(lang, item.name)}</span>
                    <span className="font-mono text-[var(--color-text)]">{formatCurrency(item.value)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {latestAsset && (
            <div className="bg-[var(--color-surface)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.an_asset_status}</h3>
              <div className="space-y-2">
                {[
                  { label: 'Apple Saving', value: latestAsset.apple_saving, positive: true },
                  { label: 'Capital One Saving', value: latestAsset.capital_one, positive: true },
                  { label: 'Chase Checking', value: latestAsset.chase_checking, positive: true },
                  { label: 'Cash', value: latestAsset.cash, positive: true },
                  { label: 'MIA Debt', value: latestAsset.mia_debt, positive: false },
                  { label: 'Need to Pay', value: latestAsset.need_to_pay, positive: latestAsset.need_to_pay > 0 },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-sm text-[var(--color-muted)]">{item.label}</span>
                    <span className={`text-sm font-mono font-bold ${item.positive ? 'text-[var(--color-success)]' : 'text-[var(--color-highlight)]'}`}>
                      {item.positive ? '' : '-'}{formatCurrency(Math.abs(item.value))}
                    </span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                  <span className="font-semibold text-[var(--color-text)]">{T.an_net_worth}</span>
                  <span className={`text-lg font-mono font-bold ${netWorth >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-highlight)]'}`}>
                    {formatCurrency(netWorth)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail modal (day / month / month-user) */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setDetailModal(null)}>
          <div className="w-full max-w-md max-h-[80vh] flex flex-col bg-[var(--color-surface)] rounded-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <h3 className="font-semibold text-[var(--color-text)] text-sm">{detailTitle}</h3>
              <button onClick={() => setDetailModal(null)} className="text-[var(--color-muted)] text-sm px-2 py-1 rounded hover:bg-white/10">✕</button>
            </div>
            <div className="p-3 overflow-y-auto flex-1">{detailBody}</div>
          </div>
        </div>
      )}

      {/* Category detail modal */}
      {filterCat && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setFilterCat(null)}>
          <div className="w-full max-w-md max-h-[80vh] overflow-y-auto bg-[var(--color-surface)] rounded-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h3 className="font-semibold text-[var(--color-text)] text-sm">
                {getCategoryIcon(filterCat as any)} {tCat(lang, filterCat)}
              </h3>
              <button onClick={() => setFilterCat(null)} className="text-[var(--color-muted)] text-sm px-2 py-1 rounded hover:bg-white/10">✕</button>
            </div>
            <div className="p-3">
              <TransactionList transactions={filteredTxns} showDate
                onEdit={t => { setFilterCat(null); setEditingT(t); }}
                onDelete={id => useStore.getState().deleteTransaction(id)}
              />
            </div>
          </div>
        </div>
      )}

      {editingT && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <TransactionForm initialTransaction={editingT} onClose={() => setEditingT(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
