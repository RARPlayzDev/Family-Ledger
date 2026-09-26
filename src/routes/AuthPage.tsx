import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { IndianRupee, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSession } from '@/hooks/use-session';
import { useToast } from '@/hooks/use-toast';
import { signIn, signUp } from '@/services/auth.service';
import { errorMessage } from '@/lib/errors';

/**
 * Sign in / Create account (custom auth - no emails, no verification links).
 *
 * Sign-in accepts the email address OR the username. Sign-up needs just a
 * username, an email and a password; the display name starts as the username
 * and can be changed later in Settings.
 */

type AuthMode = 'sign-in' | 'sign-up';

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export function AuthPage() {
  const { status } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const { push: pushToast } = useToast();

  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already signed in (or just signed in): continue where the user was headed.
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from || '/app';
    return <Navigate to={from} replace />;
  }

  const destination = () =>
    (location.state as { from?: string } | null)?.from || '/app';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(identifier, password);
      pushToast({ title: 'Welcome back!', tone: 'success' });
      navigate(destination(), { replace: true });
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
    const cleanUsername = username.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(cleanUsername)) {
      pushToast({
        title: 'Choose a username',
        description: '3-30 characters using letters, numbers or underscores.',
        tone: 'error',
      });
      return;
    }
    if (password.length < 6) {
      pushToast({
        title: 'Password too short',
        description: 'Use at least 6 characters.',
        tone: 'error',
      });
      return;
    }

    setSubmitting(true);
    try {
      await signUp({ email, username: cleanUsername, password });
      pushToast({
        title: 'Account created',
        description: `Welcome, ${cleanUsername}!`,
        tone: 'success',
      });
      navigate(destination(), { replace: true });
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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <IndianRupee className="size-6" />
          </div>
          <h1 className="flex items-center gap-1.5 text-xl font-semibold text-content">
            FamilyLedger
            <Sparkles className="size-4 text-accent" />
          </h1>
          <p className="text-xs text-content-muted">
            {mode === 'sign-in'
              ? 'Sign in to reach your shared family ledger.'
              : 'Create an account to start tracking shared expenses.'}
          </p>
        </div>

        <Card>
          <div className="p-4 pb-0">
            <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                <TabsTrigger value="sign-up">Create account</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <CardHeader>
            <CardTitle>{mode === 'sign-in' ? 'Welcome back' : 'Create family account'}</CardTitle>
            <CardDescription>
              {mode === 'sign-in'
                ? 'Enter your email or username and password.'
                : 'Pick a username, add your email and choose a password.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'sign-in' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-identifier">Email or username</Label>
                  <Input
                    id="signin-identifier"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="you@example.com or rahul"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" className="w-full" loading={submitting}>
                  Sign in
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-username">Username</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="rahul"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    required
                    minLength={3}
                    maxLength={30}
                  />
                  <p className="text-2xs text-content-subtle">
                    3-30 characters: letters, numbers or underscores. Your display name starts as
                    this and can be changed later.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
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
                  <p className="text-2xs text-content-subtle">At least 6 characters.</p>
                </div>

                <Button type="submit" className="w-full" loading={submitting}>
                  Create account
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

