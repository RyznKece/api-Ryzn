import { neon } from "@neondatabase/serverless";
import { TikTokClient } from "@ssut/tiktok-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

const tiktok = new TikTokClient({
  region: "ID"
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  let username = req.query.username;

  if (!username) {
    return res.status(400).json({
      success: false,
      error: "username wajib diisi"
    });
  }

  username = username.replace(/^@/, "").trim();

  try {
    // Buat tabel kalau belum ada
    await sql`
      CREATE TABLE IF NOT EXISTS monitored_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        last_video_id TEXT,
        last_checked TIMESTAMPTZ,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Cek username TikTok
    const result = await tiktok.getUser(username);

    if (!result?.data?.userInfo) {
      return res.status(404).json({
        success: false,
        error: "User TikTok tidak ditemukan"
      });
    }

    const user = result.data.userInfo.user;

    // Ambil video terbaru sebagai baseline
    const posts = await tiktok.getUserPosts(user.secUid, {
      postLimit: 1
    });

    const latestVideo = posts?.data?.[0];

    if (!latestVideo) {
      return res.status(400).json({
        success: false,
        error: "User tidak memiliki video yang bisa ditemukan"
      });
    }

    // Masukkan / update user
    const inserted = await sql`
      INSERT INTO monitored_users
        (username, last_video_id, last_checked, enabled)
      VALUES
        (${user.uniqueId}, ${latestVideo.id}, NOW(), TRUE)
      ON CONFLICT (username)
      DO UPDATE SET
        enabled = TRUE
      RETURNING *
    `;

    return res.status(200).json({
      success: true,
      message: "TikTok berhasil ditambahkan ke monitor",

      monitor: {
        username: inserted[0].username,
        lastVideoId: inserted[0].last_video_id,
        enabled: inserted[0].enabled
      }
    });

  } catch (error) {
    console.error("Monitor Add Error:", error);

    return res.status(500).json({
      success: false,
      error: "Gagal menambahkan monitor",
      message: error?.message || String(error)
    });
  }
}