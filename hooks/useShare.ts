// hooks/useShare.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SharePayload, SharePlatform, platforms } from "../app/[local]/platforms";

type Status = "idle" | "opening" | "success" | "fallback" | "copied";

interface UseShareOptions {
  /** 默认分享内容，调用 share 时也可以覆盖 */
  payload: SharePayload;
  /** 唤起超时 ms */
  timeout?: number;
  onSuccess?: (platform: SharePlatform) => void;
  onFallback?: (platform: SharePlatform, webUrl: string) => void;
  onCopied?: () => void;
}

export const useShare = ({
  payload,
  timeout = 1500,
  onSuccess,
  onFallback,
  onCopied,
}: UseShareOptions) => {
  const [status, setStatus] = useState<Status>("idle");
  const [activeId, setActiveId] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlerRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (handlerRef.current) {
      document.removeEventListener("visibilitychange", handlerRef.current);
      handlerRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /** 复制链接 */
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // 旧浏览器降级
        const input = document.createElement("textarea");
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setStatus("copied");
      onCopied?.();
      // 2s 后回到 idle，方便 UI 显示「已复制」
      setTimeout(() => setStatus("idle"), 2000);
    },
    [onCopied]
  );

  /** 唤起 App，失败降级 Web */
  const openApp = useCallback(
    (platform: SharePlatform, p: SharePayload) => {
      if (typeof window === "undefined") return;
      cleanup();

      const ua = navigator.userAgent;
      const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
      const isWeChat = /MicroMessenger/i.test(ua);

      const webUrl = platform.webLink?.(p);
      const appUrl = platform.appLink?.(p);

      // 桌面端 / 微信内 / 没配 appLink → 直接走 Web
      if (!isMobile || isWeChat || !appUrl) {
        if (webUrl) {
          setStatus("fallback");
          onFallback?.(platform, webUrl);
          window.open(webUrl, isMobile ? "_self" : "_blank");
        }
        return;
      }

      setStatus("opening");
      const start = Date.now();

      const onVisibilityChange = () => {
        if (document.hidden) {
          setStatus("success");
          onSuccess?.(platform);
          cleanup();
        }
      };
      handlerRef.current = onVisibilityChange;
      document.addEventListener("visibilitychange", onVisibilityChange);

      timerRef.current = setTimeout(() => {
        if (Date.now() - start < timeout + 100 && !document.hidden && webUrl) {
          setStatus("fallback");
          onFallback?.(platform, webUrl);
          window.location.href = webUrl;
        }
        cleanup();
      }, timeout);

      window.location.href = appUrl;
    },
    [timeout, onSuccess, onFallback, cleanup]
  );

  /** 统一入口：根据 platform.id 自动派发 */
  const share = useCallback(
    (platformId: string, override?: Partial<SharePayload>) => {
      const platform = platforms.find((p) => p.id === platformId);
      if (!platform) return;

      setActiveId(platformId);
      const finalPayload = { ...payload, ...override };

      if (platform.isCopy) {
        copy(finalPayload.url);
        return;
      }

      openApp(platform, finalPayload);
    },
    [payload, copy, openApp]
  );

  return {
    platforms,
    share,
    status,
    activeId,
    isOpening: status === "opening",
    isCopied: status === "copied",
  };
};