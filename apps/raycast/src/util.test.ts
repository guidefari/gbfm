import { test, expect } from 'bun:test'
import { extractTracklistAsJSXstring } from './util'

test('handles plain markdown list format', () => {
  const input = `- A-Reece - Take Care of Your Heart
- Jaden - Fallen
- Nascent - Lock It Up`

  const expected = `<Tracklist
  tracks={[
    'A-Reece - Take Care of Your Heart',
    'Jaden - Fallen',
    'Nascent - Lock It Up',
  ]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})

test('handles plain newline separated list', () => {
  const input = `A-Reece - Take Care of Your Heart
Jaden - Fallen
Nascent - Lock It Up`

  const expected = `<Tracklist
  tracks={[
    'A-Reece - Take Care of Your Heart',
    'Jaden - Fallen',
    'Nascent - Lock It Up',
  ]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})

test('handles DJ software export format', () => {
  const input = `#	Artist	Track Title
1	SCNTST	THPS 96
2	SCNTST	untitled238
3	Lone	Sunken
4	Jazzuelle	Latitudes
5	HTRK	Venter - HTRK Remix`

  const expected = `<Tracklist
  tracks={[
    'SCNTST - THPS 96',
    'SCNTST - untitled238',
    'Lone - Sunken',
    'Jazzuelle - Latitudes',
    'HTRK - Venter - HTRK Remix',
  ]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})

test('handles mixed format with extra whitespace', () => {
  const input = `
  - A-Reece - Take Care of Your Heart

  Jaden - Fallen
  - Nascent - Lock It Up

  `

  const expected = `<Tracklist
  tracks={[
    'A-Reece - Take Care of Your Heart',
    'Jaden - Fallen',
    'Nascent - Lock It Up',
  ]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})

test('escapes single quotes in track names', () => {
  const input = `- Artist - Track with 'quotes'
- Another Artist - Don't Stop`

  const expected = `<Tracklist
  tracks={[
    'Artist - Track with \\'quotes\\'',
    'Another Artist - Don\\'t Stop',
  ]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})

test('handles empty input', () => {
  const input = ''
  const expected = `<Tracklist
  tracks={[]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})

test('handles input with only headers and whitespace', () => {
  const input = `#	Artist	Track Title


  `

  const expected = `<Tracklist
  tracks={[]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})

test('handles complex DJ software export with many tracks', () => {
  const input = `#	Artist	Track Title
1	SCNTST	THPS 96
2	SCNTST	untitled238
3	Lone	Sunken
4	Jazzuelle	Latitudes
5	HTRK	Venter - HTRK Remix
6	Patricia	Room
7	Eyedress	Jealous (King Krule Nothing Special Remix)
8	Moderat	The Mark (Interlude)
9	Bop	Untitled Pattern 52
10	Louf	Early`

  const expected = `<Tracklist
  tracks={[
    'SCNTST - THPS 96',
    'SCNTST - untitled238',
    'Lone - Sunken',
    'Jazzuelle - Latitudes',
    'HTRK - Venter - HTRK Remix',
    'Patricia - Room',
    'Eyedress - Jealous (King Krule Nothing Special Remix)',
    'Moderat - The Mark (Interlude)',
    'Bop - Untitled Pattern 52',
    'Louf - Early',
  ]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})

test('handles malformed DJ software export gracefully', () => {
  const input = `#	Artist	Track Title
1	SCNTST
2	SCNTST	untitled238
3		Sunken
4	Jazzuelle	Latitudes`

  const expected = `<Tracklist
  tracks={[
    'SCNTST - untitled238',
    'Jazzuelle - Latitudes',
  ]}
/>`

  expect(extractTracklistAsJSXstring(input)).toBe(expected)
})
