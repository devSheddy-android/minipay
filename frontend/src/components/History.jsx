import { useState } from 'react';
import { formatMoney } from '../lib/money.js';
import Icon from './Icon.jsx';

export function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' }).format(date);
}

export default function History({ transfers, walletId, loading, error, busy, onReceipt, compact = false, onViewAll }) {
  const [filter, setFilter] = useState('all');
  const filtered = transfers.filter((transfer) => filter === 'all' || (String(transfer.senderWalletId) === String(walletId) ? filter === 'sent' : filter === 'received'));
  const shown = compact ? filtered.slice(0, 4) : filtered;
  return <section className="card history-card" aria-label="Transfer history">
    <div className="card-heading"><div><h2>{compact ? 'Recent activity' : 'Transfer history'}</h2><p className="muted">Incoming and outgoing wallet transfers</p></div>{compact && <button className="text-button" onClick={onViewAll} disabled={busy}>View all<Icon name="right" size={16} /></button>}</div>
    {!compact && <div className="filter-row" aria-label="Filter transfers">{['all', 'sent', 'received'].map((value) => <button key={value} type="button" aria-pressed={filter === value} className={`chip ${filter === value ? 'selected' : ''}`} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>}
    {error ? <div className="empty-state"><p className="form-error" role="alert">{error}</p><p className="muted">Refresh to load the latest activity.</p></div>
      : loading ? <div className="empty-state muted" role="status">Loading activity…</div>
      : shown.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="history" size={25} /></span><h3>No {filter === 'all' ? '' : `${filter} `}transfers yet</h3><p className="muted">Your wallet transfers will appear here.</p></div>
      : <div className="table-scroll"><table><thead><tr><th scope="col">Transfer</th><th scope="col">Date</th><th scope="col" className="amount-cell">Amount</th><th scope="col"><span className="sr-only">Receipt</span></th></tr></thead><tbody>{shown.map((transfer) => {
        const sent = String(transfer.senderWalletId) === String(walletId);
        const otherWallet = sent ? transfer.receiverWalletId : transfer.senderWalletId;
        return <tr key={transfer.id}><td><div className="transfer-label"><span className={`direction-icon ${sent ? 'sent' : 'received'}`}><Icon name={sent ? 'up' : 'down'} size={18} /></span><div><strong>{sent ? 'Sent to' : 'Received from'} wallet #{otherWallet}</strong><span className="muted small">Transfer #{transfer.id}</span></div></div></td><td className="muted small">{formatDate(transfer.createdAt)}</td><td className={`amount-cell transfer-amount ${sent ? '' : 'positive'}`}>{sent ? '−' : '+'} {formatMoney(transfer.amount, transfer.currency)}</td><td><button type="button" className="icon-button" aria-label={`View receipt ${transfer.id}`} onClick={() => onReceipt(transfer.id)} disabled={busy}><Icon name="right" size={18} /></button></td></tr>;
      })}</tbody></table></div>}
    <p className="history-footnote">Demo top-ups change your balance; this list records wallet-to-wallet transfers.</p>
  </section>;
}
