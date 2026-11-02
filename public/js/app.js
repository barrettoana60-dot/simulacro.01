/**
 * OCULUS-AI // Master Application Orchestration Module
 * Integração completa dos módulos de Deep Learning, 3D FOV, Heatmap, Polígonos e Telemetria.
 */

import { EyeTracker } from './tracker.js';
import { CalibrationEngine } from './calibration.js';
import { ThreeVisualizer } from './three-fov.js';
import { HeatmapEngine } from './heatmap.js';
import { PolygonEngine } from './polygons.js';
import { TelemetryEngine } from './telemetry.js';
import { EyeSimulator } from './simulator.js';

class OculusApplication {
  constructor() {
    this.tracker = null;
    this.calibration = null;
    this.threeViz = null;
    this.heatmap = null;
    this.polygons = null;
    this.telemetry = null;
    this.simulator = null;

    this.activeMode = 'camera'; // 'camera' ou 'simulation'
    this.activeTab = 'overview'; // 'overview', 'heatmap', 'polygons', 'telemetry'

    this.init();
  }

  async init() {
    this.setupDOMElements();
    this.setupEngines();
    this.setupEventListeners();
    this.setupResizeHandlers();

    // Inicia por padrão no Modo Simulação para demonstrar imediatamente ao abrir no Vercel
    this.toggleSimulationMode(true);
  }

  setupDOMElements() {
    // Vídeo e Canvas de Overlay
    this.videoElement = document.getElementById('webcam-video');
    this.videoOverlay = document.getElementById('video-overlay');
    this.videoOverlayCtx = this.videoOverlay ? this.videoOverlay.getContext('2d') : null;

    // Viewport 3D Three.js
    this.threeContainer = document.getElementById('three-container');

    // Canvas do Mapa de Calor
    this.heatmapCanvas = document.getElementById('heatmap-canvas');

    // Canvas de Polígonos AOI
    this.aoiCanvas = document.getElementById('aoi-canvas');

    // Canvas do Osciloscópio
    this.oscilloscopeCanvas = document.getElementById('oscilloscope-canvas');

    // Modal de Calibração
    this.calibrationModal = document.getElementById('calibration-modal');
    this.calibrationTarget = document.getElementById('calibration-target');
    this.calibrationProgress = document.getElementById('calibration-progress');

    // Badges de Status
    this.badgeStatus = document.getElementById('badge-status');
    this.badgeFps = document.getElementById('badge-fps');
    this.badgeLatency = document.getElementById('badge-latency');
    this.badgeAccuracy = document.getElementById('badge-accuracy');
  }

  setupEngines() {
    // 1. Motor 3D Three.js
    if (this.threeContainer) {
      this.threeViz = new ThreeVisualizer(this.threeContainer);
    }

    // 2. Motor de Mapa de Calor
    if (this.heatmapCanvas) {
      this.heatmap = new HeatmapEngine(this.heatmapCanvas, {
        radius: 44,
        opacity: 0.75,
        decay: 0.003,
        palette: 'turbo'
      });
    }

    // 3. Motor de Polígonos e AOIs
    if (this.aoiCanvas) {
      this.polygons = new PolygonEngine(this.aoiCanvas);
    }

    // 4. Motor de Telemetria e Osciloscópio
    if (this.oscilloscopeCanvas) {
      this.telemetry = new TelemetryEngine(this.oscilloscopeCanvas);
    }

    // 5. Motor de Calibração Polinomial
    this.calibration = new CalibrationEngine({
      pointsCount: 9,
      samplesPerPoint: 20,
      onProgress: (info) => this.handleCalibrationProgress(info),
      onComplete: (res) => this.handleCalibrationComplete(res)
    });

    // 6. Rastreamento por Deep Learning (MediaPipe Face Mesh + Iris)
    this.tracker = new EyeTracker({
      videoElement: this.videoElement,
      onResults: (data) => this.handleTrackingResults(data),
      onError: (err) => this.handleTrackingError(err),
      onStatus: (msg) => this.updateStatusBadge(msg)
    });

    // 7. Simulador Fisiológico Sintético
    this.simulator = new EyeSimulator((data) => this.handleTrackingResults(data));
  }

