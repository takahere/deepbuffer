import React from 'react';
import { Message } from '../types';
import { MessageCard } from './MessageCard';
import { Coffee, Waves } from 'lucide-react';

interface FocusModeProps {
  urgentMessages: Message[];
  totalHidden: number;
  nextDeliveryTime: string;
}

export const FocusMode: React.FC<FocusModeProps> = ({ urgentMessages, totalHidden, nextDeliveryTime }) => {
  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto pt-12 pb-8 px-6">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-500/10 mb-6 relative">
          <Coffee className="w-8 h-8 text-teal-600 dark:text-teal-400" />
          <div className="absolute inset-0 rounded-full border border-teal-500/20 animate-ping opacity-20"></div>
        </div>
        <h2 className="text-3xl font-light text-slate-800 dark:text-slate-100 mb-2">Calm Mode</h2>
        <p className="text-slate-500 dark:text-slate-400">
          ダムは閉じています。<span className="text-teal-600 dark:text-teal-400 font-medium">{totalHidden}</span> 件のノイズから守られています。
        </p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mt-3 bg-slate-100 dark:bg-slate-800/50 inline-block px-4 py-1 rounded-full">
          次の要約レポート配信予定: {nextDeliveryTime}
        </p>
      </div>

      <div className="flex-1">
        {urgentMessages.length > 0 ? (
          <div className="relative">
             {/* Header */}
             <div className="flex items-center gap-2 text-red-500 dark:text-red-400 mb-8 pl-1">
               <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
               <span className="text-xs font-bold uppercase tracking-wider">緊急プロトコル: 優先アイテム</span>
            </div>

            {/* Timeline Container */}
            <div className="relative pl-8">
                {/* Vertical Line */}
                <div className="absolute left-3 top-2 bottom-4 w-px bg-gradient-to-b from-red-500/30 via-slate-200 dark:via-slate-800 to-transparent"></div>

                <div className="space-y-8">
                  {urgentMessages.map(msg => (
                    <div key={msg.id} className="relative animate-in fade-in slide-in-from-bottom-2 duration-500">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[26px] top-6 w-3 h-3 rounded-full bg-white dark:bg-slate-900 border-2 border-red-500 z-10 shadow-[0_0_10px_rgba(239,68,68,0.4)]"></div>
                      
                      {/* Time Label (Desktop) */}
                      <div className="absolute -left-[100px] top-5 text-xs text-slate-400 dark:text-slate-500 w-16 text-right hidden lg:block font-mono opacity-70">
                           {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>

                      <MessageCard message={msg} viewMode="focus" />
                    </div>
                  ))}
                </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-teal-200 dark:border-teal-900/50 rounded-xl bg-teal-50/50 dark:bg-teal-900/10 mt-8">
             <Waves className="text-teal-400 dark:text-teal-600 mb-3" />
             <p className="text-teal-700 dark:text-teal-400 text-sm font-medium">静寂な時間をお楽しみください。</p>
          </div>
        )}
      </div>
    </div>
  );
};