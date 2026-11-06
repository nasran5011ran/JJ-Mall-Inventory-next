'use client';

import React from 'react';
import { SWRConfig } from 'swr';

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed with status ${res.status}`);
  }
  return res.json();
};

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false, // Don't spam DB when switching window focus
        revalidateIfStale: true,  // Show instant cached data first, revalidate in background
        dedupingInterval: 4000,   // Dedupe requests within 4 seconds
        keepPreviousData: true,   // Never show blank screen when loading/filtering
      }}
    >
      {children}
    </SWRConfig>
  );
}
