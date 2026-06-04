export default async function handler(req, res) {
  const { id } = req.query
  const TOKEN = process.env.VITE_FOOTBALLDATA_TOKEN || ""
  if (!TOKEN) return res.status(500).json({ error: "no token" })
  if (!id) return res.status(400).json({ error: "missing id" })

  try {
    const r = await fetch(`https://api.football-data.org/v4/matches/${id}`, {
      headers: { "X-Auth-Token": TOKEN }
    })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
