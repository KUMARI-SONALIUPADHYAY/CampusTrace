
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Item, ItemType, ItemStatus, Category, User, ClaimRequest } from './types';
import { INITIAL_ITEMS } from './constants';
import { enhanceDescription, suggestCategory } from './services/geminiService';

// --- Types & Interfaces ---
type Tab = 'HOME' | 'POST' | 'MY_TRACE' | 'ADMIN';

interface Notification {
  id: string;
  text: string;
  type: 'SUCCESS' | 'INFO' | 'ERROR';
}

// --- UI Components ---

const CategoryIcon: React.FC<{ category: Category; size?: string }> = ({ category, size = "text-xl" }) => {
  switch (category) {
    case Category.ELECTRONICS: return <span className={size}>📱</span>;
    case Category.BOOKS: return <span className={size}>📚</span>;
    case Category.CLOTHING: return <span className={size}>👕</span>;
    case Category.KEYS: return <span className={size}>🔑</span>;
    case Category.CARDS: return <span className={size}>🪪</span>;
    default: return <span className={size}>📦</span>;
  }
};

const StatusBadge: React.FC<{ status: ItemStatus }> = ({ status }) => {
  const styles = {
    [ItemStatus.PENDING_APPROVAL]: 'bg-amber-100/80 text-amber-700 border-amber-200/50',
    [ItemStatus.UNCLAIMED]: 'bg-blue-100/80 text-blue-700 border-blue-200/50',
    [ItemStatus.CLAIM_REQUESTED]: 'bg-purple-100/80 text-purple-700 border-purple-200/50',
    [ItemStatus.RETURNED]: 'bg-emerald-100/80 text-emerald-700 border-emerald-200/50',
  };
  return (
    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border backdrop-blur-sm ${styles[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

// --- Camera Component ---
const CameraModal: React.FC<{ onCapture: (base64: string) => void, onClose: () => void }> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access denied", err);
        alert("Camera access denied. Please check permissions.");
        onClose();
      }
    }
    startCamera();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg');
      onCapture(dataUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-between p-6 overflow-hidden">
      <div className="w-full flex justify-between items-center text-white pt-8">
        <button onClick={onClose} className="p-3 bg-white/10 rounded-full backdrop-blur-md">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <span className="font-bold tracking-widest uppercase text-xs">Capture Item</span>
        <div className="w-12"></div>
      </div>
      <div className="relative w-full aspect-[3/4] max-h-[60vh] rounded-[40px] overflow-hidden shadow-2xl border-4 border-white/5">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <div className="w-full flex justify-center pb-12">
        <button 
          onClick={takePhoto}
          className="w-24 h-24 bg-white/20 rounded-full p-2 backdrop-blur-xl border border-white/30 active:scale-90 transition-transform"
        >
          <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-slate-900" />
          </div>
        </button>
      </div>
    </div>
  );
};

export default function App() {
  // --- State ---
  const [items, setItems] = useState<Item[]>(() => {
    const saved = localStorage.getItem('campus_items_m_v2');
    return saved ? JSON.parse(saved) : INITIAL_ITEMS;
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('campus_user_m_v2');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState<Tab>('HOME');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | 'ALL'>('ALL');

  const [newItem, setNewItem] = useState<Partial<Item>>({
    title: '',
    type: ItemType.LOST,
    category: Category.OTHER,
    location: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    imageUrl: ''
  });

  const [claimForm, setClaimForm] = useState({ message: '', contact: '' });
  const [loginEmail, setLoginEmail] = useState('');

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('campus_items_m_v2', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('campus_user_m_v2', JSON.stringify(currentUser));
  }, [currentUser]);

  // --- Handlers ---
  const addNotification = (text: string, type: 'SUCCESS' | 'INFO' | 'ERROR' = 'SUCCESS') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, text, type }, ...prev]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  };

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const item: Item = {
      ...(newItem as Item),
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      status: ItemStatus.PENDING_APPROVAL,
      claims: [],
      createdAt: new Date().toISOString()
    };

    setItems([item, ...items]);
    setNewItem({
      title: '', type: ItemType.LOST, category: Category.OTHER, 
      location: '', date: new Date().toISOString().split('T')[0], 
      description: '', imageUrl: ''
    });
    addNotification("Report submitted! Awaiting approval.", 'INFO');
    setActiveTab('MY_TRACE');
  };

  const handleAiEnhance = async () => {
    if (!newItem.description) return;
    setIsAiLoading(true);
    try {
      const enhanced = await enhanceDescription(newItem.description);
      setNewItem(prev => ({ ...prev, description: enhanced }));
      addNotification("Description polished by AI!");
    } catch {
      addNotification("AI enhancement failed", 'ERROR');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiCategorize = async () => {
    if (!newItem.title) return;
    setIsAiLoading(true);
    try {
      const cat = await suggestCategory(newItem.title, newItem.description || '');
      setNewItem(prev => ({ ...prev, category: cat as Category }));
      addNotification("Category suggested by AI!");
    } catch {
      addNotification("Categorization failed", 'ERROR');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleClaimSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !currentUser) return;

    const claim: ClaimRequest = {
      id: Math.random().toString(36).substr(2, 9),
      userId: currentUser.id,
      userEmail: currentUser.email,
      message: claimForm.message,
      contact: claimForm.contact,
      status: 'PENDING'
    };

    const updatedItems = items.map(it => it.id === selectedItem.id ? {
      ...it, status: ItemStatus.CLAIM_REQUESTED, claims: [...it.claims, claim]
    } : it);

    setItems(updatedItems);
    setSelectedItem(null);
    setClaimForm({ message: '', contact: '' });
    addNotification("Claim submitted! The owner/admin will review it.");
  };

  const handleAdminAction = (id: string, action: 'APPROVE' | 'DELETE' | 'MARK_RETURNED') => {
    if (action === 'DELETE') {
      setItems(items.filter(it => it.id !== id));
      addNotification("Report deleted.", 'INFO');
    } else {
      const statusMap = {
        'APPROVE': ItemStatus.UNCLAIMED,
        'MARK_RETURNED': ItemStatus.RETURNED
      };
      setItems(items.map(it => it.id === id ? { ...it, status: (statusMap as any)[action] } : it));
      addNotification(`Item ${action.toLowerCase()}d!`);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const matchSearch = it.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          it.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = activeCategory === 'ALL' || it.category === activeCategory;
      const isVisible = it.status !== ItemStatus.PENDING_APPROVAL || it.userId === currentUser?.id || currentUser?.role === 'ADMIN';
      return matchSearch && matchCategory && isVisible;
    });
  }, [items, searchQuery, activeCategory, currentUser]);

  const myItems = useMemo(() => items.filter(it => it.userId === currentUser?.id), [items, currentUser]);
  const myClaims = useMemo(() => items.filter(it => it.claims.some(c => c.userId === currentUser?.id)), [items, currentUser]);

  // --- Auth Guard ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-8 overflow-hidden relative">
        {/* Background Decorative Blobs */}
        <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full" />

        <div className="relative z-10 w-full max-w-sm">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-[32px] flex items-center justify-center text-4xl mb-8 mx-auto shadow-2xl shadow-blue-500/40">
            🔍
          </div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tighter text-center">CampusTrace</h1>
          <p className="text-slate-400 font-medium mb-12 text-center text-lg">Reuniting students with their gear.</p>
          
          <div className="space-y-4">
            <div className="relative">
              <input 
                type="email" 
                placeholder="University Email"
                className="w-full bg-slate-800/50 border-2 border-slate-700/50 text-white p-5 rounded-3xl outline-none focus:border-blue-500 focus:bg-slate-800/80 transition-all font-bold placeholder:text-slate-500 backdrop-blur-md"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />
            </div>
            <button 
              onClick={() => loginEmail && setCurrentUser({ id: 'u-'+Date.now(), email: loginEmail, role: 'STUDENT' })}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-3xl font-black text-lg active:scale-95 transition-all shadow-xl shadow-blue-600/20"
            >
              Enter Campus
            </button>
            <button 
              onClick={() => loginEmail && setCurrentUser({ id: 'a-'+Date.now(), email: loginEmail, role: 'ADMIN' })}
              className="w-full bg-white/5 hover:bg-white/10 text-slate-300 p-5 rounded-3xl font-bold active:scale-95 transition-all border border-white/10"
            >
              Admin Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32">
      {/* Notifications */}
      <div className="fixed top-6 left-0 right-0 z-[600] pointer-events-none flex flex-col items-center gap-3 px-6">
        {notifications.map(n => (
          <div key={n.id} className={`${n.type === 'SUCCESS' ? 'bg-emerald-600' : n.type === 'ERROR' ? 'bg-rose-600' : 'bg-blue-600'} text-white px-6 py-4 rounded-3xl text-sm font-bold shadow-2xl shadow-black/10 animate-in slide-in-from-top-12 duration-500 flex items-center gap-3 backdrop-blur-md border border-white/20`}>
            <span>{n.type === 'SUCCESS' ? '✨' : n.type === 'ERROR' ? '⚠️' : 'ℹ️'}</span>
            {n.text}
          </div>
        ))}
      </div>

      {/* Modern Header */}
      <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 px-6 pt-12 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
            {activeTab === 'HOME' && 'Trace Feed'}
            {activeTab === 'POST' && 'New Report'}
            {activeTab === 'MY_TRACE' && 'My Trace'}
            {activeTab === 'ADMIN' && 'Moderator'}
          </h1>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 bg-blue-50 w-max px-2 py-0.5 rounded-lg">
            {currentUser.email.split('@')[0]}
          </p>
        </div>
        <button 
          onClick={() => setCurrentUser(null)} 
          className="w-12 h-12 rounded-[18px] bg-slate-100 flex items-center justify-center text-xl shadow-sm hover:bg-rose-50 hover:text-rose-500 transition-colors"
        >
          👋
        </button>
      </header>

      {/* Main Container */}
      <main className="px-6 pt-8">
        
        {activeTab === 'HOME' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Search Bar */}
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Find my airpods..."
                className="w-full bg-white border border-slate-200 p-5 pl-14 rounded-[28px] font-bold text-slate-800 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl group-focus-within:scale-110 transition-transform">🔍</span>
            </div>

            {/* Category Pills */}
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar -mx-6 px-6">
              <button 
                onClick={() => setActiveCategory('ALL')}
                className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border ${activeCategory === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
              >
                All Items
              </button>
              {Object.values(Category).map(cat => (
                <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border flex items-center gap-2 ${activeCategory === cat ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                >
                  <CategoryIcon category={cat} size="text-sm" />
                  {cat}
                </button>
              ))}
            </div>

            {/* Item Grid */}
            <div className="grid grid-cols-1 gap-8">
              {filteredItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden active:scale-[0.97] transition-all"
                >
                  <div className="h-56 bg-slate-50 relative group">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                        <div className="text-5xl opacity-30 transform group-hover:rotate-12 transition-transform duration-500">
                          <CategoryIcon category={item.category} size="text-6xl" />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 mt-4 uppercase tracking-[0.2em]">{item.category}</span>
                      </div>
                    )}
                    <div className={`absolute top-6 left-6 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-lg backdrop-blur-md ${item.type === ItemType.LOST ? 'bg-rose-500/90 text-white' : 'bg-emerald-500/90 text-white'}`}>
                      {item.type}
                    </div>
                  </div>
                  <div className="p-7">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-black text-slate-800 text-xl leading-tight">{item.title}</h3>
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <StatusBadge status={item.status} />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-6 text-[11px] text-slate-500 font-bold uppercase tracking-wide">
                      <div className="flex items-center gap-1.5"><span className="opacity-60">📍</span> {item.location}</div>
                      <div className="flex items-center gap-1.5"><span className="opacity-60">🗓️</span> {item.date}</div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="py-24 text-center space-y-4">
                  <div className="text-7xl">🔭</div>
                  <h4 className="text-xl font-black text-slate-800">Clear as the Sky</h4>
                  <p className="text-slate-400 text-sm font-medium">No items found matching your filters.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'POST' && (
          <form onSubmit={handlePost} className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            {/* Form Toggle */}
            <div className="flex bg-slate-100/80 p-1.5 rounded-[24px] backdrop-blur-sm border border-slate-200/50">
              <button 
                type="button"
                onClick={() => setNewItem({ ...newItem, type: ItemType.LOST })}
                className={`flex-1 py-4 rounded-[18px] font-black text-[11px] uppercase tracking-[0.15em] transition-all ${newItem.type === ItemType.LOST ? 'bg-white shadow-lg text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
              >I Lost Something</button>
              <button 
                type="button"
                onClick={() => setNewItem({ ...newItem, type: ItemType.FOUND })}
                className={`flex-1 py-4 rounded-[18px] font-black text-[11px] uppercase tracking-[0.15em] transition-all ${newItem.type === ItemType.FOUND ? 'bg-white shadow-lg text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >I Found Something</button>
            </div>

            <div className="space-y-6">
              {/* Photo Upload Area */}
              <div 
                onClick={() => setIsCameraOpen(true)}
                className="h-64 bg-white border-2 border-dashed border-slate-200 rounded-[40px] flex flex-col items-center justify-center group overflow-hidden relative shadow-sm hover:border-blue-400 transition-colors"
              >
                {newItem.imageUrl ? (
                   <img src={newItem.imageUrl} className="w-full h-full object-cover" />
                ) : (
                   <div className="text-center">
                     <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto group-active:scale-125 transition-transform">📸</div>
                     <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Snap a Photo</span>
                   </div>
                )}
                {newItem.imageUrl && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setNewItem({...newItem, imageUrl: ''})}} className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full backdrop-blur-md">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Details</label>
                  <input 
                    type="text" required placeholder="What did you lose?"
                    className="w-full p-6 rounded-3xl bg-white border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 transition-all shadow-sm"
                    value={newItem.title}
                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <select 
                      className="w-full p-6 rounded-3xl bg-white border-2 border-slate-100 font-bold appearance-none text-slate-700 shadow-sm"
                      value={newItem.category}
                      onChange={(e) => setNewItem({ ...newItem, category: e.target.value as Category })}
                    >
                      {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <button type="button" onClick={handleAiCategorize} className="absolute right-4 top-1/2 -translate-y-1/2 text-xl hover:scale-110 active:scale-95 transition-all" title="Auto-categorize">✨</button>
                  </div>
                  <input 
                    type="date" required
                    className="w-full p-6 rounded-3xl bg-white border-2 border-slate-100 font-bold text-slate-700 shadow-sm"
                    value={newItem.date}
                    onChange={(e) => setNewItem({ ...newItem, date: e.target.value })}
                  />
                </div>

                <input 
                  type="text" required placeholder="Exact Location (e.g. Science Library, Desk 12)"
                  className="w-full p-6 rounded-3xl bg-white border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 shadow-sm"
                  value={newItem.location}
                  onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                />

                <div className="relative group">
                  <textarea 
                    rows={4} required placeholder="Tell us more about it..."
                    className="w-full p-6 rounded-[32px] bg-white border-2 border-slate-100 focus:border-blue-500 outline-none font-bold text-slate-800 resize-none shadow-sm"
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  />
                  <button 
                    type="button" 
                    disabled={isAiLoading || !newItem.description}
                    onClick={handleAiEnhance}
                    className="absolute bottom-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg"
                  >
                    {isAiLoading ? 'Magic...' : '✨ Improve'}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white p-7 rounded-[32px] font-black text-xl active:scale-[0.98] transition-all shadow-2xl shadow-slate-900/20">
              Broadcast Report
            </button>
          </form>
        )}

        {activeTab === 'MY_TRACE' && (
          <div className="space-y-12 animate-in slide-in-from-right-8 duration-500">
            <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">My Reports</h3>
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-md">{myItems.length}</span>
              </div>
              <div className="space-y-4">
                {myItems.map(it => (
                  <div key={it.id} onClick={() => setSelectedItem(it)} className="p-5 bg-white border border-slate-100 rounded-[28px] flex items-center gap-5 shadow-sm active:bg-slate-50 transition-all border-l-4 border-l-blue-500">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl shadow-inner"><CategoryIcon category={it.category} /></div>
                    <div className="flex-1">
                      <div className="font-black text-slate-800 text-sm leading-tight">{it.title}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{it.location}</div>
                    </div>
                    <StatusBadge status={it.status} />
                  </div>
                ))}
                {myItems.length === 0 && (
                  <div className="p-8 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 text-center">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">Nothing reported yet</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Claims</h3>
                <span className="bg-blue-50 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-md">{myClaims.length}</span>
              </div>
              <div className="space-y-4">
                {myClaims.map(it => (
                  <div key={it.id} onClick={() => setSelectedItem(it)} className="p-6 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border border-blue-100 rounded-[32px] flex items-center gap-5 shadow-sm active:scale-[0.98] transition-all">
                    <div className="w-14 h-14 rounded-2xl bg-white border border-blue-100 flex items-center justify-center text-2xl shadow-sm">📄</div>
                    <div className="flex-1">
                      <div className="font-black text-slate-800 text-sm leading-tight">Claim for {it.title}</div>
                      <div className="text-[10px] text-blue-500 font-black uppercase tracking-widest mt-1">{it.claims.find(c => c.userId === currentUser.id)?.status}</div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-sm text-lg">→</div>
                  </div>
                ))}
                {myClaims.length === 0 && (
                  <div className="p-8 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 text-center">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">No claims sent</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'ADMIN' && (
          <div className="space-y-8 animate-in slide-in-from-left-8 duration-500">
            <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl shadow-slate-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full translate-x-12 -translate-y-12" />
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Campus Moderation</h4>
              <p className="text-xl font-bold leading-tight">Attention Needed: <span className="text-blue-400">{items.filter(i => i.status === ItemStatus.PENDING_APPROVAL).length} Reports</span></p>
            </div>

            <div className="space-y-6">
               {items.filter(i => i.status === ItemStatus.PENDING_APPROVAL).map(it => (
                 <div key={it.id} className="p-6 bg-white border border-slate-100 rounded-[40px] shadow-sm animate-in zoom-in-95 duration-300">
                   <div className="flex gap-5 mb-6">
                      <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-4xl shadow-inner"><CategoryIcon category={it.category} /></div>
                      <div className="flex-1">
                        <h5 className="font-black text-slate-900 text-lg leading-tight">{it.title}</h5>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">📍 {it.location}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">👤 {it.userId}</p>
                      </div>
                   </div>
                   <div className="flex gap-3">
                     <button onClick={() => handleAdminAction(it.id, 'APPROVE')} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/10 active:scale-95 transition-all">Approve</button>
                     <button onClick={() => handleAdminAction(it.id, 'DELETE')} className="flex-1 bg-rose-50 text-rose-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-rose-100 active:scale-95 transition-all">Reject</button>
                   </div>
                 </div>
               ))}
               {items.filter(i => i.status === ItemStatus.PENDING_APPROVAL).length === 0 && (
                 <div className="text-center py-20 bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                    <span className="text-5xl mb-4 block">☕</span>
                    <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest">Inbox Zero</h5>
                 </div>
               )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 z-[200] bg-white/80 backdrop-blur-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 flex justify-around items-center rounded-[32px] safe-area-bottom">
        <button onClick={() => setActiveTab('HOME')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'HOME' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className="text-2xl">🏠</div>
          <span className="text-[8px] font-black uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setActiveTab('POST')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'POST' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className="text-2xl">⚡</div>
          <span className="text-[8px] font-black uppercase tracking-widest">Post</span>
        </button>
        <button onClick={() => setActiveTab('MY_TRACE')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'MY_TRACE' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
          <div className="text-2xl">💎</div>
          <span className="text-[8px] font-black uppercase tracking-widest">Trace</span>
        </button>
        {currentUser.role === 'ADMIN' && (
          <button onClick={() => setActiveTab('ADMIN')} className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${activeTab === 'ADMIN' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-600'}`}>
            <div className="text-2xl">🛡️</div>
            <span className="text-[8px] font-black uppercase tracking-widest">Admin</span>
          </button>
        )}
      </nav>

      {/* Item Detail Native Sheet */}
      {selectedItem && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-md flex items-end animate-in fade-in duration-500" onClick={() => setSelectedItem(null)}>
           <div className="w-full bg-white rounded-t-[56px] p-10 animate-in slide-in-from-bottom-full duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] max-h-[92vh] overflow-y-auto no-scrollbar shadow-[0_-20px_100px_rgba(0,0,0,0.2)]" onClick={e => e.stopPropagation()}>
              <div className="w-16 h-1.5 bg-slate-200 rounded-full mx-auto mb-10" onClick={() => setSelectedItem(null)} />
              
              <div className="flex justify-between items-start mb-10">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                     <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] shadow-sm ${selectedItem.type === ItemType.LOST ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                       {selectedItem.type}
                     </span>
                     <StatusBadge status={selectedItem.status} />
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{selectedItem.title}</h2>
                </div>
                <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center text-4xl shadow-inner border border-slate-100">
                  <CategoryIcon category={selectedItem.category} size="text-5xl" />
                </div>
              </div>

              {selectedItem.imageUrl && (
                <div className="rounded-[40px] overflow-hidden mb-10 shadow-2xl shadow-slate-900/10 border-4 border-slate-50">
                  <img src={selectedItem.imageUrl} className="w-full h-80 object-cover" />
                </div>
              )}

              <div className="bg-slate-50/50 p-8 rounded-[40px] mb-10 space-y-6 border border-slate-100/60">
                 <p className="text-slate-700 font-medium text-lg leading-relaxed">{selectedItem.description}</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Location</span>
                      <span className="font-bold text-slate-600">📍 {selectedItem.location}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Date</span>
                      <span className="font-bold text-slate-600">🗓️ {selectedItem.date}</span>
                    </div>
                 </div>
              </div>

              {/* Action Sheet Area */}
              {selectedItem.userId !== currentUser.id && selectedItem.status === ItemStatus.UNCLAIMED ? (
                <form onSubmit={handleClaimSubmit} className="space-y-6 animate-in fade-in duration-1000">
                   <div className="flex items-center gap-3 mb-2">
                     <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-black">?</div>
                     <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Claim this item</h4>
                   </div>
                   <textarea 
                     required placeholder="Unique marks, specific content, or when exactly did you last have it?"
                     className="w-full p-6 bg-slate-100/50 border-2 border-slate-100 focus:border-blue-500 rounded-[32px] outline-none font-bold text-slate-700 resize-none transition-all placeholder:text-slate-400"
                     value={claimForm.message}
                     onChange={(e) => setClaimForm({ ...claimForm, message: e.target.value })}
                   />
                   <input 
                     type="text" required placeholder="University Phone or Chat ID"
                     className="w-full p-6 bg-slate-100/50 border-2 border-slate-100 focus:border-blue-500 rounded-[28px] outline-none font-bold text-slate-700 transition-all placeholder:text-slate-400"
                     value={claimForm.contact}
                     onChange={(e) => setClaimForm({ ...claimForm, contact: e.target.value })}
                   />
                   <button type="submit" className="w-full bg-blue-600 text-white p-7 rounded-[32px] font-black text-xl active:scale-[0.98] transition-all shadow-xl shadow-blue-500/20">
                     Request Return
                   </button>
                </form>
              ) : selectedItem.userId === currentUser.id ? (
                <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 rounded-[40px] text-center shadow-xl">
                  <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-3xl mb-4 mx-auto backdrop-blur-md border border-white/10">🔒</div>
                  <h4 className="text-white font-bold mb-1">Secure Personal Record</h4>
                  <p className="text-slate-400 text-xs font-medium">Verified claims will appear in your 'My Trace' hub soon.</p>
                </div>
              ) : (
                <button onClick={() => setSelectedItem(null)} className="w-full bg-slate-100 text-slate-800 p-7 rounded-[32px] font-black text-xl active:scale-95 transition-all">
                   Dismiss
                </button>
              )}

              {/* Moderator Extra Controls */}
              {currentUser.role === 'ADMIN' && (
                <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                  <h5 className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Admin Overrides</h5>
                  <div className="flex gap-4">
                    <button onClick={() => handleAdminAction(selectedItem.id, 'MARK_RETURNED')} className="flex-1 bg-slate-900 text-white p-4 rounded-2xl font-bold text-xs uppercase tracking-widest">Mark as Resolved</button>
                    <button onClick={() => handleAdminAction(selectedItem.id, 'DELETE')} className="flex-1 bg-rose-50 text-rose-600 p-4 rounded-2xl font-bold text-xs uppercase tracking-widest border border-rose-100">Delete Permanently</button>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      {/* Native-style Camera Modal */}
      {isCameraOpen && (
        <CameraModal 
          onClose={() => setIsCameraOpen(false)} 
          onCapture={(data) => {
            setNewItem({ ...newItem, imageUrl: data });
            setIsCameraOpen(false);
            addNotification("Photo captured successfully!");
          }} 
        />
      )}
    </div>
  );
}
