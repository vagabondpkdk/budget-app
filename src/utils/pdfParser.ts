import type { Transaction } from '../types';

// ── PDF text extraction via PDF.js ────────────────────────────────────────────

export async function extractPdfText(file: File): Promise<string> {
  // pdfjs-dist v3 — use the minified worker from /public
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items as any[])
      .map((item: any) => (item.str ?? ''))
      .join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

// ── Transaction parsers per bank ──────────────────────────────────────────────

export interface ParsedTransaction {
  date: string;
  note: string;
  amount: number;
  type: 'expense' | 'income' | 'cashback';
  bank: string;
}

/** Try to detect which bank this statement is from */
export function detectBank(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('chase') || t.includes('sapphire') || t.includes('freedom')) return 'Chase';
  if (t.includes('american express') || t.includes('amex')) return 'AMEX';
  if (t.includes('apple card') || t.includes('goldman sachs')) return 'Apple Card';
  if (t.includes('citibank') || t.includes('citi ')) return 'Citi';
  if (t.includes('bank of america') || t.includes('boa')) return 'BOA';
  if (t.includes('discover')) return 'Discover';
  if (t.includes('wells fargo')) return 'Wells Fargo';
  if (t.includes('capital one')) return 'Capital One';
  if (t.includes('us bank') || t.includes('u.s. bank')) return 'US Bank';
  return 'Unknown';
}

/** Parse a date string like "01/15", "Jan 15", "01/15/2025", "2025-01-15" */
function parseDate(raw: string, fallbackYear: number): string | null {
  // yyyy-mm-dd
  let m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // mm/dd/yyyy or mm/dd/yy
  m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const yr = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }

  // mm/dd (no year)
  m = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${fallbackYear}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

  // Month dd, yyyy  or  Mon dd
  const MONTHS: Record<string, string> = {
    jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
    jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
  };
  m = raw.match(/([a-z]{3})\.?\s+(\d{1,2}),?\s*(\d{4})?/i);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) {
      const yr = m[3] ?? String(fallbackYear);
      return `${yr}-${mo}-${m[2].padStart(2, '0')}`;
    }
  }
  return null;
}

/** Parse dollar amount from string like "$1,234.56", "1234.56", "-$50.00" */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ── Chase-specific parser ─────────────────────────────────────────────────────

const CURRENCY_NAMES = new Set([
  'SWISS FRANC','EURO','POUND STERLING','WON','YEN','CAD','AUD',
  'CZECH KORUNA','HKD','SGD','THB','JPY','CNY','MXN','NOK','SEK',
  'NZD','INR','BRL','ZAR','AED','SAR','PHP','IDR','MYR','VND',
]);

function parseChase(lines: string[]): ParsedTransaction[] {
  // Detect statement year from "Opening/Closing Date MM/DD/YY - MM/DD/YY"
  const yearMap: Record<number, number> = {};
  for (const line of lines) {
    const m = line.match(/Opening\/Closing Date\s+(\d{1,2})\/\d{2}\/(\d{2})\s*-\s*(\d{1,2})\/\d{2}\/(\d{2})/);
    if (m) {
      const startYr = 2000 + parseInt(m[2]);
      const endMo   = parseInt(m[3]), endYr   = 2000 + parseInt(m[4]);
      for (let mo = 1; mo <= 12; mo++) {
        yearMap[mo] = mo <= endMo ? endYr : startYr;
      }
      break;
    }
  }
  const defaultYear = new Date().getFullYear();

  const results: ParsedTransaction[] = [];
  let inActivity = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.includes('ACCOUNT ACTIVITY') || line.includes('AACCCCOOUUNNTT AACCTTIIVVIITTYY')) {
      inActivity = true; continue;
    }
    if (!inActivity) continue;

    // Skip known noise lines
    if (/^(Date of|Transaction|Merchant|PAYMENTS|PURCHASE|FEES|INTEREST)/i.test(line)) continue;
    if (/EXCHG RATE/.test(line)) continue;
    if (/^[\d,.]+ X [\d.]+/.test(line)) continue;           // exchange rate detail
    if (/^\d{6}\s+\d\s+[A-Z]/.test(line)) continue;         // flight itinerary
    if (/^\d\s+G[XO]?\s+[A-Z]{3}/.test(line)) continue;     // flight segment
    if (/^(Page\s+\d|DONGHYUK|0000001|MMaannaaggee)/.test(line)) continue;

    // Skip lines that are just "MM/DD CURRENCY_NAME"
    const currCheck = line.match(/^(\d{1,2}\/\d{2})\s+([A-Z ]+)\s*$/);
    if (currCheck && CURRENCY_NAMES.has(currCheck[2].trim())) continue;

    // Match: MM/DD [&] description amount
    const m = line.match(/^(\d{1,2}\/\d{2})\s+&?\s*(.+?)\s+(-?[\d,]+\.\d{2})\s*$/);
    if (!m) continue;

    const [, dateRaw, desc, amtRaw] = m;
    const mo = parseInt(dateRaw.split('/')[0]);
    const dy = dateRaw.split('/')[1];
    const yr = yearMap[mo] ?? defaultYear;
    const date = `${yr}-${String(mo).padStart(2, '0')}-${dy}`;
    const amount = parseFloat(amtRaw.replace(/,/g, ''));
    if (amount === 0) continue;

    results.push({
      date, note: desc.trim(),
      amount: Math.abs(amount),
      type: amount < 0 ? 'income' : 'expense',
      bank: 'Chase',
    });
  }
  return results;
}

