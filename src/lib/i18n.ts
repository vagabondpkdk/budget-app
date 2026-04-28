export type Lang = 'ko' | 'en';

const KO = {
  // Nav
  nav_dashboard: '대시보드', nav_daily: '날짜별', nav_cards: '카드',
  nav_analytics: '분석', nav_add: '추가', nav_title: 'Budget', nav_subtitle: 'Kyle & Ella',
  // Sync
  sync_syncing: '동기화 중…', sync_synced: '동기화됨', sync_offline: '오프라인',
  sync_cloud: '클라우드 동기화 중…',
  // Data
  export_data: '데이터 내보내기', import_data: '데이터 가져오기', save_cloud: '클라우드 저장',
  // Date picker
  today: '오늘', months_ko: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  // Dashboard
  income: '수입', expense: '지출', saving: '저축',
  saving_rate: '이번 달 저축률', saving_label: '저축',
  weekly_expense: '주간 지출', category_expense: '카테고리별 지출',
  recent_tx: '최근 거래', view_all: '전체 보기 →',
  days_left: (n: number) => `${n}일 남음`, this_month: '이번 달',
  filtered_tx: (cat: string) => `${cat} 거래 내역`,
  // DailyView
  dow: ['일','월','화','수','목','금','토'],
  total_month_label: '이번 달 총 지출', add: '추가', total_label: '총 지출:',
  // CardManager
  card_mgmt: '카드 관리', new_card: '새 카드', this_month_usage: '이번 달 사용',
  due_day: '결제일', due_day_label: (n: number) => `결제일 ${n}일`,
  due_soon_label: '임박', due_overdue_label: '완료',
  card_monthly: '카드별 이번 달 지출', payment_due_title: '결제일',
  inactive_cards: '비활성 카드', inactive: '비활성', activate: '활성화',
  drag_hint: '꾹 눌러서 순서 변경',
  // TransactionForm
  add_tx: '거래 추가', edit_tx: '거래 수정',
  t_expense: '지출', t_income: '수입', t_cashback: '캐시백', t_payment: '결제', t_refund: '환급',
  date_lbl: '날짜', amount_lbl: '금액 ($)', card_select: '카드 선택',
  category_lbl: '카테고리', memo_lbl: '메모', memo_ph: '예: Costco, Target...',
  payer_lbl: '결제자', recurring_lbl: '반복', save_lbl: '저장', save_edit_lbl: '수정 저장',
  // Banner
  due_banner: (c: string) => `⚠️ 결제일 임박: ${c}`,
  // Language
  lang_label: '언어', lang_ko: '한국어', lang_en: 'English',
  // Analytics
  an_weekly: '주간', an_monthly: '월간', an_yearly: '연간',
  an_this_week: '이번 주 지출', an_vs_last: '지난주 대비',
  an_daily_this_week: '이번 주 일별 지출',
  an_month_category: '이번 달 카테고리',
  an_income_expense: (y: number) => `${y}년 수입/지출 추이`,
  an_saving_rate: '저축률 변화', an_card_monthly: '카드별 이번 달 지출',
  an_heatmap: '월별 지출 히트맵',
  an_asset_trend: '자산 증가 추이', an_yearly_category: '연간 카테고리',
  an_asset_status: '자산 현황', an_net_worth: '총 순자산',
  an_annual_income: '연간 수입', an_annual_expense: '연간 지출', an_annual_saving: '연간 저축',
  an_income_label: '수입', an_expense_label: '지출', an_saving_label: '저축',
  an_net_worth_label: '순자산', an_saving_label2: '저축',
  an_user_month: '멤버별 이번 달 지출', an_user_year: '멤버별 월간 지출 추이',
  // Category labels (Korean)
  cat: {
    'Home Usage': '생활용품', 'Food': '식비', 'Gas': '주유', 'Shopping': '쇼핑',
    'Market': '마트', 'Saipan': '사이판', 'Travel': '여행', 'Bill': '고지서',
    'Date': '데이트', 'Vehicle': '자동차', 'Cash Back': '캐시백', 'Statement Credit': '크레딧',
    'From Korea': '한국', 'Subscriptions': '구독', 'Exchange Currency': '환전',
    'Fine': '벌금', 'Tax': '세금', 'Refund': '환불', 'ETC': '기타', 'Payment': '결제',
    'Immigration': '이민', 'Investment': '투자', 'Adjustment': '조정', 'Income': '수입',
    'Interest': '이자', 'Incentive': '인센티브', 'Bonus': '보너스',
    'Recycle': '재활용', 'Apple Cash': '애플캐시',
  } as Record<string, string>,
} as const;

