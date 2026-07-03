/**
 * Image stitching: layout computation + canvas rendering.
 * Three modes: grid, vertical (long image), subtitle (full frame + subtitle bands).
 *
 * Layout math is pure (no DOM), renderToCanvas draws onto a canvas.
 */
import type { Capture } from './types'

// ----- layout types -----

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type CropMode = 'full' | 'band'

export interface StitchItem {
  capture: Capture
  rect: Rect
  crop: CropMode
}

export interface StitchLayout {
  width: number
  height: number
  items: StitchItem[]
}

export interface StitchOptions {
  mode: 'grid' | 'vertical' | 'subtitle'
  gap?: number
  background?: string
  columns?: number
  bandRatio?: number // subtitle: fraction of frame height for band crop (0.1-0.5)
  radius?: number // corner radius applied to each image (px)
}

// ----- layout algorithms (pure) -----

export function layoutGrid(
  captures: Capture[],
  opts: { gap?: number; columns?: number; cellWidth?: number } = {},
): StitchLayout {
  const gap = opts.gap ?? 12
  const requestedCols = opts.columns ?? 2
  const cols = Math.max(1, Math.min(requestedCols, captures.length))
  const cellW = opts.cellWidth ?? 480
  const cellH = Math.round(cellW * 9 / 16)
  const rows = Math.ceil(captures.length / cols)
  const width = cols * cellW + (cols - 1) * gap
  const height = rows * cellH + (rows - 1) * gap

  const items: StitchItem[] = captures.map((capture, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      capture,
      crop: 'full',
      rect: {
        x: col * (cellW + gap),
        y: row * (cellH + gap),
        w: cellW,
        h: cellH,
      },
    }
  })

  return { width, height, items }
}

export function layoutVertical(
  captures: Capture[],
  opts: { gap?: number; targetWidth?: number } = {},
): StitchLayout {
  const gap = opts.gap ?? 12
  const targetW = opts.targetWidth ?? 480

  let y = 0
  const items: StitchItem[] = captures.map((capture) => {
    const aspect = capture.height / capture.width
    const scaledH = Math.round(targetW * aspect)
    const rect = { x: 0, y, w: targetW, h: scaledH }
    y += scaledH + gap
    return { capture, crop: 'full' as const, rect }
  })

  const height = Math.max(0, y - gap)
  return { width: targetW, height, items }
}

/**
 * Subtitle layout: first capture is a full frame, the rest are subtitle bands
 * (bottom portion) stacked vertically below it.
 * Default gap is 0 for seamless subtitle concatenation.
 */
export function layoutSubtitle(
  captures: Capture[],
  opts: { gap?: number; targetWidth?: number; bandRatio?: number } = {},
): StitchLayout {
  const gap = opts.gap ?? 0
  const targetW = opts.targetWidth ?? 480
  const bandRatio = opts.bandRatio ?? 0.3

  let y = 0
  const items: StitchItem[] = captures.map((capture, i) => {
    if (i === 0) {
      const aspect = capture.height / capture.width
      const scaledH = Math.round(targetW * aspect)
      const rect = { x: 0, y, w: targetW, h: scaledH }
      y += scaledH + gap
      return { capture, crop: 'full' as const, rect }
    }
    const bandH = Math.round(capture.height * bandRatio)
    const aspect = bandH / capture.width
    const scaledH = Math.round(targetW * aspect)
    const rect = { x: 0, y, w: targetW, h: scaledH }
    y += scaledH + gap
    return { capture, crop: 'band' as const, rect }
  })

  const height = Math.max(0, y - gap)
  return { width: targetW, height, items }
}

// ----- main entry -----

export function computeLayout(
  captures: Capture[],
  options: StitchOptions,
): StitchLayout {
  if (captures.length === 0) {
    return { width: 0, height: 0, items: [] }
  }
  switch (options.mode) {
    case 'grid':
      return layoutGrid(captures, {
        gap: options.gap,
        columns: options.columns,
      })
    case 'vertical':
      return layoutVertical(captures, { gap: options.gap })
    case 'subtitle':
      return layoutSubtitle(captures, {
        gap: options.gap,
        bandRatio: options.bandRatio,
      })
  }
}

// ----- rendering (canvas) -----

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image: ' + src.slice(0, 50)))
    img.src = src
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  rect: Rect,
) {
  const srcAspect = img.naturalWidth / img.naturalHeight
  const dstAspect = rect.w / rect.h
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
  if (srcAspect > dstAspect) {
    sw = img.naturalHeight * dstAspect
    sx = (img.naturalWidth - sw) / 2
  } else {
    sh = img.naturalWidth / dstAspect
    sy = (img.naturalHeight - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h)
}

/** Clip each item's rect to a rounded path before drawing. */
function withRoundedClip(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  radius: number,
  draw: () => void,
) {
  if (radius <= 0) {
    draw()
    return
  }
  const r = Math.min(radius, rect.w / 2, rect.h / 2)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(rect.x + r, rect.y)
  ctx.lineTo(rect.x + rect.w - r, rect.y)
  ctx.quadraticCurveTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + r)
  ctx.lineTo(rect.x + rect.w, rect.y + rect.h - r)
  ctx.quadraticCurveTo(rect.x + rect.w, rect.y + rect.h, rect.x + rect.w - r, rect.y + rect.h)
  ctx.lineTo(rect.x + r, rect.y + rect.h)
  ctx.quadraticCurveTo(rect.x, rect.y + rect.h, rect.x, rect.y + rect.h - r)
  ctx.lineTo(rect.x, rect.y + r)
  ctx.quadraticCurveTo(rect.x, rect.y, rect.x + r, rect.y)
  ctx.closePath()
  ctx.clip()
  draw()
  ctx.restore()
}

export async function renderToCanvas(
  layout: StitchLayout,
  mode: 'grid' | 'vertical' | 'subtitle',
  background = '#ffffff',
  options?: { radius?: number; bandRatio?: number },
): Promise<HTMLCanvasElement> {
  const radius = options?.radius ?? 0
  const bandRatio = options?.bandRatio ?? 0.3

  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext('2d')!

  if (background !== 'transparent') {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  for (const { capture, rect, crop } of layout.items) {
    const img = await loadImage(capture.thumb)
    withRoundedClip(ctx, rect, radius, () => {
      if (crop === 'band') {
        const srcBandH = img.naturalHeight * bandRatio
        const srcY = img.naturalHeight - srcBandH
        ctx.drawImage(img, 0, srcY, img.naturalWidth, srcBandH, rect.x, rect.y, rect.w, rect.h)
      } else if (mode === 'grid') {
        drawCover(ctx, img, rect)
      } else {
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, rect.x, rect.y, rect.w, rect.h)
      }
    })
  }

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    )
  })
}
