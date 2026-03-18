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

  test('splits on ampersand', () => {
    expect(parseArtistNames('Fischer & Chloe')).toEqual(['Fischer', 'Chloe'])
  })

  test('splits on "and"', () => {
    expect(parseArtistNames('Fischer and Chloe')).toEqual(['Fischer', 'Chloe'])
  })

  test('splits on feat.', () => {
    expect(parseArtistNames('Burial feat. Four Tet')).toEqual([
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

  test('splits on ×', () => {
    expect(parseArtistNames('Burial × Four Tet')).toEqual([
      'Burial',
      'Four Tet'
    ])
  })

  test('splits on x', () => {
    expect(parseArtistNames('Burial x Four Tet')).toEqual([
      'Burial',
      'Four Tet'
    ])
  })

  test('splits on vs', () => {
    expect(parseArtistNames('Burial vs Four Tet')).toEqual([
      'Burial',
      'Four Tet'
    ])
  })

  test('handles mixed separators', () => {
    expect(
      parseArtistNames('Hurricane Dan, Fischer & Chloe feat. Burial')
    ).toEqual(['Hurricane Dan', 'Fischer', 'Chloe', 'Burial'])
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
