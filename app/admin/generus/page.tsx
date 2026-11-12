'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import * as XLSX from 'xlsx'
import {
  Users,
  Search,
  Plus,
  Upload,
  Edit,
  Trash2,
  X,
  Check,
  FileSpreadsheet,
  Filter,
  Download,
  GraduationCap,
} from 'lucide-react'

// Interface Data Generus
interface Generus {
  id?: string
  nama: string
  kelompok: string
  jenis_kelamin: string
  kelas?: string
  status_sambung?: 'Mukim' | 'Sambang'
  qr_code?: string
  qr_code_id?: string
}

// Urutan prioritas kelompok kustom
const KELOMPOK_ORDER = ['GONJEN 1', 'GONJEN 2', 'KEMBARAN', 'SEMBUNG']

const normalizeExcelKey = (key: unknown) =>
  String(key ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const toExcelText = (value: unknown, fallback = '') => {
  if (value === null || value === undefined) return fallback
  return String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
}

const normalizeJenisKelamin = (value: unknown) => {
  const normalized = toExcelText(value).toLowerCase()
  if (/^(p|pr|perempuan|wanita|female|f)$/.test(normalized)) return 'Perempuan'
  if (/^(l|lk|laki[- ]?laki|pria|male|m)$/.test(normalized)) return 'Laki-laki'
  return normalized ? toExcelText(value) : 'Laki-laki'
}

const normalizeStatusSambung = (value: unknown): 'Mukim' | 'Sambang' => {
  const normalized = toExcelText(value).toLowerCase()
  if (/^sambang$/.test(normalized)) return 'Sambang'
  return 'Mukim' // Default Mukim
}

// Helper function untuk mengurutkan: Kelompok -> Nama
const sortGenerus = (data: Generus[]) => {
  return [...data].sort((a, b) => {
    const orderA = KELOMPOK_ORDER.indexOf(a.kelompok)
    const orderB = KELOMPOK_ORDER.indexOf(b.kelompok)

    if (orderA !== -1 && orderB !== -1) {
      if (orderA !== orderB) {
        return orderA - orderB
      }
    } else if (orderA !== -1) {
      return -1
    } else if (orderB !== -1) {
      return 1
    } else {
      const kelCompare = (a.kelompok || '').localeCompare(b.kelompok || '')
      if (kelCompare !== 0) return kelCompare
    }

    return a.nama.localeCompare(b.nama)
  })
}

export default function AdminGenerusPage() {
  const supabase = createClient()

  // State Utama
  const [generusList, setGenerusList] = useState<Generus[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedKelompok, setSelectedKelompok] = useState('Semua Kelompok')
  const [selectedStatusSambung, setSelectedStatusSambung] = useState('Semua Status')

  // State Modal CRUD
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingData, setEditingData] = useState<Generus | null>(null)
  const [formData, setFormData] = useState<Generus>({
    nama: '',
    kelompok: 'GONJEN 1',
    jenis_kelamin: 'Laki-laki',
    kelas: 'Pra Remaja',
    status_sambung: 'Mukim',
  })

  // State File Import
  const [importFile, setImportFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchGenerus()
  }, [])

  // 1. Fetch Data dari Supabase & Urutkan secara Kustom
  const fetchGenerus = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('generus').select('*')
    if (data && !error) {
      const sortedData = sortGenerus(data as Generus[])
      setGenerusList(sortedData)
    }
    setLoading(false)
  }

  // 2. Fungsi Tambah & Edit Manual
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nama.trim()) return alert('Nama lengkap wajib diisi!')

    if (editingData?.id) {
      // Update
      const { error } = await supabase
        .from('generus')
        .update({
          nama: formData.nama,
          kelompok: formData.kelompok,
          jenis_kelamin: formData.jenis_kelamin,
          kelas: formData.kelas,
          status_sambung: formData.status_sambung,
        })
        .eq('id', editingData.id)

      if (error) alert('Gagal memperbarui data: ' + error.message)
      else alert('Data berhasil diperbarui!')
    } else {
      // Insert Baru
      const { error } = await supabase.from('generus').insert([
        {
          nama: formData.nama,
          kelompok: formData.kelompok,
          jenis_kelamin: formData.jenis_kelamin,
          kelas: formData.kelas,
          status_sambung: formData.status_sambung,
        },
      ])

      if (error) alert('Gagal menambah data: ' + error.message)
      else alert('Data baru berhasil ditambahkan!')
    }

    closeModal()
    fetchGenerus()
  }

  // 3. Fungsi Hapus Data
  const handleDelete = async (id: string, nama: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data ${nama}?`)) {
      const { error } = await supabase.from('generus').delete().eq('id', id)
      if (error) alert('Gagal menghapus data: ' + error.message)
      else {
        alert('Data berhasil dihapus!')
        fetchGenerus()
      }
    }
  }

  // 4. Download Template Excel/CSV
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        nama: 'Contoh Nama Generus 1',
        kelompok: 'GONJEN 1',
        jenis_kelamin: 'Laki-laki',
        kelas: 'Pra Remaja',
        status_sambung: 'Mukim',
      },
      {
        nama: 'Contoh Nama Generus 2',
        kelompok: 'GONJEN 2',
        jenis_kelamin: 'Perempuan',
        kelas: 'Remaja',
        status_sambung: 'Sambang',
      },
    ]
    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Generus')
    XLSX.writeFile(workbook, 'Template_Import_Generus.xlsx')
  }

  // 5. Export Semua Data / Data Terfilter ke Excel
  const handleExportExcel = () => {
    if (filteredGenerus.length === 0) {
      return alert('Tidak ada data generus yang sesuai untuk diekspor!')
    }

    const exportData = filteredGenerus.map((item, index) => ({
      No: index + 1,
      'Nama Lengkap': item.nama,
      Kelompok: item.kelompok || '-',
      'Jenis Kelamin': item.jenis_kelamin || '-',
      'Kelas / Tingkat': item.kelas || '-',
      'Status Sambung': item.status_sambung || 'Mukim',
      'Kode QR / ID': item.qr_code_id || item.qr_code || item.id || '-',
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Generus')

    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 15 },
      { wch: 25 },
    ]

    const filename =
      selectedKelompok === 'Semua Kelompok'
        ? 'Data_Seluruh_Generus.xlsx'
        : `Data_Generus_${selectedKelompok.replace(/\s+/g, '_')}.xlsx`

    XLSX.writeFile(workbook, filename)
  }

  // 6. Import Massal (Bulk Upload Excel / CSV)
  const handleImportExcel = async () => {
    if (!importFile) return alert('Pilih berkas Excel/CSV terlebih dahulu!')
    setUploading(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const parsedData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
        })

        if (parsedData.length === 0) {
          alert('File kosong atau format tidak sesuai!')
          setUploading(false)
          return
        }

        const formattedData = parsedData
          .map((row) => {
            const normalizedRow = Object.fromEntries(
              Object.entries(row).map(([key, value]) => [normalizeExcelKey(key), value])
            )
            const nama = toExcelText(normalizedRow.nama || normalizedRow.namalengkap)
            const jenisKelamin =
              normalizedRow.jeniskelamin ||
              normalizedRow.jeniskelaminlp ||
              normalizedRow.jk ||
              normalizedRow.gender
            const statusSambung =
              normalizedRow.statussambung || normalizedRow.status || normalizedRow.sambung

            return {
              nama,
              kelompok: toExcelText(normalizedRow.kelompok, 'GONJEN 1'),
              jenis_kelamin: normalizeJenisKelamin(jenisKelamin),
              kelas: toExcelText(
                normalizedRow.kelas || normalizedRow.kelastingkat,
                'Pra Remaja'
              ),
              status_sambung: normalizeStatusSambung(statusSambung),
            }
          })
          .filter((item) => item.nama !== '')

        const { error } = await supabase.from('generus').insert(formattedData)

        if (error) {
          alert('Gagal mengimpor data: ' + error.message)
        } else {
          alert(`Berhasil mengimpor ${formattedData.length} data generus!`)
          setIsImportModalOpen(false)
          setImportFile(null)
          fetchGenerus()
        }
      } catch (err) {
        console.error(err)
        alert('Terjadi kesalahan saat membaca file!')
      } finally {
        setUploading(false)
      }
    }
    reader.readAsArrayBuffer(importFile)
  }

  // Helper Modal
  const openAddModal = () => {
    setEditingData(null)
    setFormData({
      nama: '',
      kelompok: 'GONJEN 1',
      jenis_kelamin: 'Laki-laki',
      kelas: 'Pra Remaja',
      status_sambung: 'Mukim',
    })
    setIsModalOpen(true)
  }

  const openEditModal = (item: Generus) => {
    setEditingData(item)
    setFormData({
      nama: item.nama,
      kelompok: item.kelompok || 'GONJEN 1',
      jenis_kelamin: item.jenis_kelamin || 'Laki-laki',
      kelas: item.kelas || 'Pra Remaja',
      status_sambung: item.status_sambung || 'Mukim',
    })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingData(null)
  }

  // Filtering Data berdasarkan Kelompok, Status Sambung, dan Pencarian
  const kelompokList = Array.from(
    new Set(generusList.map((g) => g.kelompok).filter(Boolean))
  )
  const filteredGenerus = generusList.filter((g) => {
    const matchKelompok =
      selectedKelompok === 'Semua Kelompok' || g.kelompok === selectedKelompok
    const matchStatus =
      selectedStatusSambung === 'Semua Status' || g.status_sambung === selectedStatusSambung
    const matchSearch =
      g.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.kelas && g.kelas.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchKelompok && matchStatus && matchSearch
  })

  // Ringkasan Statistik Dinamis
  const totalGenerus = filteredGenerus.length
  const totalMukim = filteredGenerus.filter((g) => g.status_sambung === 'Mukim' || !g.status_sambung).length
  const totalSambang = filteredGenerus.filter((g) => g.status_sambung === 'Sambang').length

  // Rekap Hitung Jumlah Generus Per Jenjang Kelas (Dinamis berdasarkan filter)
  const rekapKelas = filteredGenerus.reduce((acc, curr) => {
    const k = curr.kelas?.trim() || 'Lainnya'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        {/* Header Section & Action Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Data Generus</h1>
            <p className="text-sm text-slate-500 mt-1">
              Kelola dan lihat ringkasan data seluruh anggota generus beserta status mukim/sambang.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" /> Export Data
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Template Excel
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Import Data
            </button>
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Tambah Manual
            </button>
          </div>
        </div>

        {/* Ringkasan Metrics Utama */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Generus {selectedKelompok !== 'Semua Kelompok' && `(${selectedKelompok})`}
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalGenerus}</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mukim</p>
              <p className="text-2xl font-extrabold text-purple-600 mt-1">{totalMukim}</p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sambang</p>
              <p className="text-2xl font-extrabold text-amber-600 mt-1">{totalSambang}</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Rekap Per Jenjang Kelas (Compact List/Chips Bar) */}
        <div className="bg-white px-5 py-3.5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-2 uppercase tracking-wider">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>Jenjang Kelas:</span>
          </div>
          {Object.keys(rekapKelas).length === 0 ? (
            <span className="text-xs text-slate-400 font-medium">Tidak ada data</span>
          ) : (
            Object.entries(rekapKelas).map(([kelasName, count]) => (
              <div
                key={kelasName}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200/70 border border-slate-200/60 rounded-full text-xs font-medium text-slate-700 transition"
              >
                <span>{kelasName}</span>
                <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[20px] text-center">
                  {count}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau kelas generus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedKelompok}
              onChange={(e) => setSelectedKelompok(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Semua Kelompok">Semua Kelompok</option>
              {kelompokList.map((kel) => (
                <option key={kel} value={kel}>
                  {kel}
                </option>
              ))}
            </select>
            <select
              value={selectedStatusSambung}
              onChange={(e) => setSelectedStatusSambung(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="Semua Status">Semua Status</option>
              <option value="Mukim">Mukim</option>
              <option value="Sambang">Sambang</option>
            </select>
          </div>
        </div>

        {/* Tabel Data Generus */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Nama Lengkap</th>
                  <th className="py-3.5 px-4">Kelompok</th>
                  <th className="py-3.5 px-4">Jenis Kelamin</th>
                  <th className="py-3.5 px-4">Kelas / Tingkat</th>
                  <th className="py-3.5 px-4">Status Sambung</th>
                  <th className="py-3.5 px-4 text-center">Kode QR</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      Memuat data generus...
                    </td>
                  </tr>
                ) : filteredGenerus.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      Data tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredGenerus.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{item.nama}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200/60 rounded-md text-xs">
                          {item.kelompok || '-'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            item.jenis_kelamin?.toLowerCase().includes('perempuan')
                              ? 'bg-pink-50 text-pink-600 border border-pink-100'
                              : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}
                        >
                          {item.jenis_kelamin}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{item.kelas || '-'}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            item.status_sambung === 'Sambang'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-purple-50 text-purple-700 border border-purple-200'
                          }`}
                        >
                          {item.status_sambung || 'Mukim'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-slate-400 text-xs">
                        {item.qr_code_id || item.qr_code || item.id?.slice(0, 6).toUpperCase() || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id!, item.nama)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal CRUD Manual (Tambah / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingData ? 'Edit Data Generus' : 'Tambah Generus Manual'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveManual} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Masukkan nama lengkap..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kelompok</label>
                  <select
                    value={formData.kelompok}
                    onChange={(e) => setFormData({ ...formData, kelompok: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="GONJEN 1">GONJEN 1</option>
                    <option value="GONJEN 2">GONJEN 2</option>
                    <option value="KEMBARAN">KEMBARAN</option>
                    <option value="SEMBUNG">SEMBUNG</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status Sambung</label>
                  <select
                    value={formData.status_sambung}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status_sambung: e.target.value as 'Mukim' | 'Sambang',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Mukim">Mukim</option>
                    <option value="Sambang">Sambang</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={formData.jenis_kelamin}
                    onChange={(e) => setFormData({ ...formData, jenis_kelamin: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kelas / Tingkat</label>
                  <select
                    value={formData.kelas}
                    onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="Caberawit">Caberawit</option>
                    <option value="Pra Remaja">Pra Remaja</option>
                    <option value="Remaja">Remaja</option>
                    <option value="Pra Nikah">Pra Nikah</option>
                    <option value="Mandiri">Mandiri</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Import Data Excel */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Import Data Generus (.xlsx / .csv)
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 text-xs sm:text-sm">
              <p className="text-slate-500">
                Gunakan template Excel resmi agar format kolom (termasuk status sambung) sesuai saat diunggah.
              </p>
              <div className="border-2 border-dashed border-slate-200 p-6 rounded-2xl text-center bg-slate-50/50">
                <input
                  type="file"
                  accept=".xlsx, .csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleImportExcel}
                  disabled={uploading || !importFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Upload className="w-4 h-4" /> {uploading ? 'Mengunggah...' : 'Unggah Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
