import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.RYZN_MONITOR_DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method Not Allowed"
    });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS monitored_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        last_video_id TEXT,
        last_checked TIMESTAMPTZ,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    const users = await sql`
      SELECT
        id,
        username,
        last_video_id,
        last_checked,
        enabled,
        created_at
      FROM monitored_users
      ORDER BY id ASC
    `;

    return res.status(200).json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    console.error("Monitor List Error:", error);

    return res.status(500).json({
      success: false,
      error: "Gagal mengambil daftar monitor",
      message: error?.message || String(error)
    });
  }
}