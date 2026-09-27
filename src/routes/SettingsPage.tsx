import { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Building,
  Check,
  Edit2,
  IndianRupee,
  LogOut,
  Palette,
  Plus,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { PageHeader } from '@/components/shared/page-header';
import { CategoryIcon, CATEGORY_ICON_NAMES } from '@/components/shared/category-icon';
import { useHousehold } from '@/hooks/use-household';
import { useSession } from '@/hooks/use-session';
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useArchiveCategory,
  useDeleteCategory,
} from '@/hooks/use-categories';
import { useDeleteHousehold, useUpdateProfile, useUpdateHousehold } from '@/hooks/use-members';
import { useToast } from '@/hooks/use-toast';
import { errorMessage } from '@/lib/errors';
import type { Category } from '@/types/domain';

const COLOR_PRESETS = [
  '#9AE6B4', // mint / accent
  '#68D391', // green
  '#4FD1C5', // teal
  '#63B3ED', // blue
  '#7F9CF5', // indigo
  '#B794F4', // purple
  '#F6AD55', // orange
  '#FC8181', // coral
  '#F687B3', // pink
  '#CBD5E0', // slate
];

export function SettingsPage() {
  const { householdId, householdName, timezone, isOwner, refresh: refreshHousehold } = useHousehold();
  const { userId, email, profile, refreshProfile, signOut } = useSession();
  const { push: pushToast } = useToast();

  const categoriesQuery = useCategories(householdId);
  const categories = categoriesQuery.data ?? [];

  // Profile state
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const updateProfileMutation = useUpdateProfile();

  // Household state
  const [householdNameInput, setHouseholdNameInput] = useState(householdName ?? '');
  const [householdTimezone, setHouseholdTimezone] = useState(timezone ?? 'Asia/Kolkata');
  const updateHouseholdMutation = useUpdateHousehold();

  // Category modal state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('Tag');
  const [catColor, setCatColor] = useState(COLOR_PRESETS[0]);
  const [deleteTargetCategory, setDeleteTargetCategory] = useState<Category | null>(null);

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const archiveCategoryMutation = useArchiveCategory();
  const deleteCategoryMutation = useDeleteCategory();

  // Sign out confirmation
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);

  // Household teardown (owner only). Destructive enough to require the
  // household name to be typed back before the action unlocks.
  const [deleteHouseholdDialogOpen, setDeleteHouseholdDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const deleteHouseholdMutation = useDeleteHousehold();
  const canConfirmDeleteHousehold =
    Boolean(householdName) &&
    deleteConfirmName.trim().toLowerCase() === (householdName ?? '').trim().toLowerCase();
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !displayName.trim()) return;

    try {
      await updateProfileMutation.mutateAsync({
        userId,
        changes: { display_name: displayName.trim() },
      });
      await refreshProfile();
      pushToast({
        title: 'Profile updated',
        description: 'Your display name was saved successfully.',
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not update profile',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleUpdateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !householdNameInput.trim()) return;

    try {
      await updateHouseholdMutation.mutateAsync({
        householdId,
        changes: {
          name: householdNameInput.trim(),
          timezone: householdTimezone,
        },
      });
      await refreshHousehold();
      pushToast({
        title: 'Household updated',
        description: 'Household settings saved.',
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not update household',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  /**
   * Owner deletes the whole household. Memberships drive the active household,
   * so refreshing them sends the app to another household - or to onboarding
   * when this was the last one.
   */
  const handleDeleteHousehold = async () => {
    if (!householdId || !canConfirmDeleteHousehold) return;
    const deletedName = householdName ?? 'The household';

    try {
      await deleteHouseholdMutation.mutateAsync({ householdId });
      setDeleteHouseholdDialogOpen(false);
      setDeleteConfirmName('');
      pushToast({
        title: 'Household deleted',
        description: `${deletedName} and all of its data were removed.`,
        tone: 'success',
      });
      await refreshHousehold();
    } catch (err) {
      pushToast({
        title: 'Could not delete household',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleOpenCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCatName(category.name);
      setCatIcon(category.icon);
      setCatColor(category.color);
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatIcon('Tag');
      setCatColor(COLOR_PRESETS[0]);
    }
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!householdId || !userId || !catName.trim()) return;

    try {
      if (editingCategory) {
        await updateCategoryMutation.mutateAsync({
          householdId,
          categoryId: editingCategory.id,
          changes: {
            name: catName.trim(),
            icon: catIcon,
            color: catColor,
          },
        });
        pushToast({
          title: 'Category updated',
          tone: 'success',
        });
      } else {
        await createCategoryMutation.mutateAsync({
          householdId,
          name: catName.trim(),
          icon: catIcon,
          color: catColor,
          createdBy: userId,
        });
        pushToast({
          title: 'Category created',
          tone: 'success',
        });
      }
      setCategoryModalOpen(false);
    } catch (err) {
      pushToast({
        title: 'Could not save category',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleToggleArchive = async (category: Category) => {
    if (!householdId) return;
    try {
      await archiveCategoryMutation.mutateAsync({
        householdId,
        categoryId: category.id,
        archived: category.is_active,
      });
      pushToast({
        title: category.is_active ? 'Category archived' : 'Category restored',
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Could not update category',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  const handleDeleteCategory = async () => {
    if (!householdId || !deleteTargetCategory) return;
    try {
      await deleteCategoryMutation.mutateAsync({
        householdId,
        categoryId: deleteTargetCategory.id,
      });
      pushToast({
        title: 'Category deleted',
        tone: 'success',
      });
      setDeleteTargetCategory(null);
    } catch (err) {
      pushToast({
        title: 'Could not delete category',
        description: errorMessage(err),
        tone: 'error',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Manage personal preferences, household details and category labels"
      />

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="size-4 text-accent" />
            <CardTitle>Your profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your full or preferred name"
                  required
                />
                <p className="text-2xs text-content-subtle">
                  Shown next to expenses and in family activity feeds.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-readonly">Email address</Label>
                <Input id="email-readonly" value={email ?? ''} disabled className="opacity-70" />
                <p className="text-2xs text-content-subtle">
                  Managed by authentication. Contact support to change.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" loading={updateProfileMutation.isPending}>
                Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Household Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="size-4 text-accent" />
              <CardTitle>Household settings</CardTitle>
            </div>
            <Badge tone={isOwner ? 'accent' : 'neutral'}>
              {isOwner ? 'Owner' : 'Read-only member'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateHousehold} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="household-name">Household name</Label>
                <Input
                  id="household-name"
                  value={householdNameInput}
                  onChange={(e) => setHouseholdNameInput(e.target.value)}
                  disabled={!isOwner}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="household-timezone">Timezone</Label>
                <select
                  id="household-timezone"
                  value={householdTimezone}
                  onChange={(e) => setHouseholdTimezone(e.target.value)}
                  disabled={!isOwner}
                  className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-content disabled:opacity-60"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Ledger currency</Label>
                <div className="flex h-10 items-center gap-1.5 rounded-md border border-line bg-surface/50 px-3 text-sm text-content-muted">
                  <IndianRupee className="size-4 text-accent" />
                  <span>Indian Rupee (INR · ₹)</span>
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={updateHouseholdMutation.isPending}>
                  Save household
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Danger zone - household teardown, owner only */}
      {isOwner && householdId && (
        <Card className="border-danger/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="size-4 text-danger" />
              <CardTitle>Danger zone</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-content">Delete this household</p>
              <p className="text-2xs text-content-subtle">
                Permanently removes {householdName}, its memberships, expenses, budgets and custom
                categories. Everyone loses access to the shared ledger. This cannot be undone.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 text-danger hover:bg-danger/10"
              onClick={() => {
                setDeleteConfirmName('');
                setDeleteHouseholdDialogOpen(true);
              }}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Categories Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-accent" />
              <div>
                <CardTitle>Expense categories</CardTitle>
                <p className="text-xs text-content-muted">
                  System categories and custom labels configured for this household
                </p>
              </div>
            </div>
            {isOwner && (
              <Button size="sm" onClick={() => handleOpenCategoryModal()}>
                <Plus /> Add category
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border border-line bg-surface/50 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <CategoryIcon name={cat.icon} color={cat.color} size="md" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-content">{cat.name}</p>
                      {!cat.is_active && <Badge tone="warn">Archived</Badge>}
                    </div>
                    <p className="text-2xs text-content-subtle">
                      {cat.is_system ? 'System preset' : 'Custom household'}
                    </p>
                  </div>
                </div>

                {isOwner && !cat.is_system && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCategoryModal(cat)}
                      title="Edit category"
                    >
                      <Edit2 className="size-3.5 text-content-muted" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleArchive(cat)}
                      title={cat.is_active ? 'Archive category' : 'Restore category'}
                    >
                      {cat.is_active ? (
                        <Archive className="size-3.5 text-content-muted" />
                      ) : (
                        <ArchiveRestore className="size-3.5 text-accent" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTargetCategory(cat)}
                      title="Delete category"
                    >
                      <Trash2 className="size-3.5 text-danger" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Account Security & Sign Out */}
      <Card className="border-danger/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-danger" />
            <CardTitle>Session & Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-content">Sign out of FamilyLedger</p>
            <p className="text-2xs text-content-subtle">
              Clears local session tokens. You can sign back in at any time.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="text-danger hover:bg-danger/10"
            onClick={() => setSignOutDialogOpen(true)}
          >
            <LogOut className="size-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      {/* Category Create/Edit Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit category' : 'New expense category'}
            </DialogTitle>
            <DialogDescription>
              Custom categories are available to all household members when logging expenses.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCategory} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Category name</Label>
              <Input
                id="cat-name"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Subscriptions, Hobbies"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Color accent</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Use colour ${color}`}
                    aria-pressed={catColor === color}
                    className="flex size-10 items-center justify-center rounded-full border border-line transition-transform hover:scale-110 active:scale-95"
                    style={{ backgroundColor: color }}
                    onClick={() => setCatColor(color)}
                  >
                    {catColor === color && <Check className="size-4 text-black" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto overscroll-contain rounded-md border border-line p-2 sm:grid-cols-6">
                {CATEGORY_ICON_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={catIcon === name}
                    className={`flex min-touch flex-col items-center justify-center rounded p-2 transition-colors ${
                      catIcon === name
                        ? 'border border-accent bg-accent-soft'
                        : 'hover:bg-surface-hover active:bg-surface-hover'
                    }`}
                    onClick={() => setCatIcon(name)}
                  >
                    <CategoryIcon name={name} color={catColor} size="sm" />
                    <span className="mt-1 w-full truncate text-center text-[10px] text-content-subtle">
                      {name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCategoryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              >
                {editingCategory ? 'Save changes' : 'Create category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog
        open={Boolean(deleteTargetCategory)}
        onOpenChange={(open) => !open && setDeleteTargetCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTargetCategory?.name}? If any expenses or
              budgets reference this category, the deletion will be rejected by the database.
              Consider archiving it instead to preserve historical records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Household Confirmation - the name must be typed back */}
      <AlertDialog
        open={deleteHouseholdDialogOpen}
        onOpenChange={(open) => {
          setDeleteHouseholdDialogOpen(open);
          if (!open) setDeleteConfirmName('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {householdName} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the household, every membership, all expenses, budgets and custom
              categories. Other members keep their own accounts but lose access to this shared
              ledger, and the data cannot be recovered. Type the household name to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-household-confirm">Household name</Label>
            <Input
              id="delete-household-confirm"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={householdName ?? ''}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHousehold}
              disabled={!canConfirmDeleteHousehold}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Delete household
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sign Out Confirmation */}
      <AlertDialog open={signOutDialogOpen} onOpenChange={setSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of FamilyLedger?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be returned to the sign-in screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void signOut()}
              className="bg-danger text-white hover:bg-danger/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

