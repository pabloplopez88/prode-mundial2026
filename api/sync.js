export default async function handler(req, res) {
  const { date, competitions } = req.query
  const TOKEN = process.env.VITE_FOOTBALLDATA_TOKEN || ""
  if (!TOKEN) return res.status(500).json({ error: "no token" })
  
  let url = `https://api.football-data.org/v4/matches?date=${date}`
  if (competitions) url += `&competitions=${competitions}`
  
  try {
    const r = await fetch(url, { headers: { "X-Auth-Token": TOKEN } })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
