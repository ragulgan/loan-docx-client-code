
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { UserType } from '../types';
import { jsPDF } from "https://esm.sh/jspdf";

interface PayoutRecord {
  user_name: string;
  mobile_number: string;
  upi_id: string;
  user_id: number;
  payment_amount: number;
}

const UserPayoutList: React.FC = () => {
  const { user } = useAuth();
  const [userType, setUserType] = useState('AT');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [records, setRecords] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayments = async () => {
    if (!fromDate || !toDate) {
      alert("Please select both From and To dates.");
      return;
    }

    setLoading(true);
    setRecords([]);
    try {
      const res = await fetch(`http://localhost:3000/api/admin/payments?userType=${userType}&fromDate=${fromDate}&toDate=${toDate}`);
      const data = await res.json();
      
      if (!data || data.length === 0) {
        alert("Records not found");
      } else {
        setRecords(data);
      }
    } catch (err) {
      alert("Error fetching records.");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (records.length === 0) {
      alert("No data available to download.");
      return;
    }

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const typeLabel = userType === 'AT' ? 'AGENT' : 
                       userType === 'LU' ? 'LEGAL USER' :
                       userType === 'CU' ? 'CIVIL USER' : 'LEGAL HEAD';

      const typeLabelForFile = userType === 'AT' ? 'agent' : 
                               userType === 'LU' ? 'legaluser' :
                               userType === 'CU' ? 'civiluser' : 'legalhead';

      // 1. Title: Payout Report (Centered)
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Payout Report", 105, 20, { align: "center" });

      // 2. User type line
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`User type: ${typeLabel}`, 20, 35);

      // 3. Dates line
      pdf.text(`Payout from date : ${fromDate}`, 20, 45);
      pdf.text(`payout to date : ${toDate}`, 120, 45);

      // 4. Column Headers
      pdf.setFont("helvetica", "bold");
      pdf.text("user name", 20, 60);
      pdf.text("mobile number", 55, 60);
      pdf.text("upi id", 90, 60);
      pdf.text("userid", 130, 60);
      pdf.text("payout amount", 160, 60);
      
      pdf.line(20, 62, 195, 62);

      // 5. Table Rows
      pdf.setFont("helvetica", "normal");
      let y = 70;
      records.forEach(rec => {
        // Handle page overflow
        if (y > 280) {
          pdf.addPage();
          y = 20;
        }
        pdf.text(rec.user_name || '---', 20, y);
        pdf.text(rec.mobile_number?.toString() || '---', 55, y);
        pdf.text(rec.upi_id || '---', 90, y);
        pdf.text(rec.user_id?.toString() || '---', 130, y);
        pdf.text(rec.payment_amount?.toFixed(2) || '0.00', 160, y);
        y += 10;
      });

      // Filename: <usertype>_payout_report_<fromdate>_<todate>.pdf
      const fileName = `${typeLabelForFile}_payout_report_${fromDate}_${toDate}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("PDF Generation failed", error);
      alert("Failed to generate PDF. Please check console for details.");
    }
  };

  if (user?.user_type !== UserType.ADMIN) {
    return <div className="p-10 text-center text-rose-500 font-bold">Access Denied</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl border shadow-xl overflow-hidden">
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <i className="fa-solid fa-money-check-dollar text-2xl"></i>
            </div>
            <h2 className="text-xl font-bold">Payout Settlement</h2>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">User Type</label>
              <select 
                className="w-full p-3 bg-white border rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                value={userType}
                onChange={e => setUserType(e.target.value)}
              >
                <option value="AT">Agent (AT)</option>
                <option value="LU">Legal User (LU)</option>
                <option value="LH">Legal Head (LH)</option>
                <option value="CU">Civil User (CU)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">From Date</label>
              <input 
                type="date"
                className="w-full p-3 bg-white border rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">To Date</label>
              <input 
                type="date"
                className="w-full p-3 bg-white border rounded-xl font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={fetchPayments}
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-magnifying-glass"></i>}
                Fetch Records
              </button>
            </div>
          </div>

          {/* Results */}
          {records.length > 0 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Qualified Settlement Data</h3>
                <button 
                  onClick={downloadReport}
                  className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-file-pdf"></i>
                  Download Report
                </button>
              </div>

              <div className="border rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">User Name</th>
                      <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Mobile Number</th>
                      <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">UPI ID</th>
                      <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">User ID</th>
                      <th className="px-6 py-4 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Payout Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map(rec => (
                      <tr key={rec.user_id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">{rec.user_name}</td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-600">{rec.mobile_number}</td>
                        <td className="px-6 py-4 text-xs text-indigo-600 font-bold">{rec.upi_id || '---'}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-400">UID-{rec.user_id}</td>
                        <td className="px-6 py-4 font-extrabold text-emerald-600">₹{rec.payment_amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserPayoutList;
