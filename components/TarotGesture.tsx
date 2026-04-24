'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import styles from './TarotGesture.module.css'

// ─── Data ─────────────────────────────────────────────────────────────────────

const TAROT = [
  { name: '愚者',   num: '0',    sym: '🌟' },
  { name: '魔术师', num: 'I',    sym: '⚡' },
  { name: '女祭司', num: 'II',   sym: '🌙' },
  { name: '女皇',   num: 'III',  sym: '🌸' },
  { name: '皇帝',   num: 'IV',   sym: '👑' },
  { name: '教皇',   num: 'V',    sym: '🔱' },
  { name: '恋人',   num: 'VI',   sym: '❤️' },
  { name: '战车',   num: 'VII',  sym: '🏛️' },
  { name: '力量',   num: 'VIII', sym: '🦁' },
  { name: '隐士',   num: 'IX',   sym: '🕯️' },
  { name: '命运轮', num: 'X',    sym: '☯️' },
  { name: '正义',   num: 'XI',   sym: '⚖️' },
  { name: '倒吊人', num: 'XII',  sym: '🔮' },
  { name: '死神',   num: 'XIII', sym: '🌑' },
  { name: '节制',   num: 'XIV',  sym: '🌊' },
  { name: '恶魔',   num: 'XV',   sym: '🔥' },
  { name: '高塔',   num: 'XVI',  sym: '⛈️' },
  { name: '星星',   num: 'XVII', sym: '✨' },
  { name: '月亮',   num: 'XVIII',sym: '🌕' },
  { name: '太阳',   num: 'XIX',  sym: '☀️' },
  { name: '审判',   num: 'XX',   sym: '🎺' },
  { name: '世界',   num: 'XXI',  sym: '🌍' },
]

const SLOT_LABELS = ['I', 'II', 'III', 'IV', 'V']
const TW = 640
const TH = 380
const CENTER = { x: TW / 2, y: TH / 2 - 20 }
const COOLDOWN = 1200
const HISTORY_LEN = 8

// ─── Types ────────────────────────────────────────────────────────────────────

interface CardState {
  id: number
  tarot: (typeof TAROT)[number]
  x: number
  y: number
  rot: number
  picked: boolean
}

type AppPhase = 'loading' | 'idle' | 'spreading' | 'gathering' | 'revealing'
type GestureType = 'palm' | 'fist' | 'grab' | 'unknown'

