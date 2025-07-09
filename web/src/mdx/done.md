**Thur 10 July 2025**

1. sync mix buckets
    - used this script`aws s3 sync s3://source-bucket-name s3://destination-bucket-name`
    - copied mixes over from initial manually created bucket, to the dev and prod buckets created by sst
2. updated landing page. removing pages from the public until I'm happy with them. urls remain accessible though
3. conventional commits are now tied to git release tags, and package.json versions.
    - production build only kicks off after we push a new tag to the prod branch
    - this gives me the escape hatch to be able to commit stuff to the trunk without triggering a deployment 🚀
    - also displaying this version number on the landing page. may be worth adding to the footer too?