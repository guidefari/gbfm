import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Edit, ExternalLink, Mail, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { toast } from '@/components/ui/use-toast'
import { authClient } from '@/lib/auth-client'
import { VPS_BASE_URL, fetcher } from '@/lib/http'
import { ImageUploadField } from './ImageUploadField'

const ROLES = ['admin', 'editor', 'creator', 'user'] as const
type UserRole = (typeof ROLES)[number]

interface AdminUser {
  id: string
  name: string
  username?: string | null
  email: string
  emailVerified?: boolean
  image?: string | null
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
  const [createUserDialog, setCreateUserDialog] = useState(false)
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'user' as UserRole
  })
  const [debouncedUsername, setDebouncedUsername] = useState('')
  const [editUserDialog, setEditUserDialog] = useState(false)
  const [editUser, setEditUser] = useState<{
    id: string
    name: string
    email: string
    username: string
    image: string
    emailVerified: boolean
  }>({
    id: '',
    name: '',
    email: '',
    username: '',
    image: '',
    emailVerified: false
  })
  const [debouncedEditUsername, setDebouncedEditUsername] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUsername(newUser.username)
    }, 300)
    return () => clearTimeout(timer)
  }, [newUser.username])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedEditUsername(editUser.username)
    }, 300)
    return () => clearTimeout(timer)
  }, [editUser.username])

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

  const { data: usernameAvailability, isPending: checkingUsername } = useQuery({
    queryKey: ['username', 'availability', debouncedUsername],
    queryFn: async () => {
      const result = await authClient.isUsernameAvailable({
        username: debouncedUsername
      })
      return result.data
    },
    enabled: debouncedUsername.length >= 2
  })

  const { data: editUsernameAvailability, isPending: checkingEditUsername } =
    useQuery({
      queryKey: ['username', 'availability', debouncedEditUsername],
      queryFn: async () => {
        const result = await authClient.isUsernameAvailable({
          username: debouncedEditUsername
        })
        return result.data
      },
      enabled:
        debouncedEditUsername.length >= 2 &&
        debouncedEditUsername !== originalUsername
    })

  const sendInviteMutation = useMutation({
    mutationFn: async (userId: string) =>
      fetcher<{ success: boolean; emailId: string }>(
        `${VPS_BASE_URL}/invite/send`,
        {
          method: 'POST',
          body: JSON.stringify({ userId })
        }
      ),
    onSuccess: () => {
      toast({ title: 'Invite email sent' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to send invite',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const createUserMutation = useMutation({
    mutationFn: async () => {
      const email =
        newUser.email ||
        `${newUser.username || crypto.randomUUID()}@placeholder.local`
      const password = newUser.password || crypto.randomUUID()
      const name = newUser.name || newUser.username || 'User'

      return authClient.admin.createUser({
        email,
        password,
        name,
        role: newUser.role,
        data: newUser.username ? { username: newUser.username } : undefined
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setCreateUserDialog(false)
      setNewUser({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'user'
      })
      setDebouncedUsername('')
      toast({ title: 'User created successfully' })

      const createdUserId = result?.data?.user?.id
      if (createdUserId && newUser.email) {
        sendInviteMutation.mutate(createdUserId)
      }
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to create user',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      return authClient.admin.updateUser({
        userId: editUser.id,
        data: {
          name: editUser.name,
          email: editUser.email,
          username: editUser.username || undefined,
          image: editUser.image || undefined,
          emailVerified: editUser.emailVerified
        }
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setEditUserDialog(false)
      toast({ title: 'User updated successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to update user',
        description: err.message,
        variant: 'destructive'
      })
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
        <Button onClick={() => setCreateUserDialog(true)}>
          <Plus className='w-4 h-4 mr-2' />
          Create User
        </Button>
      </div>

      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>
          Loading users...
        </div>
      ) : (
        <div className='overflow-x-auto border rounded-sm'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b bg-muted/50'>
                <th className='px-4 py-3 font-medium text-left'>Name</th>
                <th className='px-4 py-3 font-medium text-left'>Email</th>
                <th className='px-4 py-3 font-medium text-left'>Role</th>
                <th className='px-4 py-3 font-medium text-left'>Status</th>
                <th className='px-4 py-3 font-medium text-left'>Actions</th>
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
                      {user.username && (
                        <Button variant='outline' size='sm' asChild>
                          <a
                            href={`/${user.username}`}
                            target='_blank'
                            rel='noopener noreferrer'>
                            <ExternalLink className='w-4 h-4' />
                            <span className='sr-only'>View Profile</span>
                          </a>
                        </Button>
                      )}
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => sendInviteMutation.mutate(user.id)}
                        disabled={sendInviteMutation.isPending}
                        title='Send invite email'>
                        <Mail className='w-4 h-4' />
                        <span className='sr-only'>Send Invite</span>
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => {
                          setEditUser({
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            username: user.username || '',
                            image: user.image || '',
                            emailVerified: user.emailVerified ?? false
                          })
                          setOriginalUsername(user.username || '')
                          setEditUserDialog(true)
                        }}>
                        <Edit className='w-4 h-4' />
                        <span className='sr-only'>Edit</span>
                      </Button>
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

      <Dialog open={createUserDialog} onOpenChange={setCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Manually add a new user to the system.
            </DialogDescription>
          </DialogHeader>
          <div className='py-4 space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Display Name</Label>
              <Input
                id='name'
                value={newUser.name}
                onChange={(e) =>
                  setNewUser({ ...newUser, name: e.target.value })
                }
                placeholder='John Doe'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='username'>Username (optional)</Label>
              <div className='relative'>
                <Input
                  id='username'
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({
                      ...newUser,
                      username: e.target.value.toLowerCase().replace(/\s/g, '')
                    })
                  }
                  placeholder='johndoe'
                  className='pr-8'
                />
                {newUser.username.length >= 2 && (
                  <div className='absolute -translate-y-1/2 right-2 top-1/2'>
                    {checkingUsername ? (
                      <div className='w-4 h-4 border-2 rounded-full animate-spin border-muted-foreground border-t-transparent' />
                    ) : usernameAvailability?.available ? (
                      <Check className='w-4 h-4 text-green-500' />
                    ) : (
                      <X className='w-4 h-4 text-destructive' />
                    )}
                  </div>
                )}
              </div>
              {newUser.username.length >= 2 &&
                !checkingUsername &&
                !usernameAvailability?.available && (
                  <p className='text-xs text-destructive'>
                    Username is already taken
                  </p>
                )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={newUser.email}
                onChange={(e) =>
                  setNewUser({ ...newUser, email: e.target.value })
                }
                placeholder='john@example.com'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                placeholder='••••••••'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='role'>Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(role: UserRole) =>
                  setNewUser({ ...newUser, role })
                }>
                <SelectTrigger id='role'>
                  <SelectValue placeholder='Select role' />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setCreateUserDialog(false)}
              disabled={createUserMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => createUserMutation.mutate()}
              disabled={
                createUserMutation.isPending ||
                (!newUser.email && !newUser.username) ||
                (newUser.username.length >= 2 &&
                  !usernameAvailability?.available)
              }>
              {createUserMutation.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editUserDialog} onOpenChange={setEditUserDialog}>
        <DialogContent className='max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details.</DialogDescription>
          </DialogHeader>
          <div className='py-4 space-y-4'>
            <ImageUploadField
              label='Profile Image'
              value={editUser.image}
              onChange={(url) => setEditUser({ ...editUser, image: url })}
            />
            <div className='space-y-2'>
              <Label htmlFor='edit-name'>Name</Label>
              <Input
                id='edit-name'
                value={editUser.name}
                onChange={(e) =>
                  setEditUser({ ...editUser, name: e.target.value })
                }
                placeholder='John Doe'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-username'>Username</Label>
              <div className='relative'>
                <Input
                  id='edit-username'
                  value={editUser.username}
                  onChange={(e) =>
                    setEditUser({
                      ...editUser,
                      username: e.target.value.toLowerCase().replace(/\s/g, '')
                    })
                  }
                  placeholder='johndoe'
                  className='pr-8'
                />
                {editUser.username.length >= 2 &&
                  editUser.username !== originalUsername && (
                    <div className='absolute -translate-y-1/2 right-2 top-1/2'>
                      {checkingEditUsername ? (
                        <div className='w-4 h-4 border-2 rounded-full animate-spin border-muted-foreground border-t-transparent' />
                      ) : editUsernameAvailability?.available ? (
                        <Check className='w-4 h-4 text-green-500' />
                      ) : (
                        <X className='w-4 h-4 text-destructive' />
                      )}
                    </div>
                  )}
              </div>
              {editUser.username.length >= 2 &&
                editUser.username !== originalUsername &&
                !checkingEditUsername &&
                !editUsernameAvailability?.available && (
                  <p className='text-xs text-destructive'>
                    Username is already taken
                  </p>
                )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-email'>Email</Label>
              <Input
                id='edit-email'
                type='email'
                value={editUser.email}
                onChange={(e) =>
                  setEditUser({ ...editUser, email: e.target.value })
                }
                placeholder='john@example.com'
              />
            </div>
            <div className='flex items-center space-x-2'>
              <Checkbox
                id='edit-email-verified'
                checked={editUser.emailVerified}
                onCheckedChange={(checked) =>
                  setEditUser({ ...editUser, emailVerified: checked === true })
                }
              />
              <Label htmlFor='edit-email-verified' className='cursor-pointer'>
                Email Verified
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setEditUserDialog(false)}
              disabled={updateUserMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => updateUserMutation.mutate()}
              disabled={
                updateUserMutation.isPending ||
                !editUser.name ||
                !editUser.email ||
                (editUser.username.length >= 2 &&
                  editUser.username !== originalUsername &&
                  !editUsernameAvailability?.available)
              }>
              {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
