'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function RedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const productId = searchParams.get('productId');
    if (productId) {
      router.replace(`/admin/recipes?productId=${productId}&action=new&returnUrl=/admin/products`);
    } else {
      router.replace('/admin/recipes');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-medium">กำลังเปิดระบบสูตรการผลิต (BOM)...</p>
      </div>
    </div>
  );
}

export default function RecipeNewRedirect() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RedirectContent />
    </Suspense>
  );
}
