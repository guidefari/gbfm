import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  toast
} from '@gbfm/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

interface Session {
  id: string
  token: string
  userId: string
  createdAt: Date
  expiresAt: Date
  userAgent?: string | null
  ipAddress?: string | null
}

interface UserSearchResult {
  id: string
  name: string
  email: string
}

export function SessionsTab() {
  const queryClient = useQueryClient()
  const [userEmail, setUserEmail] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [revokeAllDialog, setRevokeAllDialog] = useState(false)

  const { data: usersData, isPending: searchPending } = useQuery({
    queryKey: ['admin', 'users', 'search', userEmail],
    queryFn: async () => {
      if (!userEmail) return { data: { users: [] } }
      return authClient.admin.listUsers({
        query: { limit: 5, searchValue: userEmail, searchField: 'email' }
      })
    },
    enabled: userEmail.length > 2
  })

  const { data: sessionsData, isPending: sessionsPending } = useQuery({
    queryKey: ['admin', 'sessions', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return { data: { sessions: [] } }
      return authClient.admin.listUserSessions({ userId: selectedUser.id })
    },
    enabled: Boolean(selectedUser)
  })

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionToken: string) => {
      return authClient.admin.revokeUserSession({ sessionToken })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'sessions', selectedUser?.id]
      })
      toast({ title: 'Session revoked successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to revoke session',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const revokeAllSessionsMutation = useMutation({
    mutationFn: async (userId: string) => {
      return authClient.admin.revokeUserSessions({ userId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'sessions', selectedUser?.id]
      })
      setRevokeAllDialog(false)
      toast({ title: 'All sessions revoked successfully' })
    },
    onError: (err: Error) => {
      toast({
        title: 'Failed to revoke sessions',
        description: err.message,
        variant: 'destructive'
      })
    }
  })

  const searchResults: UserSearchResult[] = usersData?.data?.users ?? []
  const sessions: Session[] = sessionsData?.data?.sessions ?? []

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <label htmlFor='user-email-search' className='text-sm font-medium'>
          Search User by Email
        </label>
        <Input
          id='user-email-search'
          placeholder='Enter user email...'
          value={userEmail}
          onChange={(e) => {
            setUserEmail(e.target.value)
            setSelectedUser(null)
          }}
          className='max-w-sm'
        />
        {searchPending && userEmail.length > 2 && (
          <p className='text-sm text-muted-foreground'>Searching...</p>
        )}
        {searchResults.length > 0 && !selectedUser && (
          <div className='mt-2 max-w-sm space-y-1 rounded-sm border p-2'>
            {searchResults.map((user) => (
              <button
                type='button'
                key={user.id}
                className='block w-full rounded-sm px-2 py-1 text-left text-sm hover:bg-muted'
                onClick={() => setSelectedUser(user)}>
                <span className='font-medium'>{user.name}</span>
                <span className='ml-2 text-muted-foreground'>{user.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h3 className='font-medium'>Sessions for {selectedUser.name}</h3>
              <p className='text-sm text-muted-foreground'>{selectedUser.email}</p>
            </div>
            <div className='flex gap-2'>
              <Button variant='outline' size='sm' onClick={() => setSelectedUser(null)}>
                Clear
              </Button>
              {sessions.length > 0 && (
                <Button variant='destructive' size='sm' onClick={() => setRevokeAllDialog(true)}>
                  Revoke All
                </Button>
              )}
            </div>
          </div>

          {sessionsPending ? (
            <div className='py-8 text-center text-muted-foreground'>Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className='py-8 text-center text-muted-foreground'>No active sessions found</div>
          ) : (
            <div className='overflow-x-auto rounded-sm border'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b bg-muted/50'>
                    <th className='px-4 py-3 text-left font-medium'>Session ID</th>
                    <th className='px-4 py-3 text-left font-medium'>Created</th>
                    <th className='px-4 py-3 text-left font-medium'>Expires</th>
                    <th className='px-4 py-3 text-left font-medium'>User Agent</th>
                    <th className='px-4 py-3 text-left font-medium'>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className='border-b hover:bg-muted/50'>
                      <td className='px-4 py-3 font-mono text-xs'>{session.id.slice(0, 8)}...</td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {new Date(session.createdAt).toLocaleString()}
                      </td>
                      <td className='px-4 py-3 text-muted-foreground'>
                        {new Date(session.expiresAt).toLocaleString()}
                      </td>
                      <td className='max-w-xs truncate px-4 py-3 text-muted-foreground'>
                        {session.userAgent ?? 'Unknown'}
                      </td>
                      <td className='px-4 py-3'>
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={() => revokeSessionMutation.mutate(session.token)}
                          disabled={revokeSessionMutation.isPending}>
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedUser && !userEmail && (
        <div className='py-8 text-center text-muted-foreground'>
          Search for a user by email to view their sessions
        </div>
      )}

      <Dialog open={revokeAllDialog} onOpenChange={setRevokeAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke All Sessions</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke all sessions for {selectedUser?.name}? They will be
              logged out from all devices.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRevokeAllDialog(false)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => selectedUser && revokeAllSessionsMutation.mutate(selectedUser.id)}
              disabled={revokeAllSessionsMutation.isPending}>
              {revokeAllSessionsMutation.isPending ? 'Revoking...' : 'Revoke All Sessions'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
