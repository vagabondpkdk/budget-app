import { useRef, useEffect, useState, lazy, Suspense } from 'react';
const PdfImport = lazy(() => import('./components/PdfImport/PdfImport').then(m => ({ default: m.PdfImport })));
import { useStore } from './store/useStore';
import type { SyncStatus } from './store/useStore';
import { Dashboard } from './components/Dashboard/Dashboard';
import { DailyView } from './components/DailyView/DailyView';
import { CardManager } from './components/CardManager/CardManager';
import { Analytics } from './components/Analytics/Analytics';
import { TransactionForm } from './components/TransactionForm/TransactionForm';
import type { Tab } from './types';
import { Home, CalendarDays, CreditCard, BarChart3, Plus, Download, Upload, Cloud, CloudOff, Loader, CloudUpload } from 'lucide-react';
import { format } from 'date-fns';
import { TRANSLATIONS } from './lib/i18n';
import type { Lang } from './lib/i18n';
import { APP_VERSION, BUILD_DATE, BUILD_DESC } from './lib/version';

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

const THEMES: { id: string; color: string; label: string }[] = [
  { id: 'navy',     color: '#E94560', label: 'Navy' },
  { id: 'obsidian', color: '#7C6FCD', label: 'Obsidian' },
  { id: 'zinc',     color: '#F59E0B', label: 'Zinc' },
  { id: 'jade',     color: '#10B981', label: 'Jade' },
  { id: 'slate',    color: '#38BDF8', label: 'Slate' },
];

