import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TablePagination,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast
} from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, GripVertical, MoreHorizontal, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'
import {
  fetcher,
  type SocialLink,
  type SocialLinkPlatform,
  useAdminUserBio,
  useAdminUserSocialLinks,
  useReplaceAdminUserSocialLinks,
  apiUrl
} from '@/lib/http'
import { ImageUploadField } from './-ImageUploadField'

const ROLES = ['admin', 'editor', 'creator', 'user'] as const
type UserRole = (typeof ROLES)[number]

const PAGE_SIZE = 25

interface AdminUser {
  id: string
  name: string
  username?: string | null
  email: string
  emailVerified?: boolean
  image?: string | null
  role?: string | null
  banned: boolean | null
  banReason?: string | null
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

type NewUserState = {
  name: string
  username: string
  email: string
  password: string
  role: UserRole
}

function isEditDialogTab(value: string): value is 'details' | 'social-links' {
  return value === 'details' || value === 'social-links'
}

const SOCIAL_LINK_PLATFORM_OPTIONS: SocialLinkPlatform[] = [
  'bandcamp',
  'substack',
  'soundcloud',
  'instagram',
  'twitter',
  'tiktok'
]

const SOCIAL_LINK_PLATFORM_LABELS: Record<SocialLinkPlatform, string> = {
  bandcamp: 'Bandcamp',
  substack: 'Substack',
  soundcloud: 'SoundCloud',
  instagram: 'IG',
  twitter: 'Twitter',
  tiktok: 'TikTok'
}

function SortableSocialLinkRow({
  link,
  onChange,
  onRemove
}: {
  link: SocialLink
  onChange: (next: SocialLink) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `${link.platform}-${link.position}-${link.url}`
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='grid grid-cols-[auto_180px_1fr_auto] items-start gap-2 rounded-sm border p-3'>
      <button
        type='button'
        className='mt-2 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing'
        aria-label='Reorder social link'
        {...attributes}
        {...listeners}>
        <GripVertical className='h-4 w-4' />
      </button>

      <Select
        value={link.platform}
        onValueChange={(value: SocialLinkPlatform) => onChange({ ...link, platform: value })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOCIAL_LINK_PLATFORM_OPTIONS.map((platform) => (
            <SelectItem key={platform} value={platform}>
              {SOCIAL_LINK_PLATFORM_LABELS[platform]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={link.url}
        onChange={(e) => onChange({ ...link, url: e.target.value })}
        placeholder='https://...'
      />

      <Button type='button' variant='ghost' size='sm' onClick={onRemove}>
        <X className='h-4 w-4' />
      </Button>
    </div>
  )
}

export function UsersTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
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
  const [newUser, setNewUser] = useState<NewUserState>({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'user'
  })
  const [debouncedUsername, setDebouncedUsername] = useState('')
  const [editUserDialog, setEditUserDialog] = useState(false)
  const [editDialogTab, setEditDialogTab] = useState<'details' | 'social-links'>('details')
  const [editUser, setEditUser] = useState<{
    id: string
    name: string
    email: string
    username: string
    image: string
    bio: string
    emailVerified: boolean
  }>({
    id: '',
    name: '',
    email: '',
    username: '',
    image: '',
    bio: '',
    emailVerified: false
  })
  const [socialLinksDraft, setSocialLinksDraft] = useState<Array<SocialLink & { tempId: string }>>(
    []
  )
  const [debouncedEditUsername, setDebouncedEditUsername] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')

  const socialLinksQuery = useAdminUserSocialLinks(editUser.id)
  const bioQuery = useAdminUserBio(editUser.id)
  const replaceAdminUserSocialLinksMutation = useReplaceAdminUserSocialLinks()

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

  useEffect(() => {
    if (!editUserDialog) return
    const bio = bioQuery.data?.bio
    if (bio !== undefined) {
      setEditUser((prev) => ({ ...prev, bio: bio ?? '' }))
    }
  }, [editUserDialog, bioQuery.data?.bio])

  useEffect(() => {
    if (!editUserDialog || !socialLinksQuery.data) return
    setSocialLinksDraft(
      socialLinksQuery.data
        .slice()
        .toSorted((a, b) => a.position - b.position)
        .map((link, index) => ({
          ...link,
          tempId: `${link.platform}-${index}-${crypto.randomUUID()}`
        }))
    )
  }, [editUserDialog, socialLinksQuery.data])

  const socialLinkSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'users', search, offset],
    queryFn: async () => {
      const result = await authClient.admin.listUsers({
        query: {
          limit: PAGE_SIZE,
          offset,
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

  const { data: editUsernameAvailability, isPending: checkingEditUsername } = useQuery({
    queryKey: ['username', 'availability', debouncedEditUsername],
    queryFn: async () => {
      const result = await authClient.isUsernameAvailable({
        username: debouncedEditUsername
      })
      return result.data
    },
    enabled: debouncedEditUsername.length >= 2 && debouncedEditUsername !== originalUsername
  })

  const sendInviteMutation = useMutation({
    mutationFn: async (userId: string) =>
      fetcher<{ success: boolean; emailId: string }>(apiUrl('/invite/send'), {
        method: 'POST',
        body: JSON.stringify({ userId })
      }),
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
      const email = newUser.email || `${newUser.username || crypto.randomUUID()}@placeholder.local`
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
      await authClient.admin.updateUser({
        userId: editUser.id,
        data: {
          name: editUser.name,
          email: editUser.email,
          username: editUser.username || undefined,
          emailVerified: editUser.emailVerified
        }
      })

      return fetcher<{ bio: string | null }>(apiUrl(`/user/admin/${editUser.id}/bio`), {
        method: 'PATCH',
        body: JSON.stringify({
          bio: editUser.bio,
          image: editUser.image || null
        })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user-bio', editUser.id]
      })
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
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      return authClient.admin.setRole({
        userId,
        role
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
    mutationFn: async ({ userId, banReason }: { userId: string; banReason?: string }) => {
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

  const handleSocialLinkDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setSocialLinksDraft((prev) => {
      const oldIndex = prev.findIndex((item) => item.tempId === active.id)
      const newIndex = prev.findIndex((item) => item.tempId === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev

      return arrayMove(prev, oldIndex, newIndex).map((item, index) => ({
        ...item,
        position: index
      }))
    })
  }

  const handleAddSocialLink = () => {
    setSocialLinksDraft((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        platform: 'bandcamp',
        url: '',
        position: prev.length
      }
    ])
  }

  const handleSaveSocialLinks = () => {
    if (!editUser.id) return

    const cleaned = socialLinksDraft
      .map(({ tempId, ...rest }) => rest)
      .filter((link) => link.url.trim().length > 0)
      .map((link, index) => ({ ...link, position: index }))

    replaceAdminUserSocialLinksMutation.mutate(
      {
        userId: editUser.id,
        links: cleaned
      },
      {
        onSuccess: (links) => {
          setSocialLinksDraft(
            links.map((link, index) => ({
              ...link,
              tempId: `${link.platform}-${index}-${crypto.randomUUID()}`
            }))
          )
          toast({ title: 'Social links updated successfully' })
        },
        onError: (err) => {
          toast({
            title: 'Failed to update social links',
            description: err.message,
            variant: 'destructive'
          })
        }
      }
    )
  }

  const users: AdminUser[] = data?.data?.users ?? []
  const total = data?.data?.total ?? users.length

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setOffset(0)
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-4'>
        <Input
          placeholder='Search by email...'
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className='max-w-sm'
        />
        <Button onClick={() => setCreateUserDialog(true)}>
          <Plus className='w-4 h-4 mr-2' />
          Create User
        </Button>
        <span className='text-sm text-muted-foreground'>{total} users</span>
      </div>

      {isPending ? (
        <div className='py-8 text-center text-muted-foreground'>Loading users...</div>
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
                  <td className='px-4 py-3'>
                    <div className='flex items-center gap-3'>
                      {user.image ? (
                        <img
                          src={user.image}
                          alt={user.name}
                          className='h-8 w-8 rounded-sm object-cover shrink-0'
                        />
                      ) : (
                        <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground'>
                          {user.name.charAt(0)}
                        </div>
                      )}
                      <span>{user.name}</span>
                    </div>
                  </td>
                  <td className='px-4 py-3 text-muted-foreground'>{user.email}</td>
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
                      <Badge variant='destructive' title={user.banReason ?? undefined}>
                        Banned
                      </Badge>
                    ) : user.emailVerified === false ? (
                      <Badge variant='outline' className='text-muted-foreground'>
                        Unverified
                      </Badge>
                    ) : (
                      <Badge variant='outline'>Active</Badge>
                    )}
                  </td>
                  <td className='px-4 py-3'>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='sm' aria-label='Actions'>
                          <MoreHorizontal className='w-4 h-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        {user.username && (
                          <DropdownMenuItem asChild>
                            <a href={`/${user.username}`} target='_blank' rel='noopener noreferrer'>
                              View profile
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => sendInviteMutation.mutate(user.id)}
                          disabled={sendInviteMutation.isPending}>
                          Send invite
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditUser({
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              username: user.username || '',
                              image: user.image || '',
                              bio: '',
                              emailVerified: user.emailVerified ?? false
                            })
                            setOriginalUsername(user.username || '')
                            setEditDialogTab('details')
                            setSocialLinksDraft([])
                            setEditUserDialog(true)
                          }}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.banned ? (
                          <DropdownMenuItem
                            onClick={() => unbanMutation.mutate(user.id)}
                            disabled={unbanMutation.isPending}>
                            Unban
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              setBanDialog({
                                open: true,
                                userId: user.id,
                                userName: user.name
                              })
                            }>
                            Ban
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className='text-destructive focus:text-destructive'
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              userId: user.id,
                              userName: user.name
                            })
                          }>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className='px-4 py-8 text-center text-muted-foreground'>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <TablePagination
        page={Math.floor(offset / PAGE_SIZE) + 1}
        pageSize={PAGE_SIZE}
        total={total}
        isLoading={isPending}
        onPageChange={(p) => setOffset((p - 1) * PAGE_SIZE)}
      />

      <Dialog open={createUserDialog} onOpenChange={setCreateUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Manually add a new user to the system.</DialogDescription>
          </DialogHeader>
          <div className='py-4 space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Display Name</Label>
              <Input
                id='name'
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
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
                  <p className='text-xs text-destructive'>Username is already taken</p>
                )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='email'>Email</Label>
              <Input
                id='email'
                type='email'
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder='john@example.com'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <Input
                id='password'
                type='password'
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder='••••••••'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='role'>Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(role: UserRole) => setNewUser({ ...newUser, role })}>
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
                (newUser.username.length >= 2 && !usernameAvailability?.available)
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
          <Tabs
            value={editDialogTab}
            onValueChange={(value: string) => {
              if (isEditDialogTab(value)) {
                setEditDialogTab(value)
              }
            }}
            className='py-4 space-y-4'>
            <TabsList>
              <TabsTrigger value='details'>Details</TabsTrigger>
              <TabsTrigger value='social-links'>Social Links</TabsTrigger>
            </TabsList>

            <TabsContent value='details' className='space-y-4'>
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
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
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
                  {editUser.username.length >= 2 && editUser.username !== originalUsername && (
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
                    <p className='text-xs text-destructive'>Username is already taken</p>
                  )}
              </div>
              <div className='space-y-2'>
                <Label htmlFor='edit-email'>Email</Label>
                <Input
                  id='edit-email'
                  type='email'
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  placeholder='john@example.com'
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='edit-bio'>Bio</Label>
                <Textarea
                  id='edit-bio'
                  value={editUser.bio}
                  onChange={(e) =>
                    setEditUser({
                      ...editUser,
                      bio: e.target.value.slice(0, 500)
                    })
                  }
                  placeholder='Write a short bio...'
                  className='min-h-[110px]'
                />
                <p className='text-xs text-muted-foreground'>{editUser.bio.length}/500</p>
              </div>
              <div className='flex items-center space-x-2'>
                <Checkbox
                  id='edit-email-verified'
                  checked={editUser.emailVerified}
                  onCheckedChange={(checked) =>
                    setEditUser({
                      ...editUser,
                      emailVerified: checked === true
                    })
                  }
                />
                <Label htmlFor='edit-email-verified' className='cursor-pointer'>
                  Email Verified
                </Label>
              </div>
            </TabsContent>

            <TabsContent value='social-links' className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='text-sm font-medium'>Social Links</h4>
                  <p className='text-xs text-muted-foreground'>
                    Drag to reorder. Empty URLs are ignored on save.
                  </p>
                </div>
                <Button type='button' variant='outline' size='sm' onClick={handleAddSocialLink}>
                  <Plus className='mr-2 h-4 w-4' />
                  Add Link
                </Button>
              </div>

              {socialLinksQuery.isPending ? (
                <p className='text-sm text-muted-foreground'>Loading social links...</p>
              ) : socialLinksDraft.length === 0 ? (
                <div className='rounded-sm border border-dashed p-4 text-sm text-muted-foreground'>
                  No social links yet.
                </div>
              ) : (
                <DndContext
                  sensors={socialLinkSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSocialLinkDragEnd}>
                  <SortableContext
                    items={socialLinksDraft.map((item) => item.tempId)}
                    strategy={verticalListSortingStrategy}>
                    <div className='space-y-2'>
                      {socialLinksDraft.map((link) => (
                        <SortableSocialLinkRow
                          key={link.tempId}
                          link={link}
                          onChange={(next) =>
                            setSocialLinksDraft((prev) =>
                              prev.map((item) =>
                                item.tempId === link.tempId
                                  ? { ...next, tempId: link.tempId }
                                  : item
                              )
                            )
                          }
                          onRemove={() =>
                            setSocialLinksDraft((prev) =>
                              prev
                                .filter((item) => item.tempId !== link.tempId)
                                .map((item, index) => ({
                                  ...item,
                                  position: index
                                }))
                            )
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setEditUserDialog(false)}
              disabled={
                updateUserMutation.isPending || replaceAdminUserSocialLinksMutation.isPending
              }>
              Cancel
            </Button>
            {editDialogTab === 'details' ? (
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
            ) : (
              <Button
                onClick={handleSaveSocialLinks}
                disabled={replaceAdminUserSocialLinksMutation.isPending}>
                {replaceAdminUserSocialLinksMutation.isPending ? 'Saving...' : 'Save Social Links'}
              </Button>
            )}
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
              Are you sure you want to ban {banDialog.userName}? This will revoke all their
              sessions.
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
              onClick={() => setBanDialog({ open: false, userId: '', userName: '' })}>
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
              Are you sure you want to permanently delete {deleteDialog.userName}? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setDeleteDialog({ open: false, userId: '', userName: '' })}>
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
