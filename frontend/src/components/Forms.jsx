import { useState } from 'react';
import { normalizeAmount, formatMoney } from '../lib/money.js';
import Icon from './Icon.jsx';

export function ProfileForm({ busy, onCreate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!name.trim()) { setError('Enter your full name.'); return; }
    try { await onCreate(name, email); }
    catch (failure) { setError(failure.message); }
  }
  return <form className="form" onSubmit={submit}>
    <label htmlFor="profile-name">Full name</label>
    <input id="profile-name" autoComplete="name" placeholder="e.g. Shedrack Kisoi" value={name} onChange={(event) => { setName(event.target.value); setError(''); }} maxLength={100} required disabled={busy} />
    <label htmlFor="profile-email">Email address</label>
    <input id="profile-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} maxLength={255} required disabled={busy} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary full" type="submit" disabled={busy}>{busy ? 'Creating profile…' : 'Create profile'}<Icon name="right" size={18} /></button>
  </form>;
}

export function TopUpForm({ wallet, busy, onTopUp }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    try { await onTopUp(wallet.id, normalizeAmount(amount)); }
    catch (failure) { setError(failure.message); }
  }
  return <form className="form" onSubmit={submit}>
    <div className="small-summary"><span>Current balance</span><strong>{formatMoney(wallet.balance, wallet.currency)}</strong></div>
    <label htmlFor="topup-amount">Amount to add (KES)</label>
    <input id="topup-amount" inputMode="decimal" placeholder="1000.00" value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} maxLength={24} required disabled={busy} />
    <div className="amount-presets" aria-label="Suggested amounts">{['500', '1000', '2500'].map((value) => <button className="chip" type="button" key={value} onClick={() => { setAmount(value); setError(''); }} disabled={busy}>+ {value}</button>)}</div>
    <p className="field-help">Simulated funds for testing MiniPay. No payment is collected.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary full" type="submit" disabled={busy}>{busy ? 'Adding funds…' : 'Add demo funds'}<Icon name="plus" size={18} /></button>
  </form>;
}

export function SendMoneyForm({ wallet, users, selectedUserId, disabled, busy, onReview, onSend }) {
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const recipients = users.filter((user) => String(user.id) !== selectedUserId);
  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      if (review) {
        await onSend(wallet.id, review.wallet.id, review.amount);
        setReview(null); setAmount(''); setRecipientId('');
        return;
      }
      const validAmount = normalizeAmount(amount);
      const recipient = users.find((user) => String(user.id) === recipientId);
      if (!recipient) throw new Error('Choose a recipient profile.');
      const recipientWallet = await onReview(recipientId);
      if (String(recipientWallet.id) === String(wallet.id)) throw new Error('Choose a different wallet.');
      setReview({ user: recipient, wallet: recipientWallet, amount: validAmount });
    } catch (failure) { setError(failure.message); }
  }
  function edit() { setReview(null); setError(''); }
  return <form className="form send-form" onSubmit={submit}>
    <label htmlFor="recipient">Recipient profile</label>
    <select id="recipient" value={recipientId} onChange={(event) => { setRecipientId(event.target.value); edit(); }} disabled={disabled || busy} required>
      <option value="">Choose a recipient</option>
      {recipients.map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.email}</option>)}
    </select>
    <label htmlFor="send-amount">Amount (KES)</label>
    <input id="send-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value); edit(); }} required maxLength={24} disabled={disabled || busy} />
    <p className="field-help">Use up to two decimal places. The recipient needs a wallet.</p>
    {recipients.length === 0 && <p className="field-help">Create a second profile to try a transfer.</p>}
    {review && <div className="transfer-review" aria-live="polite"><span className="eyebrow">REVIEW TRANSFER</span><strong>{formatMoney(review.amount, wallet.currency)}</strong><p>To {review.user.fullName} · Wallet #{review.wallet.id}</p><button type="button" className="text-button" onClick={edit} disabled={busy}>Edit details</button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary full" type="submit" disabled={disabled || busy || recipients.length === 0}>{busy ? 'Please wait…' : review ? 'Confirm transfer' : 'Review transfer'}<Icon name={review ? 'check' : 'right'} size={18} /></button>
  </form>;
}
