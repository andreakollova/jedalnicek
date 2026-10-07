// Unit conversion table: convert everything to a base unit
const CONVERSIONS: Record<string, { base: string; factor: number }> = {
  kg: { base: 'g', factor: 1000 },
  g: { base: 'g', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  dl: { base: 'ml', factor: 100 },
};

export function normalizeUnit(quantity: number, unit: string): { quantity: number; unit: string } {
  const conv = CONVERSIONS[unit.toLowerCase()];
  if (conv) {
    return { quantity: quantity * conv.factor, unit: conv.base };
  }
  return { quantity, unit: unit.toLowerCase() };
}

export function toDisplayUnit(quantity: number, unit: string): { quantity: number; unit: string } {
  if (unit === 'g' && quantity >= 1000) {
    return { quantity: quantity / 1000, unit: 'kg' };
  }
  if (unit === 'ml' && quantity >= 1000) {
    return { quantity: quantity / 1000, unit: 'l' };
  }
  return { quantity, unit };
}
