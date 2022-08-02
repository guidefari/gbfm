import siteMetadata from '@/data/siteMetadata'
import SocialIcon from '@/components/social-icons'
import { Nowplaying } from '@/components/Spotify/Nowplaying.tsx'

export default function Footer() {
  return (
    <footer>
      <div className="flex flex-col items-center mt-16">
        <div className="flex flex-col-reverse mb-3 lg:flex-row">
          <div className="flex items-center mt-4 space-x-4 lg:mr-5 lg:mt-0">
            <SocialIcon kind="mail" href={`mailto:${siteMetadata.email}`} size="6" />
            <SocialIcon kind="github" href={siteMetadata.github} size="6" />
            <SocialIcon kind="youtube" href={siteMetadata.youtube} size="6" />
            <SocialIcon kind="linkedin" href={siteMetadata.linkedin} size="6" />
            <SocialIcon kind="twitter" href={siteMetadata.twitter} size="6" />
          </div>
          <Nowplaying />
        </div>
      </div>
    </footer>
  )
}
