import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "./supabase"
import { MATCHES, FLAGS, AVATARS, STAGES, calcPoints, formatDate, formatTime, isLocked, isSameDay } from "./data"

const ADMIN_PASSWORD = "mundial2026"

const C = {
  bg: "#0a0e1a", card: "#111827", card2: "#0f1624",
  border: "#1e2940", accent: "#c8a84b", accentDim: "#8a6e28",
  green: "#22c55e", red: "#ef4444",
  muted: "#6b7280", text: "#e2e8f0", textDim: "#94a3b8",
}

const btn = (v = "primary", extra = {}) => ({
  background: v === "primary" ? C.accent : v === "ghost" ? "transparent" : "#1a2035",
  color: v === "primary" ? "#0a0e1a" : v === "ghost" ? C.accent : C.text,
  border: v === "ghost" ? `1px solid ${C.accent}` : "none",
  borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", ...extra
})
const inp = (extra = {}) => ({ width: "100%", background: "#1a2035", border: `2px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 15, color: C.text, outline: "none", boxSizing: "border-box", ...extra })
const crd = (extra = {}) => ({ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 10, ...extra })

function flag(team) { return FLAGS[team] || "🏳️" }

function Avatar({ av = "⚽", size = 36, name = "" }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#1e2a45,#2a3a60)", border: `2px solid ${C.accentDim}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0 }}>
      {av || (name ? name[0].toUpperCase() : "⚽")}
    </div>
  )
}

function ScoreInput({ value, onChange }) {
  return <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} style={{ width: 44, height: 44, background: "#1a2035", border: `2px solid ${C.accent}`, borderRadius: 8, color: C.accent, fontSize: 20, fontWeight: 800, textAlign: "center", outline: "none" }} value={value ?? ""} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); if (v === "" || (parseInt(v) >= 0 && parseInt(v) <= 20)) onChange(v) }} />
}

function ScoreBox({ value, matchState = "upcoming" }) {
  // matchState: "upcoming" = editable (not shown as box), "inplay" = green border gray text, "finished" = gray border gray text
  const border = matchState === "inplay" ? "#22c55e" : "#2a2a2a"
  const bg = matchState === "inplay" ? "#0f2a1a" : "#1a1a1a"
  return <div style={{ width: 44, height: 44, background: bg, border: `2px solid ${border}`, borderRadius: 8, color: C.muted, fontSize: 20, fontWeight: 800, textAlign: "center", lineHeight: "40px", minWidth: 44 }}>{value ?? "—"}</div>
}

function FlashMsg({ msg }) {
  return <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: msg.startsWith("❌") ? "#7f1d1d" : "#14532d", color: "#fff", borderRadius: 10, padding: "10px 22px", fontWeight: 700, fontSize: 14, zIndex: 300, whiteSpace: "nowrap" }}>{msg}</div>
}

// ── Simple hash (not cryptographic, fine for a friends app) ──────────────────
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + "prode2026salt")
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("")
}

