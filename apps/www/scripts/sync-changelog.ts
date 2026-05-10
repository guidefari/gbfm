const repoRoot = new URL('../../../', import.meta.url)
const source = Bun.file(new URL('CHANGELOG.md', repoRoot))
const target = new URL('../src/mdx/changelog.md', import.meta.url)

await Bun.write(target, await source.text())
