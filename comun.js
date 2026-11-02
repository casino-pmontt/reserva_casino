/* ===== CONFIGURACIÓN (solo se toca aquí) ===== */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyXVpCYD7nJHTySUPfN0az-JDOWFoJQxARbTzBxmW-gPFIwF2z-Yqy7juc1hC_02PdL6A/exec', // URL de la app web de Apps Script (termina en /exec). Vacía = modo demostración
  HORA_CORTE: '10:00',      // solo valor inicial: la hora real la define Administración desde su página
  TZ: 'America/Santiago'
};
/* ============================================= */

const DEMO = !CONFIG.API_URL;
const $ = id => document.getElementById(id);

const store = {
  get(k){ try{ return localStorage.getItem(k) }catch(e){ return null } },
  set(k,v){ try{ localStorage.setItem(k,v) }catch(e){} },
  del(k){ try{ localStorage.removeItem(k) }catch(e){} }
};

function ahoraStgo(){
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:CONFIG.TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'})
    .formatToParts(new Date()).map(x=>[x.type,x.value]));
  return { fecha:`${p.year}-${p.month}-${p.day}`, hora:`${p.hour}:${p.minute}`, min:+p.hour*60 + +p.minute, finde:['Sat','Sun'].includes(p.weekday) };
}
/* Hora de corte vigente: llega desde la planilla en cada respuesta y se recuerda en el dispositivo */
let corteActual = /^\d{2}:\d{2}$/.test(store.get('casino_corte')||'') ? store.get('casino_corte') : CONFIG.HORA_CORTE;
function fijarCorte(h){ if(/^\d{2}:\d{2}$/.test(h||'')){ corteActual=h; store.set('casino_corte',h) } }
function minCorte(){ const [h,m]=corteActual.split(':'); return +h*60 + +m }

/* "2026-10-28" → "miércoles 28 de octubre de 2026" */
function fechaLarga(f, conAnio=true){
  const [y,m,d]=f.split('-').map(Number);
  const o={weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}; if(conAnio) o.year='numeric';
  return new Intl.DateTimeFormat('es-CL',o).format(new Date(Date.UTC(y,m-1,d)));
}
const porNombre = (a,b)=>a.nombre.localeCompare(b.nombre,'es');
const normCodigo = c => String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');

/* ---------- Conexión con la planilla ----------
   Todo va por POST con texto plano: no aparece en la URL ni en el historial.
   Un error de código inválido llega con err.codigo = true.                     */
async function api(accion, params={}){            // app del personal (lleva el código)
  if(DEMO) return demo(accion, params);
  return enviar({accion, ...params});
}
async function apiAdmin(accion, params={}){       // Administración (lleva la clave)
  if(DEMO) return demoAdmin(accion, params);
  return enviar({accion, ...params});
}
async function enviar(cuerpo){
  let r;
  try{ r=await fetch(CONFIG.API_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(cuerpo)}) }
  catch(e){ throw new Error('No hay conexión. Revisa internet e intenta de nuevo.') }
  if(!r.ok) throw new Error('La planilla no respondió. Intenta de nuevo en un momento.');
  const j=await r.json();
  if(j.error) throw errorDe(j.error);
  return j;
}
function errorDe(m){
  const e=new Error(String(m).replace(/^CODIGO:\s*/,''));
  e.codigo=/^CODIGO:/.test(m); return e;
}

/* ---------- Modo demostración: imita la planilla en este navegador ---------- */
const DEMO_CLAVE='1234';
const DEMO_PERSONAS=[
  {nombre:'Ejemplo: Ana Soto',cc:'LAB-210',codigo:'K7P2QX',correo:'ana.soto@ejemplo.cl'},{nombre:'Ejemplo: Luis Vera',cc:'MAN-330',codigo:'H4NB8R',correo:'luis.vera@ejemplo.cl'},
  {nombre:'Ejemplo: Marta Díaz',cc:'ADM-100',codigo:'WD3JMA',correo:''},{nombre:'Ejemplo: Pedro Ruiz',cc:'PRO-420',codigo:'T9CQ5E'}];
