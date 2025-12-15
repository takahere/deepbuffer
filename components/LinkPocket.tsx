import React, { useState, useMemo } from 'react';
import { Message } from '../types';
import { Link2, ExternalLink, Hash, Plus, Clock, Search, Filter, Trash2 } from 'lucide-react';
import { Button } from './Button';

interface LinkPocketProps {
  links: Message[];
  onAddLink: (url: string) => void;
  onDeleteLink?: (id: string) => void;
}

type FilterType = 'all' | 'web' | 'slack';

export const LinkPocket: React.FC<LinkPocketProps> = ({ links, onAddLink, onDeleteLink }) => {
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      onAddLink(urlInput);
      setUrlInput('');
    }
  };

  // Filtering Logic
  const filteredLinks = useMemo(() => {
    return links.filter(link => {
      // 1. Search Filter
      const searchContent = `${link.content} ${link.summary || ''} ${link.authorName} ${link.tags?.join(' ') || ''}`.toLowerCase();
      const matchesSearch = searchContent.includes(searchQuery.toLowerCase());

      // 2. Type Filter
      let matchesType = true;
      if (filterType === 'web') matchesType = link.sourceType === 'web_clip';
      if (filterType === 'slack') matchesType = link.sourceType === 'slack';

      return matchesSearch && matchesType;
    });
  }, [links, searchQuery, filterType]);

  return (
    <div className="max-w-4xl mx-auto pt-8 px-4 md:px-6 pb-20 h-full flex flex-col">
      <div className="flex-shrink-0">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-3">
          <Link2 className="text-blue-500 dark:text-blue-400" /> ユニバーサル・リンクポケット
        </h2>
        
        {/* Add Link Input */}
        <div className="bg-white dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 mb-6 shadow-sm dark:shadow-black/20">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="保存したいURLをここに貼り付け..."
              className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all w-full"
              required
            />
            <Button type="submit" variant="primary" className="w-full sm:w-auto justify-center">
              <Plus size={18} className="mr-2" />
              追加
            </Button>
          </form>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-between items-start sm:items-center sticky top-0 bg-slate-50/95 dark:bg-[#0B1121]/95 backdrop-blur py-2 z-20 transition-colors duration-300">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タイトルやタグで検索..." 
              className="w-full bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex bg-white dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50 w-full sm:w-auto overflow-x-auto">
            {(['all', 'web', 'slack'] as FilterType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex-1 sm:flex-initial whitespace-nowrap ${
                  filterType === type 
                    ? 'bg-indigo-600 text-white shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                }`}
              >
                {type === 'all' && 'すべて'}
                {type === 'web' && 'Web'}
                {type === 'slack' && 'Slack'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline View */}
      <div className="relative pl-4 flex-1">
        {/* Timeline Line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />

        <div className="flex flex-col gap-6 pb-10">
          {filteredLinks.length === 0 && (
            <div className="md:col-span-2 ml-12 py-8 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
              <p className="text-slate-500 italic mb-2">表示するリンクがありません。</p>
              {(searchQuery || filterType !== 'all') && (
                 <button onClick={() => {setSearchQuery(''); setFilterType('all');}} className="text-indigo-500 dark:text-indigo-400 text-sm hover:underline">
                   フィルタをクリア
                 </button>
              )}
            </div>
          )}
          
          {filteredLinks.map((link) => (
            <div key={link.id} className="relative group pl-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Timeline Dot */}
              <div className="absolute left-[19px] top-6 w-4 h-4 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-500/50 group-hover:border-indigo-500 group-hover:scale-110 transition-all z-10 box-content"></div>

              {/* Date Label (Floating left or above) */}
              <div className="absolute -left-20 top-6 text-xs text-slate-400 dark:text-slate-500 w-24 text-right pr-12 hidden xl:block">
                {new Date(link.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>

              {/* Content Card */}
              <div className="h-full flex flex-col bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all hover:translate-x-1 group-hover:border-slate-300 dark:group-hover:border-slate-600/50 shadow-sm">
                
                {/* OGP Image (if available) */}
                {link.ogImage && (
                  <div className="w-full h-48 overflow-hidden bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/50">
                    <img 
                      src={link.ogImage} 
                      alt={link.ogTitle || "Preview"} 
                      className="w-full h-full object-cover object-center"
                      onError={(e) => (e.currentTarget.style.display = 'none')} 
                    />
                  </div>
                )}

                <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                   <div className="flex items-center gap-3">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                        link.sourceType === 'web_clip' 
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-400/10 border-blue-200 dark:border-blue-400/10' 
                          : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/10'
                      }`}>
                        {link.sourceType === 'web_clip' ? 'WEB' : 'SLACK'}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(link.createdAt).toLocaleDateString()} {new Date(link.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                   </div>
                     <div className="flex items-center gap-2">
                   <a 
                    href={link.permalink || '#'} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="リンクを開く"
                   >
                     <ExternalLink size={16} />
                   </a>
                       {onDeleteLink && (
                         <button
                           onClick={() => onDeleteLink(link.id)}
                           className="text-slate-400 hover:text-red-500 transition-colors bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                           title="削除"
                         >
                           <Trash2 size={16} />
                         </button>
                       )}
                     </div>
                </div>
                
                  {/* OGP Title or Content */}
                  <h3 className="text-slate-800 dark:text-slate-200 font-bold mb-2 text-lg leading-snug break-words">
                    {link.ogTitle || link.content}
                </h3>
                
                  {/* OGP Description */}
                  {link.ogDescription && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-3 leading-relaxed">
                      {link.ogDescription}
                    </p>
                  )}
                  
                  {/* Site Name & Original URL */}
                  {(link.ogSiteName || (link.ogTitle && link.content !== link.ogTitle)) && (
                     <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 truncate">
                       {link.ogSiteName && <span className="font-medium mr-2">{link.ogSiteName}</span>}
                       {link.content}
                     </p>
                  )}
                  
                  {/* AI Summary (if any, secondary priority) */}
                  {link.summary && !link.ogDescription && (
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 mb-3 border border-slate-100 dark:border-slate-800/50">
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {link.summary}
                    </p>
                  </div>
                )}

                  <div className="flex items-center gap-2 flex-wrap mt-auto pt-2">
                   {link.tags?.map(tag => (
                      <span key={tag} className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                   ))}
                   {link.authorName && (
                     <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 ml-auto">
                       <Hash size={10}/> Added by {link.authorName}
                     </span>
                   )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};