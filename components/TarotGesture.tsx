"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GestureRecognizer, FilesetResolver } from "@mediapipe/tasks-vision";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// --- 预设数据与连接图 ---
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
]as [number, number][];

const TAROT_NAMES = ["愚者", "魔术师", "女祭司", "女皇", "皇帝", "教皇", "恋人", "战车", "力量", "隐士", "命运之轮", "正义", "倒吊人", "死神", "节制", "恶魔", "高塔", "星星", "月亮", "太阳", "审判", "世界"];
const generateCards = () => {
  return Array.from({ length: 100 }).map((_, i) => ({
    id: i,
    name: TAROT_NAMES[i % TAROT_NAMES.length],
    image: `https://via.placeholder.com/60x90/4B0082/FFFFFF?text=${encodeURIComponent(TAROT_NAMES[i % TAROT_NAMES.length])}`,
    baseX: 300, baseY: 200, 
    noiseX: 0, noiseY: 0, noiseRot: 0, 
    isPicked: false,
    slotIndex: -1
  }));
};

// 官方手势中文映射字典，用于 UI 显示
const GESTURE_MAP = {
  "Open_Palm": "🖐️ 张开手掌",
  "Closed_Fist": "✊ 握拳",
  "ILoveYou": "🤟 爱你",
  "Pointing_Up": "☝️ 单指",
  "Thumb_Up": "👍 点赞",
  "Thumb_Down": "👎 踩",
  "Victory": "✌️ 胜利",
  "None": "🤔 未知"
};

