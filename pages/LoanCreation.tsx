import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { jsPDF } from "https://esm.sh/jspdf";

interface LoanType { loan_id: number; loan_name: string; }
interface DocCheck { doc_name: string; doc_description: string; }

const LoanCreation: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [customer, setCustomer] = useState({
    name: '', upi: '', a1: '', a2: '', mobile: '', email: '', aadhar: '', pan: ''
  });
  const [loan, setLoan] = useState({
    loan_id: '', loan_name: '', amt: '', fee: 0, received: '', bnk: '', brn: '', ba1: '', ba2: '', bml: ''
  });

  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [checklist, setChecklist] = useState<DocCheck[]>([]);
  const [collectedDocs, setCollectedDocs] = useState<Record<string, { type: 'PDF', data: string }>>({});
  const [scanningDoc, setScanningDoc] = useState<string | null>(null);
  const [tempPages, setTempPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/loans/types')
      .then(res => res.json())
      .then(data => setLoanTypes(data))
      .catch(err => console.error("Failed to fetch types", err));
  }, []);

  useEffect(() => {
    if (loan.amt && parseFloat(loan.amt) > 0) {
      fetch(`http://localhost:3000/api/loans/fees/${loan.amt}`)
        .then(res => res.json())
        .then(data => setLoan(prev => ({ ...prev, fee: data.processing_fees })))
        .catch(err => console.error("Failed to fetch fees", err));
    } else {
      setLoan(prev => ({ ...prev, fee: 0 }));
    }
  }, [loan.amt]);

  const handleLoanTypeSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const name = loanTypes.find(l => l.loan_id.toString() === id)?.loan_name || '';
    setLoan(prev => ({ ...prev, loan_id: id, loan_name: name }));
    
    fetch(`http://localhost:3000/api/loans/checklist/${id}`)
      .then(res => res.json())
      .then(data => setChecklist(data))
      .catch(err => console.error("Failed to fetch checklist", err));
  };

  const startScan = (name: string) => {
    setScanningDoc(name);
    setTempPages([]);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(err => alert("Camera access denied: " + err.message));
  };

  const capturePage = () => {
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0);
        // Use JPEG for PDF embedding to save space
        setTempPages(prev => [...prev, canvasRef.current!.toDataURL('image/jpeg', 0.7)]);
      }
    }
  };

  const finishScan = async () => {
    if (scanningDoc) {
      if (tempPages.length === 0) {
        alert("Please capture at least one page.");
        return;
      }
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      tempPages.forEach((page, i) => {
        if (i > 0) pdf.addPage();
        // Fit image to A4
        pdf.addImage(page, 'JPEG', 0, 0, pageWidth, pageHeight);
      });
      
      const pdfBase64 = pdf.output('datauristring');
      setCollectedDocs(prev => ({ ...prev, [scanningDoc]: { type: 'PDF', data: pdfBase64 } }));
      
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      setScanningDoc(null);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>, name: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as string;
        if (file.type === 'application/pdf') {
          // Already PDF
          setCollectedDocs(prev => ({ ...prev, [name]: { type: 'PDF', data } }));
        } else if (file.type.startsWith('image/')) {
          // Convert Image to PDF
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          pdf.addImage(data, 'JPEG', 0, 0, pageWidth, pageHeight);
          setCollectedDocs(prev => ({ ...prev, [name]: { type: 'PDF', data: pdf.output('datauristring') } }));
        } else {
          alert("Unsupported file format. Please upload PDF or Images.");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic Validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mobileRegex = /^\d{10}$/;

    if (!customer.a1 || !customer.a2 || !customer.mobile || !customer.aadhar || !customer.pan) {
      alert("Address1, Address2, Mobile, Aadhar, and PAN Card are mandatory!");
      return;
    }

    if (!mobileRegex.test(customer.mobile)) {
      alert("Mobile number must be exactly 10 digits.");
      return;
    }

    if (customer.email && !emailRegex.test(customer.email)) {
      alert("Invalid Customer Email ID format.");
      return;
    }

    if (!emailRegex.test(loan.bml)) {
      alert("Invalid Branch Email ID format.");
      return;
    }

    if (parseFloat(loan.received) !== loan.fee) {
      alert(`Amount received (₹${loan.received}) must match Processing Fee (₹${loan.fee})!`);
      return;
    }

    if (Object.keys(collectedDocs).length < checklist.length) {
      alert("Please collect all required documents from the checklist.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/loans/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customer, 
          loanDetails: loan, 
          agentId: user?.user_id,
          documents: collectedDocs 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Transaction successfully initiated!\nTransaction ID: ${data.transactionId}`);
        // Reset the form instead of navigating
        setCustomer({ name: '', upi: '', a1: '', a2: '', mobile: '', email: '', aadhar: '', pan: '' });
        setLoan({ loan_id: '', loan_name: '', amt: '', fee: 0, received: '', bnk: '', brn: '', ba1: '', ba2: '', bml: '' });
        setCollectedDocs({});
        setChecklist([]);
      } else {
        alert("Submission failed: " + data.message);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      alert("Error submitting application: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 pb-20">
      <div className="bg-white rounded-2xl border shadow-xl overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <i className="fa-solid fa-file-invoice text-indigo-400 text-2xl"></i>
            <h2 className="text-xl font-bold">Loan Application</h2>
          </div>
        </div>

        <form onSubmit={submit} className="p-8 space-y-12">
          {/* Section: Customer Identity */}
          <section className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Customer Name *</label>
                <input required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Mobile Number *</label>
                <input required type="tel" maxLength={10} placeholder="10-digit number" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={customer.mobile} onChange={e => setCustomer({...customer, mobile: e.target.value.replace(/\D/g, '')})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Aadhar Card Number *</label>
                <input required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={customer.aadhar} onChange={e => setCustomer({...customer, aadhar: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">PAN Card Number *</label>
                <input required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={customer.pan} onChange={e => setCustomer({...customer, pan: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email ID</label>
                <input type="email" className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">UPI ID</label>
                <input className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={customer.upi} onChange={e => setCustomer({...customer, upi: e.target.value})} />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Address Line 1 *</label>
                <input required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={customer.a1} onChange={e => setCustomer({...customer, a1: e.target.value})} />
              </div>
              <div className="md:col-span-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Address Line 2 *</label>
                <input required className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={customer.a2} onChange={e => setCustomer({...customer, a2: e.target.value})} />
              </div>
            </div>
          </section>

          {/* Section: Loan & Fees */}
          <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200 shadow-inner">
            <div className="flex flex-wrap gap-6 items-end">
              <div className="flex-1 min-w-[200px] space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Loan Type *</label>
                <select required className="w-full p-2.5 border rounded-lg bg-white shadow-sm" value={loan.loan_id} onChange={handleLoanTypeSelect}>
                  <option value="">Select Scheme</option>
                  {loanTypes.map(t => <option key={t.loan_id} value={t.loan_id}>{t.loan_name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Principal Amount (₹) *</label>
                <input required type="number" className="w-full p-2.5 border rounded-lg shadow-sm" value={loan.amt} onChange={e => setLoan({...loan, amt: e.target.value})} />
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Processing Fees (Fixed)</label>
                <input disabled className="w-full p-2.5 bg-slate-200 border rounded-lg font-bold text-slate-600 shadow-inner" value={`₹ ${loan.fee}`} />
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <label className="text-[10px] font-bold text-rose-600 uppercase italic">Amount Received (Must match Processing Fee) *</label>
                <input required type="number" className="w-full p-2.5 border-2 border-indigo-200 rounded-lg font-extrabold text-indigo-700 bg-indigo-50 focus:ring-0" value={loan.received} onChange={e => setLoan({...loan, received: e.target.value})} />
              </div>
            </div>
          </section>

          {/* Section: Bank & Branch Reference */}
          <section className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Bank Name *</label>
                <input required className="w-full p-2.5 border rounded-lg shadow-sm" value={loan.bnk} onChange={e => setLoan({...loan, bnk: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Branch Name *</label>
                <input required className="w-full p-2.5 border rounded-lg shadow-sm" value={loan.brn} onChange={e => setLoan({...loan, brn: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Branch Email *</label>
                <input required type="email" className="w-full p-2.5 border rounded-lg shadow-sm" value={loan.bml} onChange={e => setLoan({...loan, bml: e.target.value})} />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Branch Address Line 1 *</label>
                <input required className="w-full p-2.5 border rounded-lg shadow-sm" value={loan.ba1} onChange={e => setLoan({...loan, ba1: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Branch Address Line 2</label>
                <input className="w-full p-2.5 border rounded-lg shadow-sm" value={loan.ba2} onChange={e => setLoan({...loan, ba2: e.target.value})} />
              </div>
            </div>
          </section>

          {/* Section: Document Repos */}
          <section className="space-y-6">
            <h3 className="text-xs font-bold text-indigo-600 uppercase border-b border-indigo-100 pb-2 flex items-center gap-2">
              <i className="fa-solid fa-file-shield"></i>
              Document Checklist & Capture (Auto-PDF Conversion)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checklist.length === 0 && <p className="text-slate-400 text-xs italic p-4">Select a loan type to view required documents.</p>}
              {checklist.map(doc => {
                const collected = collectedDocs[doc.doc_name];
                return (
                  <div key={doc.doc_name} className={`p-5 rounded-xl border-2 transition-all ${collected ? 'bg-emerald-50 border-emerald-200 shadow-md' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800 text-sm">{doc.doc_name}</p>
                        <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-wider">{doc.doc_description}</p>
                      </div>
                      {collected && (
                        <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm flex items-center gap-1">
                          <i className="fa-solid fa-file-pdf"></i>
                          PDF GENERATED
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startScan(doc.doc_name)} className="flex-1 text-[10px] font-bold bg-indigo-600 text-white p-2.5 rounded-lg uppercase hover:bg-indigo-700 shadow-md transition-all active:scale-[0.98]">
                        <i className="fa-solid fa-camera mr-2"></i> Scan Multi-page
                      </button>
                      <label className="flex-1 text-[10px] font-bold bg-white text-slate-600 p-2.5 rounded-lg uppercase text-center cursor-pointer border-2 border-slate-100 hover:border-indigo-200 transition-all shadow-sm">
                        <input type="file" className="hidden" accept="application/pdf,image/*" onChange={e => handleUpload(e, doc.doc_name)} />
                        <i className="fa-solid fa-file-pdf mr-2"></i> Upload & Convert
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex justify-end pt-10 border-t border-slate-100">
            <button type="submit" disabled={loading} className="px-16 py-5 bg-slate-900 text-white rounded-2xl font-bold shadow-2xl hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center gap-3">
              {loading ? <i className="fa-solid fa-circle-notch fa-spin text-xl"></i> : <i className="fa-solid fa-shield-check text-xl text-indigo-400"></i>}
              <span>{loading ? 'Submitting...' : 'Submit'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Full-screen Scanner Modal */}
      {scanningDoc && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex flex-col p-6 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="flex justify-between items-center text-white mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                <i className="fa-solid fa-expand"></i>
              </div>
              <div>
                <h4 className="font-bold text-xl uppercase tracking-tight">{scanningDoc}</h4>
                <p className="text-xs text-indigo-400 mt-1 font-mono uppercase tracking-widest">{tempPages.length} PAGES RECORDED</p>
              </div>
            </div>
            <button onClick={() => setScanningDoc(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-500 transition-all text-2xl font-light">&times;</button>
          </div>
          
          <div className="flex-1 relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
            <video ref={videoRef} className="h-full w-full object-contain" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center">
               <div className="flex gap-4">
                  {tempPages.slice(-5).map((p, i) => (
                    <div key={i} className="relative animate-in slide-in-from-right-2">
                       <img src={p} className="w-14 h-20 rounded-md object-cover border-2 border-indigo-500 shadow-xl" />
                       <div className="absolute -top-2 -right-2 bg-indigo-600 text-[8px] w-4 h-4 rounded-full flex items-center justify-center">{i + 1}</div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="mt-10 flex justify-center items-center space-x-12">
            <div className="flex flex-col items-center gap-2">
               <button onClick={capturePage} className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-900 text-4xl shadow-2xl active:scale-90 transition-all hover:bg-slate-100 hover:rotate-12 border-8 border-indigo-600">
                <i className="fa-solid fa-plus"></i>
              </button>
              <span className="text-white text-[10px] font-bold uppercase tracking-widest">Capture Page</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button onClick={finishScan} className="bg-emerald-500 hover:bg-emerald-600 text-white px-14 py-4 rounded-2xl font-extrabold shadow-xl active:scale-95 transition-all flex items-center gap-3">
                <i className="fa-solid fa-check-circle text-xl"></i>
                FINALIZE AS PDF
              </button>
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Generate Document PDF</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanCreation;