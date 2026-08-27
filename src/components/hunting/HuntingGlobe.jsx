import React, { useState, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Globe, Loader2, Radio } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon } from "@/lib/geoUtilsFrontend";
import { createProceduralGlobeTexture, loadEarthTexture, createProceduralMoonTexture } from "@/lib/globeTexture";

// 3D Hunting Globe — drehbare Weltkugel mit allen aktiven Spots.
// Station QTH = rot, SOTA = orange, POTA = gruen, DX = cyan, andere Aktivitaeten = gelb.
// Layer-Filter: Alle, DX, SOTA, POTA, Andere. Klick auf Spot oeffnet Details (Raycasting).

const LayerFilters = [
  { id: 'all', label: 'Alle', color: '#00e5ff' },
  { id: 'dx', label: 'DX', color: '#ef4444' },
  { id: 'sota', label: 'SOTA', color: '#3b82f6' },
  { id: 'pota', label: 'POTA', color: '#22c55e' },
  { id: 'other', label: 'Andere', color: '#ffc400' },
];

function latLonToVec3(lat, lon, radius) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// createGlobeTexture wird aus globeTexture.js importiert (createProceduralGlobeTexture + loadEarthTexture)

export default function HuntingGlobe({ gpsPos, stationInfo, onSpotClick }) {
  const containerRef = useRef(null);
  const [activities, setActivities] = useState([]);
  const [dxSpots, setDxSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showPropagation, setShowPropagation] = useState(true);
  const [webglError, setWebglError] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const rotationRef = useRef(true);
  rotationRef.current = rotationEnabled;

  const stationPos = useMemo(() => {
    if (gpsPos) return { lat: gpsPos.lat, lon: gpsPos.lng };
    if (stationInfo?.locator) {
      const p = maidenheadToLatLon(stationInfo.locator);
      return p || { lat: 46.5, lon: 6.5 };
    }
    return { lat: 46.5, lon: 6.5 };
  }, [gpsPos, stationInfo]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [actList, dxList] = await Promise.all([
          base44.entities.ActivitySpot.list("-spot_time", 500),
          base44.entities.DxSpot.list("-spot_time", 200),
        ]);
        setActivities((actList || []).filter(s => s.latitude != null && s.longitude != null));
        setDxSpots((dxList || []).filter(s => s.lat != null && s.lng != null));
      } catch {} finally { setLoading(false); }
    };
    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const spotsByLayer = useMemo(() => {
    const sota = activities.filter(s => s.activity_type === 'SOTA');
    const pota = activities.filter(s => s.activity_type === 'POTA');
    const dx = dxSpots.filter(s => !s.activity);
    const other = dxSpots.filter(s => s.activity && s.activity !== 'SOTA' && s.activity !== 'POTA');
    return { sota, pota, dx, other };
  }, [activities, dxSpots]);

  const visibleSpots = useMemo(() => {
    const all = [];
    if (activeFilter === 'all' || activeFilter === 'sota') {
      spotsByLayer.sota.forEach(s => all.push({ ...s, _type: 'sota', _lat: s.latitude, _lng: s.longitude, _color: '#3b82f6' }));
    }
    if (activeFilter === 'all' || activeFilter === 'pota') {
      spotsByLayer.pota.forEach(s => all.push({ ...s, _type: 'pota', _lat: s.latitude, _lng: s.longitude, _color: '#22c55e' }));
    }
    if (activeFilter === 'all' || activeFilter === 'dx') {
      spotsByLayer.dx.forEach(s => all.push({ ...s, _type: 'dx', _lat: s.lat, _lng: s.lng, _color: '#ef4444' }));
    }
    if (activeFilter === 'all' || activeFilter === 'other') {
      spotsByLayer.other.forEach(s => all.push({ ...s, _type: 'other', _lat: s.lat, _lng: s.lng, _color: '#ffc400' }));
    }
    return all;
  }, [spotsByLayer, activeFilter]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || loading) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      setWebglError(true);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 3;

    renderer.setSize(width, height);
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

    // Mond — um die Erde kreisend
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);
    const moonGeo = new THREE.SphereGeometry(0.27, 32, 32);
    const moonTexture = createProceduralMoonTexture();
    const moonMat = new THREE.MeshStandardMaterial({ map: moonTexture, roughness: 0.95, metalness: 0.0 });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(1.8, 0, 0);
    moonGroup.add(moon);

    // ISS — Mini-Modell mit Modulen und Solarpanels
    const issGroup = new THREE.Group();
    scene.add(issGroup);
    const issModel = new THREE.Group();
    const moduleMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const mod1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.015, 0.015), moduleMat);
    const mod2 = new THREE.Mesh(new THREE.BoxGeometry(0.020, 0.012, 0.012), moduleMat);
    mod2.position.x = 0.025;
    const mod3 = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.010, 0.010), moduleMat);
    mod3.position.x = -0.022;
    issModel.add(mod1, mod2, mod3);
    const panelMat = new THREE.MeshBasicMaterial({ color: 0x1a3a6a, side: THREE.DoubleSide });
    const panelFrameMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.003, 0.003), panelFrameMat);
    leftArm.position.x = -0.035;
    const leftPanel1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.001), panelMat);
    leftPanel1.position.x = -0.065;
    const leftPanel2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.001), panelMat);
    leftPanel2.position.x = -0.105;
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.003, 0.003), panelFrameMat);
    rightArm.position.x = 0.035;
    const rightPanel1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.001), panelMat);
    rightPanel1.position.x = 0.065;
    const rightPanel2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.001), panelMat);
    rightPanel2.position.x = 0.105;
    issModel.add(leftArm, leftPanel1, leftPanel2, rightArm, rightPanel1, rightPanel2);
    const issLight = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffff00 }));
    issLight.position.set(0, 0.01, 0);
    issModel.add(issLight);
    issModel.position.set(1.12, 0, 0);
    issModel.scale.set(1.5, 1.5, 1.5);
    issGroup.add(issModel);
    // ISS-Bahn-Ring (subtil sichtbar)
    const issOrbitGeo = new THREE.RingGeometry(1.115, 1.125, 64);
    const issOrbitMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.08, side: THREE.DoubleSide });
    issGroup.add(new THREE.Mesh(issOrbitGeo, issOrbitMat));

    // Station QTH (red, larger)
    const stationDotGeo = new THREE.SphereGeometry(0.03, 12, 12);
    const stationDotMat = new THREE.MeshBasicMaterial({ color: 0xff5252 });
    const stationDot = new THREE.Mesh(stationDotGeo, stationDotMat);
    stationDot.position.copy(latLonToVec3(stationPos.lat, stationPos.lon, 1.02));
    stationDot.userData = { type: 'station', data: { call: stationInfo?.callsign || 'QTH', ...stationInfo } };
    globeGroup.add(stationDot);

    // Spot dots
    const dotMeshes = [];
    for (const s of visibleSpots) {
      const colorHex = parseInt(s._color.replace('#', ''), 16);
      const dotGeo = new THREE.SphereGeometry(0.018, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: colorHex });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(latLonToVec3(s._lat, s._lng, 1.01));
      dot.userData = { type: 'spot', data: s };
      globeGroup.add(dot);
      dotMeshes.push(dot);
    }

    // Arcs from station to DX spots (only when propagation toggle is on)
    for (const s of (showPropagation ? visibleSpots.filter(s => s._type === 'dx') : [])) {
      const fromVec = latLonToVec3(stationPos.lat, stationPos.lon, 1);
      const toVec = latLonToVec3(s._lat, s._lng, 1);
      const segments = 30;
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const p = new THREE.Vector3().lerpVectors(fromVec, toVec, t).normalize();
        p.multiplyScalar(1 + Math.sin(t * Math.PI) * 0.12);
        pts.push(p);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25 });
      globeGroup.add(new THREE.Line(geo, mat));
    }

    // Interaction
    let rotX = 0.3, rotY = 0;
    let autoRotate = true;
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let autoRotateTimer = null;
    let downPos = { x: 0, y: 0 };

    const stopAutoRotate = () => {
      autoRotate = false;
      if (autoRotateTimer) clearTimeout(autoRotateTimer);
      autoRotateTimer = setTimeout(() => { autoRotate = true; }, 3000);
    };

    const onPointerDown = (x, y) => { isDragging = true; stopAutoRotate(); prevX = x; prevY = y; downPos = { x, y }; };
    const onPointerMove = (x, y) => {
      if (!isDragging) return;
      rotY += (x - prevX) * 0.005;
      rotX += (y - prevY) * 0.005;
      rotX = Math.max(-1.4, Math.min(1.4, rotX));
      prevX = x; prevY = y;
    };
    const onPointerUp = (x, y) => {
      isDragging = false;
      if (Math.abs(x - downPos.x) < 5 && Math.abs(y - downPos.y) < 5) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          -((y - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const targets = [stationDot, ...dotMeshes];
        const hits = raycaster.intersectObjects(targets);
        if (hits.length > 0 && hits[0].object.userData?.data) {
          onSpotClick?.(hits[0].object.userData.data);
        }
      }
    };

    const onMouseDown = (e) => onPointerDown(e.clientX, e.clientY);
    const onMouseMove = (e) => onPointerMove(e.clientX, e.clientY);
    const onMouseUp = (e) => onPointerUp(e.clientX, e.clientY);
    const onWheel = (e) => { e.preventDefault(); camera.position.z = Math.max(1.08, Math.min(6, camera.position.z + e.deltaY * 0.002)); };
    const onTouchStart = (e) => { if (e.touches.length === 1) onPointerDown(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchMove = (e) => { if (e.touches.length === 1) { e.preventDefault(); onPointerMove(e.touches[0].clientX, e.touches[0].clientY); } };
    const onTouchEnd = (e) => { if (e.changedTouches.length === 1) onPointerUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY); };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', onTouchEnd);

    let animId;
    let frameCount = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      frameCount++;
      if (autoRotate && !isDragging && rotationRef.current) rotY += 0.002;
      globeGroup.rotation.x = rotX;
      globeGroup.rotation.y = rotY;
      // Mond kreist langsam um die Erde + langsame Eigenrotation
      moonGroup.rotation.y = frameCount * 0.001;
      moon.rotation.y = frameCount * 0.0005;
      // ISS kreist schneller
      issGroup.rotation.y = frameCount * 0.008;
      issGroup.rotation.x = 0.4;
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
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
      moonTexture.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
      });
    };
  }, [visibleSpots, stationPos, stationInfo, loading, onSpotClick, showPropagation, webglError]);

  const totalCount = visibleSpots.length;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-shrink-0">
          <Globe className="w-3.5 h-3.5 text-[#00e5ff]" /> HUNTING GLOBE
          <span className="text-[10px] text-muted-foreground font-normal">({totalCount})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPropagation(!showPropagation)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[9px] rounded-md border transition-colors flex-shrink-0 ${
              showPropagation
                ? "bg-[#00e5ff]/10 text-[#00e5ff] border-[#00e5ff]/30"
                : "bg-background text-muted-foreground border-border"
            }`}
            title="Propagation-Pfade ein-/ausschalten"
          >
            <Radio className="w-3 h-3" /> Prop.
          </button>
          <div className="hidden md:flex items-center gap-2 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#3b82f6]" />SOTA</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#22c55e]" />POTA</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#ef4444]" />DX</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#ff5252]" />QTH</span>
          </div>
        </div>
      </div>

      {/* Layer Filter */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-border overflow-x-auto">
        {LayerFilters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-2 py-0.5 text-[10px] rounded-md border whitespace-nowrap transition-colors ${
              activeFilter === f.id
                ? "bg-foreground text-background border-foreground"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full inline-block mr-1" style={{ background: f.color }} />
            {f.label}
          </button>
        ))}
      </div>

      {/* Globe */}
      <div className="h-[300px] md:h-[350px] lg:h-[400px] relative">
        <button
          onClick={() => setRotationEnabled(r => !r)}
          className="absolute top-2 right-2 z-10 bg-black/60 text-cyan-400 text-[10px] px-2 py-1 rounded-md border border-cyan-500/30 hover:bg-black/80 transition-colors"
          title="Globus-Rotation ein/aus"
        >
          {rotationEnabled ? '⏸️ Rotation' : '▶️ Rotation'}
        </button>
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Globus wird geladen…
          </div>
        ) : webglError ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-muted-foreground gap-1 px-4 text-center">
            <Globe className="w-6 h-6 text-muted-foreground/50" />
            <span>3D-Globus nicht verfügbar (WebGL nicht unterstützt).</span>
          </div>
        ) : totalCount === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Keine Spots mit Koordinaten verfügbar.
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" style={{ touchAction: 'none', cursor: 'grab' }} />
        )}
      </div>
      {/* Hint: deeper zoom + moon/ISS */}
      <div className="px-3 py-1 text-[8px] text-muted-foreground text-center border-t border-border">
        Globus drehen: Drag · Zoomen: Scroll/Pinch · 🌙 Mond & 🛰️ ISS umkreisen die Erde · Rotation Taste oben rechts
      </div>
    </div>
  );
}