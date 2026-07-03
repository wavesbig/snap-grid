// Discriminated union for background <-> content communication
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
}

export interface CaptureError {
  type: 'CAPTURE_ERROR'
  message: string
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
