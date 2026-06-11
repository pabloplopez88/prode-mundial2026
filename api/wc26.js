export default async function handler(req, res) {
  try {
    const r = await fetch("https://worldcup26.ir/get/games")
    const data = await r.json()
    res.status(200).json(data)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
