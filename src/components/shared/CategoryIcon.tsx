import type { Category } from '../../types';
import { getCategoryIcon } from '../../utils';

interface Props {
  category: Category;
  size?: 'sm' | 'md' | 'lg';
}

export function CategoryIcon({ category, size = 'md' }: Props) {
  const sizeClass = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }[size];
  return <span className={sizeClass} title={category}>{getCategoryIcon(category)}</span>;
}
