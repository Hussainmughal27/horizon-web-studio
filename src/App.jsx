import React, { useState, useEffect, useRef, useMemo, useId } from "react";

/**
 * HORIZON WEB STUDIO — Cinematic Portfolio (2026)
 * Founded by Hussain
 *
 * Standalone React implementation integrating:
 * - Real-time Schwarzschild Ray-Marched BlackHole (WebGL + Doppler-beamed accretion disk)
 * - Dual-mode theme engine: Silver Mode & Orange Mode (live shader & UI uniform updates)
 * - Scroll-driven Dive choreography (withDiveOut, withSpaghettify, withScrollCue, withHorizonIn)
 * - DiveGauge (r = 20.00 rs -> 1.00 rs horizon ruler)
 * - NavReveal (smart hide-on-scroll sticky navbar)
 * - EdgeBlur (4-layer masked progressive blur that auto-pauses over heavy canvases)
 * - AgentPulse (live Horizon Web Studio activity ticker)
 * - RouteFlow (interactive project routing SVG + animated miniature black hole core)
 * - TraceScrub (draggable 4.8s Horizon delivery timeline scrubber)
 * - HoldApprove (press-and-hold client launch approval gate)
 * - ThreadField (2D spiral gravity threads & sparks for the Contact CTA section)
 */

// ============================================================================
// 1. CONSTANTS & DUAL-MODE THEME PALETTES (SILVER MODE & ORANGE MODE)
// ============================================================================
const DIVE_VH = 220;
const SANS = "'Geist', 'Inter', system-ui, -apple-system, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const THEMES = {
  silver: {
    id: "silver",
    label: "Silver Mode",
    bgPrimary: "#080809",
    surface: "#121214",
    raised: "#1C1C20",
    text: "#FAFAF9",
    muted: "#A1A1AA",
    line: "rgba(250, 250, 249, 0.11)",
    borderStrong: "rgba(250, 250, 249, 0.22)",
    accent: "#EFE2D3",
    accentContrast: "#080809",
    accentGlow: "rgba(239, 226, 211, 0.22)",
    live: "#10EC90",
    ember: "#BFC0C2",
    ice: "#E6E6E6",
    hot: "#FFFFFF",
    voidBg: "#000000",
    holeWarm: "#A8A29E",
    holeDeep: "#292524",
  },
  orange: {
    id: "orange",
    label: "Orange Mode",
    bgPrimary: "#0D0A08",
    surface: "#17120F",
    raised: "#231B16",
    text: "#FAFAF9",
    muted: "#B3A69D",
    line: "rgba(255, 106, 31, 0.16)",
    borderStrong: "rgba(255, 106, 31, 0.34)",
    accent: "#FF6A1F",
    accentContrast: "#110F0D",
    accentGlow: "rgba(255, 106, 31, 0.28)",
    live: "#10EC90",
    ember: "#FF6A1F",
    ice: "#FFB380",
    hot: "#FFF4E6",
    voidBg: "#050302",
    holeWarm: "#FF6A1F",
    holeDeep: "#4A1804",
  },
};

// ============================================================================
// 2. HOOKS: REDUCED MOTION, VIEWPORT & DIVE SCROLL PROGRESS
// ============================================================================
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useDiveProgress(diveLength = DIVE_VH) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const len = (diveLength / 100) * window.innerHeight;
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, len)));
      setProgress(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [diveLength]);
  return progress;
}

function clampMap(val, inMin, inMax, outMin, outMax) {
  const t = Math.min(1, Math.max(0, (val - inMin) / (inMax - inMin)));
  return outMin + (outMax - outMin) * t;
}

