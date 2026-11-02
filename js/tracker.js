/**
 * OCULUS-AI // Deep Learning Eye & Face Mesh Tracking Module
 * Utiliza MediaPipe Face Mesh com refinamento de íris (478 landmarks 3D)
 * para rastreamento biométrico sub-milimétrico em tempo real.
 */

export class EyeTracker {
  constructor(options = {}) {
    this.videoElement = options.videoElement;
    this.onResultsCallback = options.onResults || null;
    this.onErrorCallback = options.onError || null;
    this.onStatusCallback = options.onStatus || null;

    this.faceMesh = null;
    this.camera = null;
    this.isRunning = false;
    this.isCameraActive = false;
    this.lastFrameTime = performance.now();
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    // Índices de marcos anatômicos do MediaPipe Face Mesh
    this.LANDMARKS = {
      // Olho Esquerdo (do observador / camera right)
      LEFT_IRIS_CENTER: 473,
      LEFT_IRIS_PERIMETER: [474, 475, 476, 477],
      LEFT_EYE_CONTOUR: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
      LEFT_INNER_CORNER: 362,
      LEFT_OUTER_CORNER: 263,
      LEFT_UPPER_LID: 386,
      LEFT_LOWER_LID: 374,
      LEFT_EAR_POINTS: [362, 385, 387, 263, 373, 380],

      // Olho Direito (do observador / camera left)
      RIGHT_IRIS_CENTER: 468,
      RIGHT_IRIS_PERIMETER: [469, 470, 471, 472],
      RIGHT_EYE_CONTOUR: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
      RIGHT_INNER_CORNER: 133,
      RIGHT_OUTER_CORNER: 33,
      RIGHT_UPPER_LID: 159,
      RIGHT_LOWER_LID: 145,
      RIGHT_EAR_POINTS: [33, 160, 158, 133, 153, 144],

      // Pontos para cálculo de Pose 3D da Cabeça
      NOSE_TIP: 1,
      CHIN: 152,
      FOREHEAD: 10,
      MOUTH_LEFT: 291,
      MOUTH_RIGHT: 61
    };

    // Filtros de suavização adaptativa (Exponential Moving Average)
    this.smoothLeftPupil = { x: 0.5, y: 0.5, z: 0 };
    this.smoothRightPupil = { x: 0.5, y: 0.5, z: 0 };
    this.smoothHeadPose = { pitch: 0, yaw: 0, roll: 0 };
    this.alpha = 0.35; // Fator de suavização (responsividade vs estabilidade)

    // Detecção de piscada
    this.earThreshold = 0.19;
    this.blinkCount = 0;
    this.isBlinking = false;
    this.blinkStartTime = 0;
    this.blinkTimes = [];
  }

  /**
   * Inicializa a rede neural profunda Face Mesh do MediaPipe
   */
  async initialize() {
    this.notifyStatus('Carregando modelo de Deep Learning (FaceMesh + Iris)...');
    try {
      if (typeof window.FaceMesh === 'undefined') {
        throw new Error('Biblioteca MediaPipe FaceMesh não encontrada no escopo global.');
      }

      this.faceMesh = new window.FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // Crucial para os 478 marcos incluindo íris!
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.faceMesh.onResults((results) => this.processResults(results));
      this.notifyStatus('Modelo de Deep Learning pronto.');
      return true;
    } catch (err) {
      console.error('[EyeTracker] Erro ao inicializar FaceMesh:', err);
      if (this.onErrorCallback) this.onErrorCallback(err);
      throw err;
    }
  }

