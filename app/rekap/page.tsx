'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowLeft, Search, Download, Printer, CalendarDays, TableProperties } from 'lucide-react'
import * as XLSX from 'xlsx'

type AcaraItem = {
  id: string
  nama_acara: string
  tanggal: string
  lokasi?: string
  koor?: string
}

type GenerusItem = {
  id: string
  nama: string
  kelas: string
  kelompok: string
  jenis_kelamin: string
}

type PresensiEntry = {
  status: 'Hadir' | 'Izin' | 'Alpa / Belum Presensi'
  alasan: string
  metode: string
}

type PresensiRow = {
  [acaraId: string]: 'H' | 'I' | 'A'
}

export default function RekapPage() {
  const supabase = useMemo(() => createClient(), [])
  const [viewMode, setViewMode] = useState<'acara' | 'tahunan'>('acara')

  const [acaraList, setAcaraList] = useState<AcaraItem[]>([])
  const [selectedAcara, setSelectedAcara] = useState<string>('')
  const [generusList, setGenerusList] = useState<GenerusItem[]>([])
  const [presensiMap, setPresensiMap] = useState<Record<string, PresensiEntry>>({})
  const [presensiGrid, setPresensiGrid] = useState<Record<string, PresensiRow>>({})

  const [selectedKelompok, setSelectedKelompok] = useState<string>('Semua')
  const [selectedJK, setSelectedJK] = useState<string>('Semua')
  const [selectedStatus, setSelectedStatus] = useState<string>('Semua')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedAcaraObj = useMemo(
    () => acaraList.find((acara) => acara.id === selectedAcara) ?? null,
    [acaraList, selectedAcara],
  )

  const fetchAcara = useCallback(async () => {
    const { data } = await supabase
      .from('acara')
      .select('*')
      .order('tanggal', { ascending: true })

    if (data) {
      setAcaraList(data as AcaraItem[])
      if (data.length > 0 && !selectedAcara) {
        setSelectedAcara(data[0].id)
      }
    }
  }, [supabase, selectedAcara])

  // Ambil data untuk Mode Per Acara
  const fetchRekapData = useCallback(async () => {
    if (!selectedAcara) return

    setLoading(true)

    const { data: generusData } = await supabase
      .from('generus')
      .select('*')
      .order('kelompok', { ascending: true })
      .order('nama', { ascending: true })

    const { data: presensiData } = await supabase
      .from('presensi')
      .select('*')
      .eq('acara_id', selectedAcara)

    if (generusData) {
      setGenerusList(generusData as GenerusItem[])

      const nextMap: Record<string, PresensiEntry> = {}
      generusData.forEach((generus) => {
        nextMap[generus.id] = {
          status: 'Alpa / Belum Presensi',
          alasan: '-',
          metode: '-',
        }
      })

      if (presensiData) {
        presensiData.forEach((entry) => {
          let currentStatus: PresensiEntry['status'] = 'Alpa / Belum Presensi'

          if (
            entry.status === 'sakit' ||
            entry.status === 'Sakit' ||
            entry.status === 'izin' ||
            entry.status === 'Izin'
          ) {
            currentStatus = 'Izin'
          } else if (entry.status === 'hadir' || entry.status === 'Hadir') {
            currentStatus = 'Hadir'
          }

          nextMap[entry.generus_id] = {
            status: currentStatus,
            alasan: entry.alasan || '-',
            metode: entry.metode || 'Manual',
          }
        })
      }

      setPresensiMap(nextMap)
    }

    setLoading(false)
  }, [selectedAcara, supabase])

  // Ambil data untuk Mode Tahunan (Matriks Semua Acara)
  const fetchDataTahunan = useCallback(async () => {
    setLoading(true)

    const { data: acaraData } = await supabase
      .from('acara')
      .select('id, nama_acara, tanggal')
      .order('tanggal', { ascending: true })

    const { data: generusData } = await supabase
      .from('generus')
      .select('*')
      .order('kelompok', { ascending: true })
      .order('nama', { ascending: true })

    const { data: semuaPresensi } = await supabase
      .from('presensi')
      .select('generus_id, acara_id, status')

    if (acaraData) setAcaraList(acaraData as AcaraItem[])
    if (generusData) setGenerusList(generusData as GenerusItem[])

    if (generusData && semuaPresensi) {
      const gridMap: Record<string, PresensiRow> = {}

      generusData.forEach((g) => {
        gridMap[g.id] = {}
      })

      semuaPresensi.forEach((p) => {
        if (!gridMap[p.generus_id]) {
          gridMap[p.generus_id] = {}
        }

        let shortStatus: 'H' | 'I' | 'A' = 'A'
        const st = (p.status || '').toLowerCase()
        if (st === 'hadir') {
          shortStatus = 'H'
        } else if (st === 'izin' || st === 'sakit') {
          shortStatus = 'I'
        }

        gridMap[p.generus_id][p.acara_id] = shortStatus
      })

      setPresensiGrid(gridMap)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchAcara()
  }, [fetchAcara])

  useEffect(() => {
    if (viewMode === 'acara' && selectedAcara) {
      fetchRekapData()
    } else if (viewMode === 'tahunan') {
      fetchDataTahunan()
    }
  }, [viewMode, selectedAcara, fetchRekapData, fetchDataTahunan])

  // Filter Generus
  const filteredGenerus = generusList.filter((generus) => {
    const statusGenerus = presensiMap[generus.id]?.status || 'Alpa / Belum Presensi'
    const matchKelompok = selectedKelompok === 'Semua' || generus.kelompok === selectedKelompok
    const matchJK = selectedJK === 'Semua' || generus.jenis_kelamin === selectedJK
    const matchStatus = viewMode === 'tahunan' || selectedStatus === 'Semua' || statusGenerus === selectedStatus
    const matchSearch =
      generus.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (generus.kelas || '').toLowerCase().includes(searchQuery.toLowerCase())

    return matchKelompok && matchJK && matchStatus && matchSearch
  })

  // Statistik Mode Acara
  const totalGenerus = filteredGenerus.length
  let totalHadir = 0
  let totalIzin = 0
  let totalAlpa = 0

  filteredGenerus.forEach((generus) => {
    const status = presensiMap[generus.id]?.status
    if (status === 'Hadir') totalHadir += 1
    else if (status === 'Izin') totalIzin += 1
    else totalAlpa += 1
  })

  const persentaseHadir = totalGenerus > 0 ? ((totalHadir / totalGenerus) * 100).toFixed(1) : '0'

  // Export Excel
  const handleExportExcel = () => {
    if (viewMode === 'acara') {
      if (!selectedAcaraObj) {
        alert('Pilih acara terlebih dahulu!')
        return
      }

      const dataToExport = filteredGenerus.map((generus, index) => {
        const pData = presensiMap[generus.id] || {
          status: 'Alpa / Belum Presensi',
          alasan: '-',
          metode: '-',
        }

        return {
          No: index + 1,
          'Nama Lengkap': generus.nama,
          'Jenis Kelamin': generus.jenis_kelamin,
          Kelompok: generus.kelompok,
          'Kelas / Tingkat': generus.kelas,
          'Status Kehadiran': pData.status,
          'Alasan (Izin)': pData.alasan,
          'Metode Presensi': pData.metode,
        }
      })

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Presensi')

      const namaAcaraClean = selectedAcaraObj.nama_acara.replace(/[^a-zA-Z0-9]/g, '_')
      XLSX.writeFile(workbook, `Rekap_Presensi_${namaAcaraClean}_${selectedAcaraObj.tanggal}.xlsx`)
    } else {
      const dataToExport = filteredGenerus.map((generus, index) => {
        const rowData: Record<string, any> = {
          No: index + 1,
          'Nama Lengkap': generus.nama,
          'Jenis Kelamin': generus.jenis_kelamin,
          Kelompok: generus.kelompok,
          'Kelas / Tingkat': generus.kelas,
        }

        let hadirCount = 0
        acaraList.forEach((acara) => {
          const st = presensiGrid[generus.id]?.[acara.id] || 'A'
          rowData[acara.nama_acara] = st
          if (st === 'H') hadirCount += 1
        })

        const totalAcara = acaraList.length
        rowData['Persentase Kehadiran'] = totalAcara > 0 ? `${((hadirCount / totalAcara) * 100).toFixed(1)}%` : '0%'

        return rowData
      })

      const worksheet = XLSX.utils.json_to_sheet(dataToExport)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Tahunan')
      XLSX.writeFile(workbook, `Rekap_Presensi_Tahunan.xlsx`)
    }
  }

  const handlePrintPDF = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-900 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto px-3 pt-6 pb-10 space-y-6 print:max-w-none print:p-0 print:m-0">
        <style jsx global>{`
          @media print {
            @page {
              size: A4 ${viewMode === 'tahunan' ? 'landscape' : 'portrait'};
              margin: 10mm;
            }
            body {
              background-color: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body * {
              visibility: hidden;
            }
            #print-area, #print-area * {
              visibility: visible;
            }
            #print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
            .print-border-table th,
            .print-border-table td {
              border: 1px solid #d1d5db !important;
            }
          }
        `}</style>

        {/* Tombol Kembali & Switch Mode */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
          </Link>

          {/* Toggle View Mode */}
          <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setViewMode('acara')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'acara' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              <CalendarDays className="w-4 h-4" /> Rekap Per Acara
            </button>
            <button
              onClick={() => setViewMode('tahunan')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                viewMode === 'tahunan' ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:text-white'
              }`}
            >
              <TableProperties className="w-4 h-4" /> Rekap Matriks Tahunan (H/I/A)
            </button>
          </div>
        </div>

        {/* Header & Filter Controls */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-4 no-print">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {viewMode === 'acara' ? 'Rekap Presensi Viewer (Per Acara)' : 'Rekap Kehadiran Tahunan (Semua Acara)'}
              </h1>
              <p className="text-sm text-gray-500">
                {viewMode === 'acara'
                  ? 'Laporan ringkasan dan persentase kehadiran generus per acara.'
                  : 'Matriks kehadiran seluruh generus (H = Hadir, I = Izin/Sakit, A = Alpa).'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-emerald-700 transition flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" /> Export Excel
              </button>
              <button
                onClick={handlePrintPDF}
                className="px-3.5 py-2 bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-slate-900 transition flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Cetak / PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {viewMode === 'acara' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Pilih Acara</label>
                <select
                  value={selectedAcara}
                  onChange={(e) => setSelectedAcara(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-gray-50 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 font-medium text-stone-800 cursor-pointer"
                >
                  <option value="">-- Pilih Acara --</option>
                  {acaraList.map((acara) => (
                    <option key={acara.id} value={acara.id}>
                      {acara.nama_acara} - {acara.tanggal}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Filter Kelompok</label>
              <select
                value={selectedKelompok}
                onChange={(e) => setSelectedKelompok(e.target.value)}
                className="w-full p-2.5 border rounded-lg bg-gray-50 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 text-stone-800 cursor-pointer"
              >
                <option value="Semua">Semua Kelompok</option>
                <option value="GONJEN 1">GONJEN 1</option>
                <option value="GONJEN 2">GONJEN 2</option>
                <option value="KEMBARAN">KEMBARAN</option>
                <option value="SEMBUNG">SEMBUNG</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Filter Jenis Kelamin</label>
              <select
                value={selectedJK}
                onChange={(e) => setSelectedJK(e.target.value)}
                className="w-full p-2.5 border rounded-lg bg-gray-50 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 text-stone-800 cursor-pointer"
              >
                <option value="Semua">Semua Jenis Kelamin</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>

            {viewMode === 'acara' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Filter Status Kehadiran</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-gray-50 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 text-stone-800 cursor-pointer font-medium"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="Hadir">Hadir</option>
                  <option value="Izin">Izin</option>
                  <option value="Alpa / Belum Presensi">Alpa / Belum Presensi</option>
                </select>
              </div>
            )}

            <div className={viewMode === 'acara' ? 'sm:col-span-2 lg:col-span-4' : 'sm:col-span-2'}>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Cari Nama Generus</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau kelas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500 text-stone-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* AREA TAMPILAN PRINT / KONTEN UTAMA */}
        <div id="print-area" className="space-y-4">
          {viewMode === 'acara' ? (
            /* --- TAMPILAN 1: REKAP PER ACARA --- */
            <>
              {selectedAcaraObj && (
                <div className="hidden print:block mb-4">
                  <div className="border-t-2 border-b-2 border-gray-800 py-3 mb-4 text-center">
                    <h1 className="text-xl font-black tracking-wide text-gray-900 uppercase">
                      LAPORAN REKAPITULASI PRESENSI
                    </h1>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 text-xs text-gray-800 font-medium mb-4">
                    <div>
                      <span className="font-bold">Nama Acara:</span> {selectedAcaraObj.nama_acara?.toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold">Tanggal:</span> {selectedAcaraObj.tanggal}
                    </div>
                    <div>
                      <span className="font-bold">Lokasi:</span> {selectedAcaraObj.lokasi || '-'}
                    </div>
                    <div>
                      <span className="font-bold">Koordinator:</span> {selectedAcaraObj.koor || '-'}
                    </div>
                  </div>
                </div>
              )}

              {selectedAcara && (
                <div className="space-y-4 mb-4">
                  {/* Statistik Utama */}
                  <div className="grid grid-cols-5 gap-3 print:gap-2">
                    <div className="bg-white p-3 rounded-xl print:rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
                      <p className="text-[11px] text-gray-600 font-semibold leading-tight">Total Generus</p>
                      <p className="text-lg print:text-base font-bold text-gray-900 mt-1">{totalGenerus}</p>
                    </div>

                    <div className="bg-white p-3 rounded-xl print:rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
                      <p className="text-[11px] text-gray-600 font-semibold leading-tight">Hadir</p>
                      <p className="text-lg print:text-base font-bold text-green-600 mt-1">{totalHadir}</p>
                    </div>

                    <div className="bg-white p-3 rounded-xl print:rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
                      <p className="text-[11px] text-gray-600 font-semibold leading-tight">Izin</p>
                      <p className="text-lg print:text-base font-bold text-amber-600 mt-1">{totalIzin}</p>
                    </div>

                    <div className="bg-white p-3 rounded-xl print:rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
                      <p className="text-[11px] text-gray-600 font-semibold leading-tight">Alpa</p>
                      <p className="text-lg print:text-base font-bold text-gray-500 mt-1">{totalAlpa}</p>
                    </div>

                    <div className="bg-white p-3 rounded-xl print:rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
                      <p className="text-[11px] text-gray-600 font-semibold leading-tight">Persentase</p>
                      <p className="text-lg print:text-base font-bold text-blue-600 mt-1">{persentaseHadir}%</p>
                    </div>
                  </div>

                  {/* Rincian L & Perempuan & Kelompok (Hanya tampil jika "Semua" kelompok dipilih) */}
                  {(() => {
                    const listL = filteredGenerus.filter((g) => g.jenis_kelamin?.toLowerCase() === 'laki-laki')
                    const totalL = listL.length
                    const hadirL = listL.filter((g) => presensiMap[g.id]?.status === 'Hadir').length
                    const izinL = listL.filter((g) => presensiMap[g.id]?.status === 'Izin').length
                    const alpaL = listL.filter((g) => presensiMap[g.id]?.status === 'Alpa / Belum Presensi').length
                    const persentaseL = totalL > 0 ? ((hadirL / totalL) * 100).toFixed(1) : '0'

                    const listP = filteredGenerus.filter((g) => g.jenis_kelamin?.toLowerCase() === 'perempuan')
                    const totalP = listP.length
                    const hadirP = listP.filter((g) => presensiMap[g.id]?.status === 'Hadir').length
                    const izinP = listP.filter((g) => presensiMap[g.id]?.status === 'Izin').length
                    const alpaP = listP.filter((g) => presensiMap[g.id]?.status === 'Alpa / Belum Presensi').length
                    const persentaseP = totalP > 0 ? ((hadirP / totalP) * 100).toFixed(1) : '0'

                    const daftarKelompok = Array.from(new Set(generusList.map((g) => g.kelompok))).filter(Boolean)

                    return (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Laki-laki */}
                          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                            <div className="flex justify-between items-center border-b pb-1.5">
                              <span className="text-xs font-bold text-gray-800 uppercase">Laki-laki (L)</span>
                              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                {persentaseL}% (Total: {totalL})
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                              <div className="bg-gray-50 p-1.5 rounded">
                                <span className="text-gray-500 block text-[10px]">Hadir</span>
                                <span className="font-bold text-green-600">{hadirL}</span>
                              </div>
                              <div className="bg-gray-50 p-1.5 rounded">
                                <span className="text-gray-500 block text-[10px]">Izin</span>
                                <span className="font-bold text-amber-600">{izinL}</span>
                              </div>
                              <div className="bg-gray-50 p-1.5 rounded">
                                <span className="text-gray-500 block text-[10px]">Alpa</span>
                                <span className="font-bold text-gray-500">{alpaL}</span>
                              </div>
                              <div className="bg-blue-50/50 p-1.5 rounded border border-blue-100">
                                <span className="text-blue-600 block text-[10px] font-semibold">Persen</span>
                                <span className="font-bold text-blue-700">{persentaseL}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Perempuan */}
                          <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-2">
                            <div className="flex justify-between items-center border-b pb-1.5">
                              <span className="text-xs font-bold text-gray-800 uppercase">Perempuan</span>
                              <span className="text-xs font-semibold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">
                                {persentaseP}% (Total: {totalP})
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                              <div className="bg-gray-50 p-1.5 rounded">
                                <span className="text-gray-500 block text-[10px]">Hadir</span>
                                <span className="font-bold text-green-600">{hadirP}</span>
                              </div>
                              <div className="bg-gray-50 p-1.5 rounded">
                                <span className="text-gray-500 block text-[10px]">Izin</span>
                                <span className="font-bold text-amber-600">{izinP}</span>
                              </div>
                              <div className="bg-gray-50 p-1.5 rounded">
                                <span className="text-gray-500 block text-[10px]">Alpa</span>
                                <span className="font-bold text-gray-500">{alpaP}</span>
                              </div>
                              <div className="bg-pink-50/50 p-1.5 rounded border border-pink-100">
                                <span className="text-pink-600 block text-[10px] font-semibold">Persen</span>
                                <span className="font-bold text-pink-700">{persentaseP}%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Rincian Per Kelompok (Hanya tampil jika Filter Kelompok = 'Semua') */}
                        {selectedKelompok === 'Semua' && (
                          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b pb-2">
                              Rincian Per Kelompok
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                              {daftarKelompok.map((kelompok) => {
                                const listKeluarga = generusList.filter((g) => g.kelompok === kelompok && (selectedJK === 'Semua' || g.jenis_kelamin === selectedJK))
                                const totalK = listKeluarga.length
                                const hadirK = listKeluarga.filter((g) => presensiMap[g.id]?.status === 'Hadir').length
                                const izinK = listKeluarga.filter((g) => presensiMap[g.id]?.status === 'Izin').length
                                const alpaK = listKeluarga.filter((g) => presensiMap[g.id]?.status === 'Alpa / Belum Presensi').length
                                const persentaseK = totalK > 0 ? ((hadirK / totalK) * 100).toFixed(1) : '0'

                                return (
                                  <div key={kelompok} className="bg-gray-50 p-3 rounded-lg border border-gray-200/80 space-y-2">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs font-bold text-gray-800">{kelompok}</span>
                                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                        {persentaseK}%
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-gray-600 grid grid-cols-2 gap-y-1 pt-1 border-t border-gray-200">
                                      <div>Total: <span className="font-semibold text-gray-800">{totalK}</span></div>
                                      <div>Hadir: <span className="font-semibold text-green-600">{hadirK}</span></div>
                                      <div>Izin: <span className="font-semibold text-amber-600">{izinK}</span></div>
                                      <div>Alpa: <span className="font-semibold text-gray-500">{alpaK}</span></div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Tabel Detail Acara */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {!selectedAcara ? (
                  <div className="p-8 text-center text-gray-400 text-sm">
                    Silakan pilih acara terlebih dahulu untuk melihat rekap kehadiran.
                  </div>
                ) : loading ? (
                  <div className="p-8 text-center text-gray-500 text-sm">Memuat data rekap...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm print:text-xs print-border-table border-collapse">
                      <thead className="bg-gray-50 print:bg-white border-b text-xs uppercase text-gray-700 font-bold">
                        <tr>
                          <th className="p-3 border-gray-200 w-2/5">NAMA GENERUS</th>
                          <th className="p-3 border-gray-200 w-1/4">KELOMPOK / KELAS</th>
                          <th className="p-3 border-gray-200 w-1/5">STATUS KEHADIRAN</th>
                          <th className="p-3 border-gray-200">ALASAN (IZIN / SAKIT)</th>
                          <th className="p-3 border-gray-200 text-center no-print">METODE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredGenerus.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-gray-400 text-sm">
                              Tidak ada data generus yang sesuai dengan filter.
                            </td>
                          </tr>
                        ) : (
                          filteredGenerus.map((generus) => {
                            const pData = presensiMap[generus.id] || {
                              status: 'Alpa / Belum Presensi',
                              alasan: '-',
                              metode: '-',
                            }

                            return (
                              <tr key={generus.id} className="hover:bg-gray-50/50 transition">
                                <td className="p-3 border-gray-200">
                                  <div className="font-bold text-gray-900 uppercase tracking-wide">
                                    {generus.nama}
                                  </div>
                                  <div className="text-xs text-gray-500 capitalize">
                                    {generus.jenis_kelamin}
                                  </div>
                                </td>
                                <td className="p-3 border-gray-200 text-gray-700 font-medium">
                                  <div>{generus.kelompok}</div>
                                  <div className="text-xs text-gray-500">{generus.kelas}</div>
                                </td>
                                <td className="p-3 border-gray-200">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                      pData.status === 'Hadir'
                                        ? 'bg-green-100 text-green-700'
                                        : pData.status === 'Izin'
                                          ? 'bg-amber-100 text-amber-700'
                                          : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {pData.status}
                                  </span>
                                </td>
                                <td className="p-3 border-gray-200 text-gray-700 text-xs">{pData.alasan}</td>
                                <td className="p-3 border-gray-200 text-center text-xs text-gray-400 font-mono no-print">
                                  {pData.metode}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* --- TAMPILAN 2: REKAP TAHUNAN (MATRIKS H/I/A) --- */
            <>
              <div className="hidden print:block mb-4 text-center">
                <h1 className="text-lg font-black tracking-wide text-gray-900 uppercase">
                  LAPORAN REKAPITULASI PRESENSI TAHUNAN
                </h1>
                <p className="text-xs text-gray-600">Keterangan: H = Hadir, I = Izin/Sakit, A = Alpa/Belum Presensi</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center text-gray-500 text-sm">Memuat data rekap tahunan...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-50 border-b uppercase text-gray-700 font-bold">
                        <tr>
                          <th className="p-3 border-r sticky left-0 bg-gray-50 z-10">Nama Generus</th>
                          <th className="p-3 border-r">Kelompok</th>
                          {acaraList.map((acara) => (
                            <th key={acara.id} className="p-3 border-r text-center min-w-[100px]" title={acara.nama_acara}>
                              <div className="truncate max-w-[120px]">{acara.nama_acara}</div>
                              <div className="text-[10px] text-gray-400 font-normal">{acara.tanggal}</div>
                            </th>
                          ))}
                          <th className="p-3 text-center bg-blue-50 text-blue-800 min-w-[90px]">
                            Persentase
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredGenerus.length === 0 ? (
                          <tr>
                            <td colSpan={3 + acaraList.length} className="p-8 text-center text-gray-400">
                              Tidak ada data generus.
                            </td>
                          </tr>
                        ) : (
                          filteredGenerus.map((generus) => {
                            const totalAcara = acaraList.length
                            let hadirCount = 0
                            acaraList.forEach((acara) => {
                              const st = presensiGrid[generus.id]?.[acara.id]
                              if (st === 'H') hadirCount += 1
                            })
                            const persentaseIndividu = totalAcara > 0 ? ((hadirCount / totalAcara) * 100).toFixed(1) : '0'

                            return (
                              <tr key={generus.id} className="hover:bg-gray-50 transition">
                                <td className="p-3 border-r font-bold text-gray-900 sticky left-0 bg-white z-10 uppercase">
                                  {generus.nama}
                                  <div className="text-[10px] font-normal text-gray-500">{generus.kelas}</div>
                                </td>
                                <td className="p-3 border-r text-gray-700">{generus.kelompok}</td>
                                {acaraList.map((acara) => {
                                  const status = presensiGrid[generus.id]?.[acara.id] || 'A'
                                  return (
                                    <td key={acara.id} className="p-3 border-r text-center font-bold">
                                      <span
                                        className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                                          status === 'H'
                                            ? 'bg-green-100 text-green-700'
                                            : status === 'I'
                                              ? 'bg-amber-100 text-amber-700'
                                              : 'bg-gray-100 text-gray-400'
                                        }`}
                                      >
                                        {status}
                                      </span>
                                    </td>
                                  )
                                })}
                                <td className="p-3 text-center font-bold text-blue-600 bg-blue-50/30">
                                  {persentaseIndividu}%
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