interface SlotCard {
  tarot: (typeof TAROT)[number]
  revealed: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spreadLayout(idx: number): { x: number; y: number; rot: number } {
  const cols = 11
  const rows = 2
  const totalW = TW - 80
  const totalH = TH * 0.65
  const col = idx % cols
  const row = Math.floor(idx / cols)
  return {
    x: 40 + (col / (cols - 1)) * totalW,
    y: 50 + row * (totalH / (rows + 0.5)) + (Math.random() - 0.5) * 20,
    rot: (Math.random() - 0.5) * 50,
  }
}

function pileLayout(): { x: number; y: number; rot: number } {
  return {
    x: CENTER.x + (Math.random() - 0.5) * 35,
    y: CENTER.y + (Math.random() - 0.5) * 35,
    rot: (Math.random() - 0.5) * 25,
  }
}

function buildDeck(): CardState[] {
  return TAROT.map((tarot, id) => ({
    id,
    tarot,
    picked: false,
    ...spreadLayout(id),
  }))
}

function detectGesture(landmarks: { x: number; y: number; z: number }[]): GestureType {
  const tips = [8, 12, 16, 20]
  const pips = [6, 10, 14, 18]

  let upCount = 0
  tips.forEach((tip, i) => {
    if (landmarks[tip].y < landmarks[pips[i]].y) upCount++
  })

  const thumbExtended = Math.abs(landmarks[4].x - landmarks[2].x) > 0.05

  if (upCount >= 3 && thumbExtended) return 'palm'
  if (upCount === 0 && !thumbExtended) return 'fist'

  const wrist = landmarks[0]
  const middleTip = landmarks[12]
  const middleMcp = landmarks[9]
  const handHeight = Math.abs(wrist.y - middleMcp.y)
  const middleCurl = (middleTip.y - middleMcp.y) / (handHeight || 0.01)

  if (upCount <= 2 && middleCurl > -0.3 && !thumbExtended) return 'grab'

  return 'unknown'
}

// ─── Stars component ──────────────────────────────────────────────────────────

function Stars() {
  const stars = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    size: Math.random() * 2 + 1,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 2 + Math.random() * 3,
  }))
  return (
    <>
      {stars.map((s) => (
        <div
          key={s.id}
          className={styles.star}
          style={{
            width: s.size,
            height: s.size,
            left: `${s.left}%`,
            top: `${s.top}%`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </>
  )
}

// ─── TarotCard component ──────────────────────────────────────────────────────

function TarotCard({ card }: { card: CardState }) {
  return (
    <div
      className={`${styles.tarotCard} ${card.picked ? styles.tarotCardPicked : ''}`}
      style={{
        left: card.x - 26,
        top: card.y - 40,
        transform: `rotate(${card.rot}deg)`,
      }}
    />
  )
}

// ─── Slot component ───────────────────────────────────────────────────────────

function Slot({ index, slot }: { index: number; slot: SlotCard | null }) {
  return (
    <div className={`${styles.slot} ${slot?.revealed ? styles.slotRevealed : ''}`}>
      {slot ? (
        <div className={styles.slotInner}>
          <div className={styles.slotFront}>
            <div className={styles.cardSymbol}>{slot.tarot.sym}</div>
            <div className={styles.cardName}>{slot.tarot.name}</div>
            <div className={styles.cardNum}>{slot.tarot.num}</div>
          </div>
          <div className={styles.slotBack} />
        </div>
      ) : (
        <span className={styles.slotNum}>{SLOT_LABELS[index]}</span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TarotGesture() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [phase, setPhase] = useState<AppPhase>('loading')
  const [cards, setCards] = useState<CardState[]>(() => buildDeck())
  const [slots, setSlots] = useState<(SlotCard | null)[]>([null, null, null, null, null])
  const [gestureIcon, setGestureIcon] = useState('—')
  const [statusHtml, setStatusHtml] = useState('等待手势识别...')
  const [activeGuide, setActiveGuide] = useState<string>('')
  const [showReveal, setShowReveal] = useState(false)
  const [camError, setCamError] = useState(false)

  // Mutable refs — avoid stale closures in mediapipe callback
  const cardsRef = useRef(cards)
  const slotsRef = useRef(slots)
  const phaseRef = useRef(phase)
  const pickedCountRef = useRef(0)
  const lastGestureTimeRef = useRef(0)
  const gestureHistoryRef = useRef<GestureType[]>([])

  useEffect(() => { cardsRef.current = cards }, [cards])
  useEffect(() => { slotsRef.current = slots }, [slots])
  useEffect(() => { phaseRef.current = phase }, [phase])

  // ── Status helpers ──────────────────────────────────────────────────────────

  const setStatus = useCallback((icon: string, text: string, guide: string) => {
    setGestureIcon(icon)
    setStatusHtml(text)
    setActiveGuide(guide)
  }, [])

  // ── Layout helpers ──────────────────────────────────────────────────────────

  const applyLayout = useCallback((mode: 'spread' | 'pile') => {
    setCards((prev) =>
      prev.map((c, i) =>
        c.picked ? c : { ...c, ...(mode === 'spread' ? spreadLayout(i) : pileLayout()) }
      )
    )
  }, [])

  // ── Grab ────────────────────────────────────────────────────────────────────

  const triggerGrab = useCallback(() => {
    if (pickedCountRef.current >= 5) return
    const available = cardsRef.current.filter((c) => !c.picked)
    if (available.length === 0) return

    const target = available[Math.floor(Math.random() * available.length)]
    const slotIdx = pickedCountRef.current

    setCards((prev) => prev.map((c) => (c.id === target.id ? { ...c, picked: true } : c)))
    setSlots((prev) => {
      const next = [...prev]
      next[slotIdx] = { tarot: target.tarot, revealed: false }
      return next
    })

    pickedCountRef.current += 1
    const n = pickedCountRef.current
    setStatus('🤏', `已抓取 <b>${n}</b> 张牌${n < 5 ? '，可继续抓取' : '，握拳开奖！'}`, 'grab')
  }, [setStatus])

  // ── Reveal ──────────────────────────────────────────────────────────────────

  const revealAll = useCallback(() => {
    setShowReveal(true)
    setTimeout(() => setShowReveal(false), 2500)
    slotsRef.current.forEach((_, i) => {
      setTimeout(() => {
        setSlots((prev) => {
          const next = [...prev]
          if (next[i]) next[i] = { ...next[i]!, revealed: true }
          return next
        })
      }, i * 250)
    })
  }, [])

  // ── Reset ───────────────────────────────────────────────────────────────────

  const resetAll = useCallback(() => {
    pickedCountRef.current = 0
    setCards(buildDeck())
    setSlots([null, null, null, null, null])
    setPhase('spreading')
    setStatus('✋', '牌局已重置，牌面散开', 'palm')
  }, [setStatus])

  // ── Smooth gesture ──────────────────────────────────────────────────────────

  const smoothGesture = useCallback((g: GestureType): GestureType => {
    const hist = gestureHistoryRef.current
    hist.push(g)
    if (hist.length > HISTORY_LEN) hist.shift()
    const counts: Record<string, number> = {}
    hist.forEach((x) => (counts[x] = (counts[x] || 0) + 1))
    let best: GestureType = 'unknown'
    let bestN = 0
    ;(Object.entries(counts) as [GestureType, number][]).forEach(([k, v]) => {
      if (v > bestN) { best = k; bestN = v }
    })
    return bestN >= Math.floor(HISTORY_LEN * 0.6) ? best : 'unknown'
  }, [])

  // ── Handle gesture ──────────────────────────────────────────────────────────

  const handleGesture = useCallback(
    (gesture: GestureType) => {
      const now = Date.now()
      if (now - lastGestureTimeRef.current < COOLDOWN) return

      if (gesture === 'palm') {
        setPhase('spreading')
        applyLayout('spread')
        setStatus('✋', '牌面散开，随意<b>洗牌</b>中...', 'palm')
        lastGestureTimeRef.current = now
      } else if (gesture === 'fist') {
        if (phaseRef.current === 'revealing') {
          resetAll()
          lastGestureTimeRef.current = now
        } else if (pickedCountRef.current > 0) {
          setPhase('revealing')
          revealAll()
          setStatus('✊', '<b>命运揭晓！</b>', 'fist')
          lastGestureTimeRef.current = now
          setTimeout(() => setStatus('—', '再次握拳重置牌局', ''), 3000)
        } else {
          setPhase('gathering')
          applyLayout('pile')
          setStatus('✊', '牌堆<b>聚合</b>，准备抓取', 'fist')
          lastGestureTimeRef.current = now
        }
      } else if (gesture === 'grab') {
        if (phaseRef.current !== 'revealing') {
          triggerGrab()
          lastGestureTimeRef.current = now
        }
      }
    },
    [applyLayout, resetAll, revealAll, setStatus, triggerGrab]
  )

  // ── MediaPipe init ──────────────────────────────────────────────────────────

  useEffect(() => {
    let camera: any = null
    let handsInstance: any = null

    const loadMediaPipe = async () => {
      // Dynamic import — mediapipe requires browser environment
      const [{ Hands, HAND_CONNECTIONS }, { Camera }, { drawConnectors, drawLandmarks }] =
        await Promise.all([
          import('@mediapipe/hands'),
          import('@mediapipe/camera_utils'),
          import('@mediapipe/drawing_utils'),
        ])

      const videoEl = videoRef.current
      const canvasEl = canvasRef.current
      if (!videoEl || !canvasEl) return
      const ctx = canvasEl.getContext('2d')!

      handsInstance = new Hands({
        locateFile: (f: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      })

      handsInstance.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      })

      handsInstance.onResults((results: any) => {
        ctx.save()
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height)
        ctx.drawImage(results.image, 0, 0, canvasEl.width, canvasEl.height)

        if (results.multiHandLandmarks?.length > 0) {
          const lm = results.multiHandLandmarks[0]
          drawConnectors(ctx, lm, HAND_CONNECTIONS, {
            color: 'rgba(201,168,76,0.6)',
            lineWidth: 2,
          })
          drawLandmarks(ctx, lm, {
            color: 'rgba(240,208,128,0.8)',
            lineWidth: 1,
            radius: 3,
          })
          const raw = detectGesture(lm)
          const smoothed = smoothGesture(raw)
          handleGesture(smoothed)
        } else {
          smoothGesture('unknown')
        }
        ctx.restore()
      })

      camera = new Camera(videoEl, {
        onFrame: async () => {
          if (videoRef.current) await handsInstance.send({ image: videoEl })
        },
        width: TW,
        height: TH,
      })

      try {
        await camera.start()
        setPhase('spreading')
        setStatus('✋', '牌面已散开，尝试<b>手势</b>吧', 'palm')
      } catch {
        setCamError(true)
        setPhase('idle')
      }
    }

    loadMediaPipe()

    return () => {
      camera?.stop()
      handsInstance?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.app}>
      <Stars />

      {/* Loading overlay */}
      {phase === 'loading' && (
        <div className={styles.loadingOverlay}>
          {camError ? (
            <>
              <div className={styles.loadingTitle}>无法访问摄像头</div>
              <div className={styles.loadingHint}>请允许摄像头权限后刷新页面</div>
            </>
          ) : (
            <>
              <div className={styles.spinner} />
              <div className={styles.loadingTitle}>ARCANA</div>
              <div className={styles.loadingHint}>正在加载手势识别模型...</div>
            </>
          )}
        </div>
      )}

      {/* Reveal overlay */}
      <div className={`${styles.revealOverlay} ${showReveal ? styles.revealActive : ''}`}>
        <div className={styles.revealMsg}>命运揭晓</div>
      </div>

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>✦ ARCANA ✦</h1>
      </div>

      {/* Status bar */}
      <div className={styles.statusBar}>
        <span className={styles.gestureIcon}>{gestureIcon}</span>
        <span
          className={styles.statusText}
          dangerouslySetInnerHTML={{ __html: statusHtml }}
        />
      </div>

      {/* Main area */}
      <div className={styles.main}>
        {/* Camera + card table */}
        <div className={styles.tableArea}>
          <video ref={videoRef} style={{ display: 'none' }} />
          <canvas
            ref={canvasRef}
            className={styles.camCanvas}
            width={TW}
            height={TH}
          />
          {/* Card overlay */}
          <div className={styles.cardTable}>
            {cards.map((card) => (
              <TarotCard key={card.id} card={card} />
            ))}
          </div>
        </div>

        {/* Guide panel */}
        <div className={styles.guidePanel}>
          {[
            { key: 'palm', icon: '✋', label: '张开手掌\n牌散开' },
            { key: 'fist', icon: '✊', label: '握拳\n聚合/开奖' },
            { key: 'grab', icon: '🤏', label: '半握拳\n抓取一张' },
          ].map(({ key, icon, label }) => (
            <div
              key={key}
              className={`${styles.guideItem} ${activeGuide === key ? styles.guideActive : ''}`}
            >
              <div className={styles.guideIcon}>{icon}</div>
              <div className={styles.guideLabel}>
                {label.split('\n').map((l, i) => (
                  <span key={i}>
                    {l}
                    {i === 0 && <br />}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Slots */}
      <div className={styles.slotsSection}>
        <div className={styles.slotsLabel}>YOUR CARDS</div>
        <div className={styles.slots}>
          {slots.map((slot, i) => (
            <Slot key={i} index={i} slot={slot} />
          ))}
        </div>
      </div>
    </div>
  )
}
