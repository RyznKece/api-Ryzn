import { neon } from "@neondatabase/serverless";
import { TikTokClient } from "@ssut/tiktok-api";

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
    // ==========================================
    // AMBIL SEMUA USER YANG DIMONITOR
    // ==========================================

    const users = await sql`
      SELECT
        id,
        username,
        last_video_id
      FROM monitored_users
      WHERE enabled = TRUE
      ORDER BY id ASC
    `;

    if (!users.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        results: []
      });
    }

    const results = [];

    // ==========================================
    // CEK USER SATU PER SATU
    // ==========================================

    for (const monitored of users) {
      try {
        // ======================================
        // 1. PROFILE
        // ======================================

        const userResult = await client.getUser(
          monitored.username
        );

        if (
          !userResult ||
          !userResult.data ||
          !userResult.data.userInfo
        ) {
          results.push({
            username: monitored.username,
            success: false,
            error: userResult?.error || "User tidak ditemukan"
          });

          continue;
        }

        const { user, stats } =
          userResult.data.userInfo;

        // ======================================
        // 2. AMBIL POST USER
        // ======================================

        const postsResult =
          await client.getUserPosts(
            user.secUid,
            {
              postLimit: 10
            }
          );

        // ======================================
        // JIKA GAGAL AMBIL POST
        // ======================================

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
              totalLikes: stats.heartCount
            },

            previousVideoId:
              monitored.last_video_id,

            latestVideo: null,

            totalPosts:
              postsResult?.totalPosts || 0,

            postsError:
              postsResult?.error || "Tidak ada post"
          });

          continue;
        }

        // ======================================
        // 3. URUTKAN POST TERBARU
        // ======================================

        const posts = [...postsResult.data];

        posts.sort(
          (a, b) =>
            Number(b.createTime || 0) -
            Number(a.createTime || 0)
        );

        const latest = posts[0];

        // ======================================
        // 4. DATA VIDEO TERBARU
        // ======================================

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
            latest.stats?.shareCount || 0,

          type:
            latest.video
              ? "video"
              : latest.imagePost
                ? "image"
                : "unknown"
        };

        // ======================================
        // 5. CEK VIDEO BARU
        // ======================================

        const isNewVideo =
          monitored.last_video_id !== null &&
          monitored.last_video_id !== latest.id;

        // ======================================
        // 6. UPDATE DATABASE
        // ======================================

        await sql`
          UPDATE monitored_users
          SET
            last_video_id = ${latest.id},
            last_checked = NOW()
          WHERE id = ${monitored.id}
        `;

        // ======================================
        // 7. RESPONSE
        // ======================================

        results.push({
          username: user.uniqueId,

          success: true,

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

          latestVideo,

          newVideo: isNewVideo,

          totalPosts:
            postsResult.totalPosts || posts.length,

          postsChecked:
            posts.length,

          postsError:
            postsResult.error || null
        });

      } catch (error) {
        console.error(
          `Monitor error for @${monitored.username}:`,
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

    // ==========================================
    // RESPONSE AKHIR
    // ==========================================

    return res.status(200).json({
      success: true,
      count: results.length,
      results
    });

  } catch (error) {
    console.error(
      "Monitor Check Error:",
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