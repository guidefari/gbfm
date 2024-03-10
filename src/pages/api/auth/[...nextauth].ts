import { NextApiRequest, NextApiResponse } from "next"
import NextAuth from "next-auth/next"
import SpotifyProvider from 'next-auth/providers/spotify'

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            SPOTIFY_CLIENT_ID: string
            SPOTIFY_CLIENT_SECRET: string;
        }
    }
}

const authOptions = {
    providers: [
        SpotifyProvider({
            authorization:
                'https://accounts.spotify.com/authorize?scope=user-read-email,playlist-read-private',
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
        }),
    ],

    callbacks: {
        async jwt({ token, account }) {
            if (account) {
                token.accessToken = account.refresh_token
            }
            return token
        },
        async session(session, user) {
            session.user = user
            return session
        },
    },
}




// @ts-expect-error
export default NextAuth(authOptions)