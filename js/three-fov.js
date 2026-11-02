/**
 * OCULUS-AI // 3D Field of View (FOV) & Visual Cone Engine (Three.js)
 * Renderiza em tempo real o globo ocular 3D, cones do campo de visão (foveal 2°,
 * parafoveal 10°, periférico 160°x135°), raio de olhar 3D e malha facial.
 */

export class ThreeVisualizer {
  constructor(containerElement) {
    this.container = containerElement;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.animationFrameId = null;

    // Elementos 3D
    this.leftEyeball = null;
    this.rightEyeball = null;
    this.gazeRayGroup = null;
    this.fovConesGroup = null;
    this.faceCloud = null;
    this.screenPlane = null;
    this.hitPoint = null;

    // Configurações do Campo de Visão
    this.showCones = true;
    this.showRay = true;
    this.showFaceCloud = true;
    this.showScreenPlane = true;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 450;

    // 1. Cena Three.js
    this.scene = new window.THREE.Scene();
    this.scene.background = new window.THREE.Color(0x070b14);
    this.scene.fog = new window.THREE.FogExp2(0x070b14, 0.002);

    // 2. Câmera Perspectiva
    this.camera = new window.THREE.PerspectiveCamera(45, width / height, 1, 3000);
    this.camera.position.set(0, 50, 480);

    // 3. Renderer WebGL com Anti-Aliasing
    this.renderer = new window.THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    if (window.THREE.OrbitControls) {
      this.controls = new window.THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxDistance = 1500;
      this.controls.minDistance = 50;
      this.controls.target.set(0, 0, 0);
    }

    // 5. Iluminação
    this.setupLighting();

    // 6. Grid e Eixos de Referência
    this.setupEnvironment();

    // 7. Globos Oculares 3D Anatômicos
    this.setupEyeballs();

    // 8. Cones 3D do Campo de Visão (Foveal, Parafoveal, Periférico)
    this.setupFOVCones();

    // 9. Nuvem de Pontos da Face 3D
    this.setupFacePointCloud();

    // 10. Plano de Projeção Virtual da Tela
    this.setupScreenPlane();

    // Loop de Renderização
    this.animate();

    // Resize Observer
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);
  }

  setupLighting() {
    const ambientLight = new window.THREE.AmbientLight(0x223355, 1.5);
    this.scene.add(ambientLight);

    const keyLight = new window.THREE.DirectionalLight(0x00f0ff, 2.0);
    keyLight.position.set(100, 150, 200);
    this.scene.add(keyLight);

    const fillLight = new window.THREE.DirectionalLight(0x7000ff, 1.2);
    fillLight.position.set(-100, -100, -100);
    this.scene.add(fillLight);

    const topLight = new window.THREE.PointLight(0xffffff, 0.8, 1000);
    topLight.position.set(0, 200, 0);
    this.scene.add(topLight);
  }

  setupEnvironment() {
    // Grid cybernético no chão
    const gridHelper = new window.THREE.GridHelper(800, 40, 0x00f0ff, 0x112233);
    gridHelper.position.y = -120;
    this.scene.add(gridHelper);
  }

  createEyeballMesh() {
    const group = new window.THREE.Group();

    // Esclera (Globo Branco com reflexo perolado)
    const scleraGeo = new window.THREE.SphereGeometry(14, 32, 32);
    const scleraMat = new window.THREE.MeshPhongMaterial({
      color: 0xeeeeee,
      shininess: 90,
      specular: 0x555555
    });
    const scleraMesh = new window.THREE.Mesh(scleraGeo, scleraMat);
    group.add(scleraMesh);

    // Íris (Disco colorido azul ciano biométrico)
    const irisGeo = new window.THREE.CircleGeometry(6.2, 32);
    const irisMat = new window.THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      side: window.THREE.DoubleSide
    });
    const irisMesh = new window.THREE.Mesh(irisGeo, irisMat);
    irisMesh.position.z = 13.6;
    group.add(irisMesh);

    // Borda da Íris (Anel escuro)
    const ringGeo = new window.THREE.RingGeometry(5.8, 6.4, 32);
    const ringMat = new window.THREE.MeshBasicMaterial({
      color: 0x004466,
      side: window.THREE.DoubleSide
    });
    const ringMesh = new window.THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.z = 13.65;
    group.add(ringMesh);

    // Pupila (Centro negro)
    const pupilGeo = new window.THREE.CircleGeometry(2.8, 32);
    const pupilMat = new window.THREE.MeshBasicMaterial({
      color: 0x020509,
      side: window.THREE.DoubleSide
    });
    const pupilMesh = new window.THREE.Mesh(pupilGeo, pupilMat);
    pupilMesh.position.z = 13.7;
    group.add(pupilMesh);

    // Brilho da Córnea
    const glintGeo = new window.THREE.CircleGeometry(0.8, 16);
    const glintMat = new window.THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: window.THREE.DoubleSide
    });
    const glintMesh = new window.THREE.Mesh(glintGeo, glintMat);
    glintMesh.position.set(1.5, 1.5, 13.75);
    group.add(glintMesh);

    return group;
  }

  setupEyeballs() {
    // Distância interpupilar anatômica média (IPD = ~63mm)
    const ipdOffset = 31.5;

    this.leftEyeball = this.createEyeballMesh();
    this.leftEyeball.position.set(ipdOffset, 0, 0);
    this.scene.add(this.leftEyeball);

    this.rightEyeball = this.createEyeballMesh();
    this.rightEyeball.position.set(-ipdOffset, 0, 0);
    this.scene.add(this.rightEyeball);
  }

  setupFOVCones() {
    this.fovConesGroup = new window.THREE.Group();

    // 1. Cone Foveal (Visão Central Aguda ~2° de abertura)
    // Raio da base = tan(1°) * comprimento = 0.0175 * 250 = ~4.4
    const fovealLength = 260;
    const fovealRadius = Math.tan((1.5 * Math.PI) / 180) * fovealLength;
    const fovealGeo = new window.THREE.ConeGeometry(fovealRadius, fovealLength, 32, 1, true);
    // Move a base para a frente ao longo de Z
    fovealGeo.translate(0, -fovealLength / 2, 0);
    fovealGeo.rotateX(-Math.PI / 2);

    const fovealMat = new window.THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.45,
      wireframe: false,
      side: window.THREE.DoubleSide
    });
    const fovealCone = new window.THREE.Mesh(fovealGeo, fovealMat);
    this.fovConesGroup.add(fovealCone);

    // 2. Cone Parafoveal (Reconhecimento de Palavras e Detalhes ~10° de abertura)
    const parafovealRadius = Math.tan((5.0 * Math.PI) / 180) * fovealLength;
    const parafovealGeo = new window.THREE.ConeGeometry(parafovealRadius, fovealLength, 32, 1, true);
    parafovealGeo.translate(0, -fovealLength / 2, 0);
    parafovealGeo.rotateX(-Math.PI / 2);

    const parafovealMat = new window.THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.18,
      wireframe: false,
      side: window.THREE.DoubleSide
    });
    const parafovealCone = new window.THREE.Mesh(parafovealGeo, parafovealMat);
    this.fovConesGroup.add(parafovealCone);

    // 3. Frustum do Campo de Visão Periférico (~160° horizontal x 135° vertical)
    const peripheralRadius = Math.tan((35.0 * Math.PI) / 180) * (fovealLength * 0.75);
    const peripheralGeo = new window.THREE.ConeGeometry(peripheralRadius, fovealLength * 0.75, 24, 4, true);
    peripheralGeo.translate(0, -(fovealLength * 0.75) / 2, 0);
    peripheralGeo.rotateX(-Math.PI / 2);

    const peripheralMat = new window.THREE.MeshBasicMaterial({
      color: 0x7700ff,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      side: window.THREE.DoubleSide
    });
    const peripheralFrustum = new window.THREE.Mesh(peripheralGeo, peripheralMat);
    this.fovConesGroup.add(peripheralFrustum);

    // Raio Laser Central do Vetor de Olhar
    const rayGeo = new window.THREE.BufferGeometry().setFromPoints([
      new window.THREE.Vector3(0, 0, 0),
      new window.THREE.Vector3(0, 0, 350)
    ]);
    const rayMat = new window.THREE.LineBasicMaterial({
      color: 0x00ffcc,
      linewidth: 3
    });
    const rayLine = new window.THREE.Line(rayGeo, rayMat);
    this.fovConesGroup.add(rayLine);

    this.scene.add(this.fovConesGroup);
  }

  setupFacePointCloud() {
    // Nuvem de pontos estilizada para representar os 478 marcos do FaceMesh
    const particleCount = 478;
    const geometry = new window.THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const baseColor = new window.THREE.Color(0x00f0ff);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    geometry.setAttribute('position', new window.THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new window.THREE.BufferAttribute(colors, 3));

    const material = new window.THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.65
    });

    this.faceCloud = new window.THREE.Points(geometry, material);
    this.scene.add(this.faceCloud);
  }

  setupScreenPlane() {
    // Plano que simula a tela do monitor a 280 unidades à frente
    const planeGeo = new window.THREE.PlaneGeometry(360, 220);
    const planeMat = new window.THREE.MeshBasicMaterial({
      color: 0x0f1c30,
      transparent: true,
      opacity: 0.5,
      side: window.THREE.DoubleSide
    });
    this.screenPlane = new window.THREE.Mesh(planeGeo, planeMat);
    this.screenPlane.position.set(0, 0, 280);

    // Borda da Tela
    const wireGeo = new window.THREE.EdgesGeometry(planeGeo);
    const wireMat = new window.THREE.LineBasicMaterial({ color: 0x00f0ff, linewidth: 2 });
    const wireMesh = new window.THREE.LineSegments(wireGeo, wireMat);
    this.screenPlane.add(wireMesh);

    // Ponto de Impacto do Olhar (Hit Point)
    const hitGeo = new window.THREE.SphereGeometry(4, 16, 16);
    const hitMat = new window.THREE.MeshBasicMaterial({ color: 0xff0055 });
    this.hitPoint = new window.THREE.Mesh(hitGeo, hitMat);
    this.screenPlane.add(this.hitPoint);

    this.scene.add(this.screenPlane);
  }

  /**
   * Atualiza a orientação e rotação do modelo 3D com dados de rastreamento
   */
  update(eyeData, gazePrediction) {
    if (!eyeData || !eyeData.detected) return;

    // 1. Rotação do Olhar em Radianos
    // Mapeia proporção da íris (0.0 a 1.0) para ângulos oculares (-25° a +25°)
    const leftRatioX = eyeData.leftRatios ? eyeData.leftRatios.x : 0.5;
    const leftRatioY = eyeData.leftRatios ? eyeData.leftRatios.y : 0.5;
    const rightRatioX = eyeData.rightRatios ? eyeData.rightRatios.x : 0.5;
    const rightRatioY = eyeData.rightRatios ? eyeData.rightRatios.y : 0.5;

    const leftYaw = (leftRatioX - 0.5) * 0.9;
    const leftPitch = -(leftRatioY - 0.5) * 0.7;

    const rightYaw = (rightRatioX - 0.5) * 0.9;
    const rightPitch = -(rightRatioY - 0.5) * 0.7;

    if (this.leftEyeball) {
      this.leftEyeball.rotation.y = leftYaw;
      this.leftEyeball.rotation.x = leftPitch;
    }

    if (this.rightEyeball) {
      this.rightEyeball.rotation.y = rightYaw;
      this.rightEyeball.rotation.x = rightPitch;
    }

    // 2. Orientação do Cone FOV e Raio 3D
    const avgYaw = (leftYaw + rightYaw) / 2;
    const avgPitch = (leftPitch + rightPitch) / 2;

    if (this.fovConesGroup) {
      this.fovConesGroup.rotation.y = avgYaw;
      this.fovConesGroup.rotation.x = avgPitch;
    }

    // 3. Atualização do Ponto de Impacto na Tela Virtual 3D
    if (this.hitPoint && gazePrediction) {
      const planeWidth = 360;
      const planeHeight = 220;
      const hitX = (gazePrediction.normX - 0.5) * planeWidth;
      const hitY = -(gazePrediction.normY - 0.5) * planeHeight;
      this.hitPoint.position.set(hitX, hitY, 1);
    }

    // 4. Atualização da Nuvem de Marcos 3D Faciais
    if (this.faceCloud && eyeData.allLandmarks && this.showFaceCloud) {
      const posAttr = this.faceCloud.geometry.attributes.position;
      const landmarks = eyeData.allLandmarks;

      const scale = 220;
      for (let i = 0; i < landmarks.length && i < 478; i++) {
        const lm = landmarks[i];
        // Centraliza em relação ao nariz
        const nx = (0.5 - lm.x) * scale;
        const ny = (0.5 - lm.y) * scale;
        const nz = -lm.z * scale * 1.5;

        posAttr.setXYZ(i, nx, ny, nz);
      }
      posAttr.needsUpdate = true;
    }
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (this.controls) {
      this.controls.update();
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(0, 50, 480);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  toggleFOVCones(visible) {
    this.showCones = visible;
    if (this.fovConesGroup) this.fovConesGroup.visible = visible;
  }

  toggleFaceCloud(visible) {
    this.showFaceCloud = visible;
    if (this.faceCloud) this.faceCloud.visible = visible;
  }

  toggleScreenPlane(visible) {
    this.showScreenPlane = visible;
    if (this.screenPlane) this.screenPlane.visible = visible;
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.renderer && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
