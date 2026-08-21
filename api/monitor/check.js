import { neon } from "@neondatabase/serverless";
import {
  getUser,
  getUserPosts
} from "@rediska1114/tiktok-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  try {
    // Ambil user monitor
    const users = await sql`
      SELECT
        id,
        username,
        last_video_id
      FROM monitored_users
      WHERE enabled = TRUE
      ORDER BY id ASC
      LIMIT 1
    `;

    if (!users.length) {
      return res.status(404).json({
        success: false,
        error: "Belum ada user yang dimonitor"
      });
    }

    const monitored = users[0];

    // ==========================================
    // 1. Ambil profile + msToken otomatis
    // ==========================================

    const userResult = await getUser(
      monitored.username,
      undefined,
      "US"
    );

    if (userResult?.error) {
      return res.status(502).json({
        success: false,
        step: "getUser",
        error: userResult.error,
        statusCode: userResult.statusCode || null
      });
    }

    if (!userResult?.data?.userInfo) {
      return res.status(404).json({
        success: false,
        step: "getUser",
        error: "User TikTok tidak ditemukan"
      });
    }

    const user = userResult.data.userInfo.user;

    // ==========================================
    // 2. Ambil video terbaru
    // ==========================================

    const postsResult = await getUserPosts(
      user.secUid,
      undefined,
      5,
      "US",
      userResult.msToken
    );

    // ==========================================
    // 3. Jangan pernah return msToken
    // ==========================================

    return res.status(200).json({
      success: true,

      username: monitored.username,

      user: {
        id: user.id,
        uniqueId: user.uniqueId,
        nickname: user.nickname,
        secUid: user.secUid
      },

      posts: postsResult?.data || null,

      totalPosts: postsResult?.totalPosts || 0,

      error: postsResult?.error || null,

      statusCode: postsResult?.statusCode || null
    });

  } catch (error) {
    console.error("Monitor Check Error:", error);

    return res.status(500).json({
      success: false,
      error: "Monitor check gagal",
      message: error?.message || String(error)
    });
  }
}