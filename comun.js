/* ===== CONFIGURACIÓN (solo se toca aquí) ===== */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyXVpCYD7nJHTySUPfN0az-JDOWFoJQxARbTzBxmW-gPFIwF2z-Yqy7juc1hC_02PdL6A/exec', // URL de la app web de Apps Script (termina en /exec). Vacía = modo demostración
  HORA_CORTE: '10:00',      // debe coincidir con Code.gs
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
const MIN_CORTE = (()=>{ const [h,m]=CONFIG.HORA_CORTE.split(':'); return +h*60 + +m })();

/* "2026-10-28" → "miércoles 28 de octubre de 2026" */
function fechaLarga(f, conAnio=true){
  const [y,m,d]=f.split('-').map(Number);
  const o={weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}; if(conAnio) o.year='numeric';
  return new Intl.DateTimeFormat('es-CL',o).format(new Date(Date.UTC(y,m-1,d)));
}
const porNombre = (a,b)=>a.nombre.localeCompare(b.nombre,'es');

/* ---------- Conexión con la planilla ---------- */
async function api(accion, params={}){            // app de usuarios
  if(DEMO) return demo(accion, params);
  const u=new URL(CONFIG.API_URL); u.searchParams.set('accion',accion);
  for(const [k,v] of Object.entries(params)) u.searchParams.set(k,v);
  return leer(await fetch(u,{redirect:'follow'}));
}
async function apiAdmin(accion, params={}){       // administración: la clave va en el cuerpo, no en la URL
  if(DEMO) return demoAdmin(accion, params);
  const r=await fetch(CONFIG.API_URL,{method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({accion,...params})});
  return leer(r);
}
async function leer(r){
  if(!r.ok) throw new Error('No hay conexión con la planilla. Revisa internet e intenta de nuevo.');
  const j=await r.json(); if(j.error) throw new Error(j.error); return j;
}

/* ---------- Modo demostración: imita la planilla en este navegador ---------- */
const DEMO_CLAVE='1234';
const DEMO_PERSONAS=[
  {nombre:'Ejemplo: Ana Soto',cc:'LAB-210'},{nombre:'Ejemplo: Luis Vera',cc:'MAN-330'},
  {nombre:'Ejemplo: Marta Díaz',cc:'ADM-100'},{nombre:'Ejemplo: Pedro Ruiz',cc:'PRO-420'}];
function demoTodas(){ try{ return JSON.parse(store.get('casino_demo2')||'[]') }catch(e){ return [] } }
function demoGuardar(fecha,nombre,fila){
  const t=demoTodas().filter(x=>!(x.fecha===fecha && x.nombre.toLowerCase()===nombre.toLowerCase()));
  if(fila) t.push(fila); store.set('casino_demo2',JSON.stringify(t));
}
function demoDelDia(f){ return demoTodas().filter(x=>x.fecha===f) }
function demo(accion,p){
  const t=ahoraStgo(), mio=x=>x.nombre.toLowerCase()===String(p.nombre||'').toLowerCase();
  if(accion==='personas') return {personas:DEMO_PERSONAS.map(x=>x.nombre)};
  if(accion==='estado') return {inscripcion:demoDelDia(t.fecha).find(mio)||null};
  if(accion==='anotar'){ const r={fecha:t.fecha,nombre:p.nombre,tipo:p.tipo,hora:t.hora,tarde:t.min>MIN_CORTE,origen:'App',cc:''}; demoGuardar(t.fecha,p.nombre,r); return {ok:true,inscripcion:r} }
  if(accion==='cancelar'){ demoGuardar(t.fecha,p.nombre,null); return {ok:true} }
  throw new Error('Acción desconocida');
}
function demoAdmin(accion,p){
  if(p.clave!==DEMO_CLAVE) throw new Error('Clave incorrecta');
  const f=p.fecha||ahoraStgo().fecha;
  if(accion==='verificar') return {ok:true};
  if(accion==='lista'){ const cc=Object.fromEntries(DEMO_PERSONAS.map(x=>[x.nombre.toLowerCase(),x.cc]));
    return {fecha:f,personas:DEMO_PERSONAS,filas:demoDelDia(f).map(x=>({...x,cc:x.cc||cc[x.nombre.toLowerCase()]||''}))} }
  if(accion==='agregar'){ demoGuardar(f,p.nombre,{fecha:f,nombre:p.nombre,tipo:p.tipo,hora:ahoraStgo().hora,tarde:false,origen:'Secretaria',cc:p.cc||''}); return {ok:true} }
  if(accion==='quitar'){ demoGuardar(f,p.nombre,null); return {ok:true} }
  throw new Error('Acción desconocida');
}
