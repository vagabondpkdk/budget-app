import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Transaction, Card } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function txnTypeLabel(type: string): string {
  const map: Record<string, string> = {
    expense: '지출', income: '수입', cashback: '캐시백',
    payment: '결제', refund: '환급',
  };
  return map[type] ?? type;
}

function getCardName(cardId: string, cards: Card[]): string {
  return cards.find(c => c.id === cardId)?.name ?? cardId;
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_KO    = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];

function isExpenseTxn(t: Transaction)  { return t.amount > 0 && t.type !== 'payment'; }
function isIncomeTxn(t: Transaction)   { return t.amount < 0 && t.type === 'income'; }
function isRefundTxn(t: Transaction)   { return t.amount < 0 && t.type !== 'income' && t.type !== 'payment'; }

function usd(n: number) { return parseFloat(n.toFixed(2)); }

// xlsx 셀 숫자 포맷 (달러)
const FMT_USD   = '"$"#,##0.00';
const FMT_PCT   = '0.0"%"';
const FMT_INT   = '#,##0';

function numCell(val: number, fmt: string): XLSX.CellObject {
  return { t: 'n', v: usd(val), z: fmt };
}
function strCell(val: string): XLSX.CellObject {
  return { t: 's', v: val };
}

/** 배열-of-배열로 시트 만들기 + 컬럼 폭 설정 */
function makeSheet(
  rows: (XLSX.CellObject | string | number | null)[][],
  colWidths: number[],
  merges?: XLSX.Range[],
  freeze?: { r: number; c: number },
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxR = 0, maxC = 0;
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === null || cell === undefined) return;
      const addr = XLSX.utils.encode_cell({ r, c });
      if (typeof cell === 'object') {
        ws[addr] = cell;
      } else if (typeof cell === 'number') {
        ws[addr] = { t: 'n', v: cell };
      } else {
        ws[addr] = { t: 's', v: String(cell) };
      }
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    });
  });
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
  ws['!cols'] = colWidths.map(w => ({ wch: w }));
  if (merges) ws['!merges'] = merges;
  if (freeze) ws['!freeze'] = freeze;
  return ws;
}

// ── Excel Export ──────────────────────────────────────────────────────────────

