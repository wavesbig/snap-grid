export type CaptureMode = 'grid' | 'subtitle'

export interface Capture {
  id: string
  blob: Blob
  thumb: string // base64 data URL for thumbnail display
  sourceUrl: string
  videoTime: number // seconds
  width: number
  height: number
  mode: CaptureMode
  sessionId: string
  createdAt: number
}

export interface Session {
  id: string
  title: string
  sourceUrl: string
  createdAt: number
  updatedAt: number
  captureCount: number
}