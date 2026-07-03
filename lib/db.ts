import type { Capture, Session } from './types'

const DB_NAME = 'snap-grid'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('captures')) {
        const store = db.createObjectStore('captures', { keyPath: 'id' })
        store.createIndex('sessionId', 'sessionId', { unique: false })
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function storeCapture(capture: Capture): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('captures', 'readwrite')
        tx.objectStore('captures').put(capture)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      }),
  )
}

export function getSessionCaptures(sessionId: string): Promise<Capture[]> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('captures', 'readonly')
        const index = tx.objectStore('captures').index('sessionId')
        const request = index.getAll(sessionId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }),
  )
}

/** Get or create a session record by id. */
export function getOrCreateSession(
  sessionId: string,
  title: string,
  sourceUrl: string,
): Promise<Session> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite')
        const store = tx.objectStore('sessions')
        const req = store.get(sessionId)
        req.onsuccess = () => {
          const existing: Session | undefined = req.result
          if (existing) {
            resolve(existing)
          } else {
            const now = Date.now()
            const session: Session = {
              id: sessionId,
              title,
              sourceUrl,
              createdAt: now,
              updatedAt: now,
              captureCount: 0,
            }
            store.put(session)
            tx.oncomplete = () => resolve(session)
            tx.onerror = () => reject(tx.error)
          }
        }
        req.onerror = () => reject(req.error)
      }),
  )
}

/** Add a capture and update its session metadata. */
export async function addCaptureToSession(
  capture: Capture,
  title: string,
  sourceUrl: string,
): Promise<void> {
  await storeCapture(capture)
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite')
    const store = tx.objectStore('sessions')
    const req = store.get(capture.sessionId)
    req.onsuccess = () => {
      const existing: Session | undefined = req.result
      if (existing) {
        existing.captureCount += 1
        existing.updatedAt = Date.now()
        store.put(existing)
      } else {
        const now = Date.now()
        const session: Session = {
          id: capture.sessionId,
          title,
          sourceUrl,
          createdAt: now,
          updatedAt: now,
          captureCount: 1,
        }
        store.put(session)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** List all sessions ordered by most recently updated. */
export async function getAllSessions(): Promise<Session[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sessions', 'readonly')
    const request = tx.objectStore('sessions').getAll()
    request.onsuccess = () => {
      const sessions = (request.result as Session[]).sort(
        (a, b) => b.updatedAt - a.updatedAt,
      )
      resolve(sessions)
    }
    request.onerror = () => reject(request.error)
  })
}

export { storeCapture }

export async function deleteCapture(id: string): Promise<void> {
  const db = await openDB()
  // first read the capture to know which session it belongs to
  const capture = await new Promise<Capture | undefined>((resolve, reject) => {
    const tx = db.transaction('captures', 'readonly')
    const req = tx.objectStore('captures').get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('captures', 'readwrite')
    tx.objectStore('captures').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  // decrement session count if found
  if (capture) {
    const tx = db.transaction('sessions', 'readwrite')
    const req = tx.objectStore('sessions').get(capture.sessionId)
    req.onsuccess = () => {
      const session = req.result as Session | undefined
      if (session && session.captureCount > 0) {
        session.captureCount -= 1
        session.updatedAt = Date.now()
        tx.objectStore('sessions').put(session)
      }
    }
  }
}

/** Count captures for a specific session (defaults to total if no id). */
export async function getCaptureCount(sessionId?: string): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('captures', 'readonly')
    if (sessionId) {
      const index = tx.objectStore('captures').index('sessionId')
      const request = index.count(sessionId)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    } else {
      const request = tx.objectStore('captures').count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }
  })
}