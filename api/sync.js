export default async function handler(req, res) {
  const { status, dateFrom, dateTo } = req.query
  const TOKEN = process.env.VITE_FOOTBALLDATA_TOKEN || ""
  if (!TOKEN) return res.status(500).json({ error: "no token" })

  let url = "https://api.football-data.org/v4/competitions/WC/matches?"
  if (status) url += `status=${status}&`
  if (dateFrom) url += `dateFrom=${dateFrom}&`
  if (dateTo) url += `dateTo=${dateTo}&`

  try {
    const r = await fetch(url, { headers: { "X-Auth-Token": TOKEN } })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
