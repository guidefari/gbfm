import { defineDocumentType, makeSource } from 'contentlayer/source-files'

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: `**/*.mdx`,
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
      description: 'Whether the post is a draft or not.',
    },
    authors: {
      type: 'list',
      of: { type: 'string' },
      description: 'Whether the post is a draft or not.',
    },
  },
  computedFields: {
    url: {
      type: 'string',
      resolve: (post) => `/curated/${post._raw.flattenedPath}`,
    },
    slug: {
      type: 'string',
      resolve: (post) => `${post._raw.flattenedPath}`,
    },
  },
}))

export default makeSource({
  contentDirPath: 'content/curated',
  documentTypes: [Post],
})
