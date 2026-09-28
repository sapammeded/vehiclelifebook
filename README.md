# Vehicle Lifebook

Vehicle Lifebook adalah aplikasi mobile-first untuk mencatat dan menelusuri seluruh riwayat kendaraan.

## Stack
- Single `index.html`
- Supabase Auth + PostgreSQL + RLS
- Voice input menggunakan Web Speech API jika browser mendukung
- GitHub Pages

## Supabase
Project URL:
`https://oeuyhfuohaizwuljgzeg.supabase.co`

Jangan pernah memasukkan `service_role` key ke HTML. Gunakan publishable/anon key.

## Jalankan
Buka `index.html` melalui GitHub Pages. Pada halaman setup masukkan:
1. Supabase Project URL
2. Publishable/anon key

Konfigurasi disimpan lokal di perangkat.

## Catatan
Voice selalu melewati preview/konfirmasi sebelum event disimpan. Jika browser tidak mendukung Speech Recognition, input teks tetap tersedia.
