import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './lib/api.js';
import { amountToCents, formatCents, formatMoney } from './lib/money.js';
import Icon from './components/Icon.jsx';
import Dialog from './components/Dialog.jsx';
import { ProfileForm, TopUpForm, SendMoneyForm } from './components/Forms.jsx';
import History, { formatDate } from './components/History.jsx';

const views = [
  { id: 'wallet', label: 'Wallet', icon: 'wallet' },
  { id: 'activity', label: 'Activity', icon: 'history' },
  { id: 'profiles', label: 'Profiles', icon: 'users' },
];

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'MP';
}

function Receipt({ transfer }) {
  return <div className="receipt">
    <span className="receipt-check"><Icon name="check" size={28} /></span>
    <p className="eyebrow">TRANSFER RECORDED</p><strong className="receipt-amount">{formatMoney(transfer.amount, transfer.currency)}</strong>
    <dl><div><dt>Transfer ID</dt><dd>#{transfer.id}</dd></div><div><dt>From wallet</dt><dd>#{transfer.senderWalletId}</dd></div><div><dt>To wallet</dt><dd>#{transfer.receiverWalletId}</dd></div><div><dt>Recorded</dt><dd>{formatDate(transfer.createdAt)}</dd></div><div><dt>Reference</dt><dd className="reference">{transfer.reference}</dd></div></dl>
  </div>;
}