// ============================================================================
// 3. WEBGL RAY-MARCHED BLACK HOLE SHADER COMPONENT
// ============================================================================
const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
const FRAG = `precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform float uProgress;   // 0 = far orbit, 1 = crossed the horizon
uniform vec2  uPointer;    // -1..1
uniform float uSteps;      // quality (max 170)
uniform vec3  uEmber;      // disk body colour
uniform vec3  uIce;        // blueshift (approaching side)
uniform vec3  uHot;        // white-hot inner edge
uniform float uStars;      // star field intensity
uniform vec3  uVoid;       // background tint
uniform sampler2D uSkyTex;
uniform float uHasSky;
uniform float uIntro;      // 0..1 load-in: the camera falls in from far away

#define MAX_STEPS 170
#define RIN 2.6
#define ROUT 13.0

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

vec3 sky(vec3 d){
  vec3 col = vec3(0.0);
  if (uHasSky > 0.5) {
    float a = 0.55, b = -0.35;
    d = vec3(d.x, d.y * cos(a) - d.z * sin(a), d.y * sin(a) + d.z * cos(a));
    d = vec3(d.x * cos(b) - d.y * sin(b), d.x * sin(b) + d.y * cos(b), d.z);
    vec2 st = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, acos(clamp(d.y, -1.0, 1.0)) / 3.1415926);
    vec3 t = texture2D(uSkyTex, st).rgb;
    return vec3(dot(t * t, vec3(0.299, 0.587, 0.114))) * 1.4 * uStars;
  }
  vec3 g = d * 140.0;
  vec3 id = floor(g);
  vec3 f = fract(g) - 0.5;
  float h = hash3(id);
  if (h > 0.97){
    float s = length(f - (vec3(hash3(id + 1.3), hash3(id + 2.7), hash3(id + 5.1)) - 0.5) * 0.6);
    col += vec3(1.0) * smoothstep(0.09, 0.0, s) * (h - 0.97) * 30.0;
  }
  return col * uStars;
}

float profile(float r){
  return smoothstep(RIN, RIN + 0.5, r) * (1.0 - smoothstep(4.0, ROUT, r));
}

vec3 lavaRamp(float T){
  vec3 c = mix(vec3(0.008), uEmber * vec3(0.22), smoothstep(0.0, 0.25, T));
  c = mix(c, uEmber, smoothstep(0.2, 0.55, T));
  c = mix(c, mix(uEmber, uHot, 0.55) * vec3(0.85) + vec3(0.1), smoothstep(0.5, 0.8, T));
  c = mix(c, uHot, smoothstep(0.78, 1.0, T));
  return c;
}

vec4 diskField(float swirl, float r){
  vec2 q = vec2(swirl * 2.2, r * 1.7);
  vec2 w = vec2(fbm(q + vec2(0.0, uTime * 0.05)), fbm(q + vec2(5.2, 1.3) - uTime * 0.04));
  float n = fbm(q * 1.3 + 2.6 * w);
  float ridge = 1.0 - abs(2.0 * fbm(q * 2.4 + 1.7 * w + 9.0) - 1.0);
  float sp = noise(vec2(swirl * 44.0, r * 30.0)) * noise(vec2(swirl * 21.0 + 5.0, r * 57.0));
  return vec4(n, ridge, sp, 0.0);
}

vec3 diskColor(vec3 hit, vec3 rayDir, float r, out float alpha){
  float ang = atan(hit.z, hit.x);
  float omega = 1.6 / pow(r, 1.5);
  float spin = uTime * omega;
  float tw = (ang + 3.14159265) / 6.2831853;
  vec4 fA = diskField(ang + spin, r);
  vec4 fB = diskField(ang - 6.2831853 + spin, r);
  vec4 f = mix(fA, fB, smoothstep(0.88, 1.0, tw));
  float n = f.x;
  float veins = pow(f.y, 4.0);
  float crust = smoothstep(0.42, 0.66, n);
  float t = clamp((r - RIN) / (ROUT - RIN), 0.0, 1.0);
  float heat = pow(1.0 - t, 1.8);
  float T = clamp(0.18 + 0.55 * heat + 0.55 * veins * (1.0 - 0.6 * crust) - 0.35 * crust * (1.0 - heat), 0.0, 1.0);
  float sparkle = pow(f.z, 5.0) * 22.0;

  vec3 tangent = normalize(vec3(-hit.z, 0.0, hit.x));
  float v = sqrt(0.5 / r);
  float approach = dot(tangent, -rayDir) * v;
  float beam = pow(clamp(1.0 + approach * 1.2, 0.35, 2.1), 2.6);

  float dens = profile(r) * (0.42 + 0.95 * veins + 0.4 * (1.0 - crust)) + profile(r) * sparkle * 0.4;
  vec3 base = lavaRamp(T);
  base = mix(base, uIce, smoothstep(0.08, 0.35, approach) * 0.18 * (1.0 - crust));
  base += uHot * sparkle * 0.12;

  alpha = clamp(dens * (0.5 + heat), 0.0, 1.0);
  return base * dens * beam * (0.9 + 2.4 * heat);
}

void main(){
  float fitS = uRes.x > uRes.y ? min(uRes.y, uRes.x * 0.62) : uRes.x * 1.15;
  vec2 centerShift = uRes.x > uRes.y ? vec2(0.0) : vec2(0.0, -0.05 * uRes.y);
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes - centerShift) / fitS;

  float p = clamp(uProgress, 0.0, 1.0);
  float e = p * p * (3.0 - 2.0 * p);
  float dist = exp(mix(log(20.0), log(1.25), p));
  float ie = 1.0 - pow(1.0 - clamp(uIntro, 0.0, 1.0), 3.0);
  dist *= mix(2.8, 1.0, ie);
  float elev = mix(0.13, 0.04, p) + uPointer.y * 0.035 * (1.0 - e) + (1.0 - ie) * 0.12;
  float az   = uPointer.x * 0.1 * (1.0 - e) + uTime * 0.01;
  vec3 ro = dist * vec3(cos(elev) * sin(az), sin(elev), cos(elev) * cos(az));
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  float fov = mix(1.25, 2.0, p);
  float roll = mix(-0.05, 0.3, e);
  mat2 R = mat2(cos(roll), -sin(roll), sin(roll), cos(roll));
  vec2 uvr = R * uv;
  vec3 rd = normalize(fw * fov + rt * uvr.x + up * uvr.y);

  vec3 pos = ro;
  vec3 vel = rd;
  vec3 h = cross(pos, vel);
  float h2 = dot(h, h);

  vec3 col = vec3(0.0);
  vec3 glow = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  float minR = 1e3;

  for (int i = 0; i < MAX_STEPS; i++){
    if (float(i) >= uSteps) break;
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    minR = min(minR, r);
    if (r < 1.0){ captured = true; break; }
    if (r > 48.0) break;
    float dt = clamp(0.085 * r, 0.03, 1.8);
    vec3 acc = -1.5 * h2 * pos / (r2 * r2 * r);
    vel += acc * dt;
    vec3 np = pos + vel * dt;
    float rr = length(pos.xz);
    float haze = exp(-abs(pos.y) * 2.2) * profile(rr) * pow(max(0.0, 1.0 - (rr - RIN) / (ROUT - RIN)), 1.6);
    glow += uEmber * haze * dt * 0.03 * trans;
    if (pos.y * np.y < 0.0){
      float k = pos.y / (pos.y - np.y);
      vec3 hit = mix(pos, np, k);
      float hr = length(hit.xz);
      if (hr > RIN && hr < ROUT){
        float a;
        vec3 c = diskColor(hit, normalize(vel), hr, a);
        col += c * trans;
        trans *= 1.0 - a * 0.9;
        if (trans < 0.02) break;
      }
    }
    pos = np;
  }

  if (!captured) col += sky(normalize(vel)) * trans;
  col += glow;

  float ring = exp(-pow((minR - 1.52) * 9.0, 2.0)) + 0.35 * exp(-pow((minR - 1.6) * 2.5, 2.0));
  col += uHot * ring * 0.7 * (captured ? 0.0 : 1.0);
  float halo = exp(-max(minR - 1.5, 0.0) * 0.42);
  col += uEmber * vec3(1.0) * halo * 0.07 * (captured ? 0.0 : 1.0);

  float dark = smoothstep(0.82, 0.98, p);
  col *= 1.0 - dark;

  col *= smoothstep(0.0, 0.4, uIntro);
  col = 1.0 - exp(-col * 1.1);
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.2);
  col = pow(max(col, 0.0), vec3(1.05));
  col += uVoid * (1.0 - l) * (1.0 - dark);
  col = mix(col, uVoid, dark);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.016;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

function parseColor(c) {
  if (typeof document === "undefined") return [0.75, 0.75, 0.75];
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d");
  if (!ctx) return [0.75, 0.75, 0.75];
  ctx.fillStyle = "#000";
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0] / 255, d[1] / 255, d[2] / 255];
}

function BlackHoleFallback({ ember, background }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, background, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "86vmin",
          height: "22vmin",
          transform: "translate(-50%,-50%) rotate(-6deg)",
          borderRadius: "50%",
          background: `radial-gradient(closest-side, transparent 38%, ${ember} 55%, rgba(255,255,255,0.9) 62%, ${ember} 70%, transparent 100%)`,
          filter: "blur(6px)",
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "30vmin",
          height: "30vmin",
          transform: "translate(-50%,-50%)",
          borderRadius: "50%",
          background,
          boxShadow: `0 0 0 1.5px rgba(255,255,255,0.85), 0 0 60px 10px ${ember}`,
        }}
      />
    </div>
  );
}

function BlackHole({
  diveLength = DIVE_VH,
  ember = "#BFC0C2",
  ice = "#E6E6E6",
  hot = "#FFFFFF",
  background = "#000000",
  stars = 1,
  spin = 1,
  quality = "balanced",
  interactive = true,
  previewProgress = 0,
  scrollDive = true,
  intro = true,
  introDuration = 2.4,
  starMapSrc = "https://framerusercontent.com/images/yOyTjoRKz7CW4TJhfk3D4lPsO0.jpg",
  fitScaleOverride = null,
  style,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [failed, setFailed] = useState(false);
  const uniformsRef = useRef(null);

  // Live-update color uniforms whenever theme switches without rebuilding WebGL context
  useEffect(() => {
    const u = uniformsRef.current;
    if (!u || !u.gl) return;
    const { gl, uEmber, uIce, uHot, uVoid, uStars } = u;
    const e = parseColor(ember);
    const i = parseColor(ice);
    const hc = parseColor(hot);
    const vd = parseColor(background);
    gl.uniform3f(uEmber, e[0], e[1], e[2]);
    gl.uniform3f(uIce, i[0], i[1], i[2]);
    gl.uniform3f(uHot, hc[0], hc[1], hc[2]);
    gl.uniform3f(uVoid, vd[0], vd[1], vd[2]);
    gl.uniform1f(uStars, stars);
  }, [ember, ice, hot, background, stars]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const gl = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      setFailed(true);
      return;
    }

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("[BlackHole] shader error", gl.getShaderInfoLog(s));
      }
      return s;
    };

    const prog = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n) => gl.getUniformLocation(prog, n);
    const uRes = U("uRes"),
      uTime = U("uTime"),
      uProgress = U("uProgress"),
      uPointer = U("uPointer");
    const uIntro = U("uIntro");
    const uSteps = U("uSteps"),
      uEmber = U("uEmber"),
      uIce = U("uIce"),
      uHot = U("uHot"),
      uStars = U("uStars"),
      uVoid = U("uVoid");

    uniformsRef.current = { gl, uEmber, uIce, uHot, uVoid, uStars };

    const e = parseColor(ember),
      i = parseColor(ice);
    gl.uniform3f(uEmber, e[0], e[1], e[2]);
    gl.uniform3f(uIce, i[0], i[1], i[2]);
    const hc = parseColor(hot);
    gl.uniform3f(uHot, hc[0], hc[1], hc[2]);
    gl.uniform1f(uStars, stars);
    const vd = parseColor(background);
    gl.uniform3f(uVoid, vd[0], vd[1], vd[2]);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.innerWidth < 810;
    const q =
      quality === "logo"
        ? { scale: 2.0, steps: 95 }
        : quality === "high"
        ? { scale: 0.85, steps: 170 }
        : quality === "low"
        ? { scale: 0.45, steps: 80 }
        : { scale: 0.65, steps: 130 };
    const scale = quality === "logo" ? q.scale : small ? Math.min(q.scale, 0.5) : q.scale;
    const steps = quality === "logo" ? q.steps : small ? Math.min(q.steps, 90) : q.steps;
    gl.uniform1f(uSteps, steps);

    const uHasSky = U("uHasSky");
    gl.uniform1f(uHasSky, 0);
    gl.uniform1i(U("uSkyTex"), 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]));

    let disposed = false;
    let lastDrawnP = -1;
    if (starMapSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        if (disposed) return;
        try {
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.uniform1f(uHasSky, 1);
          lastDrawnP = -1;
          if (reduce) draw(target());
        } catch (err) {
          console.warn("[BlackHole] star map fallback to procedural stars", err);
        }
      };
      img.src = starMapSrc;
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      const cw = wrap.clientWidth || rect.width || (quality === "logo" ? 44 : window.innerWidth);
      const ch = wrap.clientHeight || rect.height || (quality === "logo" ? 28 : window.innerHeight);
      const w = Math.max(2, Math.round(cw * dpr * scale));
      const h = Math.max(2, Math.round(ch * dpr * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener("resize", resize, { passive: true });

    let pointer = [0, 0],
      pointerT = [0, 0];
    const onMove = (ev) => {
      pointerT = [
        (ev.clientX / window.innerWidth) * 2 - 1,
        -((ev.clientY / window.innerHeight) * 2 - 1),
      ];
    };
    if (interactive && !reduce) window.addEventListener("pointermove", onMove, { passive: true });

    const target = () => {
      if (!scrollDive) return previewProgress;
      const len = (diveLength / 100) * window.innerHeight;
      return Math.min(1, Math.max(0, window.scrollY / Math.max(1, len)));
    };

    let visible = true;
    const io = new IntersectionObserver((en) => {
      visible = en[0]?.isIntersecting ?? true;
      if (visible) kick();
    });
    io.observe(wrap);

    let raf = 0;
    let prog01 = target();
    let last = 0;
    let time = 3.0;
    let introT = introDuration * 0.48;
    let introStart = 0;

    const draw = (p) => {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uProgress, reduce ? 0 : p);
      gl.uniform1f(uIntro, !intro || reduce ? 1 : Math.min(1, introT / introDuration));
      gl.uniform2f(uPointer, pointer[0], pointer[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (reduce) canvas.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.55) / 0.4)));
      lastDrawnP = p;
    };

    const frame = (now) => {
      raf = 0;
      if (!visible || document.visibilityState !== "visible") return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now;
      prog01 += (target() - prog01) * 0.2;
      pointer = [
        pointer[0] + (pointerT[0] - pointer[0]) * 0.05,
        pointer[1] + (pointerT[1] - pointer[1]) * 0.05,
      ];
      if (!reduce) time += dt * spin;
      if (!introStart) introStart = now - introDuration * 480;
      introT = (now - introStart) / 1000;
      if (scrollDive && prog01 > 0.985 && lastDrawnP > 0.985) {
        raf = requestAnimationFrame(frame);
        return;
      }
      draw(prog01);
      raf = requestAnimationFrame(frame);
    };

    const kick = () => {
      if (!raf && !reduce) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };
    const onVis = () => kick();
    const onScroll = () => {
      if (reduce) draw(target());
      else kick();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("scroll", onScroll, { passive: true });
    const onLost = (ev) => {
      ev.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);

    if (reduce) draw(target());
    else kick();

    return () => {
      disposed = true;
      uniformsRef.current = null;
      gl.deleteTexture(tex);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [diveLength, spin, quality, interactive, previewProgress, scrollDive, starMapSrc, intro, introDuration]);

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        ...style,
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background,
        isolation: "isolate",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {failed ? (
        <BlackHoleFallback ember={ember} background={background} />
      ) : (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// 4. DIVE GAUGE (EDGE RULER: r = 20.00 rs -> 1.00 rs)
// ============================================================================
function DiveGauge({ progress, side = "right", color = "rgba(201,197,187,0.28)", accent = "#EFE2D3", label = "Distance to horizon" }) {
  const reduce = usePrefersReducedMotion();
  const topPct = reduce ? "8%" : `${8 + progress * 84}%`;
  const fade = clampMap(progress, 0.9, 0.99, 1, 0);
  const readout = Math.exp(Math.log(20) + (Math.log(1) - Math.log(20)) * progress).toFixed(2);
  const ticks = useMemo(() => Array.from({ length: 61 }, (_, i) => i), []);
  const isLeft = side === "left";

  if (fade <= 0.01) return null;

  return (
    <div
      aria-hidden
      className="hidden md:block"
      style={{
        opacity: fade,
        position: "absolute",
        top: "12vh",
        height: "76vh",
        [isLeft ? "left" : "right"]: 0,
        width: 190,
        zIndex: 12,
        pointerEvents: "none",
        userSelect: "none",
        transition: "opacity 160ms linear",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "4%",
          bottom: "4%",
          [isLeft ? "left" : "right"]: 0,
          width: 14,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: isLeft ? "flex-start" : "flex-end",
        }}
      >
        {ticks.map((i) => (
          <div
            key={i}
            style={{
              height: 1,
              width: i % 10 === 0 ? 14 : i % 5 === 0 ? 9 : 5,
              background: color,
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: topPct,
          [isLeft ? "left" : "right"]: 0,
          display: "flex",
          flexDirection: isLeft ? "row" : "row-reverse",
          alignItems: "center",
          gap: 10,
          transform: "translateY(-50%)",
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ width: 22, height: 1.5, background: accent, transition: "background-color 300ms ease" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: isLeft ? "flex-start" : "flex-end", gap: 2 }}>
          <span style={{ fontSize: 11, letterSpacing: "0.04em", color: "rgba(220,216,210,0.68)", fontFamily: MONO }}>
            {label}
          </span>
          <span style={{ fontSize: 12, color: accent, fontVariantNumeric: "tabular-nums", fontFamily: MONO, transition: "color 300ms ease" }}>
            r = {readout} r<sub style={{ fontSize: "0.7em" }}>s</sub>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. SCROLL CUE (HERO BOTTOM SIGNAL LINE)
// ============================================================================
function ScrollCue({ label = "Scroll to cross the horizon", text = "#FAFAF9", muted = "#A6A09B", accent = "#FF6A1F", opacity = 1 }) {
  const reduce = usePrefersReducedMotion();
  return (
    <button
      type="button"
      onClick={() => window.scrollBy({ top: window.innerHeight * 1.15, behavior: reduce ? "auto" : "smooth" })}
      className="sc-btn"
      style={{
        opacity,
        pointerEvents: opacity < 0.05 ? "none" : "auto",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        color: muted,
      }}
    >
      <span
        style={{
          font: `500 11px ${MONO}`,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: text,
          textShadow: "0 1px 14px rgba(0,0,0,0.9)",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          position: "relative",
          width: 1,
          height: 44,
          background: "rgba(250,250,249,0.22)",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: -1,
            width: 3,
            height: 14,
            borderRadius: 2,
            background: accent,
            boxShadow: `0 0 12px ${accent}`,
            animation: reduce ? undefined : "scFall 1.8s cubic-bezier(0.77,0,0.175,1) infinite",
          }}
        />
      </span>
    </button>
  );
}

// ============================================================================
// 6. EDGE BLUR (PROGRESSIVE 4-LAYER VIEWPORT BLUR, PAUSES OVER CANVASES)
// ============================================================================
function EdgeBlur({ edge = "bottom", bandHeight = 68, offset = 0, strength = 1, tint = "#080809", tintAmount = 0.35, pauseOverCanvas = true }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [suppressed, setSuppressed] = useState(pauseOverCanvas);

  useEffect(() => {
    if (!pauseOverCanvas) {
      setSuppressed(false);
      return;
    }
    let raf = 0;
    const check = () => {
      raf = 0;
      const vw = window.innerWidth,
        vh = window.innerHeight;
      let hit = false;
      document.querySelectorAll("canvas").forEach((c) => {
        if (hit) return;
        const r = c.getBoundingClientRect();
        if (r.width < vw * 0.6 || r.height < vh * 0.5) return;
        if (r.bottom > 0 && r.top < vh) hit = true;
      });
      setSuppressed(hit);
      document.documentElement.classList.toggle("eb-over-canvas", hit);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    const id = window.setInterval(check, 800);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearInterval(id);
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.classList.remove("eb-over-canvas");
    };
  }, [pauseOverCanvas]);

  const toEdge = edge === "bottom" ? "to bottom" : "to top";
  const layers = [0, 1, 2, 3].map((i) => {
    const blur = Math.pow(2, i) * 0.75 * strength;
    const a = i * 20;
    const mask = `linear-gradient(${toEdge}, transparent ${a}%, #000 ${a + 20}%, #000 ${a + 40}%, transparent ${a + 60}%)`;
    return (
      <div
        key={`${uid}-${i}`}
        style={{
          position: "absolute",
          inset: 0,
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          maskImage: mask,
          WebkitMaskImage: mask,
        }}
      />
    );
  });

  return (
    <div
      aria-hidden
      className="eb-band"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        height: bandHeight,
        [edge]: offset,
        zIndex: 35,
        pointerEvents: "none",
        opacity: suppressed ? 0 : 1,
        transition: "opacity 240ms ease",
      }}
    >
      {!suppressed && layers}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${toEdge}, rgba(0,0,0,0) 0%, ${tint} 100%)`,
          opacity: tintAmount,
        }}
      />
    </div>
  );
}

// ============================================================================
// 7. NAV REVEAL (HIDE ON SCROLL DOWN, REVEAL ON SCROLL UP + THEME SWITCHER)
// ============================================================================
function NavReveal({ theme, onToggleTheme }) {
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    let last = window.scrollY;
    let travel = 0;
    let raf = 0;
    const check = () => {
      raf = 0;
      const y = window.scrollY;
      setScrolled(y > 40);
      const d = y - last;
      last = y;
      if (y < 24 || mobileOpen) {
        travel = 0;
        setHidden(false);
        return;
      }
      if ((d > 0) !== (travel > 0)) travel = 0;
      travel += d;
      if (travel > 6) setHidden(true);
      else if (travel < -8) setHidden(false);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mobileOpen]);

  const navLinks = [
    { label: "Studio", href: "#about" },
    { label: "Capabilities", href: "#services" },
    { label: "Portfolio", href: "#projects" },
    { label: "Approach", href: "#approach" },
    { label: "Pipeline", href: "#workflow" },
    { label: "Inquiry", href: "#contact" },
  ];

  return (
    <header
      onFocusCapture={() => setHidden(false)}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transform: hidden ? "translateY(-110%)" : "translateY(0%)",
        opacity: hidden ? 0 : 1,
        transition: reduce ? "none" : "transform 460ms cubic-bezier(0.23,1,0.32,1), opacity 320ms cubic-bezier(0.23,1,0.32,1)",
        willChange: "transform",
      }}
    >
      <nav
        aria-label="Primary Navigation"
        style={{
          margin: "12px auto",
          maxWidth: 1240,
          padding: "10px 18px",
          borderRadius: 14,
          border: `1px solid ${scrolled ? theme.line : "rgba(250,250,249,0.08)"}`,
          background: scrolled ? "rgba(10, 10, 12, 0.78)" : "rgba(10, 10, 12, 0.42)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
        className="w-[calc(100%-24px)]"
      >
        {/* Brand Identity */}
        <a
          href="#top"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: theme.text,
          }}
        >
          {/* Original Ringed Black Hole Brand Emblem */}
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              position: "relative",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                width: 34,
                height: 11,
                borderRadius: "50%",
                background: `radial-gradient(closest-side, transparent 36%, ${theme.ember} 56%, rgba(255,255,255,0.92) 64%, ${theme.ember} 74%, transparent 100%)`,
                transform: "rotate(-18deg)",
                filter: "blur(0.6px)",
                transition: "background 300ms ease",
              }}
            />
            <span
              style={{
                position: "relative",
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: "#000000",
                boxShadow: `0 0 0 1px rgba(255,255,255,0.88), 0 0 8px 1px ${theme.ember}`,
                transition: "box-shadow 300ms ease",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 13, letterSpacing: "0.08em", lineHeight: 1.1 }}>
              HORIZON
            </span>
            <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: theme.muted }}>
              WEB STUDIO
            </span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-6">
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.04em",
                color: theme.muted,
                textDecoration: "none",
                transition: "color 200ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = theme.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = theme.muted)}
            >
              {item.label}
            </a>
          ))}
        </div>

        {/* Right Controls: Theme Toggle (Silver / Orange) + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => onToggleTheme(theme.id === "silver" ? "orange" : "silver")}
            aria-label={theme.id === "silver" ? "Switch to orange mode" : "Switch to silver mode"}
            title={theme.id === "silver" ? "Orange mode" : "Silver mode"}
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              border: `1px solid ${theme.line}`,
              background: "rgba(255,255,255,0.05)",
              color: theme.accent,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              transition: "border-color 220ms ease, background-color 220ms ease, color 220ms ease, transform 200ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = theme.accent;
              e.currentTarget.style.background = "rgba(255,255,255,0.09)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = theme.line;
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            }}
          >
            {theme.id === "silver" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            )}
          </button>

          <a
            href="#contact"
            className="hidden sm:inline-flex"
            style={{
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              background: theme.accent,
              color: theme.accentContrast,
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              textDecoration: "none",
              boxShadow: `0 0 20px ${theme.accentGlow}`,
              transition: "all 250ms ease",
            }}
          >
            Start Project
          </a>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: `1px solid ${theme.line}`,
              background: "rgba(255,255,255,0.04)",
              color: theme.text,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div
          className="lg:hidden mx-auto w-[calc(100%-24px)]"
          style={{
            marginTop: -4,
            padding: 16,
            borderRadius: 14,
            border: `1px solid ${theme.line}`,
            background: "rgba(10, 10, 12, 0.94)",
            backdropFilter: "blur(16px)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              style={{
                fontFamily: MONO,
                fontSize: 13,
                color: theme.text,
                textDecoration: "none",
                padding: "6px 4px",
                borderBottom: `1px solid ${theme.line}`,
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}

// ============================================================================
// 8. AGENT PULSE (LIVE HORIZON STUDIO STATUS TICKER)
// ============================================================================
function AgentPulse({
  messages = [
    "Accepting New Projects for 2026",
    "Claude AI-assisted architecture & code audit",
    "Crafting responsive business websites",
    "Optimizing WebGL & Core Web Vitals",
    "Deploying Classic Garden & Pharmacy builds",
  ],
  text = "#FAFAF9",
  live = "#10EC90",
  border = true,
}) {
  const reduce = usePrefersReducedMotion();
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const msg = messages[i % messages.length] || "";
    if (reduce) {
      setTyped(msg);
      return;
    }
    let k = 0;
    setTyped("");
    const id = window.setInterval(() => {
      k++;
      setTyped(msg.slice(0, k));
      if (k >= msg.length) window.clearInterval(id);
    }, 26);
    const next = window.setTimeout(() => setI((v) => v + 1), 3800);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(next);
    };
  }, [i, reduce]);

  return (
    <div
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        height: 34,
        padding: "0 14px",
        borderRadius: 999,
        border: border ? "1px solid rgba(250,250,249,0.14)" : "none",
        background: border ? "rgba(18, 18, 20, 0.72)" : "transparent",
        backdropFilter: "blur(10px)",
        font: `500 12px ${MONO}`,
        color: text,
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <span style={{ position: "relative", width: 8, height: 8, display: "inline-grid", placeItems: "center", flexShrink: 0 }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 8,
            background: live,
            opacity: 0.3,
            animation: reduce ? undefined : "apRing 1.8s cubic-bezier(0.23,1,0.32,1) infinite",
          }}
        />
        <span style={{ width: 6, height: 6, borderRadius: 6, background: live }} />
      </span>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {typed}
        {!reduce && typed.length < (messages[i % messages.length] || "").length && (
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 12,
              marginLeft: 3,
              verticalAlign: "-2px",
              background: text,
              opacity: 0.75,
            }}
          />
        )}
      </span>
    </div>
  );
}

// ============================================================================
// 9. HOLE MARK (MINIATURE ACCRETION BLACK HOLE FOR ROUTEFLOW CORE)
// ============================================================================
function HoleMark({ hot = "#FAFAF9", warm = "#A8A29E", deep = "#292524", speed = 1 }) {
  const reduce = usePrefersReducedMotion();
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "grid",
        placeItems: "center",
      }}
    >
      {/* Outer Accretion Glow */}
      <div
        style={{
          position: "absolute",
          width: 132,
          height: 36,
          borderRadius: "50%",
          background: `radial-gradient(ellipse at center, transparent 32%, ${warm} 56%, ${hot} 64%, ${deep} 82%, transparent 100%)`,
          filter: "blur(3px)",
          transform: "rotate(-11deg)",
          animation: reduce ? undefined : `hmSpin ${10 / speed}s linear infinite`,
        }}
      />
      {/* Lensed Upper Halo */}
      <div
        style={{
          position: "absolute",
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: `1.5px solid ${hot}`,
          boxShadow: `0 0 22px 4px ${warm}, inset 0 0 10px ${warm}`,
          opacity: 0.85,
        }}
      />
      {/* Event Horizon Shadow */}
      <div
        style={{
          position: "relative",
          width: 46,
          height: 46,
          borderRadius: "50%",
          background: "#000000",
          boxShadow: `0 0 0 1px ${hot}`,
        }}
      />
    </div>
  );
}

// ============================================================================
// 10. ROUTE FLOW (HORIZON STUDIO PIPELINE ROUTING DIAGRAM)
// ============================================================================
const VW = 560;
const VH = 440;
const CORE = { x: 262, y: 220 };
const HW = 180;
const HH = 120;

const STUDIO_SOURCES = [{ name: "Client Brief" }, { name: "Figma UI" }, { name: "GitHub" }];
const STUDIO_AGENTS = [
  { name: "Architecture", skills: "HTML5 · React · WebGL" },
  { name: "UI/UX Design", skills: "typography · motion · layout" },
  { name: "AI Workflow", skills: "Claude · optimization · audit" },
  { name: "Performance", skills: "Core Web Vitals · SEO · speed" },
  { name: "Deployment", skills: "CI/CD · security · care" },
];

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function RouteFlow({ theme, isMobile = false }) {
  const reduce = usePrefersReducedMotion();
  const ref = useRef(null);
  const [now, setNow] = useState(0);
  const [hover, setHover] = useState(null);
  const [k, setK] = useState(1);
  const [box, setBox] = useState({ s: 1, ox: 0, oy: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const sc = Math.min(r.width / VW, r.height / VH) || 1;
      setK(Math.max(1, 1 / sc));
      setBox({ s: sc, ox: (r.width - VW * sc) / 2, oy: (r.height - VH * sc) / 2 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fs = 11.5 * k;
  const tasksRef = useRef([]);
  const loadRef = useRef(STUDIO_AGENTS.map((_, i) => 0.25 + 0.1 * (i % 3)));
  const pulseRef = useRef(STUDIO_AGENTS.map(() => -9999));
  const idRef = useRef(0);
  const countRef = useRef(1420);
  const logRef = useRef("awaiting incoming project specification");

  const labels = useMemo(
    () => [
      "Classic Garden Responsive Grid",
      "Ahmed Pharmacy Accessibility Audit",
      "Custom WebGL Hero Shader",
      "Claude Codebase Refactor",
      "Landing Page Conversion Flow",
      "Lighthouse 100 Performance Pass",
    ],
    []
  );

  const S = STUDIO_SOURCES.length;
  const A = STUDIO_AGENTS.length;
  const srcPos = (i) => [58, 110 + (i * 220) / (S - 1)];
  const agPos = (i) => [448, 48 + (i * 344) / (A - 1)];

  const spawn = (src) => {
    const t = performance.now();
    const s = src ?? Math.floor(Math.random() * S);
    let best = 0;
    let bestScore = -1;
    for (let i = 0; i < A; i++) {
      const sc = (1 - loadRef.current[i]) * 0.8 + Math.random() * 0.35;
      if (sc > bestScore) {
        bestScore = sc;
        best = i;
      }
    }
    tasksRef.current.push({
      id: idRef.current++,
      label: labels[idRef.current % labels.length],
      src: s,
      agent: best,
      born: t,
      latency: 14 + Math.round(Math.random() * 28),
    });
  };

  const T_IN = 1100;
  const T_SCORE = 400;
  const T_OUT = 900;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let nextSpawn = last + 250;
    const loop = (t) => {
      const dt = Math.min(64, t - last);
      last = t;
      if (!reduce && t > nextSpawn) {
        spawn();
        nextSpawn = t + 1450 + Math.random() * 800;
      }
      const keep = [];
      for (const item of tasksRef.current) {
        const age = t - item.born;
        if (age > T_IN + T_SCORE + T_OUT) {
          loadRef.current[item.agent] = Math.min(0.95, loadRef.current[item.agent] + 0.18);
          pulseRef.current[item.agent] = t;
          countRef.current += 1;
          logRef.current = `${item.label}  →  ${STUDIO_AGENTS[item.agent]?.name}  ·  ${item.latency} ms`;
        } else {
          keep.push(item);
        }
      }
      tasksRef.current = keep;
      loadRef.current = loadRef.current.map((l) => Math.max(0.12, l - dt * 0.00005));
      setNow(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const srcCurve = (i) => {
    const [x, y] = srcPos(i);
    return [
      [x + 54, y],
      [x + 140, y],
      [CORE.x - 105, CORE.y],
      [CORE.x - 28, CORE.y],
    ];
  };
  const agCurve = (i) => {
    const [x, y] = agPos(i);
    return [
      [CORE.x + 28, CORE.y],
      [CORE.x + 105, CORE.y],
      [x - 115, y],
      [x - 6, y],
    ];
  };
  const pathD = (c) => `M${c[0][0]},${c[0][1]} C${c[1][0]},${c[1][1]} ${c[2][0]},${c[2][1]} ${c[3][0]},${c[3][1]}`;

  const scoring = tasksRef.current.filter((item) => {
    const age = now - item.born;
    return age > T_IN && age < T_IN + T_SCORE;
  });
  const routing = tasksRef.current.filter((item) => now - item.born > T_IN);
  const coreBusy = scoring.length > 0;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        height: isMobile ? 280 : 420,
        fontFamily: SANS,
        color: theme.text,
        userSelect: "none",
        borderRadius: 16,
        border: `1px solid ${theme.line}`,
        background: theme.surface,
        padding: isMobile ? 12 : 18,
        overflow: "hidden",
      }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Project inputs routed through Horizon Core to specialized disciplines"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <pattern id="rf-dots-hws" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill={theme.line} />
          </pattern>
          <radialGradient id="rf-core-hws">
            <stop offset="0%" stopColor={theme.accent} stopOpacity="0.16" />
            <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={VW} height={VH} fill="url(#rf-dots-hws)" />

        {STUDIO_SOURCES.map((_, i) => (
          <path key={"sp" + i} d={pathD(srcCurve(i))} fill="none" stroke={theme.line} strokeWidth="1" />
        ))}
        {STUDIO_AGENTS.map((_, i) => {
          const lit = routing.some((item) => item.agent === i) || hover === i;
          return (
            <path
              key={"ap" + i}
              d={pathD(agCurve(i))}
              fill="none"
              stroke={lit ? theme.accent : coreBusy ? "rgba(250,250,249,0.20)" : theme.line}
              strokeWidth="1.2"
              style={{ transition: "stroke 240ms ease" }}
            />
          );
        })}

        {tasksRef.current.map((item) => {
          const age = now - item.born;
          const TRAIL = 0.28;
          if (age < T_IN) {
            const e = easeOutCubic(age / T_IN);
            const len = Math.min(e, TRAIL);
            return (
              <path
                key={"ti" + item.id}
                d={pathD(srcCurve(item.src))}
                pathLength={1}
                fill="none"
                stroke={theme.text}
                strokeOpacity={0.6}
                strokeWidth={1.3}
                strokeLinecap="round"
                strokeDasharray={`${len} 2`}
                strokeDashoffset={-(e - len)}
              />
            );
          }
          if (age >= T_IN + T_SCORE) {
            const e = easeOutCubic(Math.min(1, (age - T_IN - T_SCORE) / T_OUT));
            const len = Math.min(e, TRAIL);
            return (
              <path
                key={"to" + item.id}
                d={pathD(agCurve(item.agent))}
                pathLength={1}
                fill="none"
                stroke={theme.accent}
                strokeOpacity={0.95}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeDasharray={`${len} 2`}
                strokeDashoffset={-(e - len)}
              />
            );
          }
          return null;
        })}

        <circle cx={CORE.x} cy={CORE.y} r="80" fill="url(#rf-core-hws)" opacity={coreBusy ? 1 : 0.45} />
      </svg>

      {/* Miniature Black Hole at the Center */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: box.ox + (CORE.x - HW / 2) * box.s,
          top: box.oy + (CORE.y - HH / 2) * box.s,
          width: HW * box.s,
          height: HH * box.s,
          pointerEvents: "none",
        }}
      >
        <HoleMark speed={coreBusy ? 1.8 : 0.8} hot={theme.hot} warm={theme.holeWarm} deep={theme.holeDeep} />
      </div>

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
        style={{ position: "absolute", inset: 0, display: "block", overflow: "visible" }}
      >
        <text
          x={CORE.x}
          y={CORE.y + 78}
          textAnchor="middle"
          fill={theme.muted}
          style={{ font: `500 ${fs}px ${MONO}`, letterSpacing: "0.08em" }}
        >
          HORIZON CORE
        </text>

        {STUDIO_SOURCES.map((s, i) => {
          const [x, y] = srcPos(i);
          return (
            <g
              key={"s" + i}
              transform={`translate(${x - 48} ${y - 16})`}
              style={{ cursor: "pointer" }}
              onClick={() => {
                for (let m = 0; m < 3; m++) setTimeout(() => spawn(i), m * 150);
              }}
            >
              <rect
                width={Math.max(102, 34 + s.name.length * fs * 0.6)}
                height="32"
                rx="6"
                fill={theme.raised}
                stroke={theme.borderStrong}
              />
              <circle cx="14" cy="16" r="3" fill={theme.accent} />
              <text x="25" y={16 + fs * 0.35} fill={theme.text} style={{ font: `500 ${fs}px ${MONO}` }}>
                {s.name}
              </text>
            </g>
          );
        })}

        {STUDIO_AGENTS.map((a, i) => {
          const [x, y] = agPos(i);
          const load = loadRef.current[i] ?? 0.25;
          const pulse = Math.max(0, 1 - (now - (pulseRef.current[i] ?? -9999)) / 700);
          const on = hover === i;
          return (
            <g
              key={"a" + i}
              transform={`translate(${x} ${y - 20})`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              style={{ cursor: "default" }}
            >
              <rect
                width="106"
                height={Math.max(40, 18 + fs * 1.8)}
                rx="6"
                fill={on ? theme.raised : theme.bgPrimary}
                stroke={on ? theme.accent : `rgba(250,250,249,${(0.14 + 0.4 * pulse).toFixed(3)})`}
              />
              <text x="10" y={8 + fs} fill={theme.text} style={{ font: `500 ${fs}px ${SANS}` }}>
                {a.name}
              </text>
              <rect x="10" y={Math.max(26, 12 + fs * 1.3)} width="86" height="3" rx="1.5" fill="rgba(250,250,249,0.08)" />
              <rect
                x="10"
                y={Math.max(26, 12 + fs * 1.3)}
                width={86 * load}
                height="3"
                rx="1.5"
                fill={theme.accent}
              />
            </g>
          );
        })}

        {tasksRef.current.map((item) => {
          const age = now - item.born;
          let p;
          if (age < T_IN) p = bez(...srcCurve(item.src), easeOutCubic(age / T_IN));
          else if (age < T_IN + T_SCORE) p = [CORE.x, CORE.y];
          else p = bez(...agCurve(item.agent), easeOutCubic((age - T_IN - T_SCORE) / T_OUT));
          const hidden = age >= T_IN && age < T_IN + T_SCORE;
          const out = age >= T_IN + T_SCORE;
          const fall = out ? 1 : Math.min(1, Math.max(0, (T_IN - age) / (T_IN * 0.18)));
          const c = out ? theme.accent : theme.text;
          return (
            <g key={"k" + item.id} opacity={hidden ? 0 : fall}>
              <circle cx={p[0]} cy={p[1]} r="7" fill={c} opacity="0.16" />
              <circle cx={p[0]} cy={p[1]} r={out ? 3.2 : 2.2 + fall} fill={c} />
            </g>
          );
        })}

        {hover !== null && STUDIO_AGENTS[hover] && (() => {
          const [x, y] = agPos(hover);
          const cardW = Math.max(175, 24 + STUDIO_AGENTS[hover].skills.length * fs * 0.62);
          return (
            <g
              transform={`translate(${x - 10 - cardW} ${Math.min(VH - 64, Math.max(8, y - 26))})`}
              pointerEvents="none"
            >
              <rect width={cardW} height={18 + fs * 2.4} rx="6" fill={theme.raised} stroke={theme.accent} />
              <text x="10" y={6 + fs} fill={theme.text} style={{ font: `600 ${fs}px ${SANS}` }}>
                {STUDIO_AGENTS[hover].name} · {Math.round((loadRef.current[hover] ?? 0) * 100)}% capacity
              </text>
              <text x="10" y={12 + fs * 2.1} fill={theme.muted} style={{ font: `400 ${fs}px ${MONO}` }}>
                {STUDIO_AGENTS[hover].skills}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Top Status & Bottom Log */}
      <div
        style={{
          position: "absolute",
          left: 18,
          top: 14,
          display: "flex",
          alignItems: "center",
          gap: 8,
          font: `500 11px ${MONO}`,
          color: theme.muted,
          letterSpacing: "0.05em",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 6,
            background: theme.live,
            boxShadow: "0 0 0 3px rgba(16,236,144,0.16)",
          }}
        />
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {countRef.current.toLocaleString("en-US")} BUILDS ROUTED
        </span>
      </div>

      <div
        aria-live="polite"
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          bottom: 12,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          font: `400 11px ${MONO}`,
          color: theme.muted,
        }}
      >
        <span style={{ color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {logRef.current}
        </span>
        <span className="hidden sm:inline" style={{ whiteSpace: "nowrap", color: theme.accent }}>
          click a source to dispatch
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// 11. TRACE SCRUB (INTERACTIVE HORIZON DELIVERY TIMELINE SCRUBBER)
// ============================================================================
const HORIZON_TRACE_STEPS = [
  { name: "01_discover", agent: "Hussain", start: 0, duration: 0.7, tokens: 1200, cost: 0.003, guardrail: false, note: "Understand the business, audience, and core conversion goals." },
  { name: "02_design", agent: "UI/UX", start: 0.6, duration: 1.1, tokens: 2800, cost: 0.007, guardrail: false, note: "Plan the visual hierarchy, typography, and responsive layout system." },
  { name: "03_develop", agent: "Studio", start: 1.5, duration: 1.3, tokens: 4900, cost: 0.012, guardrail: false, note: "Build clean, semantic HTML5, modern CSS, and interactive JS." },
  { name: "ai_optimize", agent: "Claude AI", start: 2.5, duration: 0.8, tokens: 3100, cost: 0.008, guardrail: false, note: "AI-assisted workflow accelerates performance tuning and accessibility." },
  { name: "client_review", agent: "Sign-off", start: 3.3, duration: 0.7, tokens: 0, cost: 0, guardrail: true, note: "Client reviews staging preview and approves final launch." },
  { name: "04_deliver", agent: "Production", start: 4.0, duration: 0.8, tokens: 950, cost: 0.002, guardrail: false, note: "Test, refine, and publish the website with ongoing precision care." },
];

function TraceScrub({ theme }) {
  const reduce = usePrefersReducedMotion();
  const ref = useRef(null);
  const trackRef = useRef(null);
  const total = 4.8;
  const playTime = 3.2;
  const [t, setT] = useState(2.6);
  const [drag, setDrag] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const playRef = useRef(0);

  const play = (from = 0) => {
    cancelAnimationFrame(playRef.current);
    if (reduce) {
      setT(total);
      return;
    }
    const t0 = performance.now();
    const run = () => {
      const k = Math.min(1, (performance.now() - t0) / (playTime * 1000));
      setT(from + (total - from) * k);
      if (k < 1) playRef.current = requestAnimationFrame(run);
    };
    playRef.current = requestAnimationFrame(run);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasPlayed) {
          setHasPlayed(true);
          play(0);
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(playRef.current);
    };
  }, [hasPlayed]);

  const fromPointer = (clientX) => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    setT(Math.max(0, Math.min(total, ((clientX - r.left) / r.width) * total)));
  };

  const passed = HORIZON_TRACE_STEPS.filter((s) => s.start <= t);
  const frac = (s) => Math.max(0, Math.min(1, (t - s.start) / s.duration));
  const tokens = Math.round(passed.reduce((a, s) => a + s.tokens * frac(s), 0));
  const score = Math.min(100, Math.round(78 + (t / total) * 22));
  const cur = [...HORIZON_TRACE_STEPS].reverse().find((s) => s.start <= t) ?? HORIZON_TRACE_STEPS[0];
  const pct = (t / total) * 100;

  return (
    <div ref={ref} style={{ width: "100%", fontFamily: SANS, color: theme.text, userSelect: "none" }}>
      <div style={{ border: `1px solid ${theme.line}`, background: theme.surface, borderRadius: 16, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 16px",
            borderBottom: `1px solid ${theme.line}`,
          }}
        >
          <span style={{ font: `500 12px ${MONO}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            run_hws26 · horizon delivery pipeline
          </span>
          <button
            type="button"
            onClick={() => play(0)}
            style={{
              flexShrink: 0,
              height: 30,
              padding: "0 12px",
              borderRadius: 7,
              border: `1px solid ${theme.line}`,
              background: theme.raised,
              color: theme.text,
              font: `500 12px ${SANS}`,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Replay
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderBottom: `1px solid ${theme.line}` }}>
          {[
            ["Timeline", `${t.toFixed(2)}s`],
            ["AI Context", tokens.toLocaleString("en-US")],
            ["Lighthouse", `${score}/100`],
          ].map(([k, v], i) => (
            <div
              key={k}
              style={{
                padding: "12px 16px",
                borderLeft: i ? `1px solid ${theme.line}` : "none",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ font: `500 11px ${MONO}`, color: theme.muted, letterSpacing: "0.05em" }}>{k.toUpperCase()}</span>
              <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ position: "relative", padding: "16px 16px 8px", display: "grid", gridTemplateColumns: "106px 1fr", columnGap: 12, rowGap: 8 }}>
          <span
            aria-hidden
            style={{
              position: "absolute",
              top: 8,
              bottom: -14,
              left: `calc(134px + (100% - 150px) * ${t / total})`,
              width: 1,
              background: theme.accent,
              opacity: 0.65,
              pointerEvents: "none",
            }}
          />
          {HORIZON_TRACE_STEPS.map((s, i) => {
            const on = cur === s;
            const f = frac(s);
            return (
              <React.Fragment key={i}>
                <span
                  style={{
                    font: `400 12px ${MONO}`,
                    color: s.start <= t ? theme.text : theme.muted,
                    opacity: s.start <= t ? 1 : 0.55,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.name}
                </span>
                <span style={{ position: "relative", height: 14, alignSelf: "center" }}>
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      bottom: 3,
                      left: `${(s.start / total) * 100}%`,
                      width: `${(s.duration / total) * 100}%`,
                      borderRadius: 3,
                      background: "rgba(250,250,249,0.06)",
                      backgroundImage: s.guardrail
                        ? `repeating-linear-gradient(135deg, ${theme.accent}66 0 2px, transparent 2px 5px)`
                        : undefined,
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      top: 3,
                      bottom: 3,
                      left: `${(s.start / total) * 100}%`,
                      width: `${(s.duration / total) * 100 * f}%`,
                      borderRadius: 3,
                      background: s.guardrail ? "transparent" : on ? theme.accent : "rgba(250,250,249,0.68)",
                      border: s.guardrail && f > 0 ? `1px solid ${theme.accent}` : "none",
                      boxSizing: "border-box",
                    }}
                  />
                </span>
              </React.Fragment>
            );
          })}
        </div>

        {/* Draggable Scrub Track */}
        <div style={{ padding: "6px 16px 14px", display: "grid", gridTemplateColumns: "106px 1fr", columnGap: 12, alignItems: "center" }}>
          <span style={{ font: `400 11px ${MONO}`, color: theme.muted }}>drag scrub →</span>
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Scrub through Horizon delivery pipeline"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={Number(t.toFixed(2))}
            onPointerDown={(e) => {
              cancelAnimationFrame(playRef.current);
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag(true);
              fromPointer(e.clientX);
            }}
            onPointerMove={(e) => drag && fromPointer(e.clientX)}
            onPointerUp={() => setDrag(false)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setT((v) => Math.min(total, v + total / 40));
              if (e.key === "ArrowLeft") setT((v) => Math.max(0, v - total / 40));
            }}
            style={{ position: "relative", height: 24, cursor: drag ? "grabbing" : "grab", touchAction: "none", outline: "none" }}
          >
            <span style={{ position: "absolute", left: 0, right: 0, top: 11, height: 1, background: theme.line }} />
            <span style={{ position: "absolute", left: 0, width: `${pct}%`, top: 11, height: 1.5, background: theme.accent }} />
            {[0, 0.25, 0.5, 0.75, 1].map((k) => (
              <span
                key={k}
                style={{ position: "absolute", left: `${k * 100}%`, top: 8, width: 1, height: 7, background: "rgba(250,250,249,0.22)" }}
              />
            ))}
            <span
              style={{
                position: "absolute",
                left: `calc(${pct}% - 7px)`,
                top: 5,
                width: 14,
                height: 14,
                borderRadius: 4,
                background: theme.accent,
                boxShadow: drag ? `0 0 0 4px ${theme.accentGlow}` : "none",
              }}
            />
          </div>
        </div>

        <div
          aria-live="polite"
          style={{
            borderTop: `1px solid ${theme.line}`,
            padding: "12px 16px",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "baseline",
            minHeight: 50,
            background: "rgba(0,0,0,0.22)",
          }}
        >
          <span style={{ font: `600 12px ${MONO}`, color: theme.accent, whiteSpace: "nowrap" }}>
            {cur.name} · {cur.agent}
          </span>
          <span style={{ fontSize: 13, color: theme.muted, lineHeight: 1.45 }}>{cur.note}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 12. HOLD TO APPROVE (HUMAN-IN-THE-LOOP CLIENT LAUNCH GATE)
