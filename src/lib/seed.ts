import type {
  AnalysisMemo,
  Answer,
  AnswerCode,
  Category,
  Code,
  CodeCategory,
  InterviewSession,
  Project,
  Question,
  Respondent,
  Section,
  SessionStatus,
  AnswerStatus,
  Theme,
  ThemeCategory,
  ThemeEvidence,
  WorkspaceData,
  SourceDocument,
} from './types'
import { nowIso, uid } from './utils'

interface SeedQuestion {
  text: string
  guidance: string
  required?: boolean
}

const SECTION_BLUEPRINTS: Array<{ title: string; description: string; questions: SeedQuestion[] }> = [
  {
    title: 'Kebiasaan dan pengaturan belajar',
    description: 'Menggali rutinitas, tempat, dan pemicu belajar.',
    questions: [
      {
        text: 'Bagaimana Anda biasa mengatur waktu belajar dalam seminggu?',
        guidance: 'Minta contoh konkret pembagian hari dan jam. Hindari pertanyaan lanjutan yang menuntun.',
      },
      {
        text: 'Di mana Anda paling sering belajar, dan mengapa memilih tempat itu?',
        guidance: 'Catat alasan pemilihan tempat, termasuk suasana dan fasilitas.',
      },
      {
        text: 'Apa yang biasanya memicu Anda untuk mulai belajar?',
        guidance: 'Telusuri pemicu internal maupun eksternal, misalnya tenggat atau ajakan teman.',
      },
      {
        text: 'Bagaimana Anda menyiapkan catatan atau materi sebelum ujian?',
        guidance: 'Minta urutan persiapan dan sumber materi yang dipakai.',
      },
    ],
  },
  {
    title: 'Tantangan dan strategi',
    description: 'Memetakan hambatan belajar dan cara narasumber menyikapinya.',
    questions: [
      {
        text: 'Tantangan apa yang paling sering mengganggu waktu belajar Anda?',
        guidance: 'Gali contoh kejadian terakhir agar jawaban tidak terlalu umum.',
      },
      {
        text: 'Bagaimana Anda menyikapi rasa malas atau kehilangan fokus saat belajar?',
        guidance: 'Cari tahu strategi nyata yang sudah dicoba, bukan hanya harapan.',
      },
      {
        text: 'Apakah Anda menggunakan aplikasi atau alat bantu belajar? Bagaimana pengalamannya?',
        guidance: 'Catat nama alat, alasan memakai, dan apakah masih digunakan.',
        required: false,
      },
      {
        text: 'Bagaimana peran teman atau kelompok belajar dalam kebiasaan belajar Anda?',
        guidance: 'Bedakan dukungan emosional dan bantuan akademik.',
      },
    ],
  },
  {
    title: 'Dukungan dan perubahan',
    description: 'Harapan terhadap kampus serta perubahan kebiasaan sejak awal kuliah.',
    questions: [
      {
        text: 'Dukungan seperti apa yang Anda harapkan dari kampus?',
        guidance: 'Minta prioritas dukungan, bukan daftar keinginan.',
        required: false,
      },
      {
        text: 'Kebiasaan belajar seperti apa yang paling membantu sejak awal kuliah?',
        guidance: 'Minta narasumber memilih satu kebiasaan paling berdampak.',
      },
      {
        text: 'Apa yang berubah dari cara belajar di SMA ke kuliah?',
        guidance: 'Bandingkan tuntutan, pengawasan, dan kemandirian.',
      },
      {
        text: 'Jika bisa memperbaiki satu kebiasaan belajar, apa yang ingin Anda ubah?',
        guidance: 'Tutup dengan refleksi singkat dan alasan perubahan.',
      },
    ],
  },
]

