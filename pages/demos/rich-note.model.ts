import {
  prepareInlineFlow,
  walkInlineFlowLines,
  type PreparedInlineFlow,
} from '../../src/inline-flow.ts'
export type TextStyleName = 'body' | 'link' | 'code'
export type ChipTone = 'mention' | 'status' | 'priority' | 'time' | 'count'
export type RichInlineSpec =
  | { kind: 'text'; text: string; style: TextStyleName }
  | { kind: 'chip'; label: string; tone: ChipTone }
type TextStyleModel = {
  className: string
  extraWidth: number
  font: string
}
export type PreparedRichInlineFlow = {
  classNames: string[]
  flow: PreparedInlineFlow
}
export type RichLineFragment = {
  className: string
  leadingGap: number
  text: string
}
export type RichLine = {
  fragments: RichLineFragment[]
}
export type RichNoteLayout = {
  bodyWidth: number
  lineCount: number
  lines: RichLine[]
  noteBodyHeight: number
  noteWidth: number
}
export const BODY_FONT = '500 17px «Helvetica Neue», Helvetica, Arial, без засечек'
export const LINK_FONT = '600 17px «Helvetica Neue», Helvetica, Arial, без засечек'
export const CODE_FONT = '600 14px «SF Mono», ui-monospace, Менло, Монако, моноширинный'
export const CHIP_FONT = '700 12px «Helvetica Neue», Helvetica, Arial, без засечек'
export const LINE_HEIGHT = 34
export const LAST_LINE_BLOCK_HEIGHT = 24
export const NOTE_SHELL_CHROME_X = 40
export const BODY_MIN_WIDTH = 260
export const BODY_DEFAULT_WIDTH = 516
export const BODY_MAX_WIDTH = 760
export const PAGE_MARGIN = 28
export const CHIP_CHROME_WIDTH = 22
export const TEXT_STYLES = {
  body: {
    className: 'фрагмент фрагмента - тело',
    extraWidth: 0,
    font: BODY_FONT,
  },
  code: {
    className: 'фрагмент фрагмент — код',
    extraWidth: 14,
    font: CODE_FONT,
  },
  link: {
    className: 'фрагмент фрагмент - ссылка',
    extraWidth: 0,
    font: LINK_FONT,
  },
} satisfies Record<TextStyleName, TextStyleModel>
export const CHIP_CLASS_NAMES = {
  count: 'осколочный чип чип--считать',
  mention: 'осколочный чип - упоминание',
  priority: 'осколочный чип-приоритет',
  status: 'фрагмент чипа чип-статус',
  time: 'осколочный чип чип-время',
} satisfies Record<ChipTone, string>
export const DEFAULT_RICH_NOTE_SPECS: RichInlineSpec[] = [
  { kind: 'text', text: 'Ship ', style: 'body' },
  { kind: 'chip', label: '@майя', tone: 'mention' },
  { kind: 'text', text: "'s ", style: 'body' },
  { kind: 'text', text: 'rich-note', style: 'code' },
  { kind: 'text', text: ' карта один раз ', style: 'body' },
  { kind: 'text', text: 'pre-wrap', style: 'code' },
  { kind: 'text', text: ' земли. Статус ', style: 'body' },
  { kind: 'chip', label: 'blocked', tone: 'status' },
  { kind: 'text', text: ' by ', style: 'body' },
  { kind: 'text', text: 'вертикальный текст', style: 'link' },
  { kind: 'text', text: ' исследования, но 北京 копия и арабский QA оба зеленые ✅. Держать ', style: 'body' },
  { kind: 'chip', label: 'جاهز', tone: 'status' },
  { kind: 'text', text: ' for ', style: 'body' },
  { kind: 'text', text: 'Cmd+К', style: 'code' },
  { kind: 'text', text: ' документы; в комплект обзора теперь входят ярлыки 中文, запасной вариант عربي и еще один пропуск 🚀 для ', style: 'body' },
  { kind: 'chip', label: 'Пт 14:30', tone: 'time' },
  { kind: 'text', text: '. Держать ', style: 'body' },
  { kind: 'text', text: 'макетNextLine()', style: 'code' },
  { kind: 'text', text: ' общедоступно, отметить это ', style: 'body' },
  { kind: 'chip', label: 'P1', tone: 'priority' },
  { kind: 'text', text: ', держать ', style: 'body' },
  { kind: 'chip', label: '3 рецензента', tone: 'count' },
  { kind: 'text', text: 'и направить отзыв на ', style: 'body' },
  { kind: 'text', text: 'синхронизация дизайна', style: 'link' },
  { kind: 'text', text: '.', style: 'body' },
]
export function prepareRichInlineFlow(
  specs: RichInlineSpec[] = DEFAULT_RICH_NOTE_SPECS,
): PreparedRichInlineFlow {
  const classNames = specs.map(spec =>
    spec.kind === 'chip'
      ? CHIP_CLASS_NAMES[spec.tone]
      : TEXT_STYLES[spec.style].className,
  )
  const flow = prepareInlineFlow(
    specs.map(spec => {
      if (spec.kind === 'chip') {
        return {
          text: spec.label,
          font: CHIP_FONT,
          break: 'never' as const,
          extraWidth: CHIP_CHROME_WIDTH,
        }
      }
      const style = TEXT_STYLES[spec.style]
      return {
        text: spec.text,
        font: style.font,
        extraWidth: style.extraWidth,
      }
    }),
  )
  return { classNames, flow }
}
export function layoutRichInlineItems(
  prepared: PreparedRichInlineFlow,
  maxWidth: number,
): RichLine[] {
  const lines: RichLine[] = []
  walkInlineFlowLines(prepared.flow, maxWidth, line => {
    lines.push({
      fragments: line.fragments.map(fragment => ({
        className: prepared.classNames[fragment.itemIndex]!,
        leadingGap: fragment.gapBefore,
        text: fragment.text,
      })),
    })
  })
  return lines
}
export function resolveRichNoteBodyWidth(
  viewportWidth: number,
  requestedWidth: number,
): {
  bodyWidth: number
  maxBodyWidth: number
} {
  const maxBodyWidth = Math.max(
    BODY_MIN_WIDTH,
    Math.min(BODY_MAX_WIDTH, viewportWidth - PAGE_MARGIN * 2 - NOTE_SHELL_CHROME_X),
  )
  return {
    bodyWidth: Math.max(BODY_MIN_WIDTH, Math.min(maxBodyWidth, requestedWidth)),
    maxBodyWidth,
  }
}
export function layoutRichNote(
  prepared: PreparedRichInlineFlow,
  bodyWidth: number,
): RichNoteLayout {
  const lines = layoutRichInlineItems(prepared, bodyWidth)
  const lineCount = lines.length
  return {
    bodyWidth,
    lineCount,
    lines,
    noteBodyHeight:
      lineCount === 0 ? LAST_LINE_BLOCK_HEIGHT : (lineCount - 1) * LINE_HEIGHT + LAST_LINE_BLOCK_HEIGHT,
    noteWidth: bodyWidth + NOTE_SHELL_CHROME_X,
  }
}