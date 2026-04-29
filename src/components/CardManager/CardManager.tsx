import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { Card, Transaction } from '../../types';
import { formatCurrency, getMonthTransactions, getCategoryIcon } from '../../utils';
import { Plus, Edit2, Power, GripVertical, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { CardForm } from './CardForm';
import { TransactionList } from '../shared/TransactionList';
import { TransactionForm } from '../TransactionForm/TransactionForm';
import { MonthPicker } from '../shared/MonthPicker';
import { TRANSLATIONS, tCat } from '../../lib/i18n';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableCard({
  card, spend, maxSpend, warning, onEdit, onToggle, onSelect, lang,
}: {
  card: Card; spend: number; maxSpend: number;
  warning: 'overdue' | 'soon' | 'ok' | null;
  onEdit: () => void; onToggle: () => void; onSelect: () => void; lang: 'ko' | 'en';
}) {
  const T = TRANSLATIONS[lang];
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const mergedStyle = { ...style, background: `linear-gradient(135deg, ${card.color}dd, ${card.color}88)` };

  return (
    <div ref={setNodeRef} style={mergedStyle} className="relative rounded-2xl p-4 overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none" />
      <div className="absolute inset-0 opacity-5">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border-4 border-white" />
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full border-4 border-white" />
      </div>
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Drag handle */}
            <button
              ref={setActivatorNodeRef}
              {...listeners}
              {...attributes}
              className="p-1 rounded-md bg-white/10 hover:bg-white/25 text-white/60 cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical size={14} />
            </button>
            <div>
              <p className="font-bold text-white text-sm">{card.name}</p>
              <p className="text-xs text-white/70">{card.bank} · {card.type}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={onEdit} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white">
              <Edit2 size={12} />
            </button>
            <button onClick={onToggle} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white">
              <Power size={12} />
            </button>
          </div>
        </div>
        {/* Clickable spend area */}
        <button
          onClick={onSelect}
          className="w-full flex items-end justify-between hover:bg-white/10 rounded-xl p-1 -m-1 transition-colors"
        >
          <div>
            <p className="text-xs text-white/70 mb-0.5">{T.this_month_usage}</p>
            <p className="font-mono font-bold text-white text-lg">{formatCurrency(spend)}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                card.owner === 'Kyle' ? 'bg-blue-500/30 text-blue-200' :
                card.owner === 'Ella' ? 'bg-pink-500/30 text-pink-200' : 'bg-white/20 text-white/80'
              }`}>{card.owner}</span>
              <ChevronRight size={12} className="text-white/40" />
            </div>
            {card.payDueDay && (
              <p className={`text-xs mt-1 ${
                warning === 'soon' ? 'text-yellow-300 font-bold' :
                warning === 'overdue' ? 'text-red-300' : 'text-white/60'
              }`}>
                {T.due_day_label(card.payDueDay)}
                {warning === 'soon' ? ' ⚠️' : warning === 'overdue' ? ' ✓' : ''}
              </p>
            )}
          </div>
        </button>
        {spend > 0 && (
          <div className="mt-3">
            <div className="h-1 bg-white/20 rounded-full">
              <div className="h-full bg-white/60 rounded-full transition-all" style={{ width: `${(spend / maxSpend) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function CardManager() {
  const { cards, transactions, currentYear, currentMonth, reorderCards } = useStore();
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editingT, setEditingT] = useState<Transaction | null>(null);

  const monthTxns = useMemo(
    () => getMonthTransactions(transactions, currentYear, currentMonth),
    [transactions, currentYear, currentMonth]
  );

  const cardSpend: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxns.filter(t => t.amount > 0).forEach(t => {
      map[t.cardId] = (map[t.cardId] || 0) + t.amount;
    });
    return map;
  }, [monthTxns]);

  const maxSpend = Math.max(...Object.values(cardSpend), 1);
  const today = new Date().getDate();
  const activeCards = useMemo(() =>
    cards
      .filter(c => c.isActive)
      .sort((a, b) => (cardSpend[b.id] || 0) - (cardSpend[a.id] || 0)),
    [cards, cardSpend]
  );
  const inactiveCards = cards.filter(c => !c.isActive);

  function dueDayWarning(day?: number): 'overdue' | 'soon' | 'ok' | null {
    if (!day) return null;
    const diff = day - today;
    if (diff < 0) return 'overdue';
    if (diff <= 3) return 'soon';
    return 'ok';
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = activeCards.findIndex(c => c.id === active.id);
      const newIdx = activeCards.findIndex(c => c.id === over.id);
      const reordered = arrayMove(activeCards, oldIdx, newIdx);
      reorderCards([...reordered, ...inactiveCards]);
    }
  }

  // Card detail data
  const selectedCard = selectedCardId ? cards.find(c => c.id === selectedCardId) : null;
  const selectedCardTxns = useMemo(() => {
    if (!selectedCardId) return [];
    return monthTxns.filter(t => t.cardId === selectedCardId);
  }, [selectedCardId, monthTxns]);

  const selectedCardTotal = selectedCardTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const selectedCardCategoryBreakdown = useMemo(() => {
    if (!selectedCardId) return [];
    const map: Record<string, number> = {};
    selectedCardTxns.filter(t => t.amount > 0).forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [selectedCardId, selectedCardTxns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text)]">{T.card_mgmt}</h2>
          <p className="text-xs text-[var(--color-muted)]">{T.drag_hint}</p>
        </div>
        <button
          onClick={() => setAddingCard(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-highlight)] text-white text-sm font-medium"
        >
          <Plus size={14} /> {T.new_card}
        </button>
      </div>

      <MonthPicker />

      {/* Sortable Cards */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeCards.map(c => c.id)} strategy={rectSortingStrategy}>
          <div className="grid gap-3 md:grid-cols-2">
            {activeCards.map(card => (
              <SortableCard
                key={card.id}
                card={card}
                spend={cardSpend[card.id] || 0}
                maxSpend={maxSpend}
                warning={dueDayWarning(card.payDueDay)}
                onEdit={() => setEditingCard(card)}
                onToggle={() => useStore.getState().toggleCardActive(card.id)}
                onSelect={() => setSelectedCardId(card.id)}
                lang={lang}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Card Spend Comparison */}
      {Object.keys(cardSpend).length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.card_monthly}</h3>
          <div className="space-y-2">
            {cards.filter(c => cardSpend[c.id]).sort((a, b) => (cardSpend[b.id] || 0) - (cardSpend[a.id] || 0)).map(card => (
              <button key={card.id} onClick={() => setSelectedCardId(card.id)}
                className="w-full flex items-center gap-3 hover:bg-white/5 rounded-lg px-1 py-0.5 transition-colors">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: card.color }} />
                <span className="text-xs text-[var(--color-muted)] w-32 truncate text-left">{card.name}</span>
                <div className="flex-1 h-2 bg-white/10 rounded-full">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${((cardSpend[card.id] || 0) / maxSpend) * 100}%`, backgroundColor: card.color }} />
                </div>
                <span className="text-xs font-mono text-[var(--color-text)] w-20 text-right">
                  {formatCurrency(cardSpend[card.id] || 0)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payment Due */}
      <div className="bg-[var(--color-surface)] rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">
          {format(new Date(currentYear, currentMonth - 1), lang === 'ko' ? 'M월' : 'MMM')} {T.payment_due_title}
        </h3>
        <div className="space-y-1.5">
          {activeCards.filter(c => c.payDueDay && c.type === 'credit').sort((a, b) => (a.payDueDay || 0) - (b.payDueDay || 0)).map(card => {
            const warning = dueDayWarning(card.payDueDay);
            return (
              <div key={card.id} className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: card.color }} />
                <span className="text-sm text-[var(--color-text)] flex-1">{card.name}</span>
                <span className={`text-sm font-mono font-bold ${
                  warning === 'soon' ? 'text-[var(--color-warning)]' :
                  warning === 'overdue' ? 'text-[var(--color-muted)]' : 'text-[var(--color-text)]'
                }`}>
                  {T.due_day_label(card.payDueDay!)}
                  {warning === 'soon' && <span className="ml-1 text-xs">⚠️ {T.due_soon_label}</span>}
                  {warning === 'overdue' && <span className="ml-1 text-xs">✓ {T.due_overdue_label}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inactive Cards */}
      {inactiveCards.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-[var(--color-muted)] mb-3">{T.inactive_cards}</h3>
          <div className="space-y-2">
            {inactiveCards.map(card => (
              <div key={card.id} className="flex items-center gap-3 opacity-50">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: card.color }} />
                <span className="text-sm text-[var(--color-muted)] flex-1">{card.name}</span>
                <span className="text-xs bg-white/10 text-[var(--color-muted)] px-2 py-0.5 rounded-full">{T.inactive}</span>
                <button onClick={() => useStore.getState().toggleCardActive(card.id)} className="text-xs text-[var(--color-info)] hover:underline">
                  {T.activate}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setSelectedCardId(null)}>
          <div className="w-full max-w-md max-h-[85vh] flex flex-col bg-[var(--color-surface)] rounded-2xl"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedCard.color }} />
                <div>
                  <h3 className="font-semibold text-[var(--color-text)] text-sm">{selectedCard.name}</h3>
                  <p className="text-xs text-[var(--color-muted)]">{selectedCard.bank} · {selectedCard.owner}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCardId(null)} className="text-[var(--color-muted)] text-sm px-2 py-1 rounded hover:bg-white/10">✕</button>
            </div>

            {/* Summary */}
            <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--color-muted)]">
                  {lang === 'ko' ? `${currentYear}년 ${currentMonth}월 총 사용` : `${T.months_ko[currentMonth - 1]} ${currentYear} Total`}
                </span>
                <span className="text-base font-mono font-bold text-[var(--color-highlight)]">{formatCurrency(selectedCardTotal)}</span>
              </div>
              {selectedCardCategoryBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedCardCategoryBreakdown.slice(0, 5).map(([cat, amt]) => (
                    <div key={cat} className="flex items-center gap-1 bg-white/5 rounded-full px-2 py-0.5">
                      <span className="text-xs">{getCategoryIcon(cat as any)}</span>
                      <span className="text-xs text-[var(--color-muted)]">{tCat(lang, cat)}</span>
                      <span className="text-xs font-mono text-[var(--color-text)]">{formatCurrency(amt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transaction list */}
            <div className="overflow-y-auto flex-1 p-3">
              {selectedCardTxns.length > 0 ? (
                <TransactionList
                  transactions={selectedCardTxns}
                  showDate
                  onEdit={t => { setSelectedCardId(null); setEditingT(t); }}
                  onDelete={id => useStore.getState().deleteTransaction(id)}
                />
              ) : (
                <p className="text-center text-sm text-[var(--color-muted)] py-8">
                  {lang === 'ko' ? '이번 달 거래 없음' : 'No transactions this month'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {(addingCard || editingCard) && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardForm initialCard={editingCard || undefined} onClose={() => { setAddingCard(false); setEditingCard(null); }} />
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
