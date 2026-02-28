
import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';

interface Job {
  transaction_id: number;
  loan_name: string;
  customer_id: number;
  loan_amount: number;
  customer_name: string;
  mobile_number: string;
  Loan_bank_name: string;
  Loan_branch_name: string;
  Loan_branch_address1: string;
  Loan_branch_address2: string;
  Loan_branch_mailid: string;
}

interface AllowedDoc {
  doc_name: string;
  doc_description: string;
  fileUrl: string | null;
}

const CivilApprove: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<AllowedDoc[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [selectedDocUrl, setSelectedDocUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // Workflow state
  const [jobDone, setJobDone] = useState(false);
  const [courierName, setCourierName] = useState('');
  const [courierTrackingId, setCourierTrackingId] = useState('');
  const [courierDate, setCourierDate] = useState(new Date().toISOString().split('T')[0]);

  const selectedJob = jobs.find(j => j.transaction_id === selectedTxn);

  useEffect(() => {
    fetchJobs();
  }, [user]);

  const fetchJobs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/civil/job-queue/${user.user_id}`);
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error("Failed to fetch jobs", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (txnId: number) => {
    if (selectedTxn === txnId) {
      setSelectedTxn(null);
      setDocs([]);
      setJobDone(false);
      resetCourierFields();
      return;
    }

    setSelectedTxn(txnId);
    setDocs([]);
    setJobDone(false);
    resetCourierFields();
    
    try {
      // Correctly calling the civil-specific allowed docs endpoint
      const res = await fetch(`http://localhost:3000/api/civil/allowed-docs/${txnId}`);
      const data = await res.json();
      setDocs(data);
    } catch (err) {
      console.error("Failed to fetch docs", err);
    }
  };

  const downloadAllDocs = async () => {
    const availableDocs = docs.filter(d => d.fileUrl);
    if (availableDocs.length === 0) {
      alert("No verified documents available for download.");
      return;
    }

    setIsDownloading(true);
    
    try {
      // Trigger downloads sequentially to prevent browser blocking
      for (const doc of availableDocs) {
        if (!doc.fileUrl) continue;
        
        const fileUrl = `http://localhost:3000${doc.fileUrl}`;
        const fileName = `${doc.doc_name.replace(/\s+/g, '_')}_CIVIL_TXN${selectedTxn}.pdf`;

        // Fetch as blob to force download behavior
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', fileName);
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Cleanup resources
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 1000);
        
        // Brief pause to prevent browser from flagging "multiple downloads"
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    } catch (err) {
      console.error("Batch download process failed", err);
      alert("Failed to download some documents. Please check your connection.");
    } finally {
      setIsDownloading(false);
    }
  };

  const resetCourierFields = () => {
    setCourierName('');
    setCourierTrackingId('');
    setCourierDate(new Date().toISOString().split('T')[0]);
  };

  const isFormValid = courierName.trim() !== '' && courierTrackingId.trim() !== '' && courierDate !== '';

  const handleSubmit = async () => {
    if (!selectedTxn) return;
    if (!isFormValid) {
      alert("Courier name, tracking ID, and send date are mandatory.");
      return;
    }

    const job = jobs.find(j => j.transaction_id === selectedTxn);

    setIsSubmitting(true);
    try {
      const res = await fetch('http://localhost:3000/api/civil/submit-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transactionId: selectedTxn, 
          userId: user?.user_id,
          loanAmount: job?.loan_amount,
          courierName,
          courierTrackingId,
          courierDate
        })
      });
      if (res.ok) {
        alert("Civil verification submitted successfully.");
        setSelectedTxn(null);
        setJobDone(false);
        resetCourierFields();
        fetchJobs();
      } else {
        alert("Submission failed. Check server logs.");
      }
    } catch (err) {
      alert("Submission failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white rounded-2xl border shadow-xl p-8 overflow-hidden">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
          <i className="fa-solid fa-house-chimney-check text-indigo-600"></i>
          Civil Approval Queue
        </h2>

        {loading ? (
          <div className="p-20 text-center text-slate-400">
            <i className="fa-solid fa-spinner fa-spin text-3xl mb-4"></i>
            <p className="font-bold uppercase tracking-widest text-xs">Fetching active jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-20 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
            <i className="fa-solid fa-folder-open text-4xl mb-4"></i>
            <p className="font-bold uppercase tracking-widest text-xs">No pending civil tasks.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Select</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Transaction ID</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Loan Name</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Customer Name</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Loan Amount</th>
                  <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map(job => (
                  <tr 
                    key={job.transaction_id} 
                    className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${selectedTxn === job.transaction_id ? 'bg-indigo-50/80' : ''}`}
                    onClick={() => handleSelect(job.transaction_id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        <input 
                          type="radio" 
                          name="civilJob"
                          className="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer" 
                          checked={selectedTxn === job.transaction_id}
                          readOnly
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-white px-2 py-1 border border-indigo-100 rounded">
                        #{job.transaction_id}
                      </span>
                    </td>
                    <td className="px-6 py-4"><span className="text-sm font-bold text-slate-800">{job.loan_name}</span></td>
                    <td className="px-6 py-4"><span className="text-sm font-bold text-slate-800">{job.customer_name}</span></td>
                    <td className="px-6 py-4"><span className="text-sm font-extrabold text-emerald-600">₹{job.loan_amount.toLocaleString()}</span></td>
                    <td className="px-6 py-4"><span className="text-sm font-mono text-slate-600">{job.mobile_number}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTxn && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-6 duration-300">
          <div className="bg-white rounded-2xl border shadow-xl p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="fa-solid fa-file-shield text-indigo-500"></i>
                Review Panel
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowDocModal(true)}
                  className="bg-indigo-600 text-white text-[10px] font-bold px-4 py-2 rounded-lg uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <i className="fa-solid fa-eye mr-2"></i> View Documents
                </button>
                <button 
                  onClick={downloadAllDocs}
                  disabled={isDownloading}
                  className="bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-lg uppercase shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin mr-2"></i>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-cloud-arrow-down mr-2"></i>
                      Download All
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {docs.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${doc.fileUrl ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                      <i className={`fa-solid ${doc.fileUrl ? 'fa-file-pdf' : 'fa-file-circle-xmark'}`}></i>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{doc.doc_name}</p>
                    </div>
                  </div>
                  {doc.fileUrl && (
                    <span className="bg-emerald-50 text-emerald-600 text-[9px] font-extrabold px-2 py-1 rounded border border-emerald-100 uppercase">
                      Verified
                    </span>
                  )}
                </div>
              ))}

              {selectedJob && (
                <div className="space-y-1 mt-6 pt-6 border-t border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bank Delivery Address</label>
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2">
                    <p className="text-sm font-bold text-indigo-900">{selectedJob.Loan_bank_name}</p>
                    <p className="text-xs font-semibold text-slate-700">{selectedJob.Loan_branch_name}</p>
                    <p className="text-xs text-slate-600">{selectedJob.Loan_branch_address1}</p>
                    {selectedJob.Loan_branch_address2 && <p className="text-xs text-slate-600">{selectedJob.Loan_branch_address2}</p>}
                    <p className="text-[10px] font-mono text-indigo-600 font-bold">{selectedJob.Loan_branch_mailid}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-xl p-8 flex flex-col space-y-6">
            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4 flex items-center gap-2">
              <i className="fa-solid fa-truck-fast text-indigo-500"></i>
              Execution Details
            </h3>
            
            {!jobDone ? (
              <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-10 text-center">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 text-3xl">
                  <i className="fa-solid fa-house-circle-check"></i>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800">Final Verification</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">Click below to mark the civil verification as finished and enter dispatch details.</p>
                </div>
                <button 
                  onClick={() => setJobDone(true)}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                  Job Completed
                </button>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Courier Name *</label>
                  <input 
                    className="w-full p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                    placeholder=""
                    value={courierName}
                    onChange={e => setCourierName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Courier Tracking ID *</label>
                  <input 
                    className="w-full p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                    placeholder="Enter Tracking Reference..."
                    value={courierTrackingId}
                    onChange={e => setCourierTrackingId(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Courier Send Date *</label>
                  <input 
                    type="date"
                    className="w-full p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                    value={courierDate}
                    onChange={e => setCourierDate(e.target.value)}
                  />
                </div>
                <div className="pt-4">
                  <button 
                    disabled={isSubmitting || !isFormValid}
                    onClick={handleSubmit}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-blue-700 shadow-xl shadow-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : <i className="fa-solid fa-paper-plane mr-2"></i>}
                    Submit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Doc Viewer Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                Customer Documents: #{selectedTxn}
              </h3>
              <div className="flex items-center gap-4">
                <button 
                  onClick={downloadAllDocs}
                  disabled={isDownloading}
                  className="bg-slate-900 text-white text-[10px] font-bold px-5 py-2 rounded-xl uppercase shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {isDownloading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-download"></i>}
                  Download All
                </button>
                <button onClick={() => setShowDocModal(false)} className="w-10 h-10 rounded-full hover:bg-slate-100 text-2xl flex items-center justify-center transition-all">&times;</button>
              </div>
            </div>
            <div className="flex-1 flex bg-slate-100 overflow-hidden">
              <div className="w-80 border-r bg-white overflow-y-auto p-6 space-y-3">
                {docs.filter(d => d.fileUrl).map((doc, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedDocUrl(`http://localhost:3000${doc.fileUrl}`)}
                    className={`w-full text-left p-4 rounded-xl border transition-all text-xs font-bold flex items-center gap-3 ${
                      selectedDocUrl === `http://localhost:3000${doc.fileUrl}` 
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                      : 'border-slate-100 hover:border-indigo-200'
                    }`}
                  >
                    <i className="fa-solid fa-file-pdf"></i>
                    <span className="truncate flex-1">{doc.doc_name}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 p-0 flex flex-col items-center justify-center bg-slate-200">
                {selectedDocUrl ? (
                  <iframe src={selectedDocUrl} className="w-full h-full border-none" />
                ) : (
                  <p className="text-slate-400 font-medium text-sm">Select a document to preview</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CivilApprove;
