import type { SourceDocument } from './types'
import { nowIso, uid } from './utils'

export type Confidence = 'tinggi' | 'sedang' | 'rendah'

export interface ParsedQuestion {
  id: string
  text: string
  sectionTitle: string | null
  confidence: Confidence
  include: boolean
}

export interface ExtractionResult {
  text: string
  fileName: string
  fileType: string
  fileSize: number
  status: 'Berhasil' | 'Gagal' | 'Tidak terbaca'
  error: string | null
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const ACCEPTED_EXTENSIONS = ['.docx', '.pdf', '.txt']

const QUESTION_STARTER =
  /^(jelaskan|ceritakan|bagaimana|bagaimanakah|apa|apakah|mengapa|kenapa|kapan|siapa|di mana|dimana|seberapa|bisakah|dapatkah|menurut|tolong|uraikan|gambarkan|sebutkan|mohon)\b/i

const SECTION_PATTERN = /^(bagian|bab)\s+([ivxlcdm]+|\d+)\b[.:)\s-]*(.*)$/i

function cleanLine(line: string): string {
  return line
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/^[•●▪◦*]\s*/, '')
    .trim()
}

function stripNumbering(line: string): { text: string; numbered: boolean } {
  const numbered = line.match(/^(\d{1,2}|[a-zA-Z])[.)]\s+(.+)$/)
  if (numbered) return { text: numbered[2].trim(), numbered: true }
  const roman = line.match(/^([ivxlcdm]{1,5})[.)]\s+(.+)$/i)
  if (roman) return { text: roman[2].trim(), numbered: true }
  return { text: line, numbered: false }
}

function isIgnorable(line: string): boolean {
  if (line.length === 0) return true
  if (/^\d{1,3}$/.test(line)) return true
  if (/^halaman\s+\d+(\s*(dari|\/)\s*\d+)?$/i.test(line)) return true
  if (/^(daftar isi|daftar pustaka|lampiran)$/i.test(line)) return true
  if (/^[-_=—–\s]{3,}$/.test(line)) return true
  return false
}

