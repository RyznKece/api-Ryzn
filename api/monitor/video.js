import { TikTokClient } from "@ssut/tiktok-api";

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

  const username =
    req.query.username?.replace(/^@/, "").trim();

  if (!username) {
    return res.status(400).json({
      success: false,
      error: "username wajib diisi"
    });
  }

  try {
    // ==============================
    // GET PROFILE
    // ==============================

    const userResult =
      await client.getUser(username);

    if (!userResult?.data?.userInfo) {
      return res.status(404).json({
        success: false,
        error: "User tidak ditemukan"
      });
    }

    const { user, stats } =
      userResult.data.userInfo;

    // ==============================
    // DATA UNTUK VIDEO SCRAPER
    // ==============================

    return res.status(200).json({
      success: true,

      profile: {
        id: user.id,
        username: user.uniqueId,
        nickname: user.nickname,
        secUid: user.secUid,
        avatar: user.avatarLarger,
        followers: stats.followerCount,
        videoCount: stats.videoCount
      },

      videoEndpoint:
        "https://www.tiktok.com/api/post/item_list/",

      query: {
        secUid: user.secUid,
        count: 10,
        cursor: 0
      },

      status: "READY_FOR_SIGNED_REQUEST"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: "Gagal mengambil data TikTok",
      message:
        error?.message ||
        String(error)
    });
  }
}