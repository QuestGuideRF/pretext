import {
  BODY_DEFAULT_WIDTH,
  BODY_MIN_WIDTH,
  DEFAULT_RICH_NOTE_SPECS,
  prepareRichInlineFlow,
  layoutRichNote,
  LINE_HEIGHT,
  resolveRichNoteBodyWidth,
  type RichLine,
} from './rich-note.model.ts'
type State = {
  events: {
    sliderValue: number | null
  }
  requestedWidth: number
}
const domCache = {
  root: document.documentElement,
  noteBody: getRequiredDiv('note-body'),
  widthSlider: getRequiredInput('width-slider'),
  widthValue: getRequiredSpan('width-value'),
}
const richInline = prepareRichInlineFlow(DEFAULT_RICH_NOTE_SPECS)
const st: State = {
  events: {
    sliderValue: null,
  },
  requestedWidth: BODY_DEFAULT_WIDTH,
}
let scheduledRaf: number | null = null
domCache.widthSlider.addEventListener('input', () => {
  st.events.sliderValue = Number.parseInt(domCache.widthSlider.value, 10)
  scheduleRender()
})
window.addEventListener('resize', () => scheduleRender())
scheduleRender()
function getRequiredDiv(id: string): HTMLDivElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLDivElement)) throw new Error(`#${id} не найден`)
  return element
}
function getRequiredInput(id: string): HTMLInputElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLInputElement)) throw new Error(`#${id} не найден`)
  return element
}
function getRequiredSpan(id: string): HTMLSpanElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLSpanElement)) throw new Error(`#${id} не найден`)
  return element
}
function scheduleRender(): void {
  if (scheduledRaf !== null) return
  scheduledRaf = requestAnimationFrame(function renderRichNoteDemo() {
    scheduledRaf = null
    render()
  })
}
function renderBody(lines: RichLine[]): void {
  domCache.noteBody.textContent = ''
  const fragment = document.createDocumentFragment()
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!
    const row = document.createElement('div')
    row.className = 'line-row'
    row.style.top = `${lineIndex * LINE_HEIGHT} пикселей`
    for (let fragmentIndex = 0; fragmentIndex < line.fragments.length; fragmentIndex++) {
      const part = line.fragments[fragmentIndex]!
      const element = document.createElement('span')
      element.className = part.className
      element.textContent = part.text
      if (part.leadingGap > 0) element.style.marginLeft = `${part.leadingGap} пикселей`
      row.appendChild(element)
    }
    fragment.appendChild(row)
  }
  domCache.noteBody.appendChild(fragment)
}
function render(): void {
  const viewportWidth = document.documentElement.clientWidth
  let requestedWidth = st.requestedWidth
  if (st.events.sliderValue !== null) requestedWidth = st.events.sliderValue
  const { bodyWidth, maxBodyWidth } = resolveRichNoteBodyWidth(viewportWidth, requestedWidth)
  const layout = layoutRichNote(richInline, bodyWidth)
  st.requestedWidth = bodyWidth
  st.events.sliderValue = null
  domCache.widthSlider.min = String(BODY_MIN_WIDTH)
  domCache.widthSlider.max = String(maxBodyWidth)
  domCache.widthSlider.value = String(bodyWidth)
  domCache.widthValue.textContent = `${Math.round(bodyWidth)} пикселей`
  domCache.root.style.setProperty('--note-width', `${layout.noteWidth} пикселей`)
  domCache.root.style.setProperty('--note-content-width', `${bodyWidth} пикселей`)
  domCache.noteBody.style.height = `${layout.noteBodyHeight} пикселей`
  renderBody(layout.lines)
}