function ThemeToggle() {
  const { theme, setTheme } = useStore();
  return (
    <div className="flex gap-1.5 items-center">
      {THEMES.map(t => (
        <button
          key={t.id}
          title={t.label}
          onClick={() => setTheme(t.id)}
          style={{
            width: 15,
            height: 15,
            borderRadius: '50%',
            background: t.color,
            border: `2px solid ${theme === t.id ? 'rgba(255,255,255,0.9)' : 'transparent'}`,
            boxShadow: theme === t.id ? `0 0 0 1.5px ${t.color}80` : 'none',
            padding: 0,
            cursor: 'pointer',
            transition: 'transform 0.15s, box-shadow 0.15s',
            transform: theme === t.id ? 'scale(1.25)' : 'scale(1)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

export default function App() {
  const { activeTab, setActiveTab, importData, initSync, uploadToCloud, syncStatus,
          transactions, cards, currentYear, currentMonth } = useStore();
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const fileRef = useRef<HTMLInputElement>(null);
  const excelImportRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [showVersionInfo, setShowVersionInfo] = useState(false);

  useEffect(() => { initSync(); }, []);

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const { importFromExcel } = await import('./utils/exportImport');
      const { transactions: newTxns, errors } = await importFromExcel(file);
      if (newTxns.length === 0) {
        setImportMsg(`가져올 데이터가 없습니다.${errors.length ? '\n' + errors.slice(0,3).join('\n') : ''}`);
        return;
      }
      const store = useStore.getState();
      newTxns.forEach(t => store.addTransaction(t));
      setImportMsg(`✅ ${newTxns.length}건 가져오기 완료${errors.length ? `\n⚠️ ${errors.length}개 행 오류` : ''}`);
    } catch {
      setImportMsg('❌ 파일 읽기 실패. 올바른 엑셀 파일인지 확인해주세요.');
    }
    setTimeout(() => setImportMsg(null), 4000);
  }

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
          <div className="flex items-center gap-2.5 mb-0.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'var(--color-highlight)', boxShadow: '0 2px 8px color-mix(in srgb, var(--color-highlight) 40%, transparent)' }}>
              💰
            </div>
            <h1 className="text-lg font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>Budget</h1>
          </div>
          <p className="text-xs mb-2 pl-0.5" style={{ color: 'var(--color-muted)', opacity: 0.6 }}>Kyle & Ella</p>
          <div className="flex items-center justify-between">
            <SyncBadge status={syncStatus} />
            <LangToggle />
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span style={{ fontSize: 10, color: 'var(--color-muted)', opacity: 0.6 }}>Theme</span>
            <ThemeToggle />
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
          {/* Cloud save */}
          <button
            onClick={uploadToCloud}
            disabled={syncStatus === 'syncing'}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-3 font-medium transition-colors"
            style={{
              background: syncStatus === 'syncing' ? 'rgba(255,255,255,0.05)' : 'var(--color-highlight)',
              color: syncStatus === 'syncing' ? 'var(--color-muted)' : 'white',
              opacity: syncStatus === 'syncing' ? 0.7 : 1,
            }}
          >
            {syncStatus === 'syncing'
              ? <><Loader size={14} className="animate-spin" /> {T.syncing_label}</>
              : <><CloudUpload size={14} /> {T.save_cloud}</>
            }
          </button>

          {/* Export */}
          <p className="text-xs px-3 mb-1" style={{ color: 'var(--color-muted)', opacity: 0.6 }}>{T.section_export}</p>
          <button
            onClick={async () => { const { exportToExcel } = await import('./utils/exportImport'); exportToExcel(transactions, cards); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs mb-1 hover:bg-white/5"
            style={{ color: 'var(--color-muted)' }}
          >
            <Download size={13} /> {T.export_excel}
          </button>
          <button
            onClick={async () => { const { exportToPDF } = await import('./utils/exportImport'); exportToPDF(transactions, cards, currentYear, currentMonth); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs mb-3 hover:bg-white/5"
            style={{ color: 'var(--color-muted)' }}
          >
            <Download size={13} /> {T.export_pdf}
          </button>

          {/* Import */}
          <p className="text-xs px-3 mb-1" style={{ color: 'var(--color-muted)', opacity: 0.6 }}>{T.section_import}</p>
          <button
            onClick={() => setShowPdfImport(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs mb-1 hover:bg-white/5"
            style={{ color: 'var(--color-muted)' }}
          >
            <Upload size={13} /> {T.import_pdf}
          </button>
          <button
            onClick={() => excelImportRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs mb-1 hover:bg-white/5"
            style={{ color: 'var(--color-muted)' }}
          >
            <Upload size={13} /> {T.import_excel}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs mb-2 hover:bg-white/5"
            style={{ color: 'var(--color-muted)', opacity: 0.5 }}
          >
            <Upload size={13} /> {T.import_json}
          </button>

          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <input ref={excelImportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />

          {importMsg && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs whitespace-pre-line"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-text)' }}>
              {importMsg}
            </div>
          )}

          <div className="flex items-center justify-between mt-2 px-1">
            <p style={{ fontSize: 10, color: 'var(--color-muted)' }}>
              {format(new Date(), 'yyyy. M. d')}
            </p>
            <span
              title={`${BUILD_DATE} · ${BUILD_DESC}`}
              style={{
                fontSize: 10,
                color: 'var(--color-highlight)',
                background: 'color-mix(in srgb, var(--color-highlight) 15%, transparent)',
                padding: '1px 6px',
                borderRadius: 6,
                cursor: 'default',
                letterSpacing: '0.02em',
              }}
            >
              {APP_VERSION}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 md:ml-60 flex flex-col" style={{ minHeight: '100vh', overflowX: 'hidden', maxWidth: '100%' }}>
        {/* Desktop header */}
        <header
          className="hidden md:flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{
            backgroundColor: 'var(--color-surface-blur)',
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
          <div className="flex items-center gap-2">
            <SyncBadge status={syncStatus} />
            <button
              onClick={() => setShowVersionInfo(true)}
              style={{ fontSize: 10, color: 'var(--color-highlight)', background: 'rgba(233,69,96,0.15)', padding: '1px 6px', borderRadius: 6, border: 'none', cursor: 'pointer' }}
            >
              {APP_VERSION}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={uploadToCloud}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: syncStatus === 'syncing' ? 'rgba(255,255,255,0.08)' : 'var(--color-highlight)',
                color: syncStatus === 'syncing' ? 'var(--color-muted)' : 'white',
              }}
            >
              {syncStatus === 'syncing'
                ? <Loader size={12} className="animate-spin" />
                : <CloudUpload size={12} />
              }
              {syncStatus === 'syncing' ? T.syncing_label : T.save_cloud}
            </button>
            <ThemeToggle />
            <LangToggle />
          </div>
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
        </div>
      </main>

      {/* ── Add Transaction Bottom Sheet ── */}
      {activeTab === 'add' && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setActiveTab('dashboard')}
        >
          <div
            className="w-full overflow-y-auto rounded-t-3xl"
            style={{
              backgroundColor: 'var(--color-surface)',
              maxHeight: '92vh',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />
            <TransactionForm onClose={() => setActiveTab('dashboard')} />
          </div>
        </div>
      )}

      {showPdfImport && (
        <Suspense fallback={null}>
          <PdfImport onClose={() => setShowPdfImport(false)} />
        </Suspense>
      )}

      {showVersionInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
          onClick={() => setShowVersionInfo(false)}>
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 w-full max-w-xs shadow-xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-highlight)' }}>{APP_VERSION}</span>
              <button onClick={() => setShowVersionInfo(false)} className="text-[var(--color-muted)] hover:text-white text-lg leading-none">✕</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-muted)' }}>{BUILD_DATE}</p>
            <p style={{ fontSize: 12, color: 'var(--color-text)', marginTop: 6, lineHeight: 1.5 }}>{BUILD_DESC}</p>
          </div>
        </div>
      )}

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
