import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { FocusMode } from './components/FocusMode';
import { ReviewMode } from './components/ReviewMode';
import { LinkPocket } from './components/LinkPocket';
import { Settings } from './components/Settings';
import { MOCK_MESSAGES, MOCK_SUMMARY, DEFAULT_SETTINGS, MOCK_WORKSPACES } from './constants';
import { Message, ViewState, UserSettings, Workspace, DailySummary } from './types';
import { api } from './services/api';

function App() {
  const [currentView, setCurrentView] = useState<ViewState>('focus');
  const [isLocked, setIsLocked] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]); // Init empty
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('all');
  const [userSettings, setUserSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [nextDeliveryTime, setNextDeliveryTime] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Derived state
  const urgentMessages = messages.filter(m => m.isUrgent);
  const webLinks = messages.filter(m => m.sourceType === 'web_clip' || m.content.includes('http'));
  // const bufferCount = messages.filter(m => !m.isUrgent).length; 
  // -> Replaced by real pending count from DB for Focus Mode

  // Fetch Data
    const fetchData = async () => {
      try {
      // 0. Workspaces
      const wsList = await api.getWorkspaces();
      setWorkspaces(wsList);

      // 0.5 Settings (Fetch first to apply logic)
      const settings = await api.getSettings();
      let currentSettings = userSettings;
      if (settings) {
        setUserSettings(settings);
        currentSettings = settings;
      }

        // 1. Pending Count (for Focus Mode)
        const count = await api.getPendingCount();
        setPendingCount(count);

        // 2. Latest Summary (for Review Mode)
        const latestSummary = await api.getLatestSummary();
        if (latestSummary) {
          // Fix missing keyTopics from API
          if (!latestSummary.keyTopics) latestSummary.keyTopics = []; 
          setSummary(latestSummary);
        } else {
            setSummary(null);
        }

      // 3. Messages
      // Filter by selected workspace if needed on client side (API supports status but we filter workspace here)
      const msgs = await api.getMessages(undefined, selectedWorkspaceId);

      // Apply alert keywords & urgency logic on client side for now (until we persist user settings in DB)
      const enrichedMsgs = msgs.map(m => {
        const matchedKeywords = currentSettings.alertKeywords.filter(k => m.content.includes(k));
        const isVip = currentSettings.vipUserIds.includes(m.authorId || '') || currentSettings.vipUserIds.includes(m.authorName);
        const isUrgent = matchedKeywords.length > 0 || isVip;
        
        return {
          ...m,
          isUrgent,
          alertKeywords: currentSettings.alertKeywords // Pass keywords for highlighting
        };
      });

      setMessages(enrichedMsgs);

      } catch (e) {
        console.error("Failed to fetch data:", e);
        // Fallback to mocks if needed, or just show empty
        // setMessages(MOCK_MESSAGES);
      }
    };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [selectedWorkspaceId]); // Re-fetch when filter changes

  // Handle Dark Mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Calculate next delivery time
    const calculateNextDelivery = () => {
      const now = new Date();
      const currentHour = now.getHours();
      // Delivery schedule: 08:00, 13:00, 19:00
      const schedule = [8, 13, 19];
      
      const nextHour = schedule.find(h => h > currentHour);
      
      if (nextHour) {
        setNextDeliveryTime(`${nextHour}:00`);
      } else {
        // If passed all, it's tomorrow 8:00
        setNextDeliveryTime('翌日 08:00');
      }
    };

    calculateNextDelivery();
    const timer = setInterval(calculateNextDelivery, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  // Toggle Lock Logic
  const handleToggleLock = () => {
    setIsLocked(!isLocked);
    // If we unlock, auto-switch to review mode to see what was missed
    if (isLocked) {
      setCurrentView('review');
    } else {
      setCurrentView('focus');
    }
  };

  const handleAddLink = async (url: string) => {
    // 1. Create temporary optimistic item
    const tempLink: Message = {
      id: `temp-${Date.now()}`,
      sourceType: 'web_clip',
      content: url, 
      authorName: 'あなた',
      permalink: url,
      isUrgent: false,
      isProcessed: true,
      createdAt: new Date().toISOString(),
      summary: '保存中...',
      tags: ['Saved'],
    };
    setMessages(prev => [tempLink, ...prev]);

    // 2. Call API
    const savedLink = await api.addLink(url);

    // 3. Update with real data or handle error
    if (savedLink) {
      setMessages(prev => prev.map(m => m.id === tempLink.id ? savedLink : m));
    } else {
      // Remove temp link on failure or show error
      setMessages(prev => prev.filter(m => m.id !== tempLink.id));
      alert('保存に失敗しました');
    }
  };

  const handleArchiveMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateSettings = async (newSettings: UserSettings) => {
    // Optimistic update
    setUserSettings(newSettings);
    
    // Call API
    const success = await api.updateSettings(newSettings);
    if (success) {
      console.log('Settings updated successfully');
      fetchData(); // Refresh to apply new settings to messages immediately
    } else {
      console.error('Failed to update settings');
      // Revert or show error (optional)
    }
  };

  const handleAddWorkspace = (ws: Workspace) => {
    setWorkspaces(prev => [...prev, ws]);
  };

  const handleRemoveWorkspace = (id: string) => {
    setWorkspaces(prev => prev.filter(w => w.id !== id));
  };

  const handleArchiveAll = async () => {
    // Optimistic update
    setMessages([]); 
    
    // Call backend
    const success = await api.archiveAllMessages(selectedWorkspaceId);
    if (success) {
      await fetchData(); // Refresh to ensure sync
    } else {
      console.error('Failed to archive all messages');
      // Ideally revert state or show error
      fetchData(); // Re-fetch to restore correct state
    }
  };

  const handleDeleteLink = async (id: string) => {
    // Optimistic update
    setMessages(prev => prev.filter(m => m.id !== id));

    const success = await api.deleteLink(id);
    if (!success) {
      alert('削除に失敗しました');
      fetchData(); // Revert
    }
  };

  // View Routing
  const renderView = () => {
    switch (currentView) {
      case 'focus':
        return isLocked ? (
          <FocusMode 
            urgentMessages={urgentMessages} 
            totalHidden={pendingCount} 
            nextDeliveryTime={nextDeliveryTime}
          />
        ) : (
          <ReviewMode 
            messages={messages} 
            summary={summary} 
            onArchiveAll={handleArchiveAll}
            onArchiveMessage={handleArchiveMessage}
            workspaces={workspaces}
            selectedWorkspaceId={selectedWorkspaceId}
            onSelectWorkspace={setSelectedWorkspaceId}
            onRefresh={fetchData} // Pass refresh handler
          />
        );
      case 'review':
        return (
          <ReviewMode 
            messages={messages} 
            summary={summary} 
            onArchiveAll={handleArchiveAll}
            onArchiveMessage={handleArchiveMessage}
            workspaces={workspaces}
            selectedWorkspaceId={selectedWorkspaceId}
            onSelectWorkspace={setSelectedWorkspaceId}
            onRefresh={fetchData} // Pass refresh handler
          />
        );
      case 'pocket':
        return <LinkPocket links={webLinks} onAddLink={handleAddLink} onDeleteLink={handleDeleteLink} />;
      case 'settings':
        return (
          <Settings 
            settings={userSettings} 
            onSave={handleUpdateSettings} 
            workspaces={workspaces}
            onAddWorkspace={handleAddWorkspace}
            onRemoveWorkspace={handleRemoveWorkspace}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        );
      default:
        return <div>View not found</div>;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-50 overflow-hidden transition-colors duration-300">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView}
        isLocked={isLocked}
        onToggleLock={handleToggleLock}
      />
      
      <main className="flex-1 h-screen overflow-y-auto bg-slate-50 dark:bg-[#0B1121] relative transition-colors duration-300">
         {/* Background Ambient Effect */}
         <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
            {/* Dynamic Background Colors based on Mode */}
            <div className={`
              absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full blur-3xl transition-colors duration-1000
              ${isLocked 
                ? 'bg-teal-200/40 dark:bg-teal-900/10'  // Calm Mode Colors
                : 'bg-indigo-200/40 dark:bg-indigo-900/10' // Focus Mode Colors
              }
            `}></div>
            <div className={`
              absolute bottom-[-10%] left-[10%] w-[400px] h-[400px] rounded-full blur-3xl transition-colors duration-1000
              ${isLocked 
                ? 'bg-emerald-200/40 dark:bg-emerald-900/10' // Calm Mode Colors
                : 'bg-blue-200/40 dark:bg-blue-900/10' // Focus Mode Colors
              }
            `}></div>
         </div>
         
         <div className="relative z-10 h-full">
            {renderView()}
         </div>
      </main>
    </div>
  );
}

export default App;