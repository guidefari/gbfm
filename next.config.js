/** @type {import('next').NextConfig} */

const { withContentlayer } = require('next-contentlayer')

const hostnames = [
  'i.scdn.co', // Spotify Album Art
  'mosaic.scdn.co', // Spofity playlist mosaics
  'pbs.twimg.com', // Twitter Profile Picture
  'res.cloudinary.com', // cloudinary images
  'images-ak.spotifycdn.com', // New spotify images url?
  'image-cdn-ak.spotifycdn.com',
  'd20tmfka7s58bt.cloudfront.net', // img-omg
  'spotifycdn.com'
]

module.exports = withContentlayer({
  rewrites: async () => [
    {
      source: '/rss.xml',
      destination: '/api/rss',
    },
  ],

  experimental: {
    scrollRestoration: true,
  },

  images: {
    remotePatterns: hostnames.map(hostname => ({
      protocol: 'https',
      hostname
  }))
  },
})
