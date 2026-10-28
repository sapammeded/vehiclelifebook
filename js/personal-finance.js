(function(){
'use strict';
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const iso=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const localToday=()=>iso(new Date());
const parseDate=s=>{const [y,m,d]=String(s).split('-').map(Number);return new Date(y,(m||1)-1,d||1,12)};
const daysIn=(y,m)=>new Date(y,m+1,0).getDate();
const payday=(y,m,day)=>new Date(y,m,Math.min(Number(day)||25,daysIn(y,m)),12);
const addMonths=(d,n,day)=>payday(d.getFullYear(),d.getMonth()+n,day);
const fmtDate=d=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric'}).format(d);
const periodLabel=(a,b)=>fmtDate(a)+' – '+fmtDate(b);
let ctx=null,profile=null,transactions=[],vehicleEvents=[],periodOffset=0,recognition=null;
function sharedPeriodDay(){try{const x=JSON.parse(localStorage.getItem('VL_SHARED_PERIOD_V1_'+String(ctx?.user?.id||'guest'))||'{}');if(x.start_day)return Math.min(31,Math.max(1,Number(x.start_day)||28));const old=JSON.parse(localStorage.getItem('VL_VEHICLE_PERIOD_V1_'+String(ctx?.user?.id||'guest'))||'{}');return Math.min(31,Math.max(1,Number(old.start_day)||28))}catch{return 28}}
const anchor=(y,m,day)=>new Date(y,m,Math.min(Math.max(1,Number(day)||28),daysIn(y,m)),12);
function toast(msg){if(ctx?.toast)ctx.toast(msg);else alert(msg)}
function currentPayday(){
 const now=parseDate(localToday()),day=Number(profile?.payday_day)||25;
 let p=payday(now.getFullYear(),now.getMonth(),day);
 if(p>now)p=payday(now.getFullYear(),now.getMonth()-1,day);
 const start=profile?.salary_start_date?parseDate(profile.salary_start_date):p;
 if(p<start)return start;
 return p;
}
function period(offset=0){
 const day=sharedPeriodDay(),now=parseDate(localToday());
 let current=anchor(now.getFullYear(),now.getMonth(),day);
 if(current>now)current=anchor(now.getFullYear(),now.getMonth()-1,day);
 const start=anchor(current.getFullYear(),current.getMonth()+offset,day);
 const next=anchor(start.getFullYear(),start.getMonth()+1,day);
 const end=new Date(next);end.setDate(end.getDate()-1);
 return {start,end,next};
}
function salaryDatesBefore(exclusive){
 if(!profile?.salary_start_date||Number(profile.monthly_salary)<=0)return [];
 const first=parseDate(profile.salary_start_date),limit=parseDate(exclusive),out=[];
 let d=new Date(first);
 for(let i=0;i<2400&&d<limit;i++){
  out.push(new Date(d));
  d=addMonths(first,i+1,profile.payday_day);
 }
 return out;
}
function txBefore(date){
 const cutoff=iso(date);
 return transactions.filter(t=>t.occurred_on<cutoff).reduce((s,t)=>s+(t.direction==='income'?1:-1)*Number(t.amount),0);
}
function carryBefore(date){
 const cutoff=iso(date);
 const salary=salaryDatesBefore(cutoff).length*Number(profile?.monthly_salary||0);
 const vehicleSpent=vehicleEvents.filter(e=>String(e.event_date||'').slice(0,10)<cutoff).reduce((sum,e)=>sum+Number(e.total_cost||0),0);
 return salary+txBefore(date)-vehicleSpent;
}
function cycleTransactions(p){
 return transactions.filter(t=>t.occurred_on>=iso(p.start)&&t.occurred_on<=iso(p.end)).sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)||String(b.created_at).localeCompare(String(a.created_at)));
}
function cycleStats(p){
 const rows=cycleTransactions(p);
 const exclusive=new Date(p.end);exclusive.setDate(exclusive.getDate()+1);
 const salary=salaryDatesBefore(iso(exclusive)).filter(d=>d>=p.start&&d<=p.end).length*Number(profile?.monthly_salary||0);
 const income=rows.filter(t=>t.direction==='income').reduce((s,t)=>s+Number(t.amount),0);
 const expense=rows.filter(t=>t.direction==='expense').reduce((s,t)=>s+Number(t.amount),0);
 const vehicleExpense=vehicleEvents.filter(e=>{const d=String(e.event_date||'').slice(0,10);return d>=iso(p.start)&&d<=iso(p.end)}).reduce((sum,e)=>sum+Number(e.total_cost||0),0);
 const carry=carryBefore(p.start),totalExpense=expense+vehicleExpense;
 return {rows,salary,income,expense,vehicleExpense,totalExpense,carry,balance:carry+salary+income-totalExpense};
}
function amountFromToken(token){
 let s=String(token).toLowerCase().replace(/rp\.?/g,'').trim();
 const suffix=(s.match(/(miliar|m|juta|jt|ribu|rb)\s*$/)||[])[1]||'';
 s=s.replace(/(miliar|juta|ribu|jt|rb|m)\s*$/,'').trim().replace(/\s/g,'');
 let n;
 if(s.includes('.')&&s.includes(',')){n=Number(s.replace(/\./g,'').replace(',','.'))}
 else if((s.match(/\./g)||[]).length>1){n=Number(s.replace(/\./g,''))}
 else if(s.includes(',')&&/,\d{3}$/.test(s)){n=Number(s.replace(/,/g,''))}
 else if(s.includes('.')&&/\.\d{3}$/.test(s)){n=Number(s.replace(/\./g,''))}
 else {n=Number(s.replace(',','.'))}
 if(!Number.isFinite(n))return 0;
 if(['miliar','m'].includes(suffix))n*=1e9;
 else if(['juta','jt'].includes(suffix))n*=1e6;
 else if(['ribu','rb'].includes(suffix))n*=1e3;
 return Math.round(n);
}
function detectCategory(note){
 const s=note.toLowerCase();
 if(/bensin|bbm|solar|pertamax|parkir|tol/.test(s))return 'Kendaraan';
 if(/makan|minum|kopi|jajan|restoran|warung/.test(s))return 'Makanan';
 if(/istri|suami|anak|keluarga|orang tua|ortu/.test(s))return 'Keluarga';
 if(/listrik|air|internet|wifi|kontrakan|sewa|rumah/.test(s))return 'Rumah';
 if(/rokok|vape/.test(s))return 'Rokok';
 if(/obat|dokter|rumah sakit|klinik/.test(s))return 'Kesehatan';
 if(/cicilan|angsuran|utang|hutang|kredit/.test(s))return 'Cicilan & Utang';
 if(/servis|service|oli|ban|sparepart/.test(s))return 'Perawatan Kendaraan';
 if(/gaji|bonus|lembur|insentif|pemasukan/.test(s))return 'Pemasukan';
 return 'Lainnya';
}
function splitEntries(text){
 return String(text||'').split(/\n|;|,(?=\s*(?:[A-Za-zÀ-ÿ]|beli|bayar|kasih|buat|untuk|dan|isi|top ?up|transfer|makan|minum|bensin|parkir|gaji|bonus))/i).map(x=>x.trim().replace(/^[\s,.-]+|[\s.]+$/g,'')).filter(Boolean);
}
function parseEntries(text,direction){
 const chunks=splitEntries(text),out=[],bad=[];
 for(const chunk of chunks){
  const matches=[...chunk.matchAll(/(?:rp\.?\s*)?\d[\d.,]*(?:\s*(?:miliar|juta|ribu|jt|rb|m))?/ig)];
  let chosen=null;
  for(const m of matches){const val=amountFromToken(m[0]);if(val>0){chosen={raw:m[0],value:val,index:m.index};break}}
  if(!chosen){bad.push(chunk);continue}
  const note=(chunk.slice(0,chosen.index)+' '+chunk.slice(chosen.index+chosen.raw.length)).replace(/\s+/g,' ').replace(/[,:-]\s*$/,'').trim()||'Transaksi';
  out.push({direction,amount:chosen.value,note,category:detectCategory(note),source_text:chunk,occurred_on:localToday(),user_id:ctx.user.id});
 }
 return {out,bad};
}
async function loadData(){
 const sb=ctx.sb,user=ctx.user;
 const [p,t,vehicles]=await Promise.all([
  sb.from('finance_profiles').select('*').eq('user_id',user.id).maybeSingle(),
  sb.from('finance_transactions').select('*').eq('user_id',user.id).order('occurred_on',{ascending:false}).order('created_at',{ascending:false}).limit(5000),
  sb.from('vehicles').select('id').eq('user_id',user.id)
 ]);
 if(p.error)throw p.error;if(t.error)throw t.error;if(vehicles.error)throw vehicles.error;
 profile=p.data||{user_id:user.id,monthly_salary:0,payday_day:25,salary_start_date:localToday(),currency:'IDR'};
 transactions=t.data||[];
 const vehicleIds=(vehicles.data||[]).map(x=>x.id);
 if(vehicleIds.length){const ev=await sb.from('vehicle_timeline').select('vehicle_id,event_date,total_cost').in('vehicle_id',vehicleIds);if(ev.error)throw ev.error;vehicleEvents=ev.data||[]}else vehicleEvents=[];
}
function open(){
 ctx=window.VehicleLifebookFinanceContext?.();
 if(!ctx?.sb||!ctx?.user){toast('Login dulu untuk membuka keuangan.');return}
 periodOffset=0;
 const old=document.getElementById('financeModal');if(old)old.remove();
 const modal=document.createElement('div');modal.id='financeModal';modal.className='modal';
 modal.innerHTML='<div class="sheet" style="max-width:760px"><div id="financeContent"><div class="empty">Memuat data keuangan…</div></div></div>';
 document.body.appendChild(modal);
 modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});
 loadData().then(()=>render()).catch(e=>{const c=document.getElementById('financeContent');if(c)c.innerHTML='<div class="row between"><h3>Keuangan Pribadi</h3><button class="btn gray" id="finClose">Tutup</button></div><div class="card"><strong>Database keuangan belum siap.</strong><p class="small muted">Jalankan migration SQL di supabase/migrations/20261028120000_add_personal_finance_manager.sql pada Supabase SQL Editor, lalu coba lagi.</p><div class="small">'+esc(e.message||e)+'</div></div>';document.getElementById('finClose')?.addEventListener('click',()=>modal.remove())});
}
function render(){
 const root=document.getElementById('financeContent');if(!root)return;
 const p=period(periodOffset),s=cycleStats(p),salaryConfigured=Number(profile.monthly_salary)>0;
 const categories={};s.rows.filter(t=>t.direction==='expense').forEach(t=>categories[t.category]=(categories[t.category]||0)+Number(t.amount));
 const topCats=Object.entries(categories).sort((a,b)=>b[1]-a[1]).slice(0,4);
 root.innerHTML='<div class="row between" style="gap:12px"><div><div class="small muted">VEHICLE LIFEBOOK · PERSONAL FINANCE</div><h2 style="margin:3px 0">💰 Keuangan Pribadi</h2><div class="small muted">Catat uang keluar/masuk lewat teks atau suara.</div></div><button class="btn gray" id="finClose">✕ Tutup</button></div>'+
 '<div class="row wraprow" style="margin:14px 0"><button class="btn primary" id="finDashboard">Ringkasan</button><button class="btn ghost" id="finSettings">⚙️ Gaji & Gajian</button><button class="btn ghost" id="finAll">Semua transaksi</button></div>'+
 (!salaryConfigured?'<div class="card" style="background:#fffbeb;border-color:#fde68a;margin-bottom:12px"><strong>Atur gaji bulanan dulu</strong><div class="small muted">Masukkan nominal gaji dan tanggal gajian agar saldo dan siklus bulanan dapat dihitung.</div><button class="btn primary" id="finSetup" style="margin-top:9px">Atur sekarang</button></div>':'')+
 '<div class="card" style="background:linear-gradient(135deg,#0f172a,#1e40af);color:#fff;border:0"><div class="small" style="color:#bfdbfe">SISA UANG · TERMASUK SALDO TERBAWA</div><div style="font-size:clamp(25px,6vw,34px);font-weight:700;margin:5px 0">'+money(s.balance)+'</div><div class="small" style="color:#dbeafe">Periode '+esc(periodLabel(p.start,p.end))+' · mulai tanggal '+sharedPeriodDay()+'</div><div class="row between wraprow" style="margin-top:14px"><button class="btn" id="finPrev" style="background:#fff;color:#0f172a">← Periode lalu</button><button class="btn" id="finNext" style="background:#fff;color:#0f172a" '+(periodOffset>=0?'disabled':'')+'>Periode berikut →</button></div></div>'+
 '<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px"><div class="card"><div class="small muted">Gaji periode ini</div><div style="font-size:18px;font-weight:700;color:#047857">'+money(s.salary)+'</div></div><div class="card"><div class="small muted">Biaya hidup / transaksi</div><div style="font-size:18px;font-weight:700;color:#dc2626">'+money(s.expense)+'</div></div><div class="card"><div class="small muted">Pengeluaran kendaraan</div><div style="font-size:18px;font-weight:700;color:#dc2626">'+money(s.vehicleExpense)+'</div></div><div class="card"><div class="small muted">Total uang terpakai</div><div style="font-size:18px;font-weight:700;color:#b91c1c">'+money(s.totalExpense)+'</div></div><div class="card"><div class="small muted">Pemasukan tambahan</div><div style="font-size:18px;font-weight:700">'+money(s.income)+'</div></div><div class="card"><div class="small muted">Saldo terbawa</div><div style="font-size:18px;font-weight:700">'+money(s.carry)+'</div></div></div>'+
 '<div class="small muted" style="margin:8px 2px">Catat biaya kendaraan di modul kendaraan saja. Jangan masukkan biaya yang sama lagi sebagai pengeluaran pribadi agar total tidak terhitung dua kali.</div>'+
 '<div class="card" style="margin-top:12px"><div class="row between"><h3 style="margin:0">Catat transaksi</h3><span class="badge">Teks panjang</span></div><div class="field" style="margin-top:12px"><label>Jenis catatan</label><select id="finDirection"><option value="expense">💸 Pengeluaran</option><option value="income">💰 Pemasukan</option></select></div><div class="field"><label>Tulis bebas — satu transaksi per baris atau pisahkan dengan koma</label><textarea id="finText" rows="5" style="min-height:130px" placeholder="Contoh: Beli bensin 50 ribu, makan siang 25 ribu, kasih istri 500 ribu, beli rokok 30 ribu."></textarea><div class="small muted">Nominal seperti 50 ribu, 1,5 juta, atau Rp 125.000 bisa dibaca. Periksa catatan sebelum menyimpan.</div></div><div class="row wraprow"><button class="btn ghost" id="finVoice">🎙️ Bicara</button><button class="btn primary" id="finSave" style="flex:1">Simpan transaksi</button></div><div id="finVoiceStatus" class="small muted" style="margin-top:6px"></div></div>'+
 (topCats.length?'<div class="card" style="margin-top:12px"><h3 style="margin:0 0 8px">Pengeluaran terbesar</h3>'+topCats.map(([c,v])=>'<div class="row between" style="padding:6px 0"><span>'+esc(c)+'</span><strong>'+money(v)+'</strong></div>').join('')+'</div>':'')+
 '<div class="card" style="margin-top:12px"><div class="row between"><h3 style="margin:0">Transaksi periode ini</h3><span class="badge">'+s.rows.length+' catatan</span></div><div style="margin-top:8px">'+(s.rows.length?s.rows.slice(0,60).map(t=>txHtml(t)).join(''):'<div class="empty">Belum ada transaksi pada periode ini.</div>')+'</div></div>';
 root.querySelector('#finClose').onclick=()=>document.getElementById('financeModal')?.remove();
 root.querySelector('#finSettings').onclick=()=>renderSettings();
 root.querySelector('#finSetup')?.addEventListener('click',()=>renderSettings());
 root.querySelector('#finPrev').onclick=()=>{periodOffset--;render()};
 root.querySelector('#finNext').onclick=()=>{if(periodOffset<0){periodOffset++;render()}};
 root.querySelector('#finDashboard').onclick=()=>render();
 root.querySelector('#finAll').onclick=()=>renderAll();
 root.querySelector('#finSave').onclick=saveTextTransactions;
 root.querySelector('#finVoice').onclick=startVoice;
 root.querySelectorAll('[data-fin-delete]').forEach(b=>b.onclick=()=>deleteTransaction(b.dataset.finDelete));
}
function txHtml(t){
 const income=t.direction==='income';
 return '<div class="row" style="align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #e2e8f0"><div style="width:36px;height:36px;flex:0 0 36px;border-radius:12px;background:'+(income?'#d1fae5':'#fee2e2')+';display:grid;place-items:center">'+(income?'↙':'↗')+'</div><div style="flex:1;min-width:0"><div style="font-weight:600;overflow-wrap:anywhere">'+esc(t.note)+'</div><div class="small muted">'+esc(t.category||'Lainnya')+' · '+esc(fmtDate(parseDate(t.occurred_on)))+'</div></div><div style="text-align:right;white-space:nowrap"><strong style="color:'+(income?'#047857':'#dc2626')+'">'+(income?'+':'−')+money(t.amount)+'</strong><button class="btn gray" data-fin-delete="'+esc(t.id)+'" style="display:block;padding:4px 8px;margin:4px 0 0 auto;font-size:11px">Hapus</button></div></div>';
}
function renderSettings(){
 const root=document.getElementById('financeContent');if(!root)return;
 root.innerHTML='<div class="row between"><div><div class="small muted">PENGATURAN</div><h2 style="margin:3px 0">Gaji & tanggal gajian</h2></div><button class="btn gray" id="finBack">← Kembali</button></div><p class="small muted">Tanggal gajian dipakai untuk membagi catatan menjadi periode gaji. Saldo yang tersisa dibawa ke periode berikutnya.</p><div class="card"><div class="field"><label>Gaji bulanan (Rupiah)</label><input id="finSalary" inputmode="numeric" type="number" min="0" step="1000" value="'+esc(profile.monthly_salary||0)+'" placeholder="Contoh: 7000000"></div><div class="field"><label>Tanggal mulai periode bersama (kendaraan + keuangan)</label><select id="finPeriodDay">'+Array.from({length:31},(_,i)=>'<option value="'+(i+1)+'" '+(sharedPeriodDay()===i+1?'selected':'')+'>Tanggal '+(i+1)+' setiap bulan</option>').join('')+'</select><div class="small muted">Periode yang sama dipakai untuk laporan biaya kendaraan dan keuangan pribadi.</div></div><div class="field"><label>Tanggal gajian sebenarnya setiap bulan</label><select id="finPayday">'+Array.from({length:31},(_,i)=>'<option value="'+(i+1)+'" '+(Number(profile.payday_day||25)===i+1?'selected':'')+'>'+String(i+1)+' setiap bulan'+(i+1===31?' (bulan pendek: hari terakhir)':'')+'</option>').join('')+'</select></div><div class="field"><label>Tanggal gajian pertama yang dihitung</label><input id="finStartDate" type="date" value="'+esc(profile.salary_start_date||localToday())+'"></div><button class="btn primary" id="finProfileSave" style="width:100%">Simpan pengaturan</button><div class="small muted" style="margin-top:10px">Gaji dihitung satu kali setiap siklus sejak tanggal awal. Ubah tanggal awal hanya jika memang ingin mengubah dasar perhitungan historis.</div></div>';
 root.querySelector('#finBack').onclick=()=>render();
 root.querySelector('#finProfileSave').onclick=async()=>{
  const salary=Number(root.querySelector('#finSalary').value),day=Number(root.querySelector('#finPayday').value),periodDay=Number(root.querySelector('#finPeriodDay').value),start=root.querySelector('#finStartDate').value;
  if(!Number.isFinite(salary)||salary<0||!start||periodDay<1||periodDay>31){toast('Isi gaji dan tanggal dengan benar.');return}
  const sharedKey='VL_SHARED_PERIOD_V1_'+String(ctx.user.id||'guest');
  const sharedValue=JSON.stringify({start_day:periodDay,updated_at:new Date().toISOString()});
  localStorage.setItem(sharedKey,sharedValue);
  localStorage.setItem('VL_VEHICLE_PERIOD_V1_'+String(ctx.user.id||'guest'),sharedValue);
  const payload={user_id:ctx.user.id,monthly_salary:salary,payday_day:day,salary_start_date:start,currency:'IDR',updated_at:new Date().toISOString()};
  const {data,error}=await ctx.sb.from('finance_profiles').upsert(payload,{onConflict:'user_id'}).select().single();
  if(error){toast('Gagal menyimpan: '+error.message);return}
  profile=data;periodOffset=0;toast('Pengaturan gaji tersimpan');render();
 };
}
function renderAll(){
 const root=document.getElementById('financeContent');if(!root)return;
 root.innerHTML='<div class="row between"><div><div class="small muted">RIWAYAT</div><h2 style="margin:3px 0">Semua transaksi</h2></div><button class="btn gray" id="finBack">← Kembali</button></div><div class="card" style="margin-top:12px">'+(transactions.length?transactions.map(txHtml).join(''):'<div class="empty">Belum ada transaksi.</div>')+'</div>';
 root.querySelector('#finBack').onclick=()=>render();
 root.querySelectorAll('[data-fin-delete]').forEach(b=>b.onclick=()=>deleteTransaction(b.dataset.finDelete));
}
async function saveTextTransactions(){
 const root=document.getElementById('financeContent'),textValue=root?.querySelector('#finText')?.value||'',direction=root?.querySelector('#finDirection')?.value||'expense';
 if(!textValue.trim()){toast('Tulis dulu catatan dan nominalnya.');return}
 const parsed=parseEntries(textValue,direction);
 if(!parsed.out.length){toast('Nominal belum terbaca. Contoh: beli bensin 50 ribu.');return}
 if(parsed.bad.length&&!confirm('Ada '+parsed.bad.length+' bagian yang tidak memiliki nominal dan akan dilewati. Simpan '+parsed.out.length+' transaksi yang terbaca?'))return;
 const {error}=await ctx.sb.from('finance_transactions').insert(parsed.out);
 if(error){toast('Gagal menyimpan transaksi: '+error.message);return}
 const saved=parsed.out.length;
 try{await loadData()}catch(e){toast('Tersimpan, tetapi gagal memuat ulang: '+e.message);return}
 toast(saved+' transaksi berhasil disimpan');render();
}
async function deleteTransaction(id){
 if(!confirm('Hapus transaksi ini?'))return;
 const {error}=await ctx.sb.from('finance_transactions').delete().eq('id',id).eq('user_id',ctx.user.id);
 if(error){toast('Gagal menghapus: '+error.message);return}
 transactions=transactions.filter(t=>t.id!==id);toast('Transaksi dihapus');render();
}
function startVoice(){
 const root=document.getElementById('financeContent'),status=root?.querySelector('#finVoiceStatus');
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){if(status)status.textContent='Input suara tidak didukung browser ini. Gunakan fitur dikte keyboard Android.';return}
 if(recognition){try{recognition.stop()}catch{}recognition=null}
 recognition=new SR();recognition.lang='id-ID';recognition.continuous=true;recognition.interimResults=true;
 if(status)status.textContent='Mendengarkan… izinkan akses mikrofon bila diminta.';
 recognition.onresult=e=>{
  let finalText='',interim='';
  for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)finalText+=e.results[i][0].transcript+' ';else interim+=e.results[i][0].transcript}
  const box=document.getElementById('financeContent')?.querySelector('#finText');
  if(box&&finalText)box.value=(box.value?box.value+' ':'')+finalText.trim();
  if(status)status.textContent=finalText?'Teks suara ditambahkan. '+(interim?'Mendengar: '+interim:''):(interim?'Mendengar: '+interim:'Mendengarkan…');
 };
 recognition.onerror=e=>{if(status)status.textContent='Input suara: '+(e.error==='not-allowed'?'izin mikrofon ditolak':e.error)};
 recognition.onend=()=>{if(status&&status.textContent==='Mendengarkan… izinkan akses mikrofon bila diminta.')status.textContent='Selesai mendengarkan.';recognition=null};
 try{recognition.start()}catch(e){if(status)status.textContent=e.message}
}
window.VehicleFinance={open};
})();