import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { maidenheadToLatLon } from "@/lib/geoUtilsFrontend";
import { createProceduralGlobeTexture, loadEarthTexture } from "@/lib/globeTexture";

// 3D Globus mit three.js — zeigt alle QSO-Positionen als leuchtende Punkte.
// Rotation per Maus/Touch-Drag, Zoom per Scrollrad/Pinch.
// Auto-Rotation nach 3s Inaktivität.

function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function createGlobeTexture() {
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
  for (let i = 0; i <= 24; i++) {
    ctx.beginPath();
    ctx.moveTo(i * (2048 / 24), 0);
    ctx.lineTo(i * (2048 / 24), 1024);
    ctx.stroke();
  }
  for (let i = 0; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * (1024 / 12));
    ctx.lineTo(2048, i * (1024 / 12));
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 512);
  ctx.lineTo(2048, 512);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

export default function QsoGlobe({ entries }) {
  const containerRef = useRef(null);

  const qsoData = useMemo(() => {
    const points = [];
    const myPositions = [];
    const arcs = [];

    for (const e of entries) {
      let partnerPos = e.operator_grid ? maidenheadToLatLon(e.operator_grid) : null;
      let myPos = e.my_grid ? maidenheadToLatLon(e.my_grid) : null;

      if (partnerPos) {
        points.push({ ...partnerPos, callsign: e.callsign, band: e.band, mode: e.mode });
        if (myPos) arcs.push({ from: myPos, to: partnerPos });
      }
      if (myPos && !myPositions.some(p => Math.abs(p.lat - myPos.lat) < 0.01 && Math.abs(p.lon - myPos.lon) < 0.01)) {
        myPositions.push(myPos);
      }
    }

    return { points, myPositions, arcs };
  }, [entries]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const texture = createProceduralGlobeTexture();
    const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
    const sphereMat = new THREE.MeshPhongMaterial({ map: texture, transparent: true, opacity: 0.95, shininess: 3 });
    loadEarthTexture(sphereMat);
    globeGroup.add(new THREE.Mesh(sphereGeo, sphereMat));

    const atmGeo = new THREE.SphereGeometry(1.08, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.08, side: THREE.BackSide });
    globeGroup.add(new THREE.Mesh(atmGeo, atmMat));

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(5, 3, 5);
    scene.add(dir);

    // QSO points (cyan)
    const dotGeo = new THREE.SphereGeometry(0.018, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    for (const p of qsoData.points) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(latLonToVec3(p.lat, p.lon, 1.01));
      globeGroup.add(dot);
    }

    // My positions (green, larger)
    const myDotGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const myDotMat = new THREE.MeshBasicMaterial({ color: 0x8cff00 });
    for (const p of qsoData.myPositions) {
      const dot = new THREE.Mesh(myDotGeo, myDotMat);
      dot.position.copy(latLonToVec3(p.lat, p.lon, 1.01));
      globeGroup.add(dot);
    }

    // Arc lines from my positions to QSO points
    for (const arc of qsoData.arcs) {
      const fromVec = latLonToVec3(arc.from.lat, arc.from.lon, 1);
      const toVec = latLonToVec3(arc.to.lat, arc.to.lon, 1);
      const segments = 50;
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const p = new THREE.Vector3().lerpVectors(fromVec, toVec, t).normalize();
        p.multiplyScalar(1 + Math.sin(t * Math.PI) * 0.15);
        pts.push(p);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.35 });
      globeGroup.add(new THREE.Line(geo, mat));
    }

    let rotX = 0.3, rotY = 0;
    let autoRotate = true;
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let autoRotateTimer = null;

    const stopAutoRotate = () => {
      autoRotate = false;
      if (autoRotateTimer) clearTimeout(autoRotateTimer);
      autoRotateTimer = setTimeout(() => { autoRotate = true; }, 3000);
    };

    const onPointerDown = (x, y) => { isDragging = true; stopAutoRotate(); prevX = x; prevY = y; };
    const onPointerMove = (x, y) => {
      if (!isDragging) return;
      rotY += (x - prevX) * 0.005;
      rotX += (y - prevY) * 0.005;
      rotX = Math.max(-1.4, Math.min(1.4, rotX));
      prevX = x; prevY = y;
    };
    const onPointerUp = () => { isDragging = false; };

    const onMouseDown = (e) => onPointerDown(e.clientX, e.clientY);
    const onMouseMove = (e) => onPointerMove(e.clientX, e.clientY);
    const onMouseUp = () => onPointerUp();
    const onWheel = (e) => {
      e.preventDefault();
      camera.position.z = Math.max(1.5, Math.min(6, camera.position.z + e.deltaY * 0.002));
    };
    const onTouchStart = (e) => { if (e.touches.length === 1) onPointerDown(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchMove = (e) => { if (e.touches.length === 1) { e.preventDefault(); onPointerMove(e.touches[0].clientX, e.touches[0].clientY); } };
    const onTouchEnd = () => onPointerUp();

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (autoRotate && !isDragging) rotY += 0.002;
      globeGroup.rotation.x = rotX;
      globeGroup.rotation.y = rotY;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      if (autoRotateTimer) clearTimeout(autoRotateTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('touchstart', onTouchStart);
      renderer.domElement.removeEventListener('touchmove', onTouchMove);
      renderer.domElement.removeEventListener('touchend', onTouchEnd);
      renderer.dispose();
      texture.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
      });
    };
  }, [qsoData]);

  return <div ref={containerRef} className="w-full h-full" style={{ touchAction: 'none', cursor: 'grab' }} />;
}