import { neon } from "@neondatabase/serverless";
import { TikTokClient } from "@ssut/tiktok-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

const tiktok = new TikTokClient({
  region: "ID"
});

export default async function handler(req, res) {
  // Sementara izinkan GET dan POST untuk testing
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
    // =========================
    // 1. TEST DATABASE
    // =========================

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

    // =========================
    // 2. AMBIL USER TIKTOK
    // =========================

    const userResult = await tiktok.getUser(username);

    if (!userResult?.data?.userInfo) {
      return res.status(404).json({
        success: false,
        error: "User TikTok tidak ditemukan"
      });
    }

    const user = userResult.data.userInfo.user;

    // =========================
    // 3. AMBIL VIDEO TERBARU
    // =========================

    const postsResult = await tiktok.getUserPosts(user.secUid, {
      postLimit: 1
    });

    // =========================
    // 4. DEBUG RESPONSE
    // =========================

    return res.status(200).json({
      success: true,

      username: user.uniqueId,

      secUid: user.secUid,

      postsResult: postsResult
    });

  } catch (error) {
    console.error("Monitor Add Error:", error);

    return res.status(500).json({
      success: false,
      error: "Monitor gagal",
      message: error?.message || String(error)
    });
  }
}