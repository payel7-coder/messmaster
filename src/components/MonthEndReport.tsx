import React, { useRef, useState } from 'react';
import { 
  Printer, 
  Download, 
  Upload, 
  Trash2, 
  FileSpreadsheet, 
  FileText, 
  TrendingUp, 
  PlusCircle, 
  DollarSign, 
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Calculator,
  Lock,
  Sparkles,
  ArrowRightLeft,
  History,
  CalendarCheck
} from 'lucide-react';
import { Boarder, Deposit, DailyMealLog, BazaarCost, MiscellaneousCosts, MessSettings, MonthReport } from '../types';
import { formatReadableMonth } from '../utils';
import PrintablePdfReportModal from './PrintablePdfReportModal';
import BoarderMealSheetModal from './BoarderMealSheetModal';
import { generateMonthlyReportPdf } from '../utils/pdfGenerator';

interface MonthEndReportProps {
  report: MonthReport;
  boarders: Boarder[];
  deposits: Deposit[];
  mealLogs: DailyMealLog[];
  bazaarCosts: BazaarCost[];
  miscCosts: MiscellaneousCosts;
  settings: MessSettings;
  onClearData: () => void;
  onSimulateData: () => void;
  onImportBackup: (importedState: any) => void;
  isManager?: boolean;
  onRequireManagerLogin?: () => void;
  onOpenHandoverModal?: () => void;
  onSelectMonth?: (month: string) => void;
}

