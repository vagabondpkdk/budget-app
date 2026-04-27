import { useRef, useEffect } from 'react';
import { useStore } from './store/useStore';
import type { SyncStatus } from './store/useStore';
import { Dashboard } from './components/Dashboard/Dashboard';
import { DailyView } from './components/DailyView/DailyView';
import { CardManager } from './components/CardManager/CardManager';
import { Analytics } from './components/Analytics/Analytics';
import { TransactionForm } from './components/TransactionForm/TransactionForm';
import type { Tab } from './types';
import { Home, CalendarDays, CreditCard, BarChart3, Plus, Download, Upload, Cloud, CloudOff, Loader } from 'lucide-react';
import { format } from 'date-fns';
import { TRANSLATIONS } from './lib/i18n';
import type { Lang } from './lib/i18n';

function DueBanner() {
  const cards = useStore(s => s.cards);
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const today = new Date().getDate();
  const soonCards = cards.filter(c => c.isActive && c.payDueDay && c.payDueDay >= today && c.payDueDay - today <= 3);
  if (soonCards.length === 0) return null;
  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 mb-3">
      <p className="text-xs text-yellow-300 font-medium">
        {T.due_banner(soonCards.map(c => `${c.name} (${c.payDueDay}일)`).join(', '))}
      </p>
    </div>
  );
}

function SyncBadge({ status }: { status: SyncStatus }) {
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  if (status === 'syncing') return <span className="flex items-center gap-1 text-xs text-yellow-300"><Loader size={12} className="animate-spin" /> {T.sync_syncing}</span>;
  if (status === 'synced') return <span className="flex items-center gap-1 text-xs text-green-400"><Cloud size={12} /> {T.sync_synced}</span>;
  if (status === 'error') return <span className="flex items-center gap-1 text-xs text-red-400"><CloudOff size={12} /> {T.sync_offline}</span>;
  return null;
}

function LangToggle() {
  const { language, setLanguage } = useStore();
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/10">
      {(['ko', 'en'] as Lang[]).map(l => (
        <button key={l} onClick={() => setLanguage(l)}
          className={`px-2.5 py-1 text-xs font-medium transition-colors ${
            language === l ? 'bg-[var(--color-highlight)] text-white' : 'text-[var(--color-muted)] hover:bg-white/10'
          }`}
        >
          {l === 'ko' ? '한국어' : 'EN'}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const { activeTab, setActiveTab, exportData, importData, initSync, syncStatus } = useStore();
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { initSync(); }, []);

  const NAV_ITEMS: { tab: Tab; icon: React.ComponentType<{ size?: number; className?: string }>; label: string }[] = [
    { tab: 'dashboard', icon: Home, label: T.nav_dashboard },
    { tab: 'daily', icon: CalendarDays, label: T.nav_daily },
    { tab: 'cards', icon: CreditCard, label: T.nav_cards },
    { tab: 'analytics', icon: BarChart3, label: T.nav_analytics },
    { tab: 'add', icon: Plus, label: T.nav_add },
  ];

  const TITLE: Record<Tab, string> = {
    dashboard: T.nav_dashboard, daily: T.nav_daily,
    cards: T.nav_cards, analytics: T.nav_analytics, add: T.nav_add,
  };

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (ev.target?.result) importData(ev.target.result as string);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-primary)' }} className="flex">

      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0"
        style={{ width: 240, backgroundColor: 'var(--color-surface)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>💰 Budget</h1>
          <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--color-muted)' }}>Kyle & Ella</p>
          <div className="flex items-center justify-between">
            <SyncBadge status={syncStatus} />
            <LangToggle />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ tab, icon: Icon, label }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeTab === tab ? 'var(--color-highlight)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--color-muted)',
              }}
              onMouseEnter={e => { if (activeTab !== tab) (e.target as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { if (activeTab !== tab) (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={exportData}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-1"
            style={{ color: 'var(--color-muted)' }}
          >
            <Download size={14} /> {T.export_data}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-2"
            style={{ color: 'var(--color-muted)' }}
          >
            <Upload size={14} /> {T.import_data}
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <p className="text-center" style={{ fontSize: 10, color: 'var(--color-muted)' }}>
            {format(new Date(), 'yyyy. M. d')}
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 md:ml-60 flex flex-col" style={{ minHeight: '100vh' }}>
        {/* Desktop header */}
        <header
          className="hidden md:flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{
            backgroundColor: 'rgba(22, 33, 62, 0.8)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>{TITLE[activeTab]}</h2>
          <SyncBadge status={syncStatus} />
        </header>

        {/* Mobile top bar: safe-area padding here (NOT in content) */}
        <div
          className="md:hidden flex items-center justify-between px-4 border-b border-white/10 sticky top-0 z-10"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
            paddingBottom: '8px',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <SyncBadge status={syncStatus} />
          <LangToggle />
        </div>

        {/* Content — no safe-top here; top bar above handles it */}
        <div
          className="flex-1 px-4 py-4 md:px-6 overflow-y-auto overflow-x-hidden"
          style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
        >
          <DueBanner />
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'daily' && <DailyView />}
          {activeTab === 'cards' && <CardManager />}
          {activeTab === 'analytics' && <Analytics />}
          {activeTab === 'add' && (
            <div style={{ maxWidth: 512, margin: '0 auto', width: '100%', minWidth: 0 }}>
              <TransactionForm onClose={() => setActiveTab('dashboard')} />
            </div>
          )}
        </div>
      </main>

      {/* ── Mobile Bottom Bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex safe-bottom"
        style={{ backgroundColor: 'var(--color-surface)', borderTop: '1px solid rgba(255,255,255,0.1)' }}
      >
        {NAV_ITEMS.map(({ tab, icon: Icon, label }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2"
            style={{ color: activeTab === tab ? 'var(--color-highlight)' : 'var(--color-muted)' }}
          >
            {tab === 'add' ? (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border-4"
                style={{
                  backgroundColor: 'var(--color-highlight)',
                  borderColor: 'var(--color-primary)',
                  marginTop: -20,
                }}
              >
                <Icon size={20} className="text-white" />
              </div>
            ) : (
              <Icon size={20} />
            )}
            <span style={{ fontSize: 10 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
