(function(){
'use strict';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parse=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,(m||1)-1,d||1,12)};
const daysIn=(y,m)=>new Date(y,m+1,0).getDate();
const anchor=(y,m,day)=>new Date(y,m,Math.min(Math.max(1,Number(day)||28),daysIn(y,m)),12);
const addMonths=(d,n,day)=>anchor(d.getFullYear(),d.getMonth()+n,day);
const fmtDate=d=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric'}).format(d);
const monthYear=d=>new Intl.DateTimeFormat('id-ID',{month:'long',year:'numeric'}).format(d);
let ctx=null,offset=0,day=28;
function settingsKey(){return 'VL_VEHICLE_PERIOD_V1_'+String(ctx?.user?.id||'guest')}
function loadSettings(){try{const x=JSON.parse(localStorage.getItem(settingsKey())||'{}');day=Math.min(31,Math.max(1,Number(x.start_day)||28))}catch{day=28}}
function saveSettings(){localStorage.setItem(settingsKey(),JSON.stringify({start_day:day,updated_at:new Date().toISOString()}))}
function baseStart(){
 const now=new Date(),today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 let a=anchor(today.getFullYear(),today.getMonth(),day);
 if(a>today)a=anchor(today.getFullYear(),today.getMonth()-1,day);
 return a;
}
function period(){
 const b=baseStart(),start=addMonths(b,offset,day),next=addMonths(start,1,day),end=new Date(next);
 end.setDate(end.getDate()-1);
 return {start,end,next};
}
function records(p){
 return (ctx?.events||[]).filter(e=>{const d=String(e.event_date||'').slice(0,10);return d>=iso(p.start)&&d<=iso(p.end)}).sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date))||String(b.created_at||'').localeCompare(String(a.created_at||'')));
}
function open(){
 ctx=window.VehicleLifebookPeriodContext?.();
 if(!ctx?.user){ctx?.toast?.('Login dulu untuk membuka periode kendaraan.');return}
 if(!ctx.selected){ctx.toast('Pilih kendaraan dulu.');return}
 offset=0;loadSettings();render();
}
function render(){
 ctx=window.VehicleLifebookPeriodContext?.()||ctx;
 const old=document.getElementById('vehiclePeriodModal');if(old)old.remove();
 const m=document.createElement('div');m.id='vehiclePeriodModal';m.className='modal';
 m.innerHTML='<div class="sheet" style="max-width:780px"><div id="vehiclePeriodContent"></div></div>';
 document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)m.remove()});
 draw();
}
function draw(){
 const root=document.getElementById('vehiclePeriodContent');if(!root)return;
 const p=period(),rows=records(p),v=(ctx.vehicles||[]).find(x=>x.id===ctx.selected),total=rows.reduce((s,e)=>s+Number(e.total_cost||0),0);
 root.innerHTML='<div class="row between" style="gap:10px"><div><div class="small muted">VEHICLE LIFEBOOK · RIWAYAT BERKALA</div><h2 style="margin:3px 0">📅 Periode Kendaraan</h2><div class="small muted">'+esc([v?.plate_number,v?.brand,v?.model].filter(Boolean).join(' · ')||'Kendaraan terpilih')+'</div></div><button class="btn gray" id="vpClose">✕ Tutup</button></div>'+
 '<div class="card" style="margin-top:12px;background:linear-gradient(135deg,#0f172a,#1e40af);color:#fff;border:0"><div class="small" style="color:#bfdbfe">PERIODE AKTIF</div><div style="font-size:clamp(23px,5vw,31px);font-weight:700;margin:4px 0">'+esc(monthYear(p.end))+'</div><div class="small" style="color:#dbeafe">'+esc(fmtDate(p.start))+' — '+esc(fmtDate(p.end))+'</div><div class="row between wraprow" style="margin-top:13px"><button class="btn" id="vpPrev" style="background:#fff;color:#0f172a">← Periode lalu</button><button class="btn" id="vpNext" style="background:#fff;color:#0f172a" '+(offset>=0?'disabled':'')+'>Periode berikut →</button></div></div>'+
 '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px"><div class="card"><div class="small muted">Aktivitas periode ini</div><div style="font-size:22px;font-weight:700">'+rows.length+'</div></div><div class="card"><div class="small muted">Total biaya periode ini</div><div style="font-size:18px;font-weight:700;color:#b91c1c">'+money(total)+'</div></div></div>'+
 '<div class="card" style="margin-top:10px;box-shadow:none;background:#f8fafc"><div class="row between"><div><strong>⚙️ Pengaturan periode</strong><div class="small muted">Tanggal mulai otomatis setiap bulan</div></div><button class="btn ghost" id="vpSettings">Ubah tanggal</button></div><div class="small muted" style="margin-top:6px">Saat tanggal mulai tiba, periode baru terbentuk otomatis. Riwayat lama tidak dihapus.</div></div>'+
 '<div style="margin-top:14px"><div class="row between"><h3 style="margin:0">Riwayat '+esc(monthYear(p.end))+'</h3><span class="badge">'+rows.length+' aktivitas</span></div><div class="small muted" style="margin:5px 0 10px">Catatan di luar rentang tanggal tetap tersimpan dan muncul pada periode yang sesuai.</div><div id="vpTimeline">'+(typeof ctx.timelineHtml==='function'?ctx.timelineHtml(rows):'<div class="empty">Tidak ada data.</div>')+'</div></div>';
 root.querySelector('#vpClose').onclick=()=>document.getElementById('vehiclePeriodModal')?.remove();
 root.querySelector('#vpPrev').onclick=()=>{offset--;draw()};
 root.querySelector('#vpNext').onclick=()=>{if(offset<0){offset++;draw()}};
 root.querySelector('#vpSettings').onclick=()=>settingsDialog();
 root.querySelectorAll('[data-event-media]').forEach(b=>b.onclick=()=>ctx.openEventMediaModal?.(b.dataset.eventMedia));
 root.querySelectorAll('[data-edit-event]').forEach(b=>b.onclick=()=>ctx.openEditEventModal?.(b.dataset.editEvent));
 root.querySelectorAll('[data-delete-event]').forEach(b=>b.onclick=async()=>{await ctx.deleteEvent?.(b.dataset.deleteEvent);setTimeout(()=>{ctx=window.VehicleLifebookPeriodContext?.()||ctx;draw()},500)});
}
function settingsDialog(){
 const modal=document.createElement('div');modal.className='modal';modal.style.zIndex='95';
 modal.innerHTML='<div class="sheet" style="max-width:440px"><div class="row between"><h3 style="margin:0">⚙️ Pengaturan Periode</h3><button class="btn gray" id="vpsClose">✕</button></div><p class="small muted">Pilih tanggal mulai periode setiap bulan. Contoh tanggal 28 akan membuat periode 28 Oktober–27 November, lalu 28 November–27 Desember.</p><div class="field"><label>Tanggal mulai setiap bulan</label><select id="vpsDay">'+Array.from({length:31},(_,i)=>i+1).map(n=>'<option value="'+n+'" '+(n===day?'selected':'')+'>Tanggal '+n+'</option>').join('')+'</select></div><button class="btn primary" id="vpsSave" style="width:100%">💾 Simpan pengaturan</button></div>';
 document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
 modal.querySelector('#vpsClose').onclick=()=>modal.remove();
 modal.querySelector('#vpsSave').onclick=()=>{day=Number(modal.querySelector('#vpsDay').value)||28;saveSettings();offset=0;modal.remove();draw();ctx?.toast?.('Tanggal periode tersimpan otomatis di perangkat ini.')};
}
window.VehicleLifebookPeriods={open};
})();