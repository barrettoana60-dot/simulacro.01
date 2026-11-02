# 👁️ OCULUS-AI // Sistema de Deep Learning para Rastreamento Ocular, Campo de Visão 3D e Mapas de Calor

Sistema de ponta para **Eye-Tracking biométrico em tempo real**, estimativa de vetor de olhar (*Gaze Estimation*), projeção volumétrica do **Campo de Visão 3D (Field of View - FOV)**, geração contínua de **Mapas de Calor de Atenção Visual** e cálculo analítico de **Polígonos Anatômicos e de Áreas de Interesse (AOI)**.

Projetado para execução 100% *client-side* acelerada por hardware (WebGL / WebGPU / WASM), garantindo latência ultrabaixa (< 16 ms / 60 FPS), privacidade total dos dados biométricos e implantação imediata na plataforma **Vercel** sem necessidade de servidores GPU dedicados.

---

## 🌟 Principais Recursos

### 1. 🧠 Núcleo de Deep Learning & Machine Learning
- **Rede Neural Convolucional Profunda**: MediaPipe Face Mesh com modelo de refinamento de íris sub-milimétrico (478 marcos 3D faciais e oculares).
- **Rastreamento de Pupilas e Íris**: Extração direta dos centros das íris (marcos 468 e 473) e perímetros circulares (marcos 469–472 e 474–477).
- **Classificação Fisiológica de Piscadas**: Cálculo contínuo do *Eye Aspect Ratio* (EAR) para detecção de piscadas e taxa por minuto (BPM).
- **Estimativa de Pose da Cabeça 3D**: Projeção de perspectiva (*Perspective-n-Point*) calculando ângulos de Euler (Pitch, Yaw e Roll) para compensação dinâmica do olhar.
- **Calibração Polinomial Adaptativa**: Algoritmo de Regressão Polinomial Bivariada Regularizada (*Ridge Regression*) com grid guiado de 9 ou 5 pontos.
- **Simulador Fisiológico Sintético**: Modo de demonstração com microssacadas realistas, perseguição lenta e piscares caso a webcam não esteja conectada.

### 2. 🌐 Campo de Visão 3D Dimensional (FOV // Three.js)
- **Globos Oculares Anatômicos 3D**: Modelagem volumétrica com esclera, íris e pupila rotacionando em tempo real com base no vetor óptico detectado.
- **Cones do Campo de Visão**:
  - **Cone Foveal ($\approx 2^\circ$)**: Região central de máxima acuidade visual e concentração de cones foveais.
  - **Cone Parafoveal ($\approx 10^\circ$)**: Zona intermediária de reconhecimento de caracteres e estímulos.
  - **Frustum Periférico ($160^\circ \times 135^\circ$)**: Campo visual binocular completo para detecção de movimento e orientação espacial.
- **Raio de Olhar e Impacto 3D**: Traçado do vetor óptico projetado até o plano de tela virtual.
- **Nuvem de Pontos Facial 3D**: Malha em tempo real representando a geometria tridimensional do crânio.

### 3. 🔥 Mapas de Calor de Atenção Visual & Scanpaths
- **Renderizador de Alta Densidade**: Acúmulo por kernel gaussiano radial com colorização via tabelas de cores (*Lookup Tables* de 256 níveis).
- **5 Paletas Cromáticas**: Turbo (Rainbow), Inferno (Térmico), Viridis (Científico), Jet (Clássico) e Neon Cyberpunk.
- **Algoritmo I-VT (*Velocity-Threshold Identification*)**: Separação precisa entre **Fixações** (pausas cognitivas) e **Sacadas** (saltos balísticos).
- **Scanpath Vetorial**: Sequência numerada de círculos com diâmetro proporcional à duração da fixação e linhas de sacadas orientadas.
- **Estímulos Customizados**: Suporte a upload de imagens/telas personalizadas para testes de usabilidade (UX) e leitura.
- **Exportação PNG**: Salvamento em 1 clique do mapa de calor em alta resolução.

### 4. 📐 Polígonos Anatômicos e Áreas de Interesse (AOIs)
- **Polígonos Anatômicos Oculares**: Contorno das pálpebras superior/inferior, esclera e elipse da íris desenhados sobre a câmera.
- **Envoltória Convexa (*Convex Hull*)**: Algoritmo de *Graham Scan* $\mathcal{O}(N \log N)$ delimitando em tempo real o polígono de exploração do campo visual.
- **Áreas de Interesse (AOIs)**: Polígonos dinâmicos com teste de inclusão *Ray-Casting* (Teorema da Curva de Jordan):
  - *Dwell Time* (tempo de permanência em segundos e porcentagem).
  - *Fixation Count* (quantidade de fixações dentro do polígono).
  - *Time to First Fixation* (TTFF - tempo em ms até o primeiro olhar).

