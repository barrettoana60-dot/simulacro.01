/**
 * OCULUS-AI // Physiological Eye Tracking Synthetic Simulator
 * Gera cinemática ocular humana realista (microssacadas, perseguição lenta,
 * fixações cognitivas, piscares fisiológicos e marcos 3D) para testes imediatos sem webcam.
 */

export class EyeSimulator {
  constructor(onResultsCallback) {
    this.onResults = onResultsCallback;
    this.isActive = false;
    this.animationId = null;

    // Estado da simulação fisiológica
    this.targetGaze = { x: 0.5, y: 0.5 };
    this.currentGaze = { x: 0.5, y: 0.5 };
    this.velocity = { x: 0, y: 0 };

    this.headPose = { pitch: 0, yaw: 0, roll: 0 };
    this.targetHeadPose = { pitch: 0, yaw: 0, roll: 0 };

    this.blinkProgress = 0;
    this.isBlinking = false;
    this.blinkCount = 0;
    this.lastBlinkTime = performance.now();

    this.lastSaccadeTime = performance.now();
    this.saccadeInterval = 1800; // Troca de fixação a cada ~1.8s

    // Pontos de interesse simulados na tela
    this.interestPoints = [
      { x: 0.25, y: 0.15 }, // Header
      { x: 0.50, y: 0.15 }, // Título
      { x: 0.35, y: 0.50 }, // Centro
      { x: 0.65, y: 0.50 }, // Painel lateral
      { x: 0.50, y: 0.85 }, // CTA / Botão
      { x: 0.80, y: 0.30 }, // Métrica
      { x: 0.18, y: 0.75 }  // Rodapé
    ];
    this.interestIndex = 0;
  }

  start() {
    this.isActive = true;
    this.lastFrameTime = performance.now();
    this.loop();
  }

  stop() {
    this.isActive = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  loop() {
    if (!this.isActive) return;

    this.updateKinematics();
    this.generateSyntheticPayload();

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  updateKinematics() {
    const now = performance.now();

    // 1. Planejamento de Sacadas Intencionais
    if (now - this.lastSaccadeTime > this.saccadeInterval) {
      this.interestIndex = (this.interestIndex + 1) % this.interestPoints.length;
      const target = this.interestPoints[this.interestIndex];

      // Adiciona jitter humano aleatório ao redor do ponto alvo
      this.targetGaze = {
        x: target.x + (Math.random() - 0.5) * 0.08,
        y: target.y + (Math.random() - 0.5) * 0.08
      };

      // Pequena rotação natural da cabeça acompanhando o olhar
      this.targetHeadPose = {
        yaw: (this.targetGaze.x - 0.5) * 22,
        pitch: -(this.targetGaze.y - 0.5) * 16,
        roll: (Math.random() - 0.5) * 4
      };

      this.lastSaccadeTime = now;
      this.saccadeInterval = 800 + Math.random() * 2000;
    }

    // 2. Interpolação de Movimento Sacádico Balístico (Mola Crítica)
    const kGaze = 0.14;
    this.currentGaze.x += (this.targetGaze.x - this.currentGaze.x) * kGaze;
    this.currentGaze.y += (this.targetGaze.y - this.currentGaze.y) * kGaze;

    // Adiciona microssacadas e ruído fixacional (drift browniano ocular ~1-2Hz)
    this.currentGaze.x += (Math.random() - 0.5) * 0.003;
    this.currentGaze.y += (Math.random() - 0.5) * 0.003;

    // Suavização da pose da cabeça
    const kHead = 0.05;
    this.headPose.yaw += (this.targetHeadPose.yaw - this.headPose.yaw) * kHead;
    this.headPose.pitch += (this.targetHeadPose.pitch - this.headPose.pitch) * kHead;
    this.headPose.roll += (this.targetHeadPose.roll - this.headPose.roll) * kHead;

    // 3. Fisiologia de Piscar Espontâneo (a cada 3.5 a 6 segundos)
    if (!this.isBlinking && (now - this.lastBlinkTime > 3500 + Math.random() * 2500)) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkCount++;
      this.lastBlinkTime = now;
    }

    let currentEAR = 0.28;
    if (this.isBlinking) {
      this.blinkProgress += 0.15;
      // Curva em sino do fechamento palpebral
      currentEAR = 0.28 * (1 - Math.sin(this.blinkProgress * Math.PI));
      if (this.blinkProgress >= 1.0) {
        this.isBlinking = false;
        currentEAR = 0.28;
      }
    }
    this.currentEAR = currentEAR;
  }

  generateSyntheticPayload() {
    const now = performance.now();
    const u = this.currentGaze.x;
    const v = this.currentGaze.y;

    // Simula marcos anatômicos 2D/3D dos olhos
    const leftPupil = {
      x: 0.62 + (u - 0.5) * 0.06,
      y: 0.44 + (v - 0.5) * 0.04,
      z: -0.02
    };

    const rightPupil = {
      x: 0.38 + (u - 0.5) * 0.06,
      y: 0.44 + (v - 0.5) * 0.04,
      z: -0.02
    };

    // Polígonos anatômicos sintéticos
    const leftEyePolygon = this.generateSyntheticContour(leftPupil.x, leftPupil.y, 0.05, 0.025 * (this.currentEAR / 0.28));
    const rightEyePolygon = this.generateSyntheticContour(rightPupil.x, rightPupil.y, 0.05, 0.025 * (this.currentEAR / 0.28));
    const leftIrisPolygon = this.generateSyntheticContour(leftPupil.x, leftPupil.y, 0.016, 0.016);
    const rightIrisPolygon = this.generateSyntheticContour(rightPupil.x, rightPupil.y, 0.016, 0.016);

    // Gera nuvem facial básica para Three.js
    const fakeLandmarks = new Array(478);
    for (let i = 0; i < 478; i++) {
      fakeLandmarks[i] = {
        x: 0.5 + (Math.sin(i * 0.2) * 0.18),
        y: 0.5 + (Math.cos(i * 0.15) * 0.22),
        z: -Math.abs(Math.sin(i * 0.1)) * 0.1
      };
    }

    const payload = {
      detected: true,
      timestamp: now,
      fps: 60,
      latency: 4,
      isSimulated: true,

      leftPupil,
      rightPupil,

      polygons: {
        leftEye: leftEyePolygon,
        rightEye: rightEyePolygon,
        leftIris: leftIrisPolygon,
        rightIris: rightIrisPolygon
      },

      leftRatios: { x: u, y: v },
      rightRatios: { x: u, y: v },
      combinedGazeRatio: { x: u, y: v },

      leftEAR: this.currentEAR,
      rightEAR: this.currentEAR,
      avgEAR: this.currentEAR,
      isBlinking: this.isBlinking,
      blinkCount: this.blinkCount,
      blinkRateBPM: 14,

      headPose: this.headPose,
      estimatedIPD_mm: 63.2,
      metricDistanceCm: 58,

      allLandmarks: fakeLandmarks
    };

    if (this.onResults) {
      this.onResults(payload);
    }
  }

  generateSyntheticContour(cx, cy, rx, ry, points = 16) {
    const pts = [];
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      pts.push({
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
        z: 0
      });
    }
    return pts;
  }
}
