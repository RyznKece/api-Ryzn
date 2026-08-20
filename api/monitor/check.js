import { neon } from "@neondatabase/serverless";
import { TikTokClient } from "@ssut/tiktok-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

const tiktok = new TikTokClient({
  region: "ID"
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  try {
    // Ambil semua user yang aktif dimonitor
    const users = await sql`
      SELECT
        id,
        username,
        avatar,
        profile_url,
        last_video_id,
        last_checked
      FROM monitored_users
      WHERE enabled = TRUE
      ORDER BY id ASC
    `;

    const results = [];

    for (const monitored of users) {
      try {
        // Ambil data TikTok user
        const userResult = await tiktok.getUser(monitored.username);

        if (!userResult?.data?.userInfo) {
          results.push({
            username: monitored.username,
            success: false,
            error: "User TikTok tidak ditemukan"
          });

          continue;
        }

        const user = userResult.data.userInfo.user;

        // Coba ambil post terbaru
        const postsResult = await tiktok.getUserPosts(user.secUid, {
          postLimit: 1
        });

        results.push({
          username: monitored.username,
          success: true,

          debug: {
            secUid: user.secUid,
            postsResult
          }
        });

      } catch (error) {
        results.push({
          username: monitored.username,
          success: false,
          error: error?.message || String(error)
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: users.length,
      results
    });

  } catch (error) {
    console.error("Monitor Check Error:", error);

    return res.status(500).json({
      success: false,
      error: "Gagal menjalankan monitor",
      message: error?.message || String(error)
    });
  }
}