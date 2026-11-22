import { writeFileSync } from 'node:fs'
import { type ChildProcess } from 'node:child_process'
import {
  acquireBrowserAutomationLock,
  createBrowserSession,
  ensurePageServer,
  getAvailablePort,
  loadHashReport,
  type BrowserKind,
} from './browser-automation.ts'
type BenchmarkResult = {
  label: string
  ms: number
  desc: string
}
type CorpusBenchmarkResult = {
  id: string
  label: string
  font: string
  chars: number
  analysisSegments: number
  segments: number
  breakableSegments: number
  width: number
  lineCount: number
  analysisMs: number
  measureMs: number
  prepareMs: number
  layoutMs: number
}
type BenchmarkReport = {
  status: 'ready' | 'error'
  requestId?: string
  results?: BenchmarkResult[]
  richResults?: BenchmarkResult[]
  richPreWrapResults?: BenchmarkResult[]
  richLongResults?: BenchmarkResult[]
  corpusResults?: CorpusBenchmarkResult[]
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
  if (!Number.isFinite(parsed)) {
    throw new Error(`Недопустимое значение для --${name}: ${raw}.`)
  }
  return parsed
}
function parseBrowser(value: string | null): BrowserKind {
  const browser = (value ?? process.env['BENCHMARK_CHECK_BROWSER'] ?? 'chrome').toLowerCase()
  if (browser !== 'chrome' && browser !== 'safari') {
    throw new Error(`Неподдерживаемый браузер ${browser}; ожидаемый хром или сафари`)
  }
  return browser
}
function printReport(report: BenchmarkReport): void {
  if (report.status === 'error') {
    console.log(`ошибка: ${report.message ?? 'unknown error'}`)
    return
  }
  console.log('Пакетный тест верхнего уровня:')
  for (const result of report.results ?? []) {
    console.log(`  ${result.label}: ${result.ms < 0.01 ? '<0.01' : result.ms.toFixed(2)} мс`)
  }
  if ((report.richResults ?? []).length > 0) {
    console.log('Богатые API-интерфейсы (общий корпус):')
    for (const result of report.richResults ?? []) {
      console.log(`  ${result.label}: ${result.ms < 0.01 ? '<0.01' : result.ms.toFixed(2)} мс`)
    }
  }
  if ((report.richPreWrapResults ?? []).length > 0) {
    console.log('Богатые API-интерфейсы (напряжение фрагмента перед переносом):')
    for (const result of report.richPreWrapResults ?? []) {
      console.log(`  ${result.label}: ${result.ms < 0.01 ? '<0.01' : result.ms.toFixed(2)} мс`)
    }
  }
  if ((report.richLongResults ?? []).length > 0) {
    console.log('Богатые API-интерфейсы (арабское длинное ударение):')
    for (const result of report.richLongResults ?? []) {
      console.log(`  ${result.label}: ${result.ms < 0.01 ? '<0.01' : result.ms.toFixed(2)} мс`)
    }
  }
  if ((report.corpusResults ?? []).length > 0) {
    console.log('Длинное напряжение корпуса:')
    for (const corpus of report.corpusResults!) {
      console.log(
        `  ${corpus.label}: анализ ${corpus.analysisMs.toFixed(2)}мс | измерить ${corpus.measureMs.toFixed(2)}мс | подготовить ${corpus.prepareMs.toFixed(2)}мс | макет ${corpus.layoutMs < 0.01 ? '<0.01' : corpus.layoutMs.toFixed(2)}мс | Сегменты ${corpus.analysisSegments.toLocaleString()}→${corpus.segments.toLocaleString()} | ${corpus.lineCount} строк @ ${corpus.width} пикселей`,
      )
    }
  }
}
const browser = parseBrowser(parseStringFlag('browser'))
const requestedPort = parseNumberFlag('port', Number.parseInt(process.env['BENCHMARK_CHECK_PORT'] ?? '0', 10))
const output = parseStringFlag('output')
let serverProcess: ChildProcess | null = null
const lock = await acquireBrowserAutomationLock(browser)
const session = createBrowserSession(browser, { foreground: true })
try {
  const port = await getAvailablePort(requestedPort === 0 ? null : requestedPort)
  const pageServer = await ensurePageServer(port, '/benchmark', process.cwd())
  serverProcess = pageServer.process
  const baseUrl = `${pageServer.baseUrl}/тест`
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const url =
    `${baseUrl}?отчет=1` +
    `&requestId=${encodeURIComponent(requestId)}`
  const report = await loadHashReport<BenchmarkReport>(session, url, requestId, browser)
  printReport(report)
  if (output !== null) {
    writeFileSync(output, JSON.stringify(report, null, 2))
    console.log(`написал ${output}`)
  }
  if (report.status === 'error') {
    process.exitCode = 1
  }
} finally {
  session.close()
  serverProcess?.kill()
  lock.release()
}