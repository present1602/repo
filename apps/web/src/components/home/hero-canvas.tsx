'use client'

import { useEffect, useRef } from 'react'

/* 홈 뒤에 깔리는 움직이는 배경 — 검은 유광 튜브가 천천히 흐르고, 그 위로
   인디고 조명이 미끄러진다. 영상 파일 없이 프래그먼트 셰이더 한 장으로 그린다.

   화면에 고정(fixed)해 두고, 투명한 섹션([data-shader-window] — 히어로·진행 순서·
   맨 아래 의뢰 띠)이 보일 때만 그린다. 불투명한 섹션에 가려 있는 동안은 멈춘다.

   WebGL 을 못 쓰는 환경에서는 캔버스 뒤의 CSS 그라데이션이 그대로 보인다.
   "동작 줄이기"에서는 한 장만 그리고 멈춘다. */

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`

const FRAG = `
precision highp float;
uniform vec2 uR;
uniform float uT;
uniform vec2 uM;
uniform float uS;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
  float a=.5,s=0.;
  for(int i=0;i<3;i++){s+=a*noise(p);p=p*2.02+vec2(3.1,1.7);a*=.5;}
  return s;
}
/* 높이 — 휘어진 등고선을 띠로 나누고, 띠마다 둥근 단면(반원)을 세워 튜브처럼 만든다 */
float H(vec2 p){
  vec2 q=p+1.5*vec2(fbm(p*.55+vec2(0.,uT*.05)),fbm(p*.55+vec2(5.2,-uT*.04)));
  float f=fbm(q*.6+uT*.015);
  float x=fract(f*4.5)*2.-1.;
  return sqrt(max(0.,1.-x*x));
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uR)/uR.y*1.5+vec2(0.,-uS*.5);
  float e=.006;
  float h=H(p);
  vec3 n=normalize(vec3(-(H(p+vec2(e,0.))-h),-(H(p+vec2(0.,e))-h),e*2.2));

  vec3 v=vec3(0.,0.,1.);
  vec3 l1=normalize(vec3(.35+uM.x*.6,.55+uM.y*.6,.75));
  vec3 l2=normalize(vec3(-.7-uM.x*.3,-.25,.55));
  float s1=pow(max(dot(reflect(-l1,n),v),0.),28.);
  float s2=pow(max(dot(reflect(-l2,n),v),0.),5.);
  float rim=pow(1.-n.z,2.2);

  vec3 indigo=vec3(.27,.2,1.);
  vec3 col=vec3(.006,.004,.02);
  col+=indigo*(s2*.75+rim*.22);
  col+=vec3(.78,.76,1.)*s1*.9;
  col*=smoothstep(0.,.3,h);

  vec2 uv=gl_FragCoord.xy/uR;
  col*=1.-.55*length(uv-.5);
  col+=(hash(gl_FragCoord.xy+uT)-.5)/200.;
  gl_FragColor=vec4(col,1.);
}`

export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) return

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      return sh
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    /* 셰이더가 안 올라가면 조용히 CSS 배경으로 남는다 — 장식이라 알릴 일이 아니다 */
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
    gl.useProgram(prog)

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const uR = gl.getUniformLocation(prog, 'uR')
    const uT = gl.getUniformLocation(prog, 'uT')
    const uM = gl.getUniformLocation(prog, 'uM')
    const uS = gl.getUniformLocation(prog, 'uS')

    /* 흐릿한 무늬라 절반 남짓 해상도로 그려도 티가 나지 않는다 — 픽셀 수가 곧 비용이다 */
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    const t0 = performance.now()
    let raf = 0
    let visible = true

    const draw = () => {
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04
      gl.uniform2f(uR, canvas.width, canvas.height)
      gl.uniform1f(uT, reduce ? 12 : (performance.now() - t0) / 1000 + 12)
      gl.uniform2f(uM, mouse.x, mouse.y)
      gl.uniform1f(uS, window.scrollY / Math.max(1, window.innerHeight))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const frame = () => {
      raf = 0
      draw()
      if (visible && !reduce) raf = requestAnimationFrame(frame)
    }
    const kick = () => {
      if (!raf && visible) raf = requestAnimationFrame(frame)
    }

    const seen = new Set<Element>()
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.isIntersecting) seen.add(en.target)
        else seen.delete(en.target)
      }
      visible = seen.size > 0
      kick()
    })
    document.querySelectorAll('[data-shader-window]').forEach((el) => io.observe(el))

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / window.innerWidth - 0.5
      mouse.ty = 0.5 - e.clientY / window.innerHeight
    }
    const onResize = () => {
      resize()
      kick()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', onResize)
    /* 동작 줄이기 — 흐르지는 않아도 스크롤에 맞춰 한 장씩은 다시 그린다 */
    if (reduce) window.addEventListener('scroll', kick, { passive: true })
    kick()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', kick)
    }
  }, [])

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_70%_30%,#2a1fb8_0%,transparent_55%),radial-gradient(ellipse_at_20%_80%,#3a2be0_0%,transparent_50%)] bg-black"
    >
      <canvas ref={ref} className="size-full" />
    </div>
  )
}
