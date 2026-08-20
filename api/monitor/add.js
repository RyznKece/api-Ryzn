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
    // TEST 1 — Database
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

    // TEST 2 — TikTok profile
    const userResult = await tiktok.getUser(username);

    if (!userResult?.data?.userInfo) {
      return res.status(404).json({
        success: false,
        error: "User TikTok tidak ditemukan"
      });
    }

    const user = userResult.data.userInfo.user;

    // TEST 3 — Video
    const postsResult = await tiktok.getUserPosts(user.secUid, {
      postLimit: 1
    });

    const latestVideo = postsResult?.data?.[0];

    if (!latestVideo) {
      return res.status(400).json({
        success: false,
        error: "Tidak menemukan video"
      });
    }

    // TEST 4 — Database insert
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
      error: "Monitor gagal",
      message: error?.message || String(error)
    });
  }
}