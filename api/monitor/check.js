import { getUser } from "@rediska1114/tiktok-api";

export default async function handler(req, res) {
  const username =
    req.query.username?.replace(/^@/, "").trim() ||
    "ryznapalah";

  try {
    const result = await getUser(
      username,
      undefined,
      "ID"
    );

    return res.status(200).json({
      success: true,
      username,

      hasData: !!result?.data,
      hasUserInfo: !!result?.data?.userInfo,
      hasMsToken: !!result?.msToken,

      error: result?.error || null,
      statusCode: result?.statusCode || null,

      rawKeys: result
        ? Object.keys(result)
        : [],

      user: result?.data?.userInfo?.user
        ? {
            id: result.data.userInfo.user.id,
            uniqueId: result.data.userInfo.user.uniqueId,
            nickname: result.data.userInfo.user.nickname,
            secUid: result.data.userInfo.user.secUid
          }
        : null
    });

  } catch (error) {
    console.error("TikTok test error:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || String(error)
    });
  }
}