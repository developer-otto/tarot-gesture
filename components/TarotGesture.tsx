'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './TarotGesture.module.css'

// ─── Tarot Data ────────────────────────────────────────────────────────────────

const TAROT_BASE = [
  { name: '愚者',   num: '0',     sym: '🌟', meaning: '新的开始，无限可能' },
  { name: '魔术师', num: 'I',     sym: '⚡', meaning: '意志力与创造力' },
  { name: '女祭司', num: 'II',    sym: '🌙', meaning: '直觉与内在智慧' },
  { name: '女皇',   num: 'III',   sym: '🌸', meaning: '丰盛、母性与创造' },
  { name: '皇帝',   num: 'IV',    sym: '👑', meaning: '权威、稳定与领导' },
  { name: '教皇',   num: 'V',     sym: '🔱', meaning: '传统与精神指引' },
  { name: '恋人',   num: 'VI',    sym: '❤️', meaning: '爱情、选择与和谐' },
  { name: '战车',   num: 'VII',   sym: '🏛️', meaning: '胜利、意志与控制' },
  { name: '力量',   num: 'VIII',  sym: '🦁', meaning: '勇气、耐心、内在力量' },
  { name: '隐士',   num: 'IX',    sym: '🕯️', meaning: '沉思、独处、寻求真理' },
  { name: '命运轮', num: 'X',     sym: '☯️', meaning: '命运、循环与转机' },
  { name: '正义',   num: 'XI',    sym: '⚖️', meaning: '公正、真相与因果' },
  { name: '倒吊人', num: 'XII',   sym: '🔮', meaning: '牺牲、等待与新视角' },
  { name: '死神',   num: 'XIII',  sym: '🌑', meaning: '转变、结束与新生' },
  { name: '节制',   num: 'XIV',   sym: '🌊', meaning: '平衡、调和与耐心' },
  { name: '恶魔',   num: 'XV',    sym: '🔥', meaning: '束缚、物欲与阴影' },
  { name: '高塔',   num: 'XVI',   sym: '⛈️', meaning: '突变、崩塌与启示' },
  { name: '星星',   num: 'XVII',  sym: '✨', meaning: '希望、灵感与更新' },
  { name: '月亮',   num: 'XVIII', sym: '🌕', meaning: '幻觉、潜意识与恐惧' },
  { name: '太阳',   num: 'XIX',   sym: '☀️', meaning: '喜悦、成功与活力' },
  { name: '审判',   num: 'XX',    sym: '🎺', meaning: '觉醒、救赎与重生' },
  { name: '世界',   num: 'XXI',   sym: '🌍', meaning: '完成、整合与成就' },
]

// ─── Types ─────────────────────────────────────────────────────────────────────

// Phase:
// 'gather'   — 牌堆汇聚到中间（散乱堆放）
// 'spread'   — 牌由中间向四周散开，满屏飘动
// 'selected' — 已有牌被选中，等待握拳结算
// 'reveal'   — 展示结果（3s后翻牌，10s后重置）
// 'loading'
type Phase = 'loading' | 'gather' | 'spread' | 'selected' | 'reveal'
type Gesture = 'open' | 'close' | 'fist' | 'unknown'

