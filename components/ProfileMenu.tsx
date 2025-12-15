import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User, Camera, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../contexts/AuthContext';

export const ProfileMenu: React.FC = () => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '');
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
    if (user) {
      setAvatarUrl(user.user_metadata?.avatar_url || '');
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!avatarUrl.trim()) return;
    setIsSaving(true);
    
    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl }
    });

    setIsSaving(false);
    if (error) {
      alert('プロフィールの更新に失敗しました');
    } else {
      setIsEditing(false);
      // Ideally trigger a refresh or user update in context, but supabase subscription should handle it
    }
  };

  if (!user) return null;

  return (
    <div className="absolute top-4 right-4 z-50" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 focus:outline-none transition-transform hover:scale-105"
      >
        <div className={`w-10 h-10 rounded-full border-2 ${isOpen ? 'border-indigo-500' : 'border-white dark:border-slate-700'} shadow-md overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center`}>
          {user.user_metadata?.avatar_url ? (
            <img 
              src={user.user_metadata.avatar_url} 
              alt={user.email || 'User'} 
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="text-slate-500 dark:text-slate-400" size={20} />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>

          <div className="p-2 space-y-1">
            {isEditing ? (
              <div className="p-2 space-y-2">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">プロフィール画像URL</p>
                <input 
                  type="url" 
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full text-xs p-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <div className="flex gap-2 justify-end mt-2">
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>キャンセル</Button>
                  <Button size="sm" onClick={handleUpdateProfile} disabled={isSaving}>
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : '保存'}
                  </Button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <Camera size={16} />
                プロフィール画像を変更
              </button>
            )}
            
            <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
            
            <button 
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
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
