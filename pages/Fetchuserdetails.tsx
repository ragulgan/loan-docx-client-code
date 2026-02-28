
import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { jsPDF } from "https://esm.sh/jspdf";

interface RegistryUser {
  user_id: number;
  user_name: string;
  upi_id: string;
  address1: string;
  address2: string;
  mobile_number: string;
  email_id: string;
  aadhar_number: string;
  user_active: string;
}

const ITEMS_PER_PAGE = 10;

const FetchUserDetails: React.FC = () => {
  const { user } = useAuth();
  
  // User Registry State
  const [selectedType, setSelectedType] = useState('AT');
  const [registry, setRegistry] = useState<RegistryUser[]>([]);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchRegistry();
  }, [selectedType]);

  const fetchRegistry = async () => {
    setLoadingRegistry(true);
    setCurrentPage(1);
    try {
      const res = await fetch(`http://localhost:3000/api/admin/user-registry?type=${selectedType}`);
      const data = await res.json();
      setRegistry(data || []);
    } catch (err) {
      console.error("Failed to fetch registry", err);
    } finally {
      setLoadingRegistry(false);
    }
  };

  const exportPDF = () => {
    if (registry.length === 0) return;
    const doc = new jsPDF('l', 'mm', 'a4');
    const typeLabel = selectedType === 'AT' ? 'Agent' : selectedType === 'LU' ? 'Legal User' : selectedType === 'CU' ? 'Civil User' : 'Legal Head';

    doc.setFontSize(16);
    doc.text(`User details Report - ${typeLabel}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    
    // Header
    doc.setFont("helvetica", "bold");
    const headers = ["User ID", "User Name", "UPI ID", "Address", "Mobile", "Email", "Aadhar", "Active"];
    const xPos = [10, 30, 60, 90, 160, 190, 240, 275];
    
    headers.forEach((h, i) => doc.text(h, xPos[i], 30));
    doc.line(10, 32, 285, 32);

    doc.setFont("helvetica", "normal");
    let y = 38;
    registry.forEach((u) => {
      if (y > 190) {
        doc.addPage();
        y = 20;
      }
      const fullAddress = `${u.address1 || ''} ${u.address2 || ''}`.trim();
      
      doc.text(u.user_id.toString(), xPos[0], y);
      doc.text(u.user_name.substring(0, 15), xPos[1], y);
      doc.text(u.upi_id?.substring(0, 15) || 'N/A', xPos[2], y);
      doc.text(fullAddress.substring(0, 40), xPos[3], y);
      doc.text(u.mobile_number?.toString() || 'N/A', xPos[4], y);
      doc.text(u.email_id.substring(0, 25), xPos[5], y);
      doc.text(u.aadhar_number || 'N/A', xPos[6], y);
      doc.text(u.user_active === 'Y' ? 'Yes' : 'No', xPos[7], y);
      y += 8;
    });

    doc.save(`${typeLabel.toLowerCase()}_user_details.pdf`);
  };

  const totalPages = Math.ceil(registry.length / ITEMS_PER_PAGE);
  const currentData = registry.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-6 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">User details</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-slate-600">User Type:</label>
            <select 
              className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="AT">Agent</option>
              <option value="LU">Legal User</option>
              <option value="CU">Civil User</option>
              <option value="LH">Legal Head</option>
            </select>
          </div>
          <button 
            onClick={exportPDF} 
            disabled={registry.length === 0}
            className="bg-emerald-600 text-white px-6 py-2 rounded-xl shadow-lg hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <i className="fa-solid fa-file-pdf"></i>
            <span className="text-xs font-bold uppercase tracking-wider">Export Report</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">UPI ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Address</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mobile Number</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aadhar Number</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">User Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingRegistry ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center">
                    <i className="fa-solid fa-spinner fa-spin text-3xl text-indigo-500"></i>
                  </td>
                </tr>
              ) : currentData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-20 text-center text-slate-400 italic text-sm">No records found.</td>
                </tr>
              ) : (
                currentData.map(u => (
                  <tr key={u.user_id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-400">#{u.user_id}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{u.user_name}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-indigo-600">{u.upi_id || '---'}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">
                      {`${u.address1 || ''} ${u.address2 || ''}`.trim() || '---'}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono font-bold text-slate-700">{u.mobile_number || '---'}</td>
                    <td className="px-6 py-4 text-xs text-slate-600">{u.email_id}</td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">{u.aadhar_number || '---'}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.user_active === 'Y' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                        {u.user_active === 'Y' ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-6 bg-slate-50 border-t flex justify-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-30 shadow-sm"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <div className="flex items-center px-4 text-xs font-bold text-slate-500 bg-white border rounded-xl shadow-sm uppercase tracking-widest">
              Page {currentPage} of {totalPages}
            </div>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all disabled:opacity-30 shadow-sm"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FetchUserDetails;
