import { neon } from "@neondatabase/serverless";
import { TikTokClient } from "@ssut/tiktok-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

const tiktok = new TikTokClient({
  region: "ID"
});

export default async function handler(req, res) {
  // Sementara GET dan POST sama-sama diizinkan untuk testing
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  const username = req.query.username?.replace(/^@/, "").trim();

  if (!username) {
    return res.status(400).json({
      success: false,
      error: "username wajib diisi"
    });
  }

  try {
    // ==========================================
    // 1. Buat tabel jika belum ada
    // ==========================================

    await sql`
      CREATE TABLE IF NOT EXISTS monitored_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        avatar TEXT,
        profile_url TEXT,
        last_video_id TEXT,
        last_checked TIMESTAMPTZ,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // ==========================================
    // 2. Migrasi tabel lama
    // ==========================================

    await sql`
      ALTER TABLE monitored_users
      ADD COLUMN IF NOT EXISTS avatar TEXT
    `;

    await sql`
      ALTER TABLE monitored_users
      ADD COLUMN IF NOT EXISTS profile_url TEXT
    `;

    // ==========================================
    // 3. Ambil profile TikTok
    // ==========================================

    const result = await tiktok.getUser(username);

    if (!result?.data?.userInfo) {
      return res.status(404).json({
        success: false,
        error: "User TikTok tidak ditemukan"
      });
    }

    const user = result.data.userInfo.user;

    // ==========================================
    // 4. Ambil avatar
    // ==========================================

    const avatar =
      user.avatarLarger ||
      user.avatarMedium ||
      user.avatarThumb ||
      null;

    // Username asli dari TikTok
    const uniqueId = user.uniqueId;

    // ==========================================
    // 5. Link profile TikTok
    // ==========================================

    const profileUrl =
      `https://www.tiktok.com/@${uniqueId}`;

    // ==========================================
    // 6. Simpan ke database
    // ==========================================

    const inserted = await sql`
      INSERT INTO monitored_users (
        username,
        avatar,
        profile_url,
        enabled
      )
      VALUES (
        ${uniqueId},
        ${avatar},
        ${profileUrl},
        TRUE
      )

      ON CONFLICT (username)
      DO UPDATE SET
        avatar = EXCLUDED.avatar,
        profile_url = EXCLUDED.profile_url,
        enabled = TRUE

      RETURNING
        id,
        username,
        avatar,
        profile_url,
        last_video_id,
        last_checked,
        enabled,
        created_at
    `;

    // ==========================================
    // 7. Response
    // ==========================================

    return res.status(200).json({
      success: true,
      message: "User berhasil ditambahkan ke monitor",

      monitor: inserted[0]
    });

  } catch (error) {
    console.error("Monitor Add Error:", error);

    return res.status(500).json({
      success: false,
      error: "Gagal menambahkan user",
      message: error?.message || String(error)
    });
  }
}