import { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { X, Loader, CheckCircle, AlertCircle, AlertTriangle, Files } from 'lucide-react';
import { formatCurrency } from '../../utils';
import type { Transaction } from '../../types';
import { guessCategory, getDuplicateStatus, type DuplicateStatus } from '../../utils/pdfParser';

interface Props { onClose: () => void; }

type Step = 'upload' | 'parsing' | 'preview' | 'done';

interface PreviewRow {
  date: string;
  note: string;
  amount: number;
  type: 'expense' | 'income' | 'cashback';
  category: Transaction['category'];
  cardId: string;
  selected: boolean;
  dupStatus: DuplicateStatus;
  bank: string;
}

export function PdfImport({ onClose }: Props) {
  const { cards, transactions: existingTxns, addTransaction } = useStore();
  const activeCards = cards.filter(c => c.isActive);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep]                 = useState<Step>('upload');
  const [banks, setBanks]               = useState<string[]>([]);
  const [rows, setRows]                 = useState<PreviewRow[]>([]);
  const [selectedCard, setSelectedCard] = useState(activeCards[0]?.id ?? '');
  const [error, setError]               = useState('');
  const [parseProgress, setParseProgress] = useState('');
  const [rawTextPreview, setRawTextPreview] = useState('');
  const [importedCount, setImportedCount]   = useState(0);
  const [fileErrors, setFileErrors]         = useState<string[]>([]);

  async function handleFiles(files: FileList) {
    if (!files.length) return;
    setStep('parsing');
    setError('');
    setFileErrors([]);
    setBanks([]);

    const { extractPdfText, detectBank, parseTransactions } = await import('../../utils/pdfParser');

    const allRows: PreviewRow[] = [];
    const detectedBanks: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setParseProgress(`파일 분석 중 ${i + 1} / ${files.length} — ${file.name}`);
      try {
        const text = await extractPdfText(file);
        if (i === 0) setRawTextPreview(text.slice(0, 800));

        const detectedBank = detectBank(text);
        if (!detectedBanks.includes(detectedBank)) detectedBanks.push(detectedBank);

        const parsed = parseTransactions(text, detectedBank);
        if (parsed.length === 0) {
          errors.push(`${file.name}: 거래 내역을 찾지 못했어요`);
          continue;
        }

        for (const p of parsed) {
          const dupStatus = getDuplicateStatus(
            { date: p.date, note: p.note, amount: p.amount },
            existingTxns,
          );
          allRows.push({
            date: p.date, note: p.note, amount: p.amount,
            type: p.type, category: guessCategory(p.note),
            cardId: selectedCard,
            selected: dupStatus === 'none',
            dupStatus,
            bank: detectedBank,
          });
        }
      } catch (e: any) {
        errors.push(`${file.name}: ${e?.message ?? '알 수 없는 오류'}`);
      }
    }

    setBanks(detectedBanks);
    setFileErrors(errors);

    if (allRows.length === 0) {
      setError('선택한 파일에서 거래 내역을 찾지 못했어요. 추출된 텍스트를 확인해주세요.');
      setStep('preview');
      return;
    }

    // 날짜 순 정렬
    allRows.sort((a, b) => a.date.localeCompare(b.date));
    setRows(allRows);
    setStep('preview');
  }

  function handleImport() {
    const toImport = rows.filter(r => r.selected);
    toImport.forEach(r => {
      const finalAmount = (r.type === 'income' || r.type === 'cashback')
        ? -Math.abs(r.amount) : Math.abs(r.amount);
      addTransaction({
        date: r.date, note: r.note, amount: finalAmount,
        category: r.category, cardId: r.cardId,
        user: 'Both', type: r.type, isRecurring: false,
      });
    });
    setImportedCount(toImport.length);
    setStep('done');
  }

  const allRows            = rows.length;
  const confirmedDupCount  = rows.filter(r => r.dupStatus === 'confirmed').length;
  const possibleDupCount   = rows.filter(r => r.dupStatus === 'possible').length;
  const dupCount           = confirmedDupCount + possibleDupCount;
  const selectedCount      = rows.filter(r => r.selected).length;
  const totalExpense       = rows.filter(r => r.selected && r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  // 은행별 색상
  const BANK_COLOR: Record<string, string> = {
    Chase: '#0066CC', AMEX: '#007AC0', 'Apple Card': '#555', Citi: '#E31837',
    BOA: '#E31837', Discover: '#FF6600', 'Wells Fargo': '#D71E28',
    'Capital One': '#D03027', 'US Bank': '#0C2B5E', Unknown: '#888',
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg flex flex-col bg-[var(--color-surface)] rounded-2xl overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-[var(--color-text)] text-sm">PDF 스테이먼트 가져오기</h3>
            {banks.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {banks.map(b => (
                  <span key={b} className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                    style={{ backgroundColor: (BANK_COLOR[b] ?? '#888') + 'cc' }}>
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-muted)]">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── Upload ── */}
          {step === 'upload' && (
            <div className="p-6 flex flex-col items-center gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-white/20 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-[var(--color-highlight)] transition-colors"
              >
                <Files size={40} className="text-[var(--color-muted)]" />
                <p className="text-sm text-[var(--color-text)] font-medium">PDF 파일을 선택하세요</p>
                <p className="text-xs text-[var(--color-muted)] text-center">
                  여러 파일 동시 선택 가능<br />
                  Chase · AMEX · Apple Card · Citi · BOA · Discover 지원
                </p>
                <span className="px-4 py-2 rounded-xl text-xs font-medium text-white"
                  style={{ background: 'var(--color-highlight)' }}>
                  파일 선택 (복수 가능)
                </span>
              </div>
              {error && (
                <div className="w-full flex items-start gap-2 text-xs text-red-400 bg-red-900/20 rounded-xl p-3">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              <input
                ref={fileRef} type="file" accept=".pdf" multiple className="hidden"
                onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
          )}

          {/* ── Parsing ── */}
          {step === 'parsing' && (
            <div className="p-10 flex flex-col items-center gap-4">
              <Loader size={36} className="animate-spin text-[var(--color-highlight)]" />
              <p className="text-sm text-[var(--color-muted)] text-center">{parseProgress || 'PDF 분석 중…'}</p>
            </div>
          )}

          {/* ── Preview ── */}
          {step === 'preview' && (
            <div className="p-4 space-y-3">

              {/* Parse errors */}
              {(error || fileErrors.length > 0) && (
                <div className="text-xs text-yellow-400 bg-yellow-900/20 rounded-xl p-3 space-y-1">
                  {error && <p>{error}</p>}
                  {fileErrors.map((e, i) => <p key={i}>⚠ {e}</p>)}
                  {rawTextPreview && (
                    <details>
                      <summary className="cursor-pointer text-[var(--color-muted)] mt-1">추출된 텍스트 미리보기</summary>
                      <pre className="mt-2 text-xs text-[var(--color-muted)] whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                        {rawTextPreview}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {rows.length > 0 && (
                <>
                  {/* Card selector */}
                  <div>
                    <p className="text-xs text-[var(--color-muted)] mb-2">어떤 카드에 할당할까요?</p>
                    <div className="flex gap-2 flex-wrap">
                      {activeCards.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setSelectedCard(c.id); setRows(prev => prev.map(r => ({ ...r, cardId: c.id }))); }}
                          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                          style={{
                            backgroundColor: c.color + '33',
                            border: `1px solid ${c.color}`,
                            outline: selectedCard === c.id ? `2px solid rgba(255,255,255,0.5)` : 'none',
                            outlineOffset: '1px',
                            color: 'var(--color-text)',
                          }}>
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dup warning */}
                  {dupCount > 0 && (
                    <div className="text-xs bg-yellow-900/20 rounded-xl px-3 py-2 space-y-0.5">
                      {confirmedDupCount > 0 && (
                        <div className="flex items-center gap-2 text-yellow-400">
                          <AlertTriangle size={13} className="flex-shrink-0" />
                          <span>확실한 중복 {confirmedDupCount}건 — 기본 선택 해제</span>
                        </div>
                      )}
                      {possibleDupCount > 0 && (
                        <div className="flex items-center gap-2 text-orange-400">
                          <AlertTriangle size={13} className="flex-shrink-0" />
                          <span>가능성 있는 중복 {possibleDupCount}건 — 날짜 ±2일 / 금액 ±2%</span>
                        </div>
                      )}
                      <p className="text-white/40 pl-5">필요하면 직접 체크해서 추가 가능</p>
                    </div>
                  )}

                  {/* Select all / summary */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-[var(--color-muted)] cursor-pointer select-none">
                      <input type="checkbox"
                        checked={rows.every(r => r.selected)}
                        onChange={e => setRows(prev => prev.map(r => ({ ...r, selected: e.target.checked })))}
                      />
                      전체 선택 ({allRows}건)
                    </label>
                    <span className="text-xs text-[var(--color-muted)]">
                      선택 {selectedCount}건 · {formatCurrency(totalExpense)}
                    </span>
                  </div>

                  {/* Rows */}
                  <div className="space-y-0.5 max-h-72 overflow-y-auto rounded-xl bg-white/5 px-1 py-1">
                    {rows.map((r, i) => (
                      <label key={i}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          r.dupStatus !== 'none' ? 'opacity-40' : 'hover:bg-white/5'
                        }`}
                      >
                        <input type="checkbox" checked={r.selected}
                          onChange={e => setRows(prev => prev.map((row, j) =>
                            j === i ? { ...row, selected: e.target.checked } : row
                          ))}
                        />
                        <span className="text-xs text-[var(--color-muted)] w-[72px] flex-shrink-0">{r.date}</span>
                        {/* Bank badge */}
                        {banks.length > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 text-white"
                            style={{ backgroundColor: (BANK_COLOR[r.bank] ?? '#888') + 'bb' }}>
                            {r.bank === 'Apple Card' ? 'Apple' : r.bank}
                          </span>
                        )}
                        <span className="text-xs text-[var(--color-text)] flex-1 truncate min-w-0">
                          {r.dupStatus === 'confirmed' && <span className="mr-1 text-yellow-500">⚠</span>}
                          {r.dupStatus === 'possible'  && <span className="mr-1 text-orange-400">~</span>}
                          {r.note}
                        </span>
                        <span className={`text-xs font-mono flex-shrink-0 ${
                          r.type === 'income' || r.type === 'cashback' ? 'text-[var(--color-success)]' : 'text-[var(--color-text)]'
                        }`}>
                          {r.type === 'income' || r.type === 'cashback' ? '-' : '+'}
                          {formatCurrency(r.amount)}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Done ── */}
          {step === 'done' && (
            <div className="p-10 flex flex-col items-center gap-4">
              <CheckCircle size={48} className="text-[var(--color-success)]" />
              <div className="text-center">
                <p className="text-base font-semibold text-[var(--color-text)]">{importedCount}건 가져오기 완료!</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">거래 내역에 추가됐어요.</p>
              </div>
              <button onClick={onClose}
                className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--color-highlight)' }}>
                닫기
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && rows.length > 0 && (
          <div className="flex-shrink-0 border-t border-white/10 p-4">
            <button
              onClick={handleImport}
              disabled={selectedCount === 0}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity"
              style={{
                background: selectedCount > 0 ? 'var(--color-highlight)' : 'rgba(255,255,255,0.1)',
                opacity: selectedCount > 0 ? 1 : 0.5,
                cursor: selectedCount > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {selectedCount > 0 ? `✓ ${selectedCount}건 가져오기` : '선택된 항목 없음'}
            </button>
            {dupCount > 0 && selectedCount > 0 && (
              <p className="text-center text-xs text-[var(--color-muted)] mt-2">
                중복 제외 · {selectedCount}건 · {formatCurrency(totalExpense)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