const RESPONDENTS = [
  {
    code: 'R01',
    name: 'Nara P.',
    notes: 'Mahasiswa semester 3, program studi ilmu komunikasi. Aktif di organisasi kampus.',
    answers: [
      'Saya biasanya belajar tiga sampai empat kali seminggu, kebanyakan sore setelah kelas. Waktunya tidak tetap karena jadwal organisasi, jadi saya menulis target kecil di catatan ponsel.',
      'Paling sering di lantai dua perpustakaan. Tempatnya sepi, kursinya nyaman, dan ada colokan. Kalau di kos sering tergoda tidur.',
      'Biasanya karena ada tugas atau ujian yang sudah dekat. Kadang juga karena teman mengajak belajar bersama, jadi saya ikut supaya tidak tertinggal.',
      'Saya menyusun ulang catatan kelas jadi ringkasan satu halaman per pertemuan, lalu membuat daftar istilah yang belum paham. Sumbernya catatan sendiri dan slide dosen.',
      'Paling sering terganggu notifikasi dan ajakan teman. Kalau sudah mulai, biasanya bisa fokus, tapi memulai itu yang berat.',
      'Saya mencoba aturan 25 menit belajar lalu 5 menit istirahat. Kalau tetap tidak fokus, saya pindah tempat atau belajar bareng teman.',
      'Saya pakai aplikasi catatan dan pengingat tugas. Berguna untuk mengingat tenggat, tapi sering jadi alasan membuka ponsel lalu lanjut ke media sosial.',
      'Kelompok belajar membantu saya memahami materi yang sulit. Tapi kalau terlalu ramai, obrolannya jadi jauh dari materi.',
      'Saya berharap ada ruang belajar yang buka lebih lama dan jadwal konsultasi dosen yang lebih mudah diakses.',
      'Mencatat target harian kecil. Jadi tidak menunggu semangat besar untuk mulai belajar.',
      'Di SMA semua diatur guru. Di kuliah saya harus menentukan sendiri kapan belajar, dan itu tidak langsung bisa.',
      'Saya ingin lebih konsisten mulai belajar tanpa menunggu ujian. Mungkin dengan jadwal tetap mingguan.',
    ],
  },
  {
    code: 'R02',
    name: '',
    notes: 'Memilih anonim. Mahasiswa semester 1, program studi teknik industri.',
    answers: [
      'Saya belajar hampir setiap hari, tapi durasinya pendek, sekitar satu jam. Lebih sering malam hari karena siang penuh kelas dan kegiatan.',
      'Di kamar kos dengan meja belajar. Saya butuh suasana tenang dan tidak suka membawa banyak buku. Tapi kadang jadi terlalu nyaman sampai mengantuk.',
      'Kalau ada kuis atau tugas yang harus dikumpulkan. Saya belum bisa belajar tanpa tenggat yang jelas.',
      'Saya membaca ulang materi dan mengerjakan contoh soal. Kalau ada yang tidak paham, saya tanya teman lewat chat.',
      'Distraksi ponsel dan rasa lelah setelah kelas. Sering saya menunda sampai malam lalu tidak jadi belajar.',
      'Saya biasanya berhenti sebentar, minum, lalu mencoba lagi sepuluh menit. Kalau masih tidak bisa, saya akui hari itu tidak produktif dan menggantinya besok.',
      'Saya sempat memakai aplikasi pengatur waktu belajar. Awalnya rajin, tapi setelah dua minggu berhenti karena terasa seperti beban tambahan.',
      'Teman sekelas sering membantu saat ada tugas kelompok. Untuk belajar mandiri, saya lebih suka sendiri.',
      'Materi ringkas dari dosen dan contoh soal yang dibahas di kelas. Kadang penjelasan di kelas terlalu cepat.',
      'Membuat ringkasan setelah kelas, selagi masih ingat. Itu membantu saat ujian karena tidak perlu membaca semuanya lagi.',
      'Di SMA ada jam belajar wajib. Sekarang saya bebas, tapi justru sering menunda.',
      'Saya ingin berhenti belajar hanya saat ada ujian. Mau coba belajar sedikit tapi rutin setiap hari.',
    ],
  },
  {
    code: 'R03',
    name: 'Sari W.',
    notes: 'Mahasiswa semester 5, program studi akuntansi. Bekerja paruh waktu.',
    answers: [
      'Saya belajar di sela-sela kerja, biasanya pagi sebelum kuliah dan malam setelah pulang. Total mungkin lima jam per minggu, tidak merata.',
      'Lebih sering di kafe dekat kampus karena bisa sambil kerja. Tidak ideal, tapi lebih realistis daripada perpustakaan yang jamnya terbatas.',
      'Saya membuat jadwal mingguan dan menandai blok belajar di kalender. Kalau tidak dijadwalkan, hampir pasti tidak terjadi.',
      'Saya mengumpulkan soal dari tahun sebelumnya dan membuat catatan rumus. Fokus ke pola soal karena waktu terbatas.',
      'Waktu yang terbagi antara kerja dan kuliah. Kadang saya harus memilih menyelesaikan pekerjaan daripada membaca materi.',
      'Saya belajar dalam blok pendek, tiga puluh menit, lalu lanjut aktivitas lain. Kalau lelah sekali, saya tidur dulu daripada memaksakan.',
      'Saya memakai spreadsheet untuk melacak tugas. Aplikasi belajar khusus terasa terlalu banyak fitur untuk kebutuhan saya.',
      'Teman kerja yang juga kuliah jadi tempat bertanya. Kami berbagi catatan kalau ada kelas yang bentrok.',
      'Akses rekaman kelas atau materi yang bisa dipelajari ulang. Saya sering tidak bisa hadir penuh karena jadwal kerja.',
      'Membuat jadwal realistis dan menaruh materi di tempat yang mudah dilihat. Jadi tidak perlu memutuskan mau belajar apa.',
      'Di SMA belajar cukup mengikuti jadwal sekolah. Sekarang saya harus melawan rasa bersalah karena tidak selalu bisa belajar panjang.',
      'Saya ingin lebih berani menolak ajakan yang mengganggu waktu belajar, tanpa merasa bersalah.',
    ],
  },
]

