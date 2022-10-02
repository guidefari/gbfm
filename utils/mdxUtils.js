import fs from 'fs'
import path from 'path'

// POSTS_PATH is useful when you want to get the path to a specific file
export const POSTS_PATH = path.join(process.cwd(), 'content', 'curated')
export const AUTHORS_PATH = path.join(process.cwd(), 'content', 'authors')
export const TWEETS_PATH = path.join(process.cwd(), 'content', 'tweets')

// postFilePaths is the list of all mdx files inside the POSTS_PATH directory
export const postFilePaths = fs
  .readdirSync(POSTS_PATH)
  // Only include md(x) files
  .filter((path) => /\.mdx?$/.test(path))

export const authorFilePaths = fs.readdirSync(AUTHORS_PATH).filter((path) => /\.mdx?$/.test(path))

export const tweetFilePaths = fs.readdirSync(TWEETS_PATH).filter((path) => /\.mdx?$/.test(path))
