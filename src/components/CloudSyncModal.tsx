import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  Cloud, 
  CloudLightning, 
  RefreshCw, 
  Trash2, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Database, 
  Server, 
  ShieldCheck,
  HardDriveDownload,
  Info
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCloudSynced: boolean;
  isLoading: boolean;
  lastSyncedAt: string | null;
  counts: {
    boarders: number;
    deposits: number;
    bazaar: number;
    meals: number;
  };
  onForceRefresh: () => Promise<void>;
  onPurgeCacheAndReload: () => Promise<void>;
  onPushAllToCloud: () => Promise<void>;
  onResetDemoData: () => Promise<void>;
  errorMessage: string | null;
}

export default function CloudSyncModal({
  isOpen,
  onClose,
  isCloudSynced,
  isLoading,
  lastSyncedAt,
  counts,
  onForceRefresh,
  onPurgeCacheAndReload,
  onPushAllToCloud,
  onResetDemoData,
  errorMessage,
}: CloudSyncModalProps) {
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async (name: string, fn: () => Promise<void>, successMessage: string) => {
    setActionPending(name);
    setSuccessToast(null);
    try {
      await fn();
      setSuccessToast(successMessage);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error(`Action ${name} failed:`, err);
    } finally {
      setActionPending(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 sm:p-4 py-8 animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-auto border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-3rem)] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0">
              <Cloud className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Google Cloud Firestore</h3>
                {isCloudSynced ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    OFFLINE CACHE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time cloud database syncing & browser storage manager
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Success Toast */}
          {successToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Connection Notice:</span>
                <span className="text-rose-800">{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Active Database Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Database className="w-3.5 h-3.5 text-blue-600" />
                Firestore Database ID:
              </span>
              <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-[220px]" title={firebaseConfig.firestoreDatabaseId}>
                {firebaseConfig.firestoreDatabaseId || '(default)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Server className="w-3.5 h-3.5 text-indigo-600" />
                Cloud Project:
              </span>
              <span className="font-mono font-bold text-slate-800">
                {firebaseConfig.projectId}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                Last Server Sync:
              </span>
              <span className="font-medium text-slate-700">
                {lastSyncedAt ? `${lastSyncedAt}` : 'Initial boot'}
              </span>
            </div>
          </div>

          {/* Live Document Counts */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Current Cloud Records</span>
              <span className="text-[10px] text-slate-400 font-normal">Direct from Firestore</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5">
                <div className="text-lg font-extrabold text-blue-700">{counts.boarders}</div>
                <div className="text-[10px] text-blue-600 font-medium">Boarders</div>
              </div>
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5">
                <div className="text-lg font-extrabold text-emerald-700">{counts.deposits}</div>
                <div className="text-[10px] text-emerald-600 font-medium">Deposits</div>
              </div>
              <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-2.5">
                <div className="text-lg font-extrabold text-amber-700">{counts.bazaar}</div>
                <div className="text-[10px] text-amber-600 font-medium">Bazaar Logs</div>
              </div>
              <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-2.5">
                <div className="text-lg font-extrabold text-purple-700">{counts.meals}</div>
                <div className="text-[10px] text-purple-600 font-medium">Meal Days</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-1">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Sync & Storage Controls
            </div>

            {/* 1. Force Refresh Button */}
            <button
              onClick={() => handleAction('refresh', onForceRefresh, 'Successfully refreshed all data directly from Firestore Server!')}
              disabled={actionPending !== null || isLoading}
              className="w-full flex items-center justify-between p-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl transition-all shadow-xs cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <RefreshCw className={`w-4 h-4 ${actionPending === 'refresh' || isLoading ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <div className="text-xs font-bold">Force Refresh from Cloud Firestore</div>
                  <div className="text-[10px] text-blue-100">Bypasses browser cache and queries live Firestore servers directly</div>
                </div>
              </div>
              <span className="text-xs font-bold shrink-0 bg-white/20 px-2 py-1 rounded-md">
                {actionPending === 'refresh' ? 'Fetching...' : 'Query Now'}
              </span>
            </button>

            {/* 2. Purge Browser Cache & Hard Reload */}
            <button
              onClick={() => handleAction('purge', onPurgeCacheAndReload, 'Browser cache purged! Fresh data pulled from Firestore.')}
              disabled={actionPending !== null || isLoading}
              className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-rose-50/50 border border-rose-200 text-slate-800 rounded-xl transition-all shadow-xs cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-rose-900">Purge Browser Cache & Reload from Cloud</div>
                  <div className="text-[10px] text-slate-500">Wipes localStorage keys and pulls clean copy from Firestore</div>
                </div>
              </div>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md shrink-0">
                {actionPending === 'purge' ? 'Purging...' : 'Purge Cache'}
              </span>
            </button>

            {/* 3. Push Local to Cloud */}
            <button
              onClick={() => handleAction('push', onPushAllToCloud, 'All local data was successfully written to Firestore!')}
              disabled={actionPending !== null || isLoading}
              className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-xl transition-all shadow-xs cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Push Local Data to Firestore</div>
                  <div className="text-[10px] text-slate-500">Overwrites cloud collections with your active state in batches</div>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md shrink-0">
                {actionPending === 'push' ? 'Pushing...' : 'Upload'}
              </span>
            </button>

            {/* 4. Reset / Re-seed Demo Data */}
            <button
              onClick={() => {
                if (confirm('Are you sure you want to re-seed the demo dataset (5 boarders, 10 bazaar records, 28 meal logs) to Firestore? This will overwrite existing test entries.')) {
                  handleAction('reseed', onResetDemoData, 'Firestore re-seeded with fresh July 2026 demo records!');
                }
              }}
              disabled={actionPending !== null || isLoading}
              className="w-full flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-all shadow-xs cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <HardDriveDownload className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Reset & Seed Demo Dataset to Cloud</div>
                  <div className="text-[10px] text-slate-500">Seeds pristine sample dataset into Firestore</div>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md shrink-0">
                {actionPending === 'reseed' ? 'Seeding...' : 'Reset'}
              </span>
            </button>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              Real-time listeners are active. When anyone adds a deposit, enters daily bazaar, or logs meals on any device, this client syncs instantly without needing manual refreshes.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Status: <span className="font-semibold text-slate-700">{isCloudSynced ? 'Connected to Google Cloud' : 'Offline'}</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
