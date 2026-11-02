/**
 * OCULUS-AI // Biometric Polygons & Area of Interest (AOI) Engine
 * Renderiza polígonos anatômicos oculares, calcula envoltória convexa (Graham Scan)
 * da trajetória do olhar e gerencia Polígonos de Área de Interesse (AOIs) com métricas em tempo real.
 */

export class PolygonEngine {
  constructor(overlayCanvas) {
    this.canvas = overlayCanvas;
    this.ctx = this.canvas.getContext('2d');

    // Polígonos de Áreas de Interesse (AOIs) definidos pelo usuário
    this.aois = [
      {
        id: 'aoi-1',
        name: 'Zona A // Header & Título',
        color: '#00f0ff',
        points: [
          { x: 0.15, y: 0.08 },
          { x: 0.85, y: 0.08 },
          { x: 0.85, y: 0.25 },
          { x: 0.15, y: 0.25 }
        ],
        dwellTimeMs: 0,
        fixationCount: 0,
        firstFixationTime: null,
        isCurrentlyLooking: false
      },
      {
        id: 'aoi-2',
        name: 'Zona B // Foco Central',
        color: '#ff0077',
        points: [
          { x: 0.30, y: 0.35 },
          { x: 0.70, y: 0.35 },
          { x: 0.75, y: 0.70 },
          { x: 0.25, y: 0.70 }
        ],
        dwellTimeMs: 0,
        fixationCount: 0,
        firstFixationTime: null,
        isCurrentlyLooking: false
      },
      {
        id: 'aoi-3',
        name: 'Zona C // Ação & CTA',
        color: '#00ff88',
        points: [
          { x: 0.35, y: 0.78 },
          { x: 0.65, y: 0.78 },
          { x: 0.65, y: 0.92 },
          { x: 0.35, y: 0.92 }
        ],
        dwellTimeMs: 0,
        fixationCount: 0,
        firstFixationTime: null,
        isCurrentlyLooking: false
      }
    ];

    // Histórico de pontos para Envoltória Convexa (Convex Hull)
    this.recentGazePoints = [];
    this.maxRecentPoints = 120;
    this.convexHull = [];

    // Modo de desenho manual de polígonos
    this.isDrawingMode = false;
    this.currentDrawingPoints = [];

    this.sessionStartTime = performance.now();
    this.totalTrackingTimeMs = 0;
    this.lastUpdateTime = performance.now();
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
  }

  /**
   * Atualiza as métricas dos polígonos com base nas coordenadas de olhar
   */
  update(gazeScreenX, gazeScreenY, isFixation = false) {
    const now = performance.now();
    const dt = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    this.totalTrackingTimeMs += dt;

    if (isNaN(gazeScreenX) || isNaN(gazeScreenY)) return;

    // Normaliza para o espaço deste canvas
    const rect = this.canvas.getBoundingClientRect();
    const normX = (gazeScreenX - rect.left) / this.canvas.width;
    const normY = (gazeScreenY - rect.top) / this.canvas.height;

    // 1. Armazena para cálculo do Polígono de Envoltória Convexa
    if (normX >= 0 && normX <= 1 && normY >= 0 && normY <= 1) {
      this.recentGazePoints.push({ x: normX, y: normY });
      if (this.recentGazePoints.length > this.maxRecentPoints) {
        this.recentGazePoints.shift();
      }
      this.convexHull = this.calculateConvexHull(this.recentGazePoints);
    }

    // 2. Interseção com Polígonos AOI (Ray Casting / Point-in-Polygon)
    this.aois.forEach(aoi => {
      const isInside = this.isPointInPolygon({ x: normX, y: normY }, aoi.points);

      if (isInside) {
        aoi.dwellTimeMs += dt;
        if (!aoi.isCurrentlyLooking) {
          aoi.isCurrentlyLooking = true;
          aoi.fixationCount++;
          if (aoi.firstFixationTime === null) {
            aoi.firstFixationTime = Math.round(this.totalTrackingTimeMs);
          }
        }
      } else {
        aoi.isCurrentlyLooking = false;
      }
    });
  }