const EN = {
  nav_dashboard: 'Dashboard', nav_daily: 'Calendar', nav_cards: 'Cards',
  nav_analytics: 'Analytics', nav_add: 'Add', nav_title: 'Budget', nav_subtitle: 'Kyle & Ella',
  sync_syncing: 'Syncing…', sync_synced: 'Synced', sync_offline: 'Offline',
  sync_cloud: 'Cloud syncing…',
  export_data: 'Export Data', import_data: 'Import Data', save_cloud: 'Save to Cloud',
  today: 'Today', months_ko: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  income: 'Income', expense: 'Expenses', saving: 'Saving',
  saving_rate: 'Monthly Saving Rate', saving_label: 'Saved',
  weekly_expense: 'Weekly Expenses', category_expense: 'By Category',
  recent_tx: 'Recent Transactions', view_all: 'View all →',
  days_left: (n: number) => `${n} days left`, this_month: 'This month',
  filtered_tx: (cat: string) => `${cat} Transactions`,
  dow: ['Su','Mo','Tu','We','Th','Fr','Sa'],
  total_month_label: 'Total Monthly Expenses', add: 'Add', total_label: 'Total:',
  card_mgmt: 'Cards', new_card: 'New Card', this_month_usage: 'This Month',
  due_day: 'Due', due_day_label: (n: number) => `Due ${n}`,
  due_soon_label: 'Soon', due_overdue_label: 'Paid',
  card_monthly: 'Monthly by Card', payment_due_title: 'Payment Due',
  inactive_cards: 'Inactive Cards', inactive: 'Inactive', activate: 'Activate',
  drag_hint: 'Hold & drag to reorder',
  add_tx: 'Add Transaction', edit_tx: 'Edit Transaction',
  t_expense: 'Expense', t_income: 'Income', t_cashback: 'Cashback', t_payment: 'Payment', t_refund: 'Refund',
  date_lbl: 'Date', amount_lbl: 'Amount ($)', card_select: 'Select Card',
  category_lbl: 'Category', memo_lbl: 'Memo', memo_ph: 'e.g. Costco, Target...',
  payer_lbl: 'Payer', recurring_lbl: 'Recurring', save_lbl: 'Save', save_edit_lbl: 'Save Changes',
  due_banner: (c: string) => `⚠️ Due soon: ${c}`,
  lang_label: 'Language', lang_ko: '한국어', lang_en: 'English',
  an_weekly: 'Weekly', an_monthly: 'Monthly', an_yearly: 'Yearly',
  an_this_week: 'This Week', an_vs_last: 'Prev Week',
  an_daily_this_week: 'Daily Expenses This Week',
  an_month_category: 'This Month by Category',
  an_income_expense: (y: number) => `${y} Income vs Expenses`,
  an_saving_rate: 'Saving Rate Trend', an_card_monthly: 'Monthly Spend by Card',
  an_heatmap: 'Monthly Expense Heatmap',
  an_asset_trend: 'Asset Growth Trend', an_yearly_category: 'Yearly by Category',
  an_asset_status: 'Asset Overview', an_net_worth: 'Total Net Worth',
  an_annual_income: 'Annual Income', an_annual_expense: 'Annual Expenses', an_annual_saving: 'Annual Savings',
  an_income_label: 'Income', an_expense_label: 'Expenses', an_saving_label: 'Saving',
  an_net_worth_label: 'Net Worth', an_saving_label2: 'Savings',
  an_user_month: 'This Month by Member', an_user_year: 'Monthly Spend by Member',
  cat: {
    'Home Usage': 'Home', 'Food': 'Food', 'Gas': 'Gas', 'Shopping': 'Shopping',
    'Market': 'Market', 'Saipan': 'Saipan', 'Travel': 'Travel', 'Bill': 'Bill',
    'Date': 'Date', 'Vehicle': 'Car', 'Cash Back': 'Cashback', 'Statement Credit': 'Credit',
    'From Korea': 'Korea', 'Subscriptions': 'Subs', 'Exchange Currency': 'FX',
    'Fine': 'Fine', 'Tax': 'Tax', 'Refund': 'Refund', 'ETC': 'Other', 'Payment': 'Payment',
    'Immigration': 'Immig.', 'Investment': 'Invest', 'Adjustment': 'Adj.', 'Income': 'Income',
    'Interest': 'Interest', 'Incentive': 'Incentive', 'Bonus': 'Bonus',
    'Recycle': 'Recycle', 'Apple Cash': 'Apple $',
  } as Record<string, string>,
} as const;

export const TRANSLATIONS: Record<Lang, typeof KO> = { ko: KO, en: EN as unknown as typeof KO };

export function tLang(lang: Lang, key: keyof typeof KO): string {
  const val = TRANSLATIONS[lang][key];
  if (typeof val === 'function' || typeof val === 'object') return key;
  return val as string;
}

export function tCat(lang: Lang, cat: string): string {
  return TRANSLATIONS[lang].cat[cat] ?? cat;
}
