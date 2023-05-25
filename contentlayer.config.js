import { defineDocumentType, makeSource } from 'contentlayer/source-files'

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: `curated/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: {
      type: 'string',
      description: 'The title of the post',
      required: true,
    },
    description: {
      type: 'string',
      description: 'The description of the post',
    },
    date: {
      type: 'date',
      description: 'The date of the post',
      required: true,
    },
    lastmod: {
      type: 'date',
      description: 'The last modification date of the post',
    },
    tags: {
      type: 'list',
      of: { type: 'string' },
      description: 'The tags of the post. Can be genre, or topic.',
    },
    draft: {
      type: 'boolean',
      description: 'Whether the post is a draft or not.',
    },
    canonicalUrl: {
      type: 'string',
      description: 'Whether the post is a draft or not.',
    },
    thumbnailUrl: {
      type: 'string',
    },
    authors: {
      type: 'list',
      of: { type: 'string' },
    },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (post) => `/${post._raw.flattenedPath}`,
    },
  },
}))

export const Tweet = defineDocumentType(() => ({
  name: 'Tweet',
  filePathPattern: `tweets/*.mdx`,
  contentType: 'mdx',
  fields: {
    authorName: {
      type: 'string',
      description: 'The title of the post',
      required: true,
    },
    handle: {
      type: 'string',
      description: 'The description of the post',
    },
    date: {
      type: 'date',
      description: 'The date of the post',
      required: true,
    },
    avatarUrl: {
      type: 'string',
      description: 'The last modification date of the post',
      required: true,
    },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (post) => `/${post._raw.flattenedPath}`,
    },
  },
}))

export const Mix = defineDocumentType(() => ({
  name: 'Mix',
  filePathPattern: `mixes/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: {
      type: 'string',
      description: 'Can be creative and fit the mood, or follow Goosebumps mix #123 format',
      required: true,
    },
    description: {
      type: 'string',
      description: 'A few words about what to expect',
    },
    date: {
      type: 'date',
      required: true,
    },
    mp3Url: {
      type: 'string',
      required: true,
    },
    thumbnailUrl: {
      type: 'string',
    },
    genres: {
      type: 'list',
      of: { type: 'string' },
    },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (post) => `/${post._raw.flattenedPath}`,
    },
  },
}))

export const Label = defineDocumentType(() => ({
  name: 'Label',
  filePathPattern: `labels/*.mdx`,
  contentType: 'mdx',
  fields: {
    name: {
      type: 'string',
      required: true,
    },
    thumbnailUrl: {
      type: 'string',
      required: true,
    },
    website: {
      type: 'string',
    },
    discogs: {
      type: 'string',
    },
    bandcamp: {
      type: 'string',
    },
    genres: {
      type: 'list',
      of: { type: 'string' },
    },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (post) => `/${post._raw.flattenedPath}`,
    },
  },
}))

export const Author = defineDocumentType(() => ({
  name: 'Author',
  filePathPattern: `authors/**/*.mdx`,
  contentType: 'mdx',
  fields: {
    name: {
      type: 'string',
      description: 'The title of the post',
      required: true,
    },
    avatar: {
      type: 'string',
      description: 'The description of the post',
    },
    title: {
      type: 'string',
      description: 'The description of the post',
    },
    email: {
      type: 'string',
      description: 'The description of the post',
    },
    website: {
      type: 'string',
      description: 'The description of the post',
    },
    draft: {
      type: 'boolean',
      description: 'The description of the post',
    },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (post) => `/${post._raw.flattenedPath}`,
    },
  },
}))

export default makeSource({
  contentDirPath: 'src/content',
  documentTypes: [Post, Tweet, Author, Label, Mix],
})
