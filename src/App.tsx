import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/query-client';
import { supabaseEnv } from '@/lib/env';
import { parseAuthLinkError } from '@/lib/auth-error';
import { SessionProvider } from '@/hooks/use-session';
import { HouseholdProvider } from '@/hooks/use-household';
import { ToastProvider } from '@/hooks/use-toast';
import { ExpenseComposerProvider } from '@/features/expenses/use-expense-composer';
import { ErrorBoundary } from '@/components/system/ErrorBoundary';
import { ConfigurationNotice } from '@/components/system/system-screens';
import { RequireHousehold, RequireSession } from '@/components/auth/route-guards';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/toaster';

import { AuthPage } from '@/routes/AuthPage';
import { OnboardingPage } from '@/routes/OnboardingPage';
import { DashboardPage } from '@/routes/DashboardPage';
import { TransactionsPage } from '@/routes/TransactionsPage';
import { AnalyticsPage } from '@/routes/AnalyticsPage';
import { BudgetsPage } from '@/routes/BudgetsPage';
import { MembersPage } from '@/routes/MembersPage';
import { SettingsPage } from '@/routes/SettingsPage';

/**
 * Landing route. Failed Supabase email links come back with `error=...` params
 * (e.g. `error_code=otp_expired` for a spent/expired verification link) — send
 * those to /auth with the parameters intact so the sign-in screen can explain
 * the failure instead of silently swallowing it. Everything else goes to /app.
 */
function RootRedirect() {
  const location = useLocation();
  if (parseAuthLinkError(location.search, location.hash)) {
    return (
      <Navigate
        to={{ pathname: '/auth', search: location.search, hash: location.hash }}
        replace
      />
    );
  }
  return <Navigate to="/app" replace />;
}

export function App() {
  const [queryClient] = useState(() => createQueryClient());

  if (!supabaseEnv.isConfigured) {
    return <ConfigurationNotice />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SessionProvider>
            <HouseholdProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public authentication */}
                  <Route path="/auth" element={<AuthPage />} />

                  {/* Onboarding: Authenticated but may need to create/join household */}
                  <Route
                    path="/onboarding"
                    element={
                      <RequireSession>
                        <OnboardingPage />
                      </RequireSession>
                    }
                  />

                  {/* App shell routes: Session + Household required */}
                  <Route
                    path="/app"
                    element={
                      <RequireSession>
                        <RequireHousehold>
                          <ExpenseComposerProvider>
                            <AppShell />
                          </ExpenseComposerProvider>
                        </RequireHousehold>
                      </RequireSession>
                    }
                  >
                    <Route index element={<DashboardPage />} />
                    <Route path="transactions" element={<TransactionsPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="budgets" element={<BudgetsPage />} />
                    <Route path="members" element={<MembersPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  {/* Default redirect to /app */}
                  <Route path="/" element={<RootRedirect />} />
                  <Route path="*" element={<RootRedirect />} />
                </Routes>
                <Toaster />
              </BrowserRouter>
            </HouseholdProvider>
          </SessionProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
