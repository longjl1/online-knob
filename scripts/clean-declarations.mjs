import { readdir, readFile, writeFile } from 'node:fs/promises'
// Runtime CSS is distributed once via styles.css, not alongside type declarations.
async function clean(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) await clean(path)
    else if (entry.name.endsWith('.d.ts')) {
      const source = await readFile(path, 'utf8')
      await writeFile(path, source.replace(/^import ['"][^'"]+\.css['"];?\r?\n/gm, ''))
    }
  }
}
await clean(new URL('../dist-lib/types', import.meta.url).pathname)