function detectSection(line: string): string | null {
  const match = line.match(SECTION_PATTERN)
  if (match) {
    const label = match[3]?.trim()
    return label ? `${match[1]} ${match[2]}: ${label}` : `${match[1]} ${match[2]}`
  }
  if (line.length <= 70 && /^[A-Z][A-Z0-9\s&:,.()/'-]{4,}$/.test(line) && !line.endsWith('?') && line.split(' ').length <= 10) {
    return line
      .toLowerCase()
      .split(' ')
      .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
      .join(' ')
  }
  if (line.length <= 70 && line.endsWith(':') && line.split(' ').length <= 10 && !line.includes('?')) {
    return line.slice(0, -1)
  }
  return null
}

function classify(text: string, numbered: boolean): Confidence {
  if (text.endsWith('?')) return 'tinggi'
  if (numbered) return 'sedang'
  if (QUESTION_STARTER.test(text)) return 'sedang'
  return 'rendah'
}

export function parseQuestions(raw: string): ParsedQuestion[] {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  const result: ParsedQuestion[] = []
  const seen = new Set<string>()
  let currentSection: string | null = null
  let counter = 0

  const push = (text: string, confidence: Confidence, section: string | null) => {
    const clean = text.replace(/\s+/g, ' ').trim()
    if (clean.length < 6) return
    if (seen.has(clean.toLowerCase())) return
    seen.add(clean.toLowerCase())
    counter += 1
    result.push({
      id: `parsed_${counter}_${Math.random().toString(36).slice(2, 8)}`,
      text: clean,
      sectionTitle: section,
      confidence,
      include: confidence !== 'rendah',
    })
  }

  for (const rawLine of lines) {
    const line = cleanLine(rawLine)
    if (isIgnorable(line)) continue

    const section = detectSection(line)
    if (section) {
      currentSection = section
      continue
    }

    const { text, numbered } = stripNumbering(line)
    if (isIgnorable(text)) continue

    // A single line may contain several sentences; split question sentences apart.
    if (text.includes('?') && text.length > 120) {
      const parts = text.split(/(?<=\?)\s+(?=[A-Z0-9])/g)
      const questionParts = parts.filter((part) => part.trim().length > 2)
      for (const part of questionParts) {
        const pruned = stripNumbering(part.trim()).text
        if (pruned.endsWith('?')) push(pruned, 'tinggi', currentSection)
      }
      if (questionParts.some((part) => part.trim().endsWith('?'))) continue
    }

    const confidence = classify(text, numbered)
    if (confidence === 'rendah') {
      // Keep personal-interview style prompts even without a question mark.
      if (text.length >= 18 && text.length <= 300 && /^(ceritakan|jelaskan|uraikan|gambarkan|tolong)\b/i.test(text)) {
        push(text, 'sedang', currentSection)
      }
      continue
    }
    push(text, confidence, currentSection)
  }

  return result
}

export async function extractFile(file: File): Promise<ExtractionResult> {
  const lower = file.name.toLowerCase()
  const extension = ACCEPTED_EXTENSIONS.find((ext) => lower.endsWith(ext))
  const fileType = extension ?? file.type ?? 'tidak dikenal'
  const base: ExtractionResult = {
    text: '',
    fileName: file.name,
    fileType,
    fileSize: file.size,
    status: 'Gagal',
    error: null,
  }

  if (!extension) {
    return { ...base, error: 'Format tidak didukung. Gunakan dokumen DOCX, PDF, atau TXT.' }
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ...base, error: 'Ukuran file melebihi 10 MB. Pecah dokumen atau gunakan file yang lebih kecil.' }
  }
  if (file.size === 0) {
    return { ...base, error: 'File kosong. Periksa kembali dokumen yang dipilih.' }
  }

  try {
    if (extension === '.txt') {
      const text = await file.text()
      if (text.trim().length < 10) {
        return { ...base, status: 'Tidak terbaca', error: 'Teks tidak ditemukan pada file. Pastikan file berisi teks yang dapat dibaca.' }
      }
      return { ...base, text, status: 'Berhasil' }
    }

    if (extension === '.docx') {
      // Vite/Node interop: bundel browser mammoth dapat hanya mengekspor default.
      type MammothBrowser = {
        extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>
      }
      const mammothModule = (await import('mammoth/mammoth.browser')) as unknown as MammothBrowser & {
        default?: MammothBrowser
      }
      const mammoth = mammothModule.default ?? mammothModule
      const arrayBuffer = await file.arrayBuffer()
      const output = await mammoth.extractRawText({ arrayBuffer })
      const text = output.value ?? ''
      if (text.trim().length < 10) {
        return {
          ...base,
          status: 'Tidak terbaca',
          error: 'Tidak ada teks yang dapat dibaca. Dokumen mungkin hanya berisi gambar. Masukkan pertanyaan secara manual.',
        }
      }
      return { ...base, text, status: 'Berhasil' }
    }

    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: buffer }).promise
    if (pdf.numPages > 300) {
      return { ...base, error: 'Dokumen melebihi 300 halaman. Pecah dokumen sebelum diimpor.' }
    }
    let text = ''
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
      text += `${pageText}\n`
    }
    if (text.trim().length < 40) {
      return {
        ...base,
        status: 'Tidak terbaca',
        error:
          'Dokumen PDF tampaknya berupa hasil pindai atau gambar, sehingga teks tidak dapat dibaca. Unggah PDF berbasis teks, atau masukkan pertanyaan secara manual.',
      }
    }
    return { ...base, text, status: 'Berhasil' }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Dokumen tidak dapat dibaca. Coba file lain atau masukkan pertanyaan secara manual.'
    return { ...base, status: 'Gagal', error: `Ekstraksi gagal: ${message}` }
  }
}

export const SAMPLE_GUIDE = `PANDUAN WAWANCARA
Studi Kebiasaan Belajar Mahasiswa

Bagian 1: Latar belakang belajar
1. Bagaimana Anda biasa mengatur waktu belajar dalam seminggu?
2. Di mana Anda paling sering belajar, dan mengapa memilih tempat itu?
3. Apa yang biasanya memicu Anda untuk mulai belajar?

Bagian 2: Tantangan belajar
4. Tantangan apa yang paling sering mengganggu waktu belajar Anda?
5. Bagaimana Anda menyikapi rasa malas atau kehilangan fokus saat belajar?

Bagian 3: Dukungan
6. Dukungan seperti apa yang Anda harapkan dari kampus?
7. Jika bisa memperbaiki satu kebiasaan belajar, apa yang ingin Anda ubah?
`

/** Menyimpan teks hasil ekstraksi terpisah dari pertanyaan yang sudah dikonfirmasi. */
export function documentFromExtraction(projectId: string, result: ExtractionResult): SourceDocument {
  const storedText = result.text.slice(0, 400_000)
  return {
    id: uid('doc'),
    projectId,
    fileName: result.fileName,
    fileType: result.fileType,
    fileSize: result.fileSize,
    uploadedAt: nowIso(),
    extractionStatus: result.status,
    extractionError: result.error,
    charCount: result.text.length,
    textPreview: result.text.replace(/\s+/g, ' ').trim().slice(0, 600),
    extractedText: storedText,
    truncated: result.text.length > storedText.length,
  }
}
