import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  FileSpreadsheet, 
  CheckCircle2, 
  Copy, 
  Sliders, 
  Eye, 
  Search,
  Calendar,
  Utensils,
  UserCheck
} from 'lucide-react';
import { Boarder, DailyMealLog, MessSettings, MonthReport } from '../types';
import { formatReadableMonth } from '../utils';
import { generateBoardersMealSheetPdf } from '../utils/pdfGenerator';

interface BoarderMealSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  boarders: Boarder[];
  mealLogs: DailyMealLog[];
  settings: MessSettings;
  report?: MonthReport;
}

export default function BoarderMealSheetModal({
  isOpen,
  onClose,
  boarders,
  mealLogs,
  settings,
  report,
}: BoarderMealSheetModalProps) {
  // Configuration Options
  const [includeInactive, setIncludeInactive] = useState(true);
  const [includeMealCost, setIncludeMealCost] = useState(true);
  const [managerName, setManagerName] = useState('Mess Manager');
  const [managerPhone, setManagerPhone] = useState('');
  const [customNotes, setCustomNotes] = useState(
    '1 = Single Meal, 2 = Double Meals, 2.5 = Full Day (0.5 Breakfast + 1 Lunch + 1 Dinner), - = Meal Off. Verify before month closing.'
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Compute days in active month
  const [yearStr, monthStr] = settings.currentMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dayNumbers = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    return list;
  }, [daysInMonth]);

  const dateStrings = useMemo(() => {
    return dayNumbers.map(d => `${settings.currentMonth}-${d < 10 ? '0' + d : d}`);
  }, [dayNumbers, settings.currentMonth]);

  // Filter and sort boarders
  const filteredBoarders = useMemo(() => {
    let list = includeInactive ? [...boarders] : boarders.filter(b => b.isActive);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => b.name.toLowerCase().includes(q) || (b.phone && b.phone.includes(q)));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [boarders, includeInactive, searchQuery]);

  // Precompute totals
  const mealRate = report?.mealRate || 0;

  const boarderTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    boarders.forEach(b => {
      let sum = 0;
      dateStrings.forEach(date => {
        const log = mealLogs.find(l => l.date === date);
        sum += log?.meals[b.id] ?? 0;
      });
      totals[b.id] = sum;
    });
    return totals;
  }, [boarders, dateStrings, mealLogs]);

  const dailyTotals = useMemo(() => {
    return dateStrings.map(date => {
      const log = mealLogs.find(l => l.date === date);
      if (!log) return 0;
      return filteredBoarders.reduce((sum, b) => sum + (log.meals[b.id] ?? 0), 0);
    });
  }, [dateStrings, filteredBoarders, mealLogs]);

  const grandTotalMeals = useMemo(() => {
    return filteredBoarders.reduce((acc, b) => acc + (boarderTotals[b.id] || 0), 0);
  }, [filteredBoarders, boarderTotals]);

  const daysWithNotes = useMemo(() => {
    return dateStrings
      .map((dateStr, idx) => {
        const log = mealLogs.find(l => l.date === dateStr);
        if (log?.note?.trim()) {
          return { day: dayNumbers[idx], note: log.note.trim() };
        }
        return null;
      })
      .filter((item): item is { day: number; note: string } => item !== null);
  }, [dateStrings, dayNumbers, mealLogs]);

  if (!isOpen) return null;

  const activeMonthStr = formatReadableMonth(settings.currentMonth);

  // Generate & Download PDF
  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      const doc = generateBoardersMealSheetPdf(
        boarders,
        mealLogs,
        settings,
        report,
        {
          includeInactive,
          includeMealCost,
          managerName,
          managerPhone,
          customNotes,
        }
      );

      const cleanMessName = (settings.messName || 'Mess').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanMessName}_Boarders_Meal_Sheet_${settings.currentMonth}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Error generating meal sheet PDF:', err);
      alert('Could not download PDF directly. You can use the Direct Print button as an alternative.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Direct Print
  const handleNativePrint = () => {
    window.print();
  };

  // Copy WhatsApp summary message
  const handleCopyWhatsApp = () => {
    let msg = `🍛 *${settings.messName || 'Mess'} - Boarders Meal Sheet*\n`;
    msg += `📅 *Month:* ${activeMonthStr}\n`;
    msg += `👥 *Total Boarders:* ${filteredBoarders.length} | *Total Meals:* ${grandTotalMeals.toFixed(1)}\n`;
    if (mealRate > 0) {
      msg += `💰 *Meal Rate:* ৳${mealRate.toFixed(4)} / meal\n`;
    }
    msg += `------------------------------------\n`;
    msg += `*Boarder Monthly Consumption:*\n`;

    filteredBoarders.forEach((b, idx) => {
      const total = boarderTotals[b.id] || 0;
      const cost = total * mealRate;
      msg += `${idx + 1}. *${b.name}* (${b.isActive ? 'Active' : 'Inactive'}): ${total.toFixed(1)} meals`;
      if (mealRate > 0 && includeMealCost) {
        msg += ` = ৳${cost.toFixed(2)}`;
      }
      msg += `\n`;
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static print:overflow-visible animate-fadeIn">
      
      {/* Modal Dialog Box */}
      <div className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] print:max-h-none print:border-none print:shadow-none print:rounded-none">
        
        {/* Top Header Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Boarder Meal Attendance Sheet (PDF Export)
                </h2>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                  {activeMonthStr}
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                  Landscape A4
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Full 1–{daysInMonth} daily matrix sheet of all boarders for notice board posting and physical verification.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              id="btn-modal-download-meal-sheet-pdf"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl cursor-pointer transition-all shadow-xs shadow-blue-500/30 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating...' : 'Download Meal Sheet PDF'}</span>
            </button>

            <button
              onClick={handleNativePrint}
              id="btn-modal-print-meal-sheet"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs px-3.5 py-2 rounded-xl cursor-pointer transition-colors border border-slate-700"
              title="Print directly or save as PDF via system dialog"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={handleCopyWhatsApp}
              id="btn-modal-whatsapp-meal-sheet"
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-xl cursor-pointer transition-colors border border-slate-700"
              title="Copy text summary for WhatsApp"
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
              onClick={onClose}
              id="btn-close-meal-sheet-modal"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Options Bar (Hidden in print) */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
            
            {/* Search Box */}
            <div className="md:col-span-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter boarders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Checkbox Toggles */}
            <div className="md:col-span-4 flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMealCost}
                  onChange={(e) => setIncludeMealCost(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Show Meal Cost Column
              </label>

              <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Include Inactive Boarders
              </label>
            </div>

            {/* Manager Name & Phone */}
            <div className="md:col-span-3 flex items-center gap-2">
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

            {/* Quick KPI count badge */}
            <div className="md:col-span-2 text-right">
              <span className="text-[11px] font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {filteredBoarders.length} Boarders • {grandTotalMeals.toFixed(1)} Meals
              </span>
            </div>

          </div>
        </div>

        {/* Modal Body: Scrollable Matrix Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100/50 print:bg-white print:p-0">
          
          {/* Printable Container (A4 Landscape aspect) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 max-w-full overflow-hidden print:border-none print:shadow-none print:p-0">
            
            {/* Sheet Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-4 mb-4 gap-3">
              <div>
                <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
                  {settings.messName || 'Mess'}
                </h1>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mt-0.5">
                  MONTHLY BOARDER MEAL ATTENDANCE & CONSUMPTION REGISTER - {activeMonthStr}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Official Record • DUET / University Dormitory Mess System Standard
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Total Meals</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{grandTotalMeals.toFixed(1)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Meal Rate</span>
                  <span className="text-sm font-bold text-blue-600 font-mono">
                    {mealRate > 0 ? `৳${mealRate.toFixed(4)}` : 'Pending'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-right">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Daily Average</span>
                  <span className="text-sm font-bold text-slate-700 font-mono">
                    {(grandTotalMeals / daysInMonth).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive & Printable Table Matrix */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
              <table className="w-full text-center border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-800 text-white font-bold text-[10px] divide-x divide-slate-700">
                    <th className="py-2.5 px-2 w-8 text-center sticky left-0 z-20 bg-slate-800">#</th>
                    <th className="py-2.5 px-3 text-left w-40 sticky left-8 z-20 bg-slate-800 shadow-sm">
                      Boarder Name
                    </th>
                    {dayNumbers.map(d => {
                      const dayDateStr = `${settings.currentMonth}-${d < 10 ? '0' + d : d}`;
                      const dayLog = mealLogs.find(l => l.date === dayDateStr);
                      return (
                        <th 
                          key={d} 
                          title={dayLog?.note ? `Day ${d}: ${dayLog.note}` : `Day ${d}`}
                          className={`py-2 px-1 min-w-[28px] max-w-[34px] font-mono cursor-default ${
                            dayLog?.note ? 'bg-slate-700 text-amber-300 font-bold' : ''
                          }`}
                        >
                          <div>{d}</div>
                          {dayLog?.note && (
                            <span className="block w-1 h-1 bg-amber-400 rounded-full mx-auto mt-0.5" />
                          )}
                        </th>
                      );
                    })}
                    <th className="py-2.5 px-2 min-w-[50px] bg-slate-900 text-amber-300 font-mono font-bold">
                      Total
                    </th>
                    {includeMealCost && (
                      <th className="py-2.5 px-2.5 min-w-[70px] bg-slate-900 text-emerald-300 font-mono font-bold text-right">
                        Cost (৳)
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredBoarders.length === 0 ? (
                    <tr>
                      <td colSpan={dayNumbers.length + (includeMealCost ? 4 : 3)} className="py-8 text-center text-slate-400 text-xs">
                        No boarders matched the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBoarders.map((b, idx) => {
                      const bTotal = boarderTotals[b.id] || 0;
                      const bCost = bTotal * mealRate;
                      return (
                        <tr 
                          key={b.id} 
                          className={`hover:bg-blue-50/50 transition-colors divide-x divide-slate-100 ${
                            idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                          }`}
                        >
                          <td className="py-1.5 px-1 text-slate-400 text-center font-mono text-[10px] sticky left-0 bg-inherit z-10">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-3 text-left font-medium text-slate-900 sticky left-8 bg-inherit z-10 shadow-xs whitespace-nowrap">
                            <span className="truncate max-w-[130px] inline-block align-middle font-semibold">
                              {b.name}
                            </span>
                            {b.roomNo && (
                              <span className="ml-1 text-[9px] text-slate-500 font-mono font-normal">
                                ({b.roomNo})
                              </span>
                            )}
                            {!b.isActive && (
                              <span className="ml-1.5 text-[9px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-normal">
                                Inact.
                              </span>
                            )}
                          </td>

                          {dateStrings.map(date => {
                            const log = mealLogs.find(l => l.date === date);
                            const count = log?.meals[b.id] ?? 0;
                            return (
                              <td 
                                key={date} 
                                className={`py-1.5 px-1 font-mono text-[10.5px] ${
                                  count === 0 
                                    ? 'text-slate-300' 
                                    : count >= 2.5 
                                      ? 'text-blue-700 font-bold bg-blue-50/30' 
                                      : 'text-slate-800'
                                }`}
                              >
                                {count === 0 ? '-' : (count % 1 === 0 ? count : count.toFixed(1))}
                              </td>
                            );
                          })}

                          <td className="py-1.5 px-2 font-mono font-bold text-slate-900 bg-slate-100/60">
                            {bTotal % 1 === 0 ? bTotal : bTotal.toFixed(1)}
                          </td>

                          {includeMealCost && (
                            <td className="py-1.5 px-2.5 font-mono font-bold text-right text-slate-900 bg-slate-100/60">
                              {bCost > 0 ? bCost.toFixed(2) : '0.00'}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Footer Totals Row */}
                <tfoot>
                  <tr className="bg-slate-100 text-slate-900 font-bold border-t-2 border-slate-300 divide-x divide-slate-200">
                    <td colSpan={2} className="py-2.5 px-3 text-left uppercase text-[10px] tracking-wider sticky left-0 z-10 bg-slate-100 shadow-xs">
                      Daily Total Meals
                    </td>
                    {dailyTotals.map((dayTotal, i) => (
                      <td key={i} className="py-2 px-1 font-mono text-[10.5px] text-blue-900">
                        {dayTotal === 0 ? '-' : (dayTotal % 1 === 0 ? dayTotal : dayTotal.toFixed(1))}
                      </td>
                    ))}
                    <td className="py-2.5 px-2 font-mono font-extrabold text-blue-700 bg-blue-50">
                      {grandTotalMeals % 1 === 0 ? grandTotalMeals : grandTotalMeals.toFixed(1)}
                    </td>
                    {includeMealCost && (
                      <td className="py-2.5 px-2.5 font-mono font-extrabold text-right text-blue-700 bg-blue-50">
                        {(grandTotalMeals * mealRate).toFixed(2)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer Notice & Signatures */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              {daysWithNotes.length > 0 && (
                <div className="mb-3 p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg text-[10.5px]">
                  <span className="font-bold text-amber-900 block sm:inline mr-2">Special Meal Notes:</span>
                  <div className="inline-flex flex-wrap gap-1.5 mt-1 sm:mt-0">
                    {daysWithNotes.map((item) => (
                      <span key={item.day} className="bg-white border border-amber-300 text-amber-800 px-2 py-0.5 rounded font-medium">
                        Day {item.day}: {item.note}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {customNotes && (
                <div className="mb-6 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[10.5px] text-slate-600">
                  <span className="font-bold text-slate-800">Instructions: </span>
                  {customNotes}
                </div>
              )}

              <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="border-t border-slate-400 pt-2 text-left">
                  <p className="text-xs font-bold text-slate-900">
                    Mess Manager: {managerName} {managerPhone ? `(${managerPhone})` : ''}
                  </p>
                  <p className="text-[10px] text-slate-500">Authorized Signature & Mess Seal</p>
                </div>
                <div className="border-t border-slate-400 pt-2 text-right">
                  <p className="text-xs font-bold text-slate-900">Boarder Representative / Dining Secretary</p>
                  <p className="text-[10px] text-slate-500">Audit & Verification Signature</p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Modal Bottom Actions Footer (Hidden in print) */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between print:hidden">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>Vector PDF prints crisp on Landscape A4 paper or legal notice boards.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              id="btn-footer-download-pdf"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs shadow-blue-200"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Meal Sheet PDF'}</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
