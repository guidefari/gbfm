import { expect, test } from 'vitest'
import { parseArtistNames } from './parse-artist-names'

test('parses credited collaborators without splitting artist names that use ordinary conjunctions', () => {
  expect(parseArtistNames('Hurricane Dan, Fischer & Chloe feat. Burial')).toEqual([
    'Hurricane Dan',
    'Fischer & Chloe',
    'Burial'
  ])
  expect(parseArtistNames('  Burial ,  Four Tet,,  ')).toEqual(['Burial', 'Four Tet'])
  expect(parseArtistNames('Burial ft Four Tet')).toEqual(['Burial', 'Four Tet'])
  expect(parseArtistNames('Burial feat. Four Tet')).toEqual(['Burial', 'Four Tet'])
  expect(parseArtistNames('Simon & Garfunkel')).toEqual(['Simon & Garfunkel'])
  expect(parseArtistNames('Florence and the Machine')).toEqual(['Florence and the Machine'])
  expect(parseArtistNames('TNGHT x Hudson Mohawke')).toEqual(['TNGHT x Hudson Mohawke'])
})
