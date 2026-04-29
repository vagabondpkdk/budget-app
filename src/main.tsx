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

  (async () => {
    try {
      // ① 현재 번들 파일이 서버에 없으면 (404) → 전체 캐시 초기화 후 재로드
      const testUrl = document.querySelector<HTMLScriptElement>('script[src*="/assets/index-"]')?.src;
      if (testUrl) {
        const res = await fetch(testUrl, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
          location.reload();
          return;
        }
      }

      // ② 새 SW가 설치 대기 중이면 즉시 활성화 요청 (SKIP_WAITING)
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        const activateWaiting = (r: ServiceWorkerRegistration) => {
          if (r.waiting) {
            r.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        };
        activateWaiting(reg);
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (newSW) {
            newSW.addEventListener('statechange', () => {
              if (newSW.state === 'installed') activateWaiting(reg);
            });
          }
        });

        // ③ 백그라운드에서 SW 업데이트 즉시 체크
        reg.update().catch(() => { /* 네트워크 없으면 무시 */ });
      }
    } catch { /* 무시 */ }
  })();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
