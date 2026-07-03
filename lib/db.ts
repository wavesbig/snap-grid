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

export function getOrCreateSession(): Promise<Session> {
  const sessionId = 'default' // single-session for now
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
            const session: Session = {
              id: sessionId,
              createdAt: Date.now(),
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

export async function addCaptureToSession(
  capture: Capture,
): Promise<Session> {
  await storeCapture(capture)
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite')
        const store = tx.objectStore('sessions')
        const req = store.get('default')
        req.onsuccess = () => {
          const session: Session = req.result
          if (session) {
            session.captureCount += 1
            store.put(session)
          }
          tx.oncomplete = () => resolve(session)
          tx.onerror = () => reject(tx.error)
        }
        req.onerror = () => reject(req.error)
      }),
  )
}

export { storeCapture }

export async function deleteCapture(id: string): Promise<void> {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('captures', 'readwrite')
    tx.objectStore('captures').delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  // Decrement session count
  const session = await getOrCreateSession()
  if (session.captureCount > 0) {
    session.captureCount -= 1
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite')
      tx.objectStore('sessions').put(session)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export async function getCaptureCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('captures', 'readonly')
    const index = tx.objectStore('captures').index('sessionId')
    const request = index.count('default')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