// ── Generic line-by-line parser ───────────────────────────────────────────────

export function parseTransactions(text: string, bank: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Use bank-specific parsers first
  if (bank === 'Chase') return parseChase(lines);

  // Generic fallback
  const year = new Date().getFullYear();
  const results: ParsedTransaction[] = [];

  const patterns = [
    /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/,
    /^([A-Za-z]{3}\.?\s+\d{1,2},?\s*\d{0,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/,
    /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.{5,60}?)\s+(-?[\d,]+\.\d{2})\s*$/,
  ];

  for (const line of lines) {
    for (const pat of patterns) {
      const m = line.match(pat);
      if (!m) continue;
      const date = parseDate(m[1].trim(), year);
      if (!date) continue;
      const desc = m[2].trim();
      if (desc.length < 2) continue;
      const amount = parseAmount(m[3]);
      if (amount === null || amount === 0) continue;
      results.push({ date, note: desc, amount: Math.abs(amount), type: amount < 0 ? 'income' : 'expense', bank });
      break;
    }
  }

  if (results.length === 0) {
    // Aggressive token-based fallback
    const amountRe = /^-?\$?[\d,]+\.\d{2}$/;
    const dateRe = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$|^[A-Za-z]{3}\.?\s+\d{1,2}$/;
    for (const line of lines) {
      const tokens = line.split(/\s{2,}|\t/);
      if (tokens.length < 3) continue;
      const first = tokens[0].trim(), last = tokens[tokens.length - 1].trim();
      if (!dateRe.test(first) || !amountRe.test(last)) continue;
      const date = parseDate(first, year);
      const amount = parseAmount(last);
      if (!date || !amount || amount === 0) continue;
      const desc = tokens.slice(1, -1).join(' ').trim();
      if (desc.length < 2) continue;
      results.push({ date, note: desc, amount: Math.abs(amount), type: amount < 0 ? 'income' : 'expense', bank });
    }
  }

  return results;
}

// ── Map parsed → app Transaction ─────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<[string[], Transaction['category']]> = [
  [['restaurant','food','cafe','coffee','mcdonald','starbucks','sushi','pizza','burger','kitchen','grill','dine','eatery','doordash','ubereats','grubhub','chipotle'], 'Food'],
  [['grocery','costco','trader','whole foods','target','walmart','market','safeway','kroger','aldi'], 'Market'],
  [['amazon','apple.com','best buy','shop','store','mall','fashion','clothing','zara','h&m'], 'Shopping'],
  [['uber','lyft','taxi','transit','metro','bus','train','subway','parking','toll'], 'Travel'],
  [['airline','airways','united','delta','american air','southwest','jeju','flight','hotel','airbnb','vrbo','expedia','booking'], 'Travel'],
  [['netflix','spotify','hulu','disney','amazon prime','subscription','apple one'], 'Subscriptions'],
  [['electric','gas','water','internet','phone','t-mobile','verizon','at&t','insurance','utility','bill'], 'Bill'],
  [['shell','chevron','exxon','bp','arco','76','gas station','fuel'], 'Gas'],
  [['gym','health','dental','doctor','pharmacy','cvs','walgreens','hospital','medical'], 'ETC'],
  [['payment','autopay','thank you','minimum due','balance'], 'Payment'],
  [['cashback','cash back','reward','credit','refund'], 'Cash Back'],
  [['transfer','deposit','direct deposit','payroll','salary','zelle','venmo'], 'Income'],
];

export function guessCategory(note: string): Transaction['category'] {
  const lower = note.toLowerCase();
  for (const [keywords, cat] of CATEGORY_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'ETC';
}
