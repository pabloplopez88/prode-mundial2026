export default async function handler(req, res) {
  const { date, dateFrom, dateTo, competitions } = req.query
  const TOKEN = process.env.VITE_FOOTBALLDATA_TOKEN || ""
  if (!TOKEN) return res.status(500).json({ error: "no token" })

  let url = "https://api.football-data.org/v4/matches?"
  if (dateFrom && dateTo) {
    url += `dateFrom=${dateFrom}&dateTo=${dateTo}`
  } else if (date) {
    // Expand to day before and after to cover timezone differences
    const d = new Date(date)
    const prev = new Date(d); prev.setDate(d.getDate() - 1)
    const next = new Date(d); next.setDate(d.getDate() + 1)
    url += `dateFrom=${prev.toISOString().slice(0,10)}&dateTo=${next.toISOString().slice(0,10)}`
  }
  if (competitions) url += `&competitions=${competitions}`

  try {
    const r = await fetch(url, { headers: { "X-Auth-Token": TOKEN } })
    const data = await r.json()
    res.status(r.status).json(data)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
