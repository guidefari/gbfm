import { Tabs } from '@/components/FrontPage/Tabs'
import Track from '@/components/Track'
import HorizontalScrollCards from '@/components/common/HorizontalScrollCards'

export default function component() {
  return (
    <div className="max-w-3xl mx-auto">
      <HorizontalScrollCards>
        <Track url={'https://open.spotify.com/track/5xBX9SJAEjSX42dZTW0KXh?si=f9aa64607f66405e'} />
        <Track url={'https://open.spotify.com/track/4A1pMSJtjP1bObzM5g9NYe?si=3f5abf7aa6284cd1'} />
        <Track url={'https://open.spotify.com/track/69sUHyPgZGbW5QxWDEzehK?si=55e45a67a8374b9b'} />
        <Track url={'https://open.spotify.com/track/4TwiXd2NoY8KnCn7PCNg7N?si=b41a4d380d3a4673'} />
        <Track url={'https://open.spotify.com/track/1EL8KBQTWBqlFl4dlu6iwX?si=f1bcf6930bc04f00'} />
      </HorizontalScrollCards>
    </div>
  )
}
