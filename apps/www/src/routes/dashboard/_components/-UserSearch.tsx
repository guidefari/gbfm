import { Badge, Button, Input } from '@gbfm/ui'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useId, useState } from 'react'
import { apiUrl, fetcher } from '@/lib/http'

interface UserSearchResult {
  id: string
  name: string
  username: string | null
  image: string | null
}

interface SelectedUser {
  id: string
  name: string
}

interface UserSearchProps {
  selectedUsers: SelectedUser[]
  onSelectionChange: (users: SelectedUser[]) => void
  label?: string
}

export function UserSearch({ selectedUsers, onSelectionChange, label = 'Hosts' }: UserSearchProps) {
  const inputId = useId()
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)

  const { data: searchResults, isPending } = useQuery({
    queryKey: ['users', 'search', searchQuery],
    queryFn: () =>
      fetcher<UserSearchResult[]>(apiUrl(`/user/search?q=${encodeURIComponent(searchQuery)}`)),
    enabled: searchQuery.length >= 2
  })

  const handleSelect = (user: UserSearchResult) => {
    if (!selectedUsers.some((u) => u.id === user.id)) {
      onSelectionChange([...selectedUsers, { id: user.id, name: user.name }])
    }
    setSearchQuery('')
    setShowResults(false)
  }

  const handleRemove = (userId: string) => {
    onSelectionChange(selectedUsers.filter((u) => u.id !== userId))
  }

  const filteredResults = searchResults?.filter(
    (user) => !selectedUsers.some((u) => u.id === user.id)
  )

  return (
    <div className='space-y-2'>
      <label htmlFor={inputId} className='text-base font-medium'>
        {label}
      </label>

      {selectedUsers.length > 0 && (
        <div className='flex flex-wrap gap-2 mb-2'>
          {selectedUsers.map((user) => (
            <Badge key={user.id} variant='secondary' className='gap-1'>
              {user.name}
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-4 w-4 p-0 hover:bg-transparent'
                onClick={() => handleRemove(user.id)}>
                <X className='h-3 w-3' />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      <div className='relative'>
        <Input
          id={inputId}
          placeholder='Search by username or display name...'
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
        />

        {showResults && searchQuery.length >= 2 && (
          <div className='absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-auto'>
            {isPending ? (
              <div className='p-2 text-base text-muted-foreground'>Searching...</div>
            ) : filteredResults && filteredResults.length > 0 ? (
              filteredResults.map((user) => (
                <button
                  key={user.id}
                  type='button'
                  className='w-full px-3 py-2 text-left hover:bg-muted flex flex-col'
                  onClick={() => handleSelect(user)}>
                  <span className='font-medium'>{user.name}</span>
                  {user.username && (
                    <span className='text-xs text-muted-foreground'>@{user.username}</span>
                  )}
                </button>
              ))
            ) : (
              <div className='p-2 text-base text-muted-foreground'>No users found</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
