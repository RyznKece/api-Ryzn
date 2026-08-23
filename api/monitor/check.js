import { neon } from "@neondatabase/serverless";
import {
  TikTokClient,
  PostItemRequestType
} from "@ssut/tiktok-api";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

const client = new TikTokClient({
  region: "ID",
  msToken: process.env.TIKTOK_MS_TOKEN
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
        last_video_id
      FROM monitored_users
      WHERE enabled = TRUE
      ORDER BY id ASC
    `;

    const results = [];

    for (const monitored of users) {
      try {
        // =========================
        // PROFILE
        // =========================

        const userResult = await client.getUser(
          monitored.username
        );

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

        // =========================
        // POSTS
        // =========================

        const postsResult =
          await client.getUserPosts(
            user.secUid,
            {
              postLimit: 5,
              requestType: PostItemRequestType.Popular
            }
          );

        results.push({
          username: user.uniqueId,

          profile: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatarLarger,
            followers: stats.followerCount,
            following: stats.followingCount,
            totalLikes: stats.heartCount
          },

          previousVideoId:
            monitored.last_video_id,

          posts: postsResult?.data || null,

          totalPosts:
            postsResult?.totalPosts || 0,

          postsError:
            postsResult?.error || null
        });

      } catch (error) {
        console.error(
          `Monitor error ${monitored.username}:`,
          error
        );

        results.push({
          username: monitored.username,
          success: false,
          error: error?.message || String(error)
        });
      }
    }

    return res.status(200).json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Monitor gagal",
      message: error?.message || String(error)
    });
  }
}