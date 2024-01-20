import * as TabsPrimitive from '@radix-ui/react-tabs'
import { clsx } from 'clsx'
import React from 'react'
import { Mixes } from './Mixes'
import { Words } from './Words'
import { Labels } from './Labels'
import { Bsides } from './BSides'

interface Tab {
  title: string
  value: React.ReactNode
}

const tabs: Tab[] = [
  {
    title: 'Mixes',
    value: <Mixes />,
  },
  {
    title: 'Words',
    value: <Words />,
  },

  {
    title: 'Labels',
    value: <Labels />,
  },
  {
    title: 'B-sides',
    value: <Bsides />,
  },
]

interface TabsProps {}

const Tabs = (props: TabsProps) => {
  return (
    <TabsPrimitive.Root defaultValue={tabs[0].title}>
      <TabsPrimitive.List className="flex w-full rounded-t-lg sticky top-0">
        {tabs.map(({ title, value }) => (
          <TabsPrimitive.Trigger
            key={`tab-trigger-${title}`}
            value={title}
            onClick={() => console.log(title)}
            className={clsx(
              'group',
              'first:rounded-tl-lg last:rounded-tr-lg',
              'border-b first:border-r last:border-l',
              'radix-state-active:border-b-gray-700 focus-visible:radix-state-active:border-b-transparent radix-state-inactive:bg-gray-50 dark:radix-state-active:border-b-gray-100 dark:radix-state-active:bg-gray-900 focus-visible:dark:radix-state-active:border-b-transparent dark:radix-state-inactive:bg-gray-800',
              'flex-1 px-3 py-2.5',
              'bg-gb-bg',
              'focus:radix-state-active:border-b-red',
              'focus:z-10 focus:outline-none focus-visible:ring focus-visible:ring-purple-500 focus-visible:ring-opacity-75'
            )}
          >
            <span className={clsx('text-sm font-medium')}>{title}</span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map(({ value, title }) => (
        <TabsPrimitive.Content
          key={`tab-content-${title}`}
          value={title}
          className={clsx('rounded-b-lg ')}
        >
          {value}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  )
}

export { Tabs }
