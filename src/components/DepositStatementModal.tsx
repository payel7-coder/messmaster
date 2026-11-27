import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  Printer,
  Copy,
  CheckCircle2,
  Search,
  Receipt,
  CreditCard
} from 'lucide-react';
import { Boarder, Deposit, MessSettings, MonthReport } from '../types';
import { compareBoardersByRoom, formatReadableDate, formatReadableMonth } from '../utils';
import { generateBoardersDepositStatementPdf } from '../utils/pdfGenerator';

interface DepositStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  boarders: Boarder[];
  deposits: Deposit[];
  settings: MessSettings;
  report?: MonthReport;
}

export default function DepositStatementModal({
  isOpen,
  onClose,
  boarders,
  deposits,
  settings,
  report,
}: DepositStatementModalProps) {
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [sortBy, setSortBy] = useState<'room' | 'name' | 'amount'>('room');
  const [includeInactive, setIncludeInactive] = useState(true);
  const [includeBalanceSummary, setIncludeBalanceSummary] = useState(true);
  const [includeTransactionLog, setIncludeTransactionLog] = useState(true);
  const [managerName, setManagerName] = useState(settings.currentManagerName || 'Mess Manager');
  const [managerPhone, setManagerPhone] = useState(settings.currentManagerPhone || '');
  const [customNotes, setCustomNotes] = useState(
    'Verified deposit collection register. Please report any discrepancy within 3 days of publication.'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const activeMonthStr = formatReadableMonth(settings.currentMonth);

  const scopedDeposits = useMemo(() => {
    return (scope === 'all'
      ? [...deposits]
      : deposits.filter(d => d.date.startsWith(settings.currentMonth))
    ).sort((a, b) => b.date.localeCompare(a.date));
  }, [deposits, scope, settings.currentMonth]);

  const depositsByBoarder = useMemo(() => {
    const map: Record<string, Deposit[]> = {};
    scopedDeposits.forEach(d => {
      if (!map[d.boarderId]) map[d.boarderId] = [];
      map[d.boarderId].push(d);
    });
    return map;
  }, [scopedDeposits]);

  const boarderTotals = useMemo(() => {
    const map: Record<string, number> = {};
    boarders.forEach(b => {
      map[b.id] = (depositsByBoarder[b.id] || []).reduce((sum, d) => sum + d.amount, 0);
    });
    return map;
  }, [boarders, depositsByBoarder]);

  const filteredBoarders = useMemo(() => {
    let list = includeInactive ? [...boarders] : boarders.filter(b => b.isActive);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => {
        const bDeps = depositsByBoarder[b.id] || [];
        const noteMatch = bDeps.some(d => d.note?.toLowerCase().includes(q));
        return (
          b.name.toLowerCase().includes(q) ||
          (b.roomNo && b.roomNo.toLowerCase().includes(q)) ||
          (b.phone && b.phone.includes(q)) ||
          noteMatch
        );
      });
    }
    return list.sort((a, b) => {
      if (sortBy === 'amount') {
        const diff = (boarderTotals[b.id] || 0) - (boarderTotals[a.id] || 0);
        if (diff !== 0) return diff;
        return compareBoardersByRoom(a, b);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return compareBoardersByRoom(a, b);
    });
  }, [boarders, includeInactive, searchQuery, sortBy, depositsByBoarder, boarderTotals]);

  const includedIds = useMemo(() => new Set(filteredBoarders.map(b => b.id)), [filteredBoarders]);

  const visibleTransactions = useMemo(() => {
    return scopedDeposits.filter(d => includedIds.has(d.boarderId));
  }, [scopedDeposits, includedIds]);

  const grandTotalCollected = useMemo(() => {
    return filteredBoarders.reduce((sum, b) => sum + (boarderTotals[b.id] || 0), 0);
  }, [filteredBoarders, boarderTotals]);

  const contributorsCount = useMemo(() => {
    return filteredBoarders.filter(b => (boarderTotals[b.id] || 0) > 0).length;
  }, [filteredBoarders, boarderTotals]);

  if (!isOpen) return null;

  const showBalanceCol = Boolean(includeBalanceSummary && scope === 'month' && report);

  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      const doc = generateBoardersDepositStatementPdf(
        boarders,
        deposits,
        settings,
        report,
        {
          scope,
          includeInactive,
          includeBalanceSummary,
          includeTransactionLog,
          sortBy,
          managerName,
          managerPhone,
          customNotes,
        }
      );
      const cleanMessName = (settings.messName || 'Mess').replace(/[^a-zA-Z0-9]/g, '_');
      const scopeSuffix = scope === 'all' ? 'All_Months' : settings.currentMonth;
      doc.save(`${cleanMessName}_Deposit_Statement_${scopeSuffix}.pdf`);
    } catch (err) {
      console.error('Error generating deposit statement PDF:', err);
      alert('Could not download Deposit Statement PDF. You can use the Print button instead.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCopyWhatsApp = () => {
    let msg = `💳 *${settings.messName || 'Mess'} - Deposit Statement*\n`;
    msg += `📅 *Period:* ${scope === 'all' ? 'All Recorded Months' : activeMonthStr}\n`;
    msg += `💰 *Total Collected:* ৳${grandTotalCollected.toLocaleString('en-IN')} (${contributorsCount}/${filteredBoarders.length} boarders)\n`;
    msg += `------------------------------------\n`;

    filteredBoarders.forEach((b, idx) => {
      const total = boarderTotals[b.id] || 0;
      const roomTag = b.roomNo ? `[${b.roomNo}] ` : '';
      const count = (depositsByBoarder[b.id] || []).length;
      msg += `${idx + 1}. ${roomTag}*${b.name}*: ৳${total.toLocaleString('en-IN')} (${count} ${count === 1 ? 'entry' : 'entries'})`;
      if (showBalanceCol && report) {
        const bSum = report.boardersReport.find(r => r.boarderId === b.id);
        if (bSum) {
          msg += ` · ${bSum.balance >= 0 ? 'Surplus' : 'Due'} ৳${Math.abs(bSum.balance).toFixed(0)}`;
        }
      }
      msg += `\n`;
    });

    if (managerName) {
      msg += `\n✍️ *Manager:* ${managerName}${managerPhone ? ` (${managerPhone})` : ''}`;
    }

    navigator.clipboard?.writeText(msg).then(() => {
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 3000);
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 py-6 sm:py-8 print:p-0 print:bg-white print:static print:overflow-visible animate-fadeIn">
      <div className="bg-white w-full max-w-6xl my-auto rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] sm:max-h-[94vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Top Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">
                  All Boarders Deposit Statement (PDF Export)
                </h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                  {scope === 'all' ? 'All Months' : activeMonthStr}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                  Portrait A4
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Member-wise deposit summary and chronological collection register for all boarders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              id="btn-modal-download-deposit-pdf"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating...' : 'Download Deposit PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              id="btn-modal-print-deposit-statement"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors border border-slate-700 whitespace-nowrap shrink-0"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={handleCopyWhatsApp}
              id="btn-modal-whatsapp-deposit-statement"
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-xl cursor-pointer transition-colors border border-slate-700 whitespace-nowrap shrink-0"
            >
              {copiedWhatsApp ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden md:inline">WhatsApp</span>
                </>
              )}
            </button>

            <div className="h-5 w-px bg-slate-700 mx-1" />

            <button
              type="button"
              onClick={onClose}
              id="btn-close-deposit-statement-modal"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Options Toolbar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter name, room, or note..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="md:col-span-5 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setScope('month')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    scope === 'month' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                    scope === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Months
                </button>
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-slate-500 font-medium">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'room' | 'name' | 'amount')}
                  className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="room">Room No.</option>
                  <option value="name">Name (A–Z)</option>
                  <option value="amount">Highest Deposit</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Inactive
              </label>

              {scope === 'month' && report && (
                <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBalanceSummary}
                    onChange={(e) => setIncludeBalanceSummary(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Net Balance
                </label>
              )}

              <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTransactionLog}
                  onChange={(e) => setIncludeTransactionLog(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Tx Log
              </label>
            </div>

            <div className="md:col-span-4 flex items-center gap-2">
              <input
                type="text"
                placeholder="Manager Name"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Phone (optional)"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                className="w-1/2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Document Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100/60 print:bg-white print:p-0">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 max-w-4xl mx-auto space-y-6 print:border-none print:shadow-none print:p-0">
            
            {/* Document Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 gap-3">
              <div>
                <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
                  {settings.messName || 'Mess'}
                </h1>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mt-0.5">
                  ALL BOARDERS DEPOSIT STATEMENT & COLLECTION REGISTER · {scope === 'all' ? 'ALL MONTHS' : activeMonthStr.toUpperCase()}
                </p>
              </div>
              <div className="text-xs font-mono text-slate-500">
                {filteredBoarders.length} Boarders · {visibleTransactions.length} Entries
              </div>
            </div>

            {/* 4 Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Collected</span>
                <span className="text-base font-bold text-blue-700 font-mono tabular-nums">
                  ৳ {grandTotalCollected.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Boarders</span>
                <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                  {filteredBoarders.length}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Transactions</span>
                <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                  {visibleTransactions.length}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Paid Members</span>
                <span className="text-base font-bold text-emerald-700 font-mono tabular-nums">
                  {contributorsCount} / {filteredBoarders.length}
                </span>
              </div>
            </div>

            {/* Section 1: Member-Wise Deposit Summary */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                1. Boarder-Wise Deposit Summary
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider">
                      <th className="py-2.5 px-2.5 text-center w-9">#</th>
                      <th className="py-2.5 px-2.5 text-center w-20">Room</th>
                      <th className="py-2.5 px-3">Boarder Name</th>
                      <th className="py-2.5 px-2.5 text-center w-16">Entries</th>
                      <th className="py-2.5 px-3">Payment Breakdown</th>
                      <th className="py-2.5 px-3 text-right">Deposited (৳)</th>
                      {showBalanceCol && (
                        <th className="py-2.5 px-3 text-right">Net Balance</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBoarders.length === 0 ? (
                      <tr>
                        <td colSpan={showBalanceCol ? 7 : 6} className="py-6 text-center text-slate-400">
                          No boarders matched your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredBoarders.map((b, idx) => {
                        const bDeps = depositsByBoarder[b.id] || [];
                        const totalDep = boarderTotals[b.id] || 0;
                        const bSum = showBalanceCol && report
                          ? report.boardersReport.find(r => r.boarderId === b.id)
                          : undefined;
                        return (
                          <tr key={b.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="py-2 px-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-2 px-2.5 text-center font-mono font-bold text-blue-700 whitespace-nowrap">
                              {b.roomNo || '—'}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                              {b.name}
                              {!b.isActive && (
                                <span className="ml-1.5 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-normal">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-center font-mono tabular-nums text-slate-600">
                              {bDeps.length}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-slate-600">
                              {bDeps.length === 0 ? (
                                <span className="text-slate-400 italic">No deposits recorded</span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {bDeps.map(d => (
                                    <span
                                      key={d.id}
                                      className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded font-mono text-[10px]"
                                    >
                                      <span className="text-slate-500">{d.date.slice(5)}</span>
                                      <span className="font-bold text-slate-800">৳{d.amount}</span>
                                      {d.note && <span className="text-slate-500 font-sans">({d.note})</span>}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono tabular-nums font-bold ${
                              totalDep > 0 ? 'text-blue-700' : 'text-slate-400'
                            }`}>
                              ৳ {totalDep.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {showBalanceCol && (
                              <td className={`py-2 px-3 text-right font-mono tabular-nums font-bold ${
                                !bSum ? 'text-slate-400' : bSum.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                                {bSum ? `${bSum.balance >= 0 ? '+' : '-'}৳${Math.abs(bSum.balance).toFixed(0)}` : '—'}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={3} className="py-2.5 px-3 uppercase text-[11px] tracking-wider">
                        Total Collected
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-mono tabular-nums">
                        {visibleTransactions.length}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-medium text-slate-600">
                        {contributorsCount} of {filteredBoarders.length} members deposited
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-blue-700">
                        ৳ {grandTotalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {showBalanceCol && <td className="py-2.5 px-3" />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Section 2: Chronological Transaction Log */}
            {includeTransactionLog && visibleTransactions.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2.5">
                  2. Chronological Deposit Transaction Log
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-700 text-white text-[10px] uppercase tracking-wider">
                        <th className="py-2 px-2.5 text-center w-9">#</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-2.5 text-center">Room</th>
                        <th className="py-2 px-3">Boarder Name</th>
                        <th className="py-2 px-3">Method / Note</th>
                        <th className="py-2 px-3 text-right">Amount (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleTransactions.map((dep, idx) => {
                        const b = boarders.find(m => m.id === dep.boarderId);
                        return (
                          <tr key={dep.id} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                            <td className="py-1.5 px-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-1.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                              {formatReadableDate(dep.date)}
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-mono font-bold text-blue-700 whitespace-nowrap">
                              {b?.roomNo || '—'}
                            </td>
                            <td className="py-1.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {b?.name || 'Unknown Boarder'}
                            </td>
                            <td className="py-1.5 px-3 text-slate-600">
                              {dep.note || 'Regular cash deposit'}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              ৳ {dep.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes & Signature Footer */}
            <div className="pt-4 border-t border-slate-200 space-y-5">
              <div className="print:hidden">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Footer Note on PDF
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="border-t border-slate-400 pt-2 text-left">
                  <p className="text-xs font-bold text-slate-900">
                    Mess Manager: {managerName} {managerPhone ? `(${managerPhone})` : ''}
                  </p>
                  <p className="text-[10px] text-slate-500">Authorized Signature & Mess Seal</p>
                </div>
                <div className="border-t border-slate-400 pt-2 text-right">
                  <p className="text-xs font-bold text-slate-900">Cashier / Audit Verification</p>
                  <p className="text-[10px] text-slate-500">Verification Signature</p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
