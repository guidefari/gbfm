import { brand, typography } from '@gbfm/theme'
import { Effect } from 'effect'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native'
import { login } from '@/api/auth'
import { Screen } from '@/components/Screen'
import { useSetAuth } from '@/store/auth'

const colors = {
  background: brand.bg,
  surface: brand.darkerBg,
  accent: brand['pastel-green-1'],
  muted: brand['pastel-green-2'],
  text: brand.defaultText,
  error: '#FDA4AF'
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const router = useRouter()
  const setAuth = useSetAuth()
  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting

  const handleLogin = () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    setErrorMessage(undefined)

    const runLogin = login({ email: email.trim(), password }).pipe(
      Effect.tap(setAuth),
      Effect.tap(() => Effect.sync(() => router.replace('/profile'))),
      Effect.catch((error) =>
        Effect.sync(() => {
          setErrorMessage(
            error._tag === 'LoginFailed' ? error.message : 'Unable to sign in right now.'
          )
        })
      ),
      Effect.ensuring(Effect.sync(() => setIsSubmitting(false))),
      Effect.asVoid
    )
    void Effect.runPromise(runLogin)
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps='handled'
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View style={{ gap: 32 }}>
            <View style={{ gap: 12 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontFamily: typography.fontJetbrains,
                  fontSize: 12,
                  letterSpacing: 2.4,
                  textTransform: 'uppercase'
                }}>
                Goosebumps FM
              </Text>
              <Text
                style={{
                  color: colors.accent,
                  fontFamily: typography.fontSansAlt,
                  fontSize: 42,
                  lineHeight: 44
                }}>
                Welcome back.
              </Text>
              <Text style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
                Sign in to save music, manage reminders, and pick up where you left off.
              </Text>
            </View>

            <View
              style={{
                gap: 20,
                padding: 20,
                backgroundColor: colors.surface,
                borderColor: `${colors.muted}55`,
                borderWidth: 1,
                borderRadius: 4
              }}>
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>Email</Text>
                <TextInput
                  accessibilityLabel='Email'
                  autoCapitalize='none'
                  autoComplete='email'
                  autoCorrect={false}
                  keyboardType='email-address'
                  onChangeText={setEmail}
                  placeholder='you@example.com'
                  placeholderTextColor={`${colors.text}99`}
                  returnKeyType='next'
                  textContentType='emailAddress'
                  value={email}
                  style={{
                    minHeight: 52,
                    paddingHorizontal: 16,
                    color: '#FFFFFF',
                    borderColor: `${colors.muted}66`,
                    borderWidth: 1,
                    borderRadius: 4,
                    fontSize: 16
                  }}
                />
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>
                  Password
                </Text>
                <View>
                  <TextInput
                    accessibilityLabel='Password'
                    autoCapitalize='none'
                    autoComplete='current-password'
                    onChangeText={setPassword}
                    onSubmitEditing={handleLogin}
                    placeholder='Your password'
                    placeholderTextColor={`${colors.text}99`}
                    returnKeyType='go'
                    secureTextEntry={!showPassword}
                    textContentType='password'
                    value={password}
                    style={{
                      minHeight: 52,
                      paddingLeft: 16,
                      paddingRight: 72,
                      color: '#FFFFFF',
                      borderColor: `${colors.muted}66`,
                      borderWidth: 1,
                      borderRadius: 4,
                      fontSize: 16
                    }}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    accessibilityRole='button'
                    hitSlop={12}
                    onPress={() => setShowPassword((visible) => !visible)}
                    style={{ position: 'absolute', right: 16, top: 16 }}>
                    <Text style={{ color: colors.muted, fontWeight: '600' }}>
                      {showPassword ? 'Hide' : 'Show'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {errorMessage ? (
                <Text accessibilityRole='alert' style={{ color: colors.error, lineHeight: 20 }}>
                  {errorMessage}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole='button'
                disabled={!canSubmit}
                onPress={handleLogin}
                style={({ pressed }) => ({
                  minHeight: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  backgroundColor: canSubmit ? colors.accent : `${colors.muted}66`,
                  opacity: pressed ? 0.8 : 1
                })}>
                {isSubmitting ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={{ color: colors.surface, fontSize: 16, fontWeight: '700' }}>
                    Sign in
                  </Text>
                )}
              </Pressable>
            </View>

            <Text style={{ color: `${colors.text}CC`, textAlign: 'center', fontSize: 13 }}>
              Magic links and password recovery are coming next.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