export function exportToExcel(transactions: Transaction[], cards: Card[]) {
  const wb = XLSX.utils.book_new();

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const years  = [...new Set(sorted.map(t => t.date.slice(0, 4)))].sort();

  // ── 1. 연간 요약 시트 ────────────────────────────────────────────────────────
  {
    const rows: (XLSX.CellObject | string | number | null)[][] = [];

    // 지출 매트릭스
    rows.push(['📊 연간 지출 매트릭스', null, ...MONTH_NAMES.map(m => m), 'Total']);
    years.forEach(y => {
      const row: (XLSX.CellObject | string | number | null)[] = [y];
      let total = 0;
      MONTH_NAMES.forEach((_, mi) => {
        const mm = String(mi + 1).padStart(2, '0');
        const amt = sorted
          .filter(t => t.date.startsWith(`${y}-${mm}`) && isExpenseTxn(t))
          .reduce((s, t) => s + t.amount, 0);
        row.push(amt > 0 ? numCell(amt, FMT_USD) : null);
        total += amt;
      });
      row.push(numCell(total, FMT_USD));
      rows.push(row);
    });

    rows.push([]);

    // 수입 매트릭스
    rows.push(['📥 연간 수입 매트릭스', null, ...MONTH_NAMES.map(m => m), 'Total']);
    years.forEach(y => {
      const row: (XLSX.CellObject | string | number | null)[] = [y];
      let total = 0;
      MONTH_NAMES.forEach((_, mi) => {
        const mm = String(mi + 1).padStart(2, '0');
        const amt = sorted
          .filter(t => t.date.startsWith(`${y}-${mm}`) && isIncomeTxn(t))
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        row.push(amt > 0 ? numCell(amt, FMT_USD) : null);
        total += amt;
      });
      row.push(numCell(total, FMT_USD));
      rows.push(row);
    });

    rows.push([]);

    // 저축 매트릭스
    rows.push(['💰 연간 저축 매트릭스', null, ...MONTH_NAMES.map(m => m), 'Total']);
    years.forEach(y => {
      const row: (XLSX.CellObject | string | number | null)[] = [y];
      let total = 0;
      MONTH_NAMES.forEach((_, mi) => {
        const mm = String(mi + 1).padStart(2, '0');
        const exp = sorted.filter(t => t.date.startsWith(`${y}-${mm}`) && isExpenseTxn(t)).reduce((s, t) => s + t.amount, 0);
        const inc = sorted.filter(t => t.date.startsWith(`${y}-${mm}`) && isIncomeTxn(t)).reduce((s, t) => s + Math.abs(t.amount), 0);
        const net = inc - exp;
        row.push(numCell(net, FMT_USD));
        total += net;
      });
      row.push(numCell(total, FMT_USD));
      rows.push(row);
    });

    const ws = makeSheet(rows,
      [10, 2, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 12],
    );
    XLSX.utils.book_append_sheet(wb, ws, '📊 연간 요약');
  }

  // ── 2. 월별 상세 요약 ─────────────────────────────────────────────────────────
  {
    const header: (XLSX.CellObject | string)[] = [
      '연월', '수입', '지출', '환급', '순저축', '저축률', '거래수',
    ];
    const rows: (XLSX.CellObject | string | number | null)[][] = [header];

    // 전체 월 목록
    const months = [...new Set(sorted.map(t => t.date.slice(0, 7)))].sort();
    months.forEach(ym => {
      const txns = sorted.filter(t => t.date.startsWith(ym));
      const inc     = txns.filter(isIncomeTxn).reduce((s, t) => s + Math.abs(t.amount), 0);
      const exp     = txns.filter(isExpenseTxn).reduce((s, t) => s + t.amount, 0);
      const refund  = txns.filter(isRefundTxn).reduce((s, t) => s + Math.abs(t.amount), 0);
      const saving  = inc - exp + refund;
      const rate    = inc > 0 ? (saving / inc) * 100 : 0;
      rows.push([
        strCell(ym),
        numCell(inc,    FMT_USD),
        numCell(exp,    FMT_USD),
        numCell(refund, FMT_USD),
        numCell(saving, FMT_USD),
        numCell(rate,   FMT_PCT),
        { t: 'n', v: txns.length, z: FMT_INT },
      ]);
    });

    // 전체 합계 행
    const allInc    = sorted.filter(isIncomeTxn).reduce((s, t) => s + Math.abs(t.amount), 0);
    const allExp    = sorted.filter(isExpenseTxn).reduce((s, t) => s + t.amount, 0);
    const allRefund = sorted.filter(isRefundTxn).reduce((s, t) => s + Math.abs(t.amount), 0);
    const allSaving = allInc - allExp + allRefund;
    rows.push([
      strCell('── TOTAL ──'),
      numCell(allInc,    FMT_USD),
      numCell(allExp,    FMT_USD),
      numCell(allRefund, FMT_USD),
      numCell(allSaving, FMT_USD),
      allInc > 0 ? numCell((allSaving / allInc) * 100, FMT_PCT) : strCell('-'),
      { t: 'n', v: sorted.length, z: FMT_INT },
    ]);

    const ws = makeSheet(rows,
      [10, 12, 12, 10, 12, 8, 6],
      undefined,
      { r: 1, c: 0 },
    );
    XLSX.utils.book_append_sheet(wb, ws, '📅 월별 요약');
  }

  // ── 3. 카테고리 분석 ──────────────────────────────────────────────────────────
  {
    const catMap: Record<string, Record<string, number>> = {}; // cat → year → total
    sorted.filter(isExpenseTxn).forEach(t => {
      const y = t.date.slice(0, 4);
      if (!catMap[t.category]) catMap[t.category] = {};
      catMap[t.category][y] = (catMap[t.category][y] ?? 0) + t.amount;
    });

    const grandTotal = sorted.filter(isExpenseTxn).reduce((s, t) => s + t.amount, 0);

    const header: (string | XLSX.CellObject)[] = ['카테고리', ...years, '합계', '비율'];
    const rows: (XLSX.CellObject | string | number | null)[][] = [header];

    const catEntries = Object.entries(catMap)
      .map(([cat, byYear]) => {
        const total = Object.values(byYear).reduce((s, v) => s + v, 0);
        return { cat, byYear, total };
      })
      .sort((a, b) => b.total - a.total);

    catEntries.forEach(({ cat, byYear, total }) => {
      const row: (XLSX.CellObject | string | number | null)[] = [strCell(cat)];
      years.forEach(y => row.push(byYear[y] ? numCell(byYear[y], FMT_USD) : null));
      row.push(numCell(total, FMT_USD));
      row.push(numCell(grandTotal > 0 ? (total / grandTotal) * 100 : 0, FMT_PCT));
      rows.push(row);
    });

    // Total row
    const totRow: (XLSX.CellObject | string | number | null)[] = [strCell('── TOTAL ──')];
    years.forEach(y => {
      const t = sorted.filter(isExpenseTxn).filter(t => t.date.startsWith(y)).reduce((s, t) => s + t.amount, 0);
      totRow.push(numCell(t, FMT_USD));
    });
    totRow.push(numCell(grandTotal, FMT_USD));
    totRow.push(numCell(100, FMT_PCT));
    rows.push(totRow);

    const colWidths = [18, ...years.map(() => 12), 12, 7];
    const ws = makeSheet(rows, colWidths, undefined, { r: 1, c: 0 });
    XLSX.utils.book_append_sheet(wb, ws, '🗂️ 카테고리');
  }

  // ── 4. 연도별 거래 시트 ───────────────────────────────────────────────────────
  years.forEach(year => {
    const yearTxns = sorted.filter(t => t.date.startsWith(year));
    if (yearTxns.length === 0) return;

    const TXN_HEADER = ['날짜', '유형', '카테고리', '메모', '카드', '결제자', '금액', '반복'];
    const rows: (XLSX.CellObject | string | number | null)[][] = [];

    // 연간 요약 헤더
    const yInc    = yearTxns.filter(isIncomeTxn).reduce((s, t) => s + Math.abs(t.amount), 0);
    const yExp    = yearTxns.filter(isExpenseTxn).reduce((s, t) => s + t.amount, 0);
    const yRefund = yearTxns.filter(isRefundTxn).reduce((s, t) => s + Math.abs(t.amount), 0);
    const ySaving = yInc - yExp + yRefund;
    const yRate   = yInc > 0 ? (ySaving / yInc) * 100 : 0;

    rows.push([`${year}년 가계부`, null, null, null, null, null, null, null]);
    rows.push([
      `수입: $${yInc.toFixed(2)}`,
      null,
      `지출: $${yExp.toFixed(2)}`,
      null,
      `저축: $${ySaving.toFixed(2)}`,
      null,
      `저축률: ${yRate.toFixed(1)}%`,
      null,
    ]);
    rows.push([]); // 빈 줄
    rows.push(TXN_HEADER as string[]);

    // 월별로 그루핑
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const mTxns = yearTxns.filter(t => t.date.startsWith(`${year}-${mm}`));
      if (mTxns.length === 0) continue;

      // 월 헤더
      const mInc  = mTxns.filter(isIncomeTxn).reduce((s, t) => s + Math.abs(t.amount), 0);
      const mExp  = mTxns.filter(isExpenseTxn).reduce((s, t) => s + t.amount, 0);
      const mRate = mInc > 0 ? ((mInc - mExp) / mInc * 100) : 0;

      rows.push([
        `▶ ${year}.${mm} ${MONTH_KO[m-1]}`,
        null, null, null, null, null,
        `수입 $${mInc.toFixed(2)} / 지출 $${mExp.toFixed(2)} / 저축률 ${mRate.toFixed(1)}%`,
        null,
      ]);

      // 거래 행
      mTxns.forEach(t => {
        rows.push([
          strCell(t.date),
          strCell(txnTypeLabel(t.type)),
          strCell(t.category),
          strCell(t.note),
          strCell(getCardName(t.cardId, cards)),
          strCell(t.user),
          numCell(Math.abs(t.amount), FMT_USD),
          strCell(t.isRecurring ? '↻' : ''),
        ]);
      });

      // 월 소계
      const mRefund = mTxns.filter(isRefundTxn).reduce((s, t) => s + Math.abs(t.amount), 0);
      const mSaving = mInc - mExp + mRefund;
      rows.push([
        `  소계 (${mTxns.length}건)`,
        null, null, null, null,
        `수입`,
        numCell(mInc, FMT_USD),
        null,
      ]);
      rows.push([
        null, null, null, null, null,
        `지출`,
        numCell(mExp, FMT_USD),
        null,
      ]);
      if (mRefund > 0) {
        rows.push([null, null, null, null, null, `환급`, numCell(mRefund, FMT_USD), null]);
      }
      rows.push([
        null, null, null, null, null,
        `순 저축`,
        numCell(mSaving, FMT_USD),
        null,
      ]);
      rows.push([]); // 빈 줄
    }

    // 연간 총합 행
    rows.push([`${year}년 합계`, null, null, null, null, '수입', numCell(yInc, FMT_USD), null]);
    rows.push([null, null, null, null, null, '지출', numCell(yExp, FMT_USD), null]);
    rows.push([null, null, null, null, null, '환급', numCell(yRefund, FMT_USD), null]);
    rows.push([null, null, null, null, null, '순 저축', numCell(ySaving, FMT_USD), null]);
    rows.push([null, null, null, null, null, '저축률', numCell(yRate, FMT_PCT), null]);

    const ws = makeSheet(rows,
      [12, 7, 16, 32, 18, 8, 12, 4],
      undefined,
      { r: 3, c: 0 }, // 헤더 행 고정
    );
    XLSX.utils.book_append_sheet(wb, ws, `${year}년`);
  });

  // ── 5. 전체 거래 원본 ─────────────────────────────────────────────────────────
  {
    const header = ['날짜','유형','카테고리','메모','카드','결제자','금액','반복'];
    const rows: (XLSX.CellObject | string | number | null)[][] = [header as string[]];
    [...transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach(t => {
        rows.push([
          strCell(t.date),
          strCell(txnTypeLabel(t.type)),
          strCell(t.category),
          strCell(t.note),
          strCell(getCardName(t.cardId, cards)),
          strCell(t.user),
          numCell(Math.abs(t.amount), FMT_USD),
          strCell(t.isRecurring ? 'Y' : ''),
        ]);
      });

    const ws = makeSheet(rows,
      [12, 7, 16, 32, 18, 8, 12, 4],
      undefined,
      { r: 1, c: 0 },
    );
    XLSX.utils.book_append_sheet(wb, ws, '📋 전체 거래');
  }

  const fileName = `budget_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ── PDF Export ────────────────────────────────────────────────────────────────

export function exportToPDF(
  transactions: Transaction[],
  cards: Card[],
  year: number,
  month: number,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const monthLabel = `${year}년 ${month}월`;
  const monthTxns = transactions
    .filter(t => t.date.startsWith(`${year}-${String(month).padStart(2, '0')}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalExpense = monthTxns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalIncome  = monthTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  doc.setFontSize(18);
  doc.text(`Budget Report — ${monthLabel}`, 14, 20);

  doc.setFontSize(11);
  doc.text(`수입: $${totalIncome.toFixed(2)}`, 14, 32);
  doc.text(`지출: $${totalExpense.toFixed(2)}`, 70, 32);
  doc.text(`저축: $${(totalIncome - totalExpense).toFixed(2)}`, 130, 32);
  doc.text(`거래 ${monthTxns.length}건`, 14, 39);

  autoTable(doc, {
    startY: 44,
    head: [['날짜', '유형', '카테고리', '메모', '카드', '금액', '결제자']],
    body: monthTxns.map(t => [
      t.date,
      txnTypeLabel(t.type),
      t.category,
      t.note.slice(0, 35),
      getCardName(t.cardId, cards).slice(0, 16),
      `$${Math.abs(t.amount).toFixed(2)}`,
      t.user,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [233, 69, 96], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 22 }, 1: { cellWidth: 14 }, 2: { cellWidth: 24 },
      3: { cellWidth: 55 }, 4: { cellWidth: 30 },
      5: { cellWidth: 20, halign: 'right' }, 6: { cellWidth: 14 },
    },
  });

  doc.save(`budget_${year}-${String(month).padStart(2, '0')}.pdf`);
}

