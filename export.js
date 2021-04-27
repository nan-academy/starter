import { readdirSync, readFileSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'

import parseMD from './lib/mdast.js'
import { textContent } from './lib/run.js'

const quests = readdirSync('quests').filter(f => f.endsWith('.md')).sort()

const MAX_QUEST_SIZE = 20 // reserve 20 ID per quests

const normalize = str => str
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, '-')

const type = {
  '06.md': 'dom',
  '09.md': 'node',
  '10.md': 'dom',
}

const START = 20000
let start = START, questsData = []
for (const name of quests) {
  const md = readFileSync(`quests/${name}`, 'utf-8')
  const parts = md.split('\n## ')
  const title = parts.shift()
  const questTitle = title.trim().slice(2).trim()
  const questName = normalize(questTitle)
  const language = type[name] === 'dom' ? 'dom' : 'js'
  const exerciseProcessing = parts.map(async (md, index) => {
    const [subject, testsStr] = md.split('\n### Tests')
    const exerciseTitle = subject.split('\n', 1)[0]
    const exerciseName = normalize(exerciseTitle)
    const isBonus = exerciseTitle.startsWith('🌟')

    await mkdir(`../public/subjects/${exerciseName}`,{recursive:true})
    subject.trim().includes('\n')
     && (await writeFile(`../public/subjects/${exerciseName}/README.md`, `## ${subject}`, 'utf8'))

    // generate test file
    let test
    const tests = []
    for (const node of parseMD(testsStr || '2').children) {
      if (node.type === 'heading' && node.depth === 4) {
        test && tests.push(test)
        test = { description: textContent(node) }
      } else if (test && node.type === 'code') {
        test.code = textContent(node)
      }
    }

    test && tests.push(test)

    tests.length
      && (await writeFile(`../public/js/tests/${exerciseName}.json`, JSON.stringify(tests, null, 2)))

    const ext = type[name] === 'node' ? 'mjs' : 'js'
    return {
      attrs: {
        exerciseType: isBonus ? 'optional' : undefined,
        language,
        displayName: exerciseTitle,
        expectedFiles: [`${exerciseName}.${ext}`],
      },
      name: exerciseName,
      id: start + index + 1,
      index,
    }
  })

  const exercises = await Promise.all(exerciseProcessing)

  if (exercises.length > MAX_QUEST_SIZE) {
    throw Error(`quest ${questName} has ${exercises.length} exercises (max: ${MAX_QUEST_SIZE})`)
  }

  exercises.length &&
    questsData.push({
      id: start,
      index: Number(name.slice(0, -3)),
      name: questName,
      attrs: { language, displayName: questTitle },
      exercises,
    })

  start += MAX_QUEST_SIZE
}

const INSERT_OBJECT_VALUES = questsData.flatMap(quest => [
  `\n  -- ${quest.attrs.displayName}  `,
  `(${quest.id}, '${quest.name}', 'quest', 'online', '${JSON.stringify(quest.attrs)}'::jsonb, '{}'::jsonb),`,
  ...quest.exercises.map(exercise =>
    `(${exercise.id}, '${exercise.name}', 'exercise', 'online', '${JSON.stringify(exercise.attrs)}'::jsonb, '{}'::jsonb),`)
]).join('\n  ')

const INSERT_RELATIONSHIP_VALUES = questsData.flatMap(quest => [
  `\n  -- ${quest.attrs.displayName}  `,
    `(${start}, ${quest.id}, '{}'::jsonb, '${quest.name}', ${quest.index}),`,
  ...quest.exercises.map(exercise =>
    `(${quest.id}, ${exercise.id}, '{"difficulty":1}'::jsonb, '${exercise.name}', ${exercise.index+1}),`)
]).join('\n  ')

const piscineAttrs = {
  capacity:400,
  eventDuration:36960,
  eventStartDelay:240,
  registrationDuration:43200,
  displayName: "Discovery Piscine",
}

const SQL = `
-- insert object
INSERT INTO public.object (id, name, type, status, attrs, "childrenAttrs") VALUES

  -- Discovery Piscine
  (${start}, 'discovery-piscine', 'piscine', 'online', '${JSON.stringify(piscineAttrs)}'::jsonb, '{}'::jsonb),
  ${INSERT_OBJECT_VALUES.slice(0, -1)}

ON CONFLICT ON CONSTRAINT "object_pkey"
DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  status = EXCLUDED.status,
  attrs = EXCLUDED.attrs;

-- insert relationships
INSERT INTO public.object_child ("parentId", "childId", attrs, key, index) VALUES
  ${INSERT_RELATIONSHIP_VALUES.slice(0, -1)}

ON CONFLICT ON CONSTRAINT "object_child_parentId_key_key"
DO NOTHING;
`

console.log(SQL)

// TODO manualy
// 1. execute sql on beta server
// 2. commit / push on the public repo
