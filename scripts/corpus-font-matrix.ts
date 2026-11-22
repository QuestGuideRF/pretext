import { writeFileSync } from 'node:fs'
import { type ChildProcess } from 'node:child_process'
import {
  acquireBrowserAutomationLock,
  createBrowserSession,
  ensurePageServer,
  getAvailablePort,
  loadPostedReport,
  type BrowserKind,
} from './browser-automation.ts'
import { startPostedReportServer } from './report-server.ts'
type CorpusMeta = {
  id: string
  language: string
  title: string
  min_width?: number
  max_width?: number
  default_width?: number
}
type CorpusSweepRow = {
  width: number
  contentWidth: number
  predictedHeight: number
  actualHeight: number
  diffPx: number
  predictedLineCount: number
  browserLineCount: number
}
type CorpusSweepReport = {
  status: 'ready' | 'error'
  requestId?: string
  corpusId?: string
  title?: string
  rows?: CorpusSweepRow[]
  exactCount?: number
  message?: string
}
type FontVariant = {
  id: string
  label: string
  font: string
  lineHeight: number
}
type VariantResult = {
  id: string
  label: string
  font: string
  lineHeight: number
  widthCount: number
  exactCount: number
  mismatches: Array<{
    width: number
    diffPx: number
    predictedHeight: number
    actualHeight: number
  }>
}
type MatrixSummary = {
  corpusId: string
  title: string
  browser: BrowserKind
  widths: number[]
  variants: VariantResult[]
}
type MatrixOptions = {
  id: string
  browser: BrowserKind
  port: number
  timeoutMs: number
  output: string | null
  samples: number | null
  start: number
  end: number
  step: number
}
const FONT_MATRIX: Record<string, FontVariant[]> = {
  'ja-kumo-no-ito': [
    {
      id: 'default',
      label: 'Хирагино Минчо ПроН',
      font: '20 пикселей «Hiragino Mincho ProN», «Yu Mincho», «Noto Serif CJK JP», с засечками',
      lineHeight: 32,
    },
    {
      id: 'hiragino-sans',
      label: 'Хирагино Санс',
      font: '20 пикселей «Hiragino Sans», «Hiragino Mincho ProN», без засечек',
      lineHeight: 32,
    },
  ],
  'ja-rashomon': [
    {
      id: 'default',
      label: 'Хирагино Минчо ПроН',
      font: '20 пикселей «Hiragino Mincho ProN», «Yu Mincho», «Noto Serif CJK JP», с засечками',
      lineHeight: 32,
    },
    {
      id: 'hiragino-sans',
      label: 'Хирагино Санс',
      font: '20 пикселей «Hiragino Sans», «Hiragino Mincho ProN», без засечек',
      lineHeight: 32,
    },
  ],
  'ko-unsu-joh-eun-nal': [
    {
      id: 'default',
      label: 'Apple SD Готика Нео',
      font: '18 пикселей «Apple SD Gothic Neo», «Malgun Gothic», «Noto Sans CJK KR», без засечек',
      lineHeight: 30,
    },
    {
      id: 'myungjo',
      label: 'AppleMyungjo',
      font: '18 пикселей «AppleMyungjo», «Apple SD Gothic Neo», с засечками',
      lineHeight: 30,
    },
  ],
  'zh-zhufu': [
    {
      id: 'default',
      label: 'Сонгти СК',
      font: '20 пикселей «Songti SC», «PingFang SC», «Noto Serif CJK SC», с засечками',
      lineHeight: 32,
    },
    {
      id: 'pingfang-sc',
      label: 'Пингфанг СК',
      font: '20 пикселей «PingFang SC», «Songti SC», без засечек',
      lineHeight: 32,
    },
  ],
  'zh-guxiang': [
    {
      id: 'default',
      label: 'Сонгти СК',
      font: '20 пикселей «Songti SC», «PingFang SC», «Noto Serif CJK SC», с засечками',
      lineHeight: 32,
    },
    {
      id: 'pingfang-sc',
      label: 'Пингфанг СК',
      font: '20 пикселей «PingFang SC», «Songti SC», без засечек',
      lineHeight: 32,
    },
  ],
  'th-nithan-vetal-story-1': [
    {
      id: 'default',
      label: 'Thonburi',
      font: '20 пикселей «Тхонбури», «Noto Sans Thai», без засечек',
      lineHeight: 32,
    },
    {
      id: 'ayuthaya',
      label: 'Ayuthaya',
      font: '20 пикселей «Аютайя», «Тхонбури», с засечками',
      lineHeight: 32,
    },
  ],
  'th-nithan-vetal-story-7': [
    {
      id: 'default',
      label: 'Thonburi',
      font: '20 пикселей «Тхонбури», «Noto Sans Thai», без засечек',
      lineHeight: 32,
    },
    {
      id: 'ayuthaya',
      label: 'Ayuthaya',
      font: '20 пикселей «Аютайя», «Тхонбури», с засечками',
      lineHeight: 32,
    },
  ],
  'my-cunning-heron-teacher': [
    {
      id: 'default',
      label: 'Мьянма Миннесота',
      font: '20 пикселей «Мьянма Миннесота», «Мьянма Сангам Миннесота», «Noto Sans Myanmar», с засечками',
      lineHeight: 32,
    },
    {
      id: 'myanmar-sangam',
      label: 'Мьянма Сангам Миннесота',
      font: '20 пикселей «Мьянма Сангам Миннесота», «Мьянма Миннесота», с засечками',
      lineHeight: 32,
    },
    {
      id: 'noto-sans',
      label: 'Ното Санс Мьянма',
      font: '20 пикселей «Noto Sans Myanmar», «Myanmar MN», без засечек',
      lineHeight: 32,
    },
  ],
  'my-bad-deeds-return-to-you-teacher': [
    {
      id: 'default',
      label: 'Мьянма Миннесота',
      font: '20 пикселей «Мьянма Миннесота», «Мьянма Сангам Миннесота», «Noto Sans Myanmar», с засечками',
      lineHeight: 32,
    },
    {
      id: 'myanmar-sangam',
      label: 'Мьянма Сангам Миннесота',
      font: '20 пикселей «Мьянма Сангам Миннесота», «Мьянма Миннесота», с засечками',
      lineHeight: 32,
    },
    {
      id: 'noto-sans',
      label: 'Ното Санс Мьянма',
      font: '20 пикселей «Noto Sans Myanmar», «Myanmar MN», без засечек',
      lineHeight: 32,
    },
  ],
  'km-prachum-reuang-preng-khmer-volume-7-stories-1-10': [
    {
      id: 'default',
      label: 'Кхмер Сангам Миннесота',
      font: '20 пикселей «Кхмер Сангам Миннесота», «Кхмер Миннесота», «Ното без кхмерского», с засечками',
      lineHeight: 32,
    },
    {
      id: 'khmer-mn',
      label: 'Кхмер Миннесота',
      font: '20 пикселей «Кхмер Миннесота», «Кхмер Сангам Миннесота», с засечками',
      lineHeight: 32,
    },
  ],
  'hi-eidgah': [
    {
      id: 'default',
      label: 'Кохинор Деванагари',
      font: '20 пикселей «Кохинор Деванагари», «Ното с засечками Деванагари», с засечками',
      lineHeight: 32,
    },
    {
      id: 'sangam',
      label: 'Деванагари Сангам Миннесота',
      font: '20 пикселей «Деванагари Сангам МН», «Кохинор Деванагари», засечка',
      lineHeight: 32,
    },
    {
      id: 'itf',
      label: 'ITF Деванагари',
      font: '20 пикселей «ITF Деванагари», «Кохинор Деванагари», с засечками',
      lineHeight: 32,
    },
  ],
  'ar-risalat-al-ghufran-part-1': [
    {
      id: 'default',
      label: 'Гиза Про',
      font: '20 пикселей «Geeza Pro», «Noto Naskh Arab», «Arial», с засечками',
      lineHeight: 34,
    },
    {
      id: 'sf-arabic',
      label: 'Сан-Франциско арабский',
      font: '20 пикселей «SF арабский», «Edge Pro», с засечками',
      lineHeight: 34,
    },
    {
      id: 'arial',
      label: 'Ариал арабский',
      font: '20 пикселей «Arial», «Geeza Pro», с засечками',
      lineHeight: 34,
    },
  ],
  'he-masaot-binyamin-metudela': [
    {
      id: 'default',
      label: 'Таймс Нью Роман',
      font: '20 пикселей «Times New Roman», «Noto Serif Jewish», с засечками',
      lineHeight: 32,
    },
    {
      id: 'sf-hebrew',
      label: 'Сан-Франциско иврит',
      font: '20 пикселей «SF Еврейский», «Times New Roman», с засечками',
      lineHeight: 32,
    },
  ],
  'ur-chughd': [
    {
      id: 'default',
      label: 'Ното Насталик урду',
      font: '20 пикселей «Noto Graphic Urdu», «DecoType Graphic Urdu UI», «Geeza Pro», с засечками',
      lineHeight: 38,
    },
    {
      id: 'geeza-pro',
      label: 'Гиза Про',
      font: '20 пикселей «Geeza Pro», «Noto Nastaliq Urdu», с засечками',
      lineHeight: 34,
    },
  ],
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
function parseOptionalNumberFlag(name: string): number | null {
  const raw = parseStringFlag(name)
  if (raw === null) return null
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Недопустимое значение для --${name}: ${raw}.`)
  }
  return parsed
}
function parseBrowser(value: string | null): BrowserKind {
  const browser = (value ?? process.env['CORPUS_CHECK_BROWSER'] ?? 'chrome').toLowerCase()
  if (browser !== 'chrome' && browser !== 'safari') {
    throw new Error(`Неподдерживаемый браузер ${browser}; ожидаемый хром или сафари`)
  }
  return browser
}
async function loadSources(): Promise<CorpusMeta[]> {
  return await Bun.file('corpora/sources.json').json()
}
function parseOptions(): MatrixOptions {
  const id = parseStringFlag('id')
  if (id === null) {
    throw new Error(`Отсутствует --id. Доступные корпуса: ${Object.keys(FONT_MATRIX).join(', ')}`)
  }
  const samples = parseOptionalNumberFlag('samples')
  const start = parseNumberFlag('start', 300)
  const end = parseNumberFlag('end', 900)
  const step = parseNumberFlag('step', 10)
  if (step <= 0) throw new Error('--шаг должен быть > 0')
  if (end < start) throw new Error('--end должен быть >= --start')
  return {
    id,
    browser: parseBrowser(parseStringFlag('browser')),
    port: parseNumberFlag('port', Number.parseInt(process.env['CORPUS_CHECK_PORT'] ?? '0', 10)),
    timeoutMs: parseNumberFlag('timeout', Number.parseInt(process.env['CORPUS_CHECK_TIMEOUT_MS'] ?? '180000', 10)),
    output: parseStringFlag('output'),
    samples,
    start,
    end,
    step,
  }
}
function getSweepWidths(meta: CorpusMeta, options: MatrixOptions): number[] {
  const min = Math.max(options.start, meta.min_width ?? options.start)
  const max = Math.min(options.end, meta.max_width ?? options.end)
  if (options.samples !== null) {
    const samples = options.samples
    if (samples <= 1) return [Math.round((min + max) / 2)]
    const sampled = new Set<number>()
    for (let i = 0; i < samples; i++) {
      const ratio = i / (samples - 1)
      sampled.add(Math.round(min + (max - min) * ratio))
    }
    return [...sampled].sort((a, b) => a - b)
  }
  const widths: number[] = []
  for (let width = min; width <= max; width += options.step) {
    widths.push(width)
  }
  return widths
}
function bucketMismatches(mismatches: VariantResult['mismatches']): string {
  if (mismatches.length === 0) return 'exact'
  const buckets = new Map<number, number[]>()
  for (const mismatch of mismatches) {
    const list = buckets.get(mismatch.diffPx)
    if (list === undefined) {
      buckets.set(mismatch.diffPx, [mismatch.width])
    } else {
      list.push(mismatch.width)
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([diffPx, widths]) => `${diffPx > 0 ? '+' : ''}${diffPx}пикселей: ${widths.join(', ')}`)
    .join(' | ')
}
function printSummary(summary: MatrixSummary): void {
  console.log(`${summary.corpusId} — ${summary.title}`)
  console.log(`ширина: ${summary.widths.join(', ')}`)
  for (const variant of summary.variants) {
    console.log(`  ${variant.label}: ${variant.exactCount}/${variant.widthCount} точно | ${variant.mismatches.length} ненулевое значение`)
    console.log(`    ${bucketMismatches(variant.mismatches)}`)
  }
}
const options = parseOptions()
options.port = await getAvailablePort(options.port === 0 ? null : options.port)
const sources = await loadSources()
const meta = sources.find(source => source.id === options.id)
if (meta === undefined) {
  throw new Error(`Неизвестный корпус ${options.id}. Доступные корпуса: ${sources.map(source => source.id).join(', ')}`)
}
const variants = FONT_MATRIX[options.id]
if (variants === undefined) {
  throw new Error(`No font matrix configured for ${options.id}. Available corpora: ${Object.keys(FONT_MATRIX).join(', ')}`)
}
const widths = getSweepWidths(meta, options)
const lock = await acquireBrowserAutomationLock(options.browser)
const session = createBrowserSession(options.browser)
let serverProcess: ChildProcess | null = null
try {
  const pageServer = await ensurePageServer(options.port, '/corpus', process.cwd())
  serverProcess = pageServer.process
  const baseUrl = `${pageServer.baseUrl}/корпус`
  const variantResults: VariantResult[] = []
  for (const variant of variants) {
    const requestId = `${Date.now()}-${variant.id}-${Math.random().toString(36).slice(2)}`
    const reportServer = await startPostedReportServer<CorpusSweepReport>(requestId)
    const url =
      `${baseUrl}?id=${encodeURIComponent(meta.id)}` +
      `&widths=${encodeURIComponent(widths.join(','))}` +
      `&отчет=1` +
      `&requestId=${encodeURIComponent(requestId)}` +
      `&font=${encodeURIComponent(variant.font)}` +
      `&lineHeight=${variant.lineHeight}` +
      `&reportEndpoint=${encodeURIComponent(reportServer.endpoint)}`
    const report = await (async () => {
      try {
        return await loadPostedReport(
          session,
          url,
          () => reportServer.waitForReport(null),
          requestId,
          options.browser,
          options.timeoutMs,
        )
      } finally {
        reportServer.close()
      }
    })()
    if (report.status === 'error') {
      throw new Error(`Страница корпуса возвратила ошибку для ${meta.id} (${variant.id}): ${report.message ?? 'unknown error'}`)
    }
    if (report.rows === undefined) {
      throw new Error(`В отчете матрицы шрифтов корпуса отсутствуют строки для ${meta.id} (${variant.id})`)
    }
    const mismatches: VariantResult['mismatches'] = report.rows
      .filter(row => Math.round(row.diffPx) !== 0)
      .map(row => ({
        width: row.width,
        diffPx: Math.round(row.diffPx),
        predictedHeight: Math.round(row.predictedHeight),
        actualHeight: Math.round(row.actualHeight),
      }))
    const exactCount = report.exactCount ?? (report.rows.length - mismatches.length)
    variantResults.push({
      id: variant.id,
      label: variant.label,
      font: variant.font,
      lineHeight: variant.lineHeight,
      widthCount: report.rows.length,
      exactCount,
      mismatches,
    })
  }
  const summary: MatrixSummary = {
    corpusId: meta.id,
    title: meta.title,
    browser: options.browser,
    widths,
    variants: variantResults,
  }
  printSummary(summary)
  if (options.output !== null) {
    writeFileSync(options.output, JSON.stringify(summary, null, 2))
    console.log(`написал ${options.output}`)
  }
} finally {
  session.close()
  serverProcess?.kill()
  lock.release()
}