export function readCssVar(name: string, fallback = ''): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fallback;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value.trim() || fallback;
}

export function withAlpha(color: string, alpha: number): string {
  if (!color) {
    return `rgba(0,0,0,${alpha})`;
  }

  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    const normalized = trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;

    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    return `rgba(${red},${green},${blue},${alpha})`;
  }

  if (trimmed.startsWith('rgb')) {
    return trimmed.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  }

  return color;
}