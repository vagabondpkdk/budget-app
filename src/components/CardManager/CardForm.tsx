import { useState } from 'react';
import { useStore } from '../../store/useStore';
import type { Card } from '../../types';
import { X } from 'lucide-react';

interface Props {
  initialCard?: Card;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#1C1C1E', '#D71E28', '#003B8E', '#0071CE', '#007A5E', '#00A36C',
  '#E31837', '#F4A824', '#FF6900', '#005DAA', '#117ACA', '#27AE60',
  '#8E44AD', '#E67E22', '#2980B9', '#C0392B',
];

export function CardForm({ initialCard, onClose }: Props) {
  const { addCard, updateCard, deleteCard } = useStore();
  const [name, setName] = useState(initialCard?.name || '');
  const [bank, setBank] = useState(initialCard?.bank || '');
  const [owner, setOwner] = useState<Card['owner']>(initialCard?.owner || 'Both');
  const [type, setType] = useState<Card['type']>(initialCard?.type || 'credit');
  const [color, setColor] = useState(initialCard?.color || '#1C1C1E');
  const [payDueDay, setPayDueDay] = useState(String(initialCard?.payDueDay || ''));
  const [lastFour, setLastFour] = useState(initialCard?.lastFourDigits || '');
  const [isActive, setIsActive] = useState(initialCard?.isActive ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      name, bank,
      owner,
      type,
      color,
      isActive,
      payDueDay: payDueDay ? parseInt(payDueDay) : undefined,
      lastFourDigits: lastFour || undefined,
    };

    if (initialCard) {
      updateCard(initialCard.id, data);
    } else {
      addCard(data);
    }
    onClose();
  }

  function handleDelete() {
    if (confirm(`"${initialCard?.name}" 카드를 삭제할까요?\n기존 거래 데이터는 유지됩니다.`)) {
      deleteCard(initialCard!.id);
      onClose();
    }
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <h3 className="font-semibold text-[var(--color-text)]">
          {initialCard ? '카드 수정' : '새 카드 추가'}
        </h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 text-[var(--color-muted)]">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Card Preview */}
        <div
          className="relative rounded-xl p-4 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${color}dd, ${color}88)` }}
        >
          <div className="absolute inset-0 opacity-5">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border-4 border-white" />
          </div>
          <p className="relative font-bold text-white text-base">{name || '카드 이름'}</p>
          <p className="relative text-white/60 text-xs">{bank || '은행'} · {owner}</p>
          {lastFour && <p className="relative text-white/50 text-xs mt-1">•••• {lastFour}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">카드 이름</label>
            <input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Apple Card"
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">은행</label>
            <input
              value={bank}
              onChange={e => setBank(e.target.value)}
              placeholder="Apple"
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]"
            />
          </div>
        </div>

        {/* Owner */}
        <div>
          <label className="text-xs text-[var(--color-muted)] mb-1 block">소유자</label>
          <div className="flex gap-2">
            {(['Kyle', 'Ella', 'Both'] as const).map(o => (
              <button key={o} type="button" onClick={() => setOwner(o)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  owner === o ? 'bg-[var(--color-accent)] text-white' : 'bg-white/10 text-[var(--color-muted)]'
                }`}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div>
          <label className="text-xs text-[var(--color-muted)] mb-1 block">카드 종류</label>
          <div className="flex gap-2">
            {(['credit', 'debit', 'saving', 'cash'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  type === t ? 'bg-[var(--color-accent)] text-white' : 'bg-white/10 text-[var(--color-muted)]'
                }`}>
                {t === 'credit' ? '신용' : t === 'debit' ? '체크' : t === 'saving' ? '저축' : '현금'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">결제일</label>
            <input
              type="number" min="1" max="31"
              value={payDueDay}
              onChange={e => setPayDueDay(e.target.value)}
              placeholder="예: 15"
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--color-muted)] mb-1 block">끝 4자리</label>
            <input
              type="text" maxLength={4}
              value={lastFour}
              onChange={e => setLastFour(e.target.value)}
              placeholder="1234"
              className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm font-mono text-[var(--color-text)] border border-white/10 focus:outline-none focus:border-[var(--color-info)]"
            />
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="text-xs text-[var(--color-muted)] mb-2 block">카드 색상</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
            />
            <span className="text-xs text-[var(--color-muted)] font-mono">{color}</span>
          </div>
        </div>

        {/* Active toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setIsActive(!isActive)}
            className={`relative w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-[var(--color-success)]' : 'bg-white/20'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`} />
          </div>
          <span className="text-sm text-[var(--color-text)]">활성 카드</span>
        </label>

        <div className="flex gap-2 pt-2">
          {initialCard && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--color-highlight)] bg-[var(--color-highlight)]/10 hover:bg-[var(--color-highlight)]/20"
            >
              삭제
            </button>
          )}
          <button
            type="submit"
            className="flex-1 py-2.5 rounded-xl font-semibold text-white bg-[var(--color-highlight)] hover:bg-red-500 active:scale-95 transition-all"
          >
            {initialCard ? '수정 저장' : '추가'}
          </button>
        </div>
      </form>
    </div>
  );
}
