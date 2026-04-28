import { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { X, FileText, Loader, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils';
import type { Transaction } from '../../types';
import { guessCategory } from '../../utils/pdfParser';

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
  isDuplicate: boolean;
}

/** 중복 체크: 같은 날짜 + 비슷한 메모 + 같은 금액 */
function isDuplicateTxn(
  candidate: { date: string; note: string; amount: number },
  existing: Transaction[],
): boolean {
  const normNote = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const candidateNote = normNote(candidate.note);
  const candidateAmt = Math.abs(candidate.amount);
  return existing.some(t =>
    t.date === candidate.date &&
    Math.abs(Math.abs(t.amount) - candidateAmt) < 0.01 &&
    normNote(t.note) === candidateNote,
  );
}

export function PdfImport({ onClose }: Props) {
  const { cards, transactions: existingTxns, addTransaction } = useStore();
  const activeCards = cards.filter(c => c.isActive);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [bank, setBank] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selectedCard, setSelectedCard] = useState(activeCards[0]?.id ?? '');
  const [error, setError] = useState('');
  const [rawTextPreview, setRawTextPreview] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  async function handleFile(file: File) {
    setStep('parsing');
    setError('');
    try {
      const { extractPdfText, detectBank, parseTransactions } = await import('../../utils/pdfParser');
      const text = await extractPdfText(file);
      setRawTextPreview(text.slice(0, 800));

      const detectedBank = detectBank(text);
      setBank(detectedBank);

      const parsed = parseTransactions(text, detectedBank);

      if (parsed.length === 0) {
        setError('거래 내역을 찾지 못했어요. 아래 추출된 텍스트를 확인해주세요.');
        setStep('preview');
        return;
      }

      const preview: PreviewRow[] = parsed.map(p => {
        const dup = isDuplicateTxn(
          { date: p.date, note: p.note, amount: p.amount },
          existingTxns,
        );
        return {
          date: p.date,
          note: p.note,
          amount: p.amount,
          type: p.type,
          category: guessCategory(p.note),
          cardId: selectedCard,
          selected: !dup,   // 중복은 기본 선택 해제
          isDuplicate: dup,
        };
      });

      setRows(preview);
      setStep('preview');
    } catch (e: any) {
      setError('PDF 읽기 실패: ' + (e?.message ?? '알 수 없는 오류'));
      setStep('upload');
    }
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

  const allRows = rows.length;
  const dupCount = rows.filter(r => r.isDuplicate).length;
  const selectedCount = rows.filter(r => r.selected).length;
  const totalExpense = rows
    .filter(r => r.selected && r.type === 'expense')
    .reduce((s, r) => s + r.amount, 0);

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
            {bank && <p className="text-xs text-[var(--color-muted)] mt-0.5">감지된 은행: <span className="text-[var(--color-highlight)]">{bank}</span></p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-muted)]">
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* ── Step: Upload ── */}
          {step === 'upload' && (
            <div className="p-6 flex flex-col items-center gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-white/20 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-[var(--color-highlight)] transition-colors"
              >
                <FileText size={40} className="text-[var(--color-muted)]" />
                <p className="text-sm text-[var(--color-text)] font-medium">PDF 파일을 선택하세요</p>
                <p className="text-xs text-[var(--color-muted)] text-center">
                  Chase · AMEX · Apple Card · Citi · BOA 등 지원<br />텍스트 기반 PDF만 가능 (스캔본 불가)
                </p>
                <span className="px-4 py-2 rounded-xl text-xs font-medium text-white"
                  style={{ background: 'var(--color-highlight)' }}>
                  파일 선택
                </span>
              </div>
              {error && (
                <div className="w-full flex items-start gap-2 text-xs text-red-400 bg-red-900/20 rounded-xl p-3">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
            </div>
          )}

          {/* ── Step: Parsing ── */}
          {step === 'parsing' && (
            <div className="p-10 flex flex-col items-center gap-4">
              <Loader size={36} className="animate-spin text-[var(--color-highlight)]" />
              <p className="text-sm text-[var(--color-muted)]">PDF 분석 중…</p>
            </div>
          )}

          {/* ── Step: Preview ── */}
          {step === 'preview' && (
            <div className="p-4 space-y-3">

              {/* Error / no transactions */}
              {error && (
                <div className="text-xs text-yellow-400 bg-yellow-900/20 rounded-xl p-3 space-y-2">
                  <p>{error}</p>
                  {rawTextPreview && (
                    <details>
                      <summary className="cursor-pointer text-[var(--color-muted)]">추출된 텍스트 미리보기</summary>
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
                        <button key={c.id} type="button" onClick={() => {
                          setSelectedCard(c.id);
                          setRows(prev => prev.map(r => ({ ...r, cardId: c.id })));
                        }}
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

                  {/* Duplicate warning */}
                  {dupCount > 0 && (
                    <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-900/20 rounded-xl px-3 py-2">
                      <AlertTriangle size={13} className="flex-shrink-0" />
                      <span>중복 {dupCount}건 감지 — 기본 선택 해제됨 (필요하면 직접 체크)</span>
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

                  {/* Transaction rows */}
                  <div className="space-y-0.5 max-h-64 overflow-y-auto rounded-xl bg-white/5 px-1 py-1">
                    {rows.map((r, i) => (
                      <label key={i}
                        className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          r.isDuplicate ? 'opacity-40' : 'hover:bg-white/5'
                        }`}
                      >
                        <input type="checkbox" checked={r.selected}
                          onChange={e => setRows(prev => prev.map((row, j) =>
                            j === i ? { ...row, selected: e.target.checked } : row
                          ))}
                        />
                        <span className="text-xs text-[var(--color-muted)] w-20 flex-shrink-0">{r.date}</span>
                        <span className="text-xs text-[var(--color-text)] flex-1 truncate">
                          {r.isDuplicate && <span className="mr-1 text-yellow-500">↩</span>}
                          {r.note}
                        </span>
                        <span className={`text-xs font-mono flex-shrink-0 ${
                          r.type === 'income' || r.type === 'cashback'
                            ? 'text-[var(--color-success)]'
                            : 'text-[var(--color-text)]'
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

          {/* ── Step: Done ── */}
          {step === 'done' && (
            <div className="p-10 flex flex-col items-center gap-4">
              <CheckCircle size={48} className="text-[var(--color-success)]" />
              <div className="text-center">
                <p className="text-base font-semibold text-[var(--color-text)]">
                  {importedCount}건 가져오기 완료!
                </p>
                <p className="text-xs text-[var(--color-muted)] mt-1">
                  거래 내역에 추가됐어요.
                </p>
              </div>
              <button onClick={onClose}
                className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'var(--color-highlight)' }}>
                닫기
              </button>
            </div>
          )}
        </div>

        {/* Footer — import button, always visible */}
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
                중복 제외 후 {selectedCount}건 · 총 {formatCurrency(totalExpense)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