// ============================================================================
const LAUNCH_REQUESTS = [
  {
    agent: "Hussain",
    action: "Publish Classic Garden v2.0 to Production",
    added: "responsive_grid: mobile + desktop verified",
    removed: "legacy static layout blocks",
    reason: "Custom garden & landscaping showcase verified across all viewports with 99+ performance score.",
    policy: "production launch needs client sign-off",
  },
  {
    agent: "Studio",
    action: "Deploy Ahmed Homeopathic Pharmacy Portal",
    added: "accessible_ui: WCAG AA contrast & navigation",
    removed: "unstructured product catalog",
    reason: "Clean medical & homeopathic consultation interface ready for live patient inquiries.",
    policy: "live healthcare site requires human approval",
  },
  {
    agent: "Claude AI",
    action: "Ship Custom WebGL Black Hole Experience",
    added: "shader_quality: adaptive DPR & 60fps cap",
    removed: "unoptimized render loop",
    reason: "Ray-marched Schwarzschild hero lens optimized for desktop and mobile GPUs.",
    policy: "major release requires founder confirmation",
  },
];

const AUTO_CHECKS = [
  "responsive_audit · QA",
  "lighthouse_100 · Perf",
  "semantic_html · Dev",
  "claude_code_review · AI",
  "ssl_security_check · Ops",
  "seo_meta_tags · Growth",
];

