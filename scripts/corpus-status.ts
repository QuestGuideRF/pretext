import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
type BrowserKind = 'chrome' | 'safari' | 'firefox'
type AccuracySnapshot = {
  total?: number
  matchCount?: number
  mismatchCount?: number
}
type RepresentativeRow = {
  corpusId: string
  width: number
  diffPx: number
}
type RepresentativeSnapshot = {
  browsers: Partial<Record<BrowserKind, {
    rows: RepresentativeRow[]
  }>>
}
type SweepSummary = {
  corpusId: string
  language: string
  title: string
  widthCount: number
  exactCount: number
}
type AnchorSummary = {
  exactWidths: number[]
  mismatches: Array<{
    width: number
    diffPx: number
  }>
}
type CorpusDashboardMeta = {
  id: string
  notes: string
}
type FineSweepNote = {
  corpusId: string
  result:
    | { kind: 'exact_count', exactCount: number, widthCount: number }
    | { kind: 'not_fully_mapped', label: string }
  notes: string
}
type FontMatrixNote = {
  corpusId: string
  status: string
  notes: string
}
const PRODUCT_SHAPED: CorpusDashboardMeta[] = [
  {
    id: 'mixed-app-text',
    notes: 'оставшиеся промахи `710px` только для Chrome являются SHY/чувствительными к экстрактору; Safari снова точен по высоте/количеству строк.',
  },
]
const LONG_FORM: CorpusDashboardMeta[] = [
  {
    id: 'en-gatsby-opening',
    notes: 'длинная канарейка из наследия Гэтсби; широкое отрицательное поле узкой ширины с одним локальным положительным переворотом',
  },
  {
    id: 'ja-kumo-no-ito',
    notes: 'вторая японская канарейка; такое же широкое однолинейное поле с положительным краем, что и у `羅生門`, но меньшего размера.',
  },
  {
    id: 'ja-rashomon',
    notes: 'настоящая японская канарейка; оставшееся поле в основном представляет собой сжатие открывающих кавычек/пунктуации плюс несколько подгонок по краям в одну строку.',
  },
  {
    id: 'ko-unsu-joh-eun-nal',
    notes: 'Корейский грубый корпус чистый',
  },
  {
    id: 'zh-guxiang',
    notes: 'вторая китайская канарейка; такое же разделение Chrome-positive/Safari-clean, как и `祝福`, но в целом немного более здоровое',
  },
  {
    id: 'zh-zhufu',
    notes: 'настоящая китайская канарейка; широкое положительное однострочное поле в Chrome, точные привязки Safari',
  },
  {
    id: 'th-nithan-vetal-story-1',
    notes: 'два оставшихся грубых промаха в одну строку',
  },
  {
    id: 'th-nithan-vetal-story-7',
    notes: 'вторая тайская канарейка остается здоровой',
  },
  {
    id: 'km-prachum-reuang-preng-khmer-volume-7-stories-1-10',
    notes: 'full `step=10` is slower; sampled check is the preferred first pass',
  },
  {
    id: 'my-cunning-heron-teacher',
    notes: 'настоящая остаточная канарейка из Мьянмы; классы цитат/подписчиков и разрывов фраз остаются',
  },
  {
    id: 'my-bad-deeds-return-to-you-teacher',
    notes: 'более здоровый, чем первый текст из Мьянмы, но по-прежнему показывает тот же широкий класс цитата + подписка в Chrome',
  },
  {
    id: 'ur-chughd',
    notes: 'настоящая канарейка Насталик/Насх; широкое отрицательное поле при узкой ширине и локальное изменение формы/сдвиг контекста',
  },
  {
    id: 'hi-eidgah',
    notes: 'Хинди грубый корпус чистый',
  },
  {
    id: 'ar-risalat-al-ghufran-part-1',
    notes: 'Арабский грубый корпус чистый; тонкая развертка по-прежнему имеет небольшое положительное однолинейное поле',
  },
  {
    id: 'ar-al-bukhala',
    notes: 'большая вторая арабская канарейка; якоря чистые',
  },
  {
    id: 'he-masaot-binyamin-metudela',
    notes: 'Грубый корпус иврита чистый',
  },
]
const FINE_SWEEP_NOTES: FineSweepNote[] = [
  {
    corpusId: 'ar-risalat-al-ghufran-part-1',
    result: { kind: 'exact_count', exactCount: 594, widthCount: 601 },
    notes: 'оставшиеся промахи представляют собой однострочные случаи положительного соответствия краям',
  },
  {
    corpusId: 'my-cunning-heron-teacher',
    result: { kind: 'not_fully_mapped', label: 'не полностью сопоставлено на `step=1`' },
    notes: 'в настоящее время полезными контрольными индикаторами являются общие классы `350` и `690`.',
  },
  {
    corpusId: 'ur-chughd',
    result: { kind: 'not_fully_mapped', label: 'не полностью сопоставлено на `step=1`' },
    notes: 'первое несоответствие узкой ширины показывает реальную локальную ширину/сдвиг контекста, а не грязные данные',
  },
]
const FONT_MATRIX_NOTES: FontMatrixNote[] = [
  {
    corpusId: 'ja-kumo-no-ito',
    status: 'выборочная матрица имеет небольшое поле',
    notes: '«Hiragino Mincho ProN» имел «+32px» на «450px»; «Хирагино Санс» был «точно 5/5».',
  },
  {
    corpusId: 'ja-rashomon',
    status: 'выборочная матрица имеет небольшое поле',
    notes: 'Hiragino Mincho ProN показал точность 3/5; «Hiragino Sans» улучшен до «точно 4/5», но «450px» все еще промахивается.',
  },
  {
    corpusId: 'ko-unsu-joh-eun-nal',
    status: 'очистить на выборочной матрице',
    notes: '`Apple SD Gothic Neo`, `AppleMyungjo`',
  },
  {
    corpusId: 'zh-guxiang',
    status: 'выборочная матрица имеет реальное разделение шрифтов',
    notes: '«Songti SC» имел «+64px» на «300» и «+32px» на «450»; «PingFang SC» улучшил «450», но все еще не достиг «300».',
  },
  {
    corpusId: 'zh-zhufu',
    status: 'выборочная матрица имеет реальное разделение шрифтов',
    notes: '«Songti SC» показал результат «точно 3/5»; `PingFang SC` расширил положительное поле до `300/450/600`',
  },
  {
    corpusId: 'th-nithan-vetal-story-1',
    status: 'очистить на выборочной матрице',
    notes: '`Тхонбури`, `Аютайя`',
  },
  {
    corpusId: 'th-nithan-vetal-story-7',
    status: 'очистить на выборочной матрице',
    notes: '`Тхонбури`, `Аютайя`',
  },
  {
    corpusId: 'km-prachum-reuang-preng-khmer-volume-7-stories-1-10',
    status: 'очистить на выборочной матрице',
    notes: '`Кхмер Сангам МН`, `Кхмер МН`',
  },
  {
    corpusId: 'hi-eidgah',
    status: 'очистить на выборочной матрице',
    notes: '`Кохинур Деванагари`, `Деванагари Сангам МН`, `ITF Деванагари`',
  },
  {
    corpusId: 'ar-risalat-al-ghufran-part-1',
    status: 'очистить на выборочной матрице',
    notes: '`Гиза Про`, `СФ-арабский`, `Ариал`',
  },
  {
    corpusId: 'he-masaot-binyamin-metudela',
    status: 'очистить на выборочной матрице',
    notes: '«Times New Roman», «SF Jewish»',
  },
  {
    corpusId: 'my-cunning-heron-teacher',
    status: 'очистить на выборочной матрице',
    notes: '`Мьянма Миннесота`, `Мьянма Сангам Миннесота`, `Ното Санс Мьянма`',
  },
  {
    corpusId: 'my-bad-deeds-return-to-you-teacher',
    status: 'один выборочный промах',
    notes: '«Мьянма Сангам MN» имела «-32px» на «300px»; `Myanmar MN` и `Noto Sans Myanmar` остались точными.',
  },
  {
    corpusId: 'ur-chughd',
    status: 'выборочная матрица имеет очень узкое поле',
    notes: '«Ното Насталик урду» было «точно 2/5»; «Geeza Pro» улучшился до «точности 3/5», но сохранил то же узкое отрицательное поле.',
  },
]
function parseStringFlag(name: string): string | null {
  const prefix = `--${name}=`
  const arg = process.argv.find(value => value.startsWith(prefix))
  return arg === undefined ? null : arg.slice(prefix.length)
}
async function loadJson<T>(path: string): Promise<T> {
  return await Bun.file(path).json()
}
function indexRepresentativeRows(
  snapshot: RepresentativeSnapshot,
  browser: BrowserKind,
): Map<string, RepresentativeRow[]> {
  const rows = snapshot.browsers[browser]?.rows ?? []
  const byCorpus = new Map<string, RepresentativeRow[]>()
  for (const row of rows) {
    const bucket = byCorpus.get(row.corpusId)
    if (bucket === undefined) {
      byCorpus.set(row.corpusId, [row])
    } else {
      bucket.push(row)
    }
  }
  return byCorpus
}
function indexSweepSummaries(summaries: SweepSummary[]): Map<string, SweepSummary> {
  return new Map(summaries.map(summary => [summary.corpusId, summary] as const))
}
function summarizeAnchors(rows: RepresentativeRow[] | undefined): AnchorSummary | null {
  if (rows === undefined || rows.length === 0) return null
  const sorted = [...rows].sort((a, b) => a.width - b.width)
  return {
    exactWidths: sorted.filter(row => Math.round(row.diffPx) === 0).map(row => row.width),
    mismatches: sorted
      .filter(row => Math.round(row.diffPx) !== 0)
      .map(row => ({ width: row.width, diffPx: Math.round(row.diffPx) })),
  }
}
function summarizeAccuracy(snapshot: AccuracySnapshot) {
  return {
    total: snapshot.total ?? 0,
    matchCount: snapshot.matchCount ?? 0,
    mismatchCount: snapshot.mismatchCount ?? 0,
  }
}
const output = parseStringFlag('output') ?? 'corpora/dashboard.json'
const representative = await loadJson<RepresentativeSnapshot>('corpora/representative.json')
const chromeSampled = await loadJson<SweepSummary[]>('corpora/chrome-sampled.json')
const chromeStep10 = await loadJson<SweepSummary[]>('corpora/chrome-step10.json')
const chromeAccuracy = await loadJson<AccuracySnapshot>('accuracy/chrome.json')
const safariAccuracy = await loadJson<AccuracySnapshot>('accuracy/safari.json')
const firefoxAccuracy = await loadJson<AccuracySnapshot>('accuracy/firefox.json')
const chromeRepresentativeByCorpus = indexRepresentativeRows(representative, 'chrome')
const safariRepresentativeByCorpus = indexRepresentativeRows(representative, 'safari')
const sampledByCorpus = indexSweepSummaries(chromeSampled)
const step10ByCorpus = indexSweepSummaries(chromeStep10)
const dashboard = {
  generatedAt: new Date().toISOString(),
  sources: {
    accuracy: {
      chrome: 'accuracy/chrome.json',
      safari: 'accuracy/safari.json',
      firefox: 'accuracy/firefox.json',
    },
    representative: 'corpora/representative.json',
    chromeSampled: 'corpora/chrome-sampled.json',
    chromeStep10: 'corpora/chrome-step10.json',
    taxonomy: 'README.md',
  },
  browserRegressionGate: {
    chrome: summarizeAccuracy(chromeAccuracy),
    safari: summarizeAccuracy(safariAccuracy),
    firefox: summarizeAccuracy(firefoxAccuracy),
  },
  productShaped: PRODUCT_SHAPED.map(meta => {
    const sampled = sampledByCorpus.get(meta.id)
    const step10 = step10ByCorpus.get(meta.id)
    return {
      id: meta.id,
      title: step10?.title ?? sampled?.title ?? meta.id,
      language: step10?.language ?? sampled?.language ?? '',
      chromeAnchors: summarizeAnchors(chromeRepresentativeByCorpus.get(meta.id)),
      safariAnchors: summarizeAnchors(safariRepresentativeByCorpus.get(meta.id)),
      chromeSampled: sampled === undefined ? null : { exactCount: sampled.exactCount, widthCount: sampled.widthCount },
      chromeStep10: step10 === undefined ? null : { exactCount: step10.exactCount, widthCount: step10.widthCount },
      notes: meta.notes,
    }
  }),
  longForm: LONG_FORM.map(meta => {
    const sampled = sampledByCorpus.get(meta.id)
    const step10 = step10ByCorpus.get(meta.id)
    return {
      id: meta.id,
      title: step10?.title ?? sampled?.title ?? meta.id,
      language: step10?.language ?? sampled?.language ?? '',
      chromeAnchors: summarizeAnchors(chromeRepresentativeByCorpus.get(meta.id)),
      safariAnchors: summarizeAnchors(safariRepresentativeByCorpus.get(meta.id)),
      chromeSampled: sampled === undefined ? null : { exactCount: sampled.exactCount, widthCount: sampled.widthCount },
      chromeStep10: step10 === undefined ? null : { exactCount: step10.exactCount, widthCount: step10.widthCount },
      notes: meta.notes,
    }
  }),
  fineSweepNotes: FINE_SWEEP_NOTES,
  fontMatrixNotes: FONT_MATRIX_NOTES,
}
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8')
console.log(`написал ${output}`)