// ── Excel Import ──────────────────────────────────────────────────────────────

export interface ImportResult {
  transactions: Omit<Transaction, 'id'>[];
  errors: string[];
}

export function importFromExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });

        let sheetName = wb.SheetNames.find(n =>
          n.includes('거래') || n.includes('전체') || n === wb.SheetNames[0]
        ) ?? wb.SheetNames[0];

        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false, dateNF: 'yyyy-mm-dd' });

        const transactions: Omit<Transaction, 'id'>[] = [];
        const errors: string[] = [];

        const TYPE_MAP: Record<string, Transaction['type']> = {
          '지출': 'expense', '수입': 'income', '캐시백': 'cashback',
          '결제': 'payment', '환급': 'refund',
          'expense': 'expense', 'income': 'income', 'cashback': 'cashback',
          'payment': 'payment', 'refund': 'refund',
        };

        rows.forEach((row, i) => {
          try {
            const dateRaw   = String(row['날짜'] ?? row['Date'] ?? row['date'] ?? '').trim();
            const amountRaw = row['금액'] ?? row['Amount'] ?? row['amount'];
            const note      = String(row['메모'] ?? row['Note'] ?? row['note'] ?? '').trim();
            const category  = String(row['카테고리'] ?? row['Category'] ?? 'ETC').trim();
            const typeRaw   = String(row['유형'] ?? row['Type'] ?? '지출').trim();
            const user      = String(row['결제자'] ?? row['User'] ?? 'Both').trim() as Transaction['user'];

            if (!dateRaw || !amountRaw) return;

            const dateMatch = dateRaw.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
            if (!dateMatch) { errors.push(`행 ${i + 2}: 날짜 형식 오류 (${dateRaw})`); return; }
            const date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;

            const amount = parseFloat(String(amountRaw).replace(/[$,\s]/g, ''));
            if (isNaN(amount)) { errors.push(`행 ${i + 2}: 금액 오류 (${amountRaw})`); return; }

            const type = TYPE_MAP[typeRaw] ?? 'expense';
            const finalAmount = (type === 'income' || type === 'cashback' || type === 'refund')
              ? -Math.abs(amount) : Math.abs(amount);

            transactions.push({
              date, category: category as Transaction['category'],
              note, amount: finalAmount,
              cardId: 'card_imported',
              user: ['Kyle', 'Ella', 'Both', 'SA'].includes(user) ? user : 'Both',
              type, isRecurring: false,
            });
          } catch {
            errors.push(`행 ${i + 2}: 파싱 오류`);
          }
        });

        resolve({ transactions, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
