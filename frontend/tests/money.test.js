import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAmount, amountToCents, formatCents, formatMoney } from '../src/lib/money.js';

test('normalizes whole amounts and cents without float arithmetic', () => {
  assert.equal(normalizeAmount(' 001000.5 '), '1000.50');
  assert.equal(normalizeAmount('0.01'), '0.01');
  assert.equal(amountToCents('0.10') + amountToCents('0.20'), 30n);
});

test('rejects invalid, zero, negative, and fractional-cent amounts', () => {
  for (const value of ['', '0', '0.00', '-1', '0.001', '1e3', 'NaN', '12,000', '1.2.3']) {
    assert.throws(() => normalizeAmount(value), Error, value);
  }
});

test('preserves the backend maximum exactly and rejects an amount above it', () => {
  assert.equal(normalizeAmount('99999999999999999.99'), '99999999999999999.99');
  assert.equal(amountToCents('99999999999999999.99'), 9999999999999999999n);
  assert.throws(() => normalizeAmount('100000000000000000.00'));
});

test('formats exact large values and unavailable data', () => {
  assert.equal(formatMoney('99999999999999999.99'), 'KES 99,999,999,999,999,999.99');
  assert.equal(formatCents(30n), 'KES 0.30');
  assert.equal(formatMoney('not-money'), '—');
});
