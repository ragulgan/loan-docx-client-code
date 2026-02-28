
import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';

interface PendingTrans {
  transaction_id: number;
  customer_id: number;
  loan_name: string;
  agent_id: number;
  team_user_id: number;
  allocation_date: string;
}

const FetchPendingtranslist: React.FC = () => {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState('LU');
  const [records, setRecords] = useState<PendingTrans[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [selectedRole]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/admin/pending-trans-report?role=${selectedRole}`);
      const data = await res.json();
      setRecords(data || []);
    } catch (err) {
      console.error("Failed to fetch pending transactions", err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = () => {
    if (selectedRole === 'LU') return 'Legal User ID';
    if (selectedRole === 'CU') return 'Civil User ID';
    if (selectedRole === 'LH') return 'Legal Head ID';
    return 'User ID';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">Pending Transactions</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-black text-slate-500 uppercase tracking-widest">User type:</label>
            <select 
              className="bg-white border border-slate-200 rounded-xl px-6 py-3 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="LU">Legal User</option>
              <option value="CU">Civil User</option>
              <option value="LH">Legal Head</option>
            </select>
          </div>
          <button 
            onClick={fetchRecords} 
            className="bg-slate-900 text-white p-3 rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-95"
          >
            <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Transaction ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Customer ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Loan Name</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Agent ID</th>
                <th className="px-8 py-5 text-[10px] font-black text-indigo-500 uppercase tracking-[0.15em]">{getRoleLabel()}</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Job Allocation Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <i className="fa-solid fa-circle-notch fa-spin text-4xl text-indigo-500"></i>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying Workflow Ledger...</p>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 text-2xl">
                        <i className="fa-solid fa-check-double"></i>
                      </div>
                      <p className="text-slate-400 italic text-sm font-medium">No pending transactions found for this team.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map(rec => (
                  <tr key={rec.transaction_id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <span className="font-mono text-sm font-black text-slate-900 bg-indigo-50 px-2 py-1 rounded">#{rec.transaction_id}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-slate-500 tracking-wider">CID-{rec.customer_id}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-black text-slate-800 uppercase">{rec.loan_name}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs font-bold text-slate-500">AID-{rec.agent_id}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-user-clock text-indigo-400 text-[10px]"></i>
                        <span className="text-sm font-bold text-indigo-600">ID-{rec.team_user_id}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-lg">
                        {rec.allocation_date ? new Date(rec.allocation_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FetchPendingtranslist;
