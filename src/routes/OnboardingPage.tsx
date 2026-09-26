import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Building, CheckCircle2, IndianRupee, LogOut, Plus, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/hooks/use-session';
import { useHousehold } from '@/hooks/use-household';
import { useCreateHousehold } from '@/hooks/use-members';
import { useInvitationPreview, useAcceptInvitation } from '@/hooks/use-invitations';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/errors';

export function OnboardingPage() {
  const { userId, displayName, signOut } = useSession();
  const { hasHousehold, setActiveHouseholdId, refresh } = useHousehold();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { push: pushToast } = useToast();

  const tokenParam = searchParams.get('token') ?? searchParams.get('invite') ?? '';
  const [inviteToken, setInviteToken] = useState(tokenParam);
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(tokenParam ? 'join' : 'create');

  // Create household form state
  const [householdName, setHouseholdName] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  const createHouseholdMutation = useCreateHousehold();
  const previewQuery = useInvitationPreview(inviteToken || null);
  const acceptMutation = useAcceptInvitation();

  useEffect(() => {
    if (tokenParam) {
      setInviteToken(tokenParam);
      setActiveTab('join');
    }
  }, [tokenParam]);

  if (hasHousehold) {
    return <Navigate to="/app" replace />;
  }
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !householdName.trim()) return;

    try {
      const created = await createHouseholdMutation.mutateAsync({
        name: householdName.trim(),
        ownerId: userId,
        timezone,
      });
      setActiveHouseholdId(created.household.id);
      await refresh();
      pushToast({
        title: 'Household created!',
        description: `Welcome to ${created.household.name}.`,
        tone: 'success',
      });
      navigate('/app', { replace: true });
    } catch (err) {
      pushToast({
        title: 'Could not create household',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken) return;
    try {
      await acceptMutation.mutateAsync(inviteToken);
      await refresh();
      pushToast({
        title: 'Welcome to the family!',
        description: 'You joined the household successfully.',
        tone: 'success',
      });
      navigate('/app', { replace: true });
    } catch (err) {
      pushToast({
        title: 'Could not join household',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <IndianRupee className="size-5" />
            </div>
            <span className="font-semibold text-content">FamilyLedger</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
            className="text-xs text-content-muted hover:text-content"
          >
            <LogOut className="size-3.5" /> Sign out
          </Button>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-content">
            Welcome, {displayName}!
          </h1>
          <p className="text-sm text-content-muted">
            To start tracking shared expenses, create your household or join one using an invitation.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'create' | 'join')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">
              <Plus className="size-3.5" /> Create household
            </TabsTrigger>
            <TabsTrigger value="join">
              <Users className="size-3.5" /> Join with invite
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Create a new household</CardTitle>
                <CardDescription>
                  You will be the owner of this ledger and can invite other family members.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-household-name">Household name</Label>
                    <Input
                      id="create-household-name"
                      placeholder="e.g. Verma Family, Our Apartment"
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="create-household-tz">Timezone</Label>
                    <select
                      id="create-household-tz"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-content focus:border-accent focus:outline-none"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    </select>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    loading={createHouseholdMutation.isPending}
                  >
                    Create household & start tracking
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="join" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Join a household</CardTitle>
                <CardDescription>
                  Enter the invitation code or token provided by your household owner.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-token-input">Invitation code or token</Label>
                  <Input
                    id="invite-token-input"
                    placeholder="Paste the invitation token"
                    value={inviteToken}
                    onChange={(e) => setInviteToken(e.target.value.trim())}
                  />
                </div>

                {inviteToken && (
                  <div className="rounded-lg border border-line bg-surface/50 p-4">
                    {previewQuery.isLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    ) : previewQuery.isError ? (
                      <p className="text-xs text-danger">
                        {errorMessage(previewQuery.error)}
                      </p>
                    ) : previewQuery.data ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                            <Building className="size-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-content">
                              {previewQuery.data.householdName ?? 'Household'}
                            </p>
                            <p className="text-2xs text-content-muted">
                              Status: {previewQuery.data.status}
                            </p>
                          </div>
                        </div>

                        {previewQuery.data.status === 'pending' ? (
                          <Button
                            className="w-full"
                            onClick={handleAcceptInvite}
                            loading={acceptMutation.isPending}
                          >
                            <CheckCircle2 className="size-4" /> Accept & Join Ledger
                          </Button>
                        ) : (
                          <p className="text-xs text-warn">
                            This invitation is {previewQuery.data.status} and can no longer be used.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

