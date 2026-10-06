import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiError } from '../src/lib/api.js';

test('preserves MySQL decimal money and Java Long IDs in API responses', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response('{"id":9223372036854775807,"balance":99999999999999999.99,"currency":"KES"}', { status: 200 }));
  const wallet = await api.walletForUser('1');
  assert.equal(wallet.id, '9223372036854775807');
  assert.equal(wallet.balance, '99999999999999999.99');
});

test('sends exact numeric JSON to the transfer controller', async (context) => {
  let captured;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    captured = { url, options };
    return new Response('{"id":1}', { status: 201 });
  });
  await api.transfer('9223372036854775807', '2', '99999999999999999.99');
  assert.equal(captured.url, '/api/transfers');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['Content-Type'], 'application/json');
  assert.equal(captured.options.body, '{"senderWalletId":9223372036854775807,"receiverWalletId":2,"amount":99999999999999999.99}');
});

test('rejects invalid IDs and amounts before making a request', async (context) => {
  const spy = context.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  assert.throws(() => api.topUp('1', '0.001'));
  assert.throws(() => api.createWallet('1,"extra":true'));
  assert.throws(() => api.createWallet('9223372036854775808'));
  assert.equal(spy.mock.callCount(), 0);
});

test('shows a backend conflict message and does not retry the POST', async (context) => {
  const spy = context.mock.method(globalThis, 'fetch', async () => new Response('{"message":"Insufficient wallet balance."}', { status: 409 }));
  await assert.rejects(api.transfer('1', '2', '1500'), (error) => error instanceof ApiError && error.status === 409 && error.message === 'Insufficient wallet balance.' && error.uncertain === false);
  assert.equal(spy.mock.callCount(), 1);
});

test('network failure during a write reports an unknown outcome without retrying', async (context) => {
  const spy = context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(api.topUp('1', '1000'), (error) => error instanceof ApiError && error.uncertain === true && error.message.includes('Check the balance and history'));
  assert.equal(spy.mock.callCount(), 1);
});

test('a server error after submission asks the user to check the result first', async (context) => {
  const spy = context.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 500 }));
  await assert.rejects(api.transfer('1', '2', '250'), (error) => error.status === 500 && error.uncertain === true && error.message.includes('Check the balance and history'));
  assert.equal(spy.mock.callCount(), 1);
});
