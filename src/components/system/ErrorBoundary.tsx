import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { CrashPanel } from '@/components/system/system-screens';

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

/**
 * Contains render errors to the subtree that threw.
 *
 * Without this, a single malformed row would blank the whole app inside a WebView,
 * leaving the user no way back.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the console signal for development; never surface raw errors to users.
    console.error('FamilyLedger render error:', error.message, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) return this.props.fallback(error);
      return <CrashPanel message={error.message} />;
    }
    return this.props.children;
  }
}
