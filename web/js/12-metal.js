/* ---------- Flüssigmetall: WebGL-Chrom für das wichtigste Objekt einer Ansicht ----------
   Markup: <span class="lm" aria-hidden="true"></span> als erstes Kind eines Elements mit position:relative.
   metalMount(root) startet alle .lm darin. Läuft nur sichtbar, auf Touch-Geräten mit halber Auflösung
   und 30 Bildern/s, bei reduzierter Bewegung als Standbild. Ohne WebGL: CSS-Chrom (.nogl). */
const METAL=(()=>{
  const VS="attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS=`precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.);
  float w=fbm(p*1.5+vec2(t*.06,-t*.045));
  float w2=fbm(p*3.+vec2(-t*.035,t*.05)+w*1.3);
  float b=p.y*2.1+p.x*.85+w*1.9+w2*.8+m.x*.55-m.y*.35+t*.04;
  float s=.5+.5*sin(b*7.2);
  s=pow(s,1.45);
  vec3 c=mix(vec3(.13,.14,.19),vec3(.58,.61,.71),smoothstep(0.,.5,s));
  c=mix(c,vec3(.97,.98,1.),smoothstep(.5,.93,s));
  float sp=smoothstep(.975,1.,.5+.5*sin(b*14.6+1.3));
  c+=sp*.28;
  c+=vec3(.06,.025,.11)*(1.-s)*smoothstep(.25,.85,w2);
  c+=vec3(.02,.05,.09)*s*smoothstep(.3,.9,w);
  gl_FragColor=vec4(c,1.);}`;
  const items=new Set(),lite=document.documentElement.classList.contains("lite");
  const still=matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf=0,last=0,mx=0,my=0,tx=0,ty=0;
  const io="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(e=>{const it=e.target._lm;if(it){it.vis=e.isIntersecting;if(it.vis)kick()}}),{rootMargin:"80px"}):null;
  function setup(el){
    if(el._lm)return;
    const cv=document.createElement("canvas");
    const gl=cv.getContext("webgl",{antialias:false,alpha:false,premultipliedAlpha:false,powerPreference:"low-power"});
    if(!gl){el.classList.add("nogl");return}
    const sh=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);return s};
    const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){el.classList.add("nogl");return}
    gl.useProgram(pr);
    const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(pr,"p");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    el.appendChild(cv);
    const it={el,cv,gl,ur:gl.getUniformLocation(pr,"r"),ut:gl.getUniformLocation(pr,"t"),um:gl.getUniformLocation(pr,"m"),vis:!io,w:0,h:0,seed:Math.random()*40};
    el._lm=it;items.add(it);io&&io.observe(el);
    cv.addEventListener("webglcontextlost",e=>{e.preventDefault();items.delete(it);el.classList.add("nogl");cv.remove()});
    size(it);draw(it,performance.now());
  }
  function size(it){
    const r=it.el.getBoundingClientRect(),q=Math.min(devicePixelRatio||1,2)*(lite?.5:.75);
    const w=Math.max(2,Math.round(r.width*q)),h=Math.max(2,Math.round(r.height*q));
    if(w!==it.w||h!==it.h){it.w=it.cv.width=w;it.h=it.cv.height=h;it.gl.viewport(0,0,w,h)}
  }
  function draw(it,now){
    const g=it.gl;g.uniform2f(it.ur,it.w,it.h);g.uniform1f(it.ut,still?it.seed:now/1000+it.seed);g.uniform2f(it.um,mx,my);g.drawArrays(g.TRIANGLE_STRIP,0,4);
  }
  function frame(now){
    raf=0;
    let any=false;
    items.forEach(it=>{if(!it.el.isConnected){items.delete(it);io&&io.unobserve(it.el);return}if(it.vis&&!document.hidden)any=true});
    if(!any||still)return;
    raf=requestAnimationFrame(frame);
    if(lite&&now-last<32)return;
    last=now;mx+=(tx-mx)*.06;my+=(ty-my)*.06;
    items.forEach(it=>{if(it.vis){size(it);draw(it,now)}});
  }
  function kick(){if(!raf&&!still)raf=requestAnimationFrame(frame)}
  addEventListener("pointermove",e=>{tx=e.clientX/innerWidth-.5;ty=e.clientY/innerHeight-.5},{passive:true});
  document.addEventListener("visibilitychange",kick);
  addEventListener("resize",()=>items.forEach(it=>{size(it);draw(it,performance.now())}),{passive:true});
  return {mount(root){$$(".lm",root||document).forEach(setup);kick()}};
})();
const metalMount=root=>METAL.mount(root);
