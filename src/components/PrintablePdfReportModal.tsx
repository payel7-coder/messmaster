import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  CheckCircle2, 
  Copy, 
  Sliders, 
  Eye, 
  Building2, 
  Receipt, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, MonthReport } from '../types';
import { formatReadableDate, formatReadableMonth } from '../utils';
import { generateMonthlyReportPdf } from '../utils/pdfGenerator';

interface PrintablePdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: MonthReport;
  boarders: Boarder[];
  deposits: Deposit[];
  mealLogs: DailyMealLog[];
  bazaarCosts: BazaarCost[];
  miscCosts: MiscellaneousCosts;
  settings: MessSettings;
}

export default function PrintablePdfReportModal({
  isOpen,
  onClose,
  report,
  boarders,
  deposits,
  mealLogs,
  bazaarCosts,
  miscCosts,
  settings,
}: PrintablePdfReportModalProps) {
  // Configuration options
  const [includeBazaarList, setIncludeBazaarList] = useState(true);
  const [includeFixedCostsBreakdown, setIncludeFixedCostsBreakdown] = useState(true);
  const [includeMemberSlips, setIncludeMemberSlips] = useState(true);
  const [managerName, setManagerName] = useState('Mess Manager');
  const [managerPhone, setManagerPhone] = useState('');
  const [customNotes, setCustomNotes] = useState(
    'Please clear all remaining dues before the 5th of next month via bKash/Cash. For discrepancies, contact the manager.'
  );

  const [activePreviewTab, setActivePreviewTab] = useState<'all' | 'master' | 'slips' | 'bazaar'>('all');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  const activeMonthStr = formatReadableMonth(report.month);
  const activeBoarders = boarders.filter(b => b.isActive);
  const netMessBalance = report.totalDeposits - (report.totalBazaarCost + report.totalFixedCost);
  const currentMonthBazaars = bazaarCosts.filter(b => b.date.startsWith(report.month));

  // Trigger vector PDF download using jsPDF
  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      const doc = generateMonthlyReportPdf(
        report,
        boarders,
        deposits,
        mealLogs,
        bazaarCosts,
        miscCosts,
        settings,
        {
          includeBazaarList,
          includeFixedCostsBreakdown,
          includeMemberSlips,
          customNotes,
          managerName,
          managerPhone,
        }
      );

      const cleanMessName = (settings.messName || 'Mess').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanMessName}_Monthly_Report_${report.month}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Could not generate PDF directly. You can use the Print / Save to PDF button as an alternative.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Trigger native print dialog
  const handleNativePrint = () => {
    window.print();
  };

  // Copy formatted WhatsApp summary message
  const handleCopyWhatsApp = () => {
    let msg = `📋 *${settings.messName || 'Mess'} - Monthly Statement*\n`;
    msg += `📅 *Month:* ${activeMonthStr}\n`;
    msg += `------------------------------------\n`;
    msg += `🍛 *Total Meals:* ${report.totalMeals.toFixed(1)}\n`;
    msg += `🛒 *Total Bazaar:* ৳${report.totalBazaarCost.toLocaleString('en-IN')}\n`;
    msg += `💰 *Meal Rate:* ৳${report.mealRate.toFixed(4)} / meal\n`;
    msg += `🏢 *Shared Fixed Bills:* ৳${report.totalFixedCost.toLocaleString('en-IN')} (৳${(report.boardersReport[0]?.fixedCostShare || 0).toFixed(2)}/member)\n`;
    msg += `💵 *Total Deposits:* ৳${report.totalDeposits.toLocaleString('en-IN')}\n`;
    msg += `------------------------------------\n`;
    msg += `*Member Balance Summary:*\n`;

    report.boardersReport.forEach((b, idx) => {
      const sign = b.balance >= 0 ? '+' : '';
      const status = b.balance >= 0 ? 'Refund' : 'Due';
      msg += `${idx + 1}. *${b.boarderName}*: Meals: ${b.totalMeals} | Charged: ৳${b.totalCost.toFixed(0)} | Paid: ৳${b.totalDeposit.toFixed(0)} | *Balance: ${sign}৳${b.balance.toFixed(0)} (${status})*\n`;
    });

    if (customNotes) {
      msg += `\n📌 *Notice:* ${customNotes}\n`;
    }
    if (managerName) {
      msg += `✍️ *Manager:* ${managerName}${managerPhone ? ` (${managerPhone})` : ''}\n`;
    }

    navigator.clipboard.writeText(msg).then(() => {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible">
      
      {/* Modal Dialog Box */}
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Top Header Bar (Hidden in print) */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Monthly Printable PDF Report
                <span className="text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  {activeMonthStr}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Official monthly meal sheet, master balance ledger, itemized expenses & member invoice slips
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              id="btn-modal-download-pdf"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              title="Download vector PDF file"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handleNativePrint}
              id="btn-modal-print-dialog"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer border border-slate-700"
              title="Print document or save using browser dialog"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              onClick={handleCopyWhatsApp}
              id="btn-modal-copy-whatsapp"
              className="hidden sm:flex items-center gap-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer"
              title="Copy summary formatted for WhatsApp"
            >
              {copiedWhatsApp ? <CheckCircle2 className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>{copiedWhatsApp ? 'Copied!' : 'WhatsApp'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Controls & Settings on Left (Collapsible), Printable Sheet Preview on Right */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100 print:bg-white print:block print:overflow-visible">
          
          {/* Customization Sidebar (Hidden on print) */}
          <aside className="w-full lg:w-80 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 overflow-y-auto space-y-4 print:hidden shrink-0 text-xs">
            
            <div className="flex items-center gap-1.5 text-slate-800 font-bold uppercase tracking-wider pb-1 border-b border-slate-100">
              <Sliders className="w-3.5 h-3.5 text-blue-600" />
              <span>Report Contents & Options</span>
            </div>

            {/* Checkboxes */}
            <div className="space-y-2.5">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeFixedCostsBreakdown}
                  onChange={(e) => setIncludeFixedCostsBreakdown(e.target.checked)}
                  className="rounded text-blue-600 mt-0.5 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Include Shared Fixed Bills</span>
                  <span className="text-[10px] text-slate-500">Itemized table of house rent, cook, gas, wifi</span>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeBazaarList}
                  onChange={(e) => setIncludeBazaarList(e.target.checked)}
                  className="rounded text-blue-600 mt-0.5 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Include Daily Bazaar Ledger</span>
                  <span className="text-[10px] text-slate-500">{currentMonthBazaars.length} purchases this month</span>
                </div>
              </label>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeMemberSlips}
                  onChange={(e) => setIncludeMemberSlips(e.target.checked)}
                  className="rounded text-blue-600 mt-0.5 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-semibold text-slate-800 block">Include Member Invoice Slips</span>
                  <span className="text-[10px] text-slate-500">Individual slips for notice board or distribution</span>
                </div>
              </label>
            </div>

            {/* Manager info inputs */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block">
                Signatory & Contact Info
              </span>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Manager Name</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="e.g. Huzaifa"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Phone / bKash (Optional)</label>
                <input
                  type="text"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  placeholder="e.g. 01700-000000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Notice / Manager Remarks</label>
                <textarea
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Instructions for boarders..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-blue-500 focus:bg-white leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Quick Action Badges */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-900 space-y-1">
                <span className="font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  Print & PDF Ready
                </span>
                <p className="text-[10px] text-blue-700 leading-normal">
                  Click <strong>Download PDF</strong> for an instant crisp vector document, or <strong>Print / Save as PDF</strong> to print directly on A4 paper.
                </p>
              </div>
            </div>

          </aside>

          {/* Printable Document Preview Container */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-6 flex flex-col items-center print:p-0 print:overflow-visible print:w-full">
            
            {/* View Filter Pills (Hidden in Print) */}
            <div className="w-full max-w-4xl flex items-center justify-between mb-4 print:hidden gap-2">
              <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
                <button
                  onClick={() => setActivePreviewTab('all')}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                    activePreviewTab === 'all' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Full Comprehensive
                </button>
                <button
                  onClick={() => setActivePreviewTab('master')}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                    activePreviewTab === 'master' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Master Sheet
                </button>
                <button
                  onClick={() => setActivePreviewTab('slips')}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                    activePreviewTab === 'slips' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Member Slips
                </button>
                <button
                  onClick={() => setActivePreviewTab('bazaar')}
                  className={`px-3 py-1 rounded-lg cursor-pointer transition-all ${
                    activePreviewTab === 'bazaar' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bazaar Ledger
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hidden sm:block">
                Page Format: A4 Standard (Printable)
              </div>
            </div>

            {/* The Actual Printable Sheet Paper */}
            <div 
              id="printable-report-area"
              className="bg-white text-slate-900 w-full max-w-4xl shadow-md border border-slate-200 p-6 sm:p-10 space-y-7 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none font-sans"
            >
              
              {/* Document Official Header - Clean white background with black text */}
              <div className="border-b-2 border-black pb-5">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-black font-bold border border-black/40 px-2 py-0.5 rounded">
                      Official Monthly Audit Sheet
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-black mt-1">
                      {settings.messName || 'Mess Meal Manager'}
                    </h1>
                    <p className="text-xs font-semibold text-black/80 mt-0.5">
                      Mess Monthly Financial Statement & Audit Report
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs font-mono font-bold text-black border border-black/40 px-3 py-1 rounded-lg inline-block">
                      MONTH: {activeMonthStr.toUpperCase()}
                    </div>
                    <p className="text-[10px] text-black/70 mt-1 font-mono">
                      Issued: {new Date().toLocaleDateString('en-GB')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* 1. EXECUTIVE KPI SUMMARY */}
              {(activePreviewTab === 'all' || activePreviewTab === 'master') && (
                <section className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <Receipt className="w-4 h-4 text-blue-600 print:hidden" />
                    1. Executive Financial Summary
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
                    
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl print:bg-white print:border-slate-300">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Total Consumed Meals</span>
                      <div className="text-base font-bold text-slate-900 mt-0.5">{report.totalMeals.toFixed(1)}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Active Boarders: {activeBoarders.length}</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl print:bg-white print:border-slate-300">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Total Bazaar Cost</span>
                      <div className="text-base font-bold text-slate-900 mt-0.5">৳ {report.totalBazaarCost.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{currentMonthBazaars.length} purchases</div>
                    </div>

                    <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl print:bg-white print:border-slate-300">
                      <span className="text-[10px] uppercase font-bold text-blue-700">Calculated Meal Rate</span>
                      <div className="text-base font-extrabold text-blue-900 mt-0.5">৳ {report.mealRate.toFixed(4)}</div>
                      <div className="text-[10px] text-blue-600 font-mono">Bazaar ÷ Total Meals</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl print:bg-white print:border-slate-300">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Shared Fixed Bills</span>
                      <div className="text-base font-bold text-slate-900 mt-0.5">৳ {report.totalFixedCost.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-400 font-mono">৳ {(report.boardersReport[0]?.fixedCostShare || 0).toFixed(2)} / member</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl print:bg-white print:border-slate-300">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Total Deposits Collected</span>
                      <div className="text-base font-bold text-blue-700 mt-0.5">৳ {report.totalDeposits.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Cash & online deposits</div>
                    </div>

                    <div className={`p-3 rounded-xl border print:bg-white print:border-slate-300 ${
                      netMessBalance >= 0 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}>
                      <span className="text-[10px] uppercase font-bold text-slate-500">Mess Net Balance</span>
                      <div className="text-base font-extrabold mt-0.5">
                        {netMessBalance >= 0 ? '+' : ''}৳ {netMessBalance.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono">
                        {netMessBalance >= 0 ? 'Surplus (Cash in Hand)' : 'Deficit / Shortfall'}
                      </div>
                    </div>

                  </div>
                </section>
              )}

              {/* 2. MASTER BOARDER BALANCE SHEET */}
              {(activePreviewTab === 'all' || activePreviewTab === 'master') && (
                <section className="space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600 print:hidden" />
                      2. Master Boarder Balance Sheet
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">
                      Rate: ৳{report.mealRate.toFixed(4)} • Fixed Share: ৳{(report.boardersReport[0]?.fixedCostShare || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl print:border-slate-300">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-800 text-white uppercase text-[9px] font-bold tracking-wider print:bg-slate-100 print:text-black">
                          <th className="p-2.5 text-center w-8">#</th>
                          <th className="p-2.5">Member Name</th>
                          <th className="p-2.5 text-center">Meals</th>
                          <th className="p-2.5 text-right">Meal Cost (A)</th>
                          <th className="p-2.5 text-right">Bills Share (B)</th>
                          <th className="p-2.5 text-right">Total Due (A+B)</th>
                          <th className="p-2.5 text-right">Deposited</th>
                          <th className="p-2.5 text-right">Closing Balance</th>
                          <th className="p-2.5 text-center w-24">Signature</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                        {report.boardersReport.map((bSum, idx) => {
                          const bDetails = boarders.find(b => b.id === bSum.boarderId);
                          const isSurplus = bSum.balance >= 0;

                          return (
                            <tr key={bSum.boarderId} className="hover:bg-slate-50/50">
                              <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                              <td className="p-2.5 font-bold text-slate-900">
                                <span>{bSum.boarderName}</span>
                                {bDetails?.roomNo && (
                                  <span className="ml-1.5 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-medium">
                                    {bDetails.roomNo}
                                  </span>
                                )}
                                {!bDetails?.isActive && (
                                  <span className="ml-1 text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-mono">INACTIVE</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-semibold">{bSum.totalMeals}</td>
                              <td className="p-2.5 text-right font-mono text-slate-600">৳ {bSum.mealCost.toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono text-slate-600">৳ {bSum.fixedCostShare.toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-slate-900">৳ {bSum.totalCost.toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-blue-700">৳ {bSum.totalDeposit.toFixed(2)}</td>
                              <td className="p-2.5 text-right font-mono font-bold">
                                <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                                  isSurplus 
                                    ? 'text-emerald-700 bg-emerald-50 print:bg-transparent' 
                                    : 'text-rose-700 bg-rose-50 print:bg-transparent'
                                }`}>
                                  {isSurplus ? '+' : ''}৳ {bSum.balance.toFixed(2)} {isSurplus ? '(Refund)' : '(Due)'}
                                </span>
                              </td>
                              <td className="p-2.5 border-l border-slate-100 print:border-slate-300">
                                <div className="h-6 border-b border-dashed border-slate-300 w-full" />
                              </td>
                            </tr>
                          );
                        })}

                        {/* Grand Total Row */}
                        <tr className="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-[11px] print:bg-transparent">
                          <td className="p-2.5 text-center"></td>
                          <td className="p-2.5 text-slate-900 uppercase">Grand Totals</td>
                          <td className="p-2.5 text-center text-slate-900">{report.totalMeals.toFixed(1)}</td>
                          <td className="p-2.5 text-right font-mono text-slate-900">৳ {report.totalBazaarCost.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-mono text-slate-900">৳ {report.totalFixedCost.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-mono text-slate-900">৳ {(report.totalBazaarCost + report.totalFixedCost).toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-mono text-blue-800">৳ {report.totalDeposits.toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-right font-mono">
                            <span className={netMessBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                              {netMessBalance >= 0 ? '+' : ''}৳ {netMessBalance.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-2.5"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 3. FIXED OVERHEAD BILLS ITEMIZED */}
              {includeFixedCostsBreakdown && (activePreviewTab === 'all' || activePreviewTab === 'master') && (
                <section className="space-y-3 print:break-inside-avoid">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                    <Building2 className="w-4 h-4 text-blue-600 print:hidden" />
                    3. Shared Fixed Bills Itemized Breakdown
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="text-[10px] text-slate-500">House / Room Rent</div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">৳ {miscCosts.houseRent.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="text-[10px] text-slate-500">Cooker / Maid Salary</div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">৳ {miscCosts.cookerBill.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="text-[10px] text-slate-500">Gas Cylinder & Supply</div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">৳ {miscCosts.gasBill.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="text-[10px] text-slate-500">Electricity & Utilities</div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">৳ {miscCosts.utilityBill.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="text-[10px] text-slate-500">WiFi & Internet</div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">৳ {miscCosts.wifiBill.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <div className="text-[10px] text-slate-500">Other / Cleaning / Misc</div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">৳ {miscCosts.otherCosts.toLocaleString('en-IN')}</div>
                    </div>
                    {miscCosts.customBills?.map((cb) => (
                      <div key={cb.id} className="bg-blue-50/50 border border-blue-200/70 p-2.5 rounded-lg">
                        <div className="text-[10px] text-blue-700 font-semibold truncate" title={cb.name}>{cb.name}</div>
                        <div className="font-bold text-slate-800 font-mono mt-0.5">৳ {Number(cb.amount).toLocaleString('en-IN')}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex justify-between items-center">
                    <span>
                      Total Fixed Overhead: <strong>৳ {report.totalFixedCost.toLocaleString('en-IN')}</strong> divided by <strong>{activeBoarders.length} active boarders</strong>
                    </span>
                    <span className="font-bold text-slate-900 font-mono">
                      = ৳ {(report.boardersReport[0]?.fixedCostShare || 0).toFixed(2)} / member
                    </span>
                  </div>
                </section>
              )}

              {/* 4. DAILY BAZAAR LOG TABLE */}
              {includeBazaarList && currentMonthBazaars.length > 0 && (activePreviewTab === 'all' || activePreviewTab === 'bazaar') && (
                <section className="space-y-3 print:break-inside-avoid">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-blue-600 print:hidden" />
                      4. Daily Bazaar & Expense Ledger ({activeMonthStr})
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">
                      Total: ৳ {report.totalBazaarCost.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 uppercase text-[9px] font-bold tracking-wider">
                          <th className="p-2 text-center w-8">#</th>
                          <th className="p-2 w-28">Date</th>
                          <th className="p-2">Items / Description</th>
                          <th className="p-2 w-32">Shopper</th>
                          <th className="p-2 text-right w-28">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentMonthBazaars
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((bazaar, idx) => {
                            const buyer = boarders.find(b => b.id === bazaar.spentById)?.name || 'Manager';
                            return (
                              <tr key={bazaar.id} className="hover:bg-slate-50/50">
                                <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                <td className="p-2 font-mono text-slate-600">{formatReadableDate(bazaar.date)}</td>
                                <td className="p-2 font-medium text-slate-800">{bazaar.description}</td>
                                <td className="p-2 text-slate-600">{buyer}</td>
                                <td className="p-2 text-right font-mono font-bold text-slate-900">
                                  ৳ {bazaar.amount.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                        <tr className="bg-slate-50 font-bold border-t border-slate-200 text-[11px]">
                          <td colSpan={4} className="p-2 text-right uppercase text-slate-700">Total Month Bazaar:</td>
                          <td className="p-2 text-right font-mono text-slate-900">৳ {report.totalBazaarCost.toLocaleString('en-IN')}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* 5. INDIVIDUAL MEMBER INVOICE SLIPS */}
              {includeMemberSlips && (activePreviewTab === 'all' || activePreviewTab === 'slips') && (
                <section className="space-y-3 print:break-before-page">
                  <div className="border-b border-slate-200 pb-1.5 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-blue-600 print:hidden" />
                      5. Individual Member Invoice Slips
                    </h3>
                    <span className="text-[10px] text-slate-400">Cut along dotted borders</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {report.boardersReport.map((bSum) => {
                      const bDetails = boarders.find(b => b.id === bSum.boarderId);
                      const roomNo = bDetails?.roomNo || bSum.roomNo;
                      const isSurplus = bSum.balance >= 0;

                      return (
                        <div 
                          key={bSum.boarderId}
                          className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3 print:break-inside-avoid print:bg-white print:border-slate-400"
                        >
                          <div>
                            <div className="flex justify-between items-start border-b border-slate-200 pb-2">
                              <div>
                                <h4 className="font-bold text-xs text-slate-900">{settings.messName || 'Mess'}</h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[9px] font-mono text-slate-400 uppercase">Monthly Invoice Voucher • {report.month}</span>
                                  {roomNo && (
                                    <span className="text-[9px] bg-blue-50 text-blue-700 font-mono font-bold px-1.5 py-0.2 rounded border border-blue-200">
                                      {roomNo}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                                isSurplus ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isSurplus ? 'REFUNDABLE' : 'DUE TO PAY'}
                              </span>
                            </div>

                            <div className="mt-2 text-xs space-y-1">
                              <div className="flex justify-between items-center font-bold text-slate-800">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>Member: {bSum.boarderName}</span>
                                  {roomNo && (
                                    <span className="text-[9px] bg-slate-200/90 text-slate-700 px-1.5 py-0.2 rounded font-mono font-medium">
                                      {roomNo}
                                    </span>
                                  )}
                                </div>
                                {bDetails?.phone && <span className="text-slate-500 font-mono text-[10px]">Ph: {bDetails.phone}</span>}
                              </div>
                              <div className="flex justify-between text-slate-600 text-[11px] pt-1">
                                <span>Meals: {bSum.totalMeals} × ৳{report.mealRate.toFixed(2)}</span>
                                <span className="font-mono">৳ {bSum.mealCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600 text-[11px]">
                                <span>Shared Fixed Bills:</span>
                                <span className="font-mono">৳ {bSum.fixedCostShare.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-semibold text-slate-900 text-[11px] border-t border-slate-200/60 pt-1">
                                <span>Total Charged:</span>
                                <span className="font-mono">৳ {bSum.totalCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-blue-700 font-semibold text-[11px]">
                                <span>Total Deposited:</span>
                                <span className="font-mono">৳ {bSum.totalDeposit.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-200">
                            <div className={`p-2 rounded-lg flex justify-between items-center text-xs font-bold ${
                              isSurplus ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'
                            }`}>
                              <span>{isSurplus ? 'Closing Refund:' : 'Outstanding Due:'}</span>
                              <span className="font-mono text-sm">৳ {Math.abs(bSum.balance).toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between text-[8px] text-slate-400 font-bold mt-3 pt-1">
                              <span className="border-t border-slate-300 w-20 text-center pt-0.5">Boarder Signature</span>
                              <span className="border-t border-slate-300 w-20 text-center pt-0.5">Manager Signature</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Notice & Signatures */}
              <div className="space-y-6 pt-3 border-t border-slate-200 print:break-inside-avoid">
                {customNotes && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700">
                    <span className="font-bold block text-[11px] text-slate-900 mb-0.5">Important Manager Notice:</span>
                    <p className="leading-relaxed text-slate-600">{customNotes}</p>
                  </div>
                )}

                <div className="flex justify-between items-end pt-8 text-xs text-slate-700">
                  <div className="text-center w-48">
                    <div className="border-t border-slate-400 pt-1 font-bold text-slate-900">
                      {managerName} {managerPhone ? `(${managerPhone})` : ''}
                    </div>
                    <div className="text-[10px] text-slate-400">Mess Manager / Authorizer</div>
                  </div>

                  <div className="text-center w-48">
                    <div className="border-t border-slate-400 pt-1 font-bold text-slate-900">
                      Auditor / Representative
                    </div>
                    <div className="text-[10px] text-slate-400">Boarder Audit Committee</div>
                  </div>
                </div>
              </div>

            </div>

          </main>

        </div>

      </div>

    </div>
  );
}
