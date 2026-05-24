import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateCSS } from './css'

const outPath = join(import.meta.dir, '..', 'styles', 'theme.css')
writeFileSync(outPath, generateCSS(), 'utf-8')
console.log('✓ styles/theme.css generated')
