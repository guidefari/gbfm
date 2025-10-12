import { login } from '@gbfm/core/api'
import { useMutation } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { env } from '@/env'
import { useAuthStore } from '@/store/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginMethod, setLoginMethod] = useState('password')
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const setAuth = useAuthStore((state) => state.setAuth)

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      login(env.EXPO_PUBLIC_API_URL, credentials),
    onSuccess: (data) => {
      setAuth(data)
      router.push('/profile')
    },
    onError: (error) => {
      console.error('Login failed', error)
    }
  })

  const handleLogin = () => {
    if (loginMethod === 'password') {
      loginMutation.mutate({ email, password })
    } else {
      console.log('Send magic link to', email)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Login'
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className='justify-center flex-1 p-4'>
        {/* Toggle Login Method */}
        <View className='flex-row justify-center mb-4'>
          <TouchableOpacity
            onPress={() => setLoginMethod('password')}
            className={`px-4 py-2 rounded-l-lg ${
              loginMethod === 'password' ? 'bg-blue-500' : 'bg-gray-200'
            }`}>
            <Text
              className={`${
                loginMethod === 'password' ? 'text-white' : 'text-gray-700'
              }`}>
              Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setLoginMethod('magicLink')}
            className={`px-4 py-2 rounded-r-lg ${
              loginMethod === 'magicLink' ? 'bg-blue-500' : 'bg-gray-200'
            }`}>
            <Text
              className={`${
                loginMethod === 'magicLink' ? 'text-white' : 'text-gray-700'
              }`}>
              Magic Link
            </Text>
          </TouchableOpacity>
        </View>

        {/* Email Input */}
        <View className='flex flex-col gap-4'>
          <TextInput
            className='p-2 mb-4 text-white border border-gray-300 rounded-lg'
            placeholder='Email'
            value={email}
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
          />

          {/* Password Input (Only show for password method) */}
          {loginMethod === 'password' && (
            <View className='relative'>
              <TextInput
                className='p-2 pr-16 mb-4 text-white border border-gray-300 rounded-lg'
                placeholder='Password'
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className='absolute px-2 py-1 right-2 top-2'>
                <Text className='text-sm text-blue-400'>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Login Button */}
        <TouchableOpacity
          className='p-3 bg-blue-500 rounded-lg'
          onPress={handleLogin}>
          <Text className='text-lg font-bold text-center text-white'>
            {loginMethod === 'password' ? 'Login' : 'Send Magic Link'}
          </Text>
        </TouchableOpacity>

        {/* Forgot Password Link */}
        {loginMethod === 'password' && (
          <TouchableOpacity className='mt-4'>
            <Text className='text-center text-blue-500'>Forgot Password?</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </>
  )
}
