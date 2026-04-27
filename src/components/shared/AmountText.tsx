import { formatCurrency } from '../../utils';

interface Props {
  amount: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function AmountText({ amount, className = '', size = 'md' }: Props) {
  const isPositive = amount > 0; // expense
  const color = isPositive ? 'text-[var(--color-highlight)]' : 'text-[var(--color-success)]';
  const sizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-2xl font-bold',
  }[size];

  return (
    <span className={`font-mono ${color} ${sizeClass} ${className}`}>
      {isPositive ? '' : '+'}{formatCurrency(Math.abs(amount))}
    </span>
  );
}