  setupEventListeners() {
    // Navegação por Abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Botões da Barra de Controle Superior
    const btnStartCamera = document.getElementById('btn-start-camera');
    if (btnStartCamera) {
      btnStartCamera.addEventListener('click', () => this.toggleCamera());
    }

    const btnSimulation = document.getElementById('btn-toggle-simulation');
    if (btnSimulation) {
      btnSimulation.addEventListener('click', () => {
        const nextState = this.activeMode !== 'simulation';
        this.toggleSimulationMode(nextState);
      });
    }

    const btnCalibrate = document.getElementById('btn-calibrate');
    if (btnCalibrate) {
      btnCalibrate.addEventListener('click', () => this.startCalibrationWizard());
    }

    const btnExportCSV = document.getElementById('btn-export-csv');
    if (btnExportCSV) {
      btnExportCSV.addEventListener('click', () => this.exportCSVFile());
    }

    const btnExportJSON = document.getElementById('btn-export-json');
    if (btnExportJSON) {
      btnExportJSON.addEventListener('click', () => this.exportJSONFile());
    }

    const btnSaveHeatmap = document.getElementById('btn-save-heatmap');
    if (btnSaveHeatmap) {
      btnSaveHeatmap.addEventListener('click', () => this.saveHeatmapImage());
    }

    const btnResetHeatmap = document.getElementById('btn-reset-heatmap');
    if (btnResetHeatmap) {
      btnResetHeatmap.addEventListener('click', () => {
        if (this.heatmap) this.heatmap.reset();
        if (this.polygons) this.polygons.reset();
      });
    }

    // Controles do Mapa de Calor
    const paletteSelect = document.getElementById('heatmap-palette');
    if (paletteSelect) {
      paletteSelect.addEventListener('change', (e) => {
        if (this.heatmap) this.heatmap.setPalette(e.target.value);
      });
    }

    const radiusInput = document.getElementById('heatmap-radius');
    if (radiusInput) {
      radiusInput.addEventListener('input', (e) => {
        if (this.heatmap) this.heatmap.radius = parseInt(e.target.value);
      });
    }

    const opacityInput = document.getElementById('heatmap-opacity');
    if (opacityInput) {
      opacityInput.addEventListener('input', (e) => {
        if (this.heatmap) this.heatmap.opacity = parseFloat(e.target.value);
      });
    }

    const decayToggle = document.getElementById('heatmap-decay');
    if (decayToggle) {
      decayToggle.addEventListener('change', (e) => {
        if (this.heatmap) this.heatmap.decay = e.target.checked ? 0.005 : 0;
      });
    }

    const scanpathToggle = document.getElementById('heatmap-scanpath');
    if (scanpathToggle) {
      scanpathToggle.addEventListener('change', (e) => {
        if (this.heatmap) this.heatmap.showScanpath = e.target.checked;
      });
    }

    // Upload de Imagem de Estímulo para o Mapa de Calor
    const bgUpload = document.getElementById('bg-image-upload');
    if (bgUpload) {
      bgUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              if (this.heatmap) this.heatmap.setBackground(img);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Controles do Modelo 3D
    const btnReset3D = document.getElementById('btn-reset-3d');
    if (btnReset3D && this.threeViz) {
      btnReset3D.addEventListener('click', () => this.threeViz.resetCamera());
    }

    const toggleCones = document.getElementById('toggle-fov-cones');
    if (toggleCones && this.threeViz) {
      toggleCones.addEventListener('change', (e) => this.threeViz.toggleFOVCones(e.target.checked));
    }

    const toggleFaceMesh = document.getElementById('toggle-face-mesh');
    if (toggleFaceMesh && this.threeViz) {
      toggleFaceMesh.addEventListener('change', (e) => this.threeViz.toggleFaceCloud(e.target.checked));
    }

    // Modal de Calibração: botão de cancelar
    const btnCancelCalib = document.getElementById('btn-cancel-calibration');
    if (btnCancelCalib) {
      btnCancelCalib.addEventListener('click', () => this.cancelCalibration());
    }
  }

  setupResizeHandlers() {
    window.addEventListener('resize', () => {
      if (this.threeViz) this.threeViz.onResize();
      if (this.heatmap) this.heatmap.resize();
      if (this.polygons) this.polygons.resize();
      if (this.telemetry) this.telemetry.resize();
      this.resizeVideoOverlay();
    });
    this.resizeVideoOverlay();
  }

  resizeVideoOverlay() {
    if (this.videoElement && this.videoOverlay) {
      const rect = this.videoElement.getBoundingClientRect();
      this.videoOverlay.width = rect.width || 320;
      this.videoOverlay.height = rect.height || 240;
    }
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    document.querySelectorAll('.tab-btn').forEach(b => {
      const isMatch = b.dataset.tab === tabId;
      b.classList.toggle('border-cyan-400', isMatch);
      b.classList.toggle('text-cyan-400', isMatch);
      b.classList.toggle('border-transparent', !isMatch);
      b.classList.toggle('text-slate-400', !isMatch);
    });

    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('hidden', c.id !== `tab-${tabId}`);
    });

