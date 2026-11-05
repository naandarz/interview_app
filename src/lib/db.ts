import type { WorkspaceData } from './types'

export const STORES = [
  'projects',
  'documents',
  'sections',
  'questions',
  'respondents',
  'sessions',
  'answers',
  'codes',
  'answerCodes',
  'categories',
  'codeCategories',
  'themes',
  'themeCategories',
  'themeEvidence',
  'memos',
  'exports',
  'meta',
] as const

export type StoreName = (typeof STORES)[number]
type DataStore = Exclude<StoreName, 'meta'>

const INDEXED_STORES: DataStore[] = STORES.filter((s) => s !== 'meta') as DataStore[]
const DB_NAME = 'interview-workspace'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function resetDb() {
  dbPromise = null
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of INDEXED_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'id' })
          store.createIndex('projectId', 'projectId', { unique: false })
        }
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      // Jangan memakai koneksi yang sudah usang setelah tab lain meningkatkan versi.
      db.onversionchange = () => {
        db.close()
        resetDb()
      }
      db.onclose = () => resetDb()
      resolve(db)
    }
    request.onerror = () => {
      resetDb()
      reject(request.error ?? new Error('Gagal membuka penyimpanan browser.'))
    }
    request.onblocked = () => {
      resetDb()
      reject(new Error('Penyimpanan sedang dipakai tab lain. Tutup tab lain lalu muat ulang.'))
    }
  })
  return dbPromise
}

/**
 * Menjalankan satu permintaan di dalam transaksi. Promise baru selesai setelah
 * transaksi benar-benar commit (oncomplete), bukan hanya setelah request sukses,
 * agar kegagalan commit tidak dilaporkan sebagai keberhasilan.
 */
function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode)
        let result: T
        let settled = false
        const fail = (error: unknown) => {
          if (settled) return
          settled = true
          reject(error instanceof Error ? error : new Error('Transaksi penyimpanan dibatalkan.'))
        }
        transaction.oncomplete = () => {
          if (settled) return
          settled = true
          resolve(result)
        }
        transaction.onerror = () => fail(transaction.error ?? new Error('Operasi penyimpanan gagal.'))
        transaction.onabort = () => fail(transaction.error ?? new Error('Transaksi penyimpanan dibatalkan.'))
        try {
          const request = run(transaction.objectStore(store))
          request.onsuccess = () => {
            result = request.result
          }
          request.onerror = () => fail(request.error ?? new Error('Operasi penyimpanan gagal.'))
        } catch (error) {
          try {
            transaction.abort()
          } catch {
            // Transaksi mungkin sudah selesai; error asli tetap dilaporkan.
          }
          fail(error)
        }
      }),
  )
}

export async function getAll<T>(store: DataStore): Promise<T[]> {
  return (await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>)) ?? []
}

export async function putRecord<T>(store: StoreName, value: T): Promise<void> {
  await tx(store, 'readwrite', (s) => s.put(value as unknown as object) as IDBRequest<IDBValidKey>)
}

export async function putMany<T>(store: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) return
  await tx(store, 'readwrite', (s) => {
    for (const value of values) s.put(value as unknown as object)
    return s.count() as IDBRequest<number>
  })
}

export async function deleteRecord(store: StoreName, id: string): Promise<void> {
  await tx(store, 'readwrite', (s) => s.delete(id) as unknown as IDBRequest<undefined>)
}

export async function deleteMany(store: StoreName, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await tx(store, 'readwrite', (s) => {
    for (const id of ids) s.delete(id)
    return s.count() as IDBRequest<number>
  })
}

/**
 * Menjalankan penulisan lintas object store dalam SATU transaksi. Jika salah satu
 * operasi gagal, seluruh transaksi dibatalkan sehingga data tidak setengah masuk.
 */
function writeTransaction(storeNames: string[], run: (transaction: IDBTransaction) => void): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeNames, 'readwrite')
        let settled = false
        const fail = (error: unknown) => {
          if (settled) return
          settled = true
          reject(error instanceof Error ? error : new Error('Transaksi penyimpanan dibatalkan.'))
        }
        transaction.oncomplete = () => {
          if (settled) return
          settled = true
          resolve()
        }
        transaction.onerror = () => fail(transaction.error ?? new Error('Operasi penyimpanan gagal.'))
        transaction.onabort = () => fail(transaction.error ?? new Error('Transaksi penyimpanan dibatalkan.'))
        try {
          run(transaction)
        } catch (error) {
          try {
            transaction.abort()
          } catch {
            // Transaksi mungkin sudah selesai; error asli tetap dilaporkan.
          }
          fail(error)
        }
      }),
  )
}

export async function clearData(): Promise<void> {
  await writeTransaction([...STORES], (transaction) => {
    for (const store of STORES) transaction.objectStore(store).clear()
  })
}

export async function loadWorkspace(): Promise<WorkspaceData> {
  const [projects, documents, sections, questions, respondents, sessions, answers, codes, answerCodes, categories, codeCategories, themes, themeCategories, themeEvidence, memos, exports] =
    await Promise.all([
      getAll('projects'),
      getAll('documents'),
      getAll('sections'),
      getAll('questions'),
      getAll('respondents'),
      getAll('sessions'),
      getAll('answers'),
      getAll('codes'),
      getAll('answerCodes'),
      getAll('categories'),
      getAll('codeCategories'),
      getAll('themes'),
      getAll('themeCategories'),
      getAll('themeEvidence'),
      getAll('memos'),
      getAll('exports'),
    ])
  return {
    projects,
    documents,
    sections,
    questions,
    respondents,
    sessions,
    answers,
    codes,
    answerCodes,
    categories,
    codeCategories,
    themes,
    themeCategories,
    themeEvidence,
    memos,
    exports,
  } as WorkspaceData
}

export async function replaceWorkspace(data: WorkspaceData): Promise<void> {
  await writeTransaction([...INDEXED_STORES], (transaction) => {
    for (const store of INDEXED_STORES) {
      const objectStore = transaction.objectStore(store)
      objectStore.clear()
      const rows = data[store] as Array<{ id: string }> | undefined
      if (!rows?.length) continue
      for (const row of rows) objectStore.put(row)
    }
  })
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const row = await tx<{ key: string; value: T } | undefined>('meta', 'readonly', (s) => s.get(key) as IDBRequest<{ key: string; value: T } | undefined>)
  return row?.value ?? null
}

export async function setMeta<T>(key: string, value: T): Promise<void> {
  await putRecord('meta', { key, value })
}