export default function MonthEndReport({
  report,
  boarders,
  deposits,
  mealLogs,
  bazaarCosts,
  miscCosts,
  settings,
  onClearData,
  onSimulateData,
  onImportBackup,
  isManager = false,
  onRequireManagerLogin,
  onOpenHandoverModal,
  onSelectMonth,
}: MonthEndReportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showMealSheetModal, setShowMealSheetModal] = useState(false);
  const hasSpecialFeast = (report.totalSpecialMealCost || 0) > 0;

  // State for tracking which boarders' step-by-step calculations are expanded
  const [expandedBoarders, setExpandedBoarders] = useState<Record<string, boolean>>({});

  // Toggle all calculations
  const toggleAllCalculations = () => {
    const allExpanded = report.boardersReport.length > 0 && report.boardersReport.every(b => expandedBoarders[b.boarderId]);
    const nextState: Record<string, boolean> = {};
    report.boardersReport.forEach(b => {
      nextState[b.boarderId] = !allExpanded;
    });
    setExpandedBoarders(nextState);
  };

  const isAllExpanded = report.boardersReport.length > 0 && report.boardersReport.every(b => expandedBoarders[b.boarderId]);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Direct download PDF function
  const handleDownloadReportPdf = () => {
    try {
      setIsDownloadingPdf(true);
      const doc = generateMonthlyReportPdf(
        report,
        boarders,
        deposits,
        mealLogs,
        bazaarCosts,
        miscCosts,
        settings,
        {
          includeBazaarList: true,
          includeFixedCostsBreakdown: true,
          includeMemberSlips: false,
        }
      );
      const cleanMessName = (settings.messName || 'Mess').replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`${cleanMessName}_Monthly_Report_${report.month}.pdf`);
    } catch (err) {
      console.error('Error generating PDF report:', err);
      setShowPdfModal(true);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Export database state to JSON file
  const handleExportBackup = () => {
    const backupState = {
      boarders,
      deposits,
      mealLogs,
      bazaarCosts,
      miscCosts,
      settings,
      backupVersion: "1.0",
      exportedAt: new Date().toISOString()
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Mess_Meal_Backup_${settings.currentMonth}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import database state from JSON
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData && Array.isArray(importedData.boarders) && Array.isArray(importedData.deposits)) {
          onImportBackup(importedData);
          alert("Backup state imported successfully!");
        } else {
          alert("Invalid backup file structure! Please make sure it's a valid Mess Meal Manager backup file.");
        }
      } catch (err) {
        alert("Failed to parse JSON backup file!");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      
      {/* Printable Report Header Panel (Hidden on standard screen, visible during printing) */}
      <div className="hidden print:block font-sans p-6 text-gray-900 border-b border-gray-300">
        <div className="text-center">
          <h1 className="text-2xl font-bold uppercase tracking-wide">{settings.messName}</h1>
          <p className="text-sm font-semibold text-gray-600 mt-1">Monthly Meal Sheet & Audit Statement</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">Month: {formatReadableMonth(report.month)}</p>
        </div>
      </div>

      {/* Main Control Hub */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4.5 h-4.5 text-blue-600" />
            Audit & Calculations Hub
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isManager 
              ? "Generate physical invoice slips, export PDF reports, print monthly tables, or backup mess data."
              : "Review month-end calculations, meal costs, and shared bill balances."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* ONLY MANAGERS CAN SEE MEAL SHEET PDF, MONTHLY AUDIT PDF, AND DIRECT PRINT OPTIONS */}
          {isManager ? (
            <>
              {onOpenHandoverModal && (
                <button
                  type="button"
                  onClick={onOpenHandoverModal}
                  id="btn-close-month-handover"
                  className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-all shadow-xs"
                  title="Finalize monthly calculations, settle balances, and handover to new incoming manager"
                >
                  <ArrowRightLeft className="w-4 h-4 text-emerald-100" />
                  <span>Close Month & Handover</span>
                </button>
              )}

              <button
                onClick={() => setShowMealSheetModal(true)}
                id="btn-generate-meal-sheet-modal"
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors shadow-2xs"
                title="Generate & export the full monthly 31-day meal sheet of all boarders"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Meal Sheet PDF
              </button>

              <button
                onClick={() => setShowPdfModal(true)}
                id="btn-generate-pdf-modal"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors shadow-xs shadow-blue-200"
              >
                <FileText className="w-4 h-4" />
                Monthly Audit PDF
              </button>

              <button
                onClick={handleDownloadReportPdf}
                disabled={isDownloadingPdf}
                id="btn-download-pdf-direct"
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                title="Directly download monthly audit PDF report with 4 vouchers per page"
              >
                <Download className="w-4 h-4 text-emerald-200" />
                <span>{isDownloadingPdf ? 'Downloading...' : 'Download PDF'}</span>
              </button>

              <button
                onClick={handleExportBackup}
                id="btn-export-json"
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-2xs"
              >
                <Download className="w-4 h-4 text-slate-500" />
                Backup JSON
              </button>

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                id="btn-import-json"
                className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors shadow-2xs"
                title="Restore database backup from JSON file"
              >
                <Upload className="w-4 h-4 text-slate-500" />
                Restore Backup
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFileChange}
                accept=".json"
                className="hidden"
              />

              <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden md:block" />

              <button
                onClick={onClearData}
                id="btn-clear-month"
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs px-3.5 py-2 rounded-lg cursor-pointer transition-colors border border-rose-200"
                title="Wipe data from Google Cloud Firestore and local storage"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Wipe Data</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Boarder Public View
              </span>
              <button
                onClick={onRequireManagerLogin}
                className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                title="Manager login required for PDF exports, print, and administrative tools"
              >
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                Manager PDF & Print
              </button>
            </div>
          )}

        </div>
      </div>

      {/* --- SECTION 1: MASTER SUMMARY SHEET TABLE --- */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 overflow-hidden print:border-none print:shadow-none print:p-0">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 print:mb-2 gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
              <FileSpreadsheet className="w-5 h-5 text-blue-600 print:hidden" />
              Mess Master Balance Sheet
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Consolidated summary of all boarder balances for {formatReadableMonth(report.month)}</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={toggleAllCalculations}
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-blue-100 cursor-pointer transition-colors"
            >
              <Calculator className="w-3.5 h-3.5 text-blue-600" />
              {isAllExpanded ? 'Hide All Calculations' : 'Show All Calculations'}
            </button>
          </div>
          <span className="hidden print:inline-block text-xs font-semibold text-slate-500">
            Printed: {new Date().toLocaleDateString('en-GB')}
          </span>
        </div>

        {/* Big Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50 text-gray-500 uppercase text-[9px] font-bold tracking-wider print:bg-transparent">
                <th className="p-3">Member Name</th>
                <th className="p-3 text-center">Meals Logged</th>
                <th className="p-3 text-right">Meal Cost (A)</th>
                <th className="p-3 text-right">Fixed Bills (B)</th>
                {hasSpecialFeast && <th className="p-3 text-right text-purple-700">Special Feast (C)</th>}
                <th className="p-3 text-right">Total Charged {hasSpecialFeast ? '(A+B+C)' : '(A+B)'}</th>
                <th className="p-3 text-right">Total Deposited</th>
                <th className="p-3 text-right">Net Balance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report.boardersReport.map((bSum) => {
                const bDetails = boarders.find(b => b.id === bSum.boarderId);
                const isMemberActive = bDetails ? bDetails.isActive : true;
                const isExpanded = !!expandedBoarders[bSum.boarderId];

                return (
                  <React.Fragment key={bSum.boarderId}>
                    <tr 
                      className="hover:bg-blue-50/30 cursor-pointer transition-colors group print:hover:bg-transparent"
                      onClick={() => {
                        setExpandedBoarders(prev => ({
                          ...prev,
                          [bSum.boarderId]: !prev[bSum.boarderId]
                        }));
                      }}
                      title="Click to toggle step-by-step calculations"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 print:hidden shrink-0">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-blue-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                            )}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-900">{bSum.boarderName}</span>
                              {bDetails?.roomNo && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-medium">
                                  {bDetails.roomNo}
                                </span>
                              )}
                              {!isMemberActive && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-gray-100 text-gray-400">INACTIVE</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center font-semibold text-gray-700">{bSum.totalMeals}</td>
                      <td className="p-3 text-right font-mono text-gray-600">৳ {bSum.mealCost.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono text-gray-600">৳ {bSum.fixedCostShare.toFixed(2)}</td>
                      {hasSpecialFeast && (
                        <td className="p-3 text-right font-mono font-medium text-purple-700">
                          {(bSum.specialMealCost || 0) > 0 ? (
                            <span>৳ {(bSum.specialMealCost || 0).toFixed(2)}</span>
                          ) : (
                            <span className="text-slate-300">৳ 0.00</span>
                          )}
                        </td>
                      )}
                      <td className="p-3 text-right font-mono font-bold text-slate-800">৳ {bSum.totalCost.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700">৳ {bSum.totalDeposit.toFixed(2)}</td>
                      <td className="p-3 text-right">
                        <span className={`font-mono font-bold px-2 py-1 rounded text-[11px] ${
                          bSum.balance >= 0 
                            ? 'bg-blue-50 text-blue-800 border border-blue-100 print:bg-transparent print:border-none' 
                            : 'bg-rose-50 text-rose-800 border border-rose-100 print:bg-transparent print:border-none'
                        }`}>
                          {bSum.balance >= 0 ? '+' : ''}৳ {bSum.balance.toFixed(2)} {bSum.balance >= 0 ? '(Refund)' : '(Due)'}
                        </span>
                      </td>
                    </tr>
                    
                    {/* EXPANDED DETAILED CALCULATION STEP BREAKDOWN */}
                    {isExpanded && (
                      <tr className="bg-slate-50/50 print:bg-white">
                        <td colSpan={hasSpecialFeast ? 8 : 7} className="p-4 border-t border-b border-slate-100 print:border-slate-300">
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3 print:border-slate-300 print:shadow-none">
                            <div className="flex items-center gap-1.5 text-slate-800 font-bold border-b border-slate-100 pb-2 text-[11px] print:text-black">
                              <Calculator className="w-4 h-4 text-blue-600 print:hidden" />
                              <span>Formula & Step-by-Step Audit for {bSum.boarderName}{(bDetails?.roomNo || bSum.roomNo) ? ` (${bDetails?.roomNo || bSum.roomNo})` : ''}</span>
                            </div>
                            
                            <div className={`grid grid-cols-1 sm:grid-cols-2 ${hasSpecialFeast ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
                              
                              {/* Step 1 */}
                              <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 print:bg-white print:border-slate-300">
                                <div className="text-[9px] uppercase font-bold text-slate-400 print:text-gray-600">Step 1: Meals Expense (A)</div>
                                <div className="font-bold text-slate-800 text-[11px] print:text-black">৳ {bSum.mealCost.toFixed(2)}</div>
                                <div className="text-[10px] text-slate-500 leading-normal">
                                  <span>Meals ({bSum.totalMeals}) * Meal Rate (৳{report.mealRate.toFixed(4)})</span>
                                </div>
                              </div>

                              {/* Step 2 */}
                              <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 print:bg-white print:border-slate-300">
                                <div className="text-[9px] uppercase font-bold text-slate-400 print:text-gray-600">Step 2: Shared Bills (B)</div>
                                <div className="font-bold text-slate-800 text-[11px] print:text-black">৳ {bSum.fixedCostShare.toFixed(2)}</div>
                                <div className="text-[10px] text-slate-500 leading-normal">
                                  <span>Bills (৳{report.totalFixedCost.toFixed(2)}) / {boarders.filter(b => b.isActive).length} Members</span>
                                </div>
                              </div>

                              {/* Step 3: Special Feast (C) */}
                              {hasSpecialFeast && (
                                <div className="space-y-1 bg-purple-50/70 p-2.5 rounded-lg border border-purple-200 print:bg-white print:border-slate-300">
                                  <div className="text-[9px] uppercase font-bold text-purple-700 flex items-center gap-1 print:text-gray-600">
                                    <Sparkles className="w-3 h-3 text-purple-600 print:hidden" />
                                    <span>Step 3: Special Feast (C)</span>
                                  </div>
                                  <div className="font-bold text-purple-950 text-[11px] print:text-black">
                                    ৳ {(bSum.specialMealCost || 0).toFixed(2)}
                                  </div>
                                  <div className="text-[10px] text-purple-800 leading-normal">
                                    <span>Distributed only among feast diners</span>
                                  </div>
                                </div>
                              )}

                              {/* Step 3/4 */}
                              <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 print:bg-white print:border-slate-300">
                                <div className="text-[9px] uppercase font-bold text-slate-400 print:text-gray-600">
                                  {hasSpecialFeast ? 'Step 4: Total Charged' : 'Step 3: Total Charged (A+B)'}
                                </div>
                                <div className="font-bold text-slate-800 text-[11px] print:text-black">৳ {bSum.totalCost.toFixed(2)}</div>
                                <div className="text-[10px] text-slate-500 leading-normal">
                                  <span>Meals (৳{bSum.mealCost.toFixed(2)}) + Bills (৳{bSum.fixedCostShare.toFixed(2)}){hasSpecialFeast ? ` + Feast (৳${(bSum.specialMealCost || 0).toFixed(2)})` : ''}</span>
                                </div>
                              </div>

                              {/* Step 4/5 */}
                              <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 print:bg-white print:border-slate-300">
                                <div className="text-[9px] uppercase font-bold text-slate-400 print:text-gray-600">
                                  {hasSpecialFeast ? 'Step 5: Net Balance' : 'Step 4: Net Balance'}
                                </div>
                                <div className={`font-bold text-[11px] ${bSum.balance >= 0 ? 'text-blue-700 print:text-black' : 'text-rose-700 print:text-black'}`}>
                                  ৳ {bSum.balance.toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-500 leading-normal">
                                  <span>Deposit (৳{bSum.totalDeposit.toFixed(2)}) - Charged (৳{bSum.totalCost.toFixed(2)})</span>
                                </div>
                              </div>

                            </div>

                            <div className="text-[9px] text-slate-400 bg-slate-50/50 p-2 rounded border border-dashed border-slate-200 mt-1 print:bg-white print:border-slate-300">
                              <span className="font-bold text-slate-500 print:text-black block mb-0.5">Fixed Bills Shared Calculation:</span>
                              Cooker (৳{miscCosts.cookerBill}) + Utilities (৳{miscCosts.utilityBill}) + Gas (৳{miscCosts.gasBill}) + WiFi (৳{miscCosts.wifiBill}) + House Rent (৳{miscCosts.houseRent}) + Other (৳{miscCosts.otherCosts})
                              {miscCosts.customBills && miscCosts.customBills.length > 0 && (
                                <> + {miscCosts.customBills.map(b => `${b.name} (৳${b.amount})`).join(' + ')}</>
                              )} = <strong>৳{report.totalFixedCost.toFixed(2)}</strong> shared by {boarders.filter(b => b.isActive).length} active members.
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              
              {/* Grand Total Row */}
              <tr className="border-t-2 border-gray-300 font-bold bg-gray-50/80 print:bg-transparent text-[11px]">
                <td className="p-3 text-gray-900">GRAND TOTALS</td>
                <td className="p-3 text-center text-gray-900">{report.totalMeals}</td>
                <td className="p-3 text-right text-gray-800">৳ {report.totalBazaarCost.toLocaleString('en-IN')}</td>
                <td className="p-3 text-right text-gray-800">
                  ৳ {(report.totalFixedCost).toLocaleString('en-IN')}
                </td>
                {hasSpecialFeast && (
                  <td className="p-3 text-right text-purple-800 font-mono font-bold">
                    ৳ {(report.totalSpecialMealCost || 0).toLocaleString('en-IN')}
                  </td>
                )}
                <td className="p-3 text-right text-slate-900">
                  ৳ {(report.totalBazaarCost + report.totalFixedCost + (report.totalSpecialMealCost || 0)).toLocaleString('en-IN')}
                </td>
                <td className="p-3 text-right text-blue-800">৳ {report.totalDeposits.toLocaleString('en-IN')}</td>
                <td className="p-3 text-right">
                  <span className={`font-bold px-2 py-1 rounded ${
                    report.totalDeposits - (report.totalBazaarCost + report.totalFixedCost + (report.totalSpecialMealCost || 0)) >= 0
                      ? 'text-blue-800 bg-blue-50/60'
                      : 'text-rose-800 bg-rose-50/60'
                  }`}>
                    ৳ {(report.totalDeposits - (report.totalBazaarCost + report.totalFixedCost + (report.totalSpecialMealCost || 0))).toFixed(2)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Info footer for table transparency */}
        <div className="border-t border-gray-100 pt-4 mt-4 text-[10px] text-gray-400 space-y-1 print:hidden">
          <p><strong>Formula Guide:</strong></p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Meal Rate = Total Regular Bazaar (৳{report.totalBazaarCost}) / Total Active Meals ({report.totalMeals}) = <strong>৳{report.mealRate.toFixed(4)}/meal</strong></li>
            <li>Fixed Bills Share = Total bills (৳{report.totalFixedCost}) / Active boarders ({boarders.filter(b => b.isActive).length}) = <strong>৳{report.boardersReport[0]?.fixedCostShare || 0} per member</strong></li>
            {hasSpecialFeast && (
              <li className="text-purple-700 font-medium">
                Special Feasts = ৳{(report.totalSpecialMealCost || 0).toLocaleString('en-IN')} distributed only among participating boarders (completely excluded from regular daily meal rate).
              </li>
            )}
            <li>Net balance = Total Deposits - Total Charged (Meals Cost + Fixed Bills Share + Special Feast Share). Positive is receivable back, negative is due to pay.</li>
          </ul>
        </div>
      </div>

      {/* --- SECTION 2: PRINTABLE MEMBERS CASH MEMOS / BILL SLIPS --- */}
      <div className="space-y-6">
        
        <div className="border-b border-slate-200 pb-3 print:hidden">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight flex items-center gap-1.5">
            <FileText className="w-5 h-5 text-blue-600" />
            Individual Invoice Slips
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Individual invoice summaries that can be printed, sliced, and distributed to each boarder.</p>
        </div>

        {/* Grid layout of individual vouchers */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:space-y-0">
          
          {report.boardersReport.map((bSum) => {
            const bDetails = boarders.find(b => b.id === bSum.boarderId);
            const isMemberActive = bDetails ? bDetails.isActive : true;

            return (
              <div 
                key={bSum.boarderId} 
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between print:border-slate-400 print:shadow-none print:rounded-none print:p-4 print:break-inside-avoid print:h-[290px]"
              >
                {/* Slips Top header */}
                <div>
                  <div className="flex justify-between items-start border-b border-dashed border-slate-200 pb-2.5 mb-3.5">
                    <div>
                      <h4 className="font-mono font-bold text-[10px] uppercase tracking-wide text-slate-400">Invoice Voucher</h4>
                      <h3 className="font-bold text-xs text-slate-900 mt-0.5">{settings.messName}</h3>
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono uppercase">
                      {report.month}
                    </span>
                  </div>

                  {/* Bill Details Info */}
                  <div className="text-[11px] space-y-1 text-gray-600">
                    <p className="flex justify-between">
                      <span className="text-gray-400">Boarder Name:</span>
                      <strong className="text-gray-950 font-bold">{bSum.boarderName}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-400">Phone:</span>
                      <span className="font-mono">{bDetails?.phone || 'N/A'}</span>
                    </p>
                    <p className="flex justify-between border-t border-gray-100 pt-1.5 mt-1.5">
                      <span>Meals Eaten:</span>
                      <strong className="text-gray-800">{bSum.totalMeals} meals (Rate ৳{report.mealRate.toFixed(2)})</strong>
                    </p>
                    
                    <p className="flex justify-between">
                      <span>Meal Expenses:</span>
                      <span className="font-mono font-bold text-gray-700">৳{bSum.mealCost.toFixed(2)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Shared Common Bills:</span>
                      <span className="font-mono font-bold text-gray-700">৳{bSum.fixedCostShare.toFixed(2)}</span>
                    </p>
                    
                    <div className="border-t border-dashed border-gray-200 pt-1.5 mt-1.5 text-xs">
                      <p className="flex justify-between text-gray-900 font-bold">
                        <span>Total Due Charged:</span>
                        <span className="font-mono">৳{bSum.totalCost.toFixed(2)}</span>
                      </p>
                      <p className="flex justify-between text-blue-700 font-bold mt-0.5">
                        <span>Total Deposited:</span>
                        <span className="font-mono">৳{bSum.totalDeposit.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Voucher Bottom Balance indicator and Signature line */}
                <div className="mt-4 border-t border-slate-100 pt-3 flex flex-col gap-2 print:mt-2.5">
                  <div className={`p-2 rounded flex justify-between items-center text-xs font-bold ${
                    bSum.balance >= 0 
                      ? 'bg-blue-50 text-blue-800 border border-blue-100 print:bg-transparent print:border-blue-300' 
                      : 'bg-rose-50 text-rose-800 border border-rose-100 print:bg-transparent print:border-rose-300'
                  }`}>
                    <span>Net Closing:</span>
                    <span className="font-mono uppercase font-bold text-sm">
                      {bSum.balance >= 0 ? 'Surplus: ৳' : 'Due: ৳'}{Math.abs(bSum.balance).toFixed(2)}
                    </span>
                  </div>

                  {/* Signatures placeholders only on printed version to preserve space */}
                  <div className="hidden print:flex justify-between text-[8px] text-gray-400 font-bold mt-4">
                    <span className="border-t border-gray-300 pt-0.5 w-16 text-center">Boarder</span>
                    <span className="border-t border-gray-300 pt-0.5 w-16 text-center">Manager</span>
                  </div>
                </div>

              </div>
            );
          })}

        </div>

      </div>

      {/* 5. Monthly Closure & Manager Handover Archive History */}
      {settings.closureHistory && settings.closureHistory.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3.5 print:hidden">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-600" />
                <span>Monthly Closure & Manager Handover History</span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Archived records of finalized months, outgoing managers, and cash transitions.
              </p>
            </div>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              {settings.closureHistory.length} Month{settings.closureHistory.length > 1 ? 's' : ''} Archived
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {settings.closureHistory.map((record) => {
              const isCurrentViewed = record.month === report.month;
              return (
                <div 
                  key={record.id} 
                  className={`p-3.5 rounded-xl border transition-all ${
                    isCurrentViewed 
                      ? 'border-blue-400 bg-blue-50/40 shadow-xs' 
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                      {formatReadableMonth(record.month)}
                    </span>
                    <span className="text-[9.5px] font-mono text-slate-400">
                      {new Date(record.closedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] space-y-1 text-slate-600">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Outgoing Manager:</span>
                      <strong className="text-slate-800">{record.outgoingManagerName}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Incoming Manager:</span>
                      <strong className="text-emerald-700">{record.incomingManagerName}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Final Meal Rate:</span>
                      <strong className="text-blue-700 font-mono">৳ {record.mealRate.toFixed(4)}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Cash Handed Over:</span>
                      <strong className="text-slate-900 font-mono">৳ {record.cashHandoverAmount.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="flex justify-between items-center pt-0.5 border-t border-slate-200/60">
                      <span className="text-slate-500">Settlement:</span>
                      <span className="font-semibold text-[10px] text-slate-700">
                        {record.balanceSettlementType === 'carried_forward' ? 'Carried to next month' : 'Cash Settled'}
                      </span>
                    </div>
                  </div>

                  {record.handoverNotes && (
                    <p className="mt-2 text-[10px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200 italic">
                      "{record.handoverNotes}"
                    </p>
                  )}

                  {onSelectMonth && !isCurrentViewed && (
                    <button
                      type="button"
                      onClick={() => onSelectMonth(record.month)}
                      className="mt-2.5 w-full text-center py-1 rounded-lg text-[10.5px] font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 transition-colors cursor-pointer"
                    >
                      View {formatReadableMonth(record.month)} Audit Sheet
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Printable PDF Report Modal - Manager Only */}
      {isManager && (
        <PrintablePdfReportModal
          isOpen={showPdfModal}
          onClose={() => setShowPdfModal(false)}
          report={report}
          boarders={boarders}
          deposits={deposits}
          mealLogs={mealLogs}
          bazaarCosts={bazaarCosts}
          miscCosts={miscCosts}
          settings={settings}
        />
      )}

      {/* Boarder Daily Meal Sheet PDF Modal - Manager Only */}
      {isManager && (
        <BoarderMealSheetModal
          isOpen={showMealSheetModal}
          onClose={() => setShowMealSheetModal(false)}
          boarders={boarders}
          mealLogs={mealLogs}
          settings={settings}
          report={report}
        />
      )}

    </div>
  );
}
