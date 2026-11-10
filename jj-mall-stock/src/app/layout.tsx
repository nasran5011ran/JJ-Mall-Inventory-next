import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { SWRProvider } from "@/lib/swr-provider";
import { ThemeProvider } from "@/context/theme-context";

const promptFont = Prompt({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "thai"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "JJ Mall - Inventory & Stock Management System",
  description: "ระบบจัดการสต็อกสินค้าและระบบขายสินค้าแบบครบวงจร บริษัท JJ Mall",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning className={`${promptFont.variable} h-full antialiased`}>
      <head>
        {/* Anti-FOUC Theme Script: Prevents white flash when loading Dark Mode (Per-Role Isolation) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var path = window.location.pathname || '';
                  var key = 'jj_mall_theme_DEFAULT';
                  if (path.indexOf('/admin') === 0) key = 'jj_mall_theme_ADMIN';
                  else if (path.indexOf('/staff') === 0) key = 'jj_mall_theme_STAFF';
                  var saved = localStorage.getItem(key);
                  if (!saved) {
                    saved = localStorage.getItem('jj_mall_theme');
                  }
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (saved === 'system' && prefersDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white">
        <AuthProvider>
          <ThemeProvider>
            <SWRProvider>{children}</SWRProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
