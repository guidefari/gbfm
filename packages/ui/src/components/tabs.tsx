import {
  Content as TabsContentPrimitive,
  List as TabsListPrimitive,
  Root as TabsRoot,
  Trigger as TabsTriggerPrimitive
} from '@radix-ui/react-tabs'
import * as React from 'react'

import { cn } from '../lib/cn'

const Tabs = TabsRoot

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsListPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsListPrimitive>
>(({ className, ...props }, ref) => (
  <TabsListPrimitive
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-sm bg-muted p-1 text-muted-foreground',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsListPrimitive.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTriggerPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsTriggerPrimitive>
>(({ className, ...props }, ref) => (
  <TabsTriggerPrimitive
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-base font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsTriggerPrimitive.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsContentPrimitive>,
  React.ComponentPropsWithoutRef<typeof TabsContentPrimitive>
>(({ className, ...props }, ref) => (
  <TabsContentPrimitive
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsContentPrimitive.displayName

export { Tabs, TabsContent, TabsList, TabsTrigger }
