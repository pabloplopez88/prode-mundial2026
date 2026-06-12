export default function handler(req, res) {
  res.json({ now: new Date().toISOString() })
}
