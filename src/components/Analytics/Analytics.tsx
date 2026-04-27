import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { formatCurrency, getMonthTransactions, calcMonthSummary, getCategoryIcon, calcNetWorth } from '../../utils';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subDays } from 'date-fns';

type Period = 'weekly' | 'monthly' | 'yearly';

const COLORS = ['#E94560', '#74B9FF', '#00B894', '#FDCB6E', '#A29BFE', '#FD79A8', '#55EFC4', '#FF7675'];
const MONTHS_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export function Analytics() {
  const { transactions, assets, cards, currentYear, currentMonth } = useStore();
  const [period, setPeriod] = useState<Period>('monthly');

  // ── Monthly data ──
  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const txns = getMonthTransactions(transactions, currentYear, m);
      const { totalIncome, totalExpenses, totalSaving, savingRate } = calcMonthSummary(txns);
      return { month: MONTHS_KR[i], totalIncome, totalExpenses, totalSaving, savingRate };
    });
  }, [transactions, currentYear]);

  // ── Weekly data ──
  const weeklyData = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({
      start: startOfWeek(today, { weekStartsOn: 0 }),
      end: endOfWeek(today, { weekStartsOn: 0 }),
    });
    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    return days.map((day, i) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayTxns = transactions.filter(t => t.date === dateStr && t.amount > 0);
      const amount = dayTxns.reduce((s, t) => s + t.amount, 0);
      return { day: dayLabels[i], amount, date: dateStr };
    });
  }, [transactions]);

  const lastWeekData = useMemo(() => {
    const today = new Date();
    const days = eachDayOfInterval({
      start: startOfWeek(subDays(today, 7), { weekStartsOn: 0 }),
      end: endOfWeek(subDays(today, 7), { weekStartsOn: 0 }),
    });
    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];
    return days.map((day, i) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const amount = transactions.filter(t => t.date === dateStr && t.amount > 0).reduce((s, t) => s + t.amount, 0);
      return { day: dayLabels[i], amount };
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
        month: MONTHS_KR[a.month - 1],
        netWorth: calcNetWorth(a),
        saving: a.apple_saving + a.capital_one,
      }));
  }, [assets, currentYear]);

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

  return (
    <div className="space-y-4">
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
            {p === 'weekly' ? '주간' : p === 'monthly' ? '월간' : '연간'}
          </button>
        ))}
      </div>

      {/* ─── WEEKLY ─── */}
      {period === 'weekly' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--color-surface)] rounded-2xl p-3 col-span-2">
              <p className="text-xs text-[var(--color-muted)]">이번 주 지출</p>
              <p className="text-xl font-mono font-bold text-[var(--color-highlight)]">{formatCurrency(thisWeekTotal)}</p>
            </div>
            <div className={`rounded-2xl p-3 ${weekDiff > 0 ? 'bg-red-900/30' : 'bg-green-900/30'}`}>
              <p className="text-xs text-[var(--color-muted)]">전주 대비</p>
              <p className={`text-lg font-mono font-bold ${weekDiff > 0 ? 'text-[var(--color-highlight)]' : 'text-[var(--color-success)]'}`}>
                {weekDiff > 0 ? '+' : ''}{weekDiff.toFixed(0)}%
              </p>
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">이번 주 일별 지출</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} barSize={28}>
                <XAxis dataKey="day" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" name="지출" radius={[4, 4, 0, 0]}>
                  {weeklyData.map((entry, i) => (
                    <Cell key={i} fill={entry.date === format(new Date(), 'yyyy-MM-dd') ? 'var(--color-highlight)' : 'var(--color-accent)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">이번 달 카테고리</h3>
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
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[var(--color-muted)] flex-1 truncate">{getCategoryIcon(item.name as any)} {item.name}</span>
                    <span className="font-mono text-[var(--color-text)]">{formatCurrency(item.value)}</span>
                  </div>
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
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{currentYear}년 수입/지출 추이</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="totalIncome" name="수입" stroke="var(--color-success)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="totalExpenses" name="지출" stroke="var(--color-highlight)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="totalSaving" name="저축" stroke="var(--color-info)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 justify-center">
              {[['수입', 'var(--color-success)'], ['지출', 'var(--color-highlight)'], ['저축', 'var(--color-info)']].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">저축률 변화</h3>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} formatter={(v: unknown) => [`${Number(v ?? 0).toFixed(1)}%`, '저축률']} />
                <Line type="monotone" dataKey="savingRate" name="저축률" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">카드별 이번 달 지출</h3>
            <div className="space-y-2">
              {cardMonthData.map(c => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="text-xs text-[var(--color-muted)] w-28 truncate">{c.name}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.value / (cardMonthData[0]?.value || 1)) * 100}%`,
                        backgroundColor: c.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-[var(--color-text)] w-20 text-right">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── YEARLY ─── */}
      {period === 'yearly' && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '연간 수입', value: monthlyData.reduce((s, m) => s + m.totalIncome, 0), color: 'var(--color-success)' },
              { label: '연간 지출', value: monthlyData.reduce((s, m) => s + m.totalExpenses, 0), color: 'var(--color-highlight)' },
              { label: '연간 저축', value: monthlyData.reduce((s, m) => s + m.totalSaving, 0), color: 'var(--color-info)' },
            ].map(item => (
              <div key={item.label} className="bg-[var(--color-surface)] rounded-2xl p-3">
                <p className="text-xs text-[var(--color-muted)]">{item.label}</p>
                <p className="text-sm font-mono font-bold" style={{ color: item.color }}>
                  {formatCurrency(Math.abs(item.value))}
                </p>
              </div>
            ))}
          </div>

          {/* Monthly heatmap */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">월별 지출 히트맵</h3>
            <div className="grid grid-cols-6 gap-2">
              {monthlyData.map((m, i) => {
                const max = Math.max(...monthlyData.map(d => d.totalExpenses), 1);
                const intensity = m.totalExpenses / max;
                return (
                  <div key={i} className="text-center">
                    <div
                      className="h-10 rounded-lg mb-1 flex items-center justify-center text-xs font-mono text-white"
                      style={{ backgroundColor: `rgba(233, 69, 96, ${intensity * 0.9 + 0.1})` }}
                    >
                      {m.totalExpenses > 0 ? `$${(m.totalExpenses / 1000).toFixed(1)}k` : '—'}
                    </div>
                    <span className="text-xs text-[var(--color-muted)]">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Asset Trend */}
          {assetTrend.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">자산 증가 추이</h3>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={assetTrend}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--color-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="netWorth" name="순자산" stroke="var(--color-success)" strokeWidth={2} dot={{ fill: 'var(--color-success)', r: 3 }} />
                  <Line type="monotone" dataKey="saving" name="저축" stroke="var(--color-info)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Yearly category */}
          <div className="bg-[var(--color-surface)] rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">연간 카테고리</h3>
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
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[var(--color-muted)] flex-1 truncate">{getCategoryIcon(item.name as any)} {item.name}</span>
                    <span className="font-mono text-[var(--color-text)]">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Asset Status */}
          {latestAsset && (
            <div className="bg-[var(--color-surface)] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">자산 현황</h3>
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
                  <span className="font-semibold text-[var(--color-text)]">총 순자산</span>
                  <span className={`text-lg font-mono font-bold ${netWorth >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-highlight)]'}`}>
                    {formatCurrency(netWorth)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
