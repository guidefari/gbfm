# Role-Based Access Control (RBAC) Design

## Overview

This document outlines the RBAC implementation for GBFM, providing role-based access control across both the frontend (`@apps/www`) and backend (`@apps/vps`) applications.

## User Roles

### Role Hierarchy
```
admin > mod > user
```

### Role Definitions

- **`user`** (default): Standard user with basic access
  - View public content
  - Manage own profile
  - Basic audio player functionality

- **`mod`**: Moderator with content management privileges
  - All user permissions
  - Content moderation (approve/reject posts and mixes)
  - View draft content from other users

- **`admin`**: Administrator with full system access
  - All mod permissions
  - Publication management (create/edit/delete publications)
  - User management (view all users, change roles)
  - System-level operations
  - Access to admin-only routes and components

## Technical Implementation

### Database Schema

#### Authors Table Update
```sql
-- Add role enum to existing authors table
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mod'; 
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';

-- Add role column with default 'user'
ALTER TABLE authors ADD COLUMN role user_role DEFAULT 'user' NOT NULL;
```

#### Role Assignment
- New users default to `user` role
- Role changes require direct database updates initially
- Future: Admin interface for role management

### JWT Token Structure

JWT payload will include role information:
```typescript
interface JWTPayload {
  sub: string;        // user ID
  email: string;
  role: 'admin' | 'mod' | 'user';
  type: 'access' | 'refresh';
  exp: number;
  iat: number;
}
```

### API Protection (@apps/vps)

#### Middleware Implementation
- **`requireAuth`**: Validates JWT and extracts user info
- **`requireRole(role)`**: Ensures user has minimum required role
- **`requireAdmin`**: Shorthand for `requireRole('admin')`
- **`requireMod`**: Shorthand for `requireRole('mod')`

#### Route Protection Examples
```typescript
// Admin-only routes
app.use('/admin/*', requireAdmin)

// Mod and above routes  
app.use('/moderation/*', requireMod)

// Specific endpoint protection
app.delete('/publications/:id', requireAdmin, deletePublication)
app.patch('/posts/:id/approve', requireMod, approvePost)
```

### Frontend Protection (@apps/www)

#### Auth Store Updates
```typescript
interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'admin' | 'mod' | 'user';
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  avatarUrl: string | null;
}
```

#### Route Protection
- Protected routes check user role before rendering
- Unauthorized users redirected to appropriate fallback
- Role-specific navigation items

#### Component Protection
- Conditional rendering based on user role
- Admin-only buttons, sections, and functionality
- Role-based command palette items

## Protected Features by Role

### Admin-Only Features
- **Publication Management**
  - Create new publications
  - Edit publication details
  - Delete publications
  - Manage publication-author relationships

- **User Management**
  - View all users
  - Change user roles
  - View user activity/analytics

### Mod-Only Features
- **Content Moderation**
  - Approve/reject submitted posts
  - Approve/reject submitted mixes
  - View all draft content
  - Edit content metadata

- **Content Management**
  - Bulk content operations
  - Tag management
  - Content analytics

## Implementation Checklist

### Database Changes
- [ ] Add role enum to PostgreSQL
- [ ] Add role column to authors table
- [ ] Create migration script
- [ ] Update existing users to 'user' role

### Backend (@apps/vps)
- [ ] Update auth handlers to include role in JWT
- [ ] Create role-based middleware
- [ ] Protect admin/mod endpoints
- [ ] Update author schema types

### Frontend (@apps/www)
- [ ] Update auth store with role field
- [ ] Create role-based route guards
- [ ] Create role-based component utilities
- [ ] Add admin/mod command palette items
- [ ] Update profile display with role

### Cross-App Consistency
- [ ] Ensure role verification works identically
- [ ] Share role types between apps
- [ ] Consistent role-based redirects

## Security Considerations

- Roles verified server-side on every protected request
- JWT tokens refreshed to pick up role changes
- Frontend role checks are for UX only - not security
- Principle of least privilege: users start with minimal access
- Role escalation requires manual intervention

## Future Enhancements

- Admin interface for role management
- Audit logs for role changes
- Temporary role assignments
- Custom permissions beyond roles
- Role-based API rate limiting