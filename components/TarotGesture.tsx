'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './TarotGesture.module.css'

// ─── Data ──────────────────────────────────────────────────────────────────────

const TAROT = [
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

type AppPhase = 'loading' | 'spread' | 'gather' | 'selecting' | 'countdown'
type GestureType = 'open' | 'close' | 'one' | 'two' | 'three' | 'four' | 'five' | 'fist' | 'unknown'

interface CardState {
  id: number
  tarot: typeof TAROT[number]
  tx: number; ty: number; rot: number
  animPhase: number
  picked: boolean
  pickOrder: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CARD_W = 54
const CARD_H = 82
const COOLDOWN = 1400
const HISTORY_LEN = 10
const FLOAT_SPEED = 0.0006
const FLOAT_AMP = 7
const SLOT_ZONE_H = 148
const HINT_H = 40

const STARS = Array.from({ length: 45 }, (_, i) => ({
  id: i,
  size: Math.random() * 2.5 + 0.5,
  left: Math.random() * 100,
  top: Math.random() * 100,
  delay: Math.random() * 4,
  dur: 2 + Math.random() * 4,
}))

// ─── Gesture Detection ─────────────────────────────────────────────────────────

function countUp(lm: { x: number; y: number; z: number }[]): number {
  const tips = [8, 12, 16, 20]
  const pips = [6, 10, 14, 18]
  return tips.filter((t, i) => lm[t].y < lm[pips[i]].y).length
}

function thumbUp(lm: { x: number; y: number; z: number }[]): boolean {
  return Math.abs(lm[4].x - lm[2].x) > 0.055
}

function fingerSpread(lm: { x: number; y: number; z: number }[]): number {
  const tips = [8, 12, 16, 20]
  let sum = 0
  for (let i = 0; i < tips.length - 1; i++) {
    const dx = lm[tips[i]].x - lm[tips[i + 1]].x
    const dy = lm[tips[i]].y - lm[tips[i + 1]].y
    sum += Math.sqrt(dx * dx + dy * dy)
  }
  return sum
}

function detectGesture(lm: { x: number; y: number; z: number }[]): GestureType {
  const up = countUp(lm)
  const th = thumbUp(lm)
  const spread = fingerSpread(lm)

  if (up === 0 && !th) return 'fist'

  if (up === 4 && th) {
    if (spread > 0.20) return 'open'   // 五指张开
    if (spread < 0.10) return 'close'  // 五指并拢
    return 'five'                       // 五根手指（中间状态）
  }

  if (!th) {
    if (up === 1) return 'one'
    if (up === 2) return 'two'
    if (up === 3) return 'three'
    if (up === 4) return 'four'
  }

  return 'unknown'
}

// ─── Layout ────────────────────────────────────────────────────────────────────

function spreadPos(idx: number, vw: number, vh: number) {
  const zone = vh - SLOT_ZONE_H - HINT_H
  const margin = 28
  const cols = 11
  const rows = 2
  const col = idx % cols
  const row = Math.floor(idx / cols)
  const gx = margin + (col / (cols - 1)) * (vw - margin * 2 - CARD_W)
  const gy = margin + (row / (rows - 1)) * (zone - margin * 2 - CARD_H)
  return {
    tx: gx + (Math.random() - 0.5) * 30,
    ty: gy + (Math.random() - 0.5) * 25,
    rot: (Math.random() - 0.5) * 65,
  }
}

function pilePos(vw: number, vh: number) {
  const zone = vh - SLOT_ZONE_H - HINT_H
  return {
    tx: vw / 2 - CARD_W / 2 + (Math.random() - 0.5) * 50,
    ty: zone * 0.42 + (Math.random() - 0.5) * 50,
    rot: (Math.random() - 0.5) * 30,
  }
}

function buildDeck(vw: number, vh: number): CardState[] {
  return TAROT.map((tarot, id) => ({
    id, tarot,
    picked: false, pickOrder: 0,
    animPhase: Math.random() * Math.PI * 2,
    ...spreadPos(id, vw, vh),
  }))
}

// ─── Canvas roundRect ──────────────────────────────────────────────────────────

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

// ─── Main Component ────────────────────────────────────────────────────────────

export default function TarotGesture() {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const camCvRef    = useRef<HTMLCanvasElement>(null)  // mediapipe hidden canvas
  const cardCvRef   = useRef<HTMLCanvasElement>(null)  // fullscreen card canvas
  const previewRef  = useRef<HTMLCanvasElement>(null)  // small cam preview

  const [phase, setPhase]               = useState<AppPhase>('loading')
  const [camError, setCamError]         = useState(false)
  const [gesture, setGesture]           = useState<GestureType>('unknown')
  const [statusMsg, setStatusMsg]       = useState('正在加载...')
  const [countdown, setCountdown]       = useState(10)
  const [pickedSnap, setPickedSnap]     = useState<CardState[]>([])

  const phaseRef          = useRef<AppPhase>('loading')
  const cardsRef          = useRef<CardState[]>([])
  const lastGestureTime   = useRef(0)
  const histRef           = useRef<GestureType[]>([])
  const rafRef            = useRef(0)
  const cdTimerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const cdValueRef        = useRef(10)
  const vwRef             = useRef(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const vhRef             = useRef(typeof window !== 'undefined' ? window.innerHeight : 800)

  // ── helpers ─────────────────────────────────────────────────────────────────

  const goPhase = useCallback((p: AppPhase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const syncPicked = useCallback(() => {
    const snap = cardsRef.current
      .filter(c => c.picked)
      .sort((a, b) => a.pickOrder - b.pickOrder)
    setPickedSnap([...snap])
  }, [])

  // ── smooth gesture ───────────────────────────────────────────────────────────

  const smooth = useCallback((g: GestureType): GestureType => {
    const h = histRef.current
    h.push(g)
    if (h.length > HISTORY_LEN) h.shift()
    const cnt: Partial<Record<GestureType, number>> = {}
    h.forEach(x => { cnt[x] = (cnt[x] || 0) + 1 })
    let best: GestureType = 'unknown', bestN = 0
    ;(Object.entries(cnt) as [GestureType, number][]).forEach(([k, v]) => {
      if (v > bestN) { best = k as GestureType; bestN = v }
    })
    return bestN >= Math.floor(HISTORY_LEN * 0.55) ? best : 'unknown'
  }, [])

  // ── spread ───────────────────────────────────────────────────────────────────

  const doSpread = useCallback(() => {
    const vw = vwRef.current, vh = vhRef.current
    cardsRef.current = buildDeck(vw, vh)
    goPhase('spread')
    setStatusMsg('五指张开散牌  ·  五指并拢洗牌  ·  伸出 1-5 根手指选牌')
    setPickedSnap([])
  }, [goPhase])

  // ── gather ───────────────────────────────────────────────────────────────────

  const doGather = useCallback(() => {
    const vw = vwRef.current, vh = vhRef.current
    cardsRef.current = cardsRef.current.map(c => ({
      ...c, picked: false, pickOrder: 0, ...pilePos(vw, vh),
    }))
    goPhase('gather')
    setStatusMsg('牌堆聚合，重新洗牌中...')
    setPickedSnap([])
    setTimeout(() => {
      if (phaseRef.current === 'gather') doSpread()
    }, 1800)
  }, [goPhase, doSpread])

  // ── pick N ───────────────────────────────────────────────────────────────────

  const doPick = useCallback((n: number) => {
    const now = Date.now()
    if (now - lastGestureTime.current < COOLDOWN) return
    if (phaseRef.current !== 'spread' && phaseRef.current !== 'selecting') return

    const available = cardsRef.current
    const shuffled = [...available].sort(() => Math.random() - 0.5)
    const chosen = new Set(shuffled.slice(0, n).map(c => c.id))

    cardsRef.current = cardsRef.current.map(c => ({
      ...c,
      picked: chosen.has(c.id),
      pickOrder: chosen.has(c.id)
        ? shuffled.findIndex(s => s.id === c.id) + 1
        : 0,
    }))

    goPhase('selecting')
    setStatusMsg(`已选 ${n} 张牌  ·  握拳开始结算  ·  继续比划可更换`)
    syncPicked()
    lastGestureTime.current = now
  }, [goPhase, syncPicked])

  // ── reveal / countdown ───────────────────────────────────────────────────────

  const doReveal = useCallback(() => {
    const now = Date.now()
    if (now - lastGestureTime.current < COOLDOWN) return
    if (phaseRef.current !== 'selecting') return
    const picked = cardsRef.current.filter(c => c.picked)
    if (picked.length === 0) return

    lastGestureTime.current = now
    goPhase('countdown')
    setStatusMsg('命运揭晓')
    cdValueRef.current = 10
    setCountdown(10)
    if (cdTimerRef.current) clearInterval(cdTimerRef.current)
    cdTimerRef.current = setInterval(() => {
      cdValueRef.current -= 1
      setCountdown(cdValueRef.current)
      if (cdValueRef.current <= 0) {
        if (cdTimerRef.current) clearInterval(cdTimerRef.current)
        doSpread()
      }
    }, 1000)
  }, [goPhase, doSpread])

  // ── handle gesture ───────────────────────────────────────────────────────────

  const handleGesture = useCallback((g: GestureType) => {
    setGesture(g)
    const ph = phaseRef.current
    if (ph === 'loading' || ph === 'countdown' || ph === 'gather') return
    const now = Date.now()

    if (g === 'open' && now - lastGestureTime.current > COOLDOWN) {
      doSpread(); lastGestureTime.current = now
    } else if (g === 'close' && now - lastGestureTime.current > COOLDOWN) {
      doGather(); lastGestureTime.current = now
    } else if (g === 'fist') {
      doReveal()
    } else if (ph === 'spread' || ph === 'selecting') {
      const map: Partial<Record<GestureType, number>> = {
        one: 1, two: 2, three: 3, four: 4, five: 5,
      }
      const n = map[g]
      if (n) doPick(n)
    }
  }, [doSpread, doGather, doReveal, doPick])

  // ── Canvas render loop ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = cardCvRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let t = 0

    const drawOne = (card: CardState, alpha: number, glowing: boolean) => {
      const fx = Math.sin(t * FLOAT_SPEED + card.animPhase) * FLOAT_AMP
      const fy = Math.cos(t * FLOAT_SPEED * 0.73 + card.animPhase + 1.2) * FLOAT_AMP * 0.55
      const rOff = Math.sin(t * FLOAT_SPEED * 0.45 + card.animPhase) * 1.8
      const x = card.tx + fx
      const y = card.ty + fy
      const r = (card.rot + rOff) * Math.PI / 180

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(x + CARD_W / 2, y + CARD_H / 2)
      ctx.rotate(r)

      if (glowing) {
        ctx.shadowColor = 'rgba(201,168,76,0.85)'
        ctx.shadowBlur = 22
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.55)'
        ctx.shadowBlur = 7
        ctx.shadowOffsetY = 3
      }

      // Card fill
      const g2 = ctx.createLinearGradient(-CARD_W / 2, -CARD_H / 2, CARD_W / 2, CARD_H / 2)
      if (glowing) {
        g2.addColorStop(0, '#2b1a60')
        g2.addColorStop(1, '#190f40')
      } else {
        g2.addColorStop(0, '#1f1347')
        g2.addColorStop(1, '#130d30')
      }
      ctx.fillStyle = g2
      rrect(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5)
      ctx.fill()

      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

      // Outer border
      ctx.strokeStyle = glowing ? '#c9a84c' : '#6b4fbb'
      ctx.lineWidth = glowing ? 2 : 1.5
      rrect(ctx, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5)
      ctx.stroke()

      // Inner border
      ctx.strokeStyle = glowing ? 'rgba(240,208,128,0.45)' : 'rgba(201,168,76,0.2)'
      ctx.lineWidth = 0.8
      rrect(ctx, -CARD_W / 2 + 4, -CARD_H / 2 + 4, CARD_W - 8, CARD_H - 8, 3)
      ctx.stroke()

      // Center symbol
      ctx.fillStyle = glowing ? 'rgba(201,168,76,0.65)' : 'rgba(201,168,76,0.28)'
      ctx.font = '17px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('✦', 0, 0)

      // Pick order badge
      if (glowing && card.pickOrder > 0) {
        ctx.fillStyle = '#c9a84c'
        ctx.beginPath()
        ctx.arc(-CARD_W / 2 + 10, -CARD_H / 2 + 10, 9, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#0a0614'
        ctx.font = 'bold 10px monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(card.pickOrder), -CARD_W / 2 + 10, -CARD_H / 2 + 10)
      }

      ctx.restore()
    }

    const frame = () => {
      rafRef.current = requestAnimationFrame(frame)
      t += 16

      const vw = window.innerWidth
      const vh = window.innerHeight
      vwRef.current = vw
      vhRef.current = vh
      canvas.width = vw
      canvas.height = vh

      ctx.clearRect(0, 0, vw, vh)

      const cards = cardsRef.current
      if (!cards.length) return

      const ph = phaseRef.current
      const nonPicked = cards.filter(c => !c.picked)
      const picked = cards.filter(c => c.picked).sort((a, b) => a.pickOrder - b.pickOrder)

      const spreading = ph === 'spread'
      const selecting = ph === 'selecting' || ph === 'countdown'

      nonPicked.forEach(c => drawOne(c, selecting ? 0.35 : 1, false))
      picked.forEach(c => drawOne(c, 1, true))
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── MediaPipe ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let camera: any = null, hands: any = null

    const load = async () => {
      const [{ Hands, HAND_CONNECTIONS }, { Camera }, { drawConnectors, drawLandmarks }] =
        await Promise.all([
          import('@mediapipe/hands'),
          import('@mediapipe/camera_utils'),
          import('@mediapipe/drawing_utils'),
        ])

      const video = videoRef.current
      const camCv = camCvRef.current
      const preview = previewRef.current
      if (!video || !camCv) return
      const ctx = camCv.getContext('2d')!
      const pCtx = preview?.getContext('2d') || null

      hands = new Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` })
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.65, minTrackingConfidence: 0.55 })
      hands.onResults((res: any) => {
        ctx.save()
        ctx.clearRect(0, 0, camCv.width, camCv.height)
        ctx.drawImage(res.image, 0, 0, camCv.width, camCv.height)

        // Mirror draw to preview
        if (pCtx && preview) {
          pCtx.save()
          pCtx.clearRect(0, 0, preview.width, preview.height)
          pCtx.translate(preview.width, 0)
          pCtx.scale(-1, 1)
          pCtx.drawImage(camCv, 0, 0, preview.width, preview.height)
          pCtx.restore()
        }

        if (res.multiHandLandmarks?.length > 0) {
          const lm = res.multiHandLandmarks[0]
          drawConnectors(ctx, lm, HAND_CONNECTIONS, { color: 'rgba(201,168,76,0.5)', lineWidth: 1.5 })
          drawLandmarks(ctx, lm, { color: 'rgba(240,208,128,0.7)', lineWidth: 1, radius: 2 })
          handleGesture(smooth(detectGesture(lm)))
        } else {
          smooth('unknown')
          setGesture('unknown')
          if (pCtx && preview) {
            pCtx.save()
            pCtx.translate(preview.width, 0)
            pCtx.scale(-1, 1)
            pCtx.drawImage(camCv, 0, 0, preview.width, preview.height)
            pCtx.restore()
          }
        }
        ctx.restore()
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

      // Init cards
      const vw = window.innerWidth, vh = window.innerHeight
      vwRef.current = vw; vhRef.current = vh
      cardsRef.current = buildDeck(vw, vh)
      goPhase('spread')
      setStatusMsg('五指张开散牌  ·  五指并拢洗牌  ·  伸出 1-5 根手指选牌')
    }

    load()
    return () => {
      camera?.stop()
      hands?.close()
      if (cdTimerRef.current) clearInterval(cdTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Gesture label ─────────────────────────────────────────────────────────────

  const GLABELS: Record<GestureType, string> = {
    open: '✋ 散开', close: '🤲 并拢',
    one: '☝️ 选1', two: '✌️ 选2', three: '🤟 选3', four: '🖖 选4', five: '🖐 选5',
    fist: '✊ 结算', unknown: '—',
  }

  const isRevealing = phase === 'countdown'

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.app}>
      {/* Stars */}
      {STARS.map(s => (
        <div key={s.id} className={styles.star} style={{
          width: s.size, height: s.size,
          left: `${s.left}%`, top: `${s.top}%`,
          animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s`,
        }} />
      ))}

      <video ref={videoRef} style={{ display: 'none' }} />
      <canvas ref={camCvRef} width={320} height={240} style={{ display: 'none' }} />

      {/* Full-screen card canvas */}
      <canvas ref={cardCvRef} className={styles.cardCanvas} />

      {/* Cam preview — top-right */}
      <div className={styles.camPreviewWrap}>
        <canvas ref={previewRef} className={styles.camPreview} width={160} height={120} />
        <div className={styles.gestureLabel}>{GLABELS[gesture]}</div>
      </div>

      {/* Error badge */}
      {camError && <div className={styles.camError}>摄像头未启动</div>}

      {/* Loading */}
      {phase === 'loading' && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <div className={styles.loadTitle}>ARCANA</div>
          <div className={styles.loadHint}>正在加载手势识别...</div>
        </div>
      )}

      {/* Hint bar — just above slot zone */}
      <div className={styles.hintBar}>
        <span className={styles.hintText}>{statusMsg}</span>
        {phase === 'countdown' && (
          <span className={styles.cdBadge}>{countdown}</span>
        )}
      </div>

      {/* Slot zone — bottom */}
      <div className={styles.slotZone}>
        <div className={styles.slots}>
          {Array.from({ length: 5 }).map((_, i) => {
            const card = pickedSnap[i] || null
            return (
              <div
                key={i}
                className={`${styles.slot} ${card ? styles.slotFilled : ''} ${card && isRevealing ? styles.slotRevealed : ''}`}
              >
                {card ? (
                  <div className={styles.slotInner}>
                    <div className={styles.slotFront}>
                      <div className={styles.cardSym}>{card.tarot.sym}</div>
                      <div className={styles.cardName}>{card.tarot.name}</div>
                      <div className={styles.cardNum}>{card.tarot.num}</div>
                      {isRevealing && <div className={styles.cardMeaning}>{card.tarot.meaning}</div>}
                    </div>
                    <div className={styles.slotBack} />
                  </div>
                ) : (
                  <div className={styles.slotEmpty}>
                    <span className={styles.slotIdx}>{['I','II','III','IV','V'][i]}</span>
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
