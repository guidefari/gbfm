import siteMetadata from '@/data/siteMetadata'
import SocialIcon from '@/components/social-icons'
import { NowPlaying } from '@/components/Spotify/Nowplaying.tsx'

export default function Footer() {
  return (
    <footer>
      <div className="mt-16 flex flex-col items-center">
        <div className="mb-3 flex flex-col-reverse lg:flex-row">
          <div className="mt-4 flex items-center space-x-4 lg:mr-5 lg:mt-0">
            <SocialIcon kind="mail" href={`mailto:${siteMetadata.email}`} size="6" />
            <SocialIcon kind="github" href={siteMetadata.github} size="6" />
            <SocialIcon kind="youtube" href={siteMetadata.youtube} size="6" />
            <SocialIcon kind="linkedin" href={siteMetadata.linkedin} size="6" />
            <SocialIcon kind="twitter" href={siteMetadata.twitter} size="6" />
          </div>
          <NowPlaying />
        </div>
      </div>
    </footer>
  )
}
