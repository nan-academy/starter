import { serve } from "https://deno.land/std@0.90.0/http/server.ts";

const { env, writeTextFile } = Deno

const PORT = Number(env.get('PORT')) || 7777
const NO_CONTENT = { status: 204 }
const APPEND = { append: true }

console.log(`HTTP webserver running.  Access it at:  http://localhost:${PORT}/`)

const writeLog = request => {
  const url = new URL(`http://s${request.url}`)
  const path = url.pathname.slice(1)
  const { session, name, data } = Object.fromEntries(url.searchParams)
  if (!path || !session) return
  const line = `${Date.now()}@${session}${name??''}:${data??''}\n`
  writeTextFile(`${path}.log`, line, APPEND).catch(console.error)
}

const queryLog = async request => {
  const url = new URL(`http://s${request.url}`)
  const path = url.pathname.slice(1)
  const pattern = url.searchParams.get('q')
  if (!path || !pattern) return request.respond(NO_CONTENT)
  const cmd = [
    'rg',
    '-N', // no line number
    '--no-messages',
    '--color=never',
    '-F', pattern,
    `${path}.log`,
  ]
  const output = await Deno.run({ cmd, stdout: 'piped', stderr: 'null' }).output()
  if (!output.length) return request.respond(NO_CONTENT)
  request.respond({ status: 200, body: output })
}

const serverOpts = {
  hostname: '0.0.0.0',
  port: PORT,
  certFile: env.get('CERT'),
  keyFile: env.get('KEY'),
}

for await (const request of serve(serverOpts)) {
  if (request.method === 'GET') {
    queryLog(request)
  } else {
    request.respond(NO_CONTENT)
    request.method === 'PUT' && writeLog(request)
  }
}
