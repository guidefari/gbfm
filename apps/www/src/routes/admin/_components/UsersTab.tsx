import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { authClient } from '@/lib/auth-client'

const ROLES = ['admin', 'editor', 'creator', 'user'] as const
type UserRole = (typeof ROLES)[number]

interface AdminUser {
  id: string
  name: string
  email: string
  role: string | null
  banned: boolean | null
  banReason: string | null
  createdAt: Date
}

interface BanDialogState {
  open: boolean
  userId: string
  userName: string
}

interface DeleteDialogState {
  open: boolean
  userId: string
  userName: string
}

export function UsersTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [banDialog, setBanDialog] = useState<BanDialogState>({
    open: false,
    userId: '',
    userName: ''
  })
  const [banReason, setBanReason] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
    open: false,
    userId: '',
    userName: ''
  })

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: async () => {
      const result = await authClient.admin.listUsers({
        query: {
          limit: 50,
          ...(search && { searchValue: search, searchField: 'email' })
        }
      })
      return result
    }
  })

  const setRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role
    }: {
      userId: string
      role: UserRole
    }) => {
      return authClient.admin.setRole({
        userId,
        role: role as 'admin' | 'user'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast({ title: 'Role updated successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update role',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const banMutation = useMutation({
    mutationFn: async ({
      userId,
      banReason
    }: {
      userId: string
      banReason?: string
    }) => {
      return authClient.admin.banUser({ userId, banReason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setBanDialog({ open: false, userId: '', userName: '' })
      setBanReason('')
      toast({ title: 'User banned successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to ban user',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      return authClient.admin.unbanUser({ userId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast({ title: 'User unbanned successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to unban user',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return authClient.admin.removeUser({ userId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setDeleteDialog({ open: false, userId: '', userName: '' })
      toast({ title: 'User deleted successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to delete user',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const users = (data?.data?.users ?? []) as AdminUser[]

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-4'>
        <Input
          placeholder='Search by email...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='max-w-sm'
        />
      </div>

      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading users...
        </div>
      ) : (
        <div className='overflow-x-auto rounded-sm border'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 text-left font-medium'>Name</th>
                <th className='px-4 py-3 text-left font-medium'>Email</th>
                <th className='px-4 py-3 text-left font-medium'>Role</th>
                <th className='px-4 py-3 text-left font-medium'>Status</th>
                <th className='px-4 py-3 text-left font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className='border-b hover:bg-muted/50'>
                  <td className='px-4 py-3'>{user.name}</td>
                  <td className='px-4 py-3 text-muted-foreground'>
                    {user.email}
                  </td>
                  <td className='px-4 py-3'>
                    <Select
                      value={user.role ?? 'user'}
                      onValueChange={(role: UserRole) =>
                        setRoleMutation.mutate({ userId: user.id, role })
                      }>
                      <SelectTrigger className='w-28'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='admin'>Admin</SelectItem>
                        <SelectItem value='editor'>Editor</SelectItem>
                        <SelectItem value='creator'>Creator</SelectItem>
                        <SelectItem value='user'>User</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className='px-4 py-3'>
                    {user.banned ? (
                      <Badge variant='destructive'>Banned</Badge>
                    ) : (
                      <Badge variant='outline'>Active</Badge>
                    )}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-2'>
                      {user.banned ? (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => unbanMutation.mutate(user.id)}
                          disabled={unbanMutation.isPending}>
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            setBanDialog({
                              open: true,
                              userId: user.id,
                              userName: user.name
                            })
                          }>
                          Ban
                        </Button>
                      )}
                      <Button
                        variant='destructive'
                        size='sm'
                        onClick={() =>
                          setDeleteDialog({
                            open: true,
                            userId: user.id,
                            userName: user.name
                          })
                        }>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className='px-4 py-8 text-center text-muted-foreground'>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={banDialog.open}
        onOpenChange={(open) => setBanDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              Are you sure you want to ban {banDialog.userName}? This will
              revoke all their sessions.
            </DialogDescription>
          </DialogHeader>
          <div className='py-4'>
            <Input
              placeholder='Reason for ban (optional)'
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() =>
                setBanDialog({ open: false, userId: '', userName: '' })
              }>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() =>
                banMutation.mutate({
                  userId: banDialog.userId,
                  banReason: banReason || undefined
                })
              }
              disabled={banMutation.isPending}>
              {banMutation.isPending ? 'Banning...' : 'Ban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{' '}
              {deleteDialog.userName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() =>
                setDeleteDialog({ open: false, userId: '', userName: '' })
              }>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => deleteMutation.mutate(deleteDialog.userId)}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
