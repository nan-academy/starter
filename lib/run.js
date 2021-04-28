const restore = new Set()

const children = (n) =>
  n.children ? [n, ...n.children.flatMap(children)] : [n]

export const textContent = (n) =>
  children(n)
    .filter((n) => n.value)
    .map((n) => n.value.trim())
    .join(' ') || ''

export const saveArguments = (src, key) => {
  const savedArgs = []
  const fn = src[key]
  const push = savedArgs.push.bind(savedArgs)
  src[key] = function (...args) {
    push(args)
    return fn.apply(this, args)
  }

  restore.add(() => (src[key] = fn))

  return savedArgs
}

const notFound =
  typeof Deno === 'undefined'
    ? (err) => err.code === 'ENOENT'
    : (err) => err instanceof Deno.errors.NotFound

const END = {type: 'heading', depth: 2 }
export const run = async ({ mdAst, getSolution, equal, exit = Deno.exit }) => {
  let total, title, questTitle, skip, exercise = '', testCount = 1
  const padding =
    mdAst.children
      .filter((node) => node.type === 'heading' && node.depth === 2)
      .reduce((max, node) => Math.max(max, textContent(node).length), 0) + 13

  const logs = []
  console.log = (...args) => logs.push(args)
  const fatal = (...args) => {
    title && console.info(title.padEnd(padding, `.`), '\u001b[31mFAIL\u001b[0m')
    title && console.info(`  ./${exercise}.js\n`)
    logs.forEach((args) => console.info(...args))
    console.error(...args)
    exit(1)
  }

  for (const node of [...mdAst.children,END]) {
    if (node.type === 'heading' && node.depth === 1) {
      questTitle = textContent(node)
      total = 0
    } else if (node.type === 'heading' && node.depth === 2) {
      if (!skip && testCount < 2 && exercise) {
        fatal(`Missing tests for ${exercise}`)
      }
      testCount = 0
      logs.length = 0
      const status = skip
        ? `\u001b[34mSKIP\u001b[0m missing ./${exercise}.js`
        : '\u001b[32mPASS\u001b[0m'

      title && console.info(title.padEnd(padding, '.'), status)
      if (node === END) return
      total || console.info('\n  Quest', questTitle, '\n')
      const content = textContent(node)
      title = `\u001b[33m${String(++total).padStart(
        3,
        '0',
      )}\u001b[0m ${content}`
      exercise = content
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '-')
      skip = content.startsWith('🌟')
    } else if (
      node.type === 'heading' &&
      node.depth === 3 &&
      textContent(node) === 'Tests'
    ) {
      testCount = 1
    } else if (testCount && node.type === 'heading' && node.depth === 4) {
      console.log(`  \u001b[34m#${testCount}\u001b[0m ${textContent(node)}`)
    } else if (testCount && node.type === 'code' && node.lang === 'js') {
      let code = ''
      try {
        const solution = await getSolution(`${exercise}.js`)
        skip = false
        code = node.value.includes('// Your code')
          ? node.value.replace('// Your code', solution)
          : `${solution}\n\n${node.value}`
        eval(code)
        for (const cleanup of restore) cleanup()
        restore.clear()
        console.log(`  \u001b[32mPASS\u001b[0m\n`)
        testCount++
      } catch (err) {
        if (!notFound(err)) {
          fatal('  \u001b[31mFAIL\u001b[0m', `${err.message}\n\n------ CODE:\n${code}`)
        }
        skip || fatal('missing solution for', exercise)
      }
    }
  }
}
