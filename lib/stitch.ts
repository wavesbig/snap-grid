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
  const columnHeights = new Array(cols).fill(0)

  const items: StitchItem[] = captures.map((capture, index) => {
    const aspect = capture.height / capture.width
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 9 / 16
    const scaledH = Math.round(cellW * safeAspect)

    let col = index % cols
    let minHeight = columnHeights[col]
    for (let i = 0; i < cols; i += 1) {
      if (columnHeights[i] < minHeight) {
        minHeight = columnHeights[i]
        col = i
      }
    }

    const rect = {
      x: col * (cellW + gap),
      y: columnHeights[col],
      w: cellW,
      h: scaledH,
    }
    columnHeights[col] += scaledH + gap

    return {
      capture,
      crop: 'full',
      rect,
    }
  })

  const width = cols * cellW + (cols - 1) * gap
  const height = Math.max(0, ...columnHeights) - (captures.length > 0 ? gap : 0)

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

function getImageSize(image: CanvasImageSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    }
  }

  if (image instanceof ImageBitmap) {
    return {
      width: image.width,
      height: image.height,
    }
  }

  throw new Error('Unsupported image source')
}

async function loadCaptureImage(
  capture: Capture,
  source: 'thumb' | 'blob',
): Promise<{ image: CanvasImageSource; release: () => void }> {
  if (source === 'thumb') {
    const image = await loadImage(capture.thumb)
    return { image, release: () => {} }
  }

  const image = await loadImage(capture.originalDataUrl)
  return { image, release: () => {} }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  rect: Rect,
) {
  const { width: imageWidth, height: imageHeight } = getImageSize(img)
  const srcAspect = imageWidth / imageHeight
  const dstAspect = rect.w / rect.h
  let sx = 0, sy = 0, sw = imageWidth, sh = imageHeight
  if (srcAspect > dstAspect) {
    sw = imageHeight * dstAspect
    sx = (imageWidth - sw) / 2
  } else {
    sh = imageWidth / dstAspect
    sy = (imageHeight - sh) / 2
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

/** Stroke-less rounded-rect path (used for label pill backgrounds). */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function drawMissingCapture(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label = '加载失败',
) {
  ctx.save()
  ctx.fillStyle = 'rgba(15, 23, 42, 0.08)'
  drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(16, rect.h * 0.12))
  ctx.fill()
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(rect.x + 12, rect.y + 12)
  ctx.lineTo(rect.x + rect.w - 12, rect.y + rect.h - 12)
  ctx.moveTo(rect.x + rect.w - 12, rect.y + 12)
  ctx.lineTo(rect.x + 12, rect.y + rect.h - 12)
  ctx.stroke()
  ctx.fillStyle = 'rgba(15, 23, 42, 0.56)'
  ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2)
  ctx.restore()
}

export async function renderToCanvas(
  layout: StitchLayout,
  mode: 'grid' | 'vertical' | 'subtitle',
  background = '#ffffff',
  options?: {
    radius?: number
    bandRatio?: number
    source?: 'thumb' | 'blob'
    pixelRatio?: number
  },
): Promise<HTMLCanvasElement> {
  const radius = options?.radius ?? 0
  const bandRatio = options?.bandRatio ?? 0.3
  const source = options?.source ?? 'thumb'
  const pixelRatio = Math.max(1, options?.pixelRatio ?? 1)

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(layout.width * pixelRatio))
  canvas.height = Math.max(1, Math.round(layout.height * pixelRatio))
  const ctx = canvas.getContext('2d')!
  ctx.scale(pixelRatio, pixelRatio)

  if (background !== 'transparent') {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, layout.width, layout.height)
  }

  const loadedItems = await Promise.all(
    layout.items.map(async (item) => {
      try {
        return {
          ...item,
          status: 'loaded' as const,
          asset: await loadCaptureImage(item.capture, source),
        }
      } catch (error) {
        return {
          ...item,
          status: 'failed' as const,
          error,
        }
      }
    }),
  )

  if (!loadedItems.some((item) => item.status === 'loaded')) {
    const firstFailed = loadedItems.find((item) => item.status === 'failed')
    throw new Error(
      firstFailed && 'error' in firstFailed && firstFailed.error instanceof Error
        ? firstFailed.error.message
        : 'No preview assets could be loaded',
    )
  }

  try {
    for (const item of loadedItems) {
      const { rect, crop, capture } = item
      if (item.status === 'failed') {
        console.warn('[snap-grid] Failed to load capture asset', {
          captureId: capture.id,
          sessionId: capture.sessionId,
          source,
          error: item.error,
        })
        drawMissingCapture(ctx, rect)
        continue
      }

      const img = item.asset.image
      const { width: imageWidth, height: imageHeight } = getImageSize(img)
      withRoundedClip(ctx, rect, radius, () => {
        if (crop === 'band') {
          const srcBandH = imageHeight * bandRatio
          const srcY = imageHeight - srcBandH
          ctx.drawImage(img, 0, srcY, imageWidth, srcBandH, rect.x, rect.y, rect.w, rect.h)
        } else {
          ctx.drawImage(img, 0, 0, imageWidth, imageHeight, rect.x, rect.y, rect.w, rect.h)
        }
      })

      // subtitle band: draw MM:SS time-code label on top, outside the rounded clip.
      if (mode === 'subtitle' && crop === 'band') {
        const mm = Math.floor(capture.videoTime / 60)
        const ss = Math.floor(capture.videoTime % 60)
        const label = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
        const pad = Math.max(6, rect.h * 0.06)
        const fontSize = Math.max(14, Math.round(rect.h * 0.12))
        ctx.save()
        ctx.font = '600 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif'
        ctx.textBaseline = 'top'
        ctx.textAlign = 'left'
        const textWidth = ctx.measureText(label).width
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        drawRoundRect(ctx, rect.x + pad * 0.5, rect.y + pad * 0.5, textWidth + pad, fontSize + pad * 0.5, pad * 0.25)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.fillText(label, rect.x + pad, rect.y + pad * 0.75)
        ctx.restore()
      }
    }
  } finally {
    for (const item of loadedItems) {
      if (item.status === 'loaded') {
        item.asset.release()
      }
    }
  }

  return canvas
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      format,
      quality,
    )
  })
}
