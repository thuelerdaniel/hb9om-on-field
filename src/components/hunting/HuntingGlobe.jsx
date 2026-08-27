import React, { useState, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Globe, Loader2, Radio } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { maidenheadToLatLon } from "@/lib/geoUtilsFrontend";
import { createProceduralGlobeTexture, loadEarthTexture, createProceduralMoonTexture, createMoonBumpTexture } from "@/lib/globeTexture";
import { fetchIssPosition } from "@/lib/issPosition";
import { calibrateIssFromApi, calculateISSPosition, hasIssCalibration } from "@/lib/issOrbit";
import { getMoon3DPosition, getSunDirection } from "@/lib/moonPosition";
import IssFrequencyPopup from "@/components/hunting/IssFrequencyPopup";
import MoonSotaPopup from "@/components/hunting/MoonSotaPopup";
import MoonInfoPopup from "@/components/hunting/MoonInfoPopup";

// 3D Hunting Globe — drehbare Weltkugel mit allen aktiven Spots.
// FIX v0.9003: Flüssige Auto-Rotation mit Momentum/Dämpfung, ISS & Mond pro Frame,
//   dynamische Marker-Skalierung, klickbarer Mond mit Info-Popup.

const GLOBE_RADIUS = 1.0;
const MOON_DISTANCE = 1.8;
const AUTO_ROTATE_SPEED = 0.15; // rad/s — konstant, unabhängig von Framerate
const DAMPING_FACTOR = 0.92;     // pro Frame — Momentum läuft weich aus
const MOMENTUM_THRESHOLD = 0.001; // autoRotate kehrt zurück wenn Momentum < threshold

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
  const [showMoonInfo, setShowMoonInfo] = useState(false);
  const rotationRef = useRef(true);
  rotationRef.current = rotationEnabled;
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

  // ISS-Position alle 30 Sekunden von API holen (Kalibrierung für Orbital-Modell)
  useEffect(() => {
    const fetchIss = async () => {
      const pos = await fetchIssPosition();
      if (pos) {
        setIssData(pos);
        calibrateIssFromApi(pos.lat, pos.lon, Date.now());
      }
    };
    fetchIss();
    const interval = setInterval(fetchIss, 30000);
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
      renderer = new THREE.WebGLRenderer({ antialias: window.devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance' });
      // Explizite Kontext-Prüfung — THREE logt Fehler ohne throw bei Kontext-Mangel
      if (!renderer.getContext()) {
        setWebglError(true);
        renderer.dispose();
        return;
      }
    } catch (e) {
      setWebglError(true);
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000511);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 3;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Sternenfeld
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 30 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8, sizeAttenuation: true });
    scene.add(new THREE.Points(starGeo, starMat));

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const texture = createProceduralGlobeTexture();
    const lowPerf = window.devicePixelRatio >= 2;
    const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, lowPerf ? 48 : 64, lowPerf ? 48 : 64);
    const sphereMat = new THREE.MeshPhongMaterial({ map: texture, transparent: true, opacity: 0.95, shininess: 3 });
    loadEarthTexture(sphereMat);
    const globeMesh = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(globeMesh);

    const atmGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.08, 64, 64);
    const atmMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.08, side: THREE.BackSide });
    globeGroup.add(new THREE.Mesh(atmGeo, atmMat));

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sunDir = getSunDirection(new Date());
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(sunDir.x, sunDir.y, sunDir.z);
    scene.add(dir);

    // === MOND — mit Bump-Map + Rim-Light + unsichtbarem Hit-Bereich ===
    const moonGroup = new THREE.Group();
    scene.add(moonGroup);
    const moonRadius = 0.22;
    const moonGeo = new THREE.SphereGeometry(moonRadius, 32, 32);
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
    const moonInitPos = getMoon3DPosition(new Date(), MOON_DISTANCE);
    moon.position.set(moonInitPos.x, moonInitPos.y, moonInitPos.z);
    moonGroup.add(moon);

    // FIX 3B: Unsichtbarer Hit-Bereich für einfachere Klickbarkeit
    const moonHitGeo = new THREE.SphereGeometry(moonRadius * 1.6, 16, 16);
    const moonHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const moonHitArea = new THREE.Mesh(moonHitGeo, moonHitMat);
    moonHitArea.userData = { type: 'moon_body' };
    moon.add(moonHitArea);

    // Rim-Light (Fresnel-Effekt an den Rändern)
    const rimGeo = new THREE.SphereGeometry(moonRadius * 1.02, 32, 32);
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

    // SOTA-MARKER AUF DEM MOND (Gag) — blaues Dreieck bei Mare Tranquillitatis
    const sotaMarkerGeo = new THREE.ConeGeometry(0.015, 0.04, 4);
    const sotaMarkerMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const sotaMarker = new THREE.Mesh(sotaMarkerGeo, sotaMarkerMat);
    const moonSotaPos = latLonToVec3(20, 0, moonRadius);
    sotaMarker.position.copy(moonSotaPos);
    sotaMarker.lookAt(new THREE.Vector3(0, 0, 0));
    sotaMarker.rotateX(Math.PI);
    sotaMarker.userData = { type: 'moon_sota' };
    moon.add(sotaMarker);

    // === PULSIERENDER STANDORT-MARKER ===
    const stationCoreGeo = new THREE.SphereGeometry(0.02, 12, 12);
    const stationCoreMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const stationCore = new THREE.Mesh(stationCoreGeo, stationCoreMat);
    stationCore.position.copy(latLonToVec3(stationPos.lat, stationPos.lon, GLOBE_RADIUS * 1.02));
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

    // ISS Footprint — Sichtbarkeitskreis
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
      dot.position.copy(latLonToVec3(s._lat, s._lng, GLOBE_RADIUS * 1.01));
      dot.userData = { type: 'spot', data: s, baseScale: 1.0 };
      globeGroup.add(dot);
      dotMeshes.push(dot);
    }

    // === PROPAGATION ARCS ===
    for (const s of (showPropagation ? visibleSpots.filter(s => s._type === 'dx') : [])) {
      const fromVec = latLonToVec3(stationPos.lat, stationPos.lon, GLOBE_RADIUS);
      const toVec = latLonToVec3(s._lat, s._lng, GLOBE_RADIUS);
      const segments = 30;
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const p = new THREE.Vector3().lerpVectors(fromVec, toVec, t).normalize();
        p.multiplyScalar(GLOBE_RADIUS + Math.sin(t * Math.PI) * 0.12);
        pts.push(p);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.25 });
      globeGroup.add(new THREE.Line(geo, mat));
    }

    // === INTERACTION — FIX 1: Momentum/Dämpfung, FIX 3: Mond-Klick, Cursor-Hover ===
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let downPos = { x: 0, y: 0 };
    let rotationVelocity = { x: 0, y: 0 };
    let autoRotateActive = true;
    let moonAutoRotateTimer = null;

    const clampPitch = () => {
      // Verhindert Überschlag am Pol
      const maxPitch = Math.PI / 2 - 0.1;
      globeGroup.rotation.x = Math.max(-maxPitch, Math.min(maxPitch, globeGroup.rotation.x));
    };

    // FIX 3E: Cursor-Change bei Hover über Mond/ISS
    const checkHover = (x, y) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const hoverTargets = [moonHitArea, sotaMarker, issModelGroup];
      const hits = raycaster.intersectObjects(hoverTargets, true);
      if (hits.length > 0) {
        renderer.domElement.style.cursor = 'pointer';
      } else {
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerDown = (x, y) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Mond-Drag erkennen (separate Mond-Rotation)
      const moonHits = raycaster.intersectObject(moon, true);
      if (moonHits.length > 0) {
        moonDragModeRef.current = true;
        moonAutoRotateRef.current = false;
        prevX = x; prevY = y; downPos = { x, y };
        renderer.domElement.style.cursor = 'grabbing';
        return;
      }

      // Globus-Drag starten
      const globeHits = raycaster.intersectObject(globeMesh, true);
      if (globeHits.length > 0) {
        isDragging = true;
        autoRotateActive = false;
        rotationVelocity = { x: 0, y: 0 };
        prevX = x; prevY = y; downPos = { x, y };
        renderer.domElement.style.cursor = 'grabbing';
        return;
      }
    };

    const onPointerMove = (x, y) => {
      // Mond-Drag (separate Rotation)
      if (moonDragModeRef.current) {
        moonGroup.rotation.y += (x - prevX) * 0.01;
        moon.rotation.y += (x - prevX) * 0.01;
        prevX = x; prevY = y;
        return;
      }

      if (isDragging) {
        const deltaX = x - prevX;
        const deltaY = y - prevY;
        // Euler-Rotation für einfaches Pitch-Clamping
        globeGroup.rotation.y += deltaX * 0.005;
        globeGroup.rotation.x += deltaY * 0.005;
        clampPitch();
        // Momentum speichern für Dämpfung nach Drag-End
        rotationVelocity.y = deltaX * 0.005;
        rotationVelocity.x = deltaY * 0.005;
        prevX = x; prevY = y;
      } else {
        // FIX 3E: Cursor-Hover-Erkennung
        checkHover(x, y);
      }
    };

    const onPointerUp = (x, y) => {
      // Mond-Drag beenden
      if (moonDragModeRef.current) {
        moonDragModeRef.current = false;
        renderer.domElement.style.cursor = 'grab';
        if (moonAutoRotateTimer) clearTimeout(moonAutoRotateTimer);
        moonAutoRotateTimer = setTimeout(() => { moonAutoRotateRef.current = true; }, 3000);
        return;
      }

      isDragging = false;
      renderer.domElement.style.cursor = 'grab';

      // Click-Erkennung: nur wenn keine signifikante Bewegung
      if (Math.abs(x - downPos.x) < 5 && Math.abs(y - downPos.y) < 5) {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((x - rect.left) / rect.width) * 2 - 1,
          -((y - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // FIX 3A: Raycasting-Reihenfolge: SOTA-Marker → Mond → ISS → Spots → Globe
        // 1. SOTA-Marker auf dem Mond
        const sotaHits = raycaster.intersectObject(sotaMarker, true);
        if (sotaHits.length > 0) {
          setShowMoonSotaPopup(true);
          return;
        }
        // 2. Mond-Body (Hit-Area)
        const moonBodyHits = raycaster.intersectObject(moonHitArea, true);
        if (moonBodyHits.length > 0) {
          setShowMoonInfo(true);
          return;
        }
        // 3. ISS
        const issHits = raycaster.intersectObject(issModelGroup, true);
        if (issHits.length > 0) {
          setShowIssPopup(true);
          return;
        }
        // 4. Station + Spot-Marker
        const spotTargets = [stationCore, ...dotMeshes];
        const spotHits = raycaster.intersectObjects(spotTargets, true);
        if (spotHits.length > 0) {
          let target = spotHits[0].object;
          while (target && !target.userData?.type) target = target.parent;
          if (target?.userData?.data) {
            onSpotClick?.(target.userData.data);
          }
        }
      }
    };

    const onPointerDownEvent = (e) => onPointerDown(e.clientX, e.clientY);
    const onPointerMoveEvent = (e) => onPointerMove(e.clientX, e.clientY);
    const onPointerUpEvent = (e) => onPointerUp(e.clientX, e.clientY);
    const onWheel = (e) => { e.preventDefault(); camera.position.z = Math.max(1.5, Math.min(8, camera.position.z + e.deltaY * 0.002)); };

    renderer.domElement.addEventListener('pointerdown', onPointerDownEvent);
    window.addEventListener('pointermove', onPointerMoveEvent);
    window.addEventListener('pointerup', onPointerUpEvent);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // === ANIMATE-LOOP — FIX 1: Flüssige Rotation mit Momentum, FIX 2: Marker-Skalierung ===
    globeGroup.rotation.x = 0.3;
    let animId;
    const clock = new THREE.Clock();
    let pulseTime = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // FIX 1: Delta-time mit Clamp (verhindert Sprünge bei Tab-Wechsel)
      const delta = Math.min(clock.getDelta(), 0.1);
      pulseTime += delta;

      // FIX 1: Auto-Rotation (konstante Geschwindigkeit in rad/s)
      if (autoRotateActive && !isDragging && rotationRef.current) {
        globeGroup.rotation.y += AUTO_ROTATE_SPEED * delta;
      }

      // FIX 1: Momentum nach Drag-End (läuft weich aus)
      if (!isDragging && (Math.abs(rotationVelocity.x) > MOMENTUM_THRESHOLD || Math.abs(rotationVelocity.y) > MOMENTUM_THRESHOLD)) {
        globeGroup.rotation.y += rotationVelocity.y * delta * 60; // *60 für vergleichbare Geschwindigkeit
        globeGroup.rotation.x += rotationVelocity.x * delta * 60;
        clampPitch();
        rotationVelocity.x *= DAMPING_FACTOR;
        rotationVelocity.y *= DAMPING_FACTOR;
      } else if (!isDragging && autoRotateActive === false && Math.abs(rotationVelocity.x) < MOMENTUM_THRESHOLD && Math.abs(rotationVelocity.y) < MOMENTUM_THRESHOLD) {
        // FIX 1: Auto-Rotate wieder AN wenn Momentum < threshold
        autoRotateActive = true;
      }

      // Mond-Rotation
      if (!moonDragModeRef.current && rotationRef.current && moonAutoRotateRef.current) {
        moonGroup.rotation.y += 0.05238 * delta;
        moon.rotation.y += 0.05238 * delta;
      }

      // FIX 1: Mond-Position JEDE FRAME neu berechnen
      const moonPos = getMoon3DPosition(new Date(), MOON_DISTANCE);
      moonGroup.position.set(moonPos.x, moonPos.y, moonPos.z);

      // FIX 1: ISS-Position JEDE FRAME neu berechnen (Orbital-Modell mit API-Kalibrierung)
      const issOrbitPos = calculateISSPosition(new Date(), GLOBE_RADIUS);
      if (issOrbitPos) {
        issModelGroup.visible = true;
        footprintGroup.visible = true;
        issModelGroup.position.set(issOrbitPos.x, issOrbitPos.y, issOrbitPos.z);
        // FIX 1: ISS-Mesh korrekt orientieren
        issModelGroup.lookAt(0, 0, 0);
        const fpTarget = latLonToVec3(issOrbitPos.lat, issOrbitPos.lon, GLOBE_RADIUS);
        footprintGroup.position.copy(fpTarget);
        footprintGroup.lookAt(0, 0, 0);
      } else if (issDataRef.current) {
        // Fallback: API-Position (vor erster Kalibrierung oder wenn Orbital-Modell noch nicht bereit)
        issModelGroup.visible = true;
        footprintGroup.visible = true;
        const issTarget = latLonToVec3(issDataRef.current.lat, issDataRef.current.lon, GLOBE_RADIUS * 1.05);
        issModelGroup.position.lerp(issTarget, 0.1);
        issModelGroup.lookAt(0, 0, 0);
        const fpTarget = latLonToVec3(issDataRef.current.lat, issDataRef.current.lon, GLOBE_RADIUS);
        footprintGroup.position.lerp(fpTarget, 0.1);
        footprintGroup.lookAt(0, 0, 0);
      }

      // FIX 2: Dynamische Marker-Skalierung mit Smooth-Lerp
      const cameraDistance = camera.position.length();
      const scaleFactor = Math.max(0.3, Math.min(2.0, cameraDistance / GLOBE_RADIUS * 0.5));
      for (const dot of dotMeshes) {
        const targetScale = (dot.userData.baseScale || 1.0) * scaleFactor;
        dot.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      }
      // Station-Marker skalieren
      stationCore.scale.lerp(new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor), 0.1);
      // Pulsierender Standort: 1 Puls pro 2 Sekunden
      const pulsePhase = (pulseTime % 2) / 2;
      const ringScale = scaleFactor * (0.75 + pulsePhase * 1.875);
      stationRing.scale.setScalar(ringScale);
      stationRingMat.opacity = 0.8 * (1 - pulsePhase);

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
      if (moonAutoRotateTimer) clearTimeout(moonAutoRotateTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', onPointerMoveEvent);
      window.removeEventListener('pointerup', onPointerUpEvent);
      renderer.domElement.removeEventListener('pointerdown', onPointerDownEvent);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      renderer.forceContextLoss(); // Explizit WebGL-Kontext freigeben (verhindert Kontext-Leck bei Re-Mount)
      texture.dispose();
      moonTexture.dispose();
      moonBumpTexture.dispose();
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
        Globus drehen: Drag (mit Momentum) · Zoomen: Scroll/Pinch · 🌙 Mond klickbar (Phase/Beleuchtung) · 🛰️ ISS live · 📍 Standort pulsiert
      </div>

      {/* ISS Frequenz-Popup */}
      {showIssPopup && <IssFrequencyPopup issData={issData} onClose={() => setShowIssPopup(false)} />}
      {/* Mond SOTA Spenden-Popup */}
      {showMoonSotaPopup && <MoonSotaPopup onClose={() => setShowMoonSotaPopup(false)} />}
      {/* FIX 3: Mond-Info-Popup (Phase, Beleuchtung, Koordinaten) */}
      {showMoonInfo && <MoonInfoPopup onClose={() => setShowMoonInfo(false)} />}
    </div>
  );
}