    // Reativa renders específicos dependendo da aba ativa
    if (tabId === 'overview' && this.threeViz) {
      setTimeout(() => this.threeViz.onResize(), 50);
    } else if (tabId === 'heatmap' && this.heatmap) {
      setTimeout(() => {
        this.heatmap.resize();
        this.heatmap.render();
      }, 50);
    } else if (tabId === 'polygons' && this.polygons) {
      setTimeout(() => this.polygons.resize(), 50);
    } else if (tabId === 'telemetry' && this.telemetry) {
      setTimeout(() => this.telemetry.resize(), 50);
    }
  }

  async toggleCamera() {
    const btn = document.getElementById('btn-start-camera');

    if (this.tracker && this.tracker.isRunning) {
      this.tracker.stop();
      if (btn) btn.innerHTML = `<span>▶ Iniciar Câmera</span>`;
      this.updateStatusBadge('Câmera parada.');
    } else {
      if (this.simulator && this.simulator.isActive) {
        this.simulator.stop();
        this.activeMode = 'camera';
        const simBtn = document.getElementById('btn-toggle-simulation');
        if (simBtn) simBtn.classList.remove('bg-emerald-600', 'text-white');
      }

      this.updateStatusBadge('Iniciando webcam...');
      const success = await this.tracker.startCamera();
      if (success) {
        this.activeMode = 'camera';
        if (btn) btn.innerHTML = `<span>⏹ Parar Câmera</span>`;
        this.updateStatusBadge('Deep Learning ativo // 60 FPS');
      } else {
        // Fallback automático para modo de simulação se a câmera falhar
        this.toggleSimulationMode(true);
      }
    }
  }

  toggleSimulationMode(enable) {
    const simBtn = document.getElementById('btn-toggle-simulation');
    const camBtn = document.getElementById('btn-start-camera');

    if (enable) {
      if (this.tracker && this.tracker.isRunning) {
        this.tracker.stop();
        if (camBtn) camBtn.innerHTML = `<span>▶ Iniciar Câmera</span>`;
      }

      this.activeMode = 'simulation';
      this.simulator.start();
      if (simBtn) {
        simBtn.classList.add('bg-cyan-500', 'text-black', 'font-bold');
        simBtn.innerHTML = `<span>⚡ Simulação Ativa</span>`;
      }
      this.updateStatusBadge('Simulação 3D Ativa // Dados Fisiológicos');
    } else {
      this.simulator.stop();
      this.activeMode = 'idle';
      if (simBtn) {
        simBtn.classList.remove('bg-cyan-500', 'text-black', 'font-bold');
        simBtn.innerHTML = `<span>⚡ Modo Simulação 3D</span>`;
      }
      this.updateStatusBadge('Pronto para iniciar.');
    }
  }

  /**
   * Processador mestre acionado a cada novo frame de inferência do modelo
   */
  handleTrackingResults(data) {
    if (!data || !data.detected) {
      return;
    }

    // 1. Predição de Olhar na Tela (Calibração Polinomial ou Mapeamento Heurístico)
    const gazePrediction = this.calibration.predict(data);

    // Se estiver em processo de calibração ativa, alimenta com a amostra
    if (this.calibration.isCalibrating) {
      this.calibration.collectSample(data);
    }

    // 2. Atualiza Visualizador 3D Three.js
    if (this.threeViz) {
      this.threeViz.update(data, gazePrediction);
    }

    // 3. Atualiza Mapa de Calor e Scanpath
    if (this.heatmap) {
      this.heatmap.addPoint(gazePrediction.screenX, gazePrediction.screenY, data.timestamp);
      if (this.activeTab === 'heatmap' || this.activeTab === 'overview') {
        this.heatmap.render();
      }
    }

    // 4. Atualiza Polígonos (Anatômicos e Áreas de Interesse AOI)
    if (this.polygons) {
      this.polygons.update(gazePrediction.screenX, gazePrediction.screenY);
      if (this.activeTab === 'polygons') {
        this.polygons.renderAOIOverlay();
        this.updateAOITable();
      }
    }

    // 5. Renderiza Polígonos Anatômicos sobre o Vídeo da Câmera
    if (this.videoOverlayCtx && this.videoOverlay) {
      this.videoOverlayCtx.clearRect(0, 0, this.videoOverlay.width, this.videoOverlay.height);
      if (this.polygons) {
        this.polygons.renderEyeAnatomy(
          this.videoOverlayCtx,
          data,
          this.videoOverlay.width,
          this.videoOverlay.height
        );
      }
    }

    // 6. Atualiza Telemetria e Osciloscópio
    if (this.telemetry) {
      const teleData = this.telemetry.recordFrame(data, gazePrediction);
      this.updateTelemetryHUD(teleData, data);
    }

    // 7. Atualiza Badges de Topo
    if (this.badgeFps) this.badgeFps.textContent = `${data.fps || 60} FPS`;
    if (this.badgeLatency) this.badgeLatency.textContent = `${data.latency || 4} ms`;
    if (this.badgeAccuracy && gazePrediction.accuracyScore) {
      this.badgeAccuracy.textContent = `${gazePrediction.accuracyScore}%`;
    }
  }

  updateTelemetryHUD(tele, rawData) {
    // Coordenadas do Olho Esquerdo 3D (mm)
    const elLeftMm = document.getElementById('hud-left-mm');
    if (elLeftMm && tele.leftIris3D.mm) {
      elLeftMm.textContent = `X: ${tele.leftIris3D.mm.x} | Y: ${tele.leftIris3D.mm.y} | Z: ${tele.leftIris3D.mm.z}`;
    }

    // Coordenadas do Olho Direito 3D (mm)
    const elRightMm = document.getElementById('hud-right-mm');
    if (elRightMm && tele.rightIris3D.mm) {
      elRightMm.textContent = `X: ${tele.rightIris3D.mm.x} | Y: ${tele.rightIris3D.mm.y} | Z: ${tele.rightIris3D.mm.z}`;
    }

    // Ponto de Olhar na Tela (Pixels e Normalizado)
    const elGazePx = document.getElementById('hud-gaze-px');
    if (elGazePx) {
      elGazePx.textContent = `X: ${tele.screenGaze.x}px | Y: ${tele.screenGaze.y}px (${tele.screenGaze.normX}, ${tele.screenGaze.normY})`;
    }

    // Ângulo Visual e IPD
    const elVisualAngle = document.getElementById('hud-visual-angle');
    if (elVisualAngle) {
      elVisualAngle.textContent = `${tele.visualAngleDeg}°`;
    }

    const elIPD = document.getElementById('hud-ipd');
    if (elIPD) {
      elIPD.textContent = `${tele.ipd_mm} mm`;
    }

    // Pose da Cabeça
    const elHeadPose = document.getElementById('hud-head-pose');
    if (elHeadPose) {
      elHeadPose.textContent = `Pitch: ${Math.round(tele.headPose.pitch)}° | Yaw: ${Math.round(tele.headPose.yaw)}° | Roll: ${Math.round(tele.headPose.roll)}°`;
    }

    // Piscadas e Abertura Palpebral (EAR)
    const elBlinks = document.getElementById('hud-blinks');
    if (elBlinks) {
      elBlinks.textContent = `${tele.blinks.count} (${tele.blinks.bpm} BPM) | EAR: ${tele.ear.avg}`;
    }

    // Precisão RMSE
    const elRmse = document.getElementById('hud-rmse');
    if (elRmse) {
      elRmse.textContent = `${tele.precision.rmse} px (Conf: ${tele.precision.confidencePct}%)`;
    }
  }

  updateAOITable() {
    const tableBody = document.getElementById('aoi-table-body');
    if (!tableBody || !this.polygons) return;

    const stats = this.polygons.getAOIStats();
    tableBody.innerHTML = stats.map(s => `
      <tr class="border-b border-slate-800 text-xs">
        <td class="py-2.5 px-3 font-medium flex items-center gap-2">
          <span class="w-3 h-3 rounded-sm inline-block" style="background-color: ${s.color}"></span>
          ${s.name}
        </td>
        <td class="py-2.5 px-3 font-mono text-cyan-400 font-bold">${s.dwellTimeSec}s</td>
        <td class="py-2.5 px-3 font-mono text-slate-300">${s.attentionPct}%</td>
        <td class="py-2.5 px-3 font-mono text-slate-300">${s.fixationCount}</td>
        <td class="py-2.5 px-3 font-mono text-slate-400">${s.ttffMs} ms</td>
      </tr>
    `).join('');
  }

  // --- Wizard de Calibração 9 Pontos ---

  startCalibrationWizard() {
    if (!this.calibrationModal || !this.calibrationTarget) return;

    this.calibrationModal.classList.remove('hidden');
    this.calibration.startCalibration(9);
  }

  handleCalibrationProgress(info) {
    if (!this.calibrationTarget || !this.calibrationProgress) return;

    const pt = info.point;
    this.calibrationTarget.style.left = `${pt.x * 100}%`;
    this.calibrationTarget.style.top = `${pt.y * 100}%`;

    const pct = Math.round(((info.pointIndex * info.targetSamples + info.samplesCount) / (info.totalPoints * info.targetSamples)) * 100);
    this.calibrationProgress.textContent = `Ponto ${info.pointIndex + 1}/${info.totalPoints} — ${pct}% concluído. Mantenha o olhar no alvo.`;
  }

  handleCalibrationComplete(res) {
    if (this.calibrationModal) {
      this.calibrationModal.classList.add('hidden');
    }
    this.updateStatusBadge(`Calibração Concluída: ${res.accuracyScore}% precisão (RMSE: ${res.rmsePixels}px)`);
    if (this.badgeAccuracy) {
      this.badgeAccuracy.textContent = `${res.accuracyScore}%`;
    }
  }

  cancelCalibration() {
    if (this.calibrationModal) {
      this.calibrationModal.classList.add('hidden');
    }
    this.calibration.reset();
    this.updateStatusBadge('Calibração cancelada.');
  }

  // --- Exportações ---

  exportCSVFile() {
    if (!this.telemetry) return;
    const csv = this.telemetry.exportCSV();
    this.downloadFile(csv, `oculus_eyetracking_telemetry_${Date.now()}.csv`, 'text/csv');
  }

  exportJSONFile() {
    if (!this.telemetry) return;
    const aoiStats = this.polygons ? this.polygons.getAOIStats() : [];
    const json = this.telemetry.exportJSON(aoiStats);
    this.downloadFile(json, `oculus_biometric_dataset_${Date.now()}.json`, 'application/json');
  }

  saveHeatmapImage() {
    if (!this.heatmap) return;
    const dataUrl = this.heatmap.exportImage();
    const link = document.createElement('a');
    link.download = `oculus_heatmap_export_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  handleTrackingError(err) {
    console.warn('[App] Erro de rastreamento:', err);
    this.updateStatusBadge('Webcam não disponível — Iniciando modo de simulação 3D');
    this.toggleSimulationMode(true);
  }

  updateStatusBadge(text) {
    if (this.badgeStatus) {
      this.badgeStatus.textContent = text;
    }
  }
}

// Inicializa a aplicação ao carregar o DOM
window.addEventListener('DOMContentLoaded', () => {
  window.oculusApp = new OculusApplication();
});
