import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import {
  createHousehold,
  transferOwnership,
  updateHousehold,
  updateProfile,
} from '@/services/households.service';
import { leaveHousehold, joinHouseholdByCode, removeHouseholdMember } from '@/services/members.service';

/** Profile, household and membership mutations. */

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      changes: { display_name?: string; avatar_url?: string | null };
    }) => updateProfile(input.userId, input.changes),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile(variables.userId) });
      // Display names are embedded in expense and member lists.
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['household-members'] });
    },
  });
}

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; ownerId: string; timezone?: string }) =>
      createHousehold(input),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memberships(variables.ownerId) });
    },
  });
}

export function useUpdateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; changes: { name?: string; timezone?: string } }) =>
      updateHousehold(input.householdId, input.changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memberships'] });
    },
  });
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; newOwnerId: string }) =>
      transferOwnership(input.householdId, input.newOwnerId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['memberships'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.householdMembers(variables.householdId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; memberUserId: string }) =>
      removeHouseholdMember(input.householdId, input.memberUserId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.householdMembers(variables.householdId) });
    },
  });
}

export function useLeaveHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { householdId: string; memberUserId: string }) =>
      leaveHousehold(input.householdId, input.memberUserId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memberships'] });
      void queryClient.invalidateQueries({ queryKey: ['household-members'] });
    },
  });
}

/** Join a household via its 6-character join code. */
export function useJoinHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => joinHouseholdByCode(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memberships'] });
      void queryClient.invalidateQueries({ queryKey: ['household-members'] });
    },
  });
}