export default function App() {
  const [tab, setTab] = useState("home")
  const [user, setUser] = useState(null)
  const [authScreen, setAuthScreen] = useState("choose") // choose | register | login
  const [players, setPlayers] = useState([])
  const [predictions, setPredictions] = useState([])
  const [results, setResults] = useState([])
  const [messages, setMessages] = useState([])
  const [stage, setStage] = useState("Grupos")
  const [gruposView, setGruposView] = useState("grupo")
  const [scrollToMatchId, setScrollToMatchId] = useState(null) // "fecha" | "grupo"
  const [gruposSubFilter, setGruposSubFilter] = useState(null) // group letter or date string
  const [editPreds, setEditPreds] = useState({})
  const [editResults, setEditResults] = useState({})
  const [adminMode, setAdminMode] = useState(false)
  const [autoSyncStatus, setAutoSyncStatus] = useState("idle") // idle | searching | found | nothing | error
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [regClosesAt, setRegClosesAt] = useState("")
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [adminPass, setAdminPass] = useState("")
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState("")
  const [loading, setLoading] = useState(true)
  const [chatMsg, setChatMsg] = useState("")
  const chatEndRef = useRef(null)

  // register form
  const [regName, setRegName] = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regPassword2, setRegPassword2] = useState("")
  const [regAvatar, setRegAvatar] = useState("⚽")
  const [regDefault, setRegDefault] = useState("0-0")
  const [regError, setRegError] = useState("")

  // login form
  const [quickLoginPlayer, setQuickLoginPlayer] = useState(null)
  const [loginName, setLoginName] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")

  // settings form
  const [settName, setSettName] = useState("")
  const [settAvatar, setSettAvatar] = useState("⚽")
  const [settDefault, setSettDefault] = useState("0-0")
  const [settOldPass, setSettOldPass] = useState("")
  const [settNewPass, setSettNewPass] = useState("")
  const [settPassError, setSettPassError] = useState("")

  const showFlash = (msg) => { setFlash(msg); setTimeout(() => setFlash(""), 2500) }

  const loadData = useCallback(async () => {
    const [{ data: pl }, { data: pr }, { data: re }, { data: ms }] = await Promise.all([
      supabase.from("players").select("id,name,avatar,default_score,joined"),
      supabase.from("predictions").select("*"),
      supabase.from("results").select("*"),
      supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(200),
    ])
    if (pl) setPlayers(pl)
    if (pr) {
      setPredictions(pr)
      // Populate editPreds with user's saved predictions (single source of truth for inputs)
      const savedUser = localStorage.getItem("prode_user")
      if (savedUser) {
        const u = JSON.parse(savedUser)
        const myPreds = {}
        pr.filter(p => p.player_id === u.id).forEach(p => {
          myPreds[p.match_id] = { home_score: String(p.home_score ?? ""), away_score: String(p.away_score ?? ""), isDefault: p.is_default || false }
        })
        setEditPreds(myPreds)
        editPredsRef.current = myPreds
      }
    }
    if (re) { setResults(re); resultsRef.current = re }
    if (ms) setMessages(ms)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const saved = localStorage.getItem("prode_user")
    if (saved) {
      const u = JSON.parse(saved)
      // Always refresh user profile from Supabase on load
      supabase.from("players").select("*").eq("id", u.id).single().then(({ data: fresh }) => {
        if (fresh) {
          const me = { id: fresh.id, name: fresh.name, avatar: fresh.avatar, default_score: fresh.default_score }
          localStorage.setItem("prode_user", JSON.stringify(me))
          setUser(me)
          setSettName(me.name); setSettAvatar(me.avatar || "⚽"); setSettDefault(me.default_score || "0-0")
        } else {
          // Player deleted, log out
          localStorage.removeItem("prode_user")
        }
      })
    }
    // Load registration cutoff from config
    supabase.from("config").select("value").eq("key", "registration_closes_at").single().then(({ data }) => {
      if (data?.value) {
        setRegClosesAt(data.value)
        setRegistrationOpen(new Date() < new Date(data.value))
      }
    })

    const channel = supabase.channel("all_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "results" }, () => loadData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadData])

  // Auto-save default prediction when a match locks and user has no prediction
  useEffect(() => {
    if (!user) return
    const saveDefaultsForLockedMatches = async () => {
      const [dh, da] = (user.default_score || "0-0").split("-").map(Number)
      // Only save default if match is locked AND there's no prediction AT ALL in Supabase
      const { data: existing } = await supabase.from("predictions").select("match_id").eq("player_id", user.id)
      const existingIds = new Set((existing || []).map(p => p.match_id))
      const toSave = MATCHES.filter(m => {
        if (!isLocked(m.date)) return false
        return !existingIds.has(m.id) // only if not in DB at all
      })
      if (toSave.length === 0) return
      const upserts = toSave.map(m => ({
        player_id: user.id, match_id: m.id,
        home_score: dh, away_score: da, is_default: true
      }))
      await supabase.from("predictions").upsert(upserts, { onConflict: "player_id,match_id" })
      setEditPreds(prev => {
        const next = { ...prev }
        toSave.forEach(m => {
          if (!next[m.id]) next[m.id] = { home_score: String(dh), away_score: String(da), isDefault: true }
        })
        editPredsRef.current = next
        return next
      })
    }
    saveDefaultsForLockedMatches()
    const interval = setInterval(saveDefaultsForLockedMatches, 60000)
    return () => clearInterval(interval)
  }, [user])

  // Smart auto-sync using live-score-api.com
  useEffect(() => {
    const LS_KEY = import.meta.env.VITE_LIVESCORE_KEY || ""
    const LS_SECRET = import.meta.env.VITE_LIVESCORE_SECRET || ""
    if (!LS_KEY || !LS_SECRET) return

    const fuzzyMatch = (a, b) => {
      const na = a.toLowerCase(), nb = b.toLowerCase()
      return na.includes(nb.slice(0, 5)) || nb.includes(na.slice(0, 5))
    }

    const processFixtures = async (fixtures, activeMatches) => {
      const upserts = []
      activeMatches.forEach(local => {
        const homeSearch = local.homeApi || local.home
        const awaySearch = local.awayApi || local.away
        // live-score-api uses home_name/away_name
        const match = fixtures.find(f =>
          fuzzyMatch(f.home_name || f.home?.name || "", homeSearch) &&
          fuzzyMatch(f.away_name || f.away?.name || "", awaySearch)
        )
        if (!match) return
        const apiStatus = match.status === "IN PLAY" ? "IN_PLAY"
          : match.status === "FINISHED" ? "FINISHED"
          : "SCHEDULED"
        // score comes as "0 - 0" string
        const scoreParts = (match.score || match.ft_score || "").split(" - ")
        const homeScore = parseInt(scoreParts[0])
        const awayScore = parseInt(scoreParts[1])
        // Only save if match is IN_PLAY or FINISHED and has valid score
        if (apiStatus === "SCHEDULED") return
        if (apiStatus === "FINISHED" && isNaN(homeScore)) return
        upserts.push({
          match_id: local.id,
          home_score: isNaN(homeScore) ? 0 : homeScore,
          away_score: isNaN(awayScore) ? 0 : awayScore,
          status: apiStatus,
          updated_at: new Date().toISOString()
        })
      })
      if (upserts.length > 0) {
        await supabase.from("results").upsert(upserts, { onConflict: "match_id" })
        setResults(prev => {
          const next = [...prev]
          upserts.forEach(u => {
            const idx = next.findIndex(r => r.match_id === u.match_id)
            if (idx >= 0) next[idx] = { ...next[idx], ...u }
            else next.push(u)
          })
          return next
        })
        setAutoSyncStatus("found")
      } else {
        setAutoSyncStatus("nothing")
      }
    }

    const syncResults = async () => {
      const todayMatches = MATCHES.filter(m => isSameDay(m.date))
      if (!todayMatches.length) return

      const now = new Date()
      const activeMatches = todayMatches.filter(m => {
        const start = new Date(m.date)
        if (now < new Date(start.getTime() - 5 * 60 * 1000)) return false
        const result = resultsRef.current.find(r => r.match_id === m.id)
        if (result?.status === "FINISHED") return false
        return true
      })
      if (!activeMatches.length) { setAutoSyncStatus("idle"); return }

      setAutoSyncStatus("searching")
      try {
        // Try live scores (filter to National Teams Friendlies + World Cup)
        const liveRes = await fetch(
          `https://livescore-api.com/api-client/scores/live.json?key=${LS_KEY}&secret=${LS_SECRET}&competition_id=371`
        )
        if (liveRes.ok) {
          const liveData = await liveRes.json()
          const liveFixtures = liveData?.data?.match || []
          await processFixtures(liveFixtures, activeMatches)
        }

        // Also check history for recently finished matches
        const today = new Date().toISOString().slice(0, 10)
        const histRes = await fetch(
          `https://livescore-api.com/api-client/scores/history.json?key=${LS_KEY}&secret=${LS_SECRET}&competition_id=371&date=${today}`
        )
        if (histRes.ok) {
          const histData = await histRes.json()
          const histFixtures = (histData?.data?.match || []).map(m => ({ ...m, status: "FINISHED" }))
          await processFixtures(histFixtures, activeMatches)
        }
      } catch (e) {
        setAutoSyncStatus("error")
      }
    }

    const interval = setInterval(syncResults, 10 * 60 * 1000)
    syncResults()
    return () => clearInterval(interval)
  }, []) // eslint-disable-line

  const chatScrollRef = useRef(null)

  // Auto-save predictions after 1.5s of inactivity
  const saveTimerRef = useRef(null)
  const editPredsRef = useRef({})
  const resultsRef = useRef([])

  const autoSavePredictions = useCallback(async () => {
    const preds = editPredsRef.current
    if (!user || Object.keys(preds).length === 0) return
    const entries = Object.entries(preds)
    const upserts = entries
      .map(([match_id, sc]) => ({ player_id: user.id, match_id: parseInt(match_id), home_score: parseInt(sc.home_score), away_score: parseInt(sc.away_score) }))
      .filter(u => !isNaN(u.home_score) && !isNaN(u.away_score))
    const toDelete = entries
      .filter(([, sc]) => (sc.home_score === "" || sc.home_score === undefined) && (sc.away_score === "" || sc.away_score === undefined))
      .map(([match_id]) => parseInt(match_id))
    // Fire and forget - don't touch editPreds state, inputs stay stable
    if (upserts.length > 0) await supabase.from("predictions").upsert(upserts, { onConflict: "player_id,match_id" })
    if (toDelete.length > 0) await supabase.from("predictions").delete().eq("player_id", user.id).in("match_id", toDelete)
    showFlash("✓ Guardado")
  }, [user])

  const hasPrediction = (matchId) => {
    const ep = editPreds[matchId]
    return ep && (ep.home_score !== "" && ep.home_score !== undefined) && (ep.away_score !== "" && ep.away_score !== undefined)
  }
  const todayUnbet = user ? MATCHES.filter(m => {
    if (!isSameDay(m.date) || isLocked(m.date)) return false
    return !hasPrediction(m.id)
  }) : []

  // ── REGISTER ──────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const name = regName.trim()
    if (!name) { setRegError("Ingresá tu nombre"); return }
    if (!regPassword) { setRegError("Ingresá una contraseña"); return }
    if (regPassword !== regPassword2) { setRegError("Las contraseñas no coinciden"); return }
    if (regPassword.length < 4) { setRegError("La contraseña debe tener al menos 4 caracteres"); return }
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) { setRegError("Ese nombre ya existe, elegí otro"); return }
    const id = name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now().toString(36)
    const hashed = await hashPassword(regPassword)
    const { error } = await supabase.from("players").insert({ id, name, avatar: regAvatar, default_score: regDefault, password: hashed })
    if (error) { setRegError("Error al registrarse, intentá de nuevo"); return }
    const me = { id, name, avatar: regAvatar, default_score: regDefault }
    localStorage.setItem("prode_user", JSON.stringify(me))
    setUser(me)
    setSettName(name); setSettAvatar(regAvatar); setSettDefault(regDefault)
    loadData()
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const name = loginName.trim()
    if (!name || !loginPassword) { setLoginError("Completá todos los campos"); return }
    const { data: player } = await supabase.from("players").select("*").ilike("name", name).single()
    if (!player) { setLoginError("No existe un jugador con ese nombre"); return }
    const hashed = await hashPassword(loginPassword)
    if (player.password && player.password !== hashed) { setLoginError("Contraseña incorrecta"); return }
    // allow login if no password set yet (legacy players)
    const me = { id: player.id, name: player.name, avatar: player.avatar, default_score: player.default_score }
    localStorage.setItem("prode_user", JSON.stringify(me))
    setUser(me)
    setSettName(me.name); setSettAvatar(me.avatar || "⚽"); setSettDefault(me.default_score || "0-0")
    loadData()
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    localStorage.removeItem("prode_user")
    setUser(null); setTab("home"); setAuthScreen("choose")
    setLoginName(""); setLoginPassword(""); setLoginError("")
    setShowLogoutConfirm(false)
  }

  // ── SAVE PREDICTIONS ───────────────────────────────────────────────────────
  const savePredictions = async () => {
    if (!user) return
    setSaving(true)
    const upserts = Object.entries(editPreds)
      .map(([match_id, sc]) => ({ player_id: user.id, match_id: parseInt(match_id), home_score: parseInt(sc.home_score), away_score: parseInt(sc.away_score) }))
      .filter(u => !isNaN(u.home_score) && !isNaN(u.away_score))
    if (upserts.length > 0) await supabase.from("predictions").upsert(upserts, { onConflict: "player_id,match_id" })
    setEditPreds({}); setSaving(false)
    showFlash("✓ Predicciones guardadas"); loadData()
  }



  // ── SAVE RESULTS ───────────────────────────────────────────────────────────
  const saveResults = async () => {
    setSaving(true)
    const upserts = Object.entries(editResults).map(([match_id, sc]) => ({
      match_id: parseInt(match_id),
      home_score: sc.home_score === "" ? null : parseInt(sc.home_score),
      away_score: sc.away_score === "" ? null : parseInt(sc.away_score),
      updated_at: new Date().toISOString(),
    }))
    await supabase.from("results").upsert(upserts, { onConflict: "match_id" })
    setEditResults({}); setSaving(false); showFlash("✓ Resultados guardados"); loadData()
  }

  // ── SAVE SETTINGS ──────────────────────────────────────────────────────────
  const saveSettings = async () => {
    if (!user) return
    setSaving(true)
    const updates = { name: settName, avatar: settAvatar, default_score: settDefault }

    // change password if requested
    if (settNewPass) {
      if (settNewPass.length < 4) { setSettPassError("La contraseña debe tener al menos 4 caracteres"); setSaving(false); return }
      if (!settOldPass) { setSettPassError("Ingresá tu contraseña actual"); setSaving(false); return }
      const oldHashed = await hashPassword(settOldPass)
      const { data: current } = await supabase.from("players").select("password").eq("id", user.id).single()
      if (current?.password && current.password !== oldHashed) { setSettPassError("Contraseña actual incorrecta"); setSaving(false); return }
      updates.password = await hashPassword(settNewPass)
      setSettOldPass(""); setSettNewPass(""); setSettPassError("")
    }

    await supabase.from("players").update(updates).eq("id", user.id)
    const updated = { ...user, name: settName, avatar: settAvatar, default_score: settDefault }
    localStorage.setItem("prode_user", JSON.stringify(updated))
    setUser(updated)
    setPlayers(prev => prev.map(p => p.id === user.id ? { ...p, name: settName, avatar: settAvatar, default_score: settDefault } : p))
    setSaving(false)
    showFlash("✓ Configuración guardada")
  }

  // ── SEND CHAT ──────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatMsg.trim() || !user) return
    const msg = { player_id: user.id, player_name: user.name, avatar: user.avatar, message: chatMsg.trim(), created_at: new Date().toISOString(), id: Date.now() }
    setMessages(prev => [...prev, msg])
    setChatMsg("")
    await supabase.from("chat_messages").insert({ player_id: user.id, player_name: user.name, avatar: user.avatar, message: msg.message })
  }

  // ── LEADERBOARD ────────────────────────────────────────────────────────────
  const board = players.map(p => {
    let total = 0, played = 0, perfect = 0
    MATCHES.forEach(m => {
      const r = results.find(r => r.match_id === m.id)
      if (!r || r.home_score === null) return
      // Only count finished matches (status = FINISHED or fallback: 2hs since kickoff)
      const matchStart = new Date(m.date)
      const finished = r.status === "FINISHED" ||
        (!r.status && new Date() >= new Date(matchStart.getTime() + 2 * 60 * 60 * 1000))
      if (!finished) return
      const pred = predictions.find(pr => pr.player_id === p.id && pr.match_id === m.id)
      if (!pred) return
      const pts = calcPoints(pred, r)
      if (pts !== null) { total += pts; played++; if (pts === 5) perfect++ }
    })
    return { ...p, total, played, perfect }
  }).sort((a, b) => b.total - a.total)

  const myPred = (matchId, locked = false) => {
    const edited = editPreds[matchId]
    if (edited) return edited
    return {}
  }
  const getResult = (matchId) => results.find(r => r.match_id === matchId)
  const matchesByStage = MATCHES.filter(m => m.stage === stage)
  const hasUnsaved = Object.keys(editPreds).length > 0

  const appStyle = { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto", paddingTop: 56 }

  const Header = ({ title, right }) => (
    <div style={{ background: "linear-gradient(135deg,#0f172a,#1e2a45)", borderBottom: `1px solid ${C.border}`, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.accent }}>{title}</div>
      {right || <div style={{ width: 60 }} />}
    </div>
  )

  const BottomNav = () => (
    <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 860, background: "#0d1525", borderBottom: `1px solid ${C.border}`, display: "flex", zIndex: 200 }}>
      {[{ id: "home", icon: "🏠", label: "Inicio" }, { id: "fixture", icon: "📅", label: "Fixture" }, { id: "table", icon: "🏅", label: "Tabla" }, { id: "chat", icon: "💬", label: "Chat" }, { id: "settings", icon: "⚙️", label: "Config" }].map(({ id, icon, label }) => (
        <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 0 8px", background: "none", border: "none", cursor: "pointer", color: tab === id ? C.accent : C.muted, borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}` }}>
          <div style={{ fontSize: 20 }}>{icon}</div>
          <div style={{ fontSize: 10, fontWeight: 700 }}>{label}</div>
        </button>
      ))}
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 52 }}>⚽</div>
      <div style={{ color: C.accent, fontWeight: 700 }}>Cargando prode...</div>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // AUTH SCREENS (not logged in)
  // ════════════════════════════════════════════════════════════════════════════
  if (!user) {
    const AuthHeader = () => (
      <div style={{ background: "linear-gradient(135deg,#0f172a,#1e2a45)", borderBottom: `1px solid ${C.border}`, padding: "32px 20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 52 }}>🏆</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.accent, marginTop: 8 }}>PRODE MUNDIAL 2026</div>
        <div style={{ color: C.textDim, fontSize: 13, marginTop: 4 }}>USA · México · Canadá · 11 Jun – 19 Jul</div>
      </div>
    )

    // CHOOSE: register or login
    if (authScreen === "choose") return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto" }}>
        <AuthHeader />
        <div style={{ padding: 20 }}>
          <div style={crd({ background: "#1a2035", marginBottom: 16 })}>
            <div style={{ color: C.accent, fontWeight: 700, marginBottom: 8 }}>📊 Sistema de puntos</div>
            <div style={{ fontSize: 13, color: C.textDim, lineHeight: 2.1 }}>
              +3 pts — Acertás ganador o empate<br />
              +1 pt &nbsp;— Acertás goles del local<br />
              +1 pt &nbsp;— Acertás goles del visitante<br />
              <span style={{ color: C.accent, fontWeight: 700 }}>Máximo 5 puntos por partido 🔥</span>
            </div>
          </div>
          {registrationOpen
            ? <button style={btn("primary", { width: "100%", marginBottom: 10, padding: "14px" })} onClick={() => setAuthScreen("register")}>
                Anotarme al prode ⚡
              </button>
            : <div style={{ background: "#1a1a1a", border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px", textAlign: "center", color: C.muted, fontSize: 14, marginBottom: 10 }}>
                🔒 Inscripción cerrada
              </div>
          }
          <button style={btn("ghost", { width: "100%", padding: "14px" })} onClick={() => setAuthScreen("login")}>
            Ya tengo cuenta — Ingresar
          </button>
          {players.length > 0 && (
            <div style={crd({ marginTop: 16 })}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.textDim, marginBottom: 10 }}>Ya anotados — tocá tu nombre para entrar</div>
              {players.map(p => (
                <div key={p.id} onClick={() => { setQuickLoginPlayer(p); setLoginName(p.name); setLoginPassword(""); setLoginError(""); setAuthScreen("login") }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px", borderRadius: 8, cursor: "pointer", marginBottom: 2, transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1a2035"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Avatar av={p.avatar} size={36} name={p.name} />
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ marginLeft: "auto", fontSize: 18, color: C.accentDim }}>→</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )

    // REGISTER
    if (authScreen === "register") return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto" }}>
        <AuthHeader />
        <div style={{ padding: 20 }}>
          <div style={crd()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>👋 Crear cuenta</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}>Tu nombre</div>
              <input style={inp()} placeholder="Nombre o apodo" value={regName} onChange={e => { setRegName(e.target.value); setRegError("") }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}>Contraseña</div>
              <input type="password" style={inp()} placeholder="Mínimo 4 caracteres" value={regPassword} onChange={e => { setRegPassword(e.target.value); setRegError("") }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}>Repetir contraseña</div>
              <input type="password" style={inp()} placeholder="Repetí la contraseña" value={regPassword2} onChange={e => { setRegPassword2(e.target.value); setRegError("") }} onKeyDown={e => e.key === "Enter" && handleRegister()} />
            </div>
            {regError && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{regError}</div>}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 8 }}>Elegí tu avatar</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {AVATARS.map(av => (
                  <button key={av} onClick={() => setRegAvatar(av)} style={{ fontSize: 22, width: 44, height: 44, borderRadius: 10, cursor: "pointer", background: regAvatar === av ? C.accentDim : "#1a2035", border: `2px solid ${regAvatar === av ? C.accent : C.border}` }}>{av}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 4 }}>Resultado por defecto <span style={{ color: C.muted }}>(si olvidás cargar)</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["0-0","1-0","0-1","1-1","2-1","2-0","2-2"].map(sc => (
                  <button key={sc} onClick={() => setRegDefault(sc)} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", background: regDefault === sc ? C.accentDim : "#1a2035", border: `2px solid ${regDefault === sc ? C.accent : C.border}`, color: regDefault === sc ? C.accent : C.textDim }}>{sc}</button>
                ))}
              </div>
            </div>
            <button style={btn("primary", { width: "100%", marginBottom: 10 })} onClick={handleRegister}>Crear cuenta ⚡</button>
            <button style={btn("ghost", { width: "100%" })} onClick={() => { setAuthScreen("choose"); setRegError("") }}>← Volver</button>
          </div>
        </div>
      </div>
    )

    // LOGIN
    if (authScreen === "login") return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto" }}>
        <AuthHeader />
        <div style={{ padding: 20 }}>
          <div style={crd()}>
            {quickLoginPlayer ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
                <Avatar av={quickLoginPlayer.avatar} size={48} name={quickLoginPlayer.name} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{quickLoginPlayer.name}</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>Ingresá tu contraseña</div>
                </div>
              </div>
            ) : (
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>🔐 Ingresar</div>
            )}
            {!quickLoginPlayer && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}>Tu nombre</div>
                <input style={inp()} placeholder="Nombre o apodo" value={loginName} onChange={e => { setLoginName(e.target.value); setLoginError("") }} />
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}>Contraseña</div>
              <input type="password" style={inp()} placeholder="Tu contraseña" value={loginPassword} autoFocus
                onChange={e => { setLoginPassword(e.target.value); setLoginError("") }} onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            {loginError && <div style={{ color: C.red, fontSize: 13, marginBottom: 12 }}>{loginError}</div>}
            <button style={btn("primary", { width: "100%", marginBottom: 10 })} onClick={handleLogin}>Entrar</button>
            <button style={btn("ghost", { width: "100%" })} onClick={() => { setAuthScreen("choose"); setQuickLoginPlayer(null); setLoginError("") }}>← Volver</button>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HOME
  // ════════════════════════════════════════════════════════════════════════════
  if (tab === "home") {
    const me = board.find(p => p.id === user.id)
    const myRank = board.findIndex(p => p.id === user.id) + 1
    // Partidos de hoy (fecha real)
    const todayMatches = MATCHES.filter(m => isSameDay(m.date))
    // Próximos 6 partidos que no son de hoy y aún no arrancaron
    const upcomingMatches = MATCHES.filter(m => !isSameDay(m.date) && new Date(m.date) > new Date()).slice(0, 6)
    const nextMatch = null
    return (
      <div style={appStyle}>
        <div style={{ background: "linear-gradient(135deg,#0f172a,#1e2a45)", borderBottom: `1px solid ${C.border}`, padding: "20px 18px 16px", display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar av={user.avatar} size={52} name={user.name} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>¡Hola, {user.name}!</div>
            <div style={{ fontSize: 13, color: C.textDim }}>Mundial 2026 · {players.length} participantes</div>
          </div>
        </div>
        <div style={{ padding: "14px 16px" }}>
          {todayUnbet.length > 0 && (
            <div style={{ background: "#2a1a00", border: `1px solid ${C.accent}`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>⚠️ {todayUnbet.length} partido(s) hoy sin pronóstico</div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{todayUnbet.map(m => `${m.home} vs ${m.away} (${formatTime(m.date)})`).join(" · ")}</div>
              </div>
              <button onClick={() => {
                const target = todayUnbet[0]
                if (target) {
                  setStage(target.stage || "Grupos")
                  setScrollToMatchId(target.id)
                }
                setTab("fixture")
              }} style={btn("primary", { padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" })}>Ir →</button>
            </div>
          )}
          <div style={crd({ display: "flex", gap: 0, padding: 0, overflow: "hidden" })}>
            {[{ label: "Posición", value: myRank ? `#${myRank}` : "—", icon: "🏅" }, { label: "Puntos", value: me?.total ?? 0, icon: "⭐" }, { label: "Jugados", value: me?.played ?? 0, icon: "📊" }, { label: "Plenos", value: me?.perfect ?? 0, icon: "🔥" }].map(({ label, value, icon }, i) => (
              <div key={label} style={{ flex: 1, textAlign: "center", padding: "14px 4px", borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ fontSize: 18 }}>{icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, lineHeight: 1.2 }}>{value}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={crd({ padding: 0, overflow: "hidden" })}>
            <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, padding: "12px 14px 8px" }}>📅 PARTIDOS DE HOY</div>
            {todayMatches.length === 0
              ? <div style={{ padding: "14px 14px 16px", fontSize: 14, color: C.textDim }}>Hoy no hay partidos, campión 😎</div>
              : todayMatches.map((m, i) => {
                const locked = isLocked(m.date)
                const result = getResult(m.id)
                const pred = myPred(m.id, locked)
                const pts = result && result.home_score !== null ? calcPoints(pred, result) : null
                const hasPred = hasPrediction(m.id)
                const dbRes = getResult(m.id)
                const matchStart2 = new Date(m.date)
                const twoHrsPast = new Date() >= new Date(matchStart2.getTime() + 2 * 60 * 60 * 1000)
                const inPlay = locked && dbRes?.status !== "FINISHED" && !twoHrsPast
                const inProgress = locked && result && result.home_score !== null
                const finished = inProgress // for now same signal; could add status field later
                const showDefault = locked && !hasPred
                const effectivePred = hasPred ? pred : (locked ? pred : null) // pred already returns default when locked
                return (
                  <div key={m.id} style={{ padding: "10px 14px", borderTop: i > 0 ? `1px solid ${C.border}` : "none", position: "relative" }}>
                    {inPlay && <span style={{ position: "absolute", top: 8, right: 14, fontSize: 10, color: C.green, fontWeight: 800, background: "#14532d", borderRadius: 4, padding: "2px 6px" }}>⚽ en juego</span>}
                    {locked && !inPlay && result && result.home_score !== null && <span style={{ position: "absolute", top: 8, right: 14, fontSize: 10, color: C.text, fontWeight: 700 }}>✓ finalizado</span>}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontSize: 22 }}>{flag(m.home)}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{m.home}</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{formatTime(m.date)}</div>
                      {result && result.home_score !== null
                        ? <div style={{ fontSize: 18, fontWeight: 800, color: inPlay ? C.green : C.text }}>{result.home_score} – {result.away_score}</div>
                        : <div style={{ fontSize: 13, color: C.textDim, fontWeight: 700 }}>VS</div>
                      }
                      {/* Before match */}
                      {!locked && !hasPred && (
                        <div style={{ fontSize: 10, color: C.red, marginTop: 4, fontWeight: 600 }}>sin pronóstico</div>
                      )}
                      {!locked && hasPred && (
                        <div style={{ marginTop: 4, textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: C.accentDim, fontWeight: 600 }}>mi pronóstico</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.accent }}>{pred.home_score} : {pred.away_score}</div>
                        </div>
                      )}
                      {/* During/after match */}
                      {locked && effectivePred && (
                        <div style={{ marginTop: 4, textAlign: "center" }}>
                          <div style={{ fontSize: 10, color: inPlay ? C.accentDim : C.muted, fontWeight: 600 }}>mi pronóstico</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: inPlay ? C.accent : C.muted }}>
                            {effectivePred.home_score} : {effectivePred.away_score}
                          </div>
                          {effectivePred.isDefault && <div style={{ fontSize: 10, color: inPlay ? C.accent : C.muted, fontWeight: 600 }}>(default)</div>}
                          {pts !== null && !inPlay && (
                            <div style={{ fontSize: 11, color: pts > 0 ? C.green : C.muted, fontWeight: 700 }}>+{pts} pts</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: 22 }}>{flag(m.away)}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{m.away}</div>
                    </div>
                    </div>
                  </div>
                )
              })}
          </div>

          {upcomingMatches.length > 0 && (
            <div style={crd({ padding: 0, overflow: "hidden" })}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, padding: "12px 14px 8px" }}>⏭ PRÓXIMOS PARTIDOS</div>
              {upcomingMatches.map((m, i) => {
                const locked = isLocked(m.date)
                const result = getResult(m.id)
                const pred = myPred(m.id, locked)
                const pts = result && result.home_score !== null ? calcPoints(pred, result) : null
                const hasPred = hasPrediction(m.id)
                return (
                  <div key={m.id} style={{ padding: "10px 14px", borderTop: i > 0 ? `1px solid ${C.border}` : "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontSize: 22 }}>{flag(m.home)}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{m.home}</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 100 }}>
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{formatDate(m.date)}</div>
                      <div style={{ fontSize: 13, color: C.textDim, fontWeight: 700 }}>VS</div>
                      {hasPred
                        ? <div style={{ marginTop: 4, textAlign: "center" }}>
                            <div style={{ fontSize: 10, color: C.accentDim, fontWeight: 600 }}>mi pronóstico</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: C.accent }}>
                              {pred.home_score} : {pred.away_score}
                            </div>
                          </div>
                        : <div style={{ fontSize: 10, color: C.red, marginTop: 4, fontWeight: 600 }}>sin pronóstico</div>
                      }
                    </div>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontSize: 22 }}>{flag(m.away)}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{m.away}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {nextMatch && (
            <div style={crd()}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 8 }}>⏱ PRÓXIMO PARTIDO</div>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 28 }}>{flag(nextMatch.home)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{nextMatch.home}</div>
                </div>
                <div style={{ textAlign: "center", padding: "0 10px" }}>
                  <div style={{ fontSize: 11, color: C.muted }}>{formatDate(nextMatch.date)}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textDim, margin: "4px 0" }}>VS</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{nextMatch.venue}</div>
                </div>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ fontSize: 28 }}>{flag(nextMatch.away)}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{nextMatch.away}</div>
                </div>
              </div>
              {!hasPrediction(nextMatch.id) && (
                <button onClick={() => setTab("fixture")} style={btn("ghost", { width: "100%", marginTop: 10, fontSize: 13 })}>Cargar pronóstico →</button>
              )}
            </div>
          )}
          <div style={crd({ textAlign: "center" })}>
            <div style={{ color: C.textDim, fontSize: 13, marginBottom: 8 }}>🔗 Invitá a tus amigos</div>
            <button style={btn("ghost", { width: "auto", padding: "8px 20px", fontSize: 13 })} onClick={() => { navigator.clipboard?.writeText(window.location.href); showFlash("✓ Link copiado") }}>Copiar link del prode</button>
          </div>
        </div>
        <BottomNav />
        {flash && <FlashMsg msg={flash} />}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FIXTURE
  // ════════════════════════════════════════════════════════════════════════════
  if (tab === "fixture") {
    // Build subgroups for Grupos stage
    const grupoLetters = ["A","B","C","D","E","F","G","H","I","J","K","L"]
    const fechaGroups = [
      { date: "Fecha 1", matches: MATCHES.filter(m => m.stage === "Grupos" && m.id >= 1  && m.id <= 24) },
      { date: "Fecha 2", matches: MATCHES.filter(m => m.stage === "Grupos" && m.id >= 25 && m.id <= 48) },
      { date: "Fecha 3", matches: MATCHES.filter(m => m.stage === "Grupos" && m.id >= 49 && m.id <= 72) },
    ]

    const renderMatchCard = (match) => {
      const locked = isLocked(match.date)
      const result = getResult(match.id)
      const pred = myPred(match.id, locked)
      const pts = result && result.home_score !== null ? calcPoints(pred, result) : null
      const dbResult = getResult(match.id)
      const matchStart = new Date(match.date)
      const twoHoursPast = new Date() >= new Date(matchStart.getTime() + 2 * 60 * 60 * 1000)
      const matchState = !locked ? "upcoming"
        : (dbResult?.status === "FINISHED") ? "finished"
        : (dbResult?.status === "IN_PLAY") ? "inplay"
        : twoHoursPast ? "finished" // fallback: 2hrs since kickoff = finished
        : "inplay"
      return (
        <div key={match.id} id={"match-" + match.id} style={crd({ border: `1px solid ${matchState === "inplay" ? "#1a3a1a" : result ? "#1e2a2e" : C.border}`, padding: 12 })}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: C.muted }}>{formatDate(match.date)}{match.venue ? ` · ${match.venue}` : ""}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {match.stage === "Grupos" && gruposView === "grupo" && (
                <span style={{ fontSize: 11, color: C.accentDim, fontWeight: 700 }}>
                  F{match.id <= 24 ? 1 : match.id <= 48 ? 2 : 3}
                </span>
              )}
              {match.group && match.stage === "Grupos" && gruposView === "fecha" && (
                <span style={{ fontSize: 11, color: C.accentDim, fontWeight: 700 }}>Gr.{match.group}</span>
              )}
              {pts !== null && matchState === "finished" && <span style={{ background: pts > 0 ? "#14532d" : "#1e2940", color: pts > 0 ? "#4ade80" : C.muted, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>+{pts}pts</span>}
              {matchState === "inplay" && <span style={{ fontSize: 10, color: C.green, fontWeight: 800, background: "#14532d", borderRadius: 4, padding: "1px 5px" }}>⚽ en juego</span>}
              {locked && !result && matchState === "finished" && <span style={{ fontSize: 11, color: C.muted }}>🔒</span>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, textAlign: "right" }}>
              <div style={{ fontSize: 26 }}>{flag(match.home)}</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{match.home}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 110 }}>
              {result && result.home_score !== null && (
                <div style={{ fontSize: 12, color: matchState === "inplay" ? C.green : C.text, fontWeight: 800 }}>
                  {result.home_score} – {result.away_score}
                  {matchState === "inplay" && <span style={{ fontSize: 10, color: C.green, fontWeight: 400 }}> ⚽</span>}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {!locked ? (
                  <>
                    <ScoreInput value={editPreds[match.id]?.home_score ?? pred?.home_score} onChange={v => {
                      setEditPreds(prev => { const next = { ...prev, [match.id]: { ...prev[match.id], home_score: v } }; editPredsRef.current = next; return next })
                      clearTimeout(saveTimerRef.current)
                      saveTimerRef.current = setTimeout(autoSavePredictions, 1500)
                    }} />
                    <span style={{ color: C.muted, fontWeight: 900 }}>:</span>
                    <ScoreInput value={editPreds[match.id]?.away_score ?? pred?.away_score} onChange={v => {
                      setEditPreds(prev => { const next = { ...prev, [match.id]: { ...prev[match.id], away_score: v } }; editPredsRef.current = next; return next })
                      clearTimeout(saveTimerRef.current)
                      saveTimerRef.current = setTimeout(autoSavePredictions, 1500)
                    }} />
                  </>
                ) : (
                  <>
                    <ScoreBox value={pred?.home_score} matchState={matchState} />
                    <span style={{ color: C.muted, fontWeight: 900 }}>:</span>
                    <ScoreBox value={pred?.away_score} matchState={matchState} />
                  </>
                )}
              </div>
              {locked && pred?.isDefault && (
                <div style={{ fontSize: 10, color: C.muted }}>(default)</div>
              )}
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 26 }}>{flag(match.away)}</div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{match.away}</div>
            </div>
          </div>
        </div>
      )
    }

    return (
    <div style={appStyle}>
      <Header title="📅 Fixture" />
      <div style={{ display: "flex", gap: 5, padding: "10px 14px", overflowX: "auto", background: C.card2, borderBottom: `1px solid ${C.border}` }}>
        {STAGES.map(st => (
          <button key={st} onClick={() => { setStage(st); setGruposSubFilter(null) }} style={{ background: stage === st ? C.accent : "transparent", color: stage === st ? "#0a0e1a" : C.textDim, border: `1px solid ${stage === st ? C.accent : C.border}`, borderRadius: 8, padding: "6px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{st}</button>
        ))}
      </div>

      {/* Grupos sub-controls */}
      {stage === "Grupos" && (
        <>
          {/* Por Fecha / Por Grupo toggle */}
          <div style={{ padding: "8px 14px 0", background: C.card2, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", background: "#0a0e1a", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, flexShrink: 0 }}>
              {[["grupo","Por grupo"], ["fecha","Por fecha"]].map(([v, label]) => (
                <button key={v} onClick={() => { setGruposView(v); setGruposSubFilter(null) }} style={{ padding: "7px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none", background: gruposView === v ? C.accent : "transparent", color: gruposView === v ? "#0a0e1a" : C.textDim }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Subfilter pills */}
          <div style={{ display: "flex", gap: 5, padding: "8px 14px", background: C.card2, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
            {gruposView === "grupo"
              ? grupoLetters.map(g => (
                <button key={g} onClick={() => setTimeout(() => document.getElementById("grp-"+g)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)}
                  style={{ padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, whiteSpace: "nowrap", flexShrink: 0 }}>
                  Gr. {g}
                </button>
              ))
              : fechaGroups.map((fg, i) => (
                <button key={i} onClick={() => setTimeout(() => document.getElementById("fecha-"+i)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)}
                  style={{ padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {fg.date}
                </button>
              ))
            }
          </div>
        </>
      )}

      {todayUnbet.length > 0 && (
        <div style={{ background: "#1a1200", borderBottom: `1px solid ${C.accentDim}`, padding: "8px 16px", fontSize: 12, color: C.accent }}>
          ⚠️ Tenés {todayUnbet.length} partido(s) hoy sin pronóstico
        </div>
      )}

      <div style={{ padding: "12px 14px", paddingBottom: 20 }}>
        {stage === "Grupos" && gruposView === "grupo" && (
          grupoLetters.map(g => {
            const gMatches = MATCHES.filter(m => m.stage === "Grupos" && m.group === g)
            if (!gMatches.length) return null
            return (
              <div key={g} id={"grp-"+g}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, padding: "10px 4px 6px", letterSpacing: 1 }}>GRUPO {g}</div>
                {gMatches.map(renderMatchCard)}
              </div>
            )
          })
        )}
        {stage === "Grupos" && gruposView === "fecha" && (
          fechaGroups.map((fg, i) => (
            <div key={i} id={"fecha-"+i}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.accent, padding: "10px 4px 6px", letterSpacing: 1 }}>{fg.date.toUpperCase()}</div>
              {fg.matches.map(renderMatchCard)}
            </div>
          ))
        )}
        {stage !== "Grupos" && matchesByStage.map(renderMatchCard)}
      </div>
      <BottomNav />
      {flash && <FlashMsg msg={flash} />}
    </div>
  )}

  // ════════════════════════════════════════════════════════════════════════════
  // TABLE
  // ════════════════════════════════════════════════════════════════════════════
  if (tab === "table") return (
    <div style={appStyle}>
      <Header title="🏅 Tabla de Posiciones" right={<button style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 18 }} onClick={loadData}>🔄</button>} />
      <div style={{ padding: "12px 14px" }}>
        {board.length === 0
          ? <div style={crd({ textAlign: "center", color: C.textDim, padding: 40 })}>Todavía no hay jugadores</div>
          : board.map((p, i) => (
            <div key={p.id} style={crd({ display: "flex", alignItems: "center", gap: 12, background: p.id === user.id ? "#131c2e" : C.card, border: `1px solid ${i === 0 ? "#5a7a0a" : p.id === user.id ? C.accent : C.border}`, padding: "12px 16px" })}>
              <div style={{ fontSize: i < 3 ? 26 : 16, minWidth: 32, textAlign: "center", color: C.muted, fontWeight: 700 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}</div>
              <Avatar av={p.avatar} size={38} name={p.name} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name} {p.id === user.id && <span style={{ fontSize: 11, color: C.accent }}>(vos)</span>}</div>
                <div style={{ fontSize: 12, color: C.textDim }}>{p.played} jugados · {p.perfect} plenos 🔥</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: i === 0 ? C.accent : C.text }}>{p.total}</div>
                <div style={{ fontSize: 11, color: C.muted }}>pts</div>
              </div>
            </div>
          ))
        }
      </div>
      <BottomNav />
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // CHAT
  // ════════════════════════════════════════════════════════════════════════════
  if (tab === "chat") return (
    <div style={{ ...appStyle, display: "flex", flexDirection: "column" }}>
      <Header title="💬 Chat del Prode" />
      <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", padding: "12px 14px", paddingBottom: 80 }}>
        {messages.length === 0 && <div style={{ textAlign: "center", color: C.textDim, marginTop: 40, fontSize: 14 }}>¡Nadie habló todavía! Sé el primero 🎉</div>}
        {messages.map((msg, i) => {
          const isMe = msg.player_id === user.id
          const showName = i === 0 || messages[i - 1].player_id !== msg.player_id
          return (
            <div key={msg.id} style={{ marginBottom: 6, display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
              {!isMe && (showName ? <Avatar av={msg.avatar} size={30} name={msg.player_name} /> : <div style={{ width: 30 }} />)}
              <div style={{ maxWidth: "75%" }}>
                {showName && !isMe && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 2, marginLeft: 2 }}>{msg.player_name}</div>}
                <div style={{ background: isMe ? C.accentDim : "#1a2035", color: isMe ? "#fff" : C.text, borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "8px 13px", fontSize: 14, lineHeight: 1.4, border: `1px solid ${isMe ? C.accent : C.border}` }}>
                  {msg.message}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2, textAlign: isMe ? "right" : "left" }}>
                  {new Date(msg.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={chatEndRef} />
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 860, background: "#0d1525", borderTop: `1px solid ${C.border}`, padding: "10px 14px", display: "flex", gap: 8, zIndex: 260 }}>
        <input style={inp({ flex: 1, padding: "10px 14px", fontSize: 14 })} placeholder="Escribí algo..." value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} />
        <button onClick={sendChat} style={btn("primary", { padding: "10px 18px", width: "auto" })}>➤</button>
      </div>
      <BottomNav />
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ════════════════════════════════════════════════════════════════════════════
  if (tab === "settings") return (
    <div style={appStyle}>
      <Header title="⚙️ Configuración" />
      <div style={{ padding: "12px 14px" }}>
        <div style={crd()}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
            <Avatar av={settAvatar} size={56} name={settName} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div>
              <div style={{ fontSize: 12, color: C.textDim }}>Default: {user.default_score}</div>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}>Tu nombre</div>
            <input style={inp()} value={settName} onChange={e => setSettName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 8 }}>Avatar</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AVATARS.map(av => (
                <button key={av} onClick={() => setSettAvatar(av)} style={{ fontSize: 22, width: 44, height: 44, borderRadius: 10, cursor: "pointer", background: settAvatar === av ? C.accentDim : "#1a2035", border: `2px solid ${settAvatar === av ? C.accent : C.border}` }}>{av}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 4 }}>Resultado por defecto</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Si no cargás un pronóstico, este resultado se usa automáticamente para el cálculo de puntos.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: C.textDim, minWidth: 44 }}>Local</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2}
                style={{ width: 48, height: 48, background: "#1a2035", border: `2px solid ${C.accent}`, borderRadius: 8, color: C.accent, fontSize: 22, fontWeight: 800, textAlign: "center", outline: "none" }}
                value={settDefault.split("-")[0] ?? "0"}
                onChange={e => { const v = e.target.value.replace(/[^0-9]/g,""); setSettDefault(v + "-" + (settDefault.split("-")[1] ?? "0")) }}
              />
              <span style={{ fontSize: 22, color: C.muted, fontWeight: 900 }}>:</span>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2}
                style={{ width: 48, height: 48, background: "#1a2035", border: `2px solid ${C.accent}`, borderRadius: 8, color: C.accent, fontSize: 22, fontWeight: 800, textAlign: "center", outline: "none" }}
                value={settDefault.split("-")[1] ?? "0"}
                onChange={e => { const v = e.target.value.replace(/[^0-9]/g,""); setSettDefault((settDefault.split("-")[0] ?? "0") + "-" + v) }}
              />
              <span style={{ fontSize: 13, color: C.textDim, minWidth: 56 }}>Visitante</span>
            </div>
          </div>

          {/* Change password */}
          <div style={{ marginBottom: 18, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 8 }}>Cambiar contraseña <span style={{ color: C.muted }}>(opcional)</span></div>
            <input type="password" style={inp({ marginBottom: 8 })} placeholder="Contraseña actual" value={settOldPass} onChange={e => { setSettOldPass(e.target.value); setSettPassError("") }} />
            <input type="password" style={inp()} placeholder="Nueva contraseña" value={settNewPass} onChange={e => { setSettNewPass(e.target.value); setSettPassError("") }} />
            {settPassError && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{settPassError}</div>}
          </div>

          <button style={btn("primary", { width: "100%", marginBottom: 10 })} onClick={saveSettings} disabled={saving}>{saving ? "Guardando..." : "Guardar cambios"}</button>
          <button style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={() => setShowLogoutConfirm(true)}>🚪 Cerrar sesión</button>
        </div>

        {/* Admin */}
        <div style={crd()}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>🔧 Panel admin</div>
          {!adminMode ? (
            <>
              <input type="password" style={inp({ marginBottom: 10 })} placeholder="Contraseña admin" value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (adminPass === ADMIN_PASSWORD ? setAdminMode(true) : showFlash("❌ Contraseña incorrecta"))} />
              <button style={btn("secondary", { width: "100%" })} onClick={() => adminPass === ADMIN_PASSWORD ? setAdminMode(true) : showFlash("❌ Contraseña incorrecta")}>Entrar como admin</button>

            </>
          ) : (
            <AdminPanel results={results} editResults={editResults} setEditResults={setEditResults} saveResults={saveResults} saving={saving} stage={stage} setStage={setStage} showFlash={showFlash} regClosesAt={regClosesAt} setRegClosesAt={setRegClosesAt} registrationOpen={registrationOpen} setRegistrationOpen={setRegistrationOpen} autoSyncStatus={autoSyncStatus} />
          )}
        </div>
      </div>
      <BottomNav />
      {flash && <FlashMsg msg={flash} />}
      {showLogoutConfirm && <LogoutConfirm onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} />}
    </div>
  )

  return null
}

