import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AlertTriangle, Info, RefreshCw, ServerCrash, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingBlock } from '@/components/ui/spinner';
import { supabaseEnv } from '@/lib/env';

/** Full-page loading state used while the session is being restored. */
export function AppLoadingScreen({ label = 'Loading FamilyLedger…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas">
      <LoadingBlock label={label} />
    </div>
  );
}

/**
 * Shown instead of the app when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * missing. Failing loudly at the edge is much easier to debug than an empty
 * dashboard full of network errors.
 */
export function ConfigurationNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-warn" />
            <CardTitle>Supabase environment is not configured</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-content-muted">
          <p>
            Copy <code className="rounded bg-surface-sunken px-1 py-0.5 text-xs">.env.example</code>{' '}
            to <code className="rounded bg-surface-sunken px-1 py-0.5 text-xs">.env.local</code> and
            fill in the two public values from your Supabase project (Settings → API):
          </p>
          <ul className="space-y-1 text-xs">
            {supabaseEnv.problems.map((problem) => (
              <li key={problem} className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-content-subtle" />
                <span>{problem}</span>
              </li>
            ))}
          </ul>
          <pre className="overflow-x-auto rounded-md border border-line bg-surface-sunken p-3 text-xs text-content">
{`VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon or sb_publishable_... key>`}
          </pre>
          <p className="text-xs">
            Only the public anon/publishable key belongs in the browser bundle. The service-role key
            must never be exposed; it is used exclusively by the invitation Edge Function.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Shown when a provider/outlet cannot load (network down, wrong database). */
export function ErrorPanel({
  title,
  description,
  onRetry,
  retryLabel = 'Try again',
}: {
  title: string;
  description: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <Card className="border-danger/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-danger" />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-content-muted">
        <div className="text-xs leading-relaxed">{description}</div>
        <div className="flex flex-wrap gap-2">
          {onRetry ? (
            <Button size="sm" variant="secondary" onClick={onRetry}>
              <RefreshCw />
              {retryLabel}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/auth">Go to sign in</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Last-resort screen for an unrecoverable render error. */
export function CrashPanel({ message }: { message?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <Card className="w-full max-w-lg border-danger/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ServerCrash className="size-4 text-danger" />
            <CardTitle>Something broke on this screen</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs leading-relaxed text-content-muted">
            The error was contained so the rest of the app keeps working. Reloading usually clears
            it; if it keeps happening, the details below help diagnose it.
          </p>
          {message ? (
            <pre className="max-h-40 overflow-auto rounded-md border border-line bg-surface-sunken p-3 text-2xs text-content-muted">
              {message}
            </pre>
          ) : null}
          <Button size="sm" onClick={() => window.location.reload()}>
            <RefreshCw />
            Reload app
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
