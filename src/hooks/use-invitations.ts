import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  previewInvitation,
  revokeInvitation,
} from '@/services/invitations.service';

/**
 * Invitation hooks.
 *
 * Everything is executed by the Edge Function; these hooks only keep React Query
 * in sync. `token` values are never cached outside the preview query key.
 */
export function useInvitations(householdId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.invitations(householdId ?? 'none'),
    queryFn: () => listInvitations(householdId as string),
    enabled: Boolean(householdId) && enabled,
    staleTime: 15_000,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; email: string; expiresInDays?: number }) =>
      createInvitation(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations(variables.householdId) });
    },
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; invitationId: string }) =>
      revokeInvitation(input.invitationId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations(variables.householdId) });
    },
  });
}

export function useInvitationPreview(token: string | null) {
  return useQuery({
    queryKey: queryKeys.invitationPreview(token ?? 'none'),
    queryFn: () => previewInvitation(token as string),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: () => {
      // Membership changed: reload memberships (and therefore the household scope).
      void queryClient.invalidateQueries({ queryKey: ['memberships'] });
      void queryClient.invalidateQueries({ queryKey: ['household-members'] });
    },
  });
}
