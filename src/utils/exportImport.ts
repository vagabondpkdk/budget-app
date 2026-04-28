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

function cardName(cardId: string, cards: Card[]): string {
  return cards.find(c => c.id === cardId)?.name ?? cardId;
}

// ── Excel Export ──────────────────────────────────────────────────────────────

export function exportToExcel(transactions: Transaction[], cards: Card[]) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: All transactions (sorted by date desc)
  const allRows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(t => ({
      날짜: t.date,
      유형: txnTypeLabel(t.type),
      카테고리: t.category,
      메모: t.note,
      금액: Math.abs(t.amount),
      카드: cardName(t.cardId, cards),
      결제자: t.user,
      반복: t.isRecurring ? 'Y' : '',
    }));

  const wsAll = XLSX.utils.json_to_sheet(allRows);
  // Column widths
  wsAll['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 30 },
    { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 5 },
  ];
  XLSX.utils.book_append_sheet(wb, wsAll, '전체 거래내역');

  // Sheet 2: Monthly summary
  const monthMap: Record<string, { income: number; expense: number; count: number }> = {};
  transactions.forEach(t => {
    const ym = t.date.slice(0, 7);
    if (!monthMap[ym]) monthMap[ym] = { income: 0, expense: 0, count: 0 };
    if (t.amount < 0) monthMap[ym].income += Math.abs(t.amount);
    else monthMap[ym].expense += t.amount;
    monthMap[ym].count++;
  });
  const summaryRows = Object.entries(monthMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([ym, d]) => ({
      연월: ym,
      수입: d.income,
      지출: d.expense,
      저축: d.income - d.expense,
      거래건수: d.count,
    }));
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '월별 요약');

  // Sheet 3: Card list
  const cardRows = cards.map(c => ({
    카드명: c.name,
    은행: c.bank,
    종류: c.type === 'credit' ? '신용' : '체크',
    소유자: c.owner,
    결제일: c.payDueDay ?? '',
    활성: c.isActive ? 'Y' : 'N',
  }));
  const wsCards = XLSX.utils.json_to_sheet(cardRows);
  wsCards['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 6 }, { wch: 8 }, { wch: 6 }, { wch: 4 }];
  XLSX.utils.book_append_sheet(wb, wsCards, '카드 목록');

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

  // Title
  doc.setFontSize(18);
  doc.text(`Budget Report — ${monthLabel}`, 14, 20);

  // Summary row
  doc.setFontSize(11);
  doc.text(`수입: $${totalIncome.toFixed(2)}`, 14, 32);
  doc.text(`지출: $${totalExpense.toFixed(2)}`, 70, 32);
  doc.text(`저축: $${(totalIncome - totalExpense).toFixed(2)}`, 130, 32);
  doc.text(`거래 ${monthTxns.length}건`, 14, 39);

  // Transactions table
  autoTable(doc, {
    startY: 44,
    head: [['날짜', '유형', '카테고리', '메모', '카드', '금액', '결제자']],
    body: monthTxns.map(t => [
      t.date,
      txnTypeLabel(t.type),
      t.category,
      t.note.slice(0, 35),
      cardName(t.cardId, cards).slice(0, 16),
      `$${Math.abs(t.amount).toFixed(2)}`,
      t.user,
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [233, 69, 96], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 14 },
      2: { cellWidth: 24 },
      3: { cellWidth: 55 },
      4: { cellWidth: 30 },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 14 },
    },
  });

  const fileName = `budget_${year}-${String(month).padStart(2, '0')}.pdf`;
  doc.save(fileName);
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

        // Look for a sheet that has the right columns
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
            const dateRaw = String(row['날짜'] ?? row['Date'] ?? row['date'] ?? '').trim();
            const amountRaw = row['금액'] ?? row['Amount'] ?? row['amount'];
            const note = String(row['메모'] ?? row['Note'] ?? row['note'] ?? '').trim();
            const category = String(row['카테고리'] ?? row['Category'] ?? 'ETC').trim();
            const typeRaw = String(row['유형'] ?? row['Type'] ?? '지출').trim();
            const user = String(row['결제자'] ?? row['User'] ?? 'Both').trim() as Transaction['user'];

            if (!dateRaw || !amountRaw) return; // skip empty rows

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
