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

const BRAND_COLORS = {
  accent: "#3b82f6",
  violet: "#8b5cf6",
  emerald: "#34d399",
} as const

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

type ShaderBackgroundProps = {
  flowSpeed?: number
  colorIntensity?: number
  noiseLayers?: number
  mouseInfluence?: number
  className?: string
}

export function ShaderBackground({
  flowSpeed = 0.4,
  colorIntensity = 1.0,
  noiseLayers = 4,
  mouseInfluence = 0.25,
  className = "",
}: ShaderBackgroundProps) {
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

    const gl = canvas.getContext("webgl")
    if (!gl) return

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
                col += auroraColor * density * 0.1 * uColorIntensity;
            }
            t += 0.1;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
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
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
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

    const [rA, gA, bA] = hexToRgb(BRAND_COLORS.accent)
    const [rB, gB, bB] = hexToRgb(BRAND_COLORS.violet)
    const [rC, gC, bC] = hexToRgb(BRAND_COLORS.emerald)
    gl.uniform3f(uColorALocation, rA, gA, bA)
    gl.uniform3f(uColorBLocation, rB, gB, bB)
    gl.uniform3f(uColorCLocation, rC, gC, bC)

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
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(iResolutionLocation, canvas.width, canvas.height)
    }
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
      window.removeEventListener("resize", resizeCanvas)
      window.removeEventListener("mousemove", handleMouseMove)
      if (!gl.isContextLost()) {
        gl.deleteProgram(program)
        gl.deleteShader(vertexShader)
        gl.deleteShader(fragmentShader)
        gl.deleteBuffer(vertexBuffer)
      }
    }
  }, [reducedMotion, flowSpeed, colorIntensity, noiseLayers, mouseInfluence])

  if (reducedMotion) {
    return (
      <div
        className={`absolute inset-0 -z-10 bg-surface-dark ${className}`}
        aria-hidden
      />
    )
  }

  return (
    <div className={`absolute inset-0 -z-10 bg-surface-dark ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20" />
    </div>
  )
}
