import { neon } from "@neondatabase/serverless";
import { TikTokClient } from "@ssut/tiktok-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

const client = new TikTokClient({
  region: "ID",
  msToken: process.env.TIKTOK_MS_TOKEN,
  tiktokApiHost: "api16-normal-c-useast1a.tiktokv.com"
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  try {
    const users = await sql`
      SELECT
        id,
        username,
        last_video_id,
        enabled
      FROM monitored_users
      WHERE enabled = TRUE
      ORDER BY id ASC
    `;

    const results = [];

    for (const monitored of users) {
      try {
        // =====================================
        // PROFILE
        // =====================================

        const userResult =
          await client.getUser(monitored.username);

        if (!userResult?.data?.userInfo) {
          results.push({
            username: monitored.username,
            success: false,
            error: "User tidak ditemukan"
          });

          continue;
        }

        const { user, stats } =
          userResult.data.userInfo;

        // =====================================
        // VIDEO
        // =====================================

        /*
         * SEMENTARA:
         * Jangan pakai getUserPosts() karena
         * endpoint tersebut menghasilkan
         * EMPTY_RESPONSE.
         *
         * Nanti bagian ini akan diganti dengan
         * video scraper kita.
         */

        const latestVideo = null;

        // =====================================
        // RESPONSE
        // =====================================

        results.push({
          username: user.uniqueId,

          success: true,

          profile: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatarLarger,
            followers: stats.followerCount,
            following: stats.followingCount,
            totalLikes: stats.heartCount,
            videoCount: stats.videoCount
          },

          previousVideoId:
            monitored.last_video_id,

          latestVideo,

          newVideo: false,

          videoStatus: "https://alight-creative.firebaseapp.com/__/auth/links?link=https://alightcreative.com/auth_action/?apiKey%3DAIzaSyDrZ9jr_Y16ltSBqsQR5IH6I04FRga6Ki0%26mode%3DsignIn%26oobCode%3DszeQjQRKpfAZPCwdJqmU8bpbYoGl5abpO3jRKwubq98AAAGgL0o_OQ%26continueUrl%3Dhttps://alightcreative.com?ui_sid%253D6873790586%2526ui_sd%253D0%26lang%3Did"
        });

      } catch (error) {
        console.error(
          `Monitor error @${monitored.username}:`,
          error
        );

        results.push({
          username: monitored.username,
          success: false,
          error:
            error?.message ||
            String(error)
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error(
      "Monitor check error:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Monitor gagal",
      message:
        error?.message ||
        String(error)
    });
  }
}