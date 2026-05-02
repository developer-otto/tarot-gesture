// app/products/[id]/page.tsx
"use client";

import { useShare } from "@/hooks/useShare";
import { useState } from "react";

export default function ProductPage() {
  const product = {
    id: "p001",
    name: "AirPods Pro 3",
    price: 1899,
    url: "https://shop.com/products/p001",
  };

  const [toast, setToast] = useState("");

  const { platforms, share, activeId, isOpening } = useShare({
    payload: {
      url: product.url,
      text: `${product.name} 限时特价 ¥${product.price},快来看看!`,
    },
    onSuccess: (p) => showToast(`正在打开 ${p.label}...`),
    onFallback: (p) => showToast(`未检测到 ${p.label} App，已跳转网页版`),
    onCopied: () => showToast("链接已复制到剪贴板 ✓"),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl bg-gray-100 p-6">
        <h2 className="text-xl font-bold">{product.name}</h2>
        <p className="mt-2 text-2xl text-red-500">¥{product.price}</p>
      </div>

      <div className="mt-6 grid grid-cols-6 gap-3">
        {platforms.map((p) => {
          const Icon = p.icon;
          const loading = isOpening && activeId === p.id;

          return (
            <button
              key={p.id}
              onClick={() => share(p.id)}
              disabled={isOpening}
              className="flex flex-col items-center gap-1 transition-transform active:scale-90 disabled:opacity-50"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm"
                style={{ background: p.bg }}
              >
                {loading ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </span>
              <span className="text-[10px] text-gray-600">{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </main>
  );
}