
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

const Earnings: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Endpoint now expects user_id and user_type for dynamic table lookup
      const res = await fetch(`http://localhost:3000/api/earnings/balance/${user.user_id}/${user.user_type}`);
      const data = await res.json();
      
      if (data.error) {
        alert("Error: " + data.error);
      } else {
        setBalance(data.balance?.toString() || '0');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("Error fetching balance: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 animate-in fade-in duration-500">
      <div className="bg-white p-10 rounded-2xl border shadow-xl space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fa-solid fa-wallet text-2xl"></i>
          </div>
          <h2 className="text-xl font-bold">My Current Balance</h2>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Current Ledger Balance</label>
          <input readOnly className="w-full p-4 bg-slate-50 border rounded-2xl font-mono text-xl font-bold text-slate-800" placeholder="0.00" value={balance ? `₹ ${balance}` : ''} />
        </div>

        <button onClick={check} disabled={loading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-lg shadow-slate-200 active:scale-[0.98]">
          {loading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : null}
          {loading ? 'Checking Ledger...' : 'Check My Balance'}
        </button>
      </div>
    </div>
  );
};

export default Earnings;
