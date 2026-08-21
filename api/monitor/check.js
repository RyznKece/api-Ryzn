import { neon } from "@neondatabase/serverless";
import tiktok from "tiktok-app-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  try {
    // Ambil user monitor pertama dulu
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
    // INIT TIKTOK APP API
    // ==========================================

    const tiktokApp = await tiktok();

    // ==========================================
    // AMBIL USER
    // ==========================================

    const user = await tiktokApp.getUserByName(
      monitored.username
    );

    // ==========================================
    // AMBIL UPLOAD VIDEO
    // ==========================================

    const iterator = tiktokApp.getUploadedVideos(user);

    const videosResult = await iterator.next();

    const videos = videosResult.value || [];

    // ==========================================
    // RESPONSE RAW
    // ==========================================

    return res.status(200).json({
      success: true,

      username: monitored.username,

      videoCount: videos.length,

      videos: videos
    });

  } catch (error) {
    console.error("TikTok App API Error:", error);

    return res.status(500).json({
      success: false,
      error: "TikTok App API gagal",
      message: error?.message || String(error),
      stack: process.env.NODE_ENV === "development"
        ? error?.stack
        : undefined
    });
  }
}