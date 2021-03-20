import parseMD from './lib/mdast.js'
import { run } from './lib/run.js'

const loadAPI = async () => {
  if (globalThis.Deno)
    return {
      exit: Deno.exit,
      equal: (await import('./lib/std.assert.js')).assertEquals,
      readDir: (path) => [...Deno.readDirSync(path)].map((f) => f.name),
      readFile: Deno.readTextFile,
    }
  // if not deno, assume node
  const { readFile, readdir } = await import('fs/promises')
  return {
    exit: process.exit,
    equal: (await import('assert')).deepEqual,
    readDir: readdir,
    readFile: (path) => readFile(path, 'utf8'),
  }
}

const { equal, readDir, readFile, exit } = await loadAPI()

const getSolution = (f) => readFile(`solutions/${f}`)
const quests = (await readDir('quests')).filter((name) =>
  /^\d+\.md$/.test(name),
)

for (const name of quests) {
  const mdAst = parseMD(await readFile(`quests/${name}`))
  await run({ mdAst, getSolution, equal, exit })
}
