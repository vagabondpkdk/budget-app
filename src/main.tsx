import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── 서비스 워커 캐시 충돌 방지 ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  // 새 SW가 취임하면 즉시 재로드 → 새 번들 파일로 깨끗하게 시작
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });

  // 현재 번들 파일이 캐시/네트워크 어디서도 없으면 (404) → 전체 캐시 초기화
  (async () => {
    try {
      const testUrl = document.querySelector<HTMLScriptElement>('script[src*="/assets/index-"]')?.src;
      if (testUrl) {
        const res = await fetch(testUrl, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
          location.reload();
        }
      }
    } catch { /* 무시 */ }
  })();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
