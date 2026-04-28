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

  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as any[];

      // Group text items by y-coordinate with ±3pt tolerance
      // (PDF columns — date / description / amount — can have slightly different y values)
      const lineGroups: Array<{ y: number; items: Array<{ x: number; str: string }> }> = [];

      for (const item of items) {
        const str: string = item.str ?? '';
        if (!str.trim()) continue;
        const iy: number = item.transform[5];
        const ix: number = item.transform[4];

        // Find existing group within ±3pt
        const group = lineGroups.find(g => Math.abs(g.y - iy) <= 3);
        if (group) {
          group.items.push({ x: ix, str });
          group.y = (group.y + iy) / 2; // keep running average y
        } else {
          lineGroups.push({ y: iy, items: [{ x: ix, str }] });
        }
      }

      // Sort groups top → bottom, items left → right within each group
      lineGroups.sort((a, b) => b.y - a.y);
      for (const group of lineGroups) {
        group.items.sort((a, b) => a.x - b.x);
        const line = group.items.map(s => s.str).join(' ').trim();
        if (line) fullText += line + '\n';
      }

      page.cleanup();
    }
  } finally {
    // 반드시 메모리 해제 — 여러 파일 연속 처리 시 worker 메모리 누수 방지
    await pdf.destroy();
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
  if (t.includes('bank of america') || t.includes('boa ')) return 'BOA';
  if (t.includes('discover')) return 'Discover';
  if (t.includes('wells fargo')) return 'Wells Fargo';
  if (t.includes('capital one')) return 'Capital One';
  if (t.includes('us bank') || t.includes('u.s. bank')) return 'US Bank';
  return 'Unknown';
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const MONTHS: Record<string, string> = {
  jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12',
};

/** Parse a date string → "YYYY-MM-DD" */
function parseDate(raw: string, fallbackYear: number): string | null {
  let m = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const yr = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }

  m = raw.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return `${fallbackYear}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

  // "Jan 15, 2025" / "Jan 15" / "January 15, 2025"
  m = raw.match(/([a-z]{3,9})\.?\s+(\d{1,2}),?\s*(\d{4})?/i);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mo) {
      const yr = m[3] ?? String(fallbackYear);
      return `${yr}-${mo}-${m[2].padStart(2, '0')}`;
    }
  }
  return null;
}

/** Parse dollar amount from "$1,234.56" / "1234.56" / "-50.00" */
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Detect statement year range from common header patterns */
function detectYearMap(lines: string[]): Record<number, number> {
  const map: Record<number, number> = {};

  for (const line of lines) {
    // Chase: "Opening/Closing Date MM/DD/YY - MM/DD/YY"
    let m = line.match(/Opening\/Closing Date\s+(\d{1,2})\/\d{2}\/(\d{2})\s*-\s*(\d{1,2})\/\d{2}\/(\d{2})/);
    if (m) {
      const startYr = 2000 + parseInt(m[2]);
      const endMo = parseInt(m[3]), endYr = 2000 + parseInt(m[4]);
      for (let mo = 1; mo <= 12; mo++) map[mo] = mo <= endMo ? endYr : startYr;
      break;
    }
    // Generic: "Statement Period: MM/DD/YY - MM/DD/YY" or "MM/DD/YYYY to MM/DD/YYYY"
    m = line.match(/(\d{1,2})\/\d{2}\/(\d{2,4})\s*(?:-|to)\s*(\d{1,2})\/\d{2}\/(\d{2,4})/i);
    if (m) {
      const startYr = parseInt(m[2].length === 2 ? '20' + m[2] : m[2]);
      const endMo = parseInt(m[3]);
      const endYr = parseInt(m[4].length === 2 ? '20' + m[4] : m[4]);
      for (let mo = 1; mo <= 12; mo++) map[mo] = mo <= endMo ? endYr : startYr;
      break;
    }
  }
  return map;
}

// ── Chase ────────────────────────────────────────────────────────────────────

const CURRENCY_NAMES = new Set([
  'SWISS FRANC','EURO','POUND STERLING','WON','YEN','CAD','AUD',
  'CZECH KORUNA','HKD','SGD','THB','JPY','CNY','MXN','NOK','SEK',
  'NZD','INR','BRL','ZAR','AED','SAR','PHP','IDR','MYR','VND',
]);

function parseChase(lines: string[]): ParsedTransaction[] {
  const yearMap = detectYearMap(lines);
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

    if (/^(Date of|Transaction|Merchant|PAYMENTS|PURCHASE|FEES|INTEREST)/i.test(line)) continue;
    if (/EXCHG RATE/.test(line)) continue;
    if (/^[\d,.]+ X [\d.]+/.test(line)) continue;
    if (/^\d{6}\s+\d\s+[A-Z]/.test(line)) continue;
    if (/^\d\s+G[XO]?\s+[A-Z]{3}/.test(line)) continue;
    if (/^(Page\s+\d|0000001|MMaannaaggee)/.test(line)) continue;

    const currCheck = line.match(/^(\d{1,2}\/\d{2})\s+([A-Z ]+)\s*$/);
    if (currCheck && CURRENCY_NAMES.has(currCheck[2].trim())) continue;

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

// ── AMEX ─────────────────────────────────────────────────────────────────────
// Formats: "MM/DD/YY  MERCHANT  $AMT"  or  "MM/DD/YY  MM/DD/YY  MERCHANT  AMT"

function parseAMEX(lines: string[]): ParsedTransaction[] {
  const yearMap = detectYearMap(lines);
  const defaultYear = new Date().getFullYear();
  const results: ParsedTransaction[] = [];
  let inActivity = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/transaction|activity|purchases|payments/i.test(line) && line.length < 60) {
      inActivity = true; continue;
    }
    if (!inActivity) continue;

    if (/^(Date|Description|Amount|Reference|Total|Balance|Annual|Minimum|Payment Due)/i.test(line)) continue;
    if (/\bNew Balance\b|\bPrevious Balance\b/i.test(line)) continue;

    // Format 1: MM/DD/YY  [MM/DD/YY]  MERCHANT  $AMOUNT
    let m = line.match(/^(\d{2}\/\d{2}\/\d{2,4})\s+(?:\d{2}\/\d{2}\/\d{2,4}\s+)?(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/);
    if (m) {
      const date = parseDate(m[1], defaultYear);
      const amount = parseAmount(m[3]);
      if (date && amount !== null && amount !== 0) {
        results.push({ date, note: m[2].trim(), amount: Math.abs(amount), type: amount < 0 ? 'income' : 'expense', bank: 'AMEX' });
      }
      continue;
    }

    // Format 2: MM/DD  MERCHANT  AMOUNT  (no year)
    m = line.match(/^(\d{1,2}\/\d{2})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/);
    if (m) {
      const mo = parseInt(m[1].split('/')[0]);
      const yr = yearMap[mo] ?? defaultYear;
      const date = parseDate(m[1] + '/' + yr, defaultYear);
      const amount = parseAmount(m[3]);
      if (date && amount !== null && amount !== 0) {
        results.push({ date, note: m[2].trim(), amount: Math.abs(amount), type: amount < 0 ? 'income' : 'expense', bank: 'AMEX' });
      }
    }
  }
  return results;
}

// ── Apple Card ───────────────────────────────────────────────────────────────
// Format: "Month DD, YYYY  MERCHANT  CATEGORY  $AMOUNT"
// or columns: Date | Description | Daily Cash | Amount

function parseAppleCard(lines: string[]): ParsedTransaction[] {
  const defaultYear = new Date().getFullYear();
  const results: ParsedTransaction[] = [];
  let inActivity = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/transactions|activity/i.test(line) && line.length < 50) {
      inActivity = true; continue;
    }
    if (!inActivity) inActivity = true; // Apple Card has no clear section header

    if (/^(Date|Description|Merchant|Amount|Daily Cash|Total)/i.test(line)) continue;

    // "Jan 15, 2025  STARBUCKS  Food & Drinks  $5.75"
    // "January 15, 2025  STARBUCKS  $5.75"
    const m = line.match(/^([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4})\s+(.+?)\s+(-?\$[\d,]+\.\d{2})\s*$/);
    if (m) {
      const date = parseDate(m[1], defaultYear);
      const amount = parseAmount(m[3]);
      if (date && amount !== null && amount !== 0) {
        // Strip trailing category word if present
        const note = m[2].replace(/\s+(Food|Shopping|Travel|Entertainment|Health|Services|Other)\s*$/i, '').trim();
        results.push({ date, note, amount: Math.abs(amount), type: amount < 0 ? 'income' : 'expense', bank: 'Apple Card' });
      }
    }
  }
  return results;
}

// ── Citi ─────────────────────────────────────────────────────────────────────
// Format: "MM/DD  MERCHANT  $AMOUNT" in Purchases/Credits sections

function parseCiti(lines: string[]): ParsedTransaction[] {
  const yearMap = detectYearMap(lines);
  const defaultYear = new Date().getFullYear();
  const results: ParsedTransaction[] = [];
  let inActivity = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/purchases|credits|payments|transactions/i.test(line) && line.length < 60) {
      inActivity = true; continue;
    }
    if (!inActivity) continue;
    if (/^(Date|Description|Amount|Balance|Minimum|Payment Due)/i.test(line)) continue;

    const m = line.match(/^(\d{1,2}\/\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/);
    if (m) {
      const mo = parseInt(m[1].split('/')[0]);
      const yr = yearMap[mo] ?? defaultYear;
      const date = `${yr}-${String(mo).padStart(2, '0')}-${m[1].split('/')[1]}`;
      const amount = parseAmount(m[3]);
      if (amount !== null && amount !== 0) {
        results.push({ date, note: m[2].trim(), amount: Math.abs(amount), type: amount < 0 ? 'income' : 'expense', bank: 'Citi' });
      }
    }
  }
  return results;
}

// ── Bank of America ───────────────────────────────────────────────────────────
// Format: "MM/DD/YY  MERCHANT  AMOUNT" in Purchases/Credits section

function parseBOA(lines: string[]): ParsedTransaction[] {
  const defaultYear = new Date().getFullYear();
  const results: ParsedTransaction[] = [];
  let inActivity = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/purchases|credits|payments|transactions|activity/i.test(line) && line.length < 60) {
      inActivity = true; continue;
    }
    if (!inActivity) continue;
    if (/^(Trans\.|Post\.|Date|Description|Reference|Amount)/i.test(line)) continue;

    // "MM/DD/YY  MERCHANT  AMOUNT"  or "MM/DD  MERCHANT  AMOUNT"
    const m = line.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/);
    if (m) {
      const date = parseDate(m[1], defaultYear);
      const amount = parseAmount(m[3]);
      if (date && amount !== null && amount !== 0) {
        results.push({ date, note: m[2].trim(), amount: Math.abs(amount), type: amount < 0 ? 'income' : 'expense', bank: 'BOA' });
      }
    }
  }
  return results;
}

// ── Discover ──────────────────────────────────────────────────────────────────
// Format: "MM/DD/YYYY  MERCHANT  CATEGORY  AMOUNT"

function parseDiscover(lines: string[]): ParsedTransaction[] {
  const defaultYear = new Date().getFullYear();
  const results: ParsedTransaction[] = [];
  let inActivity = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (/transactions|activity|purchases/i.test(line) && line.length < 60) {
      inActivity = true; continue;
    }
    if (!inActivity) continue;
    if (/^(Trans\.|Post\.|Date|Description|Category|Amount)/i.test(line)) continue;

    const m = line.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/);
    if (m) {
      const date = parseDate(m[1], defaultYear);
      const amount = parseAmount(m[3]);
      if (date && amount !== null && amount !== 0) {
        results.push({ date, note: m[2].trim(), amount: Math.abs(amount), type: amount < 0 ? 'income' : 'expense', bank: 'Discover' });
      }
    }
  }
  return results;
}

// ── Generic fallback ──────────────────────────────────────────────────────────

function parseGeneric(lines: string[], bank: string): ParsedTransaction[] {
  const year = new Date().getFullYear();
  const results: ParsedTransaction[] = [];

  const patterns = [
    /^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/,
    /^([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/,
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
    // Token-based aggressive fallback
    const amtRe = /^-?\$?[\d,]+\.\d{2}$/;
    const dateRe = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$|^[A-Za-z]{3,9}\.?\s+\d{1,2}/;
    for (const line of lines) {
      const tokens = line.split(/\s{2,}|\t/);
      if (tokens.length < 3) continue;
      const first = tokens[0].trim(), last = tokens[tokens.length - 1].trim();
      if (!dateRe.test(first) || !amtRe.test(last)) continue;
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

// ── Router ────────────────────────────────────────────────────────────────────

export function parseTransactions(text: string, bank: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  switch (bank) {
    case 'Chase':      return parseChase(lines);
    case 'AMEX':       return parseAMEX(lines);
    case 'Apple Card': return parseAppleCard(lines);
    case 'Citi':       return parseCiti(lines);
    case 'BOA':        return parseBOA(lines);
    case 'Discover':   return parseDiscover(lines);
    default:           return parseGeneric(lines, bank);
  }
}

// ── Duplicate detection ───────────────────────────────────────────────────────

export type DuplicateStatus = 'none' | 'possible' | 'confirmed';

/**
 * confirmed : 날짜 ±0일 + 금액 ±$0.01 (확실한 중복)
 * possible  : 날짜 ±2일 + 금액 ±2%   (수기 입력 vs 스테이먼트 차이)
 * none      : 중복 아님
 */
export function getDuplicateStatus(
  candidate: { date: string; note: string; amount: number },
  existing: Transaction[],
): DuplicateStatus {
  const cDate = new Date(candidate.date).getTime();
  const cAmt  = Math.abs(candidate.amount);

  let best: DuplicateStatus = 'none';

  for (const t of existing) {
    const dayDiff = Math.abs(new Date(t.date).getTime() - cDate) / 86_400_000;
    const amtDiff = Math.abs(Math.abs(t.amount) - cAmt);
    const amtPct  = cAmt > 0 ? amtDiff / cAmt : 0;

    if (dayDiff === 0 && amtDiff < 0.02) {
      return 'confirmed';           // 확실한 중복 → 즉시 반환
    }
    if (dayDiff <= 2 && amtPct <= 0.02) {
      best = 'possible';            // 가능성 있는 중복 → 계속 탐색
    }
  }

  return best;
}

// ── Category guesser ──────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<[string[], Transaction['category']]> = [
  [['restaurant','food','cafe','coffee','mcdonald','starbucks','sushi','pizza','burger','kitchen','grill','dine','eatery','doordash','ubereats','grubhub','chipotle','boba','bbq','ramen','noodle'], 'Food'],
  [['grocery','costco','trader','whole foods','target','walmart','market','safeway','kroger','aldi','hmart','h mart'], 'Market'],
  [['amazon','apple.com','best buy','shop','store','mall','fashion','clothing','zara','h&m','nike','uniqlo','etsy'], 'Shopping'],
  [['uber','lyft','taxi','transit','metro','bus','train','subway','parking','toll','mta','bart','caltrain'], 'Travel'],
  [['airline','airways','united','delta','american air','southwest','jeju','flight','hotel','airbnb','vrbo','expedia','booking','marriott','hilton'], 'Travel'],
  [['netflix','spotify','hulu','disney','amazon prime','subscription','apple one','youtube','twitch'], 'Subscriptions'],
  [['electric','gas','water','internet','phone','t-mobile','verizon','at&t','insurance','utility','bill','comcast','xfinity'], 'Bill'],
  [['shell','chevron','exxon','bp','arco','76','gas station','fuel','speedway'], 'Gas'],
  [['gym','health','dental','doctor','pharmacy','cvs','walgreens','hospital','medical','vision','optometry'], 'ETC'],
  [['payment','autopay','thank you','minimum due','balance','credit card payment'], 'Payment'],
  [['cashback','cash back','reward','credit','refund'], 'Cash Back'],
  [['transfer','deposit','direct deposit','payroll','salary','zelle','venmo','paypal'], 'Income'],
];

export function guessCategory(note: string): Transaction['category'] {
  const lower = note.toLowerCase();
  for (const [keywords, cat] of CATEGORY_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'ETC';
}