### 5. 📊 Telemetria de Coordenadas & Exportação Clínica
- **HUD em Tempo Real**: Coordenadas cartesianas 3D dos olhos em milímetros ($X, Y, Z$), ponto de olhar na tela ($X_{px}, Y_{px}$ e normalizado), ângulo visual e distância interpupilar (IPD).
- **Osciloscópio Biométrico**: Monitor multicanal em tempo real traçando Gaze X, Gaze Y e abertura palpebral (EAR).
- **Exportação CSV & JSON**: Datasets completos formatados para análise em Python/Pandas, R ou MATLAB.

---

## 📐 Fundamentação Matemática

### 1. Detecção de Piscada (Eye Aspect Ratio - EAR)
$$\text{EAR} = \frac{\|p_2 - p_6\| + \|p_3 - p_5\|}{2 \|p_1 - p_4\|}$$
Onde $p_1, \dots, p_6$ são os marcos anatômicos das comissuras e bordas palpebrais.

### 2. Mapeamento Polinomial de Olhar (Ridge Regression)
Vetor de características expandido:
$$\phi(u, v, \text{yaw}, \text{pitch}) = \begin{bmatrix} 1 & u & v & u^2 & v^2 & uv & \text{yaw} & \text{pitch} \end{bmatrix}^T$$
A solução ótima de pesos $W$ minimizando o erro quadrático com regularização $\ell_2$:
$$W = \left(\Phi^T \Phi + \lambda I\right)^{-1} \Phi^T Y$$

### 3. Cones do Campo de Visão (FOV)
O raio da base do cone foveal a uma distância $L$ da retina:
$$R_{\text{foveal}} = L \cdot \tan\left(\frac{\theta_{\text{foveal}}}{2}\right) \approx L \cdot \tan(1^\circ)$$

---

## 🚀 Como Executar e Implantar no Vercel

O projeto foi construído no padrão **Zero-Config Static Web Application**, garantindo 100% de compatibilidade nativa com o **Vercel**.

### Implantação no Vercel (1 Clique):
1. Acesse o painel do [Vercel](https://vercel.com).
2. Clique em **"Add New..."** > **"Project"**.
3. Importe o repositório `barrettoana60-dot/simulacro.01`.
4. Mantenha as configurações padrão (Framework Preset: *Other*).
5. Clique em **"Deploy"**.
6. O projeto estará no ar com HTTPS ativado (essencial para permissão de webcam pelo navegador).

### Execução Local:
Para rodar localmente no seu computador:
```bash
# Com Python 3:
python3 -m http.server 3000

# Ou com Node.js / npx:
npx serve .
```
Acesse `http://localhost:3000` no seu navegador (Chrome, Edge, Firefox ou Safari).

---

## 📁 Estrutura do Código

```
simulacro.01/
├── index.html            # Interface Cyber-Biométrica e HUD 3D
├── vercel.json           # Configuração de headers e permissões Vercel
├── package.json          # Metadados do projeto
├── css/
│   └── style.css         # Estilização Glassmorphism e animações biométricas
├── js/
│   ├── app.js            # Orquestrador mestre e eventos de UI
│   ├── tracker.js        # MediaPipe FaceMesh & detecção de íris 478 marcos
│   ├── calibration.js    # Regressão polinomial bivariada (Ridge)
│   ├── three-fov.js      # Cena Three.js, globos oculares e cones FOV
│   ├── heatmap.js        # Motor de mapa de calor em tempo real e I-VT
│   ├── polygons.js       # Polígonos oculares, Convex Hull e AOIs
│   ├── telemetry.js      # Osciloscópio e exportação CSV/JSON
│   └── simulator.js      # Simulador de cinemática ocular humana
└── README.md             # Documentação técnica e científica
```

---

## 🔒 Privacidade e Segurança
- Todo o processamento de imagens e inferência por redes neurais ocorre **estritamente no dispositivo do usuário (client-side)**.
- Nenhum quadro de vídeo ou coordenada biométrica é transmitido para servidores externos.
- Headers HTTP configurados em `vercel.json` garantem políticas estritas de proteção `X-Content-Type-Options`, `X-Frame-Options` e `Permissions-Policy`.

---

## 📄 Licença
Distribuído sob licença MIT. Desenvolvido para pesquisa científica, análise de usabilidade e visão computacional avançada.