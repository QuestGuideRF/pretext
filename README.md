# Pretext

Чистая библиотека на JavaScript/TypeScript для измерения и раскладки многострочного текста. Быстрая, точная и поддерживает языки, о которых вы, возможно, даже не задумывались. Позволяет рендерить в DOM, Canvas, SVG и в будущем на сервере.

Pretext избавляет от необходимости измерять DOM (например, через `getBoundingClientRect` или `offsetHeight`), что вызывает перерасчёт layout, одну из самых дорогих операций в браузере. Вместо этого библиотека реализует собственную логику измерения текста, используя встроенный шрифтовой движок браузера как источник истины.

## Установка

```sh
npm install @chenglou/pretext
```

## Демо

Склонируйте репозиторий, выполните `bun install`, затем `bun start` и откройте `/demos` в браузере (без завершающего слеша: у dev-сервера Bun с этим бывают баги).
Также можно посмотреть живые примеры на [chenglou.me/pretext](https://chenglou.me/pretext/). Ещё несколько демо есть на [somnai-dreams.github.io/pretext-demos](https://somnai-dreams.github.io/pretext-demos/)

## API

Pretext покрывает 2 сценария использования:

### 1. Измерить высоту абзаца, вообще не трогая DOM

```ts
import { prepare, layout } from '@chenglou/pretext'

const prepared = prepare('AGI жҐе¤©е€°дє†. ШЁШЇШЈШЄ Ш§Щ„Ш±Ш­Щ„Ш© рџљЂвЂЋ', '16px Inter')
const { height, lineCount } = layout(prepared, textWidth, 20) // чистая арифметика, без DOM layout и reflow
```

`prepare()` выполняет одноразовую работу: нормализует пробелы, сегментирует текст, применяет правила склейки, измеряет сегменты через canvas и возвращает непрозрачный handle. `layout()` после этого работает по дешёвому горячему пути: только арифметика поверх закэшированных ширин. Не запускайте `prepare()` повторно для одного и того же текста и конфигурации, иначе пропадёт смысл предварительных вычислений. Например, при ресайзе нужно повторно вызывать только `layout()`.

Если вам нужен текст в стиле `textarea`, где обычные пробелы, табы `\t` и переводы строки `\n` должны оставаться видимыми, передайте `{ whiteSpace: 'pre-wrap' }` в `prepare()`:

```ts
const prepared = prepare(textareaValue, '16px Inter', { whiteSpace: 'pre-wrap' })
const { height } = layout(prepared, textareaWidth, 20)
```

Согласно текущему зафиксированному снимку бенчмарков:
- `prepare()` занимает около `19ms` на общем батче из 500 текстов
- `layout()` занимает около `0.09ms` на том же батче

Мы поддерживаем практически любые языки, включая эмодзи и смешанный bidi-текст, и учитываем специфические особенности браузеров.

Возвращаемая высота закрывает критически важный кусок для веб-интерфейсов:
- корректная виртуализация/occlusion без приблизительных оценок и лишнего кэширования
- сложные пользовательские раскладки: masonry, JS-реализации наподобие flexbox, точечная правка layout-значений без CSS-хаков и т.д.
- проверка интерфейса на этапе разработки, особенно при AI-генерации, чтобы, например, подписи на кнопках не переносились на следующую строку без запуска браузера
- предотвращение layout shift, когда подгружается новый текст и нужно заново привязать позицию скролла

### 2. Самостоятельно раскладывать строки абзаца вручную

Вместо `prepare` используйте `prepareWithSegments`, а затем:

- `layoutWithLines()` возвращает все строки для фиксированной ширины:

```ts
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

const prepared = prepareWithSegments('AGI жҐе¤©е€°дє†. ШЁШЇШЈШЄ Ш§Щ„Ш±Ш­Щ„Ш© рџљЂ', '18px "Helvetica Neue"')
const { lines } = layoutWithLines(prepared, 320, 26) // максимальная ширина 320px, высота строки 26px
for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i].text, 0, i * 26)
```

- `walkLineRanges()` даёт ширины строк и курсоры без сборки текстовых строк:

```ts
let maxW = 0
walkLineRanges(prepared, 320, line => { if (line.width > maxW) maxW = line.width })
// maxW теперь содержит ширину самой широкой строки — это минимальная ширина контейнера, в которую всё ещё помещается текст
```

- `layoutNextLine()` позволяет раскладывать текст по одной строке, если ширина меняется на ходу:

```ts
let cursor = { segmentIndex: 0, graphemeIndex: 0 }
let y = 0

// Обтекание текста вокруг плавающего изображения: строки рядом с ним уже
while (true) {
  const width = y < image.bottom ? columnWidth - image.width : columnWidth
  const line = layoutNextLine(prepared, cursor, width)
  if (line === null) break
  ctx.fillText(line.text, 0, y)
  cursor = line.end
  y += 26
}
```

Такой сценарий позволяет рендерить в canvas, SVG, WebGL и в будущем на сервере.

Если для ручной раскладки нужен небольшой помощник для смешанных inline-фрагментов, атомарных плашек и браузероподобного схлопывания пробелов на границах, есть экспериментальный alpha-пакет `@chenglou/pretext/inline-flow`. Он намеренно ограничен только inline-сценариями и режимом `white-space: normal`:

```ts
import { prepareInlineFlow, walkInlineFlowLines } from '@chenglou/pretext/inline-flow'

const prepared = prepareInlineFlow([
  { text: 'Ship ', font: '500 17px Inter' },
  { text: '@maya', font: '700 12px Inter', break: 'never', extraWidth: 22 },
  { text: "'s rich-note", font: '500 17px Inter' },
])

walkInlineFlowLines(prepared, 320, line => {
  // каждый фрагмент сохраняет индекс исходного элемента, срез текста, gapBefore и курсоры
})
```

Он намеренно узкий по возможностям:
- на вход подаётся сырой текст, включая пробелы по краям
- `extraWidth` полностью контролируется вызывающим кодом для padding/border и прочего визуального chrome
- `break: 'never'` делает элемент атомарным, как chip
- нет вложенного дерева разметки, нет `pre-wrap`, нет попытки стать универсальным CSS-движком inline-форматирования

### Сводка API

API для сценария 1:
```ts
prepare(text: string, font: string, options?: { whiteSpace?: 'normal' | 'pre-wrap' }): PreparedText // одноразовый проход анализа и измерения текста, возвращает непрозрачное значение для передачи в `layout()`. Убедитесь, что `font` синхронизирован с вашим CSS-сокращением `font` (например, размер, насыщенность, стиль, семейство) для измеряемого текста. Формат `font` такой же, как для `myCanvasContext.font = ...`, например `16px Inter`.
layout(prepared: PreparedText, maxWidth: number, lineHeight: number): { height: number, lineCount: number } // вычисляет высоту текста для заданной максимальной ширины и `lineHeight`. Убедитесь, что `lineHeight` синхронизирован с вашим CSS `line-height` для измеряемого текста.
```

API для сценария 2:
```ts
prepareWithSegments(text: string, font: string, options?: { whiteSpace?: 'normal' | 'pre-wrap' }): PreparedTextWithSegments // то же, что `prepare()`, но возвращает более богатую структуру для ручной раскладки строк
layoutWithLines(prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number): { height: number, lineCount: number, lines: LayoutLine[] } // высокоуровневый API для ручной раскладки. Принимает одну фиксированную максимальную ширину для всех строк. Похож на `layout()`, но дополнительно возвращает информацию о строках
walkLineRanges(prepared: PreparedTextWithSegments, maxWidth: number, onLine: (line: LayoutLineRange) => void): number // низкоуровневый API для ручной раскладки. Принимает одну фиксированную максимальную ширину для всех строк. Вызывает `onLine` для каждой строки, передавая фактическую ширину и курсоры начала/конца, не собирая текст строки. Особенно полезно, когда нужно спекулятивно проверить несколько границ ширины и высоты, например двоичным поиском подобрать красивую ширину, многократно вызывая walkLineRanges и проверяя, что количество строк, а значит и высота, тоже получается удачным. После этого можно один раз вызвать `layoutWithLines` с выбранной шириной и получить финальные строки.
measureNaturalWidth(prepared: PreparedTextWithSegments): number // helper для intrinsic-width в ручных раскладках. Возвращает ширину самой широкой принудительной строки, когда переносы вызваны не ограничением ширины
layoutNextLine(prepared: PreparedTextWithSegments, start: LayoutCursor, maxWidth: number): LayoutLine | null // API в стиле итератора для раскладки каждой строки со своей шириной. Возвращает `LayoutLine`, начиная с `start`, или `null`, когда абзац закончился. Передавайте `end` предыдущей строки как следующий `start`.
type LayoutLine = {
  text: string // полный текст этой строки, например 'hello world'
  width: number // измеренная ширина строки, например 87.5
  start: LayoutCursor // включительный курсор начала в подготовленных сегментах/графемах
  end: LayoutCursor // исключительный курсор конца в подготовленных сегментах/графемах
}
type LayoutLineRange = {
  width: number // измеренная ширина строки, например 87.5
  start: LayoutCursor // включительный курсор начала в подготовленных сегментах/графемах
  end: LayoutCursor // исключительный курсор конца в подготовленных сегментах/графемах
}
type LayoutCursor = {
  segmentIndex: number // индекс сегмента в богатом потоке сегментов из prepareWithSegments
  graphemeIndex: number // индекс графемы внутри сегмента; `0` на границах сегментов
}
```

Экспериментальный sidecar `inline-flow`:
```ts
prepareInlineFlow(items: InlineFlowItem[]): PreparedInlineFlow // компилирует сырые inline-элементы с исходным текстом. Компилятор управляет схлопыванием пробелов между элементами и кэширует естественную ширину каждого элемента
layoutNextInlineFlowLine(prepared: PreparedInlineFlow, maxWidth: number, start?: InlineFlowCursor): InlineFlowLine | null // потоково раскладывает по одной строке через последовательность inline-элементов
walkInlineFlowLines(prepared: PreparedInlineFlow, maxWidth: number, onLine: (line: InlineFlowLine) => void): number // низкоуровневый обходчик строк для потока inline-фрагментов
measureInlineFlow(prepared: PreparedInlineFlow, maxWidth: number, lineHeight: number): { height: number, lineCount: number } // счётчик строк для потока inline-фрагментов
type InlineFlowItem = {
  text: string // сырой авторский текст, включая схлопываемые пробелы по краям
  font: string // canvas font shorthand для этого элемента
  break?: 'normal' | 'never' // `never` сохраняет элемент атомарным, как chip
  extraWidth?: number // дополнительная горизонтальная ширина, принадлежащая вызывающему коду, например padding + border
}
type InlineFlowCursor = {
  itemIndex: number
  segmentIndex: number
  graphemeIndex: number
}
type InlineFlowFragment = {
  itemIndex: number // индекс обратно в исходный массив InlineFlowItem
  text: string
  gapBefore: number // схлопнутый промежуток перед этим фрагментом на строке
  occupiedWidth: number // ширина текста плюс extraWidth
  start: LayoutCursor
  end: LayoutCursor
}
type InlineFlowLine = {
  fragments: InlineFlowFragment[]
  width: number
  end: InlineFlowCursor
}
```

Другие helper-функции:
```ts
clearCache(): void // очищает общие внутренние кэши Pretext, которые используются в prepare() и prepareWithSegments(). Полезно, если приложение перебирает много разных шрифтов или вариантов текста и вы хотите освободить накопленный кэш
setLocale(locale?: string): void // необязательно (по умолчанию используется текущая локаль). Задаёт локаль для будущих вызовов prepare() и prepareWithSegments(). Внутри также вызывает clearCache(). Новая локаль не влияет на уже созданные состояния prepare() и prepareWithSegments()
```

## Ограничения

Pretext пока не пытается быть полноценным движком рендеринга шрифтов. Сейчас библиотека ориентируется на распространённую конфигурацию текста:
- `white-space: normal`
- `word-break: normal`
- `overflow-wrap: break-word`
- `line-break: auto`
- Если передать `{ whiteSpace: 'pre-wrap' }`, обычные пробелы, табы `\t` и жёсткие переводы строк `\n` сохраняются вместо схлопывания. Табуляция следует браузерному значению по умолчанию `tab-size: 8`. Остальные правила переноса остаются прежними: `word-break: normal`, `overflow-wrap: break-word` и `line-break: auto`.
- `system-ui` небезопасен для точности `layout()` на macOS. Используйте именованный шрифт.
- Так как конфигурация по умолчанию включает `overflow-wrap: break-word`, на очень узких ширинах слова всё ещё могут переноситься внутри, но только по границам графем.

## Разработка

Команды разработки перечислены в [package.json](package.json), а расположение основных компонентов описано в [AGENTS.md](AGENTS.md).

## Происхождение

На архитектуру Pretext повлиял [text-layout](https://github.com/chenglou/text-layout). Библиотека использует измерение текста через Canvas и потоковую раскладку строк. Подход к двунаправленному тексту восходит к pdf.js.

## Текстовые корпуса и диагностика

Файлы из `corpora/` нужны для сравнения переноса строк на разных языках и письменностях. В наборе есть длинные литературные отрывки, а `mixed-app-text.txt` содержит специально подобранные URL, смешанное направление письма, эмодзи и разные виды пробелов. Источники и метаданные перечислены в [corpora/sources.json](corpora/sources.json).

Сводка и снимки измерений находятся в [corpora/dashboard.json](corpora/dashboard.json), `corpora/representative.json`, `corpora/chrome-sampled.json`, `corpora/chrome-step10.json` и `accuracy/`. Страница корпуса доступна по `/corpus?id=<id>`.

~~~bash
bun run status-dashboard
bun run corpus-check --id=ja-rashomon 300 600 800
bun run corpus-sweep --id=zh-guxiang --start=300 --end=900 --step=10
bun run corpus-font-matrix --id=zh-zhufu --samples=5
bun run corpus-taxonomy --id=ja-rashomon 330 450
~~~

Обычные контрольные ширины — 300, 600 и 800 px. `--samples=n` выбирает ровно распределённые ширины, `--step=10` задаёт полный проход с шагом 10. Исторические команды `gatsby-check` и `gatsby-sweep` направляются на корпус `en-gatsby-opening`.

### Категории расхождений

| Категория | Что проверить |
| --- | --- |
| `corpus-dirty` | Заголовки, разметку и посторонние символы в исходном тексте. |
| `normalization` | Пробелы, управляющие символы и преобразования текста до измерения. |
| `boundary-discovery` | Границы сегментов и разрешённые места переноса. |
| `glue-policy` | Правила объединения пунктуации и соседних сегментов. |
| `edge-fit` | Округление и пограничное решение при укладке строки в заданную ширину. |
| `shaping-context` | Изменение метрик символов из-за соседних графем. |
| `font-mismatch` | Семейство, начертание и запасные шрифты. |
| `diagnostic-sensitivity` | Реакцию метрики на способ диагностики и изменения среды. |

Подпись относится к текущей версии проекта.

---

Автор: legenda  
Telegram: [@LEGENDA_SD](https://t.me/LEGENDA_SD)
