import React from 'react';
import Link from 'next/link';

export default function RootNotFound() {
  return (
    <div className="min-h-screen bg-[#040707] flex flex-col items-center justify-center p-6 text-center text-[#e8f5f5]">
      <div className="max-w-md w-full p-8 rounded-3xl border border-[#132222] bg-[#070d0d] space-y-6 shadow-2xl">
        <h2 className="text-4xl font-extrabold text-[#00d4aa]">404</h2>
        <h3 className="text-xl font-bold">الصفحة غير موجودة</h3>
        <p className="text-xs text-[#527373] leading-relaxed">
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <Link
          href="/ar"
          className="inline-block w-full py-3 bg-[#00d4aa] text-[#031111] font-bold text-xs rounded-xl hover:bg-[#00e6b8] transition-all text-center cursor-pointer"
        >
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
