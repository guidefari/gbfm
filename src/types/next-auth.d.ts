import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    session: {
      user: {
        name: string
        email: string
        image: string
        expires: string
      }
    }
    token: {
      name: string
      email: string
      picture: string
      sub: string
      accessToken: string
      iat: number
      exp: number
      jti: string
    }
  }
}
