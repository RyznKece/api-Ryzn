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
      SELECT id, username, last_video_id
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

        const userResult =
          await client.getUser(monitored.username);

        if (!userResult?.data?.userInfo) {
          results.push({
            username: monitored.username,
            success: false,
            error: userResult?.error || "User tidak ditemukan"
          });

          continue;
        }

        const { user, stats } =
          userResult.data.userInfo;

        // Token hasil dari request getUser.
        // Jangan pernah dimasukkan ke response.
        const msToken =
          userResult.msToken ||
          process.env.TIKTOK_MS_TOKEN;

        // =========================
        // POSTS
        // =========================

        const postsResult =
          await client.getUserPosts(
            user.secUid,
            {
              postLimit: 10
            }
          );

        // =========================
        // DEBUG POST
        // =========================

        if (
          !postsResult ||
          postsResult.error ||
          !postsResult.data ||
          postsResult.data.length === 0
        ) {
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

            posts: null,

            totalPosts:
              postsResult?.totalPosts || 0,

            postsError:
              postsResult?.error || "EMPTY_RESPONSE",

            msTokenReceived:
              !!msToken
          });

          continue;
        }

        // =========================
        // SORT TERBARU
        // =========================

        const posts = [...postsResult.data];

        posts.sort(
          (a, b) =>
            Number(b.createTime || 0) -
            Number(a.createTime || 0)
        );

        const latest = posts[0];

        // =========================
        // LATEST VIDEO
        // =========================

        const latestVideo = {
          id: latest.id,

          url:
            `https://www.tiktok.com/@${user.uniqueId}/video/${latest.id}`,

          description:
            latest.desc || "",

          createdAt:
            latest.createTime || null,

          views:
            latest.stats?.playCount || 0,

          likes:
            latest.stats?.diggCount || 0,

          comments:
            latest.stats?.commentCount || 0,

          shares:
            latest.stats?.shareCount || 0
        };

        // =========================
        // VIDEO BARU?
        // =========================

        const newVideo =
          monitored.last_video_id !== null &&
          monitored.last_video_id !== latest.id;

        // =========================
        // UPDATE DATABASE
        // =========================

        await sql`
          UPDATE monitored_users
          SET
            last_video_id = ${latest.id},
            last_checked = NOW()
          WHERE id = ${monitored.id}
        `;

        // =========================
        // RESULT
        // =========================

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

          newVideo,

          totalPosts:
            postsResult.totalPosts || posts.length,

          postsChecked:
            posts.length,

          postsError:
            postsResult.error || null
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
      "Monitor error:",
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