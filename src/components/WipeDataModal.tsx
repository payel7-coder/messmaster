import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  AlertTriangle, 
  Trash2, 
  X, 
  RefreshCw, 
  CheckCircle2, 
  Calendar, 
  Database,
  Lock,
  Users
} from 'lucide-react';
import { MessSettings, MiscellaneousCosts } from '../types';
import { wipeFirestoreDatabase } from '../services/firestoreService';

interface WipeDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMonth: string;
  settings: MessSettings;
  onSuccess: (wipeType: 'all' | 'month') => void;
}

export default function WipeDataModal({
  isOpen,
  onClose,
  currentMonth,
  settings,
  onSuccess
}: WipeDataModalProps) {
  const [wipeScope, setWipeScope] = useState<'month' | 'all'>('month');
  const [confirmationInput, setConfirmationInput] = useState<string>('');
  const [managerPinInput, setManagerPinInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExecuteWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Verify Manager PIN
    const requiredPin = settings.managerPin || '1234';
    if (managerPinInput.trim() !== requiredPin) {
      setErrorMsg('Incorrect Manager Security PIN. Action cancelled.');
      return;
    }

    // If wiping all, require typing "DELETE" or "WIPE"
    if (wipeScope === 'all') {
      const cleanConfirm = confirmationInput.trim().toUpperCase();
      if (cleanConfirm !== 'DELETE' && cleanConfirm !== 'WIPE') {
        setErrorMsg('Please type "WIPE" or "DELETE" into the confirmation field to confirm total database wipe.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (wipeScope === 'all') {
        const defaultSettings: MessSettings = {
          messName: settings.messName || 'Shajahan Villa',
          currentMonth: settings.currentMonth || currentMonth,
          managerPin: settings.managerPin || '1234',
          monthlyBudgetTarget: 0
        };
        const defaultMisc: MiscellaneousCosts = {
          cookerBill: 0,
          utilityBill: 0,
          gasBill: 0,
          wifiBill: 0,
          houseRent: 0,
          otherCosts: 0,
          customBills: []
        };

        await wipeFirestoreDatabase({
          wipeAll: true,
          defaultSettings,
          defaultMiscCosts: defaultMisc
        });
        onSuccess('all');
      } else {
        await wipeFirestoreDatabase({
          wipeAll: false,
          currentMonthOnly: currentMonth
        });
        onSuccess('month');
      }

      onClose();
    } catch (err: any) {
      console.error('Wipe operation failed:', err);
      setErrorMsg(err?.message || 'Failed to wipe data from Firestore database.');
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 py-8 animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-auto border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-rose-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-800/80 border border-rose-700 flex items-center justify-center text-rose-200 shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Wipe & Reset Database</h3>
              <p className="text-xs text-rose-200 mt-0.5">
                Permanently purge records from Google Cloud Firestore and local storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-rose-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleExecuteWipe} className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Scope Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Wipe Scope
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setWipeScope('month')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  wipeScope === 'month'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 shadow-2xs font-semibold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold">Wipe Active Month</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Deletes deposits, bazaar & meals for <span className="font-mono font-bold text-slate-700">{currentMonth}</span> only. Boarder profiles are kept.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWipeScope('all')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  wipeScope === 'all'
                    ? 'border-rose-500 bg-rose-50/70 text-rose-900 shadow-2xs font-semibold'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Database className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="text-xs font-bold">Wipe Entire Database</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Wipes EVERYTHING including <span className="font-bold text-rose-700">all Boarders</span>, deposits, bazaar, and all monthly logs.
                </p>
              </button>
            </div>
          </div>

          {/* Detailed Warning Notice */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-600">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>What happens when you confirm:</span>
            </div>
            {wipeScope === 'all' ? (
              <ul className="list-disc pl-4 text-[11px] space-y-1 text-slate-600">
                <li><strong className="text-rose-700">All Boarder profiles</strong> will be deleted from Google Cloud Firestore.</li>
                <li>All deposit records, shopping receipts, and daily meal records will be deleted.</li>
                <li>Local browser storage will be cleared to prevent stale state reload.</li>
              </ul>
            ) : (
              <ul className="list-disc pl-4 text-[11px] space-y-1 text-slate-600">
                <li>All deposits logged for <strong>{currentMonth}</strong> will be deleted from Google Cloud Firestore.</li>
                <li>All bazaar shopping receipts for <strong>{currentMonth}</strong> will be deleted.</li>
                <li>All meal entries for <strong>{currentMonth}</strong> will be deleted.</li>
                <li><strong className="text-emerald-700">All registered Boarders are preserved safely.</strong></li>
              </ul>
            )}
          </div>

          {/* Confirmation Text for Full Wipe */}
          {wipeScope === 'all' && (
            <div>
              <label className="block text-xs font-bold text-rose-800 mb-1">
                Type <span className="font-mono bg-rose-100 text-rose-800 px-1 py-0.5 rounded">WIPE</span> to confirm total database deletion:
              </label>
              <input
                type="text"
                required
                placeholder="Type WIPE"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          )}

          {/* Manager PIN */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-blue-600" />
              <span>Manager Security PIN (Default is 1234):</span>
            </label>
            <input
              type="password"
              required
              placeholder="Enter PIN"
              value={managerPinInput}
              onChange={(e) => setManagerPinInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-xs"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting from Cloud Firestore...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{wipeScope === 'all' ? 'Permanently Wipe All Data' : `Wipe ${currentMonth} Data`}</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
}
