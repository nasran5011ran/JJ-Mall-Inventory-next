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
        {/* Anti-FOUC Theme Script: Strictly locks /login, /staff, and non-admin routes to Light Mode */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var path = window.location.pathname || '';
                  // โหมดมืด (Dark Mode) อนุญาตเฉพาะเส้นทาง /admin เท่านั้น
                  // หน้าอื่นๆ ทั้งหมด เช่น /login, /staff/* ฯลฯ บังคับเป็นโหมดสว่าง (Light Mode) 100% เสมอ
                  if (path.indexOf('/admin') === 0) {
                    var saved = localStorage.getItem('jj_mall_theme_ADMIN');
                    if (saved === 'dark') {
                      document.documentElement.classList.add('dark');
                      document.documentElement.setAttribute('data-theme', 'dark');
                      document.documentElement.style.colorScheme = 'dark';
                      return;
                    }
                    if (saved === 'system') {
                      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                      if (prefersDark) {
                        document.documentElement.classList.add('dark');
                        document.documentElement.setAttribute('data-theme', 'dark');
                        document.documentElement.style.colorScheme = 'dark';
                        return;
                      }
                    }
                  }
                  // หน้า /login, /staff และหน้าสาธารณะทั้งหมด บังคับโหมดสว่างเสมอ
                  document.documentElement.classList.remove('dark');
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.style.colorScheme = 'light';
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
