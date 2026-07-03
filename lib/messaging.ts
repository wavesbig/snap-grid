// Discriminated union for background <-> content <-> popup communication
export interface CaptureRequest {
  type: 'CAPTURE'
  mode: 'grid' | 'subtitle'
}

export interface CaptureSuccess {
  type: 'CAPTURE_SUCCESS'
  captureId: string
  thumb: string
  width: number
  height: number
  videoTime: number
  blob: Blob
  mode: 'grid' | 'subtitle'
  pageTitle: string
}

export interface CaptureError {
  type: 'CAPTURE_ERROR'
  message: string
}

export interface CaptureDeletedMessage {
  type: 'CAPTURE_DELETED'
  captureId: string
}

export interface GetSessionRequest {
  type: 'GET_SESSION'
}

export interface GetSessionResponse {
  type: 'GET_SESSION_RESPONSE'
  captureCount: number
}

export type MessageToBackground =
  | CaptureSuccess
  | CaptureError

export type MessageToContent =
  | CaptureRequest

// Broadcast messages (background -> all extension pages like popup/editor)
export type BroadcastMessage =
  | CaptureSuccess
  | CaptureDeletedMessage