interface Card {
  uid: number          // unique instance id (allows duplicates)
  tarot: typeof TAROT_BASE[number]
  // physics position & velocity
  x: number; y: number
  vx: number; vy: number
  rot: number; vrot: number
  // target (for gather/spread transitions)
  tx: number; ty: number; trot: number
  // animation
  phase: number        // random phase offset for float
  picked: boolean
  pickOrder: number
  returning: boolean   // animating back into pile after reveal
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_CARDS   = 100
const CARD_W        = 46
const CARD_H        = 70
const SLOT_H        = 152  // bottom slot area height
const HINT_H        = 38   // hint bar height above slot
const COOLDOWN      = 1200
const HISTORY       = 10

// Floating params (spread phase)
const FLOAT_SPD     = 0.00045
const FLOAT_AMP     = 5
const WANDER_FORCE  = 0.012  // small random push each frame
const DAMPING       = 0.985  // velocity damping
const WALL_BOUNCE   = 0.4

// Gather/spread lerp speeds
const LERP_GATHER   = 0.055
const LERP_SPREAD   = 0.032

const STARS = Array.from({ length: 50 }, (_, i) => ({
  id: i,
  size: Math.random() * 2.5 + 0.5,
  left: Math.random() * 100,
  top: Math.random() * 100,
  delay: Math.random() * 5,
  dur: 2 + Math.random() * 4,
}))

// ─── Build deck (100 cards, allow repeats, shuffled) ──────────────────────────

function buildDeck(): Card[] {
  const deck: Card[] = []
  for (let i = 0; i < TOTAL_CARDS; i++) {
    const tarot = TAROT_BASE[i % TAROT_BASE.length]
    deck.push({
      uid: i,
      tarot,
      x: 0, y: 0,
      vx: 0, vy: 0,
      rot: 0, vrot: 0,
      tx: 0, ty: 0, trot: 0,
      phase: Math.random() * Math.PI * 2,
      picked: false,
      pickOrder: 0,
      returning: false,
    })
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

// ─── Layout helpers ────────────────────────────────────────────────────────────

function gatherTargets(cards: Card[], vw: number, vh: number) {
  // Clustered loosely around center — NOT a neat pile
  const cx = vw / 2, cy = (vh - SLOT_H - HINT_H) / 2
  return cards.map((c, i) => {
    const angle = (i / cards.length) * Math.PI * 2 * 3.7 // spiral
    const r = 10 + (i / cards.length) * 90
    return {
      ...c,
      tx: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 25,
      ty: cy + Math.sin(angle) * r * 0.65 + (Math.random() - 0.5) * 25,
      trot: (Math.random() - 0.5) * 40,
    }
  })
}

function spreadTargets(cards: Card[], vw: number, vh: number) {
  const zone = vh - SLOT_H - HINT_H
  const margin = CARD_W + 8
  return cards.map(c => ({
    ...c,
    tx: margin + Math.random() * (vw - margin * 2 - CARD_W),
    ty: margin + Math.random() * (zone - margin * 2 - CARD_H),
    trot: (Math.random() - 0.5) * 80,
  }))
}

// ─── Canvas helpers ────────────────────────────────────────────────────────────

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, rot: number,
  alpha: number, glowing: boolean, badge: number,
  t: number, phase: number
) {
  const fx = Math.sin(t * FLOAT_SPD + phase) * FLOAT_AMP
  const fy = Math.cos(t * FLOAT_SPD * 0.7 + phase + 1.2) * FLOAT_AMP * 0.5
  const rx = x + fx
  const ry = y + fy
  const rr = rot + Math.sin(t * FLOAT_SPD * 0.4 + phase) * 1.5

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(rx + CARD_W / 2, ry + CARD_H / 2)
  ctx.rotate((rr * Math.PI) / 180)

  // Shadow / glow
  if (glowing) {
    ctx.shadowColor = 'rgba(201,168,76,0.9)'
    ctx.shadowBlur = 18
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 5
    ctx.shadowOffsetY = 2
  }

  // Fill
  const g = ctx.createLinearGradient(-CARD_W / 2, -CARD_H / 2, CARD_W / 2, CARD_H / 2)
  if (glowing) { g.addColorStop(0, '#2e1c66'); g.addColorStop(1, '#1a0f42') }
  else         { g.addColorStop(0, '#1f1347'); g.addColorStop(1, '#130d30') }
  ctx.fillStyle = g
  rrect(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 4)
  ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

  // Outer border
  ctx.strokeStyle = glowing ? '#c9a84c' : '#6b4fbb'
  ctx.lineWidth = glowing ? 1.8 : 1.2
  rrect(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 4)
  ctx.stroke()

  // Inner border
  ctx.strokeStyle = glowing ? 'rgba(240,208,128,0.4)' : 'rgba(201,168,76,0.18)'
  ctx.lineWidth = 0.7
  rrect(ctx, -CARD_W / 2 + 3, -CARD_H / 2 + 3, CARD_W - 6, CARD_H - 6, 2)
  ctx.stroke()

  // Center star
  ctx.fillStyle = glowing ? 'rgba(201,168,76,0.7)' : 'rgba(201,168,76,0.25)'
  ctx.font = '14px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✦', 0, 0)

  // Pick badge
  if (badge > 0) {
    ctx.shadowColor = 'rgba(201,168,76,0.6)'
    ctx.shadowBlur = 8
    ctx.fillStyle = '#c9a84c'
    ctx.beginPath()
    ctx.arc(-CARD_W / 2 + 9, -CARD_H / 2 + 9, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.fillStyle = '#0a0614'
    ctx.font = 'bold 8px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(badge), -CARD_W / 2 + 9, -CARD_H / 2 + 9)
  }

  ctx.restore()
}

// ─── Gesture Detection ─────────────────────────────────────────────────────────

function detectFingers(lm: { x: number; y: number; z: number }[]): number {
  // tip above pip = extended
  const pairs: [number, number][] = [[8,6],[12,10],[16,14],[20,18]]
  return pairs.filter(([tip, pip]) => lm[tip].y < lm[pip].y).length
}

function thumbExtended(lm: { x: number; y: number; z: number }[]): boolean {
  // thumb tip clearly away from index MCP
  const dx = lm[4].x - lm[5].x
  const dy = lm[4].y - lm[5].y
  return Math.sqrt(dx*dx + dy*dy) > 0.08
}

// Average gap between adjacent fingertips (index→middle→ring→pinky)
function tipSpread(lm: { x: number; y: number; z: number }[]): number {
  const tips = [8, 12, 16, 20]
  let sum = 0
  for (let i = 0; i < tips.length - 1; i++) {
    const dx = lm[tips[i]].x - lm[tips[i+1]].x
    const dy = lm[tips[i]].y - lm[tips[i+1]].y
    sum += Math.sqrt(dx*dx + dy*dy)
  }
  return sum / 3  // average gap
}

function classify(lm: { x: number; y: number; z: number }[]): Gesture {
  const up   = detectFingers(lm)
  const th   = thumbExtended(lm)
  const gap  = tipSpread(lm)

  // Fist: all 4 fingers curled, thumb tucked
  if (up === 0 && !th) return 'fist'

  // Need all 4 fingers extended for open/close
  if (up < 3) return 'unknown'

  // Open: fingers spread apart (fan out)
  if (gap > 0.055) return 'open'

  // Close: fingers pressed together
  if (gap < 0.030) return 'close'

  return 'unknown'
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TarotGesture() {
  const videoRef   = useRef<HTMLVideoElement>(null)
  const hiddenCvRef = useRef<HTMLCanvasElement>(null)  // mediapipe processing (hidden)
  const cardCvRef  = useRef<HTMLCanvasElement>(null)   // fullscreen card render
  const previewRef = useRef<HTMLCanvasElement>(null)   // small camera preview

  const [phase, setPhase]           = useState<Phase>('loading')
  const [camError, setCamError]     = useState(false)
  const [gesture, setGesture]       = useState<Gesture>('unknown')
  const [hint, setHint]             = useState('')
  const [countdown, setCountdown]   = useState(0)
  const [pickedSnap, setPickedSnap] = useState<Card[]>([])

  // All hot state in refs
  const phaseRef       = useRef<Phase>('loading')
  const cardsRef       = useRef<Card[]>([])
  const histRef        = useRef<Gesture[]>([])
  const lastTrigger    = useRef(0)
  const rafRef         = useRef(0)
  const cdTimer        = useRef<ReturnType<typeof setInterval> | null>(null)
  const cdVal          = useRef(0)
  const vwRef          = useRef(1280)
  const vhRef          = useRef(800)
  const tRef           = useRef(0)   // animation time accumulator

  // ── phase helper ────────────────────────────────────────────────────────────

  const goPhase = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  // ── smooth gesture ───────────────────────────────────────────────────────────

  const smooth = useCallback((g: Gesture): Gesture => {
    const h = histRef.current
    h.push(g)
    if (h.length > HISTORY) h.shift()
    const cnt: Partial<Record<Gesture, number>> = {}
    h.forEach(x => { cnt[x] = (cnt[x] || 0) + 1 })
    let best: Gesture = 'unknown', bestN = 0
    ;(Object.entries(cnt) as [Gesture, number][]).forEach(([k, v]) => {
      if (v > bestN) { best = k as Gesture; bestN = v }
    })
    return bestN >= Math.floor(HISTORY * 0.55) ? best : 'unknown'
  }, [])

  // ── sync picked snap to react state ─────────────────────────────────────────

  const syncPicked = useCallback(() => {
    const snap = cardsRef.current
      .filter(c => c.picked)
      .sort((a, b) => a.pickOrder - b.pickOrder)
    setPickedSnap([...snap])
  }, [])

  // ── SPREAD: cards fly outward from center ────────────────────────────────────

  const doSpread = useCallback(() => {
    const vw = vwRef.current, vh = vhRef.current
    cardsRef.current = spreadTargets(cardsRef.current, vw, vh)
    goPhase('spread')
    setHint('五指张开：牌面散开  ·  五指并拢：聚合洗牌  ·  握拳：选牌')
  }, [goPhase])

  // ── GATHER: cards fly inward, loosely clustered ──────────────────────────────

  const doGather = useCallback((thenSpread = false) => {
    const vw = vwRef.current, vh = vhRef.current
    cardsRef.current = gatherTargets(
      cardsRef.current.map(c => ({ ...c, picked: false, pickOrder: 0, returning: false })),
      vw, vh
    )
    goPhase('gather')
    setHint(thenSpread ? '洗牌中，稍候散开...' : '牌堆聚合中  ·  五指张开散开牌堆')
    setPickedSnap([])
    if (thenSpread) {
      setTimeout(() => {
        if (phaseRef.current === 'gather') doSpread()
      }, 2200)
    }
  }, [goPhase, doSpread])

  // ── PICK: fist → pick random 1-5 cards from gathered pile ────────────────────

  // ── PICK: fist in SPREAD phase → pick 1-5 random cards ──────────────────────
  const doPick = useCallback(() => {
    if (phaseRef.current !== 'spread') return  // 只有散开时才能握拳选牌
    const now = Date.now()
    if (now - lastTrigger.current < COOLDOWN) return
    lastTrigger.current = now

    const n = Math.floor(Math.random() * 5) + 1

    const shuffled = [...cardsRef.current].sort(() => Math.random() - 0.5)
    const chosenIds = new Set(shuffled.slice(0, n).map(c => c.uid))

    let order = 0
    cardsRef.current = cardsRef.current.map(c => {
      if (chosenIds.has(c.uid)) {
        order++
        return { ...c, picked: true, pickOrder: order }
      }
      return { ...c, picked: false, pickOrder: 0 }
    })

    goPhase('selected')
    setHint('✦ 已选 ' + n + ' 张命运之牌  ·  握拳开始结算')
    syncPicked()
  }, [goPhase, syncPicked])

  // ── REVEAL: show result, countdown, then reset ────────────────────────────────

  const doReveal = useCallback(() => {
    if (phaseRef.current !== 'selected') return
    const now = Date.now()
    if (now - lastTrigger.current < COOLDOWN) return
    lastTrigger.current = now

    goPhase('reveal')
    setHint('命运揭晓')
    cdVal.current = 10
    setCountdown(10)

    if (cdTimer.current) clearInterval(cdTimer.current)
    cdTimer.current = setInterval(() => {
      cdVal.current -= 1
      setCountdown(cdVal.current)
      if (cdVal.current <= 0) {
        if (cdTimer.current) clearInterval(cdTimer.current)
        // Return picked cards to deck positions, then gather+spread
        cardsRef.current = cardsRef.current.map(c => ({
          ...c, picked: false, pickOrder: 0, returning: true,
        }))
        setPickedSnap([])
        setTimeout(() => {
          doGather(true)
        }, 800)
      }
    }, 1000)
  }, [goPhase, doGather])

  // ── Handle gesture ───────────────────────────────────────────────────────────

  const handleGesture = useCallback((g: Gesture) => {
    setGesture(g)
    const ph = phaseRef.current
    const now = Date.now()
    const cool = now - lastTrigger.current > COOLDOWN

    if (ph === 'loading' || ph === 'reveal') return

    if (ph === 'selected') {
      // Only fist allowed → reveal
      if (g === 'fist') doReveal()
      return
    }

    if (g === 'open' && cool) {
      doSpread(); lastTrigger.current = now
    } else if (g === 'close' && cool) {
      doGather(false); lastTrigger.current = now
    } else if (g === 'fist' && ph === 'spread') {
      // 散开状态下握拳 = 选牌
      doPick()
    }
  }, [doSpread, doGather, doPick, doReveal])

  // ── Canvas animation loop ────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = cardCvRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const frame = (ts: number) => {
      rafRef.current = requestAnimationFrame(frame)
      tRef.current = ts

      const vw = window.innerWidth
      const vh = window.innerHeight
      vwRef.current = vw
      vhRef.current = vh
      canvas.width = vw
      canvas.height = vh

      const zone = vh - SLOT_H - HINT_H
      const ph = phaseRef.current
      const cards = cardsRef.current
      ctx.clearRect(0, 0, vw, vh)
      if (!cards.length) return

      // Update card physics
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i]

        if (ph === 'spread' && !c.picked) {
          // Wander: apply small random force + lerp toward target
          c.vx += (Math.random() - 0.5) * WANDER_FORCE
          c.vy += (Math.random() - 0.5) * WANDER_FORCE
          // Gentle lerp toward target
          c.vx += (c.tx - c.x) * 0.001
          c.vy += (c.ty - c.y) * 0.001
          c.vx *= DAMPING
          c.vy *= DAMPING
          c.vrot += (c.trot - c.rot) * 0.002
          c.vrot *= 0.95
          c.x += c.vx
          c.y += c.vy
          c.rot += c.vrot
          // Wall bounce
          if (c.x < 0)          { c.x = 0; c.vx = Math.abs(c.vx) * WALL_BOUNCE }
          if (c.x > vw - CARD_W){ c.x = vw - CARD_W; c.vx = -Math.abs(c.vx) * WALL_BOUNCE }
          if (c.y < 0)          { c.y = 0; c.vy = Math.abs(c.vy) * WALL_BOUNCE }
          if (c.y > zone - CARD_H){ c.y = zone - CARD_H; c.vy = -Math.abs(c.vy) * WALL_BOUNCE }

        } else if (ph === 'gather' || ph === 'selected') {
          // Lerp to target
          const spd = ph === 'gather' ? LERP_GATHER : LERP_GATHER * 0.5
          c.x += (c.tx - c.x) * spd
          c.y += (c.ty - c.y) * spd
          c.rot += (c.trot - c.rot) * spd

        } else if (ph === 'reveal') {
          // Non-picked slowly drift to corners
          if (!c.picked) {
            c.x += (c.tx - c.x) * 0.03
            c.y += (c.ty - c.y) * 0.03
          }
        }
      }

      // Draw order: non-picked first, picked on top
      const nonPicked = cards.filter(c => !c.picked)
      const picked    = cards.filter(c => c.picked).sort((a, b) => a.pickOrder - b.pickOrder)

      const dimNonPicked = (ph === 'selected' || ph === 'reveal')

      nonPicked.forEach(c => {
        drawCard(ctx, c.x, c.y, c.rot, dimNonPicked ? 0.25 : 0.9, false, 0, ts, c.phase)
      })
      picked.forEach(c => {
        drawCard(ctx, c.x, c.y, c.rot, 1, true, c.pickOrder, ts, c.phase)
      })
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── MediaPipe init ───────────────────────────────────────────────────────────

  useEffect(() => {
    let camera: any = null, hands: any = null

    const load = async () => {
      const [{ Hands, HAND_CONNECTIONS }, { Camera }, { drawConnectors, drawLandmarks }] =
        await Promise.all([
          import('@mediapipe/hands'),
          import('@mediapipe/camera_utils'),
          import('@mediapipe/drawing_utils'),
        ])

      const video    = videoRef.current
      const hiddenCv = hiddenCvRef.current
      const preview  = previewRef.current
      if (!video || !hiddenCv) return

      const hCtx = hiddenCv.getContext('2d')!
      const pCtx = preview?.getContext('2d') || null

      hands = new Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` })
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.65, minTrackingConfidence: 0.55 })

      hands.onResults((res: any) => {
        hCtx.save()
        hCtx.clearRect(0, 0, hiddenCv.width, hiddenCv.height)
        hCtx.drawImage(res.image, 0, 0, hiddenCv.width, hiddenCv.height)

        // Mirror to preview
        if (pCtx && preview) {
          pCtx.save()
          pCtx.clearRect(0, 0, preview.width, preview.height)
          pCtx.translate(preview.width, 0)
          pCtx.scale(-1, 1)
          pCtx.drawImage(hiddenCv, 0, 0, preview.width, preview.height)
          if (res.multiHandLandmarks?.length > 0) {
            // Scale landmarks to preview size
            const lm = res.multiHandLandmarks[0].map((p: any) => ({
              x: (1 - p.x) * preview.width,
              y: p.y * preview.height,
              z: p.z,
            }))
            // Draw on pCtx directly
            const conn = HAND_CONNECTIONS as [number, number][]
            pCtx.strokeStyle = 'rgba(201,168,76,0.6)'
            pCtx.lineWidth = 1.5
            conn.forEach(([a, b]) => {
              pCtx.beginPath()
              pCtx.moveTo(lm[a].x, lm[a].y)
              pCtx.lineTo(lm[b].x, lm[b].y)
              pCtx.stroke()
            })
            lm.forEach((p: any) => {
              pCtx.beginPath()
              pCtx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
              pCtx.fillStyle = 'rgba(240,208,128,0.85)'
              pCtx.fill()
            })
          }
          pCtx.restore()
        }

        if (res.multiHandLandmarks?.length > 0) {
          const lm = res.multiHandLandmarks[0]
          drawConnectors(hCtx, lm, HAND_CONNECTIONS, { color: 'rgba(201,168,76,0.4)', lineWidth: 1.5 })
          drawLandmarks(hCtx, lm, { color: 'rgba(240,208,128,0.7)', lineWidth: 1, radius: 2 })
          handleGesture(smooth(classify(lm)))
        } else {
          smooth('unknown')
          setGesture('unknown')
        }
        hCtx.restore()
      })

      camera = new Camera(video, {
        onFrame: async () => { if (video) await hands.send({ image: video }) },
        width: 320, height: 240,
      })

      try {
        await camera.start()
      } catch {
        setCamError(true)
      }

      // Init deck
      const vw = window.innerWidth, vh = window.innerHeight
      vwRef.current = vw; vhRef.current = vh
      const deck = buildDeck()
      // 初始：牌从中心散开
      const cx = vw / 2, cy = (vh - SLOT_H - HINT_H) / 2
      deck.forEach(c => { c.x = cx + (Math.random()-0.5)*60; c.y = cy + (Math.random()-0.5)*60 })
      cardsRef.current = spreadTargets(deck, vw, vh)
      goPhase('spread')
      setHint('五指张开：牌面散开  ·  五指并拢：聚合洗牌  ·  握拳：选牌')
    }

    load()
    return () => {
      camera?.stop()
      hands?.close()
      if (cdTimer.current) clearInterval(cdTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Gesture label ────────────────────────────────────────────────────────────

  const GL: Record<Gesture, string> = {
    open: '✋ 张开', close: '🤲 并拢', fist: '✊ 握拳', unknown: '—',
  }

  const isReveal = phase === 'reveal'
  const countdownPct = countdown / 10

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.app}>
      {/* Starfield */}
      {STARS.map(s => (
        <div key={s.id} className={styles.star} style={{
          width: s.size, height: s.size,
          left: `${s.left}%`, top: `${s.top}%`,
          animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`,
        }} />
      ))}

      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={hiddenCvRef} width={320} height={240} style={{ display: 'none' }} />

      {/* Full-screen card canvas */}
      <canvas ref={cardCvRef} className={styles.cardCanvas} />

      {/* Camera preview — top right */}
      <div className={styles.preview}>
        <canvas ref={previewRef} className={styles.previewCv} width={160} height={120} />
        <div className={styles.gestureTag}>{GL[gesture]}</div>
      </div>

      {/* Cam error */}
      {camError && <div className={styles.camErr}>摄像头未启动</div>}

      {/* Loading */}
      {phase === 'loading' && (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <div className={styles.loadTitle}>ARCANA</div>
          <div className={styles.loadSub}>正在加载手势识别...</div>
        </div>
      )}

      {/* Hint bar */}
      <div className={styles.hintBar}>
        <span className={styles.hintText}>{hint}</span>
        {phase === 'reveal' && countdown > 0 && (
          <div className={styles.cdWrap}>
            <svg className={styles.cdRing} viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(201,168,76,0.15)" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke="#c9a84c" strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 15}`}
                strokeDashoffset={`${2 * Math.PI * 15 * (1 - countdownPct)}`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
                style={{ transition: 'stroke-dashoffset 0.9s linear' }}
              />
            </svg>
            <span className={styles.cdNum}>{countdown}</span>
          </div>
        )}
      </div>

      {/* Slot zone */}
      <div className={styles.slotZone}>
        <div className={styles.slots}>
          {Array.from({ length: 5 }).map((_, i) => {
            const card = pickedSnap[i] || null
            return (
              <div key={i} className={`${styles.slot} ${card ? styles.slotFilled : ''} ${card && isReveal ? styles.slotRevealed : ''}`}>
                {card ? (
                  <div className={styles.slotInner}>
                    <div className={styles.slotFront}>
                      <div className={styles.cSym}>{card.tarot.sym}</div>
                      <div className={styles.cName}>{card.tarot.name}</div>
                      <div className={styles.cNum}>{card.tarot.num}</div>
                      {isReveal && <div className={styles.cMeaning}>{card.tarot.meaning}</div>}
                    </div>
                    <div className={styles.slotBack} />
                  </div>
                ) : (
                  <div className={styles.slotEmpty}>
                    <span className={styles.slotI}>{['I','II','III','IV','V'][i]}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
