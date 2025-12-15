import React, { useState } from 'react';
import { ViewState } from '../types';
import { Inbox, Bookmark, Settings, Coffee, Zap, Menu, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  isLocked: boolean;
  onToggleLock: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, isLocked, onToggleLock }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => {
        onChangeView(view);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
        ${currentView === view 
          ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
        }
      `}
    >
      <Icon size={20} className={currentView === view ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <>
      {/* Mobile Menu Toggle */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 transform md:relative md:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-xl tracking-tight">
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center shadow-md transition-colors duration-500
              ${isLocked ? 'bg-teal-500 shadow-teal-500/20' : 'bg-indigo-600 shadow-indigo-500/20'}
            `}>
              <span className="text-white text-lg">D</span>
            </div>
            DeepBuffer
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          <NavItem view="focus" icon={Inbox} label="インボックス" />
          <NavItem view="pocket" icon={Bookmark} label="リンクポケット" />
          <NavItem view="settings" icon={Settings} label="設定" />
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={onToggleLock}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 shadow-sm group
              ${isLocked 
                ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800/50 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/20' 
                : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/30'
              }
            `}
          >
            <div className="flex items-center gap-3">
              {isLocked ? <Coffee size={20} /> : <Zap size={20} />}
              <div className="text-left">
                <span className="block text-sm font-bold">{isLocked ? "Calm Mode" : "Focus Mode"}</span>
                <span className={`text-[10px] block opacity-80 ${isLocked ? '' : 'text-indigo-100'}`}>
                  {isLocked ? "通知遮断中 (Teal Theme)" : "タスク処理中 (Indigo Theme)"}
                </span>
              </div>
            </div>
            {/* Toggle Indicator */}
            <div className={`
               w-8 h-4 rounded-full relative transition-colors duration-300
               ${isLocked ? 'bg-teal-200 dark:bg-teal-800' : 'bg-indigo-400'}
            `}>
               <div className={`
                  absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-300 shadow-sm
                  ${isLocked ? 'left-0.5' : 'translate-x-4 left-0.5'}
               `}></div>
            </div>
          </button>
        </div>
      </div>
      
      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};