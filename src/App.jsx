import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "./supabase"
import { MATCHES, FLAGS, AVATARS, STAGES, calcPoints, formatDate, formatTime, isLocked, isSameDay } from "./data"

const ADMIN_PASSWORD = "mundial2026"

let _lastSyncTime = ""

function scrollToElement(id, offset = 200) {
  setTimeout(() => {
    const el = document.getElementById(id)
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top, behavior: "smooth" })
  }, 50)
}

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

const PNG_AVATARS = [
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/chacha_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/fede_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/gon_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/gonzi_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/joaco_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/lb_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/martin_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/negro_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/pato_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/pele_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/pini_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/rami_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/yayu_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/flaca_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/munra_00.png?width=64&height=64&resize=cover",
  "https://egtvnxoheujqcmzjfwys.supabase.co/storage/v1/render/image/public/avatars/juancho_00.png?width=64&height=64&resize=cover",
]

function Avatar({ av = "⚽", size = 36, name = "" }) {
  const isUrl = av && (av.startsWith("http") || av.startsWith("/"))
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#1e2a45,#2a3a60)", border: `2px solid ${C.accentDim}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0, overflow: "hidden" }}>
      {isUrl
        ? <img src={av} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : (av || (name ? name[0].toUpperCase() : "⚽"))
      }
    </div>
  )
}

function ScoreInput({ value, onChange }) {
  return <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} style={{ width: 44, height: 44, background: "#1a2035", border: `2px solid ${C.accent}`, borderRadius: 8, color: C.accent, fontSize: 20, fontWeight: 800, textAlign: "center", outline: "none" }} value={value ?? ""} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ""); if (v === "" || (parseInt(v) >= 0 && parseInt(v) <= 20)) onChange(v) }} />
}

function ScoreBox({ value, matchState = "upcoming" }) {
  // matchState: "upcoming" = editable (not shown as box), "inplay" = green border gray text, "finished" = gray border gray text
  const border = matchState === "inplay" ? C.green : "#2a2a2a"
  const bg = matchState === "inplay" ? "#0f2a1a" : "#1a1a1a"
  const textColor = C.muted
  return <div style={{ width: 44, height: 44, background: bg, border: `2px solid ${border}`, borderRadius: 8, color: textColor, fontSize: 20, fontWeight: 800, textAlign: "center", lineHeight: "40px", minWidth: 44 }}>{value ?? "—"}</div>
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

function LandingInfoPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: "linear-gradient(135deg,#0f1624,#0a1020)",
        border: "1px solid #1e2940", borderRadius: open ? "16px 16px 0 0" : 16,
        padding: "16px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between", cursor: "pointer"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ color: "#c8a84b", fontWeight: 800, fontSize: 14, letterSpacing: 0.5 }}>REGLAMENTO Y PREMIOS</span>
        </div>
        <span style={{ color: "#6b7280", fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          background: "linear-gradient(135deg,#0f1624,#0a1020)",
          border: "1px solid #1e2940", borderTop: "none",
          borderRadius: "0 0 16px 16px", padding: "0 20px 20px"
        }}>
          <InfoContent />
        </div>
      )}
    </div>
  )
}