function LogoutConfirm({ onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#111827", border: "1px solid #1e2940", borderRadius: 16, padding: 28, maxWidth: 320, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚪</div>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>¿Cerrar sesión?</div>
        <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Vas a tener que volver a ingresar con tu contraseña.</div>
        <button onClick={onConfirm} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", marginBottom: 10 }}>Sí, salir</button>
        <button onClick={onCancel} style={{ background: "transparent", color: "#94a3b8", border: "1px solid #1e2940", borderRadius: 10, padding: "12px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}>Cancelar</button>
      </div>
    </div>
  )
}

function AdminPanel({ results, editResults, setEditResults, saveResults, saving, stage, setStage, showFlash, regClosesAt, setRegClosesAt, registrationOpen, setRegistrationOpen, autoSyncStatus }) {
  const matchesByStage = MATCHES.filter(m => m.stage === stage)
  const getResult = (id) => results.find(r => r.match_id === id)
  const syncLive = async () => {
    try {
      const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches?status=IN_PLAY,FINISHED&season=2026", { headers: { "X-Auth-Token": "demo" } })
      if (!res.ok) throw new Error()
      const data = await res.json()
      showFlash(data.matches?.length > 0 ? `✓ ${data.matches.length} partidos` : "Sin datos aún (empieza 11 Jun)")
    } catch { showFlash("⚠️ API no disponible") }
  }
  return (
    <div>
      <div style={{ marginBottom: 14, padding: 12, background: "#0f1624", borderRadius: 10, border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, color: C.textDim, marginBottom: 8, fontWeight: 700 }}>🔒 Cierre de inscripciones</div>
        <input type="datetime-local" style={{ width: "100%", background: "#1a2035", border: `2px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, color: C.text, outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          defaultValue={regClosesAt}
          onChange={async (e) => {
            const val = e.target.value
            await supabase.from("config").upsert({ key: "registration_closes_at", value: val }, { onConflict: "key" })
            setRegClosesAt(val)
            setRegistrationOpen(new Date() < new Date(val))
          }}
        />
        <div style={{ fontSize: 11, color: registrationOpen ? C.green : C.red }}>
          {registrationOpen ? "✓ Inscripciones abiertas" : "✗ Inscripciones cerradas"}
        </div>
      </div>
      <div style={{ marginBottom: 10, padding: "8px 12px", background: "#0f1624", borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: autoSyncStatus === "searching" ? C.accent : autoSyncStatus === "found" ? C.green : autoSyncStatus === "error" ? C.red : autoSyncStatus === "nothing" ? C.muted : "#333", flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: C.textDim }}>
          Auto-sync: {autoSyncStatus === "searching" ? "🔍 buscando resultados..." : autoSyncStatus === "found" ? "✓ resultados actualizados" : autoSyncStatus === "error" ? "⚠️ error al conectar" : autoSyncStatus === "nothing" ? "sin cambios" : "en espera (sin partidos activos)"}
        </div>
      </div>
      <button onClick={syncLive} style={{ background: "#1a2035", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", color: C.textDim, fontSize: 13, cursor: "pointer", marginBottom: 14, width: "100%" }}>⚡ Sync manual</button>
      <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 12 }}>
        {STAGES.map(st => (
          <button key={st} onClick={() => setStage(st)} style={{ background: stage === st ? C.accent : "transparent", color: stage === st ? "#0a0e1a" : C.textDim, border: `1px solid ${stage === st ? C.accent : C.border}`, borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{st}</button>
        ))}
      </div>
      {matchesByStage.map(match => {
        const saved = getResult(match.id) || {}
        const edited = editResults[match.id] || {}
        const cur = { ...saved, ...edited }
        return (
          <div key={match.id} style={{ background: "#0f1624", border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{formatDate(match.date)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, textAlign: "right", fontSize: 12, fontWeight: 700 }}>{FLAGS[match.home] || "🏳️"} {match.home}</div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} style={{ width: 40, height: 40, background: "#1a2035", border: `2px solid ${C.accent}`, borderRadius: 7, color: C.accent, fontSize: 18, fontWeight: 800, textAlign: "center", outline: "none" }} value={cur.home_score ?? ""} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], home_score: v } })) }} />
                <span style={{ color: C.muted, fontWeight: 900 }}>:</span>
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} style={{ width: 40, height: 40, background: "#1a2035", border: `2px solid ${C.accent}`, borderRadius: 7, color: C.accent, fontSize: 18, fontWeight: 800, textAlign: "center", outline: "none" }} value={cur.away_score ?? ""} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], away_score: v } })) }} />
              </div>
              <div style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 700 }}>{FLAGS[match.away] || "🏳️"} {match.away}</div>
            </div>
          </div>
        )
      })}
      {Object.keys(editResults).length > 0 && (
        <button style={{ background: C.accent, color: "#0a0e1a", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }} onClick={saveResults} disabled={saving}>{saving ? "Guardando..." : "💾 Guardar resultados"}</button>
      )}
    </div>
  )
}
