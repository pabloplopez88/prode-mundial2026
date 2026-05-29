import { useState, useEffect, useCallback } from "react"
import { supabase } from "./supabase"
import { MATCHES, FLAGS, STAGES, calcPoints, formatDate, isLocked } from "./data"

const ADMIN_PASSWORD = "mundial2026"

const C = {
  bg: "#0a0e1a",
  card: "#111827",
  border: "#1e2940",
  accent: "#c8a84b",
  accentDim: "#8a6e28",
  green: "#22c55e",
  red: "#ef4444",
  muted: "#6b7280",
  text: "#e2e8f0",
  textDim: "#94a3b8",
}

const s = {
  app: { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto" },
  header: { background: "linear-gradient(135deg,#0f172a 0%,#1e2a45 100%)", borderBottom: `1px solid ${C.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
  logo: { fontSize: 18, fontWeight: 800, color: C.accent, letterSpacing: -0.5 },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 12 },
  btn: (v = "primary") => ({ background: v === "primary" ? C.accent : v === "danger" ? C.red : "transparent", color: v === "primary" ? "#0a0e1a" : "#fff", border: v === "ghost" ? `1px solid ${C.accent}` : "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }),
  tab: (a) => ({ background: a ? C.accent : "transparent", color: a ? "#0a0e1a" : C.textDim, border: `1px solid ${a ? C.accent : C.border}`, borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }),
  input: { width: "100%", background: "#1a2035", border: `2px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", fontSize: 16, color: C.text, outline: "none", boxSizing: "border-box" },
  scoreInput: { width: 44, height: 44, background: "#1a2035", border: `2px solid ${C.accent}`, borderRadius: 8, color: C.accent, fontSize: 20, fontWeight: 800, textAlign: "center", outline: "none" },
  scoreBox: (pts) => ({ width: 44, height: 44, background: pts === 5 ? "#1a3320" : pts >= 3 ? "#1a2820" : pts > 0 ? "#1a2218" : "#1a1a2e", border: `2px solid ${pts === 5 ? C.green : pts >= 3 ? "#4ade80" : pts > 0 ? "#86efac" : C.border}`, borderRadius: 8, color: pts === 5 ? C.green : pts >= 3 ? "#4ade80" : C.textDim, fontSize: 20, fontWeight: 800, textAlign: "center", lineHeight: "40px", minWidth: 44 }),
}

function flag(team) { return FLAGS[team] || "🏳️" }

export default function App() {
  const [screen, setScreen] = useState("home")
  const [user, setUser] = useState(null) // {id, name}
  const [players, setPlayers] = useState([])
  const [predictions, setPredictions] = useState([]) // [{player_id, match_id, home_score, away_score}]
  const [results, setResults] = useState([]) // [{match_id, home_score, away_score}]
  const [stage, setStage] = useState("Grupos")
  const [regName, setRegName] = useState("")
  const [regError, setRegError] = useState("")
  const [editPreds, setEditPreds] = useState({}) // {match_id: {home_score, away_score}}
  const [editResults, setEditResults] = useState({})
  const [adminMode, setAdminMode] = useState(false)
  const [adminPass, setAdminPass] = useState("")
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState("")
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState("idle")

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(""), 2500) }

  // Load all data
  const loadData = useCallback(async () => {
    const [{ data: pl }, { data: pr }, { data: re }] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("predictions").select("*"),
      supabase.from("results").select("*"),
    ])
    if (pl) setPlayers(pl)
    if (pr) setPredictions(pr)
    if (re) setResults(re)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    // Load saved user from localStorage
    const saved = localStorage.getItem("prode_user")
    if (saved) { setUser(JSON.parse(saved)); setScreen("predictions") }
    // Realtime subscription
    const channel = supabase.channel("prode_changes")
      .on("postgres_changes", { event: "*", schema: "public" }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadData])

  // ── REGISTER ────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const name = regName.trim()
    if (!name) { setRegError("Ingresá tu nombre"); return }
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      setRegError("Ese nombre ya existe, elegí otro"); return
    }
    const id = name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now().toString(36)
    const { error } = await supabase.from("players").insert({ id, name })
    if (error) { setRegError("Error al registrarse, intentá de nuevo"); return }
    const me = { id, name }
    localStorage.setItem("prode_user", JSON.stringify(me))
    setUser(me)
    setScreen("predictions")
    loadData()
  }

  // ── SAVE PREDICTIONS ────────────────────────────────────────────────────────
  const savePredictions = async () => {
    if (!user) return
    setSaving(true)
    const upserts = Object.entries(editPreds).map(([match_id, scores]) => ({
      player_id: user.id,
      match_id: parseInt(match_id),
      home_score: parseInt(scores.home_score),
      away_score: parseInt(scores.away_score),
    })).filter(u => !isNaN(u.home_score) && !isNaN(u.away_score))

    if (upserts.length > 0) {
      await supabase.from("predictions").upsert(upserts, { onConflict: "player_id,match_id" })
    }
    setEditPreds({})
    setSaving(false)
    showFlash("✓ Predicciones guardadas")
    loadData()
  }

  // ── SAVE RESULTS (admin) ────────────────────────────────────────────────────
  const saveResults = async () => {
    setSaving(true)
    const upserts = Object.entries(editResults).map(([match_id, scores]) => ({
      match_id: parseInt(match_id),
      home_score: scores.home_score === "" ? null : parseInt(scores.home_score),
      away_score: scores.away_score === "" ? null : parseInt(scores.away_score),
      updated_at: new Date().toISOString(),
    }))
    await supabase.from("results").upsert(upserts, { onConflict: "match_id" })
    setEditResults({})
    setSaving(false)
    showFlash("✓ Resultados guardados")
    loadData()
  }

  // ── SYNC LIVE SCORES ────────────────────────────────────────────────────────
  const syncLive = async () => {
    setSyncStatus("loading")
    try {
      const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY,FINISHED&season=2026", {
        headers: { "X-Auth-Token": "demo" }
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.matches?.length > 0) {
        const upserts = []
        data.matches.forEach(m => {
          if (m.score?.fullTime?.home !== null) {
            const local = MATCHES.find(lm =>
              lm.home.toLowerCase().includes(m.homeTeam.name.toLowerCase().slice(0, 4))
            )
            if (local) upserts.push({ match_id: local.id, home_score: m.score.fullTime.home, away_score: m.score.fullTime.away, updated_at: new Date().toISOString() })
          }
        })
        if (upserts.length > 0) {
          await supabase.from("results").upsert(upserts, { onConflict: "match_id" })
          loadData()
        }
        setSyncStatus("ok")
      } else {
        setSyncStatus("empty")
      }
    } catch {
      setSyncStatus("error")
    }
    setTimeout(() => setSyncStatus("idle"), 4000)
  }

  // ── LEADERBOARD ─────────────────────────────────────────────────────────────
  const board = players.map(p => {
    let total = 0, played = 0, perfect = 0
    MATCHES.forEach(m => {
      const r = results.find(r => r.match_id === m.id)
      if (!r || r.home_score === null) return
      const pred = predictions.find(pr => pr.player_id === p.id && pr.match_id === m.id)
      if (!pred) return
      const pts = calcPoints(pred, r)
      if (pts !== null) { total += pts; played++; if (pts === 5) perfect++ }
    })
    return { ...p, total, played, perfect }
  }).sort((a, b) => b.total - a.total)

  // ── HELPERS ─────────────────────────────────────────────────────────────────
  const myPreds = (matchId) => {
    if (!user) return {}
    const saved = predictions.find(p => p.player_id === user.id && p.match_id === matchId) || {}
    const edited = editPreds[matchId] || {}
    return { ...saved, ...edited }
  }
  const getResult = (matchId) => results.find(r => r.match_id === matchId)
  const matchesByStage = MATCHES.filter(m => m.stage === stage)

  if (loading) return (
    <div style={{ ...s.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚽</div>
        <div style={{ color: C.accent, fontWeight: 700 }}>Cargando prode...</div>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // HOME
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === "home") return (
    <div style={s.app}>
      <div style={{ ...s.header, justifyContent: "center", flexDirection: "column", gap: 4, padding: "32px 20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🏆</div>
        <div style={{ ...s.logo, fontSize: 26 }}>PRODE MUNDIAL 2026</div>
        <div style={{ color: C.textDim, fontSize: 13 }}>USA · México · Canadá · 11 Jun – 19 Jul</div>
      </div>
      <div style={{ padding: 20 }}>
        <div style={{ ...s.card, textAlign: "center", padding: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>¡Unite al prode con tus amigos!</div>
          <div style={{ color: C.textDim, fontSize: 14, marginBottom: 20 }}>Predecí los 104 partidos y competí en la tabla de posiciones.</div>
          <div style={{ background: "#1a2035", borderRadius: 10, padding: "14px 20px", marginBottom: 20, textAlign: "left" }}>
            <div style={{ color: C.accent, fontWeight: 700, marginBottom: 8, fontSize: 13 }}>📊 Puntos por partido</div>
            <div style={{ fontSize: 13, color: C.textDim, lineHeight: 2.2 }}>
              +3 pts — Acertás ganador o empate<br />
              +1 pt &nbsp; — Acertás goles del local<br />
              +1 pt &nbsp; — Acertás goles del visitante<br />
              <span style={{ color: C.accent, fontWeight: 700 }}>Máximo 5 puntos por partido 🔥</span>
            </div>
          </div>
          <button style={s.btn()} onClick={() => setScreen("register")}>Anotarme al prode ⚡</button>
          <div style={{ marginTop: 10 }}>
            <button style={{ ...s.btn("ghost"), color: C.accent }} onClick={() => { loadData(); setScreen("leaderboard") }}>Ver tabla de posiciones 🏅</button>
          </div>
        </div>
        <div style={{ textAlign: "center", marginTop: 4 }}>
          <button style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer" }} onClick={() => setScreen("admin")}>
            🔧 Panel admin
          </button>
        </div>
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === "register") return (
    <div style={s.app}>
      <div style={s.header}>
        <button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 22 }} onClick={() => setScreen("home")}>←</button>
        <div style={s.logo}>REGISTRARSE</div>
        <div style={{ width: 32 }} />
      </div>
      <div style={{ padding: 20 }}>
        <div style={s.card}>
          <div style={{ fontSize: 22, textAlign: "center", marginBottom: 14 }}>👋</div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>¿Cómo te llamás?</div>
          <div style={{ color: C.textDim, fontSize: 13, marginBottom: 14 }}>Este nombre va a aparecer en la tabla.</div>
          <input style={s.input} placeholder="Tu nombre o apodo" value={regName}
            onChange={e => { setRegName(e.target.value); setRegError("") }}
            onKeyDown={e => e.key === "Enter" && handleRegister()} autoFocus />
          {regError && <div style={{ color: C.red, fontSize: 13, marginTop: 8 }}>{regError}</div>}
          <div style={{ marginTop: 16 }}>
            <button style={s.btn()} onClick={handleRegister}>Entrar al prode</button>
          </div>
        </div>
        {players.length > 0 && (
          <div style={s.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textDim, marginBottom: 10 }}>Ya anotados ({players.length})</div>
            {players.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: C.accent }}>
                  {p.name[0].toUpperCase()}
                </div>
                <div style={{ fontSize: 14 }}>{p.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // PREDICTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === "predictions" && user) {
    const hasUnsaved = Object.keys(editPreds).length > 0
    return (
      <div style={s.app}>
        <div style={s.header}>
          <button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 22 }} onClick={() => setScreen("home")}>←</button>
          <div style={{ textAlign: "center" }}>
            <div style={s.logo}>MIS PREDICCIONES</div>
            <div style={{ fontSize: 11, color: C.textDim }}>{user.name}</div>
          </div>
          <button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, fontWeight: 700 }} onClick={() => { loadData(); setScreen("leaderboard") }}>
            🏅
          </button>
        </div>

        {/* Stage tabs */}
        <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", background: C.card, borderBottom: `1px solid ${C.border}` }}>
          {STAGES.map(st => <button key={st} style={s.tab(stage === st)} onClick={() => setStage(st)}>{st}</button>)}
        </div>

        <div style={{ padding: "14px 16px", paddingBottom: hasUnsaved ? 90 : 20 }}>
          {matchesByStage.map(match => {
            const locked = isLocked(match.date)
            const result = getResult(match.id)
            const pred = myPreds(match.id)
            const pts = result && result.home_score !== null ? calcPoints(pred, result) : null
            const canEdit = !locked

            return (
              <div key={match.id} style={{ ...s.card, border: `1px solid ${result ? "#1e3a2f" : C.border}`, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{formatDate(match.date)}{match.venue ? ` · ${match.venue}` : ""}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {match.group && <span style={{ fontSize: 11, color: C.accentDim, fontWeight: 700 }}>Gr. {match.group}</span>}
                    {pts !== null && <span style={{ background: pts === 5 ? "#14532d" : pts >= 3 ? "#166534" : pts > 0 ? "#1e3318" : "#1e2940", color: pts > 0 ? "#4ade80" : C.muted, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>+{pts} pts</span>}
                    {locked && !result && <span style={{ fontSize: 11, color: C.muted }}>🔒</span>}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Home */}
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: 22 }}>{flag(match.home)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{match.home}</div>
                  </div>

                  {/* Scores */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    {result && result.home_score !== null && (
                      <div style={{ fontSize: 12, color: C.accent, fontWeight: 800, letterSpacing: 2 }}>
                        {result.home_score} – {result.away_score}
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {canEdit ? (
                        <>
                          <input type="number" min="0" max="20" style={s.scoreInput}
                            value={editPreds[match.id]?.home_score ?? (pred.home_score ?? "")}
                            onChange={e => setEditPreds(p => ({ ...p, [match.id]: { ...p[match.id], home_score: e.target.value } }))}
                          />
                          <span style={{ color: C.muted, fontWeight: 900 }}>:</span>
                          <input type="number" min="0" max="20" style={s.scoreInput}
                            value={editPreds[match.id]?.away_score ?? (pred.away_score ?? "")}
                            onChange={e => setEditPreds(p => ({ ...p, [match.id]: { ...p[match.id], away_score: e.target.value } }))}
                          />
                        </>
                      ) : (
                        <>
                          <div style={s.scoreBox(pts)}>{pred.home_score ?? "—"}</div>
                          <span style={{ color: C.muted, fontWeight: 900 }}>:</span>
                          <div style={s.scoreBox(pts)}>{pred.away_score ?? "—"}</div>
                        </>
                      )}
                    </div>
                    {!canEdit && pred.home_score !== undefined && (
                      <div style={{ fontSize: 10, color: C.muted }}>tu predicción</div>
                    )}
                  </div>

                  {/* Away */}
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontSize: 22 }}>{flag(match.away)}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{match.away}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {hasUnsaved && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#111827", borderTop: `2px solid ${C.accent}`, padding: "14px 20px", maxWidth: 860, margin: "0 auto" }}>
            <button style={s.btn()} onClick={savePredictions} disabled={saving}>
              {saving ? "Guardando..." : "💾 Guardar predicciones"}
            </button>
          </div>
        )}
        {flash && <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", borderRadius: 10, padding: "10px 24px", fontWeight: 700, fontSize: 14, zIndex: 200 }}>{flash}</div>}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LEADERBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === "leaderboard") return (
    <div style={s.app}>
      <div style={s.header}>
        <button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 22 }} onClick={() => setScreen(user ? "predictions" : "home")}>←</button>
        <div style={s.logo}>TABLA DE POSICIONES</div>
        <button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 18 }} onClick={loadData}>🔄</button>
      </div>
      <div style={{ padding: 16 }}>
        {board.length === 0 ? (
          <div style={{ ...s.card, textAlign: "center", color: C.textDim, padding: 40 }}>Todavía no hay jugadores</div>
        ) : board.map((p, i) => (
          <div key={p.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: p.id === user?.id ? "#131c2e" : C.card, border: `1px solid ${i === 0 ? "#4a6a0a" : p.id === user?.id ? C.accent : C.border}` }}>
            <div style={{ fontSize: i === 0 ? 30 : 22, minWidth: 36, textAlign: "center" }}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name} {p.id === user?.id && <span style={{ fontSize: 11, color: C.accent }}>(vos)</span>}</div>
              <div style={{ fontSize: 12, color: C.textDim }}>{p.played} partidos · {p.perfect} plenos 🔥</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: i === 0 ? C.accent : C.text }}>{p.total}</div>
              <div style={{ fontSize: 11, color: C.muted }}>pts</div>
            </div>
          </div>
        ))}

        <div style={{ ...s.card, textAlign: "center", marginTop: 8 }}>
          <div style={{ color: C.textDim, fontSize: 13, marginBottom: 10 }}>🔗 Compartí este link con tus amigos</div>
          <div style={{ background: "#1a2035", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.accent, wordBreak: "break-all", marginBottom: 10 }}>
            {window.location.href}
          </div>
          <button style={{ ...s.btn("ghost"), width: "auto", padding: "8px 20px", color: C.accent }} onClick={() => { navigator.clipboard?.writeText(window.location.href); showFlash("✓ Link copiado") }}>
            Copiar link
          </button>
        </div>
      </div>
      {flash && <div style={{ position: "fixed", bottom: 30, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", borderRadius: 10, padding: "10px 24px", fontWeight: 700, fontSize: 14, zIndex: 200 }}>{flash}</div>}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === "admin") {
    if (!adminMode) return (
      <div style={s.app}>
        <div style={s.header}>
          <button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 22 }} onClick={() => setScreen("home")}>←</button>
          <div style={s.logo}>PANEL ADMIN</div>
          <div style={{ width: 32 }} />
        </div>
        <div style={{ padding: 20 }}>
          <div style={s.card}>
            <div style={{ fontSize: 22, textAlign: "center", marginBottom: 14 }}>🔐</div>
            <div style={{ fontWeight: 700, marginBottom: 14 }}>Contraseña de admin</div>
            <input type="password" style={s.input} placeholder="Contraseña" value={adminPass}
              onChange={e => setAdminPass(e.target.value)}
              onKeyDown={e => e.key === "Enter" && (adminPass === ADMIN_PASSWORD ? setAdminMode(true) : alert("Contraseña incorrecta"))} />
            <div style={{ marginTop: 12 }}>
              <button style={s.btn()} onClick={() => adminPass === ADMIN_PASSWORD ? setAdminMode(true) : alert("Contraseña incorrecta")}>Entrar</button>
            </div>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: C.muted }}>Contraseña por defecto: <strong>mundial2026</strong></div>
          </div>
        </div>
      </div>
    )

    return (
      <div style={s.app}>
        <div style={s.header}>
          <button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 22 }} onClick={() => { setAdminMode(false); setScreen("home") }}>←</button>
          <div style={s.logo}>ADMIN · RESULTADOS</div>
          <button
            style={{ background: syncStatus === "loading" ? C.accentDim : C.accent, color: "#0a0e1a", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            onClick={syncLive} disabled={syncStatus === "loading"}>
            {syncStatus === "loading" ? "⏳" : syncStatus === "ok" ? "✓" : syncStatus === "error" ? "⚠️" : "⚡ API"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 16px", overflowX: "auto", background: C.card, borderBottom: `1px solid ${C.border}` }}>
          {STAGES.map(st => <button key={st} style={s.tab(stage === st)} onClick={() => setStage(st)}>{st}</button>)}
        </div>

        <div style={{ padding: "14px 16px", paddingBottom: Object.keys(editResults).length > 0 ? 90 : 20 }}>
          <div style={{ ...s.card, background: "#1a2035", marginBottom: 14, padding: 12 }}>
            <div style={{ fontSize: 13, color: C.textDim }}>
              Cargá los resultados manualmente o usá <strong style={{ color: C.accent }}>⚡ API</strong> para sync automática (disponible desde el 11 de junio).
            </div>
          </div>
          {matchesByStage.map(match => {
            const saved = getResult(match.id) || {}
            const edited = editResults[match.id] || {}
            const current = { ...saved, ...edited }
            return (
              <div key={match.id} style={{ ...s.card, padding: 14 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>{formatDate(match.date)} · {match.venue}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, textAlign: "right", fontSize: 13, fontWeight: 700 }}>{flag(match.home)} {match.home}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="number" min="0" max="20" style={s.scoreInput}
                      value={current.home_score ?? ""}
                      onChange={e => setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], home_score: e.target.value } }))} />
                    <span style={{ color: C.muted, fontWeight: 900 }}>:</span>
                    <input type="number" min="0" max="20" style={s.scoreInput}
                      value={current.away_score ?? ""}
                      onChange={e => setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], away_score: e.target.value } }))} />
                  </div>
                  <div style={{ flex: 1, textAlign: "left", fontSize: 13, fontWeight: 700 }}>{flag(match.away)} {match.away}</div>
                </div>
              </div>
            )
          })}
        </div>

        {Object.keys(editResults).length > 0 && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#111827", borderTop: `2px solid ${C.accent}`, padding: "14px 20px", maxWidth: 860, margin: "0 auto" }}>
            <button style={s.btn()} onClick={saveResults} disabled={saving}>
              {saving ? "Guardando..." : "💾 Guardar resultados"}
            </button>
          </div>
        )}
        {flash && <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: C.green, color: "#fff", borderRadius: 10, padding: "10px 24px", fontWeight: 700, fontSize: 14, zIndex: 200 }}>{flash}</div>}
      </div>
    )
  }

  return null
}
