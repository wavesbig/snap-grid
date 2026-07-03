/**
 * Capture a video frame. Primary path: drawImage onto canvas, then toBlob.
 * Fallback: captureVisibleTab if canvas becomes tainted (CORS).
 */
export async function captureVideoFrame(
  video: HTMLVideoElement,
  mode: 'grid' | 'subtitle',
): Promise<{ blob: Blob; thumb: string; width: number; height: number }> {
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

  // Primary: direct canvas toBlob
  try {
    const blob = await canvasToBlob(canvas)
    const thumb = await blobToDataURL(blob)
    return { blob, thumb, width: w, height: cropH }
  } catch {
    // Fallback: captureVisibleTab (captures the whole viewport, not just video)
    const tab = await browser.tabs.captureVisibleTab()
    const blob = await fetch(tab).then((r) => r.blob())
    const thumb = await blobToDataURL(blob)
    return {
      blob,
      thumb,
      width: video.offsetWidth,
      height: video.offsetHeight,
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    )
  })
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
