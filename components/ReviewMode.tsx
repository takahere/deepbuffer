import React, { useState, useRef, useEffect } from 'react';
import { Message, DailySummary, Workspace } from '../types';
import { MessageCard } from './MessageCard';
import { Sparkles, Layers, MessageSquare, Send, Loader2, X, Clock, Zap, Filter, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Button } from './Button';
import { api } from '../services/api';

interface ReviewModeProps {
  messages: Message[];
  summary: DailySummary | null;
  onArchiveAll: () => void;
  onArchiveMessage: (id: string) => void;
  workspaces?: Workspace[]; // Added optional for backward compat
  selectedWorkspaceId?: string;
  onSelectWorkspace?: (id: string) => void;
  onRefresh?: () => Promise<void>;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export const ReviewMode: React.FC<ReviewModeProps> = ({ 
  messages, 
  summary, 
  onArchiveAll, 
  onArchiveMessage,
  workspaces = [],
  selectedWorkspaceId = 'all',
  onSelectWorkspace,
  onRefresh
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await api.syncMessages(); // Trigger backend sync
      await onRefresh(); // Refresh UI
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const intervalId = setInterval(() => {
      handleRefresh();
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(intervalId);
  }, [onRefresh]); // Dependency onRefresh is sufficient as handleRefresh uses it

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatOpen]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !summary) return;

    const question = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: question }]);
    setIsSending(true);

    const answer = await askAboutSummary(summary.summaryText, question);

    setChatHistory(prev => [...prev, { role: 'ai', content: answer }]);
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-50/95 dark:bg-[#0f172a]/95 backdrop-blur-md pt-16 md:pt-8 pb-4 px-4 md:px-6 border-b border-slate-200 dark:border-slate-800/50 mb-6 flex flex-col md:flex-row justify-between items-start md:items-end transition-colors duration-300 gap-4 md:gap-0">
        <div className="w-full md:w-auto">
          <div className="flex items-center gap-2 mb-1">
             <Zap size={20} className="text-indigo-600 dark:text-indigo-400" />
             <h1 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100">Focus Mode</h1>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-2 md:mt-0">
             <p className="text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">{messages.filter(m => m.sourceType === 'slack').length} 件のアイテムを処理中</p>
             
             {/* Workspace Filter & Refresh */}
             <div className="flex items-center gap-2 w-full sm:w-auto">
               {workspaces.length > 0 && onSelectWorkspace && (
                 <div className="flex items-center gap-2 flex-1 sm:flex-initial bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                    <Filter size={14} className="text-slate-400 ml-2 flex-shrink-0" />
                    <select 
                      value={selectedWorkspaceId} 
                      onChange={(e) => onSelectWorkspace(e.target.value)}
                      className="bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none pr-2 py-0.5 cursor-pointer w-full"
                    >
                      <option value="all">すべてのワークスペース</option>
                      {workspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                      ))}
                    </select>
                 </div>
               )}

               {/* Refresh Button */}
               {onRefresh && (
                 <button 
                   onClick={handleRefresh}
                   disabled={isRefreshing}
                   className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                   title="メッセージを更新"
                 >
                   <RotateCcw size={16} />
                 </button>
               )}
             </div>
          </div>
        </div>
        <div className="w-full md:w-auto flex justify-end">
          <Button onClick={onArchiveAll} variant="secondary" className="w-full md:w-auto">すべて完了（アーカイブ）</Button>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-20 space-y-6 md:space-y-8">
        {/* AI Summary Section */}
        {summary && (
          <div className="bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 dark:from-indigo-900/20 dark:to-slate-900 dark:border-indigo-500/20 rounded-xl p-4 md:p-6 relative overflow-hidden shadow-sm transition-colors duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles size={80} className="text-indigo-900 dark:text-white md:w-[100px] md:h-[100px]" />
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-2">
                <div className="flex items-center gap-2">
                   <Sparkles className="text-indigo-600 dark:text-indigo-400" size={18} />
                   <h3 className="text-indigo-900 dark:text-indigo-100 font-medium">バッチ要約レポート</h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300/80 font-mono bg-indigo-100 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/20 whitespace-nowrap">
                   <Clock size={12} />
                   {new Date(summary.targetDate).toLocaleDateString()} {new Date(summary.targetDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 生成
                </div>
              </div>
              
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base markdown-content">
                <ReactMarkdown
                  components={{
                    h3: ({node, ...props}) => <h3 className="text-indigo-900 dark:text-indigo-100 font-bold mt-4 mb-2 text-base md:text-lg" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 mb-4" {...props} />,
                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-semibold text-slate-900 dark:text-slate-100" {...props} />,
                  }}
                >
                  {summary.summaryText}
                </ReactMarkdown>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {summary.keyTopics.map(topic => (
                  <span key={topic} className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs">
                    {topic}
                  </span>
                ))}
              </div>

              {/* Chat Toggle / Interface */}
              <div className="mt-6 pt-4 border-t border-indigo-100 dark:border-indigo-500/20">
                {!isChatOpen ? (
                  <button 
                    onClick={() => setIsChatOpen(true)}
                    className="flex items-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors font-medium"
                  >
                    <MessageSquare size={16} className="mr-2" />
                    この要約についてAIに質問する
                  </button>
                ) : (
                  <div className="bg-white dark:bg-slate-900/50 rounded-lg border border-indigo-200 dark:border-indigo-500/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-500/10 px-4 py-2 border-b border-indigo-100 dark:border-indigo-500/10">
                      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                        <MessageSquare size={12}/> AI Q&A
                      </span>
                      <button onClick={() => setIsChatOpen(false)} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-white">
                        <X size={14} />
                      </button>
                    </div>
                    
                    {/* Chat History */}
                    <div className="p-4 max-h-[300px] overflow-y-auto space-y-4 bg-slate-50 dark:bg-transparent">
                      {chatHistory.length === 0 && (
                        <p className="text-xs text-slate-500 text-center italic">
                          「LPのデザインは誰が担当？」や「ランチの場所は？」など、要約内容について質問できます。
                        </p>
                      )}
                      {chatHistory.map((chat, idx) => (
                        <div key={idx} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`
                            max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed
                            ${chat.role === 'user' 
                              ? 'bg-indigo-600 text-white rounded-tr-none' 
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm'
                            }
                          `}>
                            {chat.content}
                          </div>
                        </div>
                      ))}
                      {isSending && (
                        <div className="flex justify-start">
                          <div className="bg-white dark:bg-slate-800 rounded-lg rounded-tl-none px-3 py-2 flex items-center gap-2 border border-slate-200 dark:border-slate-700">
                             <Loader2 size={14} className="animate-spin text-indigo-500" />
                             <span className="text-xs text-slate-500">AIが回答を作成中...</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="質問を入力..."
                        className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                      />
                      <Button 
                        size="sm" 
                        variant="primary" 
                        onClick={handleSendChat} 
                        disabled={!chatInput.trim() || isSending}
                        className="w-10 px-0"
                      >
                        <Send size={16} />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-slate-500 mb-2">
             <div className="flex items-center gap-2">
               <Layers size={14} />
               <span className="text-xs font-medium uppercase tracking-wider">詳細ログ</span>
             </div>
             <span className="text-xs text-slate-400">
               最終更新: {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (30分毎に自動更新)
             </span>
          </div>
          {messages.filter(m => m.sourceType === 'slack').map(msg => (
            <MessageCard 
              key={msg.id} 
              message={msg} 
              viewMode="review" 
              onArchive={() => onArchiveMessage(msg.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};