export default function App() {
  const [view, setView] = useState('wallet');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [connected, setConnected] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [wallet, setWallet] = useState({ status: 'idle', data: null, userId: '' });
  const [history, setHistory] = useState({ loading: false, items: [], error: '' });
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [busy, setBusy] = useState('');
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const lock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setUsersLoading(true);
    api.users(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(result)) throw new Error('Expected the users API to return a list.');
      setUsers(result);
      setSelectedUserId((previous) => result.some((user) => String(user.id) === previous) ? previous : String(result[0]?.id || ''));
      setConnected(true); setConnectionError('');
    }).catch((error) => {
      if (!controller.signal.aborted) { setConnected(false); setConnectionError(error.message); }
    }).finally(() => { if (!controller.signal.aborted) setUsersLoading(false); });
    return () => controller.abort();
  }, [refreshTick]);

  useEffect(() => {
    const controller = new AbortController();
    if (!selectedUserId) {
      setWallet({ status: 'idle', data: null, userId: '' });
      setHistory({ loading: false, items: [], error: '' });
      return () => controller.abort();
    }
    setWallet((previous) => ({ status: 'loading', data: previous.userId === selectedUserId ? previous.data : null, userId: selectedUserId }));
    setHistory({ loading: true, items: [], error: '' });
    async function load() {
      let result;
      try {
        result = await api.walletForUser(selectedUserId, controller.signal);
        if (controller.signal.aborted) return;
        setWallet({ status: 'ready', data: result, userId: selectedUserId });
        setLastUpdated(new Date());
      } catch (error) {
        if (controller.signal.aborted) return;
        setWallet({ status: error instanceof ApiError && error.status === 404 ? 'missing' : 'error', data: null, userId: selectedUserId, error: error.message });
        setHistory({ loading: false, items: [], error: '' });
        return;
      }
      try {
        const items = await api.history(result.id, controller.signal);
        if (controller.signal.aborted) return;
        if (!Array.isArray(items)) throw new Error('Expected transfer history to return a list.');
        setHistory({ loading: false, items, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setHistory({ loading: false, items: [], error: error.message });
      }
    }
    load();
    return () => controller.abort();
  }, [selectedUserId, refreshTick]);

  const selectedUser = users.find((user) => String(user.id) === selectedUserId);
  const activeWallet = wallet.userId === selectedUserId ? wallet.data : null;
  const blocked = Boolean(busy) || wallet.status !== 'ready' || !connected;
  let received = 0n, sent = 0n;
  for (const transfer of history.items) {
    try {
      if (String(transfer.senderWalletId) === String(activeWallet?.id)) sent += amountToCents(transfer.amount);
      else received += amountToCents(transfer.amount);
    } catch { /* Invalid money values are displayed as unavailable. */ }
  }

  async function locked(name, task) {
    if (lock.current) throw new Error('Please wait for the current request to finish.');
    lock.current = true; setBusy(name);
    try { return await task(); }
    catch (error) {
      // Only refresh GETs after an ambiguous POST; never retry a write.
      if (error.uncertain) markForRefresh();
      throw error;
    } finally { lock.current = false; setBusy(''); }
  }

  function markForRefresh() {
    setWallet((previous) => ({ ...previous, status: 'loading' }));
    setRefreshTick((previous) => previous + 1);
  }
  function refresh() { setNotice(null); markForRefresh(); }

  async function createUser(fullName, email) {
    return locked('profile', async () => {
      const user = await api.createUser(fullName, email);
      setUsers((previous) => [...previous.filter((item) => String(item.id) !== String(user.id)), user]);
      setSelectedUserId(String(user.id)); setView('wallet'); setDialog(null);
      setNotice({ kind: 'success', text: 'Profile created. You can now create its wallet.' });
      setRefreshTick((previous) => previous + 1);
    });
  }

  async function createWallet() {
    try {
      await locked('wallet', async () => {
        const result = await api.createWallet(selectedUserId);
        setWallet({ status: 'loading', data: result, userId: selectedUserId });
        setNotice({ kind: 'success', text: 'Wallet created. Add demo funds to get started.' });
        setRefreshTick((previous) => previous + 1);
      });
    } catch (error) { setNotice({ kind: 'error', text: error.message }); }
  }

  async function topUp(walletId, amount) {
    return locked('topup', async () => {
      const result = await api.topUp(walletId, amount);
      setWallet({ status: 'loading', data: result, userId: selectedUserId });
      setDialog(null); setNotice({ kind: 'success', text: `${formatMoney(amount)} in demo funds added.` });
      setRefreshTick((previous) => previous + 1);
    });
  }

  async function reviewRecipient(userId) {
    return locked('review', async () => {
      try { return await api.walletForUser(userId); }
      catch (error) {
        if (error.status === 404) throw new Error('This profile needs a wallet. Open its profile and create one first.');
        throw error;
      }
    });
  }

  async function sendTransfer(senderId, receiverId, amount) {
    return locked('transfer', async () => {
      const transfer = await api.transfer(senderId, receiverId, amount);
      setNotice({ kind: 'success', text: 'Transfer sent. Your receipt is ready.' });
      setDialog({ type: 'receipt', transfer }); markForRefresh();
    });
  }

  async function openReceipt(transferId) {
    try {
      const transfer = await locked('receipt', () => api.receipt(transferId));
      setDialog({ type: 'receipt', transfer });
    } catch (error) { setNotice({ kind: 'error', text: error.message }); }
  }

  function openProfile(user) { setSelectedUserId(String(user.id)); setView('wallet'); setNotice(null); }
  const newProfile = () => setDialog({ type: 'profile' });
  const closeDialog = () => { if (!busy) setDialog(null); };
  const historyProps = { transfers: history.items, walletId: activeWallet?.id, loading: history.loading, error: history.error, busy: Boolean(busy), onReceipt: openReceipt };

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); if (!busy) setView('wallet'); }} aria-label="MiniPay wallet"><span className="brand-mark">m</span><span>MiniPay<span className="brand-caption">A LITTLE MORE POSSIBLE</span></span></a>
      <div className="nav-caption">WORKSPACE</div>
      <nav aria-label="Main navigation">{views.map((item) => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => setView(item.id)} disabled={Boolean(busy)} aria-current={view === item.id ? 'page' : undefined}><Icon name={item.icon} /><span>{item.label}</span>{view === item.id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><span className="demo-tag">PORTFOLIO DEMO</span><p>A small wallet.<br />A real learning journey.</p><a href="https://github.com/devSheddy-android/minipay" target="_blank" rel="noreferrer">View source<Icon name="external" size={15} /></a><span className="sidebar-credit">Built by Shedrack Kisoi</span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb">Workspace<span>/</span><strong>{views.find((item) => item.id === view).label}</strong></div><div className="topbar-right"><span className={`connection ${connected ? 'online' : usersLoading ? 'connecting' : 'offline'}`} role="status"><span className="status-dot" />{connected ? 'API connected' : usersLoading ? 'Connecting…' : 'API unavailable'}</span><span className="avatar small-avatar" aria-label={selectedUser?.fullName || 'MiniPay'}>{initials(selectedUser?.fullName)}</span></div></header>
      <main className="main">
        <div className="page-heading"><div><p className="eyebrow">{view === 'wallet' ? 'MAKE YOUR NEXT MOVE' : view === 'activity' ? 'FOLLOW THE MONEY' : 'YOUR DEMO WORKSPACE'}</p><h1>{view === 'wallet' ? selectedUser ? `Hello, ${selectedUser.fullName?.split(' ')[0] || 'there'}.` : 'Welcome to MiniPay.' : view === 'activity' ? 'Every transfer, in view.' : 'Meet your profiles.'}</h1><p className="muted">{view === 'wallet' ? 'Fund your wallet, send money, and keep track of it all.' : view === 'activity' ? 'See what came in, what went out, and the receipt behind it.' : 'Create and switch profiles to try the full wallet experience.'}</p></div><button className="button secondary refresh-button" onClick={refresh} disabled={Boolean(busy) || usersLoading || wallet.status === 'loading'}><Icon name="refresh" size={17} />Refresh</button></div>
        {connectionError && <div className="notice error" role="alert"><div><strong>Let’s reconnect.</strong><p>{connectionError}</p></div><button className="text-button" onClick={refresh} disabled={Boolean(busy) || usersLoading}>Retry connection</button></div>}
        {notice && <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}><span>{notice.text}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice(null)}><Icon name="close" size={17} /></button></div>}

        {view === 'profiles' ? <>
          <div className="section-toolbar"><p className="muted">{users.length} {users.length === 1 ? 'profile' : 'profiles'} in your workspace</p><button className="button primary" onClick={newProfile} disabled={Boolean(busy)}><Icon name="plus" size={17} />New profile</button></div>
          <div className="profile-grid">{users.map((user) => <article className={`card profile-tile ${String(user.id) === selectedUserId ? 'is-selected' : ''}`} key={user.id}><span className="avatar">{initials(user.fullName)}</span><h2>{user.fullName}</h2><p className="muted profile-email">{user.email}</p><span className="profile-id">Profile #{user.id}</span><button className="button secondary full" onClick={() => openProfile(user)} disabled={Boolean(busy)}>Open wallet<Icon name="right" size={17} /></button></article>)}{users.length === 0 && <div className="card empty-state"><Icon name="users" size={30} /><h2>{usersLoading ? 'Loading profiles…' : 'Your first profile starts here'}</h2><p className="muted">Create two profiles to test both sides of a transfer.</p><button className="button primary" onClick={newProfile} disabled={Boolean(busy)}>Create profile</button></div>}</div>
        </> : <>
          <section className="profile-switcher" aria-label="Selected demo profile"><div><span className="avatar">{initials(selectedUser?.fullName)}</span><div><label htmlFor="active-profile">DEMO PROFILE</label><select id="active-profile" value={selectedUserId} onChange={(event) => { setSelectedUserId(event.target.value); setNotice(null); }} disabled={Boolean(busy) || users.length === 0 || usersLoading}>{users.length === 0 && <option value="">No profiles yet</option>}{users.map((user) => <option value={user.id} key={user.id}>{user.fullName} · {user.email}</option>)}</select></div></div><button className="button secondary" onClick={newProfile} disabled={Boolean(busy)}><Icon name="plus" size={17} />New profile</button></section>
          {activeWallet ? <>
            {view === 'wallet' ? <>
              <div className="dashboard-grid"><div className="wallet-column">
                <section className="wallet-card" aria-label="Wallet balance"><div className="wallet-orbits" aria-hidden="true" /><div className="wallet-card-top"><span className="wallet-wordmark"><Icon name="wallet" size={21} />MiniPay wallet</span><span className="currency-tag">{activeWallet.currency}</span></div><p className="balance-label">AVAILABLE BALANCE</p><p className="balance-amount" aria-live="polite">{formatMoney(activeWallet.balance, activeWallet.currency)}</p><div className="wallet-card-bottom"><div><span className="wallet-owner">{selectedUser?.fullName}</span><span className="wallet-number">Wallet #{activeWallet.id}{wallet.status === 'loading' ? ' · Updating…' : ''}</span></div><button className="button mint" onClick={() => setDialog({ type: 'topup' })} disabled={blocked}><Icon name="plus" size={17} />Add demo funds</button></div></section>
                <div className="stats-row"><div className="card stat-card"><span className="stat-icon received"><Icon name="down" /></span><div><p>Total received</p><strong>{history.loading || history.error ? '—' : formatCents(received)}</strong></div></div><div className="card stat-card"><span className="stat-icon sent"><Icon name="up" /></span><div><p>Total sent</p><strong>{history.loading || history.error ? '—' : formatCents(sent)}</strong></div></div></div>
                <div className="demo-note"><span className="demo-note-icon"><Icon name="wallet" size={18} /></span><p><strong>A space to try things.</strong> MiniPay uses simulated KES funds. Create another profile and explore sending money.</p></div>
              </div><section className="card send-card"><div className="card-heading"><div><h2>Send money</h2><p className="muted">From this wallet to another</p></div><span className="send-icon"><Icon name="send" size={22} /></span></div><SendMoneyForm key={activeWallet.id} wallet={activeWallet} users={users} selectedUserId={selectedUserId} disabled={blocked} busy={Boolean(busy)} onReview={reviewRecipient} onSend={sendTransfer} /></section></div>
              <History {...historyProps} compact onViewAll={() => setView('activity')} />
            </> : <History key={activeWallet.id} {...historyProps} />}
          </> : <section className="card onboarding empty-state">
            <span className="empty-icon large"><Icon name="wallet" size={34} /></span>
            {usersLoading || wallet.status === 'loading' ? <><h2>Getting your workspace ready…</h2><p className="muted" role="status">Loading your profile and wallet.</p></>
              : !selectedUser ? <><h2>Your next move starts here.</h2><p className="muted">Create a profile, open a wallet, and add some demo funds.</p><button className="button primary" onClick={newProfile} disabled={Boolean(busy)}><Icon name="plus" size={18} />Create your first profile</button></>
              : wallet.status === 'missing' ? <><h2>{selectedUser.fullName}, let’s open your wallet.</h2><p className="muted">One profile. One KES wallet. Ready for your first transfer.</p><button className="button primary" onClick={createWallet} disabled={Boolean(busy) || !connected}>{busy ? 'Creating wallet…' : 'Create wallet'}<Icon name="right" size={18} /></button></>
              : <><h2>We couldn’t load this wallet.</h2><p className="form-error" role="alert">{wallet.error || 'Refresh to check the connection.'}</p><button className="button secondary" onClick={refresh} disabled={Boolean(busy)}>Try again</button></>}
          </section>}
        </>}
        <footer className="page-footer"><span>MiniPay · Simulated wallet demo</span><span>{lastUpdated ? `Balance refreshed ${lastUpdated.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}` : 'React + Spring Boot + MySQL'}</span></footer>
      </main>
    </div>
    {dialog?.type === 'profile' && <Dialog title="Create a profile" description="Start a new demo profile. You can create its wallet next." busy={Boolean(busy)} onClose={closeDialog}><ProfileForm busy={Boolean(busy)} onCreate={createUser} /></Dialog>}
    {dialog?.type === 'topup' && activeWallet && <Dialog title="Add demo funds" description={`Fund wallet #${activeWallet.id} to try sending money.`} busy={Boolean(busy)} onClose={closeDialog}><TopUpForm wallet={activeWallet} busy={Boolean(busy)} onTopUp={topUp} /></Dialog>}
    {dialog?.type === 'receipt' && <Dialog title="Transfer receipt" onClose={closeDialog} busy={Boolean(busy)}><Receipt transfer={dialog.transfer} /><button className="button primary full" onClick={closeDialog} disabled={Boolean(busy)}>Done<Icon name="check" size={18} /></button></Dialog>}
  </div>;
}
