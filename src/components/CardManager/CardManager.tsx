import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { Card } from '../../types';
import { formatCurrency, getMonthTransactions } from '../../utils';
import { Plus, Edit2, Power } from 'lucide-react';
import { format } from 'date-fns';
import { CardForm } from './CardForm';

export function CardManager() {
  const { cards, transactions, currentYear, currentMonth } = useStore();
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [addingCard, setAddingCard] = useState(false);

  const monthTxns = useMemo(
    () => getMonthTransactions(transactions, currentYear, currentMonth),
    [transactions, currentYear, currentMonth]
  );

  // Monthly spend per card
  const cardSpend: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxns.filter(t => t.amount > 0).forEach(t => {
      map[t.cardId] = (map[t.cardId] || 0) + t.amount;
    });
    return map;
  }, [monthTxns]);

  const maxSpend = Math.max(...Object.values(cardSpend), 1);

  const today = new Date().getDate();
  const activeCards = cards.filter(c => c.isActive);
  const inactiveCards = cards.filter(c => !c.isActive);

  function dueDayWarning(day?: number): 'overdue' | 'soon' | 'ok' | null {
    if (!day) return null;
    const diff = day - today;
    if (diff < 0) return 'overdue';
    if (diff <= 3) return 'soon';
    return 'ok';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-[var(--color-text)]">카드 관리</h2>
        <button
          onClick={() => setAddingCard(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-highlight)] text-white text-sm font-medium"
        >
          <Plus size={14} /> 새 카드
        </button>
      </div>

      {/* Active Cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {activeCards.map(card => {
          const spend = cardSpend[card.id] || 0;
          const warning = dueDayWarning(card.payDueDay);

          return (
            <div
              key={card.id}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${card.color}dd, ${card.color}88)` }}
            >
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border-4 border-white" />
                <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full border-4 border-white" />
              </div>

              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-white text-sm">{card.name}</p>
                    <p className="text-xs text-white/70">{card.bank} · {card.type}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingCard(card)}
                      className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white"
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => useStore.getState().toggleCardActive(card.id)}
                      className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white"
                    >
                      <Power size={12} />
                    </button>
                  </div>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-white/70 mb-0.5">이번 달 사용</p>
                    <p className="font-mono font-bold text-white text-lg">{formatCurrency(spend)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      card.owner === 'Kyle' ? 'bg-blue-500/30 text-blue-200' :
                      card.owner === 'Ella' ? 'bg-pink-500/30 text-pink-200' :
                      'bg-white/20 text-white/80'
                    }`}>
                      {card.owner}
                    </span>
                    {card.payDueDay && (
                      <p className={`text-xs mt-1 ${
                        warning === 'soon' ? 'text-yellow-300 font-bold' :
                        warning === 'overdue' ? 'text-red-300' : 'text-white/60'
                      }`}>
                        결제일 {card.payDueDay}일
                        {warning === 'soon' ? ' ⚠️' : warning === 'overdue' ? ' ✓' : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Spend bar */}
                {spend > 0 && (
                  <div className="mt-3">
                    <div className="h-1 bg-white/20 rounded-full">
                      <div
                        className="h-full bg-white/60 rounded-full transition-all"
                        style={{ width: `${(spend / maxSpend) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Spend Comparison */}
      {Object.keys(cardSpend).length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">카드별 이번 달 지출</h3>
          <div className="space-y-2">
            {cards
              .filter(c => cardSpend[c.id])
              .sort((a, b) => (cardSpend[b.id] || 0) - (cardSpend[a.id] || 0))
              .map(card => (
                <div key={card.id} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: card.color }} />
                  <span className="text-xs text-[var(--color-muted)] w-32 truncate">{card.name}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${((cardSpend[card.id] || 0) / maxSpend) * 100}%`,
                        backgroundColor: card.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-[var(--color-text)] w-20 text-right">
                    {formatCurrency(cardSpend[card.id] || 0)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Payment Due Calendar */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">
          {format(new Date(currentYear, currentMonth - 1), 'M월')} 결제일
        </h3>
        <div className="space-y-1.5">
          {activeCards
            .filter(c => c.payDueDay && c.type === 'credit')
            .sort((a, b) => (a.payDueDay || 0) - (b.payDueDay || 0))
            .map(card => {
              const warning = dueDayWarning(card.payDueDay);
              return (
                <div key={card.id} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: card.color }} />
                  <span className="text-sm text-[var(--color-text)] flex-1">{card.name}</span>
                  <span className={`text-sm font-mono font-bold ${
                    warning === 'soon' ? 'text-[var(--color-warning)]' :
                    warning === 'overdue' ? 'text-[var(--color-muted)]' : 'text-[var(--color-text)]'
                  }`}>
                    {card.payDueDay}일
                    {warning === 'soon' && <span className="ml-1 text-xs">⚠️ 임박</span>}
                    {warning === 'overdue' && <span className="ml-1 text-xs">✓ 완료</span>}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* Inactive Cards */}
      {inactiveCards.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">비활성 카드</h3>
          <div className="space-y-2">
            {inactiveCards.map(card => (
              <div key={card.id} className="flex items-center gap-3 opacity-50">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                <span className="text-sm text-[var(--color-muted)] flex-1">{card.name}</span>
                <span className="text-xs bg-white/10 text-[var(--color-muted)] px-2 py-0.5 rounded-full">비활성</span>
                <button
                  onClick={() => useStore.getState().toggleCardActive(card.id)}
                  className="text-xs text-[var(--color-info)] hover:underline"
                >
                  활성화
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(addingCard || editingCard) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardForm
              initialCard={editingCard || undefined}
              onClose={() => { setAddingCard(false); setEditingCard(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
