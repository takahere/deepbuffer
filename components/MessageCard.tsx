import React, { useState } from 'react';
import { Message, ReplyDraft } from '../types';
import { MessageSquare, Link as LinkIcon, AlertCircle, Wand2, X, Send, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { generateDraftReply } from '../services/aiService';
import { api } from '../services/api';

interface MessageCardProps {
  message: Message;
  viewMode: 'focus' | 'review';
  onArchive?: () => void;
}

export const MessageCard: React.FC<MessageCardProps> = ({ message, viewMode, onArchive }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [draft, setDraft] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleGenerateDraft = async (tone: ReplyDraft['tone']) => {
    setIsGenerating(true);
    // Don't clear draft immediately if we want to show loading state over it
    const text = await generateDraftReply(message.content, tone);
    setDraft(text);
    setIsGenerating(false);
  };

  const handleSendReply = async () => {
    if (!draft.trim()) return;
    setIsSending(true);
    
    // Use real API if available
    if (message.sourceType === 'slack' && message.slackChannelId) {
       const success = await api.sendSlackReply(
         message.slackChannelId, 
         draft, 
         message.slackTs,
         message.workspaceId // Pass team ID
       );
       if (!success) {
         alert('送信に失敗しました。');
         setIsSending(false);
         return;
       }
    } else {
       // Fallback for non-slack or missing ID (simulate)
    await new Promise(resolve => setTimeout(resolve, 1200));
    }

    setIsSending(false);
    setIsSent(true);
    
    // Close after showing success message
    setTimeout(() => {
        setIsReplying(false);
        setIsSent(false);
        setDraft('');
    }, 2000);
  };

  const ToneButton = ({ tone, label, icon: Icon }: { tone: ReplyDraft['tone'], label: string, icon: any }) => (
    <Button 
      variant="secondary" 
      size="sm" 
      onClick={() => handleGenerateDraft(tone)} 
      disabled={isGenerating || isSending || isSent}
      className="flex-1"
    >
       <Icon size={12} className="mr-2" /> {label}
    </Button>
  );

  return (
    <div className={`
      relative group rounded-xl p-4 border transition-all duration-300 shadow-sm
      ${message.isUrgent 
        ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/30' 
        : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'}
    `}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          {message.sourceType === 'slack' ? (
            <div className="relative">
               {message.authorAvatar ? (
                 <img src={message.authorAvatar} alt={message.authorName} className="w-8 h-8 rounded-full" />
               ) : (
                 <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500 dark:text-slate-300">{message.authorName[0]}</div>
               )}
               <div className="absolute -bottom-1 -right-1 bg-[#4A154B] rounded-full p-0.5 border border-white dark:border-slate-900">
                 <MessageSquare size={10} className="text-white" />
               </div>
            </div>
          ) : (
             <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <LinkIcon size={14} className="text-blue-500 dark:text-blue-400" />
             </div>
          )}
          
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{message.authorName}</span>
              <span className="text-xs text-slate-500 dark:text-slate-500">{new Date(message.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            {message.slackChannelName && (
              <div className="text-xs text-slate-500 dark:text-slate-400">{message.slackChannelName}</div>
            )}
          </div>
        </div>

        {message.isUrgent && (
          <div className="flex items-center gap-1 text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 px-2 py-0.5 rounded-full text-xs font-medium border border-red-200 dark:border-red-500/20">
            <AlertCircle size={12} />
            <span>緊急</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="pl-11">
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
          {message.content.split(new RegExp(`(${message.alertKeywords?.join('|')})`, 'gi')).map((part, i) => 
            message.alertKeywords?.some(k => k.toLowerCase() === part.toLowerCase()) ? (
              <span key={i} className="bg-amber-200 dark:bg-amber-500/30 text-amber-900 dark:text-amber-100 px-1 rounded font-medium">{part}</span>
            ) : part
          )}
        </p>
        
        {/* Review Mode: Summary & Actions */}
        {viewMode === 'review' && !isReplying && !isSent && (
          <div className="mt-4 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" variant="secondary" onClick={() => setIsReplying(true)}>
              <MessageSquare size={14} className="mr-2" />
              返信
            </Button>
            <Button size="sm" variant="ghost" onClick={onArchive}>アーカイブ</Button>
          </div>
        )}

        {/* Reply Interface */}
        {isReplying && (
          <div className="mt-4 bg-slate-50 dark:bg-slate-900/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700/80 animate-in fade-in slide-in-from-top-2">
             <div className="flex justify-between items-center mb-3">
               <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                 <Wand2 size={12} /> AI返信アシスタント
               </span>
               {!isSent && (
                 <button onClick={() => setIsReplying(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                   <X size={14} />
                 </button>
               )}
             </div>
             
             {isSent ? (
                <div className="py-4 flex flex-col items-center justify-center text-emerald-600 dark:text-emerald-400 animate-in zoom-in duration-300">
                  <CheckCircle2 size={32} className="mb-2" />
                  <span className="text-sm font-medium">送信しました</span>
                </div>
             ) : (
               <>
                 {/* Tone Selection */}
                 <div className="grid grid-cols-4 gap-2 mb-3">
                   <ToneButton tone="approve" label="承諾" icon={CheckCircle2} />
                   <ToneButton tone="decline" label="断る" icon={X} />
                   <ToneButton tone="question" label="質問" icon={AlertCircle} />
                   <ToneButton tone="neutral" label="了解" icon={MessageSquare} />
                 </div>

                 {/* Loading Indicator */}
                 {isGenerating && (
                    <div className="flex items-center gap-2 text-xs text-indigo-500 dark:text-indigo-400 mb-2 animate-pulse">
                      <Loader2 size={12} className="animate-spin" /> 文案を生成中...
                    </div>
                 )}

                 {/* Editor Area */}
                 <div className="relative">
                    <textarea 
                        className={`
                          w-full bg-white dark:bg-slate-800 border rounded-lg p-3 text-sm text-slate-800 dark:text-slate-200 
                          focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all
                          ${isGenerating ? 'opacity-50' : 'opacity-100'}
                          ${draft ? 'border-slate-300 dark:border-slate-600' : 'border-slate-200 dark:border-slate-700/50 h-20'}
                        `}
                        rows={draft ? 4 : 2}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={isGenerating ? "" : "AIが生成したドラフトがここに表示されます。直接編集も可能です。"}
                        disabled={isGenerating || isSending}
                    />
                    
                    {/* Actions */}
                    {draft && !isGenerating && (
                      <div className="flex justify-between items-center mt-2 animate-in fade-in">
                        <span className="text-xs text-slate-500">
                          <RotateCcw size={10} className="inline mr-1"/>
                          上のボタンで再生成できます
                        </span>
                        <Button 
                          size="sm" 
                          variant="primary" 
                          onClick={handleSendReply}
                          disabled={isSending || !draft.trim()}
                          className="px-4"
                        >
                          {isSending ? (
                            <><Loader2 size={14} className="animate-spin mr-2" /> 送信中</>
                          ) : (
                            <><Send size={14} className="mr-2" /> 返信を送信</>
                          )}
                        </Button>
                      </div>
                    )}
                 </div>
               </>
             )}
          </div>
        )}
      </div>
    </div>
  );
};