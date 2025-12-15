import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Camera, X, Check, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../contexts/AuthContext';

export const ProfileMenu: React.FC = () => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user?.user_metadata?.avatar_url) {
      setAvatarUrl(user.user_metadata.avatar_url);
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!urlInput.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: urlInput }
      });
      
      if (error) throw error;
      setAvatarUrl(urlInput);
      setIsEditing(false);
    } catch (e) {
      console.error('Error updating profile:', e);
      alert('プロフィールの更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const [urlInput, setUrlInput] = useState('');

  if (!user) return null;

  const currentAvatar = user.user_metadata?.avatar_url || avatarUrl;
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

  return (
    <div className="relative z-50" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative group transition-all"
      >
        <div className={`
          w-10 h-10 rounded-full overflow-hidden border-2 transition-all
          ${isOpen ? 'border-indigo-500 shadow-md ring-2 ring-indigo-500/20' : 'border-white dark:border-slate-700 shadow-sm hover:border-slate-300 dark:hover:border-slate-600'}
        `}>
          {currentAvatar ? (
            <img src={currentAvatar} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-medium text-lg">
              {displayName[0].toUpperCase()}
            </div>
          )}
        </div>
        
        {/* Status Indicator */}
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 origin-top-right">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3 mb-2">
              {currentAvatar ? (
                <img src={currentAvatar} alt="Profile" className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl">
                  {displayName[0].toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            
            {!isEditing ? (
              <button 
                onClick={() => {
                  setIsEditing(true);
                  setUrlInput(currentAvatar || '');
                }}
                className="w-full mt-2 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              >
                <Camera size={12} /> プロフィール画像を変更
              </button>
            ) : (
              <div className="mt-2 animate-in fade-in">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="画像URLを入力..."
                  className="w-full text-xs px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button 
                    onClick={handleUpdateProfile}
                    disabled={isSaving}
                    className="flex-1 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center justify-center gap-1"
                  >
                    {isSaving ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>} 保存
                  </button>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-2">
            <button
              onClick={() => {
                setIsOpen(false);
                signOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
