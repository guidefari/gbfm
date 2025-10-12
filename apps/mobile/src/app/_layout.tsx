import '../global.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'

// import { env } from '@/env'
// import { FPSMeter } from '@/fpsmeter'

const queryClient = new QueryClient()

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* {env.isDev && (
        <FPSMeter width={120} height={30} style={{ top: 50, right: 10 }} />
      )} */}
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: '#16415A'
          }
        }}
      />
    </QueryClientProvider>
  )
}
