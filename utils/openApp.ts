// utils/openApp.ts
export const openApp = (appUrl: string, webUrl: string) => {
  const start = Date.now();
  const TIMEOUT = 1500;

  // 用 visibilitychange 判断是否成功唤起
  const onVisibilityChange = () => {
    if (document.hidden) {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  // 超时未跳走 → 降级到 Web
  const timer = setTimeout(() => {
    if (Date.now() - start < TIMEOUT + 100 && !document.hidden) {
      window.location.href = webUrl;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }, TIMEOUT);

  // 触发唤起
  window.location.href = appUrl;
};