import { useStore } from '../../store/useStore';

interface Props {
  cardId: string;
  size?: 'sm' | 'md';
  showName?: boolean;
}

export function CardBadge({ cardId, size = 'sm', showName = false }: Props) {
  const card = useStore(s => s.cards.find(c => c.id === cardId));
  if (!card) return null;

  const dotSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${dotSize} rounded-full flex-shrink-0 border border-white/20`}
        style={{ backgroundColor: card.color }}
      />
      {showName && (
        <span className="text-xs text-[var(--color-muted)] truncate max-w-[120px]">{card.name}</span>
      )}
    </span>
  );
}
