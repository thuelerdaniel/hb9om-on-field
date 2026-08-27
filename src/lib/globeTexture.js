import * as THREE from "three";

// Shared Globe Texture Utility — laedt eine echte Erdtextur von CDN
// und faellt auf eine prozedurale Textur zurueck, falls CDN nicht erreichbar.

export function createProceduralGlobeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
  gradient.addColorStop(0, '#0a1929');
  gradient.addColorStop(0.5, '#0d2538');
  gradient.addColorStop(1, '#0a1929');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2048, 1024);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 24; i++) { ctx.beginPath(); ctx.moveTo(i * (2048 / 24), 0); ctx.lineTo(i * (2048 / 24), 1024); ctx.stroke(); }
  for (let i = 0; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(0, i * (1024 / 12)); ctx.lineTo(2048, i * (1024 / 12)); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 512); ctx.lineTo(2048, 512); ctx.stroke();
  return new THREE.CanvasTexture(canvas);
}

const EARTH_TEXTURE_URL = 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg';

// Laedt asynchron eine Erdtextur und ersetzt die prozedurale Textur im Material.
// Falls CDN nicht erreichbar: bleibt die prozedurale Textur aktiv.
export function loadEarthTexture(material) {
  try {
    const loader = new THREE.TextureLoader();
    loader.load(
      EARTH_TEXTURE_URL,
      (texture) => {
        try { texture.colorSpace = THREE.SRGBColorSpace; } catch {}
        material.map = texture;
        material.opacity = 1.0;
        material.needsUpdate = true;
      },
      undefined,
      () => {} // silently fail — procedural texture stays
    );
  } catch {}
}

// Prozedurale Mond-Textur — Canvas-basiert mit Maria (dunkle Ebenen) und Kratern.
// Realistische grau-Töne mit Krater-Simulation per Noise + Radial-Gradienten.
export function createProceduralMoonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Basis-Oberfläche (mittleres Grau)
  ctx.fillStyle = '#9e9e9e';
  ctx.fillRect(0, 0, 1024, 512);

  // Oberflächen-Rauschen für natürliche Textur
  const imageData = ctx.getImageData(0, 0, 1024, 512);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 40;
    const val = Math.max(70, Math.min(180, 158 + noise));
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val - 5;
  }
  ctx.putImageData(imageData, 0, 0);

  // Maria (dunkle Ebenen — große, weiche dunkle Bereiche)
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 100 + 50;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(60, 60, 65, 0.5)');
    gradient.addColorStop(0.7, 'rgba(60, 60, 65, 0.2)');
    gradient.addColorStop(1, 'rgba(60, 60, 65, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Krater — heller Rand, dunkleres Inner, versetzter Schatten
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = Math.random() * 30 + 4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200, 200, 200, 0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80, 80, 80, 0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(50, 50, 50, 0.3)';
    ctx.fill();
  }

  // Contrast +30%, Brightness -10% für stärkere Struktur
  const finalData = ctx.getImageData(0, 0, 1024, 512);
  const fd = finalData.data;
  const contrast = 1.3;
  const brightness = -25.5;
  for (let i = 0; i < fd.length; i += 4) {
    fd[i] = Math.max(0, Math.min(255, contrast * (fd[i] - 128) + 128 + brightness));
    fd[i + 1] = Math.max(0, Math.min(255, contrast * (fd[i + 1] - 128) + 128 + brightness));
    fd[i + 2] = Math.max(0, Math.min(255, contrast * (fd[i + 2] - 128) + 128 + brightness));
  }
  ctx.putImageData(finalData, 0, 0);

  return new THREE.CanvasTexture(canvas);
}

// Bump-Textur für den Mond — Graustufen-Krater-Map für bumpMap.
// Heller = höher (Krater-Rand), Dunkler = tiefer (Krater-Inner).
export function createMoonBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = Math.random() * 20 + 5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(220, 220, 220, 0.6)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(40, 40, 40, 0.7)';
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}