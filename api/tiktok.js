import { TikTokClient } from "@ssut/tiktok-api";

const client = new TikTokClient({
  region: "ID"
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  const username = req.query.username?.replace(/^@/, "");

  if (!username) {
    return res.status(400).json({
      success: false,
      error: "username wajib diisi"
    });
  }

  try {
    const result = await client.getUser(username);

    if (!result?.data?.userInfo) {
      return res.status(404).json({
        success: false,
        error: "User tidak ditemukan"
      });
    }

    const { user, stats } = result.data.userInfo;

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.uniqueId,
        nickname: user.nickname,
        followers: stats.followerCount,
        following: stats.followingCount,
        totalLikes: stats.heartCount,
        videoCount: stats.videoCount
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Gagal mengambil data TikTok",
      message: error.message
    });
  }
}