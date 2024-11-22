- [ ] Wrap up query & write logic for Dynamo data layer for content
- [ ] Migrate archive content to dynamo

# UI
- [ ] Use local markdown on the frontend for admin like content. EG this file, changelog, etc.
    - Landing page
    - TODO
    - changelog
- [ ] Account page

# Shaping

### Bluesky as a microblog CMS
- [ ] have to link goosebumps account to bluesky
  - so that goosebumps displays internal author details
- Example request `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=guidefari.com`

Filter function for `#gbfm`

```ts
function extractGbfmPosts(data) {
  return data.feed
    .filter(item => 
      item.post.record.facets.some(facet => 
        facet.features.some(feature => feature.tag === 'gbfm')
      )
    )
    .map(item => item.post.record.text);
}

```