import React, { useState, useEffect } from 'react';

const API = '';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [code, setCode] = useState('');
  const [balance, setBalance] = useState(1000);
  const [batchPrefix, setBatchPrefix] = useState('P');
  const [batchCount, setBatchCount] = useState(10);
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API}/api/admin/users`);
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    const iv = setInterval(fetchUsers, 3000);
    return () => clearInterval(iv);
  }, []);

  const createSingle = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setCreating(true);
    await fetch(`${API}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode: code.trim().toUpperCase(), balance: Number(balance) }),
    });
    setCode('');
    await fetchUsers();
    setCreating(false);
  };

  const createBatch = async (e) => {
    e.preventDefault();
    setCreating(true);
    for (let i = 1; i <= Number(batchCount); i++) {
      const ac = `${batchPrefix.toUpperCase()}${String(i).padStart(2, '0')}`;
      await fetch(`${API}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessCode: ac, balance: Number(balance) }),
      }).catch(() => {});
    }
    await fetchUsers();
    setCreating(false);
  };

  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);

  return (
    <div className="animate-slideUp" style={{ marginTop: '1rem' }}>
      <h2 className="mb-4">Admin Dashboard</h2>

      <div className="admin-grid">
        {/* Left – Creation Panels */}
        <div className="flex-col gap-4">
          <div className="card">
            <h3 className="mb-2">Create Single User</h3>
            <form onSubmit={createSingle}>
              <div>
                <label className="bet-label">Access Code</label>
                <input type="text" placeholder="e.g. A7B2" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div>
                <label className="bet-label">Starting Balance ($)</label>
                <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
              </div>
              <button type="submit" className="w-full" disabled={creating || !code.trim()}>
                Create User
              </button>
            </form>
          </div>

          <div className="card">
            <h3 className="mb-2">Batch Generate</h3>
            <form onSubmit={createBatch}>
              <div>
                <label className="bet-label">Code Prefix</label>
                <input type="text" placeholder="P" value={batchPrefix} onChange={(e) => setBatchPrefix(e.target.value)} />
              </div>
              <div>
                <label className="bet-label">Number of Users</label>
                <input type="number" value={batchCount} onChange={(e) => setBatchCount(e.target.value)} min="1" max="100" />
              </div>
              <div>
                <label className="bet-label">Starting Balance ($)</label>
                <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
              </div>
              <button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Creating...' : `Generate ${batchCount} Users`}
              </button>
              <p className="text-xs text-muted mt-1">
                Codes will be {batchPrefix.toUpperCase()}01, {batchPrefix.toUpperCase()}02, ...{batchPrefix.toUpperCase()}{String(batchCount).padStart(2, '0')}
              </p>
            </form>
          </div>
        </div>

        {/* Right – Leaderboard */}
        <div className="card">
          <div className="flex justify-between items-center mb-2">
            <h3>Leaderboard</h3>
            <span className="text-xs text-muted">{users.length} users • Total: <span className="text-gold">${totalBalance.toFixed(2)}</span></span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Code</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id}>
                  <td className="text-muted">{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{u.accessCode}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={u.balance >= 1000 ? 'text-green' : u.balance > 0 ? 'text-gold' : 'text-accent'}>
                      ${u.balance.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={3} className="text-center text-muted" style={{ padding: '2rem' }}>No users yet. Create some above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