function demoTodas(){ try{ return JSON.parse(store.get('casino_demo3')||'[]') }catch(e){ return [] } }
function demoGuardar(fecha,nombre,fila){
  const t=demoTodas().filter(x=>!(x.fecha===fecha && x.nombre.toLowerCase()===nombre.toLowerCase()));
  if(fila) t.push(fila); store.set('casino_demo3',JSON.stringify(t));
}
function demoDelDia(f){ return demoTodas().filter(x=>x.fecha===f) }
function demoCorte(){ return store.get('casino_demo_corte')||CONFIG.HORA_CORTE }
function demo(accion,p){
  const yo=DEMO_PERSONAS.find(x=>x.codigo===normCodigo(p.codigo));
  if(!yo) throw errorDe('CODIGO: Código no encontrado. Revísalo en tu mensaje o pídeselo a Administración.');
  const t=ahoraStgo(), mio=x=>x.nombre===yo.nombre;
  if(accion==='entrar') return {nombre:yo.nombre,corte:demoCorte()};
  if(accion==='estado') return {nombre:yo.nombre,corte:demoCorte(),inscripcion:demoDelDia(t.fecha).find(mio)||null};
  if(accion==='anotar'){ const r={fecha:t.fecha,nombre:yo.nombre,tipo:p.tipo,hora:t.hora,tarde:t.hora>demoCorte(),origen:'App',cc:''}; demoGuardar(t.fecha,yo.nombre,r); return {ok:true,nombre:yo.nombre,corte:demoCorte(),inscripcion:r} }
  if(accion==='cancelar'){ demoGuardar(t.fecha,yo.nombre,null); return {ok:true} }
  throw new Error('Acción desconocida');
}
function demoAdmin(accion,p){
  if(p.clave!==DEMO_CLAVE) throw new Error('Clave incorrecta');
  const f=p.fecha||ahoraStgo().fecha;
  if(accion==='verificar') return {ok:true};
  if(accion==='lista'){ const cc=Object.fromEntries(DEMO_PERSONAS.map(x=>[x.nombre.toLowerCase(),x.cc]));
    return {fecha:f,corte:demoCorte(),personas:DEMO_PERSONAS,filas:demoDelDia(f).map(x=>({...x,cc:x.cc||cc[x.nombre.toLowerCase()]||''}))} }
  if(accion==='agregar'){ demoGuardar(f,p.nombre,{fecha:f,nombre:p.nombre,tipo:p.tipo,hora:ahoraStgo().hora,tarde:false,origen:'Administración',cc:p.cc||''}); return {ok:true} }
  if(accion==='quitar'){ demoGuardar(f,p.nombre,null); return {ok:true} }
  if(accion==='corte'){ const m=String(p.hora||'').match(/^(\d{1,2})[:.](\d{2})$/);
    if(!m||+m[1]>23||+m[2]>59) throw new Error('Hora no válida. Usa el formato 10:00');
    const v=('0'+ +m[1]).slice(-2)+':'+m[2]; store.set('casino_demo_corte',v); return {ok:true,corte:v} }
  throw new Error('Acción desconocida');
}

/* ---------- Modo claro / oscuro ----------
   Sin elegir, sigue al teléfono. Al tocar el botón, se recuerda la elección. */
function temaOscuroAhora(){
  const t=document.documentElement.getAttribute('data-theme');
  if(t) return t==='dark';
  try{ return matchMedia('(prefers-color-scheme: dark)').matches }catch(e){ return false }
}
if($('btnTema')) $('btnTema').onclick=()=>{
  const nuevo=temaOscuroAhora()?'light':'dark';
  document.documentElement.setAttribute('data-theme',nuevo);
  store.set('casino_tema',nuevo);
};
