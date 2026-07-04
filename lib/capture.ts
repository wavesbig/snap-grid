/**
 * Capture a video frame. Primary path: drawImage onto canvas, then toBlob.
 * Fallback: captureVisibleTab if canvas becomes tainted (CORS).
 *
 * Returns two image tiers for different responsibilities:
 * - originalDataUrl: original capture for editor preview and export
 * - thumb: compact data URL for list items
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  mode: 'grid' | 'subtitle',
): Promise<{
  originalDataUrl: string
  thumb: string
  width: number
  height: number
}> {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) throw new Error('Video not ready: no video dimensions')

  // Capture region — subtitle mode captures bottom 30% of frame
  const cropY = mode === 'subtitle' ? Math.floor(h * 0.7) : 0
  const cropH = mode === 'subtitle' ? h - cropY : h

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = cropH
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(video, 0, cropY, w, cropH, 0, 0, w, cropH)

  // Primary: direct canvas toBlob (full-res PNG for export)
  try {
    const blob = await canvasToBlob(canvas)
    const originalDataUrl = await blobToDataUrl(blob)
    const thumb = await makeThumbnail(canvas)
    return { originalDataUrl, thumb, width: w, height: cropH }
  } catch {
    // Fallback: captureVisibleTab (captures the whole viewport, not just video)
    const tab = await browser.tabs.captureVisibleTab()
    const blob = await fetch(tab).then((r) => r.blob())
    const originalDataUrl = await blobToDataUrl(blob)
    const thumb = await makeThumbnail(canvas)
    return {
      originalDataUrl,
      thumb,
      width: video.offsetWidth,
      height: video.offsetHeight,
    }
  }
}

/** Downscale to max 200px edge, JPEG 0.7 quality — ~5-15KB per thumb. */
async function makeThumbnail(source: HTMLCanvasElement): Promise<string> {
  const maxEdge = 200
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height))
  const tw = Math.round(source.width * scale)
  const th = Math.round(source.height * scale)
  const tc = document.createElement('canvas')
  tc.width = tw
  tc.height = th
  const tctx = tc.getContext('2d')!
  tctx.drawImage(source, 0, 0, tw, th)
  return new Promise((resolve, reject) => {
    tc.toBlob(
      (b) => {
        if (!b) return reject(new Error('thumbnail toBlob failed'))
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(b)
      },
      'image/jpeg',
      0.7,
    )
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
