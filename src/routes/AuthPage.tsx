import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { IndianRupee, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import {
  signInWithPassword,
  signUpWithPassword,
  sendPasswordResetEmail,
  updatePassword,
} from '@/services/auth.service';
import { errorMessage } from '@/lib/errors';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password';

export function AuthPage() {
  const { status } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { push: pushToast } = useToast();

  const urlMode = searchParams.get('mode');
  const [mode, setMode] = useState<AuthMode>(
    urlMode === 'reset-password' ? 'reset-password' : 'sign-in',
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // If already authenticated and not in password reset mode, navigate to app
  if (status === 'authenticated' && mode !== 'reset-password') {
    const from = (location.state as { from?: string } | null)?.from || '/app';
    return <Navigate to={from} replace />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signInWithPassword(email, password);
      pushToast({
        title: 'Welcome back!',
        tone: 'success',
      });
      const from = (location.state as { from?: string } | null)?.from || '/app';
      navigate(from, { replace: true });
    } catch (err) {
      pushToast({
        title: 'Sign in failed',
        description: errorMessage(err),
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      pushToast({
        title: 'Display name required',
        description: 'Please enter your name so family members recognize you.',
        tone: 'error',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUpWithPassword(email, password, displayName.trim());
      if (result.needsEmailConfirmation) {
        setEmailSent(true);
        pushToast({
          title: 'Confirmation email sent',
          description: 'Please check your inbox to confirm your account.',
          tone: 'success',
        });
      } else {
        pushToast({
          title: 'Account created!',
          tone: 'success',
        });
        navigate('/onboarding', { replace: true });
      }
    } catch (err) {
      pushToast({
        title: 'Sign up failed',
        description: errorMessage(err),
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(email);
      setEmailSent(true);
      pushToast({
        title: 'Password reset link sent',
        description: 'Check your email for the link to reset your password.',
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not send reset email',
        description: errorMessage(err),
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updatePassword(password);
      pushToast({
        title: 'Password updated',
        description: 'You can now sign in with your new password.',
        tone: 'success',
      });
      setMode('sign-in');
    } catch (err) {
      pushToast({
        title: 'Could not update password',
        description: errorMessage(err),
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IndianRupee className="size-6" />
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-content">FamilyLedger</h1>
          <p className="mt-1 text-xs text-content-muted">
            One shared household expense ledger for the whole family
          </p>
        </div>

        <Card>
          {mode !== 'forgot-password' && mode !== 'reset-password' && (
            <div className="p-4 pb-0">
              <Tabs value={mode} onValueChange={(val) => setMode(val as AuthMode)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                  <TabsTrigger value="sign-up">Create account</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          <CardHeader>
            <CardTitle>
              {mode === 'sign-in' && 'Sign in to your account'}
              {mode === 'sign-up' && 'Create family account'}
              {mode === 'forgot-password' && 'Reset your password'}
              {mode === 'reset-password' && 'Enter new password'}
            </CardTitle>
            <CardDescription>
              {mode === 'sign-in' && 'Enter your credentials to access the shared ledger.'}
              {mode === 'sign-up' && 'Sign up to start tracking shared expenses with your family.'}
              {mode === 'forgot-password' && 'We will send you a secure link to reset your password.'}
              {mode === 'reset-password' && 'Choose a strong password with at least 6 characters.'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {emailSent ? (
              <div className="space-y-4 py-2 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Sparkles className="size-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-content">Check your email</p>
                  <p className="text-xs text-content-muted">
                    We sent instructions to <span className="font-medium text-content">{email}</span>.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEmailSent(false);
                    setMode('sign-in');
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            ) : mode === 'sign-in' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot-password')}
                      className="text-2xs text-accent hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" loading={submitting}>
                  Sign in
                </Button>
              </form>
            ) : null}

            {mode === 'sign-up' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Your name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" className="w-full" loading={submitting}>
                  Create account
                </Button>
              </form>
            )}

            {mode === 'forgot-password' && (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Email address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" loading={submitting}>
                  Send reset link
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setMode('sign-in')}
                    className="text-xs text-content-muted hover:text-content"
                  >
                    Back to sign in
                  </button>
                </div>
              </form>
            )}

            {mode === 'reset-password' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" className="w-full" loading={submitting}>
                  Update password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-2xs text-content-subtle">
          FamilyLedger · Strict integer paise accounting in INR
        </p>
      </div>
    </div>
  );
}

