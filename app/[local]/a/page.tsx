"use client";

import { useShare } from "@/hooks/useShare";


export default function ShareList({ url, text }: { url: string; text: string }) {
  const { platforms, share, activeId, isOpening, isCopied } = useShare({
    payload: { text, url },
    onSuccess: (p) => console.log(`已唤起 ${p.label}`),
    onFallback: (p) => console.log(`${p.label} 未安装，已跳转网页`),
    onCopied: () => console.log("链接已复制"),
  });

  return (
    <div className="flex flex-wrap gap-4">
      {platforms.map((p) => {
        const loading = isOpening && activeId === p.id;
        const copied = isCopied && p.isCopy;

        return (
          <button
            key={p.id}
            onClick={() => share(p.id)}
            disabled={isOpening}
            className="flex flex-col items-center gap-2"
          >
            <span className="text-xs">
              {copied ? "已复制" : loading ? "打开中..." : p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}