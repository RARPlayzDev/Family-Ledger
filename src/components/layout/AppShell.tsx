import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { MobileNav } from '@/components/layout/MobileNav';

/**
 * Responsive application shell.
 *
 * Desktop (>= lg): persistent sidebar + scrolling content column.
 * Mobile: compact top bar + five-slot bottom navigation, with padding that
 * clears the safe area so nothing hides behind the Android gesture bar.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-content"
      >
        Skip to content
      </a>

      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:shrink-0">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 lg:px-8 lg:pb-12 lg:pt-6"
        >
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