function answerStatus(index: number, respondentIndex: number): AnswerStatus {
  if (respondentIndex === 2 && index === 10) return 'Perlu Klarifikasi'
  if (respondentIndex === 2 && index === 11) return 'Belum Dijawab'
  if (index === 6) return 'Ditinjau'
  if (index === 9) return 'Ditinjau'
  if (index === 11 && respondentIndex === 1) return 'Belum Dijawab'
  return 'Terisi'
}

export function buildDemoWorkspace(): WorkspaceData {
  const projectId = uid('prj')
  const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString()

  const project: Project = {
    id: projectId,
    title: 'Kebiasaan Belajar Mahasiswa Baru',
    description:
      'Studi kualitatif tentang kebiasaan belajar, hambatan, dan dukungan yang dibutuhkan mahasiswa pada tahun pertama. Proyek ini berisi data contoh untuk mencoba alur kerja.',
    objective:
      'Memahami bagaimana mahasiswa baru mengatur waktu belajar dan dukungan apa yang paling membantu mereka.',
    generalNotes:
      'Data contoh. Wawancara dilakukan secara semi-terstruktur selama 35 sampai 50 menit. Semua nama telah disamarkan atau disetujui untuk ditampilkan.',
    status: 'Analisis',
    backupEnabled: false,
    localRevision: 1,
    remoteFileId: null,
    lastSyncedAt: null,
    lastSyncedRevision: null,
    syncStatus: 'Belum dicadangkan',
    lastSyncError: null,
    createdAt,
    updatedAt: nowIso(),
    lastOpenedAt: nowIso(),
  }

  const document: SourceDocument = {
    id: uid('doc'),
    projectId,
    fileName: 'panduan-wawancara-awal.txt',
    fileType: 'text/plain',
    fileSize: 2840,
    uploadedAt: createdAt,
    extractionStatus: 'Berhasil',
    extractionError: null,
    charCount: 2380,
    textPreview:
      'PANDUAN WAWANCARA\n\nBagian 1: Kebiasaan dan pengaturan belajar\n1. Bagaimana Anda biasa mengatur waktu belajar dalam seminggu?\n2. Di mana Anda paling sering belajar, dan mengapa memilih tempat itu?\n...',
  }

  const sections: Section[] = []
  const questions: Question[] = []
  SECTION_BLUEPRINTS.forEach((blueprint, sectionIndex) => {
    const section: Section = {
      id: uid('sec'),
      projectId,
      title: blueprint.title,
      description: blueprint.description,
      orderIndex: sectionIndex,
    }
    sections.push(section)
    blueprint.questions.forEach((item, questionIndex) => {
      questions.push({
        id: uid('q'),
        projectId,
        sectionId: section.id,
        text: item.text,
        guidance: item.guidance,
        orderIndex: sectionIndex * 100 + questionIndex,
        isRequired: item.required !== false,
        isActive: true,
        sourceDocumentId: document.id,
        createdAt,
        updatedAt: createdAt,
      })
    })
  })

  const respondents: Respondent[] = []
  const sessions: InterviewSession[] = []
  const answers: Answer[] = []

  RESPONDENTS.forEach((entry, respondentIndex) => {
    const respondent: Respondent = {
      id: uid('rsp'),
      projectId,
      code: entry.code,
      displayName: entry.name,
      profileNotes: entry.notes,
      createdAt,
      updatedAt: createdAt,
      archivedAt: null,
    }
    respondents.push(respondent)

    const sessionStatus: SessionStatus = respondentIndex === 2 ? 'Perlu Ditinjau' : 'Selesai'
    const session: InterviewSession = {
      id: uid('ses'),
      projectId,
      respondentId: respondent.id,
      title: `Wawancara ${entry.code}`,
      interviewDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (12 - respondentIndex * 3)).toISOString(),
      method: respondentIndex === 1 ? 'Daring' : 'Tatap muka',
      interviewerName: 'Peneliti utama',
      durationMinutes: 35 + respondentIndex * 7,
      status: sessionStatus,
      notes:
        respondentIndex === 1
          ? 'Wawancara daring. Koneksi sempat terputus sekali, jawaban dilanjutkan setelah tersambung kembali.'
          : respondentIndex === 2
            ? 'Narasumber tampak tergesa-gesa karena harus bekerja. Perlu meninjau ulang jawaban tentang perubahan kebiasaan.'
            : 'Narasumber terbuka dan banyak memberi contoh konkret.',
      questionIds: questions.map((q) => q.id),
      createdAt,
      updatedAt: nowIso(),
    }
    sessions.push(session)

    questions.forEach((question, questionIndex) => {
      answers.push({
        id: uid('ans'),
        projectId,
        sessionId: session.id,
        questionId: question.id,
        text: entry.answers[questionIndex] ?? '',
        interviewerNotes:
          respondentIndex === 0 && questionIndex === 4
            ? 'Narasumber menyebut notifikasi sebagai gangguan utama, bukan kurangnya waktu.'
            : '',
        status: answerStatus(questionIndex, respondentIndex),
        createdAt,
        updatedAt: nowIso(),
      })
    })
  })

  const codeBlueprints = [
    { name: 'Belajar menunggu tenggat', description: 'Belajar baru dimulai ketika ada ujian atau tugas mendesak.', color: '#C2410C' },
    { name: 'Rutinitas terjadwal', description: 'Menggunakan jadwal atau target harian untuk menjaga konsistensi.', color: '#0F5A4E' },
    { name: 'Distraksi digital', description: 'Notifikasi dan media sosial mengganggu waktu belajar.', color: '#B45309' },
    { name: 'Belajar bersama', description: 'Teman atau kelompok belajar menjadi sumber bantuan dan motivasi.', color: '#1D4ED8' },
    { name: 'Waktu terbatas', description: 'Belajar bersaing dengan pekerjaan, organisasi, atau kegiatan lain.', color: '#7C3AED' },
    { name: 'Dukungan kampus', description: 'Harapan terhadap fasilitas, jadwal, dan materi dari kampus.', color: '#0E7490' },
  ]
  const codes: Code[] = codeBlueprints.map((item) => ({
    id: uid('code'),
    projectId,
    ...item,
    createdAt,
    updatedAt: createdAt,
  }))

  const categories: Category[] = [
    { id: uid('cat'), projectId, name: 'Pengaturan diri', description: 'Cara narasumber mengatur waktu, fokus, dan prioritas belajar.', createdAt, updatedAt: createdAt },
    { id: uid('cat'), projectId, name: 'Lingkungan belajar', description: 'Tempat, alat, dan kondisi yang memengaruhi proses belajar.', createdAt, updatedAt: createdAt },
    { id: uid('cat'), projectId, name: 'Dukungan sosial dan kampus', description: 'Peran teman, keluarga, dan institusi dalam kebiasaan belajar.', createdAt, updatedAt: createdAt },
  ]

  const codeCategories: CodeCategory[] = [
    { id: uid('cc'), projectId, codeId: codes[0].id, categoryId: categories[0].id },
    { id: uid('cc'), projectId, codeId: codes[1].id, categoryId: categories[0].id },
    { id: uid('cc'), projectId, codeId: codes[2].id, categoryId: categories[1].id },
    { id: uid('cc'), projectId, codeId: codes[3].id, categoryId: categories[2].id },
    { id: uid('cc'), projectId, codeId: codes[4].id, categoryId: categories[0].id },
    { id: uid('cc'), projectId, codeId: codes[5].id, categoryId: categories[2].id },
  ]

  const themes: Theme[] = [
    {
      id: uid('thm'),
      projectId,
      name: 'Belajar reaktif menjelang tenggat',
      description: 'Kebiasaan belajar muncul terutama sebagai respons terhadap ujian dan tugas, bukan rutinitas harian.',
      interpretation:
        'Pola ini muncul pada ketiga narasumber dengan kadar berbeda. R01 dan R02 secara eksplisit menyebut tenggat sebagai pemicu utama, sementara R03 sudah mencoba menjadwalkan belajar meski masih kesulitan menjaga konsistensi. Perlu kehati-hatian: data hanya mencakup tiga narasumber sehingga pola ini belum dapat digeneralisasi.',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid('thm'),
      projectId,
      name: 'Kelompok belajar sebagai penopang ganda',
      description: 'Teman sekelas berperan sebagai sumber pemahaman materi sekaligus pengingat untuk belajar.',
      interpretation:
        'Dukungan teman disebut di semua sesi, tetapi manfaatnya bergantung pada fokus kelompok. R01 menyoroti risiko obrolan yang melebar, sedangkan R03 memanfaatkan teman kerja untuk berbagi catatan.',
      createdAt,
      updatedAt: createdAt,
    },
  ]

  const themeCategories: ThemeCategory[] = [
    { id: uid('tc'), projectId, themeId: themes[0].id, categoryId: categories[0].id },
    { id: uid('tc'), projectId, themeId: themes[1].id, categoryId: categories[2].id },
  ]

  const findAnswer = (respondentIndex: number, questionIndex: number) =>
    answers[respondentIndex * questions.length + questionIndex]

  const answerCodes: AnswerCode[] = [
    {
      id: uid('ac'),
      projectId,
      answerId: findAnswer(0, 2).id,
      codeId: codes[0].id,
      excerpt: 'Biasanya karena ada tugas atau ujian yang sudah dekat.',
      note: 'Pemicu utama bersifat eksternal dan berbatas waktu.',
      createdAt,
    },
    {
      id: uid('ac'),
      projectId,
      answerId: findAnswer(1, 0).id,
      codeId: codes[4].id,
      excerpt: 'Lebih sering malam hari karena siang penuh kelas dan kegiatan.',
      note: 'Waktu belajar tersisa setelah kegiatan lain.',
      createdAt,
    },
    {
      id: uid('ac'),
      projectId,
      answerId: findAnswer(2, 0).id,
      codeId: codes[1].id,
      excerpt: 'Saya membuat jadwal mingguan dan menandai blok belajar di kalender.',
      note: 'Strategi paling terstruktur di antara narasumber.',
      createdAt,
    },
    {
      id: uid('ac'),
      projectId,
      answerId: findAnswer(0, 6).id,
      codeId: codes[2].id,
      excerpt: 'sering jadi alasan membuka ponsel lalu lanjut ke media sosial',
      note: 'Alat bantu berubah menjadi sumber distraksi.',
      createdAt,
    },
    {
      id: uid('ac'),
      projectId,
      answerId: findAnswer(0, 7).id,
      codeId: codes[3].id,
      excerpt: 'Kelompok belajar membantu saya memahami materi yang sulit.',
      note: 'Manfaat akademik disebut lebih dulu daripada manfaat sosial.',
      createdAt,
    },
    {
      id: uid('ac'),
      projectId,
      answerId: findAnswer(2, 8).id,
      codeId: codes[5].id,
      excerpt: 'Akses rekaman kelas atau materi yang bisa dipelajari ulang.',
      note: 'Kebutuhan muncul karena benturan jadwal kerja.',
      createdAt,
    },
  ]

  const themeEvidence: ThemeEvidence[] = [
    {
      id: uid('te'),
      projectId,
      themeId: themes[0].id,
      answerId: findAnswer(0, 2).id,
      excerpt: 'Biasanya karena ada tugas atau ujian yang sudah dekat.',
      note: 'Bukti langsung bahwa tenggat menjadi pemicu.',
    },
    {
      id: uid('te'),
      projectId,
      themeId: themes[0].id,
      answerId: findAnswer(1, 2).id,
      excerpt: 'Kalau ada kuis atau tugas yang harus dikumpulkan. Saya belum bisa belajar tanpa tenggat yang jelas.',
      note: 'Pernyataan paling eksplisit tentang belajar reaktif.',
    },
    {
      id: uid('te'),
      projectId,
      themeId: themes[1].id,
      answerId: findAnswer(0, 7).id,
      excerpt: 'Kelompok belajar membantu saya memahami materi yang sulit. Tapi kalau terlalu ramai, obrolannya jadi jauh dari materi.',
      note: 'Menunjukkan manfaat dan syarat keberhasilan kelompok belajar.',
    },
  ]

  const memos: AnalysisMemo[] = [
    {
      id: uid('memo'),
      projectId,
      themeId: themes[0].id,
      content:
        'Perlu memeriksa apakah pemicu eksternal juga muncul pada narasumber dengan jam kerja padat. Data R03 mengarah ke sana, tetapi jawabannya belum cukup rinci. Pertimbangkan pertanyaan lanjutan pada sesi berikutnya.',
      createdAt: nowIso(),
    },
  ]

  return {
    projects: [project],
    documents: [document],
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
    exports: [],
  }
}
