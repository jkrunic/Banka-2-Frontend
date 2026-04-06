import { cn } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('handles conflicting Tailwind classes (last wins)', () => {
    // twMerge should resolve conflicting classes
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles conditional classes', () => {
    const shouldHide = false;
    expect(cn('base', shouldHide && 'hidden', 'extra')).toBe('base extra');
  });

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'extra')).toBe('base extra');
  });

  it('handles empty arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles arrays of classes', () => {
    expect(cn(['px-2', 'py-1'])).toBe('px-2 py-1');
  });

  it('deduplicates Tailwind classes', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles complex conditional patterns', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn(
      'base-class',
      isActive && 'bg-green-500',
      isDisabled && 'opacity-50',
    )).toBe('base-class bg-green-500');
  });
});
