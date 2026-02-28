import React, { useState, useRef } from 'react';
import { jsPDF } from "https://esm.sh/jspdf";
import { useAuth } from '../AuthContext';

interface DocCheck { doc_name: string; doc_description: string; }

const DocumentManagement: React.FC = () => {
  const { user } = useAuth();
  const [searchType, setSearchType] = useState<'mobile' | 'customer_id'>('customer_id');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<{ customer_id: number, customer_name: string, loan_name: string } | null>(null);
  const [checklist, setChecklist] = useState<DocCheck[]>([]);
  
  // Scanning state
  const [scanningDoc, setScanningDoc] = useState<string | null>(null);
  const [tempPages, setTempPages] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resetPage = () => {
    setCustomerInfo(null);
    setChecklist([]);
    setQuery('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    if (searchType === 'mobile' && !/^\d{10}$/.test(query)) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setCustomerInfo(null);
    setChecklist([]);

    try {
      const res = await fetch(`http://localhost:3000/api/agent/fetch-customer-details?query=${query}&type=${searchType}`);
      const data = await res.json();
      
      if (data.error) {
        alert(data.error);
      } else {
        setCustomerInfo(data.customer);
        setChecklist(data.checklist);
      }
    } catch (err) {
      alert("Search failed. Ensure server is running.");
    } finally {
      setLoading(false);
    }
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
        setTempPages(prev => [...prev, canvasRef.current!.toDataURL('image/jpeg', 0.7)]);
      }
    }
  };

  const finalizeAndUpload = async (docName: string, pdfBase64: string) => {
    if (!customerInfo) return;
    
    try {
      const res = await fetch('http://localhost:3000/api/agent/upload-single-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerInfo.customer_id,
          docName,
          pdfData: pdfBase64
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Document "${docName}" saved successfully as: ${data.fileName}`);
        resetPage();
      } else {
        alert("Upload failed: " + data.message);
      }
    } catch (err) {
      alert("Error uploading document.");
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
        pdf.addImage(page, 'JPEG', 0, 0, pageWidth, pageHeight);
      });
      
      const pdfBase64 = pdf.output('datauristring');
      await finalizeAndUpload(scanningDoc, pdfBase64);
      
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(t => t.stop());
      setScanningDoc(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, name: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const data = ev.target?.result as string;
        let pdfData = data;
        
        if (file.type.startsWith('image/')) {
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          pdf.addImage(data, 'JPEG', 0, 0, pageWidth, pageHeight);
          pdfData = pdf.output('datauristring');
        } else if (file.type !== 'application/pdf') {
          alert("Please upload PDF or Image only.");
          return;
        }
        
        await finalizeAndUpload(name, pdfData);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 pb-20">
      <div className="bg-white rounded-2xl border shadow-xl p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <i className="fa-solid fa-file-circle-plus text-indigo-600"></i>
          Manage Documents
        </h2>

        <form onSubmit={handleSearch} className="space-y-6">
          <div className="flex gap-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input 
                type="radio" 
                name="searchType" 
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
                checked={searchType === 'customer_id'}
                onChange={() => setSearchType('customer_id')}
              />
              <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600">Customer ID</span>
            </label>
            <label className="flex items-center space-x-2 cursor-pointer group">
              <input 
                type="radio" 
                name="searchType" 
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" 
                checked={searchType === 'mobile'}
                onChange={() => setSearchType('mobile')}
              />
              <span className="text-sm font-bold text-slate-600 group-hover:text-indigo-600">Mobile Number</span>
            </label>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <i className={`fa-solid ${searchType === 'customer_id' ? 'fa-hashtag' : 'fa-phone'}`}></i>
              </span>
              <input 
                required
                className="w-full pl-10 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                placeholder={searchType === 'customer_id' ? "Enter Customer ID" : "Enter Mobile Number"}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="bg-slate-900 text-white px-8 rounded-xl font-bold hover:bg-slate-800 active:scale-95 transition-all shadow-lg shadow-slate-200">
              {loading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : null}
              Fetch Documents
            </button>
          </div>
        </form>
      </div>

      {customerInfo && (
        <div className="bg-white rounded-2xl border shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
          <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Identity</p>
                <h3 className="text-xl font-bold">{customerInfo.customer_name}</h3>
                <p className="text-xs text-indigo-400 font-mono">#{customerInfo.customer_id} • {customerInfo.loan_name}</p>
             </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-indigo-600 uppercase border-b border-indigo-100 pb-2 flex items-center gap-2">
                <i className="fa-solid fa-list-check"></i>
                Required Documents Checklist
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {checklist.map(doc => (
                  <div key={doc.doc_name} className="p-5 rounded-xl border-2 border-slate-100 bg-white hover:border-indigo-100 transition-all">
                    <div className="mb-4">
                      <p className="font-bold text-slate-800 text-sm">{doc.doc_name}</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed uppercase tracking-wider">{doc.doc_description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startScan(doc.doc_name)} className="flex-1 text-[10px] font-bold bg-indigo-600 text-white p-2.5 rounded-lg uppercase hover:bg-indigo-700 shadow-md transition-all active:scale-[0.98]">
                        <i className="fa-solid fa-camera mr-2"></i> Scan
                      </button>
                      <label className="flex-1 text-[10px] font-bold bg-white text-slate-600 p-2.5 rounded-lg uppercase text-center cursor-pointer border-2 border-slate-100 hover:border-indigo-200 transition-all shadow-sm">
                        <input type="file" className="hidden" accept="application/pdf,image/*" onChange={e => handleFileUpload(e, doc.doc_name)} />
                        <i className="fa-solid fa-file-arrow-up mr-2"></i> Upload
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal Reused */}
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
          </div>

          <div className="mt-10 flex justify-center items-center space-x-12">
            <div className="flex flex-col items-center gap-2">
               <button onClick={capturePage} className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-slate-900 text-4xl shadow-2xl active:scale-90 transition-all hover:bg-slate-100 border-8 border-indigo-600">
                <i className="fa-solid fa-plus"></i>
              </button>
              <span className="text-white text-[10px] font-bold uppercase tracking-widest">Capture Page</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button onClick={finishScan} className="bg-emerald-500 hover:bg-emerald-600 text-white px-14 py-4 rounded-2xl font-extrabold shadow-xl active:scale-95 transition-all flex items-center gap-3">
                <i className="fa-solid fa-cloud-arrow-up text-xl"></i>
                SUBMIT TO SERVER
              </button>
              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">Finalize Document</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManagement;