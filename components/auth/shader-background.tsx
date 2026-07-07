"use client"

import { useEffect, useRef, useSyncExternalStore } from "react"

function subscribeReducedMotion(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
  mq.addEventListener("change", onStoreChange)
  return () => mq.removeEventListener("change", onStoreChange)
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* Timbl mark - app/icon.svg */
const BRAND_COLORS = {
  base: "#0c1224",
  green: "#00E89A",
  purple: "#7B5EFF",
  coral: "#FF5040",
} as const

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

type ShaderColors = {
  a?: string
  b?: string
  c?: string
  base?: string
}

type ShaderBackgroundProps = {
  flowSpeed?: number
  colorIntensity?: number
  noiseLayers?: number
  mouseInfluence?: number
  colors?: ShaderColors
  className?: string
}

export function ShaderBackground({
  flowSpeed = 0.4,
  colorIntensity = 2.2,
  noiseLayers = 4,
  mouseInfluence = 0.25,
  colors,
  className = "",
}: ShaderBackgroundProps) {
  const colorA = colors?.a ?? BRAND_COLORS.green
  const colorB = colors?.b ?? BRAND_COLORS.purple
  const colorC = colors?.c ?? BRAND_COLORS.coral
  const baseColor = colors?.base ?? BRAND_COLORS.base
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mousePos = useRef({ x: 0.5, y: 0.5 })
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  )

  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl", { alpha: false, antialias: false })
    if (!gl) {
      console.error("WebGL not supported")
      return
    }

    const vertexShaderSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `

    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform vec2 iMouse;
      uniform float uFlowSpeed;
      uniform float uColorIntensity;
      uniform float uNoiseLayers;
      uniform float uMouseInfluence;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      uniform vec3 uColorC;
      uniform vec3 uBaseColor;

      #define MARCH_STEPS 32

      float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
      }

      float fbm(vec3 p) {
          float f = 0.0;
          float amp = 0.5;
          for (int i = 0; i < 8; i++) {
              if (float(i) >= uNoiseLayers) break;
              f += amp * hash(p.xy);
              p *= 2.0;
              amp *= 0.5;
          }
          return f;
      }

      float map(vec3 p) {
          vec3 q = p;
          q.z += iTime * uFlowSpeed;
          vec2 mouse = (iMouse.xy / iResolution.xy - 0.5) * 2.0;
          q.xy += mouse * uMouseInfluence;
          float f = fbm(q * 2.0);
          f *= sin(p.y * 2.0 + iTime) * 0.5 + 0.5;
          return clamp(f, 0.0, 1.0);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
        vec3 ro = vec3(0.0, -1.0, 0.0);
        vec3 rd = normalize(vec3(uv, 1.0));
        vec3 col = vec3(0.0);
        float t = 0.0;

        for (int i = 0; i < MARCH_STEPS; i++) {
            vec3 p = ro + rd * t;
            float density = map(p);
            if (density > 0.0) {
                float blend = sin(p.y * 2.0 + iTime * 0.5) * 0.5 + 0.5;
                vec3 auroraColor = mix(uColorA, uColorB, blend);
                auroraColor = mix(auroraColor, uColorC, sin(iTime * 0.3 + p.y) * 0.5 + 0.5);
                col += auroraColor * density * 0.14 * uColorIntensity;
            }
            t += 0.1;
        }

        float peak = max(col.r, max(col.g, col.b));
        col = mix(col, uBaseColor, smoothstep(0.5, 0.9, peak));
        gl_FragColor = vec4(col, 1.0);
      }
    `

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER)
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER)
    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program))
      return
    }
    gl.useProgram(program)

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

    const aPosition = gl.getAttribLocation(program, "aPosition")
    gl.enableVertexAttribArray(aPosition)
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution")
    const iTimeLocation = gl.getUniformLocation(program, "iTime")
    const iMouseLocation = gl.getUniformLocation(program, "iMouse")
    const uFlowSpeedLocation = gl.getUniformLocation(program, "uFlowSpeed")
    const uColorIntensityLocation = gl.getUniformLocation(program, "uColorIntensity")
    const uNoiseLayersLocation = gl.getUniformLocation(program, "uNoiseLayers")
    const uMouseInfluenceLocation = gl.getUniformLocation(program, "uMouseInfluence")
    const uColorALocation = gl.getUniformLocation(program, "uColorA")
    const uColorBLocation = gl.getUniformLocation(program, "uColorB")
    const uColorCLocation = gl.getUniformLocation(program, "uColorC")
    const uBaseColorLocation = gl.getUniformLocation(program, "uBaseColor")

    const [rA, gA, bA] = hexToRgb(colorA)
    const [rB, gB, bB] = hexToRgb(colorB)
    const [rC, gC, bC] = hexToRgb(colorC)
    const [rBase, gBase, bBase] = hexToRgb(baseColor)
    gl.uniform3f(uColorALocation, rA, gA, bA)
    gl.uniform3f(uColorBLocation, rB, gB, bB)
    gl.uniform3f(uColorCLocation, rC, gC, bC)
    gl.uniform3f(uBaseColorLocation, rBase, gBase, bBase)

    const startTime = performance.now()
    let animationFrameId: number

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mousePos.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      }
    }
    window.addEventListener("mousemove", handleMouseMove)

    const resizeCanvas = () => {
      const container = containerRef.current
      const w = container?.clientWidth || canvas.clientWidth || window.innerWidth
      const h = container?.clientHeight || canvas.clientHeight || window.innerHeight
      if (w === 0 || h === 0) return
      canvas.width = w
      canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(iResolutionLocation, w, h)
    }

    const ro = new ResizeObserver(resizeCanvas)
    if (containerRef.current) ro.observe(containerRef.current)
    window.addEventListener("resize", resizeCanvas)
    resizeCanvas()

    const renderLoop = () => {
      if (gl.isContextLost()) return
      gl.uniform1f(iTimeLocation, (performance.now() - startTime) / 1000)
      gl.uniform2f(
        iMouseLocation,
        mousePos.current.x * canvas.width,
        (1 - mousePos.current.y) * canvas.height,
      )
      gl.uniform1f(uFlowSpeedLocation, flowSpeed)
      gl.uniform1f(uColorIntensityLocation, colorIntensity)
      gl.uniform1f(uNoiseLayersLocation, noiseLayers)
      gl.uniform1f(uMouseInfluenceLocation, mouseInfluence)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      animationFrameId = requestAnimationFrame(renderLoop)
    }
    renderLoop()

    return () => {
      cancelAnimationFrame(animationFrameId)
      ro.disconnect()
      window.removeEventListener("resize", resizeCanvas)
      window.removeEventListener("mousemove", handleMouseMove)
      if (!gl.isContextLost()) {
        gl.deleteProgram(program)
        gl.deleteShader(vertexShader)
        gl.deleteShader(fragmentShader)
        gl.deleteBuffer(vertexBuffer)
      }
    }
  }, [
    reducedMotion,
    flowSpeed,
    colorIntensity,
    noiseLayers,
    mouseInfluence,
    colorA,
    colorB,
    colorC,
    baseColor,
  ])

  if (reducedMotion) {
    return (
      <div
        className={`pointer-events-none absolute inset-0 z-0 ${className}`}
        style={{
          backgroundColor: baseColor,
          backgroundImage: `linear-gradient(to bottom right, ${colorB}59, ${baseColor}, ${colorC}4d)`,
        }}
        aria-hidden
      />
    )
  }

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
      style={{ backgroundColor: baseColor }}
      aria-hidden
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
