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