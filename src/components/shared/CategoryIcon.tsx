import type { Category } from '../../types';
import { getCategoryIcon } from '../../utils';

interface Props {
  category: Category;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { circle: 'w-7 h-7 rounded-lg',  emoji: 'text-xs' },
  md: { circle: 'w-9 h-9 rounded-xl',  emoji: 'text-sm' },
  lg: { circle: 'w-11 h-11 rounded-2xl', emoji: 'text-lg' },
};

export function CategoryIcon({ category, size = 'md' }: Props) {
  const { circle, emoji } = SIZE_MAP[size];
  return (
    <div
      className={`${circle} flex items-center justify-center flex-shrink-0`}
      style={{ background: 'rgba(255,255,255,0.07)' }}
      title={category}
    >
      <span className={emoji}>{getCategoryIcon(category)}</span>
    </div>
  );
}
