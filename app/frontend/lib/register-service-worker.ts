/**
 * Service Worker を登録する。
 *
 * 登録は inline script ではなくここから行う。CSP が `script-src 'self'` + nonce で
 * inline を許していないため (ADR 0007)。Service Worker 自体の方針は ADR 0010 を参照。
 *
 * 失敗しても読む分にはまったく困らないので、握って記録だけ残す。開発中は登録しない
 * (蓄えが挟まると、直したはずのものが古いまま出て混乱するため)。
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in globalThis.navigator)) return;
  if (import.meta.env.DEV) return;

  /*
   * 読み込みが落ち着いてから登録する。最初の描画と登録の通信がぶつからないようにするため。
   *
   * ただし load を待つだけでは足りない。このモジュールはスクリプトとして遅れて読まれるので、
   * ここに来た時点で load が終わっていることがある。その場合リスナーは二度と呼ばれないので、
   * 済んでいるなら即座に登録する。
   */
  if (document.readyState === "complete") {
    register();
    return;
  }
  globalThis.addEventListener("load", register, { once: true });
}

function register(): void {
  void globalThis.navigator.serviceWorker
    .register("/sw.js")
    .catch((error: unknown) => {
      console.error("failed to register the service worker", error);
    });
}
