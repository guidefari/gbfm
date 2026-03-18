import { describe, expect, test } from 'vitest'
import { parseArtistNames } from './parse-artist-names'

describe('parseArtistNames', () => {
  test('single artist returns one entry', () => {
    expect(parseArtistNames('Burial')).toEqual(['Burial'])
  })

  test('splits on comma', () => {
    expect(parseArtistNames('Hurricane Dan, Fischer, Chloe')).toEqual([
      'Hurricane Dan',
      'Fischer',
      'Chloe'
    ])
  })

  test('splits on feat.', () => {
    expect(parseArtistNames('Burial feat. Four Tet')).toEqual([
      'Burial',
      'Four Tet'
    ])
  })

  test('splits on feat without dot', () => {
    expect(parseArtistNames('Burial feat Four Tet')).toEqual([
      'Burial',
      'Four Tet'
    ])
  })

  test('splits on ft.', () => {
    expect(parseArtistNames('Burial ft. Four Tet')).toEqual([
      'Burial',
      'Four Tet'
    ])
  })

  test('splits on ft without dot', () => {
    expect(parseArtistNames('Burial ft Four Tet')).toEqual([
      'Burial',
      'Four Tet'
    ])
  })

  test('does not split on ampersand', () => {
    expect(parseArtistNames('Simon & Garfunkel')).toEqual(['Simon & Garfunkel'])
  })

  test('does not split on "and"', () => {
    expect(parseArtistNames('Florence and the Machine')).toEqual([
      'Florence and the Machine'
    ])
  })

  test('does not split on x', () => {
    expect(parseArtistNames('TNGHT x Hudson Mohawke')).toEqual([
      'TNGHT x Hudson Mohawke'
    ])
  })

  test('does not split on vs', () => {
    expect(parseArtistNames('Burial vs Four Tet')).toEqual([
      'Burial vs Four Tet'
    ])
  })

  test('handles mixed separators', () => {
    expect(
      parseArtistNames('Hurricane Dan, Fischer & Chloe feat. Burial')
    ).toEqual(['Hurricane Dan', 'Fischer & Chloe', 'Burial'])
  })

  test('trims whitespace', () => {
    expect(parseArtistNames('  Burial ,  Four Tet  ')).toEqual([
      'Burial',
      'Four Tet'
    ])
  })

  test('filters empty strings', () => {
    expect(parseArtistNames('Burial,,Four Tet')).toEqual(['Burial', 'Four Tet'])
  })
})