  /**
   * Renderiza os contornos anatômicos dos olhos sobre a imagem de vídeo
   */
  renderEyeAnatomy(ctx, eyeData, videoWidth, videoHeight) {
    if (!eyeData || !eyeData.detected || !eyeData.polygons) return;

    const { leftEye, rightEye, leftIris, rightIris } = eyeData.polygons;

    ctx.save();

    // 1. Polígono do Contorno do Olho Direito
    this.drawPolygonOnCanvas(ctx, rightEye, videoWidth, videoHeight, {
      strokeStyle: '#00f0ff',
      fillStyle: 'rgba(0, 240, 255, 0.12)',
      lineWidth: 2,
      close: true
    });

    // 2. Polígono do Contorno do Olho Esquerdo
    this.drawPolygonOnCanvas(ctx, leftEye, videoWidth, videoHeight, {
      strokeStyle: '#00f0ff',
      fillStyle: 'rgba(0, 240, 255, 0.12)',
      lineWidth: 2,
      close: true
    });

    // 3. Polígono da Íris Direita
    this.drawPolygonOnCanvas(ctx, rightIris, videoWidth, videoHeight, {
      strokeStyle: '#ff0077',
      fillStyle: 'rgba(255, 0, 119, 0.25)',
      lineWidth: 2,
      close: true
    });

    // 4. Polígono da Íris Esquerda
    this.drawPolygonOnCanvas(ctx, leftIris, videoWidth, videoHeight, {
      strokeStyle: '#ff0077',
      fillStyle: 'rgba(255, 0, 119, 0.25)',
      lineWidth: 2,
      close: true
    });

    // 5. Centro da Pupila com Retículo de Precisão
    if (eyeData.rightPupil) {
      const rx = eyeData.rightPupil.x * videoWidth;
      const ry = eyeData.rightPupil.y * videoHeight;
      this.drawCrosshair(ctx, rx, ry, '#ffffff', 6);
    }

    if (eyeData.leftPupil) {
      const lx = eyeData.leftPupil.x * videoWidth;
      const ly = eyeData.leftPupil.y * videoHeight;
      this.drawCrosshair(ctx, lx, ly, '#ffffff', 6);
    }

    ctx.restore();
  }

