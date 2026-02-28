import React, { useState } from 'react';

interface TrackingResult {
  transaction_id: number;
  transaction_state: string;
  legal_team_job_completion_date: string | null;
  civil_team_job_completion_date: string | null;
  legal_head_job_completion_date: string | null;
  customer_name: string;
  loan_name: string;
  error?: string;
}

const LoanTracking: React.FC = () => {
  const [searchType, setSearchType] = useState<'mobile' | 'txn'>('txn');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    if (searchType === 'mobile' && !/^\d{10}$/.test(query)) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`http://localhost:3000/api/loans/track/${query}?type=${searchType}`);
      const data = await res.json();
      
      if (data.error) {
        setErrorMsg(data.error);
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Network error";
      setErrorMsg(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = (type: 'mobile' | 'txn') => {
    setSearchType(type);
    setQuery(''); // Reset query input
    setResult(null); // Reset results
    setErrorMsg(null); // Reset errors
  };

  // Status Logic processing as per requirements
  const getWorkflowSummary = (data: TrackingResult) => {
    if (data.transaction_state === 'P') {
      return { main: "Still process not started.", type: 'pending' };
    }

    let v_lc = 0;
    let v_cc = 0;
    let messages: string[] = [];

    // Legal Logic
    if (data.legal_team_job_completion_date) {
      if (data.legal_head_job_completion_date) {
        v_lc = 1;
        messages.push("Legal Completed");
      } else {
        messages.push("Pending with Legal");
      }
    } else {
      messages.push("Pending with Legal");
    }

    // Civil Logic
    if (data.civil_team_job_completion_date) {
      v_cc = 1;
      messages.push("Civil Completed");
    } else {
      messages.push("Pending with Civil");
    }

    if (v_cc === 1 && v_lc === 1) {
      return { main: "work completed, contact bank.", type: 'success', subs: messages };
    }

    return { main: "Processing", type: 'active', subs: messages };
  };

  return (
    <div className="max-w-2xl mx-auto mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="bg-white p-8 rounded-2xl border shadow-xl">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <i className="fa-solid fa-magnifying-glass-location text-indigo-600"></i>
          Track Application
        </h2>

        <div className="flex gap-6 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <label className="flex items-center space-x-2 cursor-pointer group">
            <input 
              type="radio" 
              name="searchType" 
              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
              checked={searchType === 'txn'}
              onChange={() => handleReset('txn')}
            />
            <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Transaction ID</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer group">
            <input 
              type="radio" 
              name="searchType" 
              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
              checked={searchType === 'mobile'}
              onChange={() => handleReset('mobile')}
            />
            <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600 transition-colors">Mobile Number</span>
          </label>
        </div>
        
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <i className={`fa-solid ${searchType === 'txn' ? 'fa-hashtag' : 'fa-phone'}`}></i>
            </span>
            <input 
              required
              className="w-full pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              placeholder={searchType === 'txn' ? "Enter Transaction ID" : "Enter Mobile Number"}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="bg-slate-900 text-white px-8 rounded-xl font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-lg shadow-slate-200">
            Search
          </button>
        </form>

        {loading && (
          <div className="mt-8 flex flex-col items-center justify-center space-y-3">
            <i className="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-600"></i>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Querying System...</p>
          </div>
        )}

        {errorMsg && (
          <div className="mt-8 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center space-x-3">
            <i className="fa-solid fa-circle-xmark text-lg"></i>
            <span className="font-bold text-sm">{errorMsg}</span>
          </div>
        )}

        {result && !loading && (
          <div className="mt-8 animate-in zoom-in-95 duration-300">
            {(() => {
              const summary = getWorkflowSummary(result);
              return (
                <div className={`p-6 rounded-2xl border ${
                  summary.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                  summary.type === 'pending' ? 'bg-slate-50 border-slate-200' : 'bg-indigo-50 border-indigo-100'
                }`}>
                  <div className="flex justify-between items-start mb-6 border-b border-black/5 pb-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customer</p>
                      <h3 className="text-lg font-bold text-slate-800">{result.customer_name}</h3>
                      <p className="text-xs text-indigo-600 font-bold">{result.loan_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">TXN Reference</p>
                      <p className="text-sm font-mono font-bold bg-white px-2 py-1 rounded shadow-sm">#{result.transaction_id}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        summary.type === 'success' ? 'bg-emerald-500 text-white' : 
                        summary.type === 'pending' ? 'bg-slate-400 text-white' : 'bg-indigo-50 text-white'
                      }`}>
                        <i className={`fa-solid ${
                          summary.type === 'success' ? 'fa-check-double' : 
                          summary.type === 'pending' ? 'fa-hourglass-start' : 'fa-spinner fa-spin'
                        }`}></i>
                      </div>
                      <h4 className="text-lg font-extrabold text-slate-800">{summary.main}</h4>
                    </div>

                    {summary.subs && (
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        {summary.subs.map((msg, idx) => (
                          <div key={idx} className="flex items-center space-x-2 bg-white/50 p-3 rounded-xl border border-black/5">
                            <i className={`fa-solid ${msg.includes('Completed') ? 'fa-circle-check text-emerald-500' : 'fa-circle-dot text-amber-500'}`}></i>
                            <span className="text-xs font-bold text-slate-700">{msg}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanTracking;