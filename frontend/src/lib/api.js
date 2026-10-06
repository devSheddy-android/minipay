import { parse, isLosslessNumber } from 'lossless-json';
import { normalizeAmount } from './money.js';

export class ApiError extends Error {
  constructor(message, status = 0, uncertain = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.uncertain = uncertain;
  }
}

function id(value) {
  const text = String(value);
  if (!/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) {
    throw new Error('A valid positive ID is required.');
  }
  return text;
}

async function request(path, { method = 'GET', body, signal } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 15000);
  const isWrite = method !== 'GET';
  const checkOutcome = path === '/users'
    ? 'Refresh profiles before trying again.'
    : path === '/wallets'
      ? 'Refresh this profile before trying again.'
      : 'Check the balance and history before trying again.';
  try {
    const response = await fetch(`/api${path}`, {
      method,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body } : {}),
    });
    const text = await response.text();
    let data;
    try {
      // Preserves DECIMAL(19,2) values and Java Long IDs without float rounding.
      data = text ? parse(text, (_key, value) => isLosslessNumber(value) ? value.toString() : value) : null;
    } catch {
      if (response.ok) throw new ApiError(`The API returned an unexpected response.${isWrite ? ` ${checkOutcome}` : ''}`, response.status, isWrite);
    }
    if (!response.ok) {
      const fallback = response.status >= 500
        ? 'The server could not complete the request.'
        : response.status === 400
          ? 'Please check your details and try again.'
          : `Request failed (${response.status}).`;
      const uncertain = isWrite && response.status >= 500;
      const message = data?.message || data?.detail || fallback;
      throw new ApiError(`${message}${uncertain ? ` ${checkOutcome}` : ''}`, response.status, uncertain);
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      isWrite
        ? `We could not confirm the request. ${checkOutcome}`
        : 'Cannot reach MiniPay. Start Spring Boot, then refresh.',
      0,
      isWrite,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

// Numeric fields are validated before insertion into JSON. This preserves exact
// decimal values while sending the numeric JSON shape used by our controllers.
export const api = {
  users: (signal) => request('/users', { signal }),
  createUser: (fullName, email) => request('/users', {
    method: 'POST', body: JSON.stringify({ fullName: fullName.trim(), email: email.trim() }),
  }),
  walletForUser: (userId, signal) => request(`/wallets/user/${id(userId)}`, { signal }),
  createWallet: (userId) => request('/wallets', {
    method: 'POST', body: `{"userId":${id(userId)}}`,
  }),
  topUp: (walletId, amount) => request(`/wallets/${id(walletId)}/topups`, {
    method: 'POST', body: `{"amount":${normalizeAmount(amount)}}`,
  }),
  transfer: (senderWalletId, receiverWalletId, amount) => request('/transfers', {
    method: 'POST',
    body: `{"senderWalletId":${id(senderWalletId)},"receiverWalletId":${id(receiverWalletId)},"amount":${normalizeAmount(amount)}}`,
  }),
  history: (walletId, signal) => request(`/transfers/wallet/${id(walletId)}`, { signal }),
  receipt: (transferId, signal) => request(`/transfers/${id(transferId)}`, { signal }),
};
