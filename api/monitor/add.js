import { neon } from "@neondatabase/serverless";
import { TikTokClient } from "@ssut/tiktok-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

const tiktok = new TikTokClient({
  region: "ID"
});

export default async function handler(req, res) {
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
    // Buat tabel kalau belum ada
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

    // Ambil profile TikTok
    const result = await tiktok.getUser(username);

    if (!result?.data?.userInfo) {
      return res.status(404).json({
        success: false,
        error: "User TikTok tidak ditemukan"
      });
    }

    const user = result.data.userInfo.user;

    // Foto profile
    const avatar =
      user.avatarLarger ||
      user.avatarMedium ||
      user.avatarThumb ||
      null;

    // Username asli dari TikTok
    const uniqueId = user.uniqueId;

    // Link profile
    const profileUrl = `https://www.tiktok.com/@${uniqueId}`;

    // Simpan user
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
        enabled,
        created_at
    `;

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