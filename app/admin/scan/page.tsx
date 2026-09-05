'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, UserCheck, UserPlus, Calendar, CheckCircle2, AlertCircle, X, Filter, Image as ImageIcon } from 'lucide-react'

const supabase = createClient()

interface Acara {
  id: string
  nama_acara: string
  tanggal: string
  lokasi: string
}

interface Generus {
  id: string
  nama: string
  kelompok: string
  jenis_kelamin: 'Laki-laki' | 'Perempuan'
  kelas: string
  qr_code_id?: string
}

export default function AdminScanPage() {
  const [acaraList, setAcaraList] = useState<Acara[]>([])
  const [selectedAcara, setSelectedAcara] = useState<string>('')
  const [generusList, setGenerusList] = useState<Generus[]>([])
  const [activeTab, setActiveTab] = useState<'ada' | 'baru'>('ada')
  const [cameraError, setCameraError] = useState('')
  const [scanningImage, setScanningImage] = useState(false)
  const [requestingCamera, setRequestingCamera] = useState(false)
  
  // State Input Manual Data Ada
  const [selectedKelompokFilter, setSelectedKelompokFilter] = useState<string>('')
  const [selectedGenerusId, setSelectedGenerusId] = useState<string>('')

  // State Form Generus Baru
  const [namaBaru, setNamaBaru] = useState('')
  const [kelompokBaru, setKelompokBaru] = useState('Gonjen 1')
  const [jkBaru, setJkBaru] = useState<'Laki-laki' | 'Perempuan'>('Laki-laki')
  const [kelasBaru, setKelasBaru] = useState('Pra Remaja')

  // State Toast Notification Floating (Popup)
  const [toast, setToast] = useState<{ show: boolean; text: string; type: 'success' | 'error' }>({
    show: false,
    text: '',
    type: 'success'
  })

  // Ref penanda cegah pindaian berulang beruntun (Debounce)
  const isProcessing = useRef(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const startScannerRef = useRef<(() => Promise<void>) | null>(null)
  const processPresensiRef = useRef<((rawCode: string) => Promise<void>) | null>(null)

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchAcara(), fetchGenerus()])
    }

    loadData()
  }, [])

  // Fungsi Tampil Toast Notification Singkat
  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ show: true, text, type })
    setTimeout(() => {
      setToast({ show: false, text: '', type: 'success' })
    }, 3200)
  }

  // Scanner Kamera
  useEffect(() => {
    if (!selectedAcara) return

    let cancelled = false
    const scanner = new Html5Qrcode('reader')
    scannerRef.current = scanner
    const startScanner = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras()
        if (cameras.length === 0) {
          throw new Error('Kamera tidak ditemukan pada perangkat ini.')
        }

        const camera = cameras.find((item) => /back|rear|environment/i.test(item.label)) || cameras[0]
        await scanner.start(
          camera.id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            await processPresensiRef.current?.(decodedText)
          },
          () => {}
        )
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Akses kamera gagal.'
        setCameraError(
          `${message} Untuk development, gunakan http://localhost atau HTTPS. HTTP melalui alamat IP/LAN diblokir browser.`
        )
      }
    }

    startScannerRef.current = startScanner
    return () => {
      cancelled = true
      const stopScanner = async () => {
        try {
          if (scanner.isScanning) await scanner.stop()
          await scanner.clear()
        } catch {
          // Scanner mungkin belum selesai diinisialisasi saat komponen dilepas.
        }
      }
      stopScanner()
      scannerRef.current = null
      startScannerRef.current = null
    }
  }, [selectedAcara])

  async function fetchAcara() {
    const { data } = await supabase.from('acara').select('*').order('tanggal', { ascending: true })
    if (data && data.length > 0) {
      setAcaraList(data)
      setSelectedAcara(data[0].id)
    }
  }

  async function fetchGenerus() {
    const { data } = await supabase
      .from('generus')
      .select('*')
      .order('kelompok', { ascending: true })
      .order('nama', { ascending: true })
    if (data) setGenerusList(data)
  }

  // Ambil daftar unik kelompok secara otomatis dari data generus
  const kelompokOptions = Array.from(new Set(generusList.map((g) => g.kelompok))).filter(Boolean)

  // Filter daftar generus berdasarkan kelompok yang dipilih
  const filteredGenerusList = selectedKelompokFilter
    ? generusList.filter((g) => g.kelompok === selectedKelompokFilter)
    : generusList

  // Reset Semua Form Input Manual
  const resetForm = () => {
    setSelectedGenerusId('')
    setNamaBaru('')
    setKelompokBaru('Gonjen 1')
    setJkBaru('Laki-laki')
    setKelasBaru('Pra Remaja')
  }

  const getQrCandidates = (rawCode: string) => {
    const code = rawCode.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    const compactCode = code.replace(/\s+/g, '')
    const candidates = new Set([code, compactCode, compactCode.toUpperCase()])

    try {
      const url = new URL(code)
      url.searchParams.forEach((value, key) => {
        if (['id', 'qr', 'qr_code', 'qr_code_id'].includes(key.toLowerCase())) {
          candidates.add(value.trim())
        }
      })
      candidates.add(url.pathname.split('/').filter(Boolean).pop() || '')
    } catch {
      try {
        const parsed = JSON.parse(code)
        ;['id', 'qr', 'qr_code', 'qr_code_id'].forEach((key) => {
          if (typeof parsed?.[key] === 'string') candidates.add(parsed[key].trim())
        })
      } catch {
        // Payload bukan URL atau JSON, gunakan teks mentah.
      }
    }

    return Array.from(candidates).filter(Boolean)
  }

  // Logika Pemrosesan QR Code
  async function handleProcessPresensiByQR(rawCode: string) {
    if (isProcessing.current) return
    isProcessing.current = true

    if (!selectedAcara) {
      showToast('Pilih acara terlebih dahulu!', 'error')
      setTimeout(() => { isProcessing.current = false }, 2000)
      return
    }

    const candidates = getQrCandidates(rawCode)
    let gen: { id: string; nama: string } | null = null
    let lookupError: { message: string } | null = null

    for (const candidate of candidates) {
      const qrResult = await supabase
        .from('generus')
        .select('id, nama')
        .eq('qr_code_id', candidate)
        .maybeSingle()

      if (qrResult.error) lookupError = qrResult.error
      if (qrResult.data) {
        gen = qrResult.data
        break
      }

      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)) {
        const idResult = await supabase
          .from('generus')
          .select('id, nama')
          .eq('id', candidate)
          .maybeSingle()

        if (idResult.error) lookupError = idResult.error
        if (idResult.data) {
          gen = idResult.data
          break
        }
      }
    }

    if (!gen) {
      const manualPanitiaCandidates = candidates.filter((candidate) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
      )

      for (const candidate of manualPanitiaCandidates) {
        const manualPanitiaResult = await supabase
          .from('acara_panitia')
          .select('nama_manual')
          .eq('id', candidate)
          .eq('acara_id', selectedAcara)
          .is('generus_id', null)
          .maybeSingle()

        if (manualPanitiaResult.data?.nama_manual) {
          showToast('Panitia Non Generus tidak perlu scan. Data ini tidak masuk rekap.', 'error')
          setTimeout(() => { isProcessing.current = false }, 2500)
          return
        }
      }
    }

    if (lookupError || !gen) {
      showToast(`Kode QR (${candidates[0] || rawCode.trim()}) tidak ditemukan!`, 'error')
    } else {
      await submitPresensi(gen.id, gen.nama, 'QR Scan')
    }

    setTimeout(() => {
      isProcessing.current = false
    }, 2500)
  }

  processPresensiRef.current = handleProcessPresensiByQR

  const handleImageScan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const imageFile = event.target.files?.[0]
    event.target.value = ''
    if (!imageFile || !scannerRef.current) return

    setScanningImage(true)
    setCameraError('')

    try {
      const scanner = scannerRef.current
      if (scanner.isScanning) await scanner.stop()
      const decodedText = await scanner.scanFile(imageFile, true)
      await handleProcessPresensiByQR(decodedText)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'QR Code tidak ditemukan pada gambar.'
      setCameraError(`Gagal membaca gambar: ${message}`)
    } finally {
      setScanningImage(false)
      await startScannerRef.current?.()
    }
  }

  const requestCameraAccess = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Browser atau perangkat ini tidak mendukung akses kamera.')
      return
    }

    setRequestingCamera(true)
    setCameraError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach((track) => track.stop())
      if (!scannerRef.current?.isScanning) {
        await startScannerRef.current?.()
      }
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Izin kamera ditolak. Buka pengaturan situs/browser lalu izinkan kamera.'
        : error instanceof Error
          ? error.message
          : 'Akses kamera gagal.'
      setCameraError(
        `${message} Untuk development, gunakan http://localhost atau HTTPS. HTTP melalui alamat IP/LAN diblokir browser.`
      )
    } finally {
      setRequestingCamera(false)
    }
  }

  // Submit Presensi
  async function submitPresensi(generusId: string, nama: string, metode: 'QR Scan' | 'Manual Admin') {
    const { data: existing } = await supabase
      .from('presensi')
      .select('id')
      .eq('acara_id', selectedAcara)
      .eq('generus_id', generusId)
      .maybeSingle()

    if (existing) {
      showToast(`${nama} sudah tercatat hadir sebelumnya!`, 'error')
      resetForm()
      return
    }

    const { error } = await supabase.from('presensi').insert({
      generus_id: generusId,
      acara_id: selectedAcara,
      status: 'Hadir',
      metode: metode
    })

    if (error) {
      showToast(`Gagal mencatat presensi: ${error.message}`, 'error')
    } else {
      showToast(`Berhasil! ${nama} tercatat Hadir (${metode}).`, 'success')
      resetForm()
    }
  }

  // Submit Manual Data Ada
  const handleManualAdaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAcara || !selectedGenerusId) return
    const gen = generusList.find((g) => g.id === selectedGenerusId)
    if (gen) await submitPresensi(gen.id, gen.nama, 'Manual Admin')
  }

  // Submit Manual Data Baru
  const handleManualBaruSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAcara) return

    const generatedQr = `GEN-${Math.floor(1000 + Math.random() * 9000)}`

    const { data: newGen, error } = await supabase
      .from('generus')
      .insert({
        nama: namaBaru,
        kelompok: kelompokBaru,
        jenis_kelamin: jkBaru,
        kelas: kelasBaru,
        qr_code_id: generatedQr
      })
      .select()
      .single()

    if (error || !newGen) {
      showToast('Gagal menambah generus baru.', 'error')
      return
    }

    await fetchGenerus()
    await submitPresensi(newGen.id, newGen.nama, 'Manual Admin')
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 relative">
      
      {/* Toast Popup Notification Floating */}
      {toast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md transition-all duration-300">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 text-white ${
              toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-red-600 border-red-500'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>
            <button onClick={() => setToast({ ...toast, show: false })} className="p-1 hover:bg-white/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bagian Pilihan Acara */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <label className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
          <Calendar className="w-5 h-5 text-blue-600" />
          Pilih Acara Presensi:
        </label>
        <select
          value={selectedAcara}
          onChange={(e) => setSelectedAcara(e.target.value)}
          className="w-full p-3 border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium text-sm sm:text-base outline-none"
        >
          <option value="">-- Pilih Acara Aktif --</option>
          {acaraList.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nama_acara} - {a.tanggal} ({a.lokasi})
            </option>
          ))}
        </select>
      </div>

      {/* Layout Grid 2 Kolom */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Kolom A: Kamera QR */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 flex flex-col items-center">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4">
            <Camera className="w-5 h-5 text-blue-600" />
            Kolom A: Pemindai Kamera QR Code
          </h2>
          {!selectedAcara ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-center text-sm">
              Pilih acara di atas untuk mengaktifkan scanner kamera.
            </div>
          ) : (
            <>
              <div id="reader" className="w-full"></div>
              <button
                type="button"
                onClick={requestCameraAccess}
                disabled={requestingCamera || scanningImage}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Camera className="h-4 w-4" />
                {requestingCamera ? 'Meminta akses kamera...' : 'Izinkan Akses Kamera'}
              </button>
              <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
                <ImageIcon className="h-4 w-4" />
                {scanningImage ? 'Membaca gambar...' : 'Scan QR dari Gambar'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageScan}
                  disabled={scanningImage}
                  className="sr-only"
                />
              </label>
              {cameraError && (
                <p className="mt-4 rounded-lg bg-red-50 p-3 text-center text-xs text-red-700">
                  {cameraError}
                </p>
              )}
            </>
          )}
        </div>

        {/* Kolom B: Presensi Manual */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Kolom B: Presensi Manual</h2>

          {/* Toggle Tab */}
          <div className="flex border-b mb-6 text-sm">
            <button
              onClick={() => setActiveTab('ada')}
              className={`flex-1 py-2 font-medium flex items-center justify-center gap-2 border-b-2 ${
                activeTab === 'ada' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              <UserCheck className="w-4 h-4" /> Pilih Data Ada
            </button>
            <button
              onClick={() => setActiveTab('baru')}
              className={`flex-1 py-2 font-medium flex items-center justify-center gap-2 border-b-2 ${
                activeTab === 'baru' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              <UserPlus className="w-4 h-4" /> + Generus Baru
            </button>
          </div>

          {/* Tab 1: Data Ada */}
          {activeTab === 'ada' && (
            <form onSubmit={handleManualAdaSubmit} className="space-y-4">
              
              {/* Filter Pilih Kelompok */}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium mb-1 text-slate-700">
                  <Filter className="w-3.5 h-3.5 text-blue-600" /> Filter Kelompok
                </label>
                <select
                  value={selectedKelompokFilter}
                  onChange={(e) => {
                    setSelectedKelompokFilter(e.target.value)
                    setSelectedGenerusId('') // Reset pilihan nama jika kelompok berganti
                  }}
                  className="w-full p-2.5 border rounded-lg text-xs sm:text-sm bg-gray-50 focus:bg-white outline-none"
                  disabled={!selectedAcara}
                >
                  <option value="">-- Semua Kelompok --</option>
                  {kelompokOptions.map((kel) => (
                    <option key={kel} value={kel}>
                      {kel}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown Pilih Nama (Tersaring berdasarkan kelompok) */}
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">Cari Nama Generus</label>
                <select
                  value={selectedGenerusId}
                  onChange={(e) => setSelectedGenerusId(e.target.value)}
                  className="w-full p-2.5 border rounded-lg text-xs sm:text-sm bg-white outline-none"
                  disabled={!selectedAcara}
                >
                  <option value="">-- Pilih Generus --</option>
                  {filteredGenerusList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!selectedAcara || !selectedGenerusId}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 text-xs sm:text-sm transition"
              >
                Submit Presensi
              </button>
            </form>
          )}

          {/* Tab 2: Data Baru */}
          {activeTab === 'baru' && (
            <form onSubmit={handleManualBaruSubmit} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="Masukkan Nama Lengkap"
                  value={namaBaru}
                  onChange={(e) => setNamaBaru(e.target.value)}
                  required
                  className="w-full p-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kelompok</label>
                  <select
                    value={kelompokBaru}
                    onChange={(e) => setKelompokBaru(e.target.value)}
                    className="w-full p-2.5 border rounded-lg outline-none bg-white"
                  >
                    <option value="GONJEN 1">GONJEN 1</option>
                    <option value="GONJEN 2">GONJEN 2</option>
                    <option value="KEMBARAN">KEMBARAN</option>
                    <option value="SEMBUNG">SEMBUNG</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={jkBaru}
                    onChange={(e) => setJkBaru(e.target.value as 'Laki-laki' | 'Perempuan')}
                    className="w-full p-2.5 border rounded-lg outline-none bg-white"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Kelas / Usia</label>
                <select
                  value={kelasBaru}
                  onChange={(e) => setKelasBaru(e.target.value)}
                  className="w-full p-2.5 border rounded-lg outline-none bg-white"
                >
                  <option value="Pra Remaja">Pra Remaja</option>
                  <option value="Remaja">Remaja</option>
                  <option value="Pra Nikah">Pra Nikah</option>
                  <option value="Mandiri">Mandiri</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!selectedAcara}
                className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 transition mt-2"
              >
                Simpan & Catat Presensi
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