function InfoContent() {
  const C2 = { accent: "#c8a84b", accentDim: "#8a6e28", text: "#e2e8f0", textDim: "#94a3b8", border: "#1e2940", green: "#4ade80" }
  return (
    <div>
      {/* Pronósticos */}
      <div style={{ paddingBottom: 16, paddingTop: 8 }}>
        <div style={{ fontSize: 11, color: C2.accentDim, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>⏱ Pronósticos</div>
        <div style={{ fontSize: 13, color: C2.textDim, lineHeight: 1.7 }}>
          Tenés hasta el comienzo de cada partido para cargar tus pronósticos, amigo del campin. Si te olvidás, se usa tu <strong style={{ color: C2.text }}>resultado por defecto</strong>.
        </div>
      </div>
      {/* Puntos */}
      <div style={{ borderTop: `1px solid ${C2.border}`, paddingTop: 16, paddingBottom: 16 }}>
        <div style={{ fontSize: 11, color: C2.accentDim, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>📊 Puntos por partido</div>
        <div style={{ background: "#0a0e1a", borderRadius: 10, overflow: "hidden", border: `1px solid ${C2.border}` }}>
          {[["+3","pts","Acertás ganador o empate"],["+1","pt","Acertás goles del local"],["+1","pt","Acertás goles del visitante"]].map(([n,unit,desc],i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${C2.border}` }}>
              <div style={{ width: 52, display: "flex", alignItems: "baseline", gap: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: C2.accent }}>{n}</span>
                <span style={{ fontSize: 11, color: C2.accentDim, fontWeight: 600 }}>{unit}</span>
              </div>
              <span style={{ fontSize: 13, color: C2.textDim }}>{desc}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", background: "#14532d22" }}>
            <div style={{ width: 52, display: "flex", alignItems: "baseline", gap: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: C2.green }}>5</span>
              <span style={{ fontSize: 11, color: C2.green + "aa", fontWeight: 600 }}>pts</span>
            </div>
            <span style={{ fontSize: 13, color: C2.textDim }}>Máximo por partido 😱</span>
          </div>
        </div>
      </div>
      {/* Premios */}
      <div style={{ borderTop: `1px solid ${C2.border}`, paddingTop: 16, paddingBottom: 16 }}>
        <div style={{ fontSize: 11, color: C2.accentDim, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>🏆 Premios</div>
        {[["🥇","1° puesto","70% del pozo"],["🥈","2° puesto","20% del pozo"],["🥉","3° puesto","10% del pozo"],["🍊","Penúltimo","Intereses de Naranja X"]].map(([icon,pos,prize],i,arr) => (
          <div key={pos} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < arr.length-1 ? `1px solid ${C2.border}` : "none" }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 13, color: C2.text, flex: 1 }}>{pos}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C2.accent }}>{prize}</span>
          </div>
        ))}
      </div>
      {/* Inscripción */}
      <div style={{ borderTop: `1px solid ${C2.border}`, paddingTop: 16 }}>
        <div style={{ fontSize: 11, color: C2.accentDim, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>💸 Inscripción</div>
        <div style={{ fontSize: 13, color: C2.textDim, lineHeight: 1.7 }}>
          Cierre de inscripciones: <strong style={{ color: C2.text }}>jueves 11 de junio, 16:00</strong>.<br/>
          Costo: <strong style={{ color: C2.text }}>$25.000</strong>. Transferir a <strong style={{ color: C2.accent }}>topati.lopez</strong> y mandar el comprobante por privado al wasap.<br/>También podés jugar gratis. Anotate nomás.
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState("home")
  const [user, setUser] = useState(null)
  const [authScreen, setAuthScreen] = useState("choose") // choose | register | login
  const [players, setPlayers] = useState([])
  const [predictions, setPredictions] = useState([])
  const [results, setResults] = useState([])
  const [knockoutMatches, setKnockoutMatches] = useState([])
  const [knockoutOverrides, setKnockoutOverrides] = useState([])
  const [stage, setStage] = useState("Grupos")
  const [selectedGroup, setSelectedGroup] = useState("A")
  const [prevGroup, setPrevGroup] = useState(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [transitionDir, setTransitionDir] = useState(0) // -1 = going left, 1 = going right
  const groupContentRef = useRef(null)
  const [scrollToMatchId, setScrollToMatchId] = useState(null) // "fecha" | "grupo"
  const [gruposSubFilter, setGruposSubFilter] = useState(null) // group letter or date string
  const [editPreds, setEditPreds] = useState({})
  const [editResults, setEditResults] = useState({})
  const [adminMode, setAdminMode] = useState(false)
  const [autoSyncStatus, setAutoSyncStatus] = useState("idle")
  const [lastSyncTime, setLastSyncTime] = useState("")
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [regClosesAt, setRegClosesAt] = useState("")
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [adminPass, setAdminPass] = useState("")
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState("")
  const [loading, setLoading] = useState(true)

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
    const [{ data: pl }, { data: pr }, { data: re }, { data: ms }, { data: km }] = await Promise.all([
      supabase.from("players").select("id,name,avatar,default_score,joined,password_reset"),
      supabase.from("predictions").select("*"),
      supabase.from("results").select("*"),
      Promise.resolve({ data: [] }),
      supabase.from("knockout_matches").select("*").order("id"),
    ])
    if (pl) setPlayers(pl)
    if (km) setKnockoutMatches(km)
    supabase.from("knockout_overrides").select("*").then(({ data: ko }) => { if (ko) setKnockoutOverrides(ko) })
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
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadData])

  const doSyncDate = async (dateStr) => {
    const TOKEN = import.meta.env.VITE_FOOTBALLDATA_TOKEN || ""
    if (!TOKEN) return "no token"
    const fuzzyMatch = (a, b) => {
      const na = a.toLowerCase(), nb = b.toLowerCase()
      return na.includes(nb.slice(0,5)) || nb.includes(na.slice(0,5))
    }
    const parseStatus = (status) => {
      if (status === "FINISHED") return "FINISHED"
      if (["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(status)) return "IN_PLAY"
      return "SCHEDULED"
    }
    const parseScore = (match) => {
      const s = match.score
      if (!s) return { hs: null, as_: null }
      // Use regularTime if available (90min result), else fullTime, else halfTime
      const hs = s.regularTime?.home ?? s.fullTime?.home ?? s.halfTime?.home ?? null
      const as_ = s.regularTime?.away ?? s.fullTime?.away ?? s.halfTime?.away ?? null
      return { hs, as_ }
    }
    try {
      // Use competition filter for test matches (CL = Champions League)
      const prueba = MATCHES.filter(m => m.stage === "Prueba")
      const res = await fetch(`/api/sync?date=${dateStr}&competitions=CL`)
      if (!res.ok) return `HTTP ${res.status}: ${await res.text()}`
      const data = await res.json()
      const fixtures = data.matches || []
      const upserts = []
      prueba.forEach(local => {
        const homeSearch = local.homeApi || local.home
        const awaySearch = local.awayApi || local.away
        const match = fixtures.find(f =>
          fuzzyMatch(f.homeTeam?.name || f.homeTeam?.shortName || "", homeSearch) &&
          fuzzyMatch(f.awayTeam?.name || f.awayTeam?.shortName || "", awaySearch)
        )
        if (!match) return
        const apiStatus = parseStatus(match.status)
        if (apiStatus === "SCHEDULED") return
        const { hs, as_ } = parseScore(match)
        if (hs === null) return
        const ph = match.score?.penalties?.home ?? null
        const pa = match.score?.penalties?.away ?? null
        upserts.push({ match_id: local.id, home_score: hs, away_score: as_, penalty_home: ph, penalty_away: pa, status: apiStatus, match_time: null, updated_at: new Date().toISOString() })
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
          resultsRef.current = next
          return next
        })
        return `✓ ${upserts.length} partido(s) actualizado(s) — ${upserts.map(u => `${u.home_score}-${u.away_score}`).join(", ")}`
      }
      return `Sin match — ${fixtures.length} fixtures encontrados en CL ese día`
    } catch(e) { return `Error: ${e.message}` }
  }

  const doSync = useCallback(async () => {
    const TOKEN = import.meta.env.VITE_FOOTBALLDATA_TOKEN || ""
    if (!TOKEN) return

    const allLocalMatches = [...MATCHES, ...knockoutMatches.map(m => ({ ...m, group: "" }))]
    const byFdId = {}
    allLocalMatches.forEach(m => {
      const fdId = m.fdId || knockoutMatches.find(km => km.id === m.id)?.fd_id
      if (fdId) byFdId[fdId] = m
    })

    setAutoSyncStatus("searching")
    try {
      // Fetch all 104 WC matches in one request
      const res = await fetch(`/api/sync`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const allFdMatches = (await res.json()).matches || []

      const upserts = []
      allFdMatches.forEach(fdMatch => {
        const local = byFdId[fdMatch.id]
        if (!local) return
        const status = fdMatch.status
        const apiStatus = status === "FINISHED" ? "FINISHED"
          : ["IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT"].includes(status) ? "IN_PLAY"
          : "SCHEDULED"
        if (apiStatus === "SCHEDULED") return
        const hs = fdMatch.score?.regularTime?.home ?? fdMatch.score?.fullTime?.home ?? null
        const as_ = fdMatch.score?.regularTime?.away ?? fdMatch.score?.fullTime?.away ?? null
        if (hs === null) return
        const ph = fdMatch.score?.penalties?.home ?? null
        const pa = fdMatch.score?.penalties?.away ?? null
        const matchTime = status === "PAUSED" ? "ET" : (fdMatch.minute ? String(fdMatch.minute) : null)
        upserts.push({ match_id: local.id, home_score: hs, away_score: as_, penalty_home: ph, penalty_away: pa, status: apiStatus, match_time: matchTime, updated_at: new Date().toISOString() })
      })

      // Classify what we found
      const allStatuses = allFdMatches.map(m => m.status)
      const allTimed = allFdMatches.length > 0 && allFdMatches.every(m => ["TIMED","SCHEDULED"].includes(m.status))
      const inPlayCount = upserts.filter(u => u.status === "IN_PLAY").length
      const time = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })

      if (upserts.length > 0) {
        await supabase.from("results").upsert(upserts, { onConflict: "match_id" })
        setResults(prev => {
          const next = [...prev]
          upserts.forEach(u => {
            const idx = next.findIndex(r => r.match_id === u.match_id)
            if (idx >= 0) next[idx] = { ...next[idx], ...u }
            else next.push(u)
          })
          resultsRef.current = next
          return next
        })
      }

      let msg
      if (allFdMatches.length === 0) {
        msg = "no se encontraron partidos"
      } else if (allTimed) {
        msg = "el mundial aún no comenzó"
      } else if (inPlayCount > 0) {
        msg = `${inPlayCount} partido(s) en juego`
      } else {
        msg = "sin partidos en juego"
      }
      setAutoSyncStatus(msg + " · " + time)
      return msg
    } catch(e) {
      const t = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      setAutoSyncStatus("error · " + t)
      return "error al conectar"
    }
  }, [knockoutMatches])

  // Auto-sync on load and every 10 min
  useEffect(() => {
    const TOKEN = import.meta.env.VITE_FOOTBALLDATA_TOKEN || ""
    if (!TOKEN) return
    doSync()
    const interval = setInterval(doSync, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [doSync])

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
    const me = { id: player.id, name: player.name, avatar: player.avatar, default_score: player.default_score }
    // Check if password reset is pending
    if (player.password_reset) {
      setAuthScreen("set_new_password")
      window._pendingUser = me
      window._pendingPlayerId = player.id
      return
    }
    const hashed = await hashPassword(loginPassword)
    if (player.password && player.password !== hashed) { setLoginError("Contraseña incorrecta"); return }
    // allow login if no password set yet (legacy players)
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
    try {
      setSaving(true)
      const upserts = Object.entries(editResults).map(([match_id, sc]) => ({
        match_id: parseInt(match_id),
        home_score: sc.home_score === "" ? null : parseInt(sc.home_score),
        away_score: sc.away_score === "" ? null : parseInt(sc.away_score),
        penalty_home: sc.penalty_home === "" || sc.penalty_home == null ? null : parseInt(sc.penalty_home),
        penalty_away: sc.penalty_away === "" || sc.penalty_away == null ? null : parseInt(sc.penalty_away),
        updated_at: new Date().toISOString(),
      }))
      await supabase.from("results").upsert(upserts, { onConflict: "match_id" })
      setEditResults({})
      showFlash("✓ Resultados guardados")
      loadData()
    } catch(e) {
      showFlash("⚠️ Error: " + e.message)
    } finally {
      setSaving(false)
    }
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



  // ── LEADERBOARD ────────────────────────────────────────────────────────────
  // Resolve placeholder team names to real team names based on results
  const resolveTeam = (placeholder) => {
    if (!placeholder) return placeholder
    
    // 1st/2nd of group: "1°A", "2°B" etc
    const groupMatch = placeholder.match(/^([12])°([A-L])$/)
    if (groupMatch) {
      const pos = parseInt(groupMatch[1]) - 1
      const letter = groupMatch[2]
      const gMatches = MATCHES.filter(m => m.group === letter && m.stage === "Grupos")
      const teams = {}
      gMatches.forEach(m => {
        if (!teams[m.home]) teams[m.home] = { name: m.home, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }
        if (!teams[m.away]) teams[m.away] = { name: m.away, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }
        const r = results.find(r => r.match_id === m.id)
        if (!r || r.home_score === null) return
        const hs = parseInt(r.home_score), as_ = parseInt(r.away_score)
        teams[m.home].pj++; teams[m.away].pj++
        teams[m.home].gf += hs; teams[m.home].gc += as_
        teams[m.away].gf += as_; teams[m.away].gc += hs
        if (hs > as_) { teams[m.home].g++; teams[m.home].pts += 3; teams[m.away].p++ }
        else if (hs < as_) { teams[m.away].g++; teams[m.away].pts += 3; teams[m.home].p++ }
        else { teams[m.home].e++; teams[m.home].pts++; teams[m.away].e++; teams[m.away].pts++ }
      })
      // Only resolve if ALL matches in this group have results
      const groupComplete = gMatches.every(m => {
        const r = results.find(r => r.match_id === m.id)
        return r && r.home_score !== null
      })
      if (!groupComplete) return placeholder
      // Sort with head-to-head tiebreaker
      const calcH2H = (tl) => {
        const h = {}
        tl.forEach(t => { h[t.name] = { pts:0, gd:0, gf:0 } })
        gMatches.forEach(m => {
          if (!tl.find(t=>t.name===m.home) || !tl.find(t=>t.name===m.away)) return
          const r = results.find(r=>r.match_id===m.id)
          if (!r||r.home_score===null) return
          const hs=parseInt(r.home_score),as_=parseInt(r.away_score)
          h[m.home].gf+=hs; h[m.home].gd+=hs-as_
          h[m.away].gf+=as_; h[m.away].gd+=as_-hs
          if(hs>as_) h[m.home].pts+=3
          else if(hs<as_) h[m.away].pts+=3
          else { h[m.home].pts+=1; h[m.away].pts+=1 }
        })
        return h
      }
      const allTeams = Object.values(teams)
      const sorted = [...allTeams].sort((a,b) => {
        if(b.pts!==a.pts) return b.pts-a.pts
        const tied = allTeams.filter(t=>t.pts===a.pts)
        if(tied.length>1){
          const h=calcH2H(tied)
          if(h[b.name].pts!==h[a.name].pts) return h[b.name].pts-h[a.name].pts
          if(h[b.name].gd!==h[a.name].gd) return h[b.name].gd-h[a.name].gd
          if(h[b.name].gf!==h[a.name].gf) return h[b.name].gf-h[a.name].gf
        }
        if((b.gf-b.gc)!==(a.gf-a.gc)) return (b.gf-b.gc)-(a.gf-a.gc)
        return b.gf-a.gf
      })
      if (sorted[pos]) return sorted[pos].name
      return placeholder
    }

    // Winner of match: "G.P73", "G.P89" etc
    const wpMatch = placeholder.match(/^G\.P(\d+)$/)
    if (wpMatch) {
      const matchId = parseInt(wpMatch[1])
      const r = results.find(r => r.match_id === matchId)
      if (!r || r.home_score === null) return placeholder
      // Use knockoutMatches (raw) to avoid circular reference with allMatches
      const km = knockoutMatches.find(m => m.id === matchId)
      if (!km) return placeholder
      const homeRes = resolveTeam(km.home)
      const awayRes = resolveTeam(km.away)
      if (parseInt(r.home_score) > parseInt(r.away_score)) return homeRes
      if (parseInt(r.away_score) > parseInt(r.home_score)) return awayRes
      // Draw - check penalties
      if (r.penalty_home != null && r.penalty_away != null) {
        return parseInt(r.penalty_home) > parseInt(r.penalty_away) ? homeRes : awayRes
      }
      return placeholder // draw - shouldn't happen in knockout
    }

    // Loser of match: "Perdedor Semi X" -> not resolved dynamically (manual)
    // Already a real team name or 3° placeholder
    return placeholder
  }

  // Combine group matches with knockout matches from Supabase
  const allMatches = [
    ...MATCHES,
    ...knockoutMatches.map(m => ({
      ...m,
      group: "",
      home: resolveTeam(m.home) || m.home,
      away: resolveTeam(m.away) || m.away,
      // Keep originals for admin picker logic
      _homeRaw: m.home,
      _awayRaw: m.away,
    }))
  ]
  const allStages = ["Grupos", "16avos", "8vos", "4tos", "Semi", "3º y 4º", "Final"]

  const board = players.map(p => {
    let total = 0, played = 0, perfect = 0
    MATCHES.forEach(m => {
      const r = results.find(r => r.match_id === m.id)
      if (!r || r.home_score === null) return
      // Only count finished matches (2hs since kickoff)
      const matchStart = new Date(m.date)
      const finished = new Date() >= new Date(matchStart.getTime() + 2 * 60 * 60 * 1000)
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
  const matchesByStage = allMatches.filter(m => m.stage === stage)
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
      {[{ id: "home", icon: "🏠", label: "Inicio" }, { id: "fixture", icon: "📅", label: "Fixture" }, { id: "table", icon: "🏅", label: "Tabla" }, { id: "settings", icon: "⚙️", label: "Config" }].map(({ id, icon, label }) => (
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
      <div style={{ background: "linear-gradient(160deg,#060d1f 0%,#0f1e3d 50%,#1a1200 100%)", borderBottom: `1px solid ${C.border}`, padding: "40px 20px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 56 }}>🏆</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.accent, marginTop: 12, letterSpacing: 1, textTransform: "uppercase" }}>Prode Amigos del Campin</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 6 }}>Mundial 2026</div>
        <div style={{ color: C.textDim, fontSize: 13, marginTop: 4 }}>🇺🇸 USA · 🇲🇽 México · 🇨🇦 Canadá · 11 jun – 19 jul</div>
      </div>
    )

    // CHOOSE: register or login
    if (authScreen === "set_new_password") return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto", boxSizing: "border-box" }}>
        <AuthHeader />
        <div style={{ padding: 20 }}>
          <div style={crd({ padding: 20 })}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.accent, marginBottom: 8 }}>🔑 Elegí una nueva contraseña</div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16 }}>Tu contraseña fue reseteada. Por favor elegí una nueva para continuar.</div>
            <SetNewPasswordForm onSave={async (newPass) => {
              const hash = await hashPassword(newPass)
              await supabase.from("players").update({ password: hash, password_reset: false }).eq("id", window._pendingPlayerId)
              const me = window._pendingUser
              localStorage.setItem("prode_user", JSON.stringify(me))
              setUser(me)
              setSettName(me.name); setSettAvatar(me.avatar || "⚽"); setSettDefault(me.default_score || "0-0")
              setAuthScreen("choose")
              window._pendingUser = null
              window._pendingPlayerId = null
              loadData()
            }} />
          </div>
        </div>
      </div>
    )

    if (authScreen === "choose") return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto", boxSizing: "border-box" }}>
        <AuthHeader />
        <div style={{ padding: "20px 16px" }}>

          <LandingInfoPanel />

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
                <div key={p.id} onClick={() => { (async () => {
                    // Fetch fresh data to get latest password_reset status
                    const { data: fresh } = await supabase.from("players").select("*").eq("id", p.id).single()
                    const player = fresh || p
                    if (player.password_reset) {
                      const me = { id: player.id, name: player.name, avatar: player.avatar, default_score: player.default_score }
                      window._pendingUser = me
                      window._pendingPlayerId = player.id
                      setAuthScreen("set_new_password")
                    } else {
                      setQuickLoginPlayer(player); setLoginName(player.name); setLoginPassword(""); setLoginError(""); setAuthScreen("login")
                    }
                  })() }}
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
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto", boxSizing: "border-box" }}>
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
                {PNG_AVATARS.map(url => (
                  <button key={url} onClick={() => setRegAvatar(url)} style={{ width: 44, height: 44, borderRadius: 10, cursor: "pointer", padding: 2, background: regAvatar === url ? C.accentDim : "#1a2035", border: `2px solid ${regAvatar === url ? C.accent : C.border}`, overflow: "hidden" }}>
                    <img src={url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                  </button>
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
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", maxWidth: 860, margin: "0 auto", boxSizing: "border-box" }}>
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
          <button onClick={() => setShowInfo(true)} style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", fontSize: 22, padding: "4px 8px", lineHeight: 1 }}>ℹ️</button>
        </div>
        {showInfo && (
          <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 500, overflowY: "auto" }} onClick={() => setShowInfo(false)}>
            <div style={{ background: C.bg, margin: "20px 16px", borderRadius: 16, padding: 20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>PRODE Amigos del Campin</div>
                <button onClick={() => setShowInfo(false)} style={{ background: "none", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
              </div>
              <InfoContent />
            </div>
          </div>
        )}
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
              ? <div style={{ padding: "14px 14px 16px", fontSize: 14, color: C.textDim }}>Hoy no hay partidos, amigo del campin </div>
              : todayMatches.map((m, i) => {
                const locked = isLocked(m.date)
                const result = getResult(m.id)
                const pred = myPred(m.id, locked)
                const pts = result && result.home_score !== null ? calcPoints(pred, result) : null
                const hasPred = hasPrediction(m.id)
                const matchStart2 = new Date(m.date)
                const twoHrsPast = new Date() >= new Date(matchStart2.getTime() + 2 * 60 * 60 * 1000)
                const inPlay = locked && !twoHrsPast
                const inProgress = locked && result && result.home_score !== null
                const finished = inProgress // for now same signal; could add status field later
                const showDefault = locked && !hasPred
                const effectivePred = hasPred ? pred : (locked ? pred : null) // pred already returns default when locked
                return (
                  <div key={m.id} style={{ padding: "10px 14px", borderTop: i > 0 ? `1px solid ${C.border}` : "none", position: "relative" }}>
                    {inPlay && <div style={{ position: "absolute", top: 8, right: 14, background: "#0f2a1a", borderRadius: 4, padding: "3px 7px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.green, fontWeight: 800 }}>⚽ en juego</div>
                    </div>}
                    {locked && !inPlay && result && result.home_score !== null && <span style={{ position: "absolute", top: 8, right: 14, fontSize: 10, color: C.text, fontWeight: 700 }}>✓ finalizado</span>}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontSize: 22 }}>{flag(m.home)}</div>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{m.home}</div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: inPlay ? C.green : C.muted, marginBottom: 4 }}>{inPlay && result?.match_time ? `Última act. ${result.match_time === 'ET' ? 'ET' : result.match_time + "'"}` : formatTime(m.date)}</div>
                      {result && result.home_score !== null
                        ? <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: inPlay ? C.green : C.text }}>{result.home_score} – {result.away_score}</div>
                          {result.penalty_home != null && result.penalty_away != null && (
                            <div style={{ fontSize: 11, color: C.muted }}>({result.penalty_home} - {result.penalty_away}) pen</div>
                          )}
                        </div>
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
                            <div style={{ fontSize: 11, color: pts > 0 ? "#60a5fa" : C.muted, fontWeight: 700 }}>+{pts} pts</div>
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
      { date: "Fecha 1", matches: allMatches.filter(m => m.stage === "Grupos" && m.id >= 1  && m.id <= 24) },
      { date: "Fecha 2", matches: allMatches.filter(m => m.stage === "Grupos" && m.id >= 25 && m.id <= 48) },
      { date: "Fecha 3", matches: allMatches.filter(m => m.stage === "Grupos" && m.id >= 49 && m.id <= 72) },
    ]

    const renderMatchCard = (match) => {
      const locked = isLocked(match.date)
      const result = getResult(match.id)
      const pred = myPred(match.id, locked)
      const pts = result && result.home_score !== null ? calcPoints(pred, result) : null
      const dbResult = getResult(match.id)
      const matchStart = new Date(match.date)
      const twoHoursPast = new Date() >= new Date(matchStart.getTime() + 2 * 60 * 60 * 1000)
      const matchState = !locked ? "upcoming" : twoHoursPast ? "finished" : "inplay"
      return (
        <div key={match.id} id={"match-" + match.id} style={crd({ border: `1px solid ${matchState === "inplay" ? "#1a3a1a" : result ? "#1e2a2e" : C.border}`, padding: 12 })}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: C.muted }}>
              {match.id >= 73 && <span style={{ color: C.accent, fontWeight: 700, marginRight: 6 }}>P{match.id}</span>}
              {formatDate(match.date)}{match.venue ? ` · ${match.venue}` : ""}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {match.stage === "Grupos" && (
                <span style={{ fontSize: 11, color: C.accentDim, fontWeight: 700 }}>
                  F{match.id <= 24 ? 1 : match.id <= 48 ? 2 : 3}
                </span>
              )}
              {pts !== null && matchState === "finished" && <span style={{ background: pts > 0 ? "#1e3a5f" : "#1e2940", color: pts > 0 ? "#60a5fa" : C.muted, borderRadius: 6, padding: "2px 7px", fontSize: 11, fontWeight: 700 }}>+{pts}pts</span>}
              {matchState === "inplay" && <div style={{ background: "#0f2a1a", borderRadius: 4, padding: "3px 7px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: C.green, fontWeight: 800 }}>⚽ en juego</div>
              </div>}
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
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: matchState === "inplay" ? C.green : C.text, fontWeight: 800 }}>
                    {matchState === "inplay" && <span style={{ marginRight: 3 }}>●</span>}{result.home_score} – {result.away_score}
                  </div>
                  {matchState === "inplay" && result.match_time && (
                    <div style={{ fontSize: 9, color: C.green }}>{`Última act. ${result.match_time === 'ET' ? 'ET' : result.match_time + "'"}`}</div>
                  )}
                  {result.penalty_home != null && result.penalty_away != null && (
                    <div style={{ fontSize: 10, color: C.muted }}>({result.penalty_home} - {result.penalty_away}) pen</div>
                  )}
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
      <div style={{ padding: "8px 14px", background: C.card2, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 56, zIndex: 90 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gridTemplateRows: "auto auto", gap: 5 }}>
          <button onClick={() => setStage("Grupos")}
            style={{ gridRow: "1 / 3", background: stage === "Grupos" ? C.accent : "transparent", color: stage === "Grupos" ? "#0a0e1a" : C.textDim, border: `1px solid ${stage === "Grupos" ? C.accent : C.border}`, borderRadius: 8, padding: "6px 4px", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
            Grupos
          </button>
          {allStages.filter(st => st !== "Grupos").map(st => (
            <button key={st} onClick={() => setStage(st)} style={{ background: stage === st ? C.accent : "transparent", color: stage === st ? "#0a0e1a" : C.textDim, border: `1px solid ${stage === st ? C.accent : C.border}`, borderRadius: 8, padding: "6px 4px", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>{st}</button>
          ))}
        </div>
      </div>

      {/* Group selector pills - always sticky */}
      {stage === "Grupos" && (
        <div style={{ padding: "8px 14px", background: C.card2, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 136, zIndex: 89 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
            {grupoLetters.map(g => (
              <button key={g} onClick={() => {
                if (g === selectedGroup) return
                const letters = ["A","B","C","D","E","F","G","H","I","J","K","L"]
                const dir = letters.indexOf(g) > letters.indexOf(selectedGroup) ? -1 : 1
                setPrevGroup(selectedGroup)
                setTransitionDir(dir)
                setTransitioning(true)
                setSwipeOffset(0)
                setSelectedGroup(g)
                setTimeout(() => { setTransitioning(false); setPrevGroup(null) }, 300)
              }}
                style={{ padding: "5px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: `1px solid ${selectedGroup === g ? C.accent : C.border}`, background: selectedGroup === g ? C.accent : "transparent", color: selectedGroup === g ? "#0a0e1a" : C.textDim, textAlign: "center" }}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      {todayUnbet.length > 0 && (
        <div style={{ background: "#1a1200", borderBottom: `1px solid ${C.accentDim}`, padding: "8px 16px", fontSize: 12, color: C.accent }}>
          ⚠️ Tenés {todayUnbet.length} partido(s) hoy sin pronóstico
        </div>
      )}

      <div style={{ padding: "12px 14px", paddingBottom: 20, overflow: "hidden" }}
        onTouchStart={e => {
          if (stage !== "Grupos") return
          window._swipeStartX = e.touches[0].clientX
          window._swipeStartY = e.touches[0].clientY
          window._swipeLocked = null
          setSwipeOffset(0)
          setTransitioning(false)
        }}
        onTouchMove={e => {
          if (window._swipeStartX === undefined || stage !== "Grupos") return
          const diffX = -(e.touches[0].clientX - window._swipeStartX)
          const diffY = Math.abs(e.touches[0].clientY - window._swipeStartY)
          // Determine scroll direction on first significant move
          if (window._swipeLocked === null && (Math.abs(diffX) > 5 || diffY > 5)) {
            window._swipeLocked = diffY > Math.abs(diffX) ? "vertical" : "horizontal"
          }
          if (window._swipeLocked === "vertical") return
          if (window._swipeLocked === "horizontal") e.preventDefault()
          const diff = diffX
          const letters = ["A","B","C","D","E","F","G","H","I","J","K","L"]
          const idx = letters.indexOf(selectedGroup)
          const atStart = idx === 0 && diff < 0
          const atEnd = idx === letters.length - 1 && diff > 0
          if (atStart || atEnd) {
            // Rubber band - resist at boundary
            setSwipeOffset(-diff * 0.2)
            setPrevGroup(null)
          } else {
            const nextGroup = diff > 0 ? letters[idx + 1] : letters[idx - 1]
            if (nextGroup !== prevGroup) { setPrevGroup(nextGroup); setTransitionDir(diff > 0 ? -1 : 1) }
            setSwipeOffset(-diff)
          }
        }}
        onTouchEnd={e => {
          if (window._swipeStartX === undefined) return
          const diff = -(e.changedTouches[0].clientX - window._swipeStartX)
          window._swipeStartX = undefined
          const letters = ["A","B","C","D","E","F","G","H","I","J","K","L"]
          const w = window.innerWidth || 400
          const idx = letters.indexOf(selectedGroup)
          const atStart = idx === 0 && diff < 0
          const atEnd = idx === letters.length - 1 && diff > 0

          if (!atStart && !atEnd && Math.abs(diff) >= 60) {
            setTransitioning(true)
            setSwipeOffset(diff > 0 ? -w : w)
            setTimeout(() => {
              setSelectedGroup(diff > 0 ? letters[idx + 1] : letters[idx - 1])
              setPrevGroup(null)
              setSwipeOffset(0)
              setTransitioning(false)
            }, 250)
          } else {
            setTransitioning(true)
            setSwipeOffset(0)
            setTimeout(() => { setTransitioning(false); setPrevGroup(null) }, 250)
          }
        }}
      >
        {stage === "Grupos" && (() => {
          const g = selectedGroup
          const gMatches = allMatches.filter(m => m.stage === "Grupos" && m.group === g)
          const teams = {}
          gMatches.forEach(m => {
            if (!teams[m.home]) teams[m.home] = { name: m.home, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }
            if (!teams[m.away]) teams[m.away] = { name: m.away, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }
            const r = results.find(r => r.match_id === m.id)
            if (!r || r.home_score === null) return
            const hs = parseInt(r.home_score), as_ = parseInt(r.away_score)
            teams[m.home].pj++; teams[m.away].pj++
            teams[m.home].gf += hs; teams[m.home].gc += as_
            teams[m.away].gf += as_; teams[m.away].gc += hs
            if (hs > as_) { teams[m.home].g++; teams[m.home].pts += 3; teams[m.away].p++ }
            else if (hs < as_) { teams[m.away].g++; teams[m.away].pts += 3; teams[m.home].p++ }
            else { teams[m.home].e++; teams[m.home].pts++; teams[m.away].e++; teams[m.away].pts++ }
          })
      // Sort with head-to-head tiebreaker (FIFA rules step 1)
      const calcHeadToHead = (teamList, allMatches) => {
        const h2h = {}
        teamList.forEach(t => { h2h[t.name] = { pts: 0, gd: 0, gf: 0 } })
        allMatches.forEach(m => {
          const inGroup = teamList.find(t => t.name === m.home) && teamList.find(t => t.name === m.away)
          if (!inGroup) return
          const r = results.find(r => r.match_id === m.id)
          if (!r || r.home_score === null) return
          const hs = parseInt(r.home_score), as_ = parseInt(r.away_score)
          h2h[m.home].gf += hs; h2h[m.home].gd += hs - as_
          h2h[m.away].gf += as_; h2h[m.away].gd += as_ - hs
          if (hs > as_) { h2h[m.home].pts += 3 }
          else if (hs < as_) { h2h[m.away].pts += 3 }
          else { h2h[m.home].pts += 1; h2h[m.away].pts += 1 }
        })
        return h2h
      }

      const sortTeams = (teamList) => {
        return [...teamList].sort((a, b) => {
          // First: overall points
          if (b.pts !== a.pts) return b.pts - a.pts
          // Find all teams tied with same points
          const tied = teamList.filter(t => t.pts === a.pts)
          if (tied.length > 1) {
            // Step 1: head-to-head among tied teams
            const h2h = calcHeadToHead(tied, gMatches)
            if (h2h[b.name].pts !== h2h[a.name].pts) return h2h[b.name].pts - h2h[a.name].pts
            if (h2h[b.name].gd !== h2h[a.name].gd) return h2h[b.name].gd - h2h[a.name].gd
            if (h2h[b.name].gf !== h2h[a.name].gf) return h2h[b.name].gf - h2h[a.name].gf
          }
          // Step 2: overall goal difference and goals
          if ((b.gf - b.gc) !== (a.gf - a.gc)) return (b.gf - b.gc) - (a.gf - a.gc)
          return b.gf - a.gf
        })
      }
      const standings = sortTeams(Object.values(teams))
          const renderGroupContent = (grp, style) => {
            const gM = allMatches.filter(m => m.stage === "Grupos" && m.group === grp)
            const t2 = {}
            gM.forEach(m => {
              if (!t2[m.home]) t2[m.home] = { name: m.home, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }
              if (!t2[m.away]) t2[m.away] = { name: m.away, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }
              const r2 = results.find(r => r.match_id === m.id)
              if (!r2 || r2.home_score === null) return
              const hs2 = parseInt(r2.home_score), as2 = parseInt(r2.away_score)
              t2[m.home].pj++; t2[m.away].pj++
              t2[m.home].gf += hs2; t2[m.home].gc += as2
              t2[m.away].gf += as2; t2[m.away].gc += hs2
              if (hs2 > as2) { t2[m.home].g++; t2[m.home].pts += 3; t2[m.away].p++ }
              else if (hs2 < as2) { t2[m.away].g++; t2[m.away].pts += 3; t2[m.home].p++ }
              else { t2[m.home].e++; t2[m.home].pts++; t2[m.away].e++; t2[m.away].pts++ }
            })
            const st2 = Object.values(t2).sort((a,b) => b.pts !== a.pts ? b.pts-a.pts : (b.gf-b.gc)-(a.gf-a.gc) || b.gf-a.gf)
            return (
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, ...style }}>
                <div style={crd({ padding: 0, overflow: "hidden", marginBottom: 16 })}>
                  <div style={{ padding: "10px 14px 8px", fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: 1 }}>GRUPO {grp}</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ textAlign: "left", padding: "4px 14px", color: C.muted, fontWeight: 600 }}>Equipo</th>
                      {["PJ","G","E","P","GF","DG","Pts"].map(h => <th key={h} style={{ textAlign: "center", padding: "4px 4px", color: h==="Pts"?C.accent:C.muted, fontWeight: h==="Pts"?700:600 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{st2.map((t, i) => (
                      <tr key={t.name} style={{ borderBottom: i < st2.length-1 ? `1px solid ${C.border}` : "none", background: i < 2 ? "#0f1a0f" : "transparent" }}>
                        <td style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: i < 2 ? C.green : C.muted, fontWeight: 700, minWidth: 14 }}>{i+1}</span>
                          <span style={{ fontSize: 15 }}>{flag(t.name)}</span>
                          <span style={{ color: C.text, fontWeight: i < 2 ? 700 : 400, fontSize: 12 }}>{t.name}</span>
                        </td>
                        {[t.pj, t.g, t.e, t.p, t.gf, t.gf-t.gc, t.pts].map((v,i2) => (
                          <td key={i2} style={{ textAlign: "center", color: i2===6?C.accent:C.textDim, fontWeight: i2===6?800:400, fontSize: i2===6?13:12, padding: i2===6?"8px 8px":"8px 4px" }}>{v}</td>
                        ))}
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {gM.map(renderMatchCard)}
              </div>
            )
          }

          const w = typeof window !== "undefined" ? window.innerWidth : 400
          const isLastGroup = g === "L"
          const isFirstGroup = g === "A"
          return (
            <div ref={groupContentRef} style={{ position: "relative", overflow: "hidden", minHeight: 200 }}>
              {/* Adjacent group (visible during swipe) */}
              {prevGroup && renderGroupContent(prevGroup, {
                transform: `translateX(${swipeOffset + (transitionDir < 0 ? window.innerWidth : -window.innerWidth)}px)`,
                transition: transitioning ? "transform 0.25s ease" : "none",
              })}
              {/* Current group */}
              {renderGroupContent(g, {
                transform: `translateX(${swipeOffset}px)`,
                transition: transitioning ? "transform 0.25s ease" : "none",
              })}
              {/* Invisible placeholder to maintain height */}
              <div style={{ visibility: "hidden", pointerEvents: "none" }}>
                <div style={crd({ padding: 0, overflow: "hidden", marginBottom: 16 })}>
                <div style={{ padding: "10px 14px 8px", fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: 1 }}>GRUPO {g}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ textAlign: "left", padding: "4px 14px", color: C.muted, fontWeight: 600 }}>Equipo</th>
                      <th style={{ textAlign: "center", padding: "4px 4px", color: C.muted, fontWeight: 600 }}>PJ</th>
                      <th style={{ textAlign: "center", padding: "4px 4px", color: C.muted, fontWeight: 600 }}>G</th>
                      <th style={{ textAlign: "center", padding: "4px 4px", color: C.muted, fontWeight: 600 }}>E</th>
                      <th style={{ textAlign: "center", padding: "4px 4px", color: C.muted, fontWeight: 600 }}>P</th>
                      <th style={{ textAlign: "center", padding: "4px 4px", color: C.muted, fontWeight: 600 }}>GF</th>
                      <th style={{ textAlign: "center", padding: "4px 4px", color: C.muted, fontWeight: 600 }}>DG</th>
                      <th style={{ textAlign: "center", padding: "4px 8px", color: C.accent, fontWeight: 700 }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((t, i) => (
                      <tr key={t.name} style={{ borderBottom: i < standings.length-1 ? `1px solid ${C.border}` : "none", background: i < 2 ? "#0f1a0f" : "transparent" }}>
                        <td style={{ padding: "7px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: i < 2 ? C.green : C.muted, fontWeight: 700, minWidth: 14 }}>{i+1}</span>
                          <span style={{ fontSize: 15 }}>{flag(t.name)}</span>
                          <span style={{ color: C.text, fontWeight: i < 2 ? 700 : 400, fontSize: 12 }}>{t.name}</span>
                        </td>
                        <td style={{ textAlign: "center", color: C.textDim, fontSize: 12 }}>{t.pj}</td>
                        <td style={{ textAlign: "center", color: C.textDim, fontSize: 12 }}>{t.g}</td>
                        <td style={{ textAlign: "center", color: C.textDim, fontSize: 12 }}>{t.e}</td>
                        <td style={{ textAlign: "center", color: C.textDim, fontSize: 12 }}>{t.p}</td>
                        <td style={{ textAlign: "center", color: C.textDim, fontSize: 12 }}>{t.gf}</td>
                        <td style={{ textAlign: "center", color: C.textDim, fontSize: 12 }}>{t.gf - t.gc}</td>
                        <td style={{ textAlign: "center", padding: "7px 8px", color: C.accent, fontWeight: 800, fontSize: 13 }}>{t.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {gMatches.map(renderMatchCard)}
              </div>
            </div>
          )
        })()}
        {stage !== "Grupos" && (() => {
          const allStagesNav = ["Grupos", "16avos", "8vos", "4tos", "Semi", "3º y 4º", "Final"]
          const stageIdx = allStagesNav.indexOf(stage)
          const prevStageMatches = transitioning && swipeOffset !== 0
            ? (swipeOffset > 0
                ? (stageIdx > 0 ? allMatches.filter(m => m.stage === allStagesNav[stageIdx - 1]) : null)
                : (stageIdx < allStagesNav.length - 1 ? allMatches.filter(m => m.stage === allStagesNav[stageIdx + 1]) : null))
            : null
          const w = typeof window !== "undefined" ? window.innerWidth : 400
          return (
            <div style={{ position: "relative", overflow: "hidden" }}>
              {/* Adjacent stage - positioned off-screen, moves with swipe */}
              {prevStageMatches && (
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0,
                  transform: `translateX(${swipeOffset + (swipeOffset < 0 ? w : -w)}px)`,
                  transition: transitioning && swipeOffset === 0 ? "transform 0.25s ease" : "none",
                }}>
                  {prevStageMatches.map(renderMatchCard)}
                </div>
              )}
              {/* Current stage - follows swipe */}
              <div style={{
                transform: `translateX(${swipeOffset}px)`,
                transition: transitioning && swipeOffset === 0 ? "transform 0.25s ease" : "none",
              }}>
                {matchesByStage.map(renderMatchCard)}
              </div>
            </div>
          )
        })()}
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
              {PNG_AVATARS.map(url => (
                <button key={url} onClick={() => setSettAvatar(url)} style={{ width: 44, height: 44, borderRadius: 10, cursor: "pointer", padding: 2, background: settAvatar === url ? C.accentDim : "#1a2035", border: `2px solid ${settAvatar === url ? C.accent : C.border}`, overflow: "hidden" }}>
                  <img src={url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                </button>
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
            <AdminPanel results={results} editResults={editResults} setEditResults={setEditResults} saveResults={saveResults} saving={saving} stage={stage} setStage={setStage} showFlash={showFlash} regClosesAt={regClosesAt} setRegClosesAt={setRegClosesAt} registrationOpen={registrationOpen} setRegistrationOpen={setRegistrationOpen} autoSyncStatus={autoSyncStatus} allMatches={allMatches} allStages={allStages} doSync={doSync} doSyncDate={doSyncDate} lastSyncTime={lastSyncTime} knockoutOverrides={knockoutOverrides} setKnockoutOverrides={setKnockoutOverrides} knockoutMatches={knockoutMatches} players={players} />
          )}
        </div>
      </div>
      <BottomNav />
      {flash && <FlashMsg msg={flash} />}
      {showLogoutConfirm && <LogoutConfirm onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} />}
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
              {PNG_AVATARS.map(url => (
                <button key={url} onClick={() => setSettAvatar(url)} style={{ width: 44, height: 44, borderRadius: 10, cursor: "pointer", padding: 2, background: settAvatar === url ? C.accentDim : "#1a2035", border: `2px solid ${settAvatar === url ? C.accent : C.border}`, overflow: "hidden" }}>
                  <img src={url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                </button>
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
            <AdminPanel results={results} editResults={editResults} setEditResults={setEditResults} saveResults={saveResults} saving={saving} stage={stage} setStage={setStage} showFlash={showFlash} regClosesAt={regClosesAt} setRegClosesAt={setRegClosesAt} registrationOpen={registrationOpen} setRegistrationOpen={setRegistrationOpen} autoSyncStatus={autoSyncStatus} allMatches={allMatches} allStages={allStages} doSync={doSync} doSyncDate={doSyncDate} lastSyncTime={lastSyncTime} knockoutOverrides={knockoutOverrides} setKnockoutOverrides={setKnockoutOverrides} knockoutMatches={knockoutMatches} players={players} />
          )}
        </div>
      </div>
      <BottomNav />
      {flash && <FlashMsg msg={flash} />}
      {showLogoutConfirm && <LogoutConfirm onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} />}
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════════
  // GRUPOS
  // ════════════════════════════════════════════════════════════════════════════
  if (tab === "grupos") {
    const grupoLetters = ["A","B","C","D","E","F","G","H","I","J","K","L"]
    const groupSubFilter = grupoLetters[0]

    // Calculate standings for each group
    const calcGroupStandings = (letter) => {
      const groupMatches = MATCHES.filter(m => m.group === letter && m.stage === "Grupos")
      const teams = {}
      groupMatches.forEach(m => {
        if (!teams[m.home]) teams[m.home] = { name: m.home, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
        if (!teams[m.away]) teams[m.away] = { name: m.away, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }
        const result = results.find(r => r.match_id === m.id)
        if (!result || result.home_score === null) return
        const hs = parseInt(result.home_score), as_ = parseInt(result.away_score)
        teams[m.home].pj++; teams[m.away].pj++
        teams[m.home].gf += hs; teams[m.home].gc += as_
        teams[m.away].gf += as_; teams[m.away].gc += hs
        if (hs > as_) { teams[m.home].g++; teams[m.home].pts += 3; teams[m.away].p++ }
        else if (hs < as_) { teams[m.away].g++; teams[m.away].pts += 3; teams[m.home].p++ }
        else { teams[m.home].e++; teams[m.home].pts++; teams[m.away].e++; teams[m.away].pts++ }
      })
      return Object.values(teams).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts
        const gdA = a.gf - a.gc, gdB = b.gf - b.gc
        if (gdB !== gdA) return gdB - gdA
        return b.gf - a.gf
      })
    }

    return (
      <div style={appStyle}>
        <Header title="🏟️ Grupos" />
        {/* Group pills */}
        <div style={{ padding: "10px 14px", background: C.card2, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 56, zIndex: 90 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
            {grupoLetters.map(g => (
              <button key={g} onClick={() => scrollToElement("grupo-"+g, 155)}
                style={{ padding: "5px 4px", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textDim, textAlign: "center" }}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: "12px 14px" }}>
          {grupoLetters.map(g => {
            const standings = calcGroupStandings(g)
            return (
              <div key={g} id={"grupo-"+g} style={crd({ padding: 0, overflow: "hidden", marginBottom: 16 })}>
                <div style={{ padding: "10px 14px 8px", fontSize: 12, fontWeight: 800, color: C.accent, letterSpacing: 1 }}>GRUPO {g}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      <th style={{ textAlign: "left", padding: "4px 14px", color: C.muted, fontWeight: 600 }}>Equipo</th>
                      <th style={{ textAlign: "center", padding: "4px 6px", color: C.muted, fontWeight: 600 }}>PJ</th>
                      <th style={{ textAlign: "center", padding: "4px 6px", color: C.muted, fontWeight: 600 }}>G</th>
                      <th style={{ textAlign: "center", padding: "4px 6px", color: C.muted, fontWeight: 600 }}>E</th>
                      <th style={{ textAlign: "center", padding: "4px 6px", color: C.muted, fontWeight: 600 }}>P</th>
                      <th style={{ textAlign: "center", padding: "4px 6px", color: C.muted, fontWeight: 600 }}>GF</th>
                      <th style={{ textAlign: "center", padding: "4px 6px", color: C.muted, fontWeight: 600 }}>GC</th>
                      <th style={{ textAlign: "center", padding: "4px 8px", color: C.accent, fontWeight: 700 }}>Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((t, i) => (
                      <tr key={t.name} style={{ borderBottom: i < standings.length - 1 ? `1px solid ${C.border}` : "none", background: i < 2 ? "#0f1a0f" : "transparent" }}>
                        <td style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: i < 2 ? C.green : C.muted, fontWeight: 700, minWidth: 14 }}>{i + 1}</span>
                          <span style={{ fontSize: 16 }}>{FLAGS[t.name] || "🏳️"}</span>
                          <span style={{ color: C.text, fontWeight: i < 2 ? 700 : 400 }}>{t.name}</span>
                        </td>
                        <td style={{ textAlign: "center", padding: "8px 6px", color: C.textDim }}>{t.pj}</td>
                        <td style={{ textAlign: "center", padding: "8px 6px", color: C.textDim }}>{t.g}</td>
                        <td style={{ textAlign: "center", padding: "8px 6px", color: C.textDim }}>{t.e}</td>
                        <td style={{ textAlign: "center", padding: "8px 6px", color: C.textDim }}>{t.p}</td>
                        <td style={{ textAlign: "center", padding: "8px 6px", color: C.textDim }}>{t.gf}</td>
                        <td style={{ textAlign: "center", padding: "8px 6px", color: C.textDim }}>{t.gc}</td>
                        <td style={{ textAlign: "center", padding: "8px 8px", color: C.accent, fontWeight: 800, fontSize: 14 }}>{t.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
        <BottomNav />
      </div>
    )
  }

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

function TercerosPicker({ match, knockoutMatches, allMatches, results, onSelect }) {
  // Calculate all group thirds
  const grupoLetters = ["A","B","C","D","E","F","G","H","I","J","K","L"]
  const thirds = grupoLetters.map(letter => {
    const gMatches = allMatches.filter(m => m.group === letter && m.stage === "Grupos")
    const teams = {}
    gMatches.forEach(m => {
      if (!teams[m.home]) teams[m.home] = { name: m.home, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }
      if (!teams[m.away]) teams[m.away] = { name: m.away, pj:0, g:0, e:0, p:0, gf:0, gc:0, pts:0 }
      const r = results.find(r => r.match_id === m.id)
      if (!r || r.home_score === null) return
      const hs = parseInt(r.home_score), as_ = parseInt(r.away_score)
      teams[m.home].pj++; teams[m.away].pj++
      teams[m.home].gf += hs; teams[m.home].gc += as_
      teams[m.away].gf += as_; teams[m.away].gc += hs
      if (hs > as_) { teams[m.home].g++; teams[m.home].pts += 3; teams[m.away].p++ }
      else if (hs < as_) { teams[m.away].g++; teams[m.away].pts += 3; teams[m.home].p++ }
      else { teams[m.home].e++; teams[m.home].pts++; teams[m.away].e++; teams[m.away].pts++ }
    })
    const sorted = Object.values(teams).sort((a,b) => b.pts !== a.pts ? b.pts-a.pts : (b.gf-b.gc)-(a.gf-a.gc) || b.gf-a.gf)
    return sorted[2] ? { ...sorted[2], group: letter } : null
  }).filter(Boolean)

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={() => onSelect(null)}>
      <div style={{ background: "#0f1624", border: "1px solid #c8a84b", borderRadius: 16, padding: 20, width: "100%", maxWidth: 380 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#c8a84b", marginBottom: 4 }}>Elegir 3° para este cruce</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
          {match.home} vs {match.away}
        </div>
        {thirds.length === 0
          ? <div style={{ fontSize: 13, color: "#6b7280" }}>No hay terceros calculados todavía</div>
          : thirds.map(t => (
            <div key={t.group} onClick={e => { e.stopPropagation(); e.preventDefault(); onSelect(t) }}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 4, background: "#1a2035" }}
              onMouseEnter={e => e.currentTarget.style.background = "#1e3a5f"}
              onMouseLeave={e => e.currentTarget.style.background = "#1a2035"}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>3° Grupo {t.group} — {t.name}</span>
              <span style={{ fontSize: 12, color: "#c8a84b" }}>{t.pts}pts</span>
            </div>
          ))
        }
        <button onClick={() => onSelect("reset")} style={{ marginTop: 8, width: "100%", padding: "8px", background: "transparent", border: "1px solid #ef444433", borderRadius: 8, color: "#ef4444aa", cursor: "pointer", fontSize: 13 }}>↩ Ninguno (volver al label original)</button>
        <button onClick={() => onSelect(null)} style={{ marginTop: 6, width: "100%", padding: "8px", background: "transparent", border: "1px solid #1e2940", borderRadius: 8, color: "#6b7280", cursor: "pointer", fontSize: 13 }}>Cancelar</button>
      </div>
    </div>
  )
}

function WCDebugPanel({ allMatches, knockoutMatches }) {
  const [matchId, setMatchId] = useState("1")
  const [singleResult, setSingleResult] = useState(null)
  const [dateStr, setDateStr] = useState("2026-06-11")
  const [dateResults, setDateResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState("date")

  const toArg = (utc) => new Date(utc).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  })

  const lookupSingle = async () => {
    setLoading(true); setSingleResult(null)
    try {
      const id = parseInt(matchId)
      const ourMatch = allMatches.find(m => m.id === id)
      if (!ourMatch) { setSingleResult({ error: `No existe partido con id ${id}` }); setLoading(false); return }
      const fdId = ourMatch.fdId || knockoutMatches.find(m => m.id === id)?.fd_id
      if (!fdId) { setSingleResult({ error: `Partido ${id} no tiene fdId`, our: ourMatch }); setLoading(false); return }
      const r = await fetch(`/api/match?id=${fdId}`)
      const data = await r.json()
      setSingleResult({ our: ourMatch, fdId, fd: data })
    } catch(e) { setSingleResult({ error: e.message }) }
    setLoading(false)
  }

  const lookupDate = async () => {
    setLoading(true); setDateResults([])
    try {
      // Single request - proxy expands to day before/after automatically
      const r = await fetch(`/api/sync?date=${dateStr}`)
      const data = await r.json()
      const fdMatches = data.matches || []
      // Build fdId lookup
      const fdById = {}
      fdMatches.forEach(m => { fdById[m.id] = m })
      // Find our matches for this date
      // Our matches for the chosen date - dates in data.js are already in ARG
      const ourToday = allMatches.filter(m => m.date?.slice(0, 10) === dateStr)
      // Match by fdId
      const rows = ourToday.map(our => {
        const fdId = our.fdId || knockoutMatches.find(m => m.id === our.id)?.fd_id
        const fd = fdId ? fdById[fdId] : null
        return { our, fdId, fd, matched: !!fd }
      })
      // Also show fd matches that didn't match any of ours
      setDateResults({ rows, total: fdMatches.length })
    } catch(e) { setDateResults({ error: e.message }) }
    setLoading(false)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: "#1a2035", border: "1px solid #6b7280", borderRadius: 8, padding: "8px 14px", color: "#6b7280", fontSize: 13, cursor: "pointer", width: "100%", marginBottom: open ? 8 : 0 }}>
        🔬 Debug football-data
      </button>
      {open && (
        <div style={{ background: "#0f1624", border: "1px solid #1e2940", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", marginBottom: 10, background: "#0a0e1a", borderRadius: 6, overflow: "hidden" }}>
            {[["date","Por fecha"], ["id","Por ID"]].map(([v, label]) => (
              <button key={v} onClick={() => setTab(v)}
                style={{ flex: 1, padding: "5px", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", background: tab === v ? "#c8a84b" : "transparent", color: tab === v ? "#0a0e1a" : "#94a3b8" }}>
                {label}
              </button>
            ))}
          </div>

          {tab === "date" && <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)}
                style={{ flex: 1, background: "#1a2035", border: "1px solid #1e2940", borderRadius: 6, padding: "4px 8px", color: "#e2e8f0", fontSize: 12 }} />
              <button onClick={lookupDate} disabled={loading}
                style={{ background: "#c8a84b", color: "#0a0e1a", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {loading ? "..." : "Buscar"}
              </button>
            </div>
            {dateResults.error && <div style={{ color: "#ef4444", fontSize: 12 }}>{dateResults.error}</div>}
            {dateResults.rows?.length > 0 && (
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                  {dateResults.rows.length} partidos nuestros · {dateResults.total} en football-data ese día
                </div>
                {dateResults.rows.map((row, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #1e2940", fontSize: 11 }}>
                    <span style={{ color: row.matched ? "#22c55e" : "#ef4444", marginRight: 5 }}>{row.matched ? "✓" : "✗"}</span>
                    <span style={{ color: "#e2e8f0", fontWeight: 600 }}>P{row.our.id}</span>
                    <span style={{ color: "#94a3b8" }}> {row.our.home} vs {row.our.away} · {row.our.date?.slice(11,16)} ARG</span>
                    {row.fd && <>
                      <span style={{ color: "#6b7280" }}> → </span>
                      <span style={{ color: "#60a5fa" }}>{row.fd.homeTeam?.name || "?"} vs {row.fd.awayTeam?.name || "?"}</span>
                      <span style={{ color: "#6b7280" }}> · {toArg(row.fd.utcDate)} · {row.fd.status}</span>
                      {row.fd.venue?.name && <span style={{ color: "#6b7280" }}> · {row.fd.venue.name}</span>}
                      {row.fd.score?.regularTime?.home != null && <span style={{ color: "#22c55e", fontWeight: 700 }}> {row.fd.score.regularTime.home}-{row.fd.score.regularTime.away}</span>}
                    </>}
                  </div>
                ))}
              </div>
            )}
          </>}

          {tab === "id" && <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>ID (1-104):</span>
              <input type="number" min="1" max="104" value={matchId} onChange={e => setMatchId(e.target.value)}
                style={{ width: 70, background: "#1a2035", border: "1px solid #1e2940", borderRadius: 6, padding: "4px 8px", color: "#e2e8f0", fontSize: 12 }} />
              <button onClick={lookupSingle} disabled={loading}
                style={{ background: "#c8a84b", color: "#0a0e1a", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {loading ? "..." : "Buscar"}
              </button>
            </div>
            {singleResult && (
              <div style={{ fontSize: 12 }}>
                {singleResult.error
                  ? <div style={{ color: "#ef4444" }}>⚠️ {singleResult.error}</div>
                  : <>
                    <div style={{ color: "#94a3b8", marginBottom: 6 }}>
                      <span style={{ color: "#c8a84b", fontWeight: 700 }}>Nuestro:</span> {singleResult.our.home} vs {singleResult.our.away} · {singleResult.our.date} · fdId={singleResult.fdId}
                    </div>
                    <div style={{ color: "#94a3b8" }}>
                      <span style={{ color: "#22c55e", fontWeight: 700 }}>Football-data:</span>{" "}
                      {singleResult.fd.homeTeam?.name || "?"} vs {singleResult.fd.awayTeam?.name || "?"}{" "}
                      · {singleResult.fd.utcDate ? toArg(singleResult.fd.utcDate) : "?"}{" "}
                      · {singleResult.fd.status}{" "}
                      {singleResult.fd.venue?.name && `· ${singleResult.fd.venue.name}`}
                    </div>
                  </>
                }
              </div>
            )}
          </>}
        </div>
      )}
    </div>
  )
}

function renderAdminMatch(match, getResult, editResults, setEditResults, saving, saveResults) {
  const saved = getResult(match.id) || {}
  const edited = editResults[match.id] || {}
  const cur = { ...saved, ...edited }
  const isInPlay = cur.status === "IN_PLAY"
  const isFinished = cur.status === "FINISHED"
  return (
    <div key={match.id} style={{ background: "#0f1624", border: "1px solid " + (isInPlay ? "#22c55e" : isFinished ? "#2a3a2a" : "#1e2940"), borderRadius: 10, padding: 10, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: "#6b7280" }}>{formatDate(match.date)}</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: isInPlay ? "#22c55e" : isFinished ? "#e2e8f0" : isLocked(match.date) ? "#6b7280" : "" }}>
            {isInPlay ? "● en juego" : isFinished ? "✓ finalizado" : isLocked(match.date) ? "🔒 bloqueado" : ""}
          </div>
          {isInPlay && cur.match_time && (
            <div style={{ fontSize: 9, color: "#22c55e" }}>{`Última act. ${cur.match_time === "ET" ? "ET" : cur.match_time + "'"}`}</div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, textAlign: "right", fontSize: 12, fontWeight: 700 }}>
          {(FLAGS && FLAGS[match.home]) || "🏳️"} {match.home}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <input type="text" inputMode="numeric" maxLength={2}
            style={{ width: 40, height: 40, background: "#1a2035", border: "2px solid #c8a84b", borderRadius: 7, color: "#c8a84b", fontSize: 18, fontWeight: 800, textAlign: "center", outline: "none" }}
            value={cur.home_score ?? ""}
            onChange={e => { const v = e.target.value.replace(/[^0-9]/g,""); setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], home_score: v } })) }}
          />
          <span style={{ color: "#6b7280", fontWeight: 900 }}>:</span>
          <input type="text" inputMode="numeric" maxLength={2}
            style={{ width: 40, height: 40, background: "#1a2035", border: "2px solid #c8a84b", borderRadius: 7, color: "#c8a84b", fontSize: 18, fontWeight: 800, textAlign: "center", outline: "none" }}
            value={cur.away_score ?? ""}
            onChange={e => { const v = e.target.value.replace(/[^0-9]/g,""); setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], away_score: v } })) }}
          />
        </div>
        <div style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 700 }}>
          {(FLAGS && FLAGS[match.away]) || "🏳️"} {match.away}
        </div>
      </div>
    </div>
  )
}

function SetNewPasswordForm({ onSave }) {
  const [pass, setPass] = useState("")
  const [pass2, setPass2] = useState("")
  const [err, setErr] = useState("")
  return (
    <div>
      <input type="password" placeholder="Nueva contraseña" value={pass} onChange={e => setPass(e.target.value)}
        style={{ width: "100%", background: "#1a2035", border: "2px solid #1e2940", borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "#e2e8f0", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
      <input type="password" placeholder="Repetir contraseña" value={pass2} onChange={e => setPass2(e.target.value)}
        style={{ width: "100%", background: "#1a2035", border: "2px solid #1e2940", borderRadius: 10, padding: "12px 14px", fontSize: 15, color: "#e2e8f0", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />
      {err && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      <button onClick={() => {
        if (pass.length < 4) { setErr("La contraseña debe tener al menos 4 caracteres"); return }
        if (pass !== pass2) { setErr("Las contraseñas no coinciden"); return }
        onSave(pass)
      }} style={{ background: "#c8a84b", color: "#0a0e1a", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%" }}>
        Guardar contraseña
      </button>
    </div>
  )
}

function ResetPasswordPanel({ players, showFlash }) {
  const [selectedPlayer, setSelectedPlayer] = useState("")
  const [newPass, setNewPass] = useState("")
  const [open, setOpen] = useState(false)

  const reset = async () => {
    if (!selectedPlayer) return
    const { error } = await supabase.from("players").update({ password_reset: true }).eq("id", selectedPlayer)
    if (error) showFlash("❌ Error al resetear")
    else { showFlash("✓ " + (players.find(p => p.id == selectedPlayer)?.name) + " deberá elegir nueva contraseña"); setSelectedPlayer("") }
  }

  return (
    <div style={{ marginBottom: 14, background: "#0f1624", borderRadius: 10, border: "1px solid #1e2940", overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width: "100%", padding: "10px 12px", background: "none", border: "none", color: "#94a3b8", fontSize: 13, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
        🔑 Resetear contraseña {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px" }}>
          <select value={selectedPlayer} onChange={e => setSelectedPlayer(e.target.value)}
            style={{ width: "100%", background: "#1a2035", border: "1px solid #1e2940", borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, marginBottom: 8, outline: "none" }}>
            <option value="">— Elegir usuario —</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}{p.password_reset ? " ⚠️" : ""}</option>)}
          </select>
          <button onClick={reset} disabled={!selectedPlayer}
            style={{ background: "#c8a84b", color: "#0a0e1a", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%", opacity: !selectedPlayer ? 0.5 : 1 }}>
            Resetear
          </button>
        </div>
      )}
    </div>
  )
}

function AdminPanel({ results, editResults, setEditResults, saveResults, saving, stage, setStage, showFlash, regClosesAt, setRegClosesAt, registrationOpen, setRegistrationOpen, autoSyncStatus, allMatches, allStages, doSync, doSyncDate, lastSyncTime, knockoutOverrides, setKnockoutOverrides, knockoutMatches, players }) {
  const getResult = (id) => results.find(r => r.match_id === id)
  const [adminGruposView, setAdminGruposView] = useState("grupo")
  const [tercerosPicker, setTercerosPicker] = useState(null)
  const [editKnockout, setEditKnockout] = useState({})
  const grupoLetters = ["A","B","C","D","E","F","G","H","I","J","K","L"]
  const fechaGroups = [
    { date: "Fecha 1", matches: allMatches.filter(m => m.stage === "Grupos" && m.id >= 1  && m.id <= 24) },
    { date: "Fecha 2", matches: allMatches.filter(m => m.stage === "Grupos" && m.id >= 25 && m.id <= 48) },
    { date: "Fecha 3", matches: allMatches.filter(m => m.stage === "Grupos" && m.id >= 49 && m.id <= 72) },
  ]

  return (
    <div>
      {/* Registration cutoff */}
      <div style={{ marginBottom: 14, padding: 12, background: "#0f1624", borderRadius: 10, border: "1px solid #1e2940" }}>
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8, fontWeight: 700 }}>🔒 Cierre de inscripciones</div>
        <input type="datetime-local"
          style={{ width: "100%", background: "#1a2035", border: "2px solid #1e2940", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#e2e8f0", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
          defaultValue={regClosesAt}
          onChange={async (e) => {
            const val = e.target.value
            await supabase.from("config").upsert({ key: "registration_closes_at", value: val }, { onConflict: "key" })
            setRegClosesAt(val)
            setRegistrationOpen(new Date() < new Date(val))
          }}
        />
        <div style={{ fontSize: 11, color: registrationOpen ? "#22c55e" : "#ef4444" }}>
          {registrationOpen ? "✓ Inscripciones abiertas" : "✗ Inscripciones cerradas"}
        </div>
      </div>

      {/* Sync status */}
      <div style={{ marginBottom: 8, padding: "8px 12px", background: "#0f1624", borderRadius: 8, border: "1px solid #1e2940", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: autoSyncStatus === "searching" ? "#c8a84b" : autoSyncStatus === "found" ? "#22c55e" : autoSyncStatus === "error" ? "#ef4444" : "#333" }} />
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {autoSyncStatus === "searching" ? "🔍 buscando..."
            : autoSyncStatus.startsWith("found") ? "✓ datos actualizados · " + autoSyncStatus.split(" · ")[1]
            : autoSyncStatus.startsWith("nothing") ? "sin cambios · " + autoSyncStatus.split(" · ")[1]
            : autoSyncStatus.startsWith("error") ? "⚠️ error · " + autoSyncStatus.split(" · ")[1]
            : autoSyncStatus.startsWith("idle") ? "en espera · " + autoSyncStatus.split(" · ")[1]
            : "en espera"}
        </div>
      </div>
      <button onClick={async () => { const msg = await doSync(); showFlash("✓ " + (msg || "Sync completado")) }}
        style={{ background: "#1a2035", border: "1px solid #1e2940", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", fontSize: 13, cursor: "pointer", marginBottom: 8, width: "100%" }}>
        ⚡ Sync manual
      </button>
      <WCDebugPanel allMatches={allMatches} knockoutMatches={knockoutMatches} players={players} />

      {/* Reset password */}
      <ResetPasswordPanel players={players} showFlash={showFlash} />

      {/* Stage tabs - sticky */}
      <div style={{ position: "sticky", top: 56, zIndex: 90, background: "#0a0e1a", paddingBottom: 8, marginBottom: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
          {allStages.map(st => (
            <button key={st} onClick={() => setStage(st)}
              style={{ background: stage === st ? "#c8a84b" : "transparent", color: stage === st ? "#0a0e1a" : "#94a3b8", border: "1px solid " + (stage === st ? "#c8a84b" : "#1e2940"), borderRadius: 7, padding: "5px 4px", fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Grupos sub-controls - sticky */}
      {stage === "Grupos" && (
        <div style={{ position: "sticky", top: 112, zIndex: 89, background: "#0a0e1a", paddingBottom: 8, marginBottom: 4 }}>
          <div style={{ display: "flex", background: "#0a0e1a", borderRadius: 8, overflow: "hidden", border: "1px solid #1e2940", marginBottom: 8, width: "fit-content" }}>
            {[["grupo","Por grupo"], ["fecha","Por fecha"]].map(([v, label]) => (
              <button key={v} onClick={() => setAdminGruposView(v)}
                style={{ padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", border: "none", background: adminGruposView === v ? "#c8a84b" : "transparent", color: adminGruposView === v ? "#0a0e1a" : "#94a3b8" }}>
                {label}
              </button>
            ))}
          </div>
          {adminGruposView === "grupo"
            ? <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
                {grupoLetters.map(g => (
                  <button key={g} onClick={() => scrollToElement("admin-grp-"+g, 180)}
                    style={{ padding: "4px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: "1px solid #1e2940", background: "transparent", color: "#94a3b8", textAlign: "center" }}>
                    {g}
                  </button>
                ))}
              </div>
            : <div style={{ display: "flex", gap: 5 }}>
                {fechaGroups.map((fg, i) => (
                  <button key={i} onClick={() => scrollToElement("admin-fecha-"+i, 180)}
                    style={{ flex: 1, padding: "4px 4px", fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 6, border: "1px solid #1e2940", background: "transparent", color: "#94a3b8", textAlign: "center" }}>
                    {fg.date}
                  </button>
                ))}
              </div>
          }
        </div>
      )}

      {/* Match cards */}
      {stage === "Grupos" && adminGruposView === "grupo" && grupoLetters.map(g => {
        const gMatches = allMatches.filter(m => m.stage === "Grupos" && m.group === g)
        if (!gMatches.length) return null
        return (
          <div key={g} id={"admin-grp-"+g}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#c8a84b", padding: "8px 4px 4px", letterSpacing: 1 }}>GRUPO {g}</div>
            {gMatches.map(match => renderAdminMatch(match, getResult, editResults, setEditResults, saving, saveResults))}
          </div>
        )
      })}
      {stage === "Grupos" && adminGruposView === "fecha" && fechaGroups.map((fg, i) => (
        <div key={i} id={"admin-fecha-"+i}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#c8a84b", padding: "8px 4px 4px", letterSpacing: 1 }}>{fg.date.toUpperCase()}</div>
          {fg.matches.map(match => renderAdminMatch(match, getResult, editResults, setEditResults, saving, saveResults))}
        </div>
      ))}
      {stage !== "Grupos" && allMatches.filter(m => m.stage === stage).map(match => {
        const saved = getResult(match.id) || {}
        const edited = editResults[match.id] || {}
        const cur = { ...saved, ...edited }
        const isInPlay = cur.status === "IN_PLAY"
        const isFinished = cur.status === "FINISHED"
        const isSixteens = match.stage === "16avos"
        // Slots that are tercero positions (fixed based on official bracket)
        const terceroHomeSlots = new Set([]) // none have tercero on home side
        const terceroAwaySlots = new Set([74, 77, 79, 80, 81, 82, 85, 87])
        const homeRaw = match._homeRaw || match.home
        const awayRaw = match._awayRaw || match.away
        const homeIsTercero = isSixteens && (homeRaw.includes("3°") || homeRaw.includes("mejor") || terceroHomeSlots.has(match.id))
        const awayIsTercero = isSixteens && (awayRaw.includes("3°") || awayRaw.includes("mejor") || terceroAwaySlots.has(match.id))
        return (
          <div key={match.id} style={{ background: "#0f1624", border: "1px solid " + (isInPlay ? "#22c55e" : isFinished ? "#2a3a2a" : "#1e2940"), borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#6b7280" }}><><span style={{ color: "#c8a84b", fontWeight: 700, marginRight: 6 }}>P{match.id}</span>{formatDate(match.date)}</></div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isInPlay ? "#22c55e" : isFinished ? "#e2e8f0" : isLocked(match.date) ? "#6b7280" : "" }}>
                  {isInPlay ? "● en juego" : isFinished ? "✓ finalizado" : isLocked(match.date) ? "🔒 bloqueado" : ""}
                </div>
                {isInPlay && cur.match_time && <div style={{ fontSize: 9, color: "#22c55e" }}>{cur.match_time === "ET" ? "Última act. ET" : `Última act. ${cur.match_time}'`}</div>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, textAlign: "right", fontSize: 12, fontWeight: 700 }}>
                {homeIsTercero
                  ? <button onClick={() => setTercerosPicker({ matchId: match.id, side: "home" })}
                      style={{ background: "#1a2035", border: "1px dashed #c8a84b", borderRadius: 6, padding: "4px 8px", color: "#c8a84b", fontSize: 11, cursor: "pointer" }}>
                      {(match.id + "_home") in editKnockout ? (editKnockout[match.id + "_home"] ?? match._homeRaw ?? match.home) : (knockoutOverrides.find(o => o.match_id === match.id && o.side === "home")?.team_name ?? match._homeRaw ?? match.home)} ✏️
                    </button>
                  : <>{(FLAGS && FLAGS[match.home]) || "🏳️"} {match.home}</>
                }
              </div>
              <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                <input type="text" inputMode="numeric" maxLength={2}
                  style={{ width: 40, height: 40, background: "#1a2035", border: "2px solid #c8a84b", borderRadius: 7, color: "#c8a84b", fontSize: 18, fontWeight: 800, textAlign: "center", outline: "none" }}
                  value={cur.home_score ?? ""}
                  onChange={e => { const v = e.target.value.replace(/[^0-9]/g,""); setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], home_score: v } })) }}
                />
                <span style={{ color: "#6b7280", fontWeight: 900 }}>:</span>
                <input type="text" inputMode="numeric" maxLength={2}
                  style={{ width: 40, height: 40, background: "#1a2035", border: "2px solid #c8a84b", borderRadius: 7, color: "#c8a84b", fontSize: 18, fontWeight: 800, textAlign: "center", outline: "none" }}
                  value={cur.away_score ?? ""}
                  onChange={e => { const v = e.target.value.replace(/[^0-9]/g,""); setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], away_score: v } })) }}
                />
              </div>
              <div style={{ flex: 1, textAlign: "left", fontSize: 12, fontWeight: 700 }}>
                {awayIsTercero
                  ? <button onClick={() => setTercerosPicker({ matchId: match.id, side: "away" })}
                      style={{ background: "#1a2035", border: "1px dashed #c8a84b", borderRadius: 6, padding: "4px 8px", color: "#c8a84b", fontSize: 11, cursor: "pointer" }}>
                      ✏️ {(match.id + "_away") in editKnockout ? (editKnockout[match.id + "_away"] ?? match._awayRaw ?? match.away) : (knockoutOverrides.find(o => o.match_id === match.id && o.side === "away")?.team_name ?? match._awayRaw ?? match.away)}
                    </button>
                  : <>{(FLAGS && FLAGS[match.away]) || "🏳️"} {match.away}</>
                }
              </div>
            </div>
            {(() => {
              const isDraw = cur.home_score != null && cur.away_score != null &&
                cur.home_score !== "" && cur.away_score !== "" &&
                parseInt(cur.home_score) === parseInt(cur.away_score)
              return isDraw ? (
                <div style={{ marginTop: 8, padding: "8px 10px", background: "#0a0e1a", borderRadius: 8, border: "1px solid #3b82f6" }}>
                  <div style={{ fontSize: 11, color: "#60a5fa", marginBottom: 6, fontWeight: 700 }}>🥅 Penales</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1, textAlign: "right", fontSize: 11, color: "#94a3b8" }}>{match.home}</div>
                    <input type="text" inputMode="numeric" maxLength={2}
                      style={{ width: 36, height: 36, background: "#1a2035", border: "2px solid #3b82f6", borderRadius: 7, color: "#60a5fa", fontSize: 16, fontWeight: 800, textAlign: "center", outline: "none" }}
                      value={cur.penalty_home ?? ""}
                      onChange={e => { const v = e.target.value.replace(/[^0-9]/g,""); setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], penalty_home: v } })) }}
                    />
                    <span style={{ color: "#6b7280", fontWeight: 900 }}>:</span>
                    <input type="text" inputMode="numeric" maxLength={2}
                      style={{ width: 36, height: 36, background: "#1a2035", border: "2px solid #3b82f6", borderRadius: 7, color: "#60a5fa", fontSize: 16, fontWeight: 800, textAlign: "center", outline: "none" }}
                      value={cur.penalty_away ?? ""}
                      onChange={e => { const v = e.target.value.replace(/[^0-9]/g,""); setEditResults(p => ({ ...p, [match.id]: { ...p[match.id], penalty_away: v } })) }}
                    />
                    <div style={{ flex: 1, textAlign: "left", fontSize: 11, color: "#94a3b8" }}>{match.away}</div>
                  </div>
                </div>
              ) : null
            })()}
          </div>
        )
      })}
      {tercerosPicker && (
        <TercerosPicker
          match={allMatches.find(m => m.id === tercerosPicker.matchId)}
          knockoutMatches={allMatches.filter(m => m.id >= 73)}
          allMatches={allMatches}
          results={results}
          onSelect={(tercero) => {
            const matchId = tercerosPicker.matchId
            const side = tercerosPicker.side
            setTercerosPicker(null)
            if (tercero === "reset") {
              setEditKnockout(prev => ({ ...prev, [matchId + "_" + side]: null }))
            } else if (tercero) {
              setEditKnockout(prev => ({ ...prev, [matchId + "_" + side]: tercero.name }))
            }
          }}
        />
      )}

      {(Object.keys(editResults).length > 0 || Object.keys(editKnockout).length > 0) && (
        <button onClick={async () => {
          if (Object.keys(editResults).length > 0) await saveResults()
          for (const [key, value] of Object.entries(editKnockout)) {
            const parts = key.split("_")
            const matchId = parseInt(parts[0])
            const side = parts[1]
            if (value === null) {
              await supabase.from("knockout_overrides").delete().eq("match_id", matchId).eq("side", side)
              setKnockoutOverrides(prev => prev.filter(o => !(o.match_id === matchId && o.side === side)))
            } else {
              await supabase.from("knockout_overrides").upsert({ match_id: matchId, side, team_name: value }, { onConflict: "match_id,side" })
              setKnockoutOverrides(prev => {
                const next = prev.filter(o => !(o.match_id === matchId && o.side === side))
                return [...next, { match_id: matchId, side, team_name: value }]
              })
            }
          }
          setEditKnockout({})
          showFlash("✓ Guardado")
        }} disabled={saving}
          style={{ background: "#c8a84b", color: "#0a0e1a", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", marginTop: 8 }}>
          {saving ? "Guardando..." : "💾 Guardar cambios"}
        </button>
      )}
    </div>
  )
}
