import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  try {
    // Get all flourish data ordered by match
    const { data: rows, error } = await supabase
      .from("flourish_data")
      .select("match_label, match_order, player_id, cumulative_pts")
      .order("match_order", { ascending: true })

    if (error) throw error

    // Get players for names and avatars
    const { data: players } = await supabase
      .from("players")
      .select("id, name, avatar")

    if (!rows || !players) throw new Error("No data")

    // Build pivot: player -> { match_label: cumulative_pts }
    const playerMap = {}
    players.forEach(p => {
      playerMap[p.id] = { name: p.name, avatar: p.avatar, pts: {} }
    })

    const matchLabels = []
    const matchOrder = {}
    rows.forEach(r => {
      if (!matchOrder[r.match_order]) {
        matchOrder[r.match_order] = r.match_label
        matchLabels.push({ order: r.match_order, label: r.match_label })
      }
      if (playerMap[r.player_id]) {
        playerMap[r.player_id].pts[r.match_label] = r.cumulative_pts
      }
    })

    matchLabels.sort((a, b) => a.order - b.order)

    // Build CSV
    const headers = ["Jugador", "Image", "Inicio", ...matchLabels.map(m => m.label)]
    const csvRows = [headers.join(",")]

    Object.values(playerMap).forEach(p => {
      const row = [
        p.name,
        p.avatar || "",
        "0",
        ...matchLabels.map(m => p.pts[m.label] ?? "")
      ]
      csvRows.push(row.map(v => `"${v}"`).join(","))
    })

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.status(200).send(csvRows.join("\n"))
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
