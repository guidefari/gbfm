# Residency Feature - UX Flows & User Journeys

## Feature Context

### What is a Residency/radio show?

A residency/radio show is a recurring series where a selected DJ/artist releases mixes on a regular schedule (quarterly for goosebumps.fm). This gives artists a dedicated space to share their vision over time, building deeper connections with listeners through consistency and editorial depth.

### Platform Goals

The residency feature aligns with goosebumps.fm's core mission:

- **Label-centric approach:** Connecting listeners to artists and their broader creative ecosystems
- **Editorial depth:** Treating audio as permanent artifacts with thoughtful written content
- **Community building:** Serving underground music communities with curated, meaningful programming
- **Artist support:** Providing a platform for artists to share unreleased material and build their audience

### Structure

- **Format:** Each episode is a standalone mix with accompanying editorial
- **Content:** Tracklists, timestamps, artist interviews/write-ups, and cross-platform distribution
- **Archive approach:** After the residency completes, it becomes a permanent collection similar to how NTS presents archived shows

### Success Metrics

- Subscriber engagement (email signups specific to residencies)
- Listener retention across episodes
- Cross-platform reach (SoundCloud, Mixcloud, YouTube)
- Editorial quality that differentiates from algorithmic playlists

---

## User Journey 1: Discovery → First Listen

### Entry points:

- Homepage feature/banner → "New Residency: [Artist Name]"
- Direct link from social/newsletter
- Dedicated "Shows" page
- link back from creator's public profile

### Residency Landing Page:

**Hero section:**

- Residency artwork/visual identity
- Artist name + residency title
- Short description (1-2 sentences max)
- [Subscribe to this residency] CTA
- [Play latest episode] primary CTA

**Episode grid/list:**

- All episodes (most recent first)
- Each showing: artwork, episode number/title, duration, release date
- Play button hover state
- Click → goes to episode-specific page

**About/Context section:**

- Longer artist bio/residency concept
- Links to artist socials/other work
- Related labels/connections (your label-centric approach)

**Sticky player controls (once playing):**

- Currently playing episode indicator
- [Previous episode] [Next episode] navigation

---

## User Journey 2: Episode-Specific Page

### URL structure idea:

`goosebumps.fm/shows/[show-slug]/[episode-slug]`

### Page layout:

**Top section:**

- Episode artwork (large)
- Episode title + number ("Episode 3: [Name]" or just date-based?)
- Artist name (links back to residency hub)
- Duration, release date
- [Play] [Add to queue?] [Share] [Download?]
- Cross-platform links: [SoundCloud] [Mixcloud] [YouTube]

**Interactive waveform player:**

- Your wavesurfer.js implementation
- Timestamp markers (clickable)

**Tracklist (expandable or always visible?):**

- Timestamp - Artist - Track Title - Label
- Clickable timestamps jump to that point in waveform

**Write-up/Editorial:**

- Your conversational interview/context
- Could be Q&A format, essay, or hybrid

**Related episodes:**

- [Previous episode in residency] [Next episode in residency]
- Or grid of all other episodes

**Subscribe CTA:**

- If not subscribed: prominent "Get notified of new episodes"

---

## User Journey 3: Subscription Flow

### Subscribe interaction:

```
User clicks [Subscribe to this residency]
↓
Modal/inline form:
- Email input
- "Notify me when [Artist Name] releases new episodes"
- Optional: "Also subscribe to goosebumps newsletter"
- [Subscribe] button

Confirmation:
- Success message
- "You'll get an email when Episode X drops"
- Option to manage subscription preferences
```

### Email notification triggers:

- New episode published → send to residency subscribers
- Include: episode artwork, title, direct link, brief teaser

### Alternative notification methods to consider:

- RSS feed per residency (for podcast apps?)
- Push notifications (if you add PWA features later)
- Discord/Telegram bot integration?
- Calendar subscription (iCal for quarterly releases?)

---

## User Journey 4: Continuous Listening

### "Play all episodes" flow:

```
User clicks [Play all episodes] on residency landing
↓
Queue loads all episodes in order
↓
Player auto-advances to next episode when current ends
↓
Persistent queue UI shows what's coming next
```

### "Shuffle residency" flow:

- Similar but randomizes order
- Useful once you have 4+ episodes. so don't include it until then
