// Keep money as decimal text and integer cents. Do not use float arithmetic.
export function normalizeAmount(value) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('Enter a positive amount with up to two decimal places.');
  }
  const [rawWhole, fraction = ''] = text.split('.');
  const whole = rawWhole.replace(/^0+(?=\d)/, '');
  if (whole.length > 17) throw new Error('That amount exceeds the wallet limit.');
  const normalized = `${whole}.${fraction.padEnd(2, '0')}`;
  if (amountToCents(normalized) <= 0n) throw new Error('Amount must be greater than zero.');
  return normalized;
}

export function amountToCents(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Invalid money value.');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}

export function formatCents(cents, currency = 'KES') {
  const absolute = cents < 0n ? -cents : cents;
  const whole = (absolute / 100n).toLocaleString('en-KE');
  const fraction = String(absolute % 100n).padStart(2, '0');
  return `${cents < 0n ? '−' : ''}${currency} ${whole}.${fraction}`;
}

export function formatMoney(value, currency = 'KES') {
  try { return formatCents(amountToCents(value), currency); }
  catch { return '—'; }
}
