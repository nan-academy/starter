import parseMD from 'https://jspm.dev/mdast-util-from-markdown@0.8.4'
import { assertEquals } from "https://deno.land/std@0.90.0/testing/asserts.ts"
import { run } from './run.js'

const quests = [...Deno.readDirSync('.')]
  .filter(f => f.isFile && /^\d+\.md$/.test(f.name))

for (const { name } of quests) {
  await run({
    mdAst: parseMD(await Deno.readTextFile(name)),
    getSolution: f => Deno.readTextFile(`solutions/${f}`),
    equal: assertEquals,
  })
}