  drawPolygonOnCanvas(ctx, points, w, h, style) {
    if (!points || points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x * w, points[0].y * h);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * w, points[i].y * h);
    }
    if (style.close) ctx.closePath();

    if (style.fillStyle) {
      ctx.fillStyle = style.fillStyle;
      ctx.fill();
    }
    if (style.strokeStyle) {
      ctx.strokeStyle = style.strokeStyle;
      ctx.lineWidth = style.lineWidth || 1.5;
      ctx.stroke();
    }
  }

  drawCrosshair(ctx, x, y, color, size) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.moveTo(x - size * 1.5, y);
    ctx.lineTo(x + size * 1.5, y);
    ctx.moveTo(x, y - size * 1.5);
    ctx.lineTo(x, y + size * 1.5);
    ctx.stroke();
  }

  /**
   * Renderiza os Polígonos de Área de Interesse e Envoltória Convexa
   */
  renderAOIOverlay() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // 1. Polígono de Envoltória Convexa do Campo de Visão
    if (this.convexHull.length >= 3) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(this.convexHull[0].x * w, this.convexHull[0].y * h);
      for (let i = 1; i < this.convexHull.length; i++) {
        this.ctx.lineTo(this.convexHull[i].x * w, this.convexHull[i].y * h);
      }
      this.ctx.closePath();
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.06)';
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.lineWidth = 1.5;
      this.ctx.setLineDash([5, 5]);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // 2. Polígonos AOI (Áreas de Interesse)
    this.aois.forEach(aoi => {
      if (aoi.points.length < 3) return;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(aoi.points[0].x * w, aoi.points[0].y * h);
      for (let i = 1; i < aoi.points.length; i++) {
        this.ctx.lineTo(aoi.points[i].x * w, aoi.points[i].y * h);
      }
      this.ctx.closePath();

      // Preenchimento e brilho se o usuário estiver olhando no polígono
      if (aoi.isCurrentlyLooking) {
        this.ctx.fillStyle = this.hexToRgba(aoi.color, 0.28);
        this.ctx.strokeStyle = aoi.color;
        this.ctx.lineWidth = 3.5;
        this.ctx.shadowColor = aoi.color;
        this.ctx.shadowBlur = 12;
      } else {
        this.ctx.fillStyle = this.hexToRgba(aoi.color, 0.08);
        this.ctx.strokeStyle = this.hexToRgba(aoi.color, 0.7);
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 0;
      }

      this.ctx.fill();
      this.ctx.stroke();

      // Rótulo da Zona com Estatísticas
      const center = this.getPolygonCenter(aoi.points);
      const cx = center.x * w;
      const cy = center.y * h;

      const dwellSec = (aoi.dwellTimeMs / 1000).toFixed(1);
      const attentionPct = this.totalTrackingTimeMs > 0
        ? ((aoi.dwellTimeMs / this.totalTrackingTimeMs) * 100).toFixed(0)
        : 0;

      // Badge de texto
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = 'rgba(5, 10, 20, 0.85)';
      this.ctx.strokeStyle = aoi.color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.roundRect(cx - 75, cy - 18, 150, 36, 6);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 11px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(aoi.name, cx, cy - 3);

      this.ctx.fillStyle = aoi.color;
      this.ctx.font = '10px JetBrains Mono, monospace';
      this.ctx.fillText(`Tempo: ${dwellSec}s (${attentionPct}%)`, cx, cy + 11);

      this.ctx.restore();
    });

    // 3. Polígono em Desenho Ativo
    if (this.currentDrawingPoints.length > 0) {
      this.ctx.save();
      this.ctx.strokeStyle = '#ffff00';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(this.currentDrawingPoints[0].x * w, this.currentDrawingPoints[0].y * h);
      for (let i = 1; i < this.currentDrawingPoints.length; i++) {
        this.ctx.lineTo(this.currentDrawingPoints[i].x * w, this.currentDrawingPoints[i].y * h);
      }
      this.ctx.stroke();

      // Vértices
      this.currentDrawingPoints.forEach(p => {
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(p.x * w, p.y * h, 5, 0, Math.PI * 2);
        this.ctx.fill();
      });
      this.ctx.restore();
    }
  }

  /**
   * Algoritmo Ray-Casting (Jordan Curve Theorem)
   * Determina se um ponto está dentro de um polígono qualquer
   */
  isPointInPolygon(point, vs) {
    const x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].x, yi = vs[i].y;
      const xj = vs[j].x, yj = vs[j].y;

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Algoritmo de Graham Scan para Envoltória Convexa (Convex Hull)
   */
  calculateConvexHull(points) {
    if (points.length < 3) return [...points];

    // Clona e encontra ponto mais baixo (menor y, depois menor x)
    const pts = points.map(p => ({ x: p.x, y: p.y }));
    let startIdx = 0;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].y < pts[startIdx].y || (pts[i].y === pts[startIdx].y && pts[i].x < pts[startIdx].x)) {
        startIdx = i;
      }
    }
    const startPoint = pts.splice(startIdx, 1)[0];

    // Ordena pelo ângulo polar em relação a startPoint
    pts.sort((a, b) => {
      const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
      const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
      return angleA - angleB;
    });

    const stack = [startPoint, pts[0], pts[1]];
    for (let i = 2; i < pts.length; i++) {
      let top = stack.length - 1;
      while (stack.length >= 2 && this.ccw(stack[top - 1], stack[top], pts[i]) <= 0) {
        stack.pop();
        top = stack.length - 1;
      }
      stack.push(pts[i]);
    }
    return stack;
  }

  ccw(p1, p2, p3) {
    return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  }

  getPolygonCenter(points) {
    let sumX = 0, sumY = 0;
    points.forEach(p => {
      sumX += p.x;
      sumY += p.y;
    });
    return {
      x: sumX / points.length,
      y: sumY / points.length
    };
  }

  hexToRgba(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16) || 0;
    const g = parseInt(c.substring(2, 4), 16) || 0;
    const b = parseInt(c.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  getAOIStats() {
    return this.aois.map(aoi => ({
      id: aoi.id,
      name: aoi.name,
      color: aoi.color,
      dwellTimeSec: (aoi.dwellTimeMs / 1000).toFixed(2),
      attentionPct: this.totalTrackingTimeMs > 0
        ? Number(((aoi.dwellTimeMs / this.totalTrackingTimeMs) * 100).toFixed(1))
        : 0,
      fixationCount: aoi.fixationCount,
      ttffMs: aoi.firstFixationTime !== null ? aoi.firstFixationTime : 'N/A'
    }));
  }

  reset() {
    this.sessionStartTime = performance.now();
    this.totalTrackingTimeMs = 0;
    this.lastUpdateTime = performance.now();
    this.recentGazePoints = [];
    this.convexHull = [];
    this.aois.forEach(aoi => {
      aoi.dwellTimeMs = 0;
      aoi.fixationCount = 0;
      aoi.firstFixationTime = null;
      aoi.isCurrentlyLooking = false;
    });
  }
}
