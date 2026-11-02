import React from 'react';
import { User, Shield, Calendar, RefreshCw, Lock, LogOut, Globe } from 'lucide-react';
import { Boarder } from '../types';

interface RoleSelectorProps {
  role: 'manager' | 'boarder';
  setRole: (role: 'manager' | 'boarder') => void;
  selectedBoarderId: string;
  setSelectedBoarderId: (id: string) => void;
  boarders: Boarder[];
  currentMonth: string;
  onSimulateData: () => void;
  hasData: boolean;
  isManagerAuthenticated: boolean;
  onRequireManagerLogin: () => void;
  onManagerLogout: () => void;
}

export default function RoleSelector({
  role,
  setRole,
  selectedBoarderId,
  setSelectedBoarderId,
  boarders,
  currentMonth,
  onSimulateData,
  hasData,
  isManagerAuthenticated,
  onRequireManagerLogin,
  onManagerLogout,
}: RoleSelectorProps) {
  const activeBoarders = boarders.filter(b => b.isActive);

  const handleManagerClick = () => {
    if (isManagerAuthenticated) {
      setRole('manager');
    } else {
      onRequireManagerLogin();
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-4 gap-4">
          
          {/* Brand Logo & Month info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-100">
              <span className="font-sans font-bold text-lg">M</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">MessMaster</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <Globe className="w-2.5 h-2.5" />
                  Public Portal
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Active Period:</span>
                <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono font-semibold">
                  {currentMonth}
                </span>
              </div>
            </div>
          </div>

          {/* Center Action: Simulation shortcut if empty */}
          {!hasData && (
            <div className="flex items-center bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 text-amber-800 text-xs md:mx-auto">
              <span>No logs found for this month.</span>
              <button
                onClick={onSimulateData}
                className="ml-2 flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2 py-0.5 rounded cursor-pointer transition-all"
              >
                <RefreshCw className="w-3 h-3" />
                Load Sample Data
              </button>
            </div>
          )}

          {/* Mode Switchers & Auth Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              
              {/* Boarder / Public Dashboard Button (No login needed) */}
              <button
                onClick={() => {
                  setRole('boarder');
                  if (activeBoarders.length > 0 && !selectedBoarderId) {
                    setSelectedBoarderId(activeBoarders[0].id);
                  }
                }}
                id="btn-role-boarder"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  role === 'boarder'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Boarder view is open to the public without login"
              >
                <User className="w-4 h-4 text-blue-600" />
                <span>Boarder Dashboard</span>
                <span className="text-[10px] font-normal text-slate-400 hidden sm:inline">(Public)</span>
              </button>

              {/* Manager Portal Button (Protected) */}
              <button
                onClick={handleManagerClick}
                id="btn-role-manager"
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  role === 'manager'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={isManagerAuthenticated ? "Access Manager Portal" : "Manager login required"}
              >
                {isManagerAuthenticated ? (
                  <Shield className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>Manager Portal</span>
                {!isManagerAuthenticated && (
                  <span className="text-[10px] font-medium bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded">
                    PIN
                  </span>
                )}
              </button>
            </div>

            {/* Boarder selector dropdown when in Boarder role */}
            {role === 'boarder' && activeBoarders.length > 0 && (
              <div className="flex items-center gap-1.5 animate-fadeIn bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                <span className="text-xs text-slate-500 font-medium">Viewing as:</span>
                <select
                  value={selectedBoarderId}
                  onChange={(e) => setSelectedBoarderId(e.target.value)}
                  id="select-boarder-view"
                  className="bg-transparent text-slate-900 text-xs font-semibold cursor-pointer focus:outline-hidden"
                >
                  {activeBoarders.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}{b.roomNo ? ` (${b.roomNo})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Manager Logout / Lock Button */}
            {isManagerAuthenticated && (
              <button
                onClick={onManagerLogout}
                id="btn-manager-logout"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 cursor-pointer transition-all"
                title="Lock manager mode and return to public boarder view"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Lock / Logout</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
