import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
    /**
     * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
     */

    interface Session {
        // data: {
        session: {
            user: {
                name: string
                email: string
                image: string
            }
            expires: string
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
        } & DefaultSession['user']
        // }
    }
}