export default function UltimateTarotFlow() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // MediaPipe 相关 Ref
  const recognizerRef = useRef(null);
  const requestRef = useRef(null);

  const [isModelLoaded, setIsModelLoaded] = useState(false);

  const [gameState, setGameState] = useState({
    appState: 'spread', 
    cards: [],
    statusText: "正在初始化模型，请稍候...",
    gestureText: "等待手势"
  });
  
  const stateRef = useRef(gameState);
  useEffect(() => { stateRef.current = gameState; }, [gameState]);

  const pickTimerRef = useRef(null);
  const revealTimerRef = useRef(null);
  const gestureCooldownRef = useRef(0);

  // --- 1. 卡牌游离动画 ---
  useEffect(() => {
    const driftInterval = setInterval(() => {
      setGameState(prev => {
        if (prev.appState === 'revealed') return prev; 
        return {
          ...prev,
          cards: prev.cards.map(c => c.isPicked ? c : {
            ...c,
            noiseX: (Math.random() - 0.5) * 40,
            noiseY: (Math.random() - 0.5) * 40,
            noiseRot: (Math.random() - 0.5) * 30
          })
        };
      });
    }, 2000);
    return () => clearInterval(driftInterval);
  }, []);

  // --- 2. 状态机动作逻辑 ---
  const doSpread = useCallback(() => {
    setGameState(prev => ({
      ...prev, 
      appState: 'spread', 
      statusText: "🖐️ 牌已散开。请比出【🤟爱你】手势抽卡，或【✊握拳】聚合。",
      cards: prev.cards.map(c => c.isPicked ? c : {
        ...c,
        baseX: 40 + Math.random() * 560, 
        baseY: 20 + Math.random() * 320, 
      })
    }));
  }, []);

  const doGather = useCallback((isReset = false) => {
    setGameState(prev => {
      const resetCards = isReset ? prev.cards.map(c => ({...c, isPicked: false, slotIndex: -1})) : prev.cards;
      return {
        ...prev, 
        appState: 'gathered', 
        statusText: isReset ? "♻️ 洗牌中..." : "✊ 牌已聚合。请【🖐️张开】手掌散开后再抽卡。",
        cards: resetCards.map(c => c.isPicked ? c : {
          ...c,
          baseX: 320 + (Math.random() - 0.5) * 120, 
          baseY: 200 + (Math.random() - 0.5) * 120,
        })
      };
    });
  }, []);

  const doPick = useCallback(() => {
    setGameState(prev => {
      const unpicked = prev.cards.filter(c => !c.isPicked);
      const pickedCount = prev.cards.filter(c => c.isPicked).length;
      if (unpicked.length === 0 || pickedCount >= 5) return prev; 

      const targetCardId = unpicked[Math.floor(Math.random() * unpicked.length)].id;
      
      return {
        ...prev, appState: 'picking', statusText: `🤟 已抽卡 ${pickedCount + 1}/5 张。3秒无动作后开奖...`,
        cards: prev.cards.map(c => c.id === targetCardId ? {
          ...c, isPicked: true, slotIndex: pickedCount 
        } : c)
      };
    });

    clearTimeout(pickTimerRef.current);
    pickTimerRef.current = setTimeout(() => {
      doReveal();
    }, 3000);
  }, []);

  const doReveal = useCallback(() => {
    setGameState(prev => ({ ...prev, appState: 'revealed', statusText: "🎉 开奖啦！10秒后卡牌回归牌堆..." }));
    
    clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      doGather(true); 
      setTimeout(() => {
        doSpread(); // 洗牌后自动散开
      }, 1500);
    }, 10000);
  }, [doGather, doSpread]);

  // --- 3. 手势处理总枢纽 ---
  const processGesture = useCallback((detectedGesture) => {
    setGameState(prev => ({ ...prev, gestureText: `当前: ${GESTURE_MAP[detectedGesture] || "🤔 未知"}` }));

    const now = Date.now();
    if (now - gestureCooldownRef.current < 800) return; // 防抖

    const currentApp = stateRef.current.appState;
    if (currentApp === 'revealed') return; // 开奖时锁定

    // 抽卡流程中，只允许继续抽卡
    if (currentApp === 'picking') {
      if (detectedGesture === 'ILoveYou') {
        doPick();
        gestureCooldownRef.current = now;
      }
      return; 
    }

    // 状态转移逻辑
    if (detectedGesture === 'Open_Palm' && currentApp !== 'spread') {
      doSpread();
      gestureCooldownRef.current = now;
    } else if (detectedGesture === 'Closed_Fist' && currentApp !== 'gathered') {
      doGather();
      gestureCooldownRef.current = now;
    } else if (detectedGesture === 'ILoveYou' && currentApp === 'spread') {
      doPick();
      gestureCooldownRef.current = now;
    }
  }, [doSpread, doGather, doPick]);

  // --- 4. 初始化 MediaPipe Tasks Vision 模型 ---
  useEffect(() => {
    const initModel = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
        recognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setIsModelLoaded(true);
        // 初始化生成一次散开的牌
        setGameState(prev => ({ ...prev, cards: generateCards() }));
        doSpread();
      } catch (error) {
        console.error("模型加载失败:", error);
        setGameState(prev => ({ ...prev, statusText: "❌ 模型加载失败，请检查网络" }));
      }
    };
    initModel();

    return () => {
      if (recognizerRef.current) recognizerRef.current.close();
      cancelAnimationFrame(requestRef.current);
      clearTimeout(pickTimerRef.current);
      clearTimeout(revealTimerRef.current);
    };
  }, [doSpread]);

  // --- 5. 启动摄像头并循环预测 ---
  useEffect(() => {
    if (!isModelLoaded) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let lastVideoTime = -1;

    const predictWebcam = () => {
      if (!video || !recognizerRef.current) return;

      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const results = recognizerRef.current.recognizeForVideo(video, performance.now());

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
          drawConnectors(ctx, results.landmarks[0], HAND_CONNECTIONS, { color: "rgba(0, 255, 0, 0.5)", lineWidth: 2 });
          drawLandmarks(ctx, results.landmarks[0], { color: "rgba(255, 0, 0, 0.5)", lineWidth: 1, radius: 2 });

          // 解析手势结果 (要求置信度 > 0.5 才算数，减少误判)
          if (results.gestures && results.gestures.length > 0) {
            const gestureCategory = results.gestures[0][0].categoryName;
            const score = results.gestures[0][0].score;
            if (score > 0.5) {
              processGesture(gestureCategory);
            } else {
              processGesture("None");
            }
          }
        } else {
          processGesture("None");
        }
        ctx.restore();
      }
      requestRef.current = requestAnimationFrame(predictWebcam);
    };

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      .then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
          video.play();
          predictWebcam();
        });
      })
      .catch((err) => console.error("无法打开摄像头:", err));

  }, [isModelLoaded, processGesture]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px", background: "#111", minHeight: "100vh", color: "#fff", fontFamily: "sans-serif" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", width: "640px", marginBottom: "10px" }}>
        <h2 style={{ margin: 0 }}>手势抽卡系统 (官方模型版)</h2>
        <span style={{ color: "#00ff00", fontWeight: "bold" }}>{gameState.gestureText}</span>
      </div>

      <div style={{ 
        position: "relative", width: "640px", height: "480px", 
        backgroundColor: "#222", borderRadius: "12px", overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
      }}>
        {!isModelLoaded && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "#fff", zIndex: 10 }}>
            AI 模型加载中，首次加载可能需要几秒钟...
          </div>
        )}

        <video ref={videoRef} style={{ display: "none" }} playsInline></video>
        <canvas ref={canvasRef} width={640} height={480} style={{ position: "absolute", zIndex: 1, opacity: 0.3, transform: "scaleX(-1)" }}></canvas>

        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 5, pointerEvents: "none" }}>
          {gameState.cards.map((card) => {
            const finalX = card.isPicked ? 120 + card.slotIndex * 80 : card.baseX + card.noiseX;
            const finalY = card.isPicked ? 380 : card.baseY + card.noiseY;
            const finalRot = card.isPicked ? 0 : card.noiseRot;
            const showFront = card.isPicked && gameState.appState === 'revealed';

            return (
              <div key={card.id} style={{
                  position: "absolute", width: "40px", height: "60px", left: 0, top: 0,
                  transform: `translate(${finalX}px, ${finalY}px) rotate(${finalRot}deg) rotateY(${showFront ? 180 : 0}deg)`,
                  transformStyle: "preserve-3d",
                  transition: card.isPicked ? "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)" : "transform 2s ease-in-out",
                  zIndex: card.isPicked ? 100 : 10,
                }}>
                <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", background: "linear-gradient(135deg, #4B0082, #1A1A2E)", border: "1px solid #666", borderRadius: "4px" }}></div>
                <div style={{ position: "absolute", width: "100%", height: "100%", backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#fff", border: "1px solid #ccc", borderRadius: "4px", overflow: "hidden" }}>
                  {showFront && <img src={card.image} alt={card.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ position: "absolute", bottom: "100px", left: 0, width: "100%", textAlign: "center", zIndex: 10 }}>
          <div style={{ display: "inline-block", padding: "6px 16px", background: "rgba(0,0,0,0.7)", borderRadius: "20px", color: "#FFD700", fontSize: "14px", fontWeight: "bold" }}>
            {gameState.statusText}
          </div>
        </div>

        <div style={{ position: "absolute", bottom: "40px", left: "120px", display: "flex", gap: "40px", zIndex: 2 }}>
          {[0, 1, 2, 3, 4].map(idx => (
            <div key={idx} style={{ width: "40px", height: "60px", border: "2px dashed rgba(255,255,255,0.3)", borderRadius: "4px" }}></div>
          ))}
        </div>

      </div>
    </div>
  );
}