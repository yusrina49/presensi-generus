import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function AuthCheck() {
  useEffect(() => {
    // Mengecek sesi saat ini
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Anda bisa melihat waktu kedaluwarsa token di sini (dalam format timestamp detik)
        const expiresAt = session.expires_at // contoh: 1711234567
        console.log("Sesi berakhir pada:", new Date((expiresAt ?? 0) * 1000));
      }
    })

    // Mendengarkan perubahan status login (termasuk saat sesi habis / TOKEN_REFRESHED / SIGNED_OUT)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Event Auth:", event);
      if (event === 'SIGNED_OUT' || !session) {
        // Tindakan ketika sesi habis atau pengguna keluar
        console.log("Sesi telah habis atau Anda telah keluar.");
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}
