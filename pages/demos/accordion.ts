import { layout, prepare, type PreparedText } from '../../src/layout.ts'
type AccordionItem = {
  id: string
  title: string
  text: string
}
type AccordionItemDom = {
  root: HTMLElement
  toggle: HTMLButtonElement
  title: HTMLSpanElement
  meta: HTMLSpanElement
  glyph: HTMLSpanElement
  body: HTMLDivElement
  inner: HTMLDivElement
  copy: HTMLParagraphElement
}
type State = {
  openItemId: string | null
  events: {
    clickedItemId: string | null
  }
}
type DomCache = {
  list: HTMLElement
  items: AccordionItemDom[]
}
const items: AccordionItem[] = [
  {
    id: 'shipping',
    title: 'Раздел 1',
    text:
      'Мина сократила примечание к выпуску до трех четких строк, а затем поняла, что предостережению поддержки все еще нужно еще одно предложение, прежде чем оно сможет выйти без сюрпризов.',
  },
  {
    id: 'ops',
    title: 'Раздел 2',
    text:
      'Документ о передаче теперь выглядит как настоящий утренний контрольный список, а не как запись в дневнике. Перезапустите воркера, проверьте слив очереди и только потом пометьте инцидент как тихий. Если отставание снова вырастет, отправьте сообщение тому же владельцу вместо того, чтобы открывать новую тему.',
  },
  {
    id: 'research',
    title: 'Раздел 3',
    text:
      'We learned the hard way that a giant native scroll range can dominate everything else. The bug looked like DOM churn, then like pooling, then like rendering pressure, until the repros were stripped down enough to show the real limit. That changed the fix completely: simplify the DOM, keep virtualization honest, and stop hiding the worst-case path behind caches that only make the common frame look cheaper.',
  },
  {
    id: 'mixed',
    title: 'Раздел 4',
    text:
      'AGI 春天到了. بدأت الرحلة 🚀 and the long URL is https://example.com/reports/q3?lang=ar&mode=full. Nora wrote “please keep 10\u202F000 rows visible,” Mina replied “trans\u00ADatlantic labels are still weird.”',
  },
]
const st: State = {
  openItemId: 'shipping',
  events: {
    clickedItemId: null,
  },
}
let domCache: DomCache | null = null
const preparedCache = {
  font: '',
  items: [] as PreparedText[],
}
let scheduledRaf: number | null = null
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLElement)) throw new Error(`#${id} не найден`)
  return element
}
function getRequiredChild<T extends Element>(
  parent: Element,
  selector: string,
  ctor: { new (): T },
): T {
  const element = parent.querySelector(selector)
  if (!(element instanceof ctor)) throw new Error(`${selector} не найден`)
  return element
}
function getAccordionItemNodes(list: HTMLElement): AccordionItemDom[] {
  const roots = Array.from(list.querySelectorAll<HTMLElement>('.accordion-item'))
  if (roots.length !== items.length) throw new Error('Несоответствие количества предметов аккордеона')
  return roots.map(root => ({
    root,
    toggle: getRequiredChild(root, '.accordion-toggle', HTMLButtonElement),
    title: getRequiredChild(root, '.accordion-title', HTMLSpanElement),
    meta: getRequiredChild(root, '.accordion-meta', HTMLSpanElement),
    glyph: getRequiredChild(root, '.accordion-glyph', HTMLSpanElement),
    body: getRequiredChild(root, '.accordion-body', HTMLDivElement),
    inner: getRequiredChild(root, '.accordion-inner', HTMLDivElement),
    copy: getRequiredChild(root, '.accordion-copy', HTMLParagraphElement),
  }))
}
function initializeStaticContent(): void {
  if (domCache === null) return
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!
    const itemDom = domCache.items[index]!
    itemDom.root.dataset['id'] = item.id
    itemDom.toggle.dataset['id'] = item.id
    itemDom.title.textContent = item.title
    itemDom.copy.textContent = item.text
  }
}
function parsePx(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}
function getFontFromStyles(styles: CSSStyleDeclaration): string {
  return styles.font.length > 0
    ? styles.font
    : `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} / ${styles.lineHeight} ${styles.fontFamily}`
}
function refreshPrepared(font: string): void {
  if (preparedCache.font === font) return
  preparedCache.font = font
  preparedCache.items = items.map(item => prepare(item.text, font))
}
function scheduleRender(): void {
  if (domCache === null) return
  if (scheduledRaf !== null) return
  scheduledRaf = requestAnimationFrame(function renderAccordionFrame(now) {
    scheduledRaf = null
    if (render(now)) scheduleRender()
  })
}
function boot(): void {
  const list = getRequiredElement('list')
  domCache = {
    list,
    items: getAccordionItemNodes(list),
  }
  initializeStaticContent()
  domCache.list.addEventListener('click', event => {
    const target = event.target
    if (!(target instanceof Element)) return
    const toggle = target.closest<HTMLButtonElement>('.accordion-toggle')
    if (toggle === null) return
    const id = toggle.dataset['id']
    if (id === undefined) return
    st.events.clickedItemId = id
    scheduleRender()
  })
  document.fonts.ready.then(() => {
    scheduleRender()
  })
  window.addEventListener('resize', () => {
    scheduleRender()
  })
  scheduleRender()
}
function render(_now: number): boolean {
  if (domCache === null) return false
  const firstCopy = domCache.items[0]?.copy
  const firstInner = domCache.items[0]?.inner
  if (firstCopy === undefined || firstInner === undefined) return false
  const copyStyles = getComputedStyle(firstCopy)
  const innerStyles = getComputedStyle(firstInner)
  const font = getFontFromStyles(copyStyles)
  const lineHeight = parsePx(copyStyles.lineHeight)
  const contentWidth = firstCopy.getBoundingClientRect().width
  const paddingY = parsePx(innerStyles.paddingTop) + parsePx(innerStyles.paddingBottom)
  let openItemId = st.openItemId
  if (st.events.clickedItemId !== null) {
    openItemId = openItemId === st.events.clickedItemId ? null : st.events.clickedItemId
  }
  refreshPrepared(font)
  const panelHeights: number[] = []
  const panelMeta: string[] = []
  for (let index = 0; index < items.length; index++) {
    const metrics = layout(preparedCache.items[index]!, contentWidth, lineHeight)
    panelHeights.push(Math.ceil(metrics.height + paddingY))
    panelMeta.push(`Размер: ${metrics.lineCount} линий · ${Math.round(metrics.height)} пикселей`)
  }
  st.openItemId = openItemId
  st.events.clickedItemId = null
  for (let index = 0; index < items.length; index++) {
    const item = items[index]!
    const itemDom = domCache.items[index]!
    const expanded = openItemId === item.id
    itemDom.meta.textContent = panelMeta[index]!
    itemDom.body.style.height = expanded ? `${panelHeights[index]} пикселей` : '0px'
    itemDom.glyph.style.transform = expanded ? 'повернуть (90 градусов)' : 'повернуть (0 градусов)'
    itemDom.toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  }
  return false
}