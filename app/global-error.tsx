'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global layout error boundary:', error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[#040707] flex flex-col items-center justify-center p-6 text-center text-[#e8f5f5]">
        <div className="max-w-md w-full p-8 rounded-3xl border border-[#132222] bg-[#070d0d] space-y-6 shadow-2xl">
          <h2 className="text-2xl font-bold text-[#f43f5e]">حدث خطأ في النظام</h2>
          <p className="text-xs text-[#527373] leading-relaxed">
            حدث خطأ غير متوقع على مستوى النظام.
          </p>
          <button
            onClick={() => reset()}
            className="inline-block w-full py-3 bg-[#00d4aa] text-[#031111] font-bold text-xs rounded-xl hover:bg-[#00e6b8] transition-all text-center cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
