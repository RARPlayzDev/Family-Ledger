import { useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  LogOut,
  MoreVertical,
  Plus,
  Shield,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { useHousehold } from '@/hooks/use-household';
import { useSession } from '@/hooks/use-session';
import { useRemoveMember, useLeaveHousehold, useTransferOwnership } from '@/hooks/use-members';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/errors';
import { buildJoinLink } from '@/lib/join-code';
import { appOrigin } from '@/lib/env';
import type { HouseholdMember } from '@/types/domain';

export function MembersPage() {
  const {
    householdId,
    householdName,
    isOwner,
    members,
    membersLoading,
    refresh,
    activeMembership,
  } = useHousehold();
  const { userId } = useSession();
  const { push: pushToast } = useToast();

  const removeMemberMutation = useRemoveMember();
  const leaveHouseholdMutation = useLeaveHousehold();
  const transferOwnershipMutation = useTransferOwnership();

  const joinCode = activeMembership?.household.join_code ?? '';
  const joinLink = joinCode ? buildJoinLink(appOrigin(), joinCode) : '';

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [memberToRemove, setMemberToRemove] = useState<HouseholdMember | null>(null);
  const [memberToTransfer, setMemberToTransfer] = useState<HouseholdMember | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const handleCopyLink = async () => {
    if (!joinLink) return;
    try {
      await navigator.clipboard.writeText(joinLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      pushToast({
        title: 'Invite link copied',
        description: 'Share it with your family member - no email needed.',
        tone: 'success',
      });
    } catch {
      pushToast({
        title: 'Failed to copy',
        description: 'Please copy the link manually.',
        tone: 'error',
      });
    }
  };

  const handleCopyCode = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      pushToast({
        title: 'Join code copied',
        description: `Code ${joinCode} copied to your clipboard.`,
        tone: 'success',
      });
    } catch {
      pushToast({
        title: 'Failed to copy',
        description: 'Please copy the code manually.',
        tone: 'error',
      });
    }
  };

  const handleRemoveMember = async () => {
    if (!householdId || !memberToRemove) return;
    try {
      await removeMemberMutation.mutateAsync({
        householdId,
        memberUserId: memberToRemove.user_id,
      });
      pushToast({
        title: 'Member removed',
        description: `${memberToRemove.profile?.display_name ?? 'The member'} was removed from the household.`,
        tone: 'success',
      });
      setMemberToRemove(null);
      void refresh();
    } catch (err) {
      pushToast({
        title: 'Could not remove member',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleTransferOwnership = async () => {
    if (!householdId || !memberToTransfer) return;
    try {
      await transferOwnershipMutation.mutateAsync({
        householdId,
        newOwnerId: memberToTransfer.user_id,
      });
      pushToast({
        title: 'Ownership transferred',
        description: `${memberToTransfer.profile?.display_name ?? 'The member'} is now the household owner.`,
        tone: 'success',
      });
      setMemberToTransfer(null);
      void refresh();
    } catch (err) {
      pushToast({
        title: 'Could not transfer ownership',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleLeaveHousehold = async () => {
    if (!householdId || !userId) return;
    try {
      await leaveHouseholdMutation.mutateAsync({
        householdId,
        memberUserId: userId,
      });
      pushToast({
        title: 'Left household',
        description: 'You have left the household.',
        tone: 'success',
      });
      setLeaveDialogOpen(false);
      void refresh();
    } catch (err) {
      pushToast({
        title: 'Could not leave household',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Family & Members"
        subtitle={`Members with access to the ${householdName ?? 'household'} shared ledger`}
        actions={
          isOwner && (
            <Button
              size="sm"
              onClick={() => setInviteModalOpen(true)}
            >
              <Plus />
              <span className="hidden sm:inline">Invite family member</span>
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="label-caps">Household</p>
          <p className="mt-1 text-lg font-semibold text-content">{householdName}</p>
          <p className="mt-0.5 text-2xs text-content-muted">Shared ledger</p>
        </Card>
        <Card className="p-4">
          <p className="label-caps">Total members</p>
          <p className="mt-1 text-lg font-semibold text-content">{members.length}</p>
          <p className="mt-0.5 text-2xs text-content-muted">
            {members.length === 1 ? '1 person recorded' : `${members.length} people sharing expenses`}
          </p>
        </Card>
        <Card className="p-4">
          <p className="label-caps">Your role</p>
          <div className="mt-1 flex items-center gap-1.5">
            {isOwner ? (
              <Badge tone="accent">
                <Crown className="size-3" /> Owner
              </Badge>
            ) : (
              <Badge tone="neutral">
                <Shield className="size-3" /> Member
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-2xs text-content-muted">
            {isOwner ? 'Full administrative rights' : 'Contributor to shared ledger'}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Household members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {members.map((m) => {
                const isCurrentMemberSelf = m.user_id === userId;
                return (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-surface-hover/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={m.profile?.display_name ?? 'Member'}
                        src={m.profile?.avatar_url ?? null}
                        size="md"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-content">
                            {m.profile?.display_name ?? 'Member'}
                          </p>
                          {isCurrentMemberSelf && (
                            <span className="text-2xs font-medium text-accent">(You)</span>
                          )}
                        </div>
                        <p className="text-2xs text-content-subtle">
                          Joined {new Date(m.joined_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge tone={m.role === 'owner' ? 'accent' : 'neutral'}>
                        {m.role === 'owner' ? 'Owner' : 'Member'}
                      </Badge>

                      {isOwner && !isCurrentMemberSelf && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setMemberToTransfer(m)}>
                              <UserCheck className="size-4 text-accent" />
                              Transfer ownership
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-danger"
                              onClick={() => setMemberToRemove(m)}
                            >
                              <UserX className="size-4 text-danger" />
                              Remove from household
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {!isOwner && isCurrentMemberSelf && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger"
                          onClick={() => setLeaveDialogOpen(true)}
                        >
                          <LogOut className="size-4" />
                          <span className="hidden sm:inline">Leave</span>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

          {isOwner && joinCode && (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Invite family members</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-content-muted">
                  Share this join code or invite link - anyone who opens the link can join{" "}
                  {householdName}. Send it on WhatsApp or SMS; no email required.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-lg border border-line bg-surface-active px-4 py-2 font-mono text-lg font-semibold tracking-[0.3em] text-content">
                    {joinCode}
                  </span>
                  <Button size="sm" onClick={handleCopyCode}>
                    <Copy className="size-4" />
                    <span className="hidden sm:inline">Copy code</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCopyLink}>
                    <Copy className="size-4" />
                    <span className="hidden sm:inline">Copy link</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Share join code / invite link Dialog */}
          <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite family member</DialogTitle>
                <DialogDescription>
                  Share this join code or invite link to grant access to the shared household ledger.
                  Anyone holding the link can join.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex justify-center">
                  <span className="rounded-lg border border-line bg-surface-active px-6 py-3 font-mono text-2xl font-semibold tracking-[0.35em] text-content">
                    {joinCode}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input readOnly value={joinLink} className="font-mono text-2xs selection:bg-accent-soft" />
                  <Button type="button" variant="secondary" size="sm" onClick={handleCopyLink}>
                    {copiedLink ? <Check className="size-4 text-accent" /> : <Copy className="size-4" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <p className="text-2xs text-content-subtle">
                  No email needed - send it on WhatsApp, SMS or show the code in person. It works for
                  anyone who hasn't joined yet.
                </p>
              <DialogFooter>
                <Button type="button" onClick={() => setInviteModalOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
            </DialogContent>
          </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove family member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{' '}
              {memberToRemove?.profile?.display_name ?? 'this member'} from {householdName}? They
              will no longer have access to this shared ledger. Past expenses attributed to them
              will remain in the transaction history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Ownership Confirmation */}
      <AlertDialog
        open={Boolean(memberToTransfer)}
        onOpenChange={(open) => !open && setMemberToTransfer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer household ownership?</AlertDialogTitle>
            <AlertDialogDescription>
              Transfer ownership of {householdName} to{' '}
              {memberToTransfer?.profile?.display_name ?? 'this member'}? You will become a regular
              member with expense recording access, but will no longer manage budget limits or
              member removals.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              className="bg-accent text-white hover:bg-accent/90"
            >
              Transfer ownership
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Household Confirmation */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave household?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave {householdName}? You will lose access to the shared
              ledger until invited back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveHousehold}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Leave household
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}