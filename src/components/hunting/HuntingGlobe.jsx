import React, { useState, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Globe, Loader2, Radio } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon } from "@/lib/geoUtilsFrontend";
import { createProceduralGlobeTexture, loadEarthTexture, createProceduralMoonTexture, createMoonBumpTexture } from "@/lib/globeTexture";
import { fetchIssPosition } from "@/lib/issPosition";
import { getMoon3DPosition, getSunDirection } from "@/lib/moonPosition";
import IssFrequencyPopup from "@/components/hunting/IssFrequencyPopup";
import MoonSotaPopup from "@/components/hunting/MoonSotaPopup";

// 3D Hunting Globe — drehbare Weltkugel mit allen aktiven Spots.
// Station QTH = pulsierend grün, SOTA = blau, POTA = grün, DX = rot, andere = gelb.
// Mond mit Bump-Map + Rim-Light + SOTA-Marker (Mare Tranquillitatis).
// ISS mit Echtzeit-Position + Footprint-Kreis. Klick auf ISS/Mond-SOTA öffnet Popups.

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

export default function HuntingGlobe({ gpsPos, stationInfo, onSpotClick }) {
  const containerRef = useRef(null);
  const [activities, setActivities] = useState([]);
  const [dxSpots, setDxSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [showPropagation, setShowPropagation] = useState(true);
  const [webglError, setWebglError] = useState(false);
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [issData, setIssData] = useState(null);
  const [showIssPopup, setShowIssPopup] = useState(false);
  const [showMoonSotaPopup, setShowMoonSotaPopup] = useState(false);
  const rotationRef = useRef(true);
  rotationRef.current = rotationEnabled;
  // Fix 4/6: Mond-Rotation und Mond-Drag State
  const moonAutoRotateRef = useRef(true);
  const moonDragModeRef = useRef(false);
  const issDataRef = useRef(null);
  issDataRef.current = issData;

  // Station-Position: GPS → localStorage Locator → stationInfo → Zürich (JN47OQ)
  const stationPos = useMemo(() => {
    if (gpsPos) return { lat: gpsPos.lat, lon: gpsPos.lng };
    const savedLocator = typeof localStorage !== 'undefined' ? localStorage.getItem('station_locator') : null;
    if (savedLocator) {
      const p = maidenheadToLatLon(savedLocator);
      if (p) return p;
    }
    if (stationInfo?.locator) {
      const p = maidenheadToLatLon(stationInfo.locator);
      return p || { lat: 47.37, lon: 8.54 };
    }
    return { lat: 47.37, lon: 8.54 };
  }, [gpsPos, stationInfo]);

  // Spot-Daten laden (alle 5 Min)
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

  // Fix 9: Marker-Verteilung pro Kontinent loggen
  useEffect(() => {
    if (!activities.length && !dxSpots.length) return;
    const continents = {
      Europa: 0, Asien: 0, Afrika: 0, 'Nordamerika': 0, 'Südamerika': 0, Ozeanien: 0, Andere: 0,
    };
    const countContinent = (lat, lon) => {
      if (lat >= 35 && lat <= 70 && lon >= -10 && lon <= 40) return 'Europa';
      if (lat >= 0 && lat <= 60 && lon >= 60 && lon <= 150) return 'Asien';
      if (lat >= -35 && lat <= 35 && lon >= -20 && lon <= 50) return 'Afrika';
      if (lat >= 25 && lat <= 70 && lon >= -130 && lon <= -60) return 'Nordamerika';
      if (lat >= -55 && lat <= 15 && lon >= -80 && lon <= -35) return 'Südamerika';
      if (lat >= -45 && lat <= 0 && lon >= 110 && lon <= 180) return 'Ozeanien';
      return 'Andere';
    };
    for (const s of activities) continents[countContinent(s.latitude, s.longitude)]++;
    for (const s of dxSpots) continents[countContinent(s.lat, s.lng)]++;
    console.table(continents);
  }, [activities, dxSpots]);

  // ISS-Position alle 5 Sekunden aktualisieren
  useEffect(() => {
    const fetchIss = async () => {
      const pos = await fetchIssPosition();
      if (pos) setIssData(pos);
    };
    fetchIss();
    const interval = setInterval(fetchIss, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fix 5: Mond-Position alle 60 Sekunden aktualisieren (realitätsnah nach Meeus)
  const [moonPos3D, setMoonPos3D] = useState(() => getMoon3DPosition(new Date(), 1.8));
  useEffect(() => {
    const updateMoon = () => setMoonPos3D(getMoon3DPosition(new Date(), 1.8));
    updateMoon();
    const interval = setInterval(updateMoon, 60000);
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
      // Fix 6C: Performance — antialias nur bei devicePixelRatio < 2, powerPreference high-performance
      renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
    } catch (e) {
      setWebglError(true);
      return;
    }

    // Fix 10: Dunkler Weltall-Hintergrund
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000511);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 3;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Fix 10: Sternenfeld (2000 Sterne)
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const r = 30 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
      starSizes[i] = 0.3 + Math.random() * 1.2;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8, sizeAttenuation: true });
    scene.add(new THREE.Points(starGeo, starMat));

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const texture = createProceduralGlobeTexture();
    // Fix 6C: Low-Perf Devices — Sphere-Segmente 48 statt 64
    const lowPerf = window.devicePixelRatio >= 2;
    const sphereGeo = new THREE.SphereGeometry(1, lowPerf ? 48 : 64, lowPerf ? 48 : 64);
    const sphereMat = new THREE.MeshPhongMaterial({ map: texture, transparent: true, opacity: 0.95, shininess: 3 });
    loadEarthTexture(sphereMat);
    // Fix 5: Globe-Mesh referenzieren für Raycasting
    const globeMesh = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(globeMesh);

    const atmGeo = new THREE.SphereGeometry(1.08, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.08, side: THREE.BackSide });
    globeGroup.add(new THREE.Mesh(atmGeo, atmMat));

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    // Fix 5: Sonnen-Position für realistische Mondphasen-Beleuchtung
    const sunDir = getSunDirection(new Date());
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(sunDir.x, sunDir.y, sunDir.z);
    scene.add(dir);

    // === MOND — mit Bump-Map + Rim-Light (Fresnel) ===
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);
    const moonGeo = new THREE.SphereGeometry(0.27, 32, 32);
    const moonTexture = createProceduralMoonTexture();
    const moonBumpTexture = createMoonBumpTexture();
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTexture,
      bumpMap: moonBumpTexture,
      bumpScale: 0.1,
      roughness: 0.85,
      metalness: 0.0,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    // Fix 5: Mond-Position aus realer Mond-Positionsberechnung (Meeus)
    moon.position.set(moonPos3D.x, moonPos3D.y, moonPos3D.z);
    moonGroup.add(moon);

    // Rim-Light (Fresnel-Effekt an den Rändern)
    const rimGeo = new THREE.SphereGeometry(0.275, 32, 32);
    const rimMat = new THREE.ShaderMaterial({
      uniforms: { rimColor: { value: new THREE.Color(0x9999bb) } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 rimColor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.0);
          gl_FragColor = vec4(rimColor, fresnel * 0.4);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    moon.add(new THREE.Mesh(rimGeo, rimMat));

    // === SOTA-MARKER AUF DEM MOND (Gag) — blaues Dreieck bei 20°N 0°O (Mare Tranquillitatis) ===
    const sotaMarkerGeo = new THREE.ConeGeometry(0.015, 0.04, 4);
    const sotaMarkerMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const sotaMarker = new THREE.Mesh(sotaMarkerGeo, sotaMarkerMat);
    const moonSotaPos = latLonToVec3(20, 0, 0.27);
    sotaMarker.position.copy(moonSotaPos);
    sotaMarker.lookAt(new THREE.Vector3(0, 0, 0));
    sotaMarker.rotateX(Math.PI);
    sotaMarker.userData = { type: 'moon_sota' };
    moon.add(sotaMarker);

    // === PULSIERENDER STANDORT-MARKER ===
    const stationCoreGeo = new THREE.SphereGeometry(0.02, 12, 12);
    const stationCoreMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const stationCore = new THREE.Mesh(stationCoreGeo, stationCoreMat);
    stationCore.position.copy(latLonToVec3(stationPos.lat, stationPos.lon, 1.02));
    stationCore.userData = { type: 'station', data: { call: stationInfo?.callsign || 'QTH', ...stationInfo } };
    globeGroup.add(stationCore);

    const stationRingGeo = new THREE.SphereGeometry(0.04, 12, 12);
    const stationRingMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
    const stationRing = new THREE.Mesh(stationRingGeo, stationRingMat);
    stationRing.position.copy(stationCore.position);
    globeGroup.add(stationRing);

    // === ISS — Echtzeit-Position + Footprint ===
    const issModelGroup = new THREE.Group();
    globeGroup.add(issModelGroup);
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
    issModel.scale.set(1.5, 1.5, 1.5);
    issModelGroup.add(issModel);
    issModelGroup.userData = { type: 'iss' };
    issModelGroup.visible = false;

    // ISS Footprint — Sichtbarkeitskreis (ca. 2260 km → angular_radius ≈ 0.349 rad → sin ≈ 0.34)
    const footprintGroup = new THREE.Group();
    globeGroup.add(footprintGroup);
    const fpRadius = 0.34;
    const footprintFill = new THREE.Mesh(
      new THREE.RingGeometry(0, fpRadius, 64),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
    );
    footprintGroup.add(footprintFill);
    const footprintOutline = new THREE.Mesh(
      new THREE.RingGeometry(fpRadius * 0.99, fpRadius, 64),
      new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    footprintGroup.add(footprintOutline);
    footprintGroup.visible = false;

    // === SPOT DOTS ===
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

    // === PROPAGATION ARCS ===
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

    // === INTERACTION — Fix 4/5/6: Pointer Events, Raycasting, Quaternion ===
    let autoRotate = true;
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let autoRotateTimer = null;
    let moonAutoRotateTimer = null;
    let downPos = { x: 0, y: 0 };

    const stopAutoRotate = () => {
      autoRotate = false;
      if (autoRotateTimer) clearTimeout(autoRotateTimer);
      autoRotateTimer = setTimeout(() => { autoRotate = true; }, 3000);
    };

    // Fix 5: Raycasting — Drag nur starten wenn Globus getroffen wird
    const onPointerDown = (x, y) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      // Mond-Drag erkennen
      const moonHits = raycaster.intersectObject(moon, true);
      if (moonHits.length > 0) {
        moonDragModeRef.current = true;
        moonAutoRotateRef.current = false;
        prevX = x; prevY = y; downPos = { x, y };
        renderer.domElement.style.cursor = 'grabbing';
        return;
      }
      // Fix 5: Globus-Raycasting — nur Drag starten wenn Globus getroffen
      const globeHits = raycaster.intersectObject(globeMesh, true);
      if (globeHits.length > 0) {
        isDragging = true; stopAutoRotate(); prevX = x; prevY = y; downPos = { x, y };
        return;
      }
      // Kein Treffer = Weltraum-Klick → kein Drag
    };
    // Fix 6B: Quaternion-Rotation statt Euler
    const onPointerMove = (x, y) => {
      if (moonDragModeRef.current) {
        moonGroup.rotation.y += (x - prevX) * 0.01;
        moon.rotation.y += (x - prevX) * 0.01;
        prevX = x; prevY = y;
        return;
      }
      if (!isDragging) return;
      const deltaX = x - prevX;
      const deltaY = y - prevY;
      const quatY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaX * 0.005);
      const quatX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), deltaY * 0.005);
      globeGroup.quaternion.multiplyQuaternions(quatY, globeGroup.quaternion);
      globeGroup.quaternion.multiplyQuaternions(quatX, globeGroup.quaternion);
      prevX = x; prevY = y;
    };
    const onPointerUp = (x, y) => {
      if (moonDragModeRef.current) {
        moonDragModeRef.current = false;
        renderer.domElement.style.cursor = 'grab';
        if (moonAutoRotateTimer) clearTimeout(moonAutoRotateTimer);
        moonAutoRotateTimer = setTimeout(() => { moonAutoRotateRef.current = true; }, 3000);
        return;
      }
      isDragging = false;
      if (Math.abs(x - downPos.x) < 5 && Math.abs(y - downPos.y) < 5) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          -((y - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const targets = [stationCore, ...dotMeshes, sotaMarker, issModelGroup];
        const hits = raycaster.intersectObjects(targets, true);
        if (hits.length > 0) {
          let target = hits[0].object;
          while (target && !target.userData?.type) target = target.parent;
          if (target?.userData?.type === 'moon_sota') {
            setShowMoonSotaPopup(true);
          } else if (target?.userData?.type === 'iss') {
            setShowIssPopup(true);
          } else if (target?.userData?.data) {
            onSpotClick?.(target.userData.data);
          }
        }
      }
    };

    // Fix 6A: Pointer Events statt mouse/touch
    const onPointerDownEvent = (e) => onPointerDown(e.clientX, e.clientY);
    const onPointerMoveEvent = (e) => onPointerMove(e.clientX, e.clientY);
    const onPointerUpEvent = (e) => onPointerUp(e.clientX, e.clientY);
    const onWheel = (e) => { e.preventDefault(); camera.position.z = Math.max(1.5, Math.min(8, camera.position.z + e.deltaY * 0.002)); };

    renderer.domElement.addEventListener('pointerdown', onPointerDownEvent);
    window.addEventListener('pointermove', onPointerMoveEvent);
    window.addEventListener('pointerup', onPointerUpEvent);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Fix 4: Initial rotation via Euler → Quaternion
    globeGroup.rotation.x = 0.3;
    let animId;
    let frameCount = 0;
    // Fix 4: Delta-time basierte Rotation statt fixed-step
    let lastTime = performance.now();
    const animate = (currentTime) => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      frameCount++;
      // Fix 4: Delta-time Auto-Rotation mit Quaternion
      if (autoRotate && !isDragging && rotationRef.current) {
        const rotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.3 * delta);
        globeGroup.quaternion.multiplyQuaternions(rotQuat, globeGroup.quaternion);
      }
      // Mond-Rotation
      if (autoRotate && !isDragging && rotationRef.current && moonAutoRotateRef.current) {
        moonGroup.rotation.y += 0.05238 * delta;
        moon.rotation.y += 0.05238 * delta;
      }
      // Fix 6: Marker bei Zoom skalieren — Punkte werden beim Hineinzoomen kleiner
      const camDist = camera.position.z;
      const markerScale = Math.max(0.3, Math.min(3.0, 3.0 / camDist));
      for (const dot of dotMeshes) {
        dot.scale.setScalar(markerScale);
      }
      // Station-Marker auch skalieren
      stationCore.scale.setScalar(markerScale);
      stationRing.scale.setScalar(markerScale * (0.75 + ((frameCount % 120) / 120) * 1.875));
      // Pulsierender Standort: 1 Puls pro 2 Sek = 120 Frames bei 60fps
      const pulsePhase = (frameCount % 120) / 120;
      stationRing.scale.setScalar(0.75 + pulsePhase * 1.875);
      stationRingMat.opacity = 0.8 * (1 - pulsePhase);
      // ISS: smooth transition zur Echtzeit-Position
      if (issDataRef.current) {
        issModelGroup.visible = true;
        footprintGroup.visible = true;
        const issTarget = latLonToVec3(issDataRef.current.lat, issDataRef.current.lon, 1.05);
        issModelGroup.position.lerp(issTarget, 0.1);
        const fpTarget = latLonToVec3(issDataRef.current.lat, issDataRef.current.lon, 1.0);
        footprintGroup.position.lerp(fpTarget, 0.1);
        footprintGroup.lookAt(0, 0, 0);
      }
      renderer.render(scene, camera);
    };
    animate(performance.now());

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
      if (moonAutoRotateTimer) clearTimeout(moonAutoRotateTimer);
      window.removeEventListener('resize', handleResize);
      // Fix 6A: Pointer Events Cleanup
      window.removeEventListener('pointermove', onPointerMoveEvent);
      window.removeEventListener('pointerup', onPointerUpEvent);
      renderer.domElement.removeEventListener('pointerdown', onPointerDownEvent);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      texture.dispose();
      moonTexture.dispose();
      moonBumpTexture.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
      });
    };
  }, [visibleSpots, stationPos, stationInfo, loading, onSpotClick, showPropagation, webglError, moonPos3D]);

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
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#00ff00]" />QTH</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-[#ffd700]" />ISS</span>
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
          <div ref={containerRef} className="w-full h-full hunting-globe-container" style={{ touchAction: 'none', cursor: 'grab', backgroundColor: '#000511' }} />
        )}
      </div>
      {/* Hint */}
      <div className="px-3 py-1 text-[8px] text-muted-foreground text-center border-t border-border">
        Globus drehen: Drag · Zoomen: Scroll/Pinch · 🌙 Mond mit SOTA-Punkt (klickbar) · 🛰️ ISS live mit Footprint · 📍 Standort pulsiert
      </div>

      {/* ISS Frequenz-Popup */}
      {showIssPopup && <IssFrequencyPopup issData={issData} onClose={() => setShowIssPopup(false)} />}
      {/* Mond SOTA Spenden-Popup */}
      {showMoonSotaPopup && <MoonSotaPopup onClose={() => setShowMoonSotaPopup(false)} />}
    </div>
  );
}