import React, { useState, useEffect } from 'react';
import { UserSettings, Workspace } from '../types';
import { Button } from './Button';
import { Plus, X, AlertTriangle, UserCheck, FileText, Check, Trash2, Loader2, Link, Moon, Sun, Search, User } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface SettingsProps {
  settings: UserSettings;
  onSave?: (settings: UserSettings) => void;
  workspaces: Workspace[];
  onAddWorkspace: (ws: Workspace) => void;
  onRemoveWorkspace: (id: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

interface SlackUser {
  id: string;
  name: string;
  avatar?: string;
  teamId: string;
  teamName?: string;
}

export const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  onSave, 
  workspaces, 
  onAddWorkspace, 
  onRemoveWorkspace,
  isDarkMode,
  onToggleDarkMode
}) => {
  const { user } = useAuth();
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);
  const [newKeyword, setNewKeyword] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // VIP User Selection
  const [availableUsers, setAvailableUsers] = useState<SlackUser[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    // Fetch users when component mounts or workspaces change
    const fetchUsers = async () => {
      if (workspaces.length === 0) return;
      setIsFetchingUsers(true);
      const users = await api.getSlackUsers();
      setAvailableUsers(users);
      setIsFetchingUsers(false);
    };
    fetchUsers();
  }, [workspaces]);

  const handleSave = () => {
    if (onSave) {
      onSave(localSettings);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !localSettings.alertKeywords.includes(newKeyword.trim())) {
      setLocalSettings(prev => ({
        ...prev,
        alertKeywords: [...prev.alertKeywords, newKeyword.trim()]
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setLocalSettings(prev => ({
      ...prev,
      alertKeywords: prev.alertKeywords.filter(k => k !== keyword)
    }));
  };

  const addVip = (user: SlackUser) => {
    if (!localSettings.vipUserIds.includes(user.id)) {
      setLocalSettings(prev => ({
        ...prev,
        vipUserIds: [...prev.vipUserIds, user.id]
      }));
    }
    setUserSearch('');
    setShowUserDropdown(false);
  };

  const removeVip = (vipId: string) => {
    setLocalSettings(prev => ({
      ...prev,
      vipUserIds: prev.vipUserIds.filter(v => v !== vipId)
    }));
  };

  const getVipName = (id: string) => {
    const user = availableUsers.find(u => u.id === id);
    return user ? user.name : id; // Fallback to ID if not found
  };
  
  const getVipAvatar = (id: string) => {
      const user = availableUsers.find(u => u.id === id);
      return user ? user.avatar : null;
  };

  const filteredUsers = availableUsers.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) && 
    !localSettings.vipUserIds.includes(u.id)
  );

  const handleInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalSettings(prev => ({
      ...prev,
      reportCustomInstructions: e.target.value
    }));
  };

  const handleConnectSlack = async () => {
    setIsConnecting(true);
    
    // Redirect to Slack OAuth
    // NOTE: In a real app, client_id and scopes should come from env vars or config
    // Replace YOUR_CLIENT_ID and YOUR_REDIRECT_URI with actual values or fetch from backend config
    const clientId = '324068338356.10117779235602'; // Hardcoded for confirmation
    // Dynamic redirect URI based on current origin
    // For local dev with ngrok, this might still be localhost if opened there, 
    // but typically we want the OAuth flow to return to where we started.
    // However, Slack requires EXACT match with registered Redirect URIs.
    // So we should use a consistent configured URL or the current one if it matches Slack config.
    // For now, let's use the current window location origin + /api/auth/callback
    // NOTE: You must add this URL to Slack App "Redirect URLs" list.
    const redirectUri = `${window.location.origin}/api/auth/callback`;
    const state = user?.id || ''; 
    
    const scopes = 'channels:history,channels:read,chat:write,groups:history,groups:read,im:history,im:read,mpim:history,mpim:read,users:read,team:read';
    // If using User Token (as per earlier context):
    const userScopesUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    
    window.location.href = userScopesUrl;
  };

  const SlackIcon = () => (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.52v-6.315zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.52v2.522h-2.52zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.522 2.521 2.527 2.527 0 0 1-2.522-2.521V2.522A2.528 2.528 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.522-2.522v-2.522h2.522zM15.165 17.688a2.527 2.527 0 0 1-2.522-2.522 2.527 2.527 0 0 1 2.522-2.522h6.312A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.312z"/>
    </svg>
  );

  return (
    <div className="max-w-2xl mx-auto pt-8 px-4 md:px-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 md:gap-0">
        <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">設定</h2>
        <button
          onClick={onToggleDarkMode}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors w-full md:w-auto justify-center"
        >
          {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
          <span className="text-sm font-medium">{isDarkMode ? 'ダークモード' : 'ライトモード'}</span>
        </button>
      </div>

      {/* Workspace Integration */}
      <div className="bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
           <div>
             <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
               <Link size={18} className="text-indigo-500 dark:text-indigo-400"/> ワークスペース連携
             </h3>
             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
               Slackワークスペースを接続して、メッセージを一元管理します。
             </p>
           </div>
        </div>
        
        <div className="space-y-3 mb-4">
          {workspaces.map(ws => (
             <div key={ws.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800 gap-3 sm:gap-0">
               <div className="flex items-center gap-3 w-full sm:w-auto">
                 <img src={ws.iconUrl} alt={ws.name} className="w-8 h-8 rounded-lg flex-shrink-0" />
                 <div className="min-w-0">
                   <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{ws.name}</p>
                   <p className="text-xs text-slate-500 truncate">ID: {ws.slackTeamId}</p>
                 </div>
               </div>
               <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={() => onRemoveWorkspace(ws.id)} 
                 className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 w-full sm:w-auto justify-center"
                >
                  <Trash2 size={16} />
               </Button>
             </div>
          ))}
        </div>

        <Button 
          onClick={handleConnectSlack} 
          disabled={isConnecting}
          className="w-full bg-[#4A154B] hover:bg-[#3b113c] text-white border-0"
        >
          {isConnecting ? (
            <><Loader2 size={16} className="animate-spin mr-2" /> 接続中...</>
          ) : (
            <><SlackIcon /> Slackワークスペースを追加</>
          )}
        </Button>
      </div>

      {/* AI Report Instructions */}
      <div className="bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
           <div>
             <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
               <FileText size={18} className="text-blue-500 dark:text-blue-400"/> AI要約レポート設定
             </h3>
             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
               AIが定期レポートを生成する際、どのような情報を重点的に収集・要約してほしいかを自然言語で指示できます。
             </p>
           </div>
        </div>
        
        <textarea
          value={localSettings.reportCustomInstructions || ''}
          onChange={handleInstructionsChange}
          placeholder="例: プロジェクトAの進捗を最優先にしてください。ランチの話題は無視して構いません。"
          className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-y"
        />
      </div>

      {/* Keywords */}
      <div className="bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
           <div>
             <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
               <AlertTriangle size={18} className="text-amber-500"/> アラートキーワード
             </h3>
             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
               これらの単語を含むメッセージはバッファを回避し、即座に通知されます。
             </p>
           </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {localSettings.alertKeywords.map(keyword => (
            <span key={keyword} className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-500 px-3 py-1 rounded-full text-sm border border-amber-500/20">
              {keyword}
              <button onClick={() => removeKeyword(keyword)} className="hover:text-amber-800 dark:hover:text-amber-300"><X size={14}/></button>
            </span>
          ))}
          <div className="flex items-center gap-2">
             <input 
                type="text" 
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                placeholder="キーワード..."
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1 text-sm text-slate-800 dark:text-white w-32 focus:outline-none focus:border-amber-500"
             />
             <button onClick={addKeyword} className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300">
               <Plus size={16} />
             </button>
          </div>
        </div>
      </div>

      {/* VIPs */}
      <div className="bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
           <div>
             <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
               <UserCheck size={18} className="text-emerald-500"/> VIPユーザー
             </h3>
             <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
               これらの特定の人物からのDMは常に緊急として扱われます。
             </p>
           </div>
        </div>
        
        <div className="space-y-3">
          {localSettings.vipUserIds.map(userId => (
            <div key={userId} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
               <div className="flex items-center gap-3">
                  {getVipAvatar(userId) ? (
                     <img src={getVipAvatar(userId)!} alt={getVipName(userId)} className="w-6 h-6 rounded-full" />
                  ) : (
                     <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <User size={14} className="text-slate-500" />
                     </div>
                  )}
                  <span className="text-slate-700 dark:text-slate-300">{getVipName(userId)}</span>
               </div>
               <Button variant="ghost" size="sm" onClick={() => removeVip(userId)} className="text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"><X size={16} /></Button>
            </div>
          ))}
          
           {/* VIP User Search/Select */}
           <div className="relative mt-4">
              {showUserDropdown ? (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                   <div className="p-2 border-b border-slate-100 dark:border-slate-700 flex items-center">
                      <Search size={16} className="text-slate-400 ml-2 mr-2" />
                      <input 
                        type="text" 
                        autoFocus
                        placeholder="ユーザーを検索..." 
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="w-full bg-transparent border-none outline-none text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400"
                      />
                      <button onClick={() => setShowUserDropdown(false)}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
                   </div>
                   <div className="max-h-60 overflow-y-auto">
                      {isFetchingUsers ? (
                         <div className="p-4 text-center text-sm text-slate-500"><Loader2 size={16} className="animate-spin inline mr-2"/> 読み込み中...</div>
                      ) : filteredUsers.length === 0 ? (
                         <div className="p-4 text-center text-sm text-slate-500">ユーザーが見つかりません</div>
                      ) : (
                         filteredUsers.map(user => (
                            <button 
                              key={user.id} 
                              onClick={() => addVip(user)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                            >
                               {user.avatar ? (
                                 <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                               ) : (
                                 <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                    <User size={14} className="text-slate-500" />
                                 </div>
                               )}
                               <div>
                                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{user.name}</p>
                                  <p className="text-xs text-slate-500">{user.teamName}</p>
                               </div>
                            </button>
                         ))
                      )}
                   </div>
                </div>
              ) : (
                 <Button variant="secondary" className="w-full" onClick={() => setShowUserDropdown(true)}>
                    <Plus size={16} className="mr-2" /> VIPユーザーを追加
                 </Button>
              )}
           </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-end sticky bottom-6 z-20">
        <Button onClick={handleSave} size="lg" className={isSaved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}>
          {isSaved ? <><Check size={18} className="mr-2" /> 保存しました</> : "変更を保存"}
        </Button>
      </div>
    </div>
  );
};