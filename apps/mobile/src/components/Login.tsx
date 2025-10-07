import { Stack } from 'expo-router'
import React, { Fragment, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginMethod, setLoginMethod] = useState('password')

  const handleLogin = () => {
    if (loginMethod === 'password') {
      console.log('Login with password', email, password)
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
            className='p-2 mb-4 border border-gray-300 rounded-lg'
            placeholder='Email'
            value={email}
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
          />

          {/* Password Input (Only show for password method) */}
          {loginMethod === 'password' && (
            <TextInput
              className='p-2 mb-4 border border-gray-300 rounded-lg '
              placeholder='Password'
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
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
