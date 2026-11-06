/* ---------- Flüssigmetall-Ring (WebGL): Herzstück der Startseite ----------
   Markup: <div class="lq" data-off aria-hidden="true"></div> in einem Element mit position:relative.
   LIQUID.mount(root) startet alle .lq darin. Ein Ring aus flüssigem Chrom, dessen Oberfläche langsam
   fließt; der Zeiger verschiebt die Lichtquelle. Läuft nur sichtbar, auf Touch-Geräten mit halber
   Auflösung und 30 Bildern/s, bei reduzierter Bewegung als Standbild. Ohne WebGL: CSS-Ring (.nogl). */
const LIQUID=(()=>{
  const VS="attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  const FS=`precision highp float;uniform vec2 r;uniform float t;uniform vec2 m;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
float sh(vec2 p){float a=atan(p.y,p.x),d=length(p);
  float w=.011*sin(a*3.+t*.32)+.006*sin(a*5.-t*.41)+.018*(fbm(p*2.1+vec2(t*.07,-t*.05))-.5);
  float R=.31+w,th=.108+.01*sin(a*2.+t*.27)+.008*(fbm(p*3.+t*.12)-.5);
  return abs(d-R)-th;}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*r)/min(r.x,r.y);
  uv=mat2(.96,-.28,.28,.96)*uv*vec2(1.,1.18);
  float s=sh(uv);float al=smoothstep(.006,-.005,s);
  if(al<=0.){gl_FragColor=vec4(0.);return;}
  vec2 e=vec2(.0025,0.);vec2 g=vec2(sh(uv+e.xy)-sh(uv-e.xy),sh(uv+e.yx)-sh(uv-e.yx))/(2.*e.x);
  float dp=clamp(-s/.13,0.,1.);float z=sqrt(max(1.-(1.-dp)*(1.-dp),0.));
  vec3 N=normalize(vec3(g*(1.-z)*1.35,z+.08));
  N.xy+=.1*vec2(fbm(uv*3.2+vec2(t*.1,0.))-.5,fbm(uv*3.2-vec2(0.,t*.09)+3.1)-.5);N=normalize(N);
  vec3 R=reflect(vec3(0.,0.,-1.),N);
  float y=R.y+.18*m.y;
  /* Umgebung: Himmel hell, Horizont scharf, Boden dunkel – klassischer Chrom-Look */
  vec3 sky=mix(vec3(.62,.65,.71),vec3(.99,.99,1.),smoothstep(.0,.7,y));
  vec3 gr=mix(vec3(.07,.08,.1),vec3(.42,.44,.5),smoothstep(-.95,-.05,y));
  vec3 env=y>0.?sky:gr;
  env=mix(env,vec3(.06,.06,.07),smoothstep(.035,0.,abs(y-.01))*.85);
  /* zwei Softboxen als Glanzlichter, eine folgt dem Zeiger */
  env+=1.1*smoothstep(.9,.985,dot(R,normalize(vec3(.45+m.x*.5,.55,.7))));
  env+=.55*smoothstep(.93,.99,dot(R,normalize(vec3(-.6,.25,.75))));
  /* Perlmutt am Rand */
  float fr=pow(1.-max(N.z,0.),2.2);
  vec3 pr=.5+.5*cos(6.2831*(vec3(0.,.33,.67)+fr*1.1+t*.04+uv.x*.6));
  env=mix(env,env*(.65+.55*pr),.35*fr+.06);
  env*=.92+.08*z;
  /* Rand etwas dunkler, damit sich das Chrom vom hellen Grund abhebt */
  env*=mix(1.,.72,smoothstep(.35,1.,fr));
  gl_FragColor=vec4(env*al,al);
}`;
  const lite=()=>document.documentElement.classList.contains("lite");
  const items=new Set();let mx=0,my=0,tmx=0,tmy=0,raf=0,last=0;
  addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;tmx=e.clientX/innerWidth*2-1;tmy=e.clientY/innerHeight*2-1},{passive:true});
  const io="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(en=>{const it=en.target._lq;if(it){it.vis=en.isIntersecting;if(it.vis)kick()}}),{rootMargin:"80px"}):null;
  function make(el){
    const c=document.createElement("canvas");el.appendChild(c);
    const gl=c.getContext("webgl",{premultipliedAlpha:true,alpha:true,antialias:false,powerPreference:"low-power"});
    if(!gl){el.classList.add("nogl");c.remove();return null}
    const sh=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);return s};
    const pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS)){el.classList.add("nogl");c.remove();return null}
    gl.useProgram(pr);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
    const loc=gl.getAttribLocation(pr,"p");gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    const it={el,c,gl,u:{r:gl.getUniformLocation(pr,"r"),t:gl.getUniformLocation(pr,"t"),m:gl.getUniformLocation(pr,"m")},vis:true,w:0,h:0,t0:performance.now()-Math.random()*20000};
    el._lq=it;io&&io.observe(el);return it;
  }
  function size(it){const d=Math.min(devicePixelRatio||1,2)*(lite()?.7:.85),w=Math.round(it.el.clientWidth*d),h=Math.round(it.el.clientHeight*d);
    if(w&&h&&(w!==it.w||h!==it.h)){it.w=it.c.width=w;it.h=it.c.height=h;it.gl.viewport(0,0,w,h)}}
  function draw(it,now){const gl=it.gl;size(it);if(!it.w)return;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(it.u.r,it.w,it.h);gl.uniform1f(it.u.t,(now-it.t0)/1000);gl.uniform2f(it.u.m,mx,-my);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
  function frame(now){raf=0;let any=false;
    if(lite()&&now-last<32){raf=requestAnimationFrame(frame);return}last=now;
    mx+=(tmx-mx)*.06;my+=(tmy-my)*.06;
    items.forEach(it=>{if(!it.el.isConnected){items.delete(it);return}if(!it.vis||document.hidden)return;any=true;draw(it,now)});
    if(any&&!reduce)raf=requestAnimationFrame(frame)}
  function kick(){if(!raf)raf=requestAnimationFrame(frame)}
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)kick()});
  return {mount(root){$$(".lq",root).forEach(el=>{if(el._lq||el.classList.contains("nogl"))return;const it=make(el);if(it){items.add(it);if(reduce)requestAnimationFrame(n=>draw(it,n))}});kick()}};
})();