function HoldApprove({ theme }) {
  const reduce = usePrefersReducedMotion();
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState("waiting");
  const [progress, setProgress] = useState(0);
  const [wait, setWait] = useState(3);
  const [rows, setRows] = useState([
    { id: -3, label: AUTO_CHECKS[0], kind: "auto" },
    { id: -2, label: AUTO_CHECKS[1], kind: "auto" },
    { id: -1, label: AUTO_CHECKS[2], kind: "auto" },
  ]);
  const holdRef = useRef(null);
  const rowId = useRef(0);
  const holdTime = 0.85;
  const req = LAUNCH_REQUESTS[idx % LAUNCH_REQUESTS.length];

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setRows((r) => [
        ...r.slice(-2),
        { id: rowId.current++, label: AUTO_CHECKS[(rowId.current + 3) % AUTO_CHECKS.length], kind: "auto" },
      ]);
    }, 2400);
    return () => window.clearInterval(id);
  }, [reduce]);

  useEffect(() => {
    if (state !== "waiting") return;
    const id = window.setInterval(() => setWait((w) => w + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const finish = (ok) => {
    setState(ok ? "approved" : "rejected");
    window.setTimeout(() => {
      const shortTitle = req.action.length > 32 ? req.action.slice(0, 31) + "…" : req.action;
      setRows((r) => [...r.slice(-2), { id: rowId.current++, label: `${shortTitle} · ${req.agent}`, kind: ok ? "ok" : "no" }]);
      setState("gone");
    }, 950);
    window.setTimeout(() => {
      setIdx((i) => i + 1);
      setProgress(0);
      setWait(0);
      setState("waiting");
    }, 1500);
  };

  const startHold = () => {
    if (state !== "waiting" || holdRef.current) return;
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / (holdTime * 1000));
      setProgress(p);
      if (p >= 1) {
        holdRef.current = null;
        finish(true);
        return;
      }
      if (holdRef.current) holdRef.current.raf = requestAnimationFrame(tick);
    };
    holdRef.current = { start, raf: requestAnimationFrame(tick) };
  };

  const endHold = () => {
    if (!holdRef.current) return;
    cancelAnimationFrame(holdRef.current.raf);
    holdRef.current = null;
    const from = progress;
    const t0 = performance.now();
    const back = () => {
      const k = Math.min(1, (performance.now() - t0) / 220);
      setProgress(from * Math.pow(1 - k, 3));
      if (k < 1) requestAnimationFrame(back);
    };
    requestAnimationFrame(back);
  };

  const mmss = `${String(Math.floor(wait / 60)).padStart(2, "0")}:${String(wait % 60).padStart(2, "0")}`;
  const initials = req.agent.slice(0, 2).toUpperCase();

  return (
    <div style={{ width: "100%", fontFamily: SANS, color: theme.text, display: "flex", flexDirection: "column", gap: 10, userSelect: "none" }}>
      {/* Streaming Automated QA Checks */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          maskImage: "linear-gradient(180deg, transparent 0%, #000 55%)",
          WebkitMaskImage: "linear-gradient(180deg, transparent 0%, #000 55%)",
        }}
      >
        {rows.slice(-3).map((r) => (
          <div
            key={r.id}
            style={{
              height: 32,
              display: "flex",
              alignItems: "center",
              gap: 10,
              font: `400 12px ${MONO}`,
              color: r.kind === "auto" ? theme.muted : theme.text,
              borderBottom: `1px solid ${theme.line}`,
              overflow: "hidden",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={r.kind === "auto" ? theme.muted : theme.accent} strokeWidth="2">
              {r.kind === "no" ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M20 6 9 17l-5-5" />}
            </svg>
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
            <span>{r.kind === "auto" ? "verified" : r.kind === "ok" ? "launched" : "held"}</span>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, font: `500 11px ${MONO}`, color: theme.muted, letterSpacing: "0.08em" }}>
        <span style={{ flex: 1, height: 1, backgroundImage: `linear-gradient(90deg, ${theme.muted} 50%, transparent 50%)`, backgroundSize: "6px 1px", opacity: 0.45 }} />
        <span>LAUNCH GATE</span>
        <span style={{ flex: 1, height: 1, backgroundImage: `linear-gradient(90deg, ${theme.muted} 50%, transparent 50%)`, backgroundSize: "6px 1px", opacity: 0.45 }} />
      </div>

      {/* Approval Card */}
      <div style={{ minHeight: 295 }}>
        {state !== "gone" && (
          <div
            style={{
              border: `1px solid ${state === "waiting" ? theme.borderStrong : theme.accent}`,
              background: theme.surface,
              borderRadius: 16,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 16,
                  paddingBottom: 12,
              transition: "border-color 240ms ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: theme.raised,
                  border: `1px solid ${theme.line}`,
                  display: "grid",
                  placeItems: "center",
                  font: `600 12px ${MONO}`,
                  color: theme.accent,
                }}
              >
                {initials}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: theme.muted }}>{req.agent} requests sign-off to</span>
                <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {req.action}
                </span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, font: `500 12px ${MONO}`, color: theme.text, fontVariantNumeric: "tabular-nums" }}>
                {state === "waiting" && (
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: theme.live, animation: "haPulse 1.4s ease-in-out infinite" }} />
                )}
                {state === "waiting" ? mmss : state === "approved" ? "live" : "held"}
              </span>
            </div>

            <div
              style={{
                background: theme.bgPrimary,
                border: `1px solid ${theme.line}`,
                borderRadius: 9,
                padding: "10px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 5,
                font: `400 12px/1.5 ${MONO}`,
              }}
            >
              <span style={{ color: theme.text }}>+ {req.added}</span>
              <span style={{ color: theme.muted, textDecoration: "line-through", opacity: 0.7 }}>− {req.removed}</span>
            </div>

            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: theme.muted }}>{req.reason}</p>

            <div>
              <span style={{ padding: "4px 9px", borderRadius: 5, border: `1px solid ${theme.line}`, font: `500 11px ${MONO}`, color: theme.muted }}>
                gate · {req.policy}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <button
                type="button"
                disabled={state !== "waiting"}
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault();
                    startHold();
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter") endHold();
                }}
                aria-label="Press and hold to approve deployment"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  height: 42,
                  borderRadius: 9,
                  border: `1px solid ${theme.borderStrong}`,
                  background: theme.raised,
                  color: progress > 0.45 || state === "approved" ? theme.accentContrast : theme.text,
                  font: `600 13px ${SANS}`,
                  cursor: state === "waiting" ? "pointer" : "default",
                  touchAction: "none",
                  transition: "color 150ms ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    transformOrigin: "left center",
                    transform: `scaleX(${state === "approved" ? 1 : progress})`,
                    background: theme.accent,
                  }}
                />
                <span style={{ position: "relative" }}>
                  {state === "approved" ? "Approved & Live" : progress > 0 ? "Keep holding…" : "Hold to approve launch"}
                </span>
              </button>
              <button
                type="button"
                disabled={state !== "waiting"}
                onClick={() => finish(false)}
                style={{
                  height: 42,
                  padding: "0 16px",
                  borderRadius: 9,
                  border: `1px solid ${theme.line}`,
                  background: theme.bgPrimary,
                  color: state === "rejected" ? theme.muted : theme.text,
                  font: `500 13px ${SANS}`,
                  cursor: state === "waiting" ? "pointer" : "default",
                }}
              >
                {state === "rejected" ? "Held" : "Revise"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 13. THREAD FIELD (2D SPIRAL GRAVITY THREADS & SPARKS FOR CONTACT CTA)
// ============================================================================
function hexToRgb(hex) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i);
  if (!m) return "250,250,249";
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

