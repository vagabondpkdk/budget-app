import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { TRANSLATIONS } from '../../lib/i18n';

export function MonthPicker() {
  const { currentYear, currentMonth, setCurrentMonth } = useStore();
  const lang = useStore(s => s.language);
  const T = TRANSLATIONS[lang];
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;

  function goToToday() {
    setCurrentMonth(todayYear, todayMonth);
    setOpen(false);
  }

  function selectMonth(m: number) {
    setCurrentMonth(pickerYear, m);
    setOpen(false);
  }

  const label = lang === 'ko'
    ? `${currentYear}년 ${currentMonth}월`
    : `${T.months_ko[currentMonth - 1]} ${currentYear}`;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const d = new Date(currentYear, currentMonth - 2);
            setCurrentMonth(d.getFullYear(), d.getMonth() + 1);
          }}
          className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-muted)]"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={() => { setPickerYear(currentYear); setOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <CalendarDays size={14} className="text-[var(--color-info)]" />
          <span className="text-base font-bold text-[var(--color-text)]">{label}</span>
        </button>

        <button
          onClick={() => {
            const d = new Date(currentYear, currentMonth);
            setCurrentMonth(d.getFullYear(), d.getMonth() + 1);
          }}
          className="p-1.5 rounded-full hover:bg-white/10 text-[var(--color-muted)]"
        >
          <ChevronRight size={16} />
        </button>

        {(currentYear !== todayYear || currentMonth !== todayMonth) && (
          <button
            onClick={goToToday}
            className="text-xs px-2 py-1 rounded-full bg-[var(--color-info)]/20 text-[var(--color-info)] hover:bg-[var(--color-info)]/30 transition-colors font-medium"
          >
            {T.today}
          </button>
        )}
      </div>

      {/* Picker Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[var(--color-surface)] rounded-2xl p-5 w-full max-w-xs shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Year selector */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setPickerYear(y => y - 1)}
                className="p-2 rounded-full hover:bg-white/10 text-[var(--color-muted)]"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-lg font-bold text-[var(--color-text)]">{pickerYear}</span>
              <button
                onClick={() => setPickerYear(y => y + 1)}
                className="p-2 rounded-full hover:bg-white/10 text-[var(--color-muted)]"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {T.months_ko.map((m, i) => {
                const isSelected = pickerYear === currentYear && i + 1 === currentMonth;
                const isToday = pickerYear === todayYear && i + 1 === todayMonth;
                return (
                  <button
                    key={i}
                    onClick={() => selectMonth(i + 1)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-[var(--color-highlight)] text-white'
                        : isToday
                        ? 'bg-[var(--color-info)]/20 text-[var(--color-info)] ring-1 ring-[var(--color-info)]/40'
                        : 'bg-white/5 text-[var(--color-muted)] hover:bg-white/10'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {/* Today button */}
            <button
              onClick={goToToday}
              className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] text-[var(--color-info)] font-semibold text-sm hover:bg-white/10"
            >
              📅 {T.today}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
