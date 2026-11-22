import { type ChildProcess } from 'node:child_process'
import {
  acquireBrowserAutomationLock,
  createBrowserSession,
  ensurePageServer,
  getAvailablePort,
  loadHashReport,
  type BrowserKind,
} from './browser-automation.ts'
type ProbeReport = {
  status: 'ready' | 'error'
  requestId?: string
  whiteSpace?: 'normal' | 'pre-wrap'
  browserLineMethod?: 'range' | 'span'
  width?: number
  predictedHeight?: number
  actualHeight?: number
  diffPx?: number
  predictedLineCount?: number
  browserLineCount?: number
  firstBreakMismatch?: {
    line: number
    oursStart: number
    browserStart: number
    oursEnd: number
    browserEnd: number
    oursText: string
    browserText: string
    oursRenderedText: string
    browserRenderedText: string
    oursContext: string
    browserContext: string
    deltaText: string
    reasonGuess: string
    oursSumWidth: number
    oursDomWidth: number
    oursFullWidth: number
    browserDomWidth: number
    browserFullWidth: number
  } | null
  alternateBrowserLineMethod?: 'range' | 'span'
  alternateBrowserLineCount?: number
  alternateFirstBreakMismatch?: object | null
  extractorSensitivity?: string | null
  message?: string
}
function parseStringFlag(name: string): string | null {
  const prefix = `--${name}=`
  const arg = process.argv.find(value => value.startsWith(prefix))
  return arg === undefined ? null : arg.slice(prefix.length)
}
function parseNumberFlag(name: string, fallback: number): number {
  const raw = parseStringFlag(name)
  if (raw === null) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) throw new Error(`Недопустимое значение для --${name}: ${raw}.`)
  return parsed
}
function parseBrowser(value: string | null): BrowserKind {
  const browser = (value ?? process.env['PROBE_CHECK_BROWSER'] ?? 'chrome').toLowerCase()
  if (browser !== 'chrome' && browser !== 'safari') {
    throw new Error(`Неподдерживаемый браузер ${browser}; ожидаемый хром или сафари`)
  }
  return browser
}
function requireFlag(name: string): string {
  const value = parseStringFlag(name)
  if (value === null || value.length === 0) throw new Error(`Отсутствует --${name}=...`)
  return value
}
function printReport(report: ProbeReport): void {
  if (report.status === 'error') {
    console.log(`ошибка: ${report.message ?? 'unknown error'}`)
    return
  }
  console.log(
    `ширина ${report.width}: разница ${report.diffPx}px | линии ${report.predictedLineCount}/${report.browserLineCount} | высота ${report.predictedHeight}/${report.actualHeight}`,
  )
  if (report.browserLineMethod !== undefined) {
    console.log(`  метод строки браузера: ${report.browserLineMethod}`)
  }
  if (report.extractorSensitivity !== null && report.extractorSensitivity !== undefined) {
    console.log(`  чувствительность экстрактора: ${report.extractorSensitivity}`)
  }
  if (
    report.alternateBrowserLineMethod !== undefined &&
    report.alternateBrowserLineCount !== undefined
  ) {
    console.log(
      `  альтернативный метод: ${report.alternateBrowserLineMethod} (строки ${report.predictedLineCount}/${report.alternateBrowserLineCount})` +
      (report.alternateFirstBreakMismatch === null ? ' exact' : ''),
    )
  }
  if (report.firstBreakMismatch !== null && report.firstBreakMismatch !== undefined) {
    const mismatch = report.firstBreakMismatch
    console.log(`  перерыв L${mismatch.line}: ${mismatch.reasonGuess}`)
    console.log(`  смещения: наши ${mismatch.oursStart}-${mismatch.oursEnd} | браузер ${mismatch.browserStart}-${mismatch.browserEnd}`)
    console.log(`  дельта: ${JSON.stringify(mismatch.deltaText)}`)
    console.log(`  наш текст: ${JSON.stringify(mismatch.oursText)}`)
    console.log(`  текст браузера: ${JSON.stringify(mismatch.browserText)}`)
    console.log(`  наш отрендерен: ${JSON.stringify(mismatch.oursRenderedText)}`)
    console.log(`  отображается браузером: ${JSON.stringify(mismatch.browserRenderedText)}`)
    console.log(`  наш: ${mismatch.oursContext}`)
    console.log(`  браузер: ${mismatch.browserContext}`)
    console.log(
      `  ширина: наша sum/dom/full ${mismatch.oursSumWidth.toFixed(3)}/${mismatch.oursDomWidth.toFixed(3)}/${mismatch.oursFullWidth.toFixed(3)} | браузер dom/полный ${mismatch.browserDomWidth.toFixed(3)}/${mismatch.browserFullWidth.toFixed(3)}`,
    )
  }
}
const browser = parseBrowser(parseStringFlag('browser'))
const requestedPort = parseNumberFlag('port', Number.parseInt(process.env['PROBE_CHECK_PORT'] ?? '0', 10))
const text = requireFlag('text')
const width = parseNumberFlag('width', 600)
const font = parseStringFlag('font') ?? '18 пикселей с засечками'
const lineHeight = parseNumberFlag('lineHeight', 32)
const dir = parseStringFlag('dir') ?? 'ltr'
const lang = parseStringFlag('lang') ?? (dir === 'rtl' ? 'ar' : 'en')
const method = parseStringFlag('method')
const whiteSpace = parseStringFlag('whiteSpace') === 'pre-wrap' ? 'pre-wrap' : 'normal'
let serverProcess: ChildProcess | null = null
const lock = await acquireBrowserAutomationLock(browser)
const session = createBrowserSession(browser)
try {
  const port = await getAvailablePort(requestedPort === 0 ? null : requestedPort)
  const pageServer = await ensurePageServer(port, '/probe', process.cwd())
  serverProcess = pageServer.process
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const url =
    `${pageServer.baseUrl}/probe?text=${encodeURIComponent(text)}` +
    `&ширина=${width}` +
    `&font=${encodeURIComponent(font)}` +
    `&lineHeight=${lineHeight}` +
    `&dir=${encodeURIComponent(dir)}` +
    `&lang=${encodeURIComponent(lang)}` +
    `&whiteSpace=${encodeURIComponent(whiteSpace)}` +
    (method === null ? '' : `&method=${encodeURIComponent(method)}`) +
    `&requestId=${encodeURIComponent(requestId)}`
  const report = await loadHashReport<ProbeReport>(session, url, requestId, browser)
  printReport(report)
} finally {
  session.close()
  serverProcess?.kill()
  lock.release()
}