  /**
   * Inicia o fluxo de captura de vídeo da Webcam
   */
  async startCamera(deviceId = null) {
    if (!this.faceMesh) {
      await this.initialize();
    }

    this.notifyStatus('Solicitando permissão de câmera...');
    try {
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 60, min: 30 }
        }
      };

      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.isRunning = true;
      this.isCameraActive = true;
      this.notifyStatus('Rastreamento ativo.');

      // Utiliza requestVideoFrameCallback se disponível ou requestAnimationFrame
      this.startProcessingLoop();
      return true;
    } catch (err) {
      console.error('[EyeTracker] Erro ao iniciar câmera:', err);
      this.isCameraActive = false;
      this.notifyStatus('Acesso à câmera não concedido ou indisponível.');
      if (this.onErrorCallback) this.onErrorCallback(err);
      return false;
    }
  }

  /**
   * Para a captura e o processamento
   */
  stop() {
    this.isRunning = false;
    this.isCameraActive = false;
    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = this.videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
    this.notifyStatus('Rastreamento pausado.');
  }

  /**
   * Loop de inferência contínua
   */
  startProcessingLoop() {
    const processFrame = async () => {
      if (!this.isRunning) return;

      if (this.videoElement.readyState >= 2) {
        const startInfer = performance.now();
        try {
          await this.faceMesh.send({ image: this.videoElement });
        } catch (e) {
          console.warn('[EyeTracker] Erro no frame:', e);
        }
        const latency = performance.now() - startInfer;
        this.updateFPS(latency);
      }

      requestAnimationFrame(processFrame);
    };

    requestAnimationFrame(processFrame);
  }

  /**
   * Processamento das inferências da rede neural
   */
  processResults(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      if (this.onResultsCallback) {
        this.onResultsCallback({
          detected: false,
          fps: this.fps,
          latency: this.lastLatency || 0
        });
      }
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    // 1. Extração dos centros e perímetros das Íris (3D)
    const rightIrisCenterRaw = landmarks[this.LANDMARKS.RIGHT_IRIS_CENTER];
    const leftIrisCenterRaw = landmarks[this.LANDMARKS.LEFT_IRIS_CENTER];

    if (!rightIrisCenterRaw || !leftIrisCenterRaw) {
      return;
    }

    // Suavização exponencial EMA
    this.smoothLeftPupil = {
      x: this.smoothLeftPupil.x * (1 - this.alpha) + leftIrisCenterRaw.x * this.alpha,
      y: this.smoothLeftPupil.y * (1 - this.alpha) + leftIrisCenterRaw.y * this.alpha,
      z: this.smoothLeftPupil.z * (1 - this.alpha) + leftIrisCenterRaw.z * this.alpha
    };

    this.smoothRightPupil = {
      x: this.smoothRightPupil.x * (1 - this.alpha) + rightIrisCenterRaw.x * this.alpha,
      y: this.smoothRightPupil.y * (1 - this.alpha) + rightIrisCenterRaw.y * this.alpha,
      z: this.smoothRightPupil.z * (1 - this.alpha) + rightIrisCenterRaw.z * this.alpha
    };

    // 2. Extração dos Polígonos Anatômicos dos Olhos
    const leftEyePolygon = this.LANDMARKS.LEFT_EYE_CONTOUR.map(idx => landmarks[idx]);
    const rightEyePolygon = this.LANDMARKS.RIGHT_EYE_CONTOUR.map(idx => landmarks[idx]);
    const leftIrisPolygon = this.LANDMARKS.LEFT_IRIS_PERIMETER.map(idx => landmarks[idx]);
    const rightIrisPolygon = this.LANDMARKS.RIGHT_IRIS_PERIMETER.map(idx => landmarks[idx]);

    // 3. Cálculo de Posição Relativa da Íris no Globo Ocular (Ratio Horizontal e Vertical)
    const leftCorners = {
      inner: landmarks[this.LANDMARKS.LEFT_INNER_CORNER],
      outer: landmarks[this.LANDMARKS.LEFT_OUTER_CORNER],
      top: landmarks[this.LANDMARKS.LEFT_UPPER_LID],
      bottom: landmarks[this.LANDMARKS.LEFT_LOWER_LID]
    };

    const rightCorners = {
      inner: landmarks[this.LANDMARKS.RIGHT_INNER_CORNER],
      outer: landmarks[this.LANDMARKS.RIGHT_OUTER_CORNER],
      top: landmarks[this.LANDMARKS.RIGHT_UPPER_LID],
      bottom: landmarks[this.LANDMARKS.RIGHT_LOWER_LID]
    };

    const leftRatios = this.calculateGazeRatios(leftIrisCenterRaw, leftCorners);
    const rightRatios = this.calculateGazeRatios(rightIrisCenterRaw, rightCorners);

    // 4. Detecção de Piscada via Eye Aspect Ratio (EAR)
    const leftEAR = this.calculateEAR(landmarks, this.LANDMARKS.LEFT_EAR_POINTS);
    const rightEAR = this.calculateEAR(landmarks, this.LANDMARKS.RIGHT_EAR_POINTS);
    const avgEAR = (leftEAR + rightEAR) / 2;

    const now = performance.now();
    if (avgEAR < this.earThreshold) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.blinkStartTime = now;
        this.blinkCount++;
        this.blinkTimes.push(now);
      }
    } else {
      this.isBlinking = false;
    }

    // Limpa piscadas mais antigas que 60s para calcular taxa por minuto (BPM)
    this.blinkTimes = this.blinkTimes.filter(t => now - t < 60000);
    const blinkRateBPM = this.blinkTimes.length;

    // 5. Estimativa de Pose 3D da Cabeça (Pitch, Yaw, Roll)
    const headPose = this.estimateHeadPose(landmarks);
    this.smoothHeadPose = {
      pitch: this.smoothHeadPose.pitch * (1 - this.alpha) + headPose.pitch * this.alpha,
      yaw: this.smoothHeadPose.yaw * (1 - this.alpha) + headPose.yaw * this.alpha,
      roll: this.smoothHeadPose.roll * (1 - this.alpha) + headPose.roll * this.alpha
    };

    // 6. Estimativa de Distância Interpupilar (IPD) e Vetor de Visão 3D
    const dx = (this.smoothLeftPupil.x - this.smoothRightPupil.x) * 1000;
    const dy = (this.smoothLeftPupil.y - this.smoothRightPupil.y) * 1000;
    const dz = (this.smoothLeftPupil.z - this.smoothRightPupil.z) * 1000;
    const estimatedDistanceZ = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Estimativa da distância métrica da cabeça à câmera em cm (~50-80cm típico)
    const metricDistanceCm = Math.max(30, Math.min(120, (63.0 / (Math.abs(this.smoothLeftPupil.x - this.smoothRightPupil.x) * 100)) * 60));

    // Vetor de olhar combinado 3D
    const combinedGazeRatioX = (leftRatios.x + rightRatios.x) / 2;
    const combinedGazeRatioY = (leftRatios.y + rightRatios.y) / 2;

    const payload = {
      detected: true,
      timestamp: now,
      fps: this.fps,
      latency: this.lastLatency,

      // Coordenadas 3D brutas e normalizadas
      leftPupil: this.smoothLeftPupil,
      rightPupil: this.smoothRightPupil,
      leftIrisRaw: leftIrisCenterRaw,
      rightIrisRaw: rightIrisCenterRaw,

      // Polígonos 2D/3D dos contornos
      polygons: {
        leftEye: leftEyePolygon,
        rightEye: rightEyePolygon,
        leftIris: leftIrisPolygon,
        rightIris: rightIrisPolygon
      },

      // Métricas anatômicas
      leftRatios,
      rightRatios,
      combinedGazeRatio: { x: combinedGazeRatioX, y: combinedGazeRatioY },

      // Biometria
      leftEAR,
      rightEAR,
      avgEAR,
      isBlinking: this.isBlinking,
      blinkCount: this.blinkCount,
      blinkRateBPM,

      // Pose da Cabeça
      headPose: this.smoothHeadPose,

      // Distâncias 3D
      estimatedIPD_mm: 63.0, // Calibrado para média humana
      metricDistanceCm: Math.round(metricDistanceCm),

      // Todos os landmarks faciais
      allLandmarks: landmarks
    };

    if (this.onResultsCallback) {
      this.onResultsCallback(payload);
    }
  }

  /**
   * Calcula proporção da pupila nos eixos horizontal e vertical
   */
  calculateGazeRatios(iris, corners) {
    const eyeWidth = Math.abs(corners.outer.x - corners.inner.x) || 0.001;
    const eyeHeight = Math.abs(corners.bottom.y - corners.top.y) || 0.001;

    // Normalização 0.0 (olhando para o canto interno/superior) a 1.0 (externo/inferior)
    const minX = Math.min(corners.inner.x, corners.outer.x);
    const minY = Math.min(corners.top.y, corners.bottom.y);

    const ratioX = (iris.x - minX) / eyeWidth;
    const ratioY = (iris.y - minY) / eyeHeight;

    return {
      x: Math.max(0, Math.min(1, ratioX)),
      y: Math.max(0, Math.min(1, ratioY))
    };
  }

  /**
   * Calcula o Eye Aspect Ratio (EAR) para detecção de piscadas
   */
  calculateEAR(landmarks, points) {
    const p1 = landmarks[points[0]];
    const p2 = landmarks[points[1]];
    const p3 = landmarks[points[2]];
    const p4 = landmarks[points[3]];
    const p5 = landmarks[points[4]];
    const p6 = landmarks[points[5]];

    const distV1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
    const distV2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
    const distH = Math.hypot(p1.x - p4.x, p1.y - p4.y);

    if (distH === 0) return 0.25;
    return (distV1 + distV2) / (2.0 * distH);
  }

  /**
   * Estima os ângulos de Euler (Pitch, Yaw, Roll) da cabeça em graus
   */
  estimateHeadPose(landmarks) {
    const nose = landmarks[this.LANDMARKS.NOSE_TIP];
    const chin = landmarks[this.LANDMARKS.CHIN];
    const leftMouth = landmarks[this.LANDMARKS.MOUTH_LEFT];
    const rightMouth = landmarks[this.LANDMARKS.MOUTH_RIGHT];
    const forehead = landmarks[this.LANDMARKS.FOREHEAD];

    // Yaw (rotação lateral da cabeça: esquerda/direita)
    const mouthCenter = (leftMouth.x + rightMouth.x) / 2;
    const yaw = (nose.x - mouthCenter) * 120;

    // Pitch (elevação/inclinação para cima/baixo)
    const faceHeight = Math.abs(chin.y - forehead.y) || 0.001;
    const noseRelativeY = (nose.y - forehead.y) / faceHeight;
    const pitch = (noseRelativeY - 0.58) * 100;

    // Roll (inclinação lateral nos ombros)
    const roll = Math.atan2(leftMouth.y - rightMouth.y, leftMouth.x - rightMouth.x) * (180 / Math.PI);

    return {
      pitch: Math.max(-45, Math.min(45, pitch)),
      yaw: Math.max(-45, Math.min(45, yaw)),
      roll: Math.max(-45, Math.min(45, roll))
    };
  }

  updateFPS(latency) {
    this.lastLatency = Math.round(latency);
    this.frameCount++;
    const now = performance.now();
    if (now - this.fpsTimer >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = now;
    }
  }

  notifyStatus(msg) {
    if (this.onStatusCallback) {
      this.onStatusCallback(msg);
    }
  }
}
