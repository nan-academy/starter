import http from 'http'
import https from 'https'
import { spawn } from 'child_process'
import { networkInterfaces } from 'os'
import { createWriteStream, readFileSync } from 'fs'

const logs = {}
const PORT = Number(process.env.PORT) || 7777
const APPEND = { autoClose: false, flags:'a' }
const PIPE = { stdio: [null, 'pipe', process.stderr] }
const logError = err => err && console.error(err)
const noContent = res => (res.statusCode = 204, res.end())
const hash = str => {
  let h = 0
  for (const c of str) {
    h = ((h << 5) - h) + c.charCodeAt(0)
    h = h & h
  }
  h = new DataView(new Int32Array([h]).buffer).getUint32()
  return str.slice(0, 6) + h.toString(36).padStart(6, '0').slice(1)
}
const writeLog = req => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname.slice(1)
  const { session } = Object.fromEntries(url.searchParams)
  if (!path || !session) return
  const log = logs[path] || (logs[path] = createWriteStream(`${path}.log`, APPEND))
  req.setEncoding('utf8')
  req.once('data', data => {
    const payload = data.slice(0, 8192).replace(/\r?\n|\r/g, '').trim()
    log.write(`${Date.now()}@${hash(session)}:${payload}\n`)
  })
}

const queryLog = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname.slice(1)
  const pattern = url.searchParams.get('q')
  if (!path || !pattern) return noContent(res)
  spawn('rg',
    ['-N', '--no-messages', '--color=never', '-F', pattern, `${path}.log`],
    PIPE,
  ).stdout.pipe(res)
}

const createServer = !process.env.TLS_PATH ? http.createServer :
  fn => https.createServer({
    key: readFileSync(`${process.env.TLS_PATH}-key.pem`),
    cert: readFileSync(`${process.env.TLS_PATH}-cert.pem`),
  }, fn)

const server = createServer((req, res) => {
  if (req.headers.origin !== 'https://nan-academy.github.io') {
    res.statusCode = 404
    return res.end('not-found')
  }
  console.log(req.method, req.url)
  res.setHeader('Access-Control-Allow-Methods', 'PUT, GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Origin', 'https://nan-academy.github.io')
  res.setHeader('Access-Control-Max-Age', 86400)
  try {
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8')
      queryLog(req, res)
    } else {
      noContent(res)
      if (req.method === 'PUT' || req.method === 'POST') {
        writeLog(req)
      }
    }
  } catch (err) {
    console.error(err.stack)
    if (res.writableEnded) {
      res.statusCode = err.statusCode || 500
      res.end(err.message)
    }
  }
}).listen(PORT)

// Log Networks
server.on('listening', () => {
  const details = server.address()

  if (typeof details === 'string') return console.log(details)
  const local = details?.address === '::' ? 'localhost' : details?.address
  const proto = process.env.TLS_PATH ? 'https://' : 'http://'
  console.log(`server listening on\n - ${proto}${local}:${PORT}`)
  Object.entries(networkInterfaces())
    .map(([name, interfaces]) => interfaces.map(i => [name, i]))
    .flat()
    .filter(([,i]) => i.family === 'IPv4' && !i.internal)
    .map(([name, i]) => ` - ${proto}${i.address}:${details?.port} (${name})`)
    .forEach(n => console.log(n))
})