function ThreadField({ threads = 280, twist = 0.92, horizon = 46, speed = 1, color = "#EFE2D3", background = "#080809", followCursor = true }) {
  const ref = useRef(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0,
      h = 0,
      dpr = 1,
      raf = 0,
      visible = true;
    const rgb = hexToRgb(color);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const lines = Array.from({ length: threads }, () => ({
      a: rnd() * Math.PI * 2,
      len: 0.45 + rnd() * 0.75,
      tw: (rnd() - 0.5) * 0.6,
      alpha: 0.06 + rnd() * 0.24,
      spark: rnd(),
      sp: 0.25 + rnd() * 0.75,
    }));
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(4000);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((e) => (visible = e[0]?.isIntersecting ?? true));
    io.observe(canvas);

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    if (followCursor) window.addEventListener("pointermove", onMove, { passive: true });

    const draw = (time) => {
      const t = (time / 1000) * speed;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2 + pointer.x * 20;
      const cy = h / 2 + pointer.y * 14;
      const R = Math.hypot(w, h) * 0.55;
      const hz = horizon;
      ctx.lineWidth = 0.65;

      for (const L of lines) {
        const a = L.a + t * 0.02 * L.sp;
        const outer = hz + (R - hz) * L.len;
        const x0 = cx + Math.cos(a) * hz * 1.05;
        const y0 = cy + Math.sin(a) * hz * 1.05 * 0.92;
        const a2 = a + twist * (0.6 + L.tw);
        const x2 = cx + Math.cos(a2) * outer;
        const y2 = cy + Math.sin(a2) * outer * 0.78;
        const am = a + twist * 0.35;
        const xm = cx + Math.cos(am) * outer * 0.45;
        const ym = cy + Math.sin(am) * outer * 0.45 * 0.85;

        const g = ctx.createLinearGradient(x0, y0, x2, y2);
        g.addColorStop(0, `rgba(${rgb},${L.alpha * 2.2})`);
        g.addColorStop(0.35, `rgba(${rgb},${L.alpha})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(xm, ym, x2, y2);
        ctx.stroke();

        if (L.spark > 0.55) {
          const k = 1 - (((t * 0.12 * L.sp + L.spark * 7) % 1) + 1) % 1;
          const u = 1 - k;
          const px = u * u * x0 + 2 * u * k * xm + k * k * x2;
          const py = u * u * y0 + 2 * u * k * ym + k * k * y2;
          ctx.fillStyle = `rgba(${rgb},${0.18 + 0.65 * (1 - k)})`;
          ctx.fillRect(px - 0.8, py - 0.8, 1.6, 1.6);
        }
      }

      const grd = ctx.createRadialGradient(cx, cy, hz * 0.7, cx, cy, hz * 2.6);
      grd.addColorStop(0, `rgba(${rgb},0.12)`);
      grd.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, hz * 2.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = background;
      ctx.beginPath();
      ctx.arc(cx, cy, hz, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(${rgb},0.6)`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, hz + 1.5, 0, Math.PI * 2);
      ctx.stroke();
    };

    const loop = (time) => {
      if (visible) draw(time);
      raf = requestAnimationFrame(loop);
    };

    if (reduce) draw(4000);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, [threads, twist, horizon, speed, color, background, followCursor, reduce]);

  return <canvas ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", background }} />;
}

// ============================================================================
// 14. MAIN PORTFOLIO APPLICATION: HORIZON WEB STUDIO
// ============================================================================
export default function App() {
  const [themeKey, setThemeKey] = useState("silver");
  const theme = THEMES[themeKey];
  const reduce = usePrefersReducedMotion();
  const isMobile = useIsMobile(768);
  const activeDiveVh = isMobile ? 95 : DIVE_VH;
  const diveP = useDiveProgress(activeDiveVh);

  // Dive Override Transforms (from Dive.txt)
  const heroOpacity = clampMap(diveP, 0, 0.30, 1, 0);
  const heroScale = reduce ? 1 : clampMap(diveP, 0, 0.35, 1, 0.86);
  const heroBlur = reduce ? 0 : clampMap(diveP, 0, 0.30, 0, 10);
  const spaghettiX = reduce ? 1 : clampMap(diveP, 0, 0.30, 1, 1.32);
  const spaghettiY = reduce ? 1 : clampMap(diveP, 0, 0.30, 1, 0.72);
  const cueOpacity = clampMap(diveP, 0, 0.07, 1, 0);
  const scrimOpacity = clampMap(diveP, 0, 0.32, 1, 0);

  // Far Side of the Event Horizon Manifesto (withHorizonIn)
  const horizonOpacity = clampMap(diveP, 0.78, 0.96, 0, 1);
  const horizonScale = reduce ? 1 : clampMap(diveP, 0.78, 1.0, 0.62, 1);
  const horizonBlur = reduce ? 0 : clampMap(diveP, 0.78, 0.96, 12, 0);

  // Interactive Inquiry Form State
  const [formState, setFormState] = useState({ name: "", email: "", service: "Business Website Development", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleInquirySubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 6000);
    setFormState({ name: "", email: "", service: "Business Website Development", message: "" });
  };

  return (
    <div
      id="top"
      style={{
        minHeight: "100vh",
        background: theme.bgPrimary,
        color: theme.text,
        fontFamily: SANS,
        transition: "background-color 400ms ease, color 300ms ease",
        overflowX: "clip",
      }}
    >
      {/* Global Keyframes & Utility Styles */}
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes scFall {
          0% { transform: translateY(-16px); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(46px); opacity: 0; }
        }
        @keyframes apRing {
          0% { transform: scale(1); opacity: .35; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes haPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .3; }
        }
        @keyframes hmSpin {
          from { transform: rotate(-11deg) scale(1); }
          50% { transform: rotate(-11deg) scale(1.06); }
          to { transform: rotate(-11deg) scale(1); }
        }
        .sc-btn { transition: opacity 200ms ease; }
        @media (hover:hover) and (pointer:fine) { .sc-btn:hover { opacity: 0.85; } }
        html.eb-over-canvas nav { backdrop-filter: blur(6px) !important; -webkit-backdrop-filter: blur(6px) !important; }
        ::selection { background: ${theme.accent}; color: ${theme.accentContrast}; }
      `}</style>

      {/* Navigation Bar with Hide-on-Scroll & Silver/Orange Mode Toggle */}
      <NavReveal theme={theme} onToggleTheme={setThemeKey} />

      {/* Progressive Viewport Bottom Blur (pauses automatically over canvases) */}
      <EdgeBlur edge="bottom" bandHeight={64} strength={1} tint={theme.bgPrimary} tintAmount={0.45} pauseOverCanvas={true} />

      {/* ====================================================================
          HERO SECTION: SCROLL DIVE THROUGH THE EVENT HORIZON (COMPACT ON MOBILE)
         ==================================================================== */}
      <section
        aria-label="Horizon Web Studio Hero"
        style={{
          position: "relative",
          width: "100%",
          height: `${100 + activeDiveVh}vh`,
          background: theme.voidBg,
        }}
      >
        {/* Sticky 100vh Viewport Frame */}
        <div
          style={{
            position: "sticky",
            top: 0,
            width: "100%",
            height: "100vh",
            overflow: "hidden",
          }}
        >
          {/* Real-Time Ray-Marched WebGL Black Hole (Full-Bleed Centerpiece) */}
          <BlackHole
            diveLength={activeDiveVh}
            ember={theme.ember}
            ice={theme.ice}
            hot={theme.hot}
            background={theme.voidBg}
            stars={isMobile ? 0.55 : 1}
            spin={1}
            quality="balanced"
            interactive={true}
            scrollDive={true}
            intro={true}
            introDuration={1.4}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 1,
              filter: isMobile ? "brightness(0.56) contrast(1.06)" : "none",
              transition: "filter 300ms ease",
            }}
          />

          {/* Smooth Legibility Scrim / Vignette (Stronger on mobile so all hero text & buttons stay crisp) */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              opacity: scrimOpacity,
              pointerEvents: "none",
              background: isMobile
                ? "linear-gradient(180deg, rgba(6,6,8,0.72) 0%, rgba(6,6,8,0.34) 36%, rgba(6,6,8,0.58) 66%, rgba(6,6,8,0.88) 100%)"
                : "linear-gradient(180deg, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.0) 26%, rgba(0,0,0,0.0) 64%, rgba(0,0,0,0.72) 100%)",
            }}
          />

          {/* Right-Edge Horizon Distance Ruler (DiveGauge) */}
          <DiveGauge
            progress={diveP}
            side="right"
            color="rgba(220,216,210,0.28)"
            accent={theme.accent}
            label="Distance to horizon"
          />

          {/* Split-Corner Editorial Hero Overlay (Mobile matches left-aligned stacked reference) */}
          <div
            className="pt-[84px] pb-7 px-5 md:pt-[96px] md:pb-[74px] md:px-[clamp(20px,4vw,56px)]"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              maxWidth: 1360,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              opacity: heroOpacity,
              transform: `scale(${heroScale})`,
              filter: heroBlur > 0.1 ? `blur(${heroBlur}px)` : "none",
              pointerEvents: "none",
            }}
          >
            {/* TOP-LEFT DISPLAY HEADLINE */}
            <div style={{ alignSelf: "flex-start", maxWidth: "min(560px, 88vw)" }}>
              <h1
                style={{
                  fontFamily: SANS,
                  fontWeight: 700,
                  fontSize: "clamp(2.75rem, 9vw, 3.85rem)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.035em",
                  margin: 0,
                  color: "#FAFAF9",
                  textShadow: "0 4px 24px rgba(0,0,0,0.85)",
                  transform: `scale(${spaghettiX}, ${spaghettiY})`,
                  transformOrigin: "0% 50%",
                }}
              >
                Digital craft.
              </h1>
            </div>

            {/* BOTTOM SPLIT ROW: Stacked left-aligned on Mobile, Split corners on Desktop */}
            <div
              className="flex flex-col md:flex-row md:items-end justify-between gap-5 md:gap-6"
              style={{ width: "100%" }}
            >
              {/* SUBCOPY & STACKED ACTION BUTTONS */}
              <div
                style={{
                  maxWidth: 380,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  paddingBottom: 12,
                  pointerEvents: diveP > 0.25 ? "none" : "auto",
                }}
              >
                <p
                  style={{
                    fontFamily: SANS,
                    fontSize: "clamp(0.95rem, 1.15vw, 1.05rem)",
                    lineHeight: 1.48,
                    margin: 0,
                    color: "rgba(250, 250, 249, 0.86)",
                    textShadow: "0 2px 16px rgba(0,0,0,0.95)",
                  }}
                >
                  Horizon Web Studio — founded by Hussain. Crafting modern websites and immersive digital experiences that help ambitious businesses stand out, connect and grow.
                </p>

                <div className="flex flex-col items-start sm:flex-row sm:flex-wrap sm:items-center gap-2.5">
                  <a
                    href="#projects"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 18px",
                      borderRadius: 7,
                      background: "#FAFAF9",
                      color: "#0A0A0C",
                      fontFamily: SANS,
                      fontSize: 12.5,
                      fontWeight: 600,
                      textDecoration: "none",
                      boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
                      transition: "transform 200ms ease, opacity 200ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.92")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    Explore our work <span aria-hidden>↗</span>
                  </a>
                  <a
                    href="#contact"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 18px",
                      borderRadius: 7,
                      background: "rgba(18, 18, 20, 0.78)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      border: "1px solid rgba(250, 250, 249, 0.18)",
                      color: "#FAFAF9",
                      fontFamily: SANS,
                      fontSize: 12.5,
                      fontWeight: 500,
                      textDecoration: "none",
                      transition: "border-color 200ms ease, background 200ms ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accent)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(250, 250, 249, 0.18)")}
                  >
                    Start a project <span aria-hidden>→</span>
                  </a>
                </div>
              </div>

              {/* BOTTOM DISPLAY HEADLINE: Left-aligned on mobile, Right-aligned on desktop */}
              <div className="self-start md:self-end text-left md:text-right max-w-[min(620px,92vw)] pt-1 pb-6 md:pt-0 md:pb-0">
                <div
                  style={{
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: "clamp(1.75rem, 6vw, 3.5rem)",
                    lineHeight: 1.08,
                    letterSpacing: "-0.03em",
                    margin: 0,
                    color: "#FAFAF9",
                    textShadow: "0 4px 24px rgba(0,0,0,0.85)",
                    transform: `scale(${spaghettiX}, ${spaghettiY})`,
                    transformOrigin: isMobile ? "0% 50%" : "100% 50%",
                  }}
                >
                  Beyond ordinary.
                </div>
              </div>
            </div>
          </div>

          {/* Post-Horizon Manifesto (withHorizonIn: emerges on the far side of the event horizon) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 6,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 24px",
              opacity: horizonOpacity,
              transform: `scale(${horizonScale})`,
              filter: horizonBlur > 0.1 ? `blur(${horizonBlur}px)` : "none",
              pointerEvents: diveP > 0.88 ? "auto" : "none",
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: theme.accent,
                marginBottom: 16,
              }}
            >
              SINGULARITY REACHED · HORIZON WEB STUDIO
            </span>
            <h2
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: "clamp(1.75rem, 4.2vw, 3.3rem)",
                lineHeight: 1.12,
                letterSpacing: "-0.03em",
                maxWidth: 920,
                margin: "0 auto 20px",
                color: theme.text,
              }}
            >
              WE BUILD DIGITAL EXPERIENCES BEYOND ORDINARY. — HORIZON WEB STUDIO
            </h2>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(1rem, 1.3vw, 1.15rem)",
                lineHeight: 1.65,
                maxWidth: 620,
                color: theme.muted,
                marginBottom: 28,
              }}
            >
              Founded by Hussain — partnering with modern businesses to architect high-impact websites, conversion-focused landing pages, and AI-accelerated digital products.
            </p>
            <a
              href="#about"
              style={{
                padding: "11px 22px",
                borderRadius: 999,
                border: `1px solid ${theme.accent}`,
                color: theme.accent,
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Enter Studio ↓
            </a>
          </div>

          {/* Bottom-Center Scroll Cue (Hidden on mobile so bottom headline matches reference cleanly) */}
          <div
            className="hidden md:flex"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 12,
              zIndex: 7,
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <ScrollCue
              label="Scroll to cross the horizon"
              text={theme.text}
              muted={theme.muted}
              accent={theme.accent}
              opacity={cueOpacity}
            />
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 01 // THE STUDIO (#about)
         ==================================================================== */}
      <section
        id="about"
        className="py-12 md:py-20"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingLeft: 20,
          paddingRight: 20,
          borderTop: `1px solid ${theme.line}`,
        }}
      >
        <div className="mb-8 md:mb-12" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 14 }}>
          <div>
            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em", color: theme.accent, display: "block", marginBottom: 8 }}>
              01 // THE STUDIO
            </span>
            <h2 style={{ fontFamily: SANS, fontWeight: 800, fontSize: "clamp(1.85rem, 4.5vw, 3.6rem)", letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
              BEYOND THE ORDINARY.
            </h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <AgentPulse text={theme.text} live={theme.live} />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                padding: "7px 12px",
                borderRadius: 999,
                border: `1px solid ${theme.line}`,
                background: theme.surface,
                color: theme.muted,
              }}
            >
              FOUNDED BY HUSSAIN · EST. 2026
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          {/* Left Bio & Philosophy */}
          <div className="lg:col-span-7" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p className="text-base md:text-lg" style={{ lineHeight: 1.65, color: theme.text, margin: 0 }}>
              Horizon Web Studio is a dedicated digital studio founded by <strong>Hussain</strong>, built on the belief that every modern business deserves a web presence that feels unmistakable, fast, and deeply intentional.
            </p>
            <p className="text-sm md:text-[15.5px]" style={{ lineHeight: 1.7, color: theme.muted, margin: 0 }}>
              We bridge disciplined front-end engineering with expressive visual design and modern AI-assisted workflows—turning complex ideas into responsive, accessible, and conversion-ready websites without bloated templates.
            </p>

            {/* Three Core Studio Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4" style={{ marginTop: 6 }}>
              {[
                {
                  num: "01",
                  title: "Modern Web Development",
                  desc: "Clean, semantic, high-performance code built for scale and reliability.",
                },
                {
                  num: "02",
                  title: "Thoughtful UI/UX",
                  desc: "Immersive interfaces designed around user intent and visual elegance.",
                },
                {
                  num: "03",
                  title: "AI-Assisted Workflow",
                  desc: "Leveraging cutting-edge AI tools like Claude to accelerate building and optimize code.",
                },
              ].map((pillar) => (
                <div
                  key={pillar.num}
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    border: `1px solid ${theme.line}`,
                    background: theme.surface,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 12, color: theme.accent }}>{pillar.num}</span>
                  <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: theme.text }}>{pillar.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.55, color: theme.muted, margin: 0 }}>{pillar.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right Studio Telemetry & Metrics Card */}
          <div
            className="lg:col-span-5"
            style={{
              padding: 26,
              borderRadius: 18,
              border: `1px solid ${theme.borderStrong}`,
              background: theme.surface,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.line}`, paddingBottom: 14 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: theme.muted }}>STUDIO TELEMETRY</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: MONO,
                  fontSize: 11,
                  color: theme.live,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.live }} />
                ACCEPTING 2026 PROJECTS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
              {[
                { metric: "100%", label: "Tailored Code", sub: "Bespoke architecture—zero cookie-cutter templates" },
                { metric: "02+", label: "Client Works", sub: "Production web platforms shipped & live" },
                { metric: "24/7", label: "Precision Focus", sub: "Dedicated craftsmanship from brief to launch" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: theme.bgPrimary,
                    border: `1px solid ${theme.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  paddingBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{stat.label}</div>
                    <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{stat.sub}</div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 700, color: theme.accent }}>{stat.metric}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 02 // CAPABILITIES (#services)
         ==================================================================== */}
      <section
        id="services"
        className="py-12 md:py-20"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingLeft: 20,
          paddingRight: 20,
          borderTop: `1px solid ${theme.line}`,
        }}
      >
        <div className="mb-8 md:mb-12">
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em", color: theme.accent, display: "block", marginBottom: 8 }}>
            02 // CAPABILITIES
          </span>
          <h2 style={{ fontFamily: SANS, fontWeight: 800, fontSize: "clamp(1.85rem, 4.5vw, 3.6rem)", letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
            PREMIUM SERVICES.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {[
            {
              num: "01",
              tag: "Strategic & Scalable",
              title: "Business Website Development",
              desc: "Full-scale multi-page websites engineered for credibility, fast load times, clear brand storytelling, and long-term business growth.",
            },
            {
              num: "02",
              tag: "Conversion Focused",
              title: "Landing Page Design",
              desc: "High-impact single-page experiences structured to capture attention, articulate value immediately, and turn visitors into inquiries.",
            },
            {
              num: "03",
              tag: "Universal Compatibility",
              title: "Responsive Web Experiences",
              desc: "Fluid layouts and touch-friendly interactions tested across mobile phones, tablets, laptops, and ultra-wide displays.",
            },
            {
              num: "04",
              tag: "Ongoing Excellence",
              title: "Website Maintenance & Improvements",
              desc: "Continuous UI refinements, speed optimization, accessibility upgrades, and reliable technical care for existing websites.",
            },
          ].map((srv) => (
            <article
              key={srv.num}
              style={{
                padding: 28,
                borderRadius: 18,
                border: `1px solid ${theme.line}`,
                background: theme.surface,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 18,
                transition: "border-color 240ms ease, transform 240ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = theme.accent;
                e.currentTarget.style.transform = "translateY(-3px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = theme.line;
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: theme.accent }}>{srv.num}</span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: theme.raised,
                    border: `1px solid ${theme.line}`,
                    color: theme.muted,
                  }}
                >
                  {srv.tag}
                </span>
              </div>
              <div>
                <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 10px", color: theme.text }}>
                  {srv.title}
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.65, color: theme.muted, margin: 0 }}>{srv.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ====================================================================
          SECTION 03 // PORTFOLIO (#projects)
         ==================================================================== */}
      <section
        id="projects"
        className="py-12 md:py-20"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingLeft: 20,
          paddingRight: 20,
          borderTop: `1px solid ${theme.line}`,
        }}
      >
        <div className="mb-8 md:mb-12" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <div>
            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em", color: theme.accent, display: "block", marginBottom: 8 }}>
              03 // PORTFOLIO
            </span>
            <h2 style={{ fontFamily: SANS, fontWeight: 800, fontSize: "clamp(1.85rem, 4.5vw, 3.6rem)", letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
              SELECTED WORK.
            </h2>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, color: theme.muted }}>
            PRODUCTION DEPLOYMENTS · LIVE & VERIFIED
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {[
            {
              index: "01 / 02",
              title: "Classic Garden",
              category: "Landscaping & Outdoor Architecture",
              description:
                "A modern garden and landscaping business website showcasing curated outdoor transformations, service packages, visual galleries, and direct client consultation booking.",
              tags: ["HTML5", "CSS3", "JavaScript", "Responsive"],
              liveUrl: "https://hussainmughal27.github.io/Classic-Garden/",
              repoUrl: "https://github.com/Hussainmughal27/Classic-Garden",
              accentGradient:
                theme.id === "silver"
                  ? "linear-gradient(135deg, rgba(239,226,211,0.16) 0%, rgba(18,18,20,0.95) 100%)"
                  : "linear-gradient(135deg, rgba(255,106,31,0.20) 0%, rgba(21,17,14,0.95) 100%)",
            },
            {
              index: "02 / 02",
              title: "Ahmed Homeopathic Pharmacy",
              category: "Healthcare & Natural Medicine",
              description:
                "A professional homeopathic pharmacy website designed with clarity, trust, and accessibility—featuring treatment categories, patient guidance, and seamless inquiry channels.",
              tags: ["HTML5", "CSS3", "JavaScript", "Accessible"],
              liveUrl: "https://hussainmughal27.github.io/ahmed-pharmacy/",
              repoUrl: "https://github.com/Hussainmughal27/ahmed-pharmacy/",
              accentGradient:
                theme.id === "silver"
                  ? "linear-gradient(135deg, rgba(191,192,194,0.16) 0%, rgba(18,18,20,0.95) 100%)"
                  : "linear-gradient(135deg, rgba(255,179,128,0.18) 0%, rgba(21,17,14,0.95) 100%)",
            },
          ].map((proj) => (
            <article
              key={proj.title}
              style={{
                borderRadius: 20,
                border: `1px solid ${theme.borderStrong}`,
                background: theme.surface,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              {/* Visual Architectural Preview Header */}
              <div
                className="h-[145px] md:h-[210px] p-4 md:p-[22px]"
                style={{
                  position: "relative",
                  background: proj.accentGradient,
                  borderBottom: `1px solid ${theme.line}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: theme.accent, fontWeight: 600 }}>
                    {proj.index}
                  </span>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 11,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "rgba(0,0,0,0.55)",
                      border: `1px solid ${theme.line}`,
                      color: theme.text,
                    }}
                  >
                    {proj.category}
                  </span>
                </div>

                {/* Stylized Wireframe / Browser Preview Bar */}
                <div
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${theme.line}`,
                    background: "rgba(8, 8, 10, 0.78)",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.22)" }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.22)" }} />
                    <span style={{ fontFamily: MONO, fontSize: 11, color: theme.muted, marginLeft: 8 }}>
                      {proj.liveUrl.replace("https://", "")}
                    </span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: theme.live }}>● LIVE</span>
                </div>
              </div>

              {/* Project Details & Links */}
              <div style={{ padding: 26, display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
                <div>
                  <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 10px", color: theme.text }}>
                    {proj.title}
                  </h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.65, color: theme.muted, margin: 0 }}>{proj.description}</p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {proj.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: theme.raised,
                        border: `1px solid ${theme.line}`,
                        color: theme.text,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, paddingTop: 6, marginTop: "auto" }}>
                  <a
                    href={proj.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 8,
                      background: theme.accent,
                      color: theme.accentContrast,
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    Live Website ↗
                  </a>
                  <a
                    href={proj.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 8,
                      background: theme.raised,
                      border: `1px solid ${theme.line}`,
                      color: theme.text,
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    GitHub Source ↗
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ====================================================================
          SECTION 04 // METHODOLOGY & INTERACTIVE PIPELINE (#approach & #workflow)
         ==================================================================== */}
      <section
        id="approach"
        className="py-12 md:py-20"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          paddingLeft: 20,
          paddingRight: 20,
          borderTop: `1px solid ${theme.line}`,
        }}
      >
        <div className="mb-8 md:mb-12">
          <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em", color: theme.accent, display: "block", marginBottom: 8 }}>
            04 // METHODOLOGY
          </span>
          <h2 style={{ fontFamily: SANS, fontWeight: 800, fontSize: "clamp(1.85rem, 4.5vw, 3.6rem)", letterSpacing: "-0.03em", lineHeight: 1.05, margin: 0 }}>
            OUR APPROACH.
          </h2>
        </div>

        {/* 4 Core Methodology Pillars */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 md:gap-5 mb-10 md:mb-16">
          {[
            { step: "01", title: "DISCOVER", desc: "Understand the business and its goals." },
            { step: "02", title: "DESIGN", desc: "Plan the layout and user experience." },
            { step: "03", title: "DEVELOP", desc: "Build responsive, functional websites." },
            { step: "04", title: "DELIVER", desc: "Test, refine and publish the website." },
          ].map((item) => (
            <div
              key={item.step}
              className="p-4 md:p-6"
              style={{
                borderRadius: 16,
                border: `1px solid ${theme.line}`,
                background: theme.surface,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: theme.accent }}>{item.step}</span>
              <h3 className="text-base md:text-[19px]" style={{ fontFamily: SANS, fontWeight: 800, letterSpacing: "0.02em", margin: 0 }}>{item.title}</h3>
              <p className="text-xs md:text-sm" style={{ lineHeight: 1.55, color: theme.muted, margin: 0 }}>{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Interactive Studio Engineering Showcase (RouteFlow + TraceScrub + HoldApprove) */}
        <div id="workflow" className="gap-6 md:gap-9" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <h3 className="text-lg md:text-[22px]" style={{ fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
              Inside the Horizon Delivery Engine
            </h3>
            <span style={{ fontFamily: MONO, fontSize: 11, color: theme.muted }}>
              INTERACTIVE ARCHITECTURE · CLICK, SCRUB & HOLD TO TEST
            </span>
          </div>

          {/* RouteFlow Full-Width Interactive Routing Diagram */}
          <RouteFlow theme={theme} isMobile={isMobile} />

          {/* TraceScrub & HoldApprove Side-by-Side Interactive Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: theme.accent }}>
                TIMELINE EXECUTION · DRAG PLAYHEAD TO INSPECT
              </div>
              <TraceScrub theme={theme} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: theme.accent }}>
                CLIENT LAUNCH GUARDRAIL · PRESS & HOLD TO DEPLOY
              </div>
              <HoldApprove theme={theme} />
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          SECTION 05 // INQUIRY & THREAD FIELD CTA (#contact)
         ==================================================================== */}
      <section
        id="contact"
        className="py-14 md:py-24"
        style={{
          position: "relative",
          overflow: "hidden",
          borderTop: `1px solid ${theme.line}`,
          paddingLeft: 20,
          paddingRight: 20,
        }}
      >
        {/* Interactive Spiral Gravity ThreadField Backdrop */}
        <ThreadField
          threads={260}
          twist={0.95}
          horizon={48}
          speed={1}
          color={theme.accent}
          background={theme.bgPrimary}
          followCursor={true}
        />

        {/* Readability Radial Vignette */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 50%, rgba(8,8,9,0.52) 0%, rgba(8,8,9,0.88) 100%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 5, maxWidth: 1120, margin: "0 auto" }}>
          <div className="mb-8 md:mb-14" style={{ textAlign: "center", maxWidth: 740, marginLeft: "auto", marginRight: "auto" }}>
            <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.18em", color: theme.accent, display: "block", marginBottom: 10 }}>
              05 // INQUIRY
            </span>
            <h2
              style={{
                fontFamily: SANS,
                fontWeight: 800,
                fontSize: "clamp(1.85rem, 4.8vw, 3.8rem)",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                margin: "0 0 12px",
              }}
            >
              LET'S CREATE SOMETHING EXTRAORDINARY.
            </h2>
            <p className="text-sm md:text-[16.5px]" style={{ lineHeight: 1.6, color: theme.muted, margin: 0 }}>
              Have an idea? Let's turn it into a digital experience. Reach out directly or send a brief below.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Direct Contact Channels */}
            <div className="lg:col-span-5" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                {
                  label: "EMAIL",
                  value: "hussainmugal10@gmail.com",
                  href: "mailto:hussainmugal10@gmail.com",
                  hint: "Direct studio inbox",
                },
                {
                  label: "WHATSAPP",
                  value: "03411044227",
                  href: "https://wa.me/923411044227",
                  hint: "Fast consultation chat",
                },
                {
                  label: "GITHUB",
                  value: "github.com/Hussainmughal27",
                  href: "https://github.com/Hussainmughal27",
                  hint: "Open-source & client repositories",
                },
              ].map((ch) => (
                <a
                  key={ch.label}
                  href={ch.href}
                  target={ch.href.startsWith("http") ? "_blank" : undefined}
                  rel={ch.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{
                    padding: 20,
                    borderRadius: 16,
                    border: `1px solid ${theme.borderStrong}`,
                    background: "rgba(18, 18, 20, 0.84)",
                    backdropFilter: "blur(12px)",
                    textDecoration: "none",
                    color: theme.text,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    transition: "border-color 220ms ease, transform 220ms ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = theme.accent;
                    e.currentTarget.style.transform = "translateX(4px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = theme.borderStrong;
                    e.currentTarget.style.transform = "translateX(0)";
                  }}
                >
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: theme.accent, letterSpacing: "0.08em", marginBottom: 4 }}>
                      {ch.label} · {ch.hint}
                    </div>
                    <div style={{ fontSize: 15.5, fontWeight: 600 }}>{ch.value}</div>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 16, color: theme.accent }}>↗</span>
                </a>
              ))}
            </div>

            {/* Project Brief Form */}
            <form
              onSubmit={handleInquirySubmit}
              className="lg:col-span-7"
              style={{
                padding: 28,
                borderRadius: 18,
                border: `1px solid ${theme.borderStrong}`,
                background: "rgba(18, 18, 20, 0.88)",
                backdropFilter: "blur(14px)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: theme.muted }}>YOUR NAME</span>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Ali Raza"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    style={{
                      height: 44,
                      padding: "0 14px",
                      borderRadius: 9,
                      border: `1px solid ${theme.line}`,
                      background: theme.bgPrimary,
                      color: theme.text,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: theme.muted }}>EMAIL ADDRESS</span>
                  <input
                    required
                    type="email"
                    placeholder="you@company.com"
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    style={{
                      height: 44,
                      padding: "0 14px",
                      borderRadius: 9,
                      border: `1px solid ${theme.line}`,
                      background: theme.bgPrimary,
                      color: theme.text,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </label>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: theme.muted }}>SERVICE REQUIRED</span>
                <select
                  value={formState.service}
                  onChange={(e) => setFormState({ ...formState, service: e.target.value })}
                  style={{
                    height: 44,
                    padding: "0 14px",
                    borderRadius: 9,
                    border: `1px solid ${theme.line}`,
                    background: theme.bgPrimary,
                    color: theme.text,
                    fontSize: 14,
                    outline: "none",
                  }}
                >
                  <option>Business Website Development</option>
                  <option>Landing Page Design</option>
                  <option>Responsive Web Experiences</option>
                  <option>Website Maintenance & Improvements</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: theme.muted }}>PROJECT DETAILS</span>
                <textarea
                  required
                  rows={4}
                  placeholder="Tell Hussain about your business, goals, and timeline..."
                  value={formState.message}
                  onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 9,
                    border: `1px solid ${theme.line}`,
                    background: theme.bgPrimary,
                    color: theme.text,
                    fontSize: 14,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </label>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <button
                  type="submit"
                  style={{
                    padding: "13px 26px",
                    borderRadius: 10,
                    border: "none",
                    background: theme.accent,
                    color: theme.accentContrast,
                    fontFamily: MONO,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    boxShadow: `0 0 24px ${theme.accentGlow}`,
                  }}
                >
                  Send Project Inquiry →
                </button>

                {submitted && (
                  <span style={{ fontFamily: MONO, fontSize: 12, color: theme.live }}>
                    ✓ Brief logged! Hussain will respond shortly.
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ====================================================================
          FOOTER
         ==================================================================== */}
      <footer
        style={{
          borderTop: `1px solid ${theme.line}`,
          background: theme.bgPrimary,
          padding: "40px 24px 64px",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.05em" }}>HORIZON WEB STUDIO</div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: theme.muted, marginTop: 4 }}>
              © 2026 Horizon Web Studio. Founded by Hussain. All rights reserved.
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontFamily: MONO, fontSize: 12 }}>
            <a href="#about" style={{ color: theme.muted, textDecoration: "none" }}>Studio</a>
            <a href="#services" style={{ color: theme.muted, textDecoration: "none" }}>Services</a>
            <a href="#projects" style={{ color: theme.muted, textDecoration: "none" }}>Projects</a>
            <a href="#approach" style={{ color: theme.muted, textDecoration: "none" }}>Approach</a>
            <a href="mailto:hussainmugal10@gmail.com" style={{ color: theme.accent, textDecoration: "none" }}>
              hussainmugal10@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
