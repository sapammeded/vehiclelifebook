/* Vehicle Lifebook Automotive Core v2.0
   Deterministic engineering helpers + Digital Twin/Diagnostic UI.
   Critical calculations are pure JavaScript; AI is not used for math or safety decisions.
*/
(function(){
'use strict';
const NS={version:'2.0.0',formulaVersions:{
 displacement:'engine-displacement-v1',compression:'compression-ratio-v1',pistonSpeed:'mean-piston-speed-v1',
 power:'power-torque-rpm-v1',wheelTorque:'wheel-torque-v1',evConsumption:'ev-consumption-v1',
 batteryEnergy:'battery-energy-v1',tireCircumference:'tire-circumference-v1'
}};
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const finite=(v)=>Number.isFinite(Number(v));
const round=(v,d=4)=>Number(Number(v).toFixed(d));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

NS.calc={
 displacementCc({boreMm,strokeMm,cylinders}){const b=n(boreMm),s=n(strokeMm),c=n(cylinders);if(!(b>0&&s>0&&c>0))throw Error('Bore, stroke, dan jumlah silinder wajib > 0');return round(Math.PI/4*b*b*s*c/1000,2)},
 compressionRatio({displacementCc,clearanceCc}){const d=n(displacementCc),v=n(clearanceCc);if(!(d>0&&v>0))throw Error('Displacement dan clearance volume wajib > 0');return round((d+v)/v,3)},
 meanPistonSpeed({strokeMm,rpm}){const s=n(strokeMm),r=n(rpm);if(!(s>0&&r>0))throw Error('Stroke dan RPM wajib > 0');return round(2*(s/1000)*r/60,3)},
 powerKw({torqueNm,rpm}){const t=n(torqueNm),r=n(rpm);if(!(t>=0&&r>=0))throw Error('Torque/RPM tidak valid');return round(t*r/9550,3)},
 wheelTorqueNm({engineTorqueNm,gearRatio,finalDriveRatio,efficiency=0.9}){const t=n(engineTorqueNm),g=n(gearRatio),f=n(finalDriveRatio),e=n(efficiency,.9);if(!(t>=0&&g>0&&f>0&&e>0&&e<=1))throw Error('Input rasio/efisiensi tidak valid');return round(t*g*f*e,2)},
 tireCircumferenceM({widthMm,aspectRatioPct,rimIn}){const w=n(widthMm),a=n(aspectRatioPct),r=n(rimIn);if(!(w>0&&a>0&&r>0))throw Error('Ukuran ban tidak lengkap');const side=w*a/100,diam=2*side+r*25.4;return {diameterMm:round(diam,2),circumferenceM:round(Math.PI*diam/1000,4)}},
 evConsumptionKwh100({usableKwh,rangeKm}){const e=n(usableKwh),r=n(rangeKm);if(!(e>0&&r>0))throw Error('Battery usable dan range wajib > 0');return round(e/r*100,2)},
 batteryEnergyKwh({voltageV,capacityAh}){const v=n(voltageV),a=n(capacityAh);if(!(v>0&&a>0))throw Error('Voltage dan Ah wajib > 0');return round(v*a/1000,3)}
};

NS.assessSpec=(value,min,max)=>{
 if(!finite(value))return {status:'unassessed',deviation:null};
 const v=Number(value); if(finite(min)&&v<Number(min))return {status:'out_of_spec',deviation:round(v-Number(min),4)};
 if(finite(max)&&v>Number(max))return {status:'out_of_spec',deviation:round(v-Number(max),4)};
 if(finite(min)&&finite(max)){const span=Number(max)-Number(min);const margin=Math.min(v-Number(min),Number(max)-v);if(span>0&&margin/span<.1)return {status:'borderline',deviation:0}}
 return {status:'within_spec',deviation:0};
};

const tests=[
 {system:'Fuel',keywords:/susah hidup|hard start|sulit start|no start|tidak hidup|mogok|bensin|fuel|injector/i,tests:['Verifikasi tegangan battery saat crank','Ukur fuel pressure sesuai manual kendaraan','Periksa injector command/pulse bila alat tersedia','Bandingkan compression antar silinder','Periksa CKP/CMP dan sinkronisasi timing']},
 {system:'Ignition',keywords:/misfire|brebet|mbrebet|pincang|busi|coil|pengapian/i,tests:['Baca DTC dan freeze-frame','Periksa kondisi/gap busi sesuai spesifikasi','Tukar coil hanya sebagai uji terkontrol dan catat perubahan','Periksa fuel trim/lambda','Uji compression/leak-down bila indikasi mekanis']},
 {system:'Air/Throttle',keywords:/idle|langsam|throttle|gas|ngempos|hesit|tersendat/i,tests:['Periksa intake leak dan hose','Periksa throttle/TPS/MAP/MAF sesuai sistem','Bandingkan target vs actual idle/load','Periksa fuel trim','Validasi setelah perbaikan']},
 {system:'Cooling',keywords:/overheat|panas|temperatur|coolant|air radiator|radiator/i,tests:['Jangan lanjutkan operasi bila temperatur abnormal berat','Periksa level dan kebocoran coolant saat aman','Uji thermostat/fan/control sesuai manual','Periksa pressure cooling system','Periksa head-gasket/combustion gas bila ada indikasi']},
 {system:'Lubrication',keywords:/oli|oil pressure|tekanan oli|knocking|ngelitik|bunyi mesin/i,tests:['Periksa level/jenis oli','Ukur oil pressure dengan alat yang sesuai','Identifikasi noise berdasarkan RPM dan temperatur','Periksa filter/pickup bila diperlukan','Jangan melakukan high-RPM test bila tekanan oli meragukan']},
 {system:'CVT/Drivetrain',keywords:/cvt|roller|variator|belt|kopling|clutch|selip|slip|transmisi/i,tests:['Catat RPM, speed dan throttle saat gejala','Periksa belt/komponen sesuai interval dan wear limit','Periksa clutch engagement/slip','Verifikasi rasio/final drive','Uji temperatur dan validasi setelah perubahan']},
 {system:'Brake',keywords:/rem|brake|abs|getar saat rem|rem blong/i,tests:['Hentikan penggunaan bila pengereman tidak aman','Periksa level/fluid dan kebocoran','Periksa pad/disc/drum dan runout','Scan ABS bila tersedia','Bleeding/repair sesuai prosedur OEM']},
 {system:'EV/HV',keywords:/ev|hybrid|baterai|battery|soc|soh|inverter|motor listrik|high voltage|hv/i,tests:['Jangan membuka sistem HV tanpa prosedur OEM dan personel berkualifikasi','Baca DTC/BMS data bila alat yang tepat tersedia','Catat SOC/SOH, pack voltage dan temperatur','Periksa isolation/interlock hanya dengan prosedur aman','Validasi thermal/derating behavior setelah perbaikan']}
];
NS.diagnose=(symptom,conditions='')=>{
 const text=String(symptom||'')+' '+String(conditions||'');
 const matched=tests.filter(x=>x.keywords.test(text));
 const chosen=matched.length?matched:[{system:'General',tests:['Klarifikasi kondisi saat gejala terjadi','Catat cold/hot, RPM, speed, load dan lingkungan','Baca DTC/data live bila alat tersedia','Pisahkan electrical, fuel/air, mechanical, thermal dan control hypotheses','Lakukan test paling aman dengan nilai informasi tinggi terlebih dahulu']}];
 return {
  method:'SYMPTOM → CONDITION → SYSTEM → HYPOTHESIS → TEST → RESULT → ROOT CAUSE → REPAIR → VALIDATION',
  safety:chosen.some(x=>x.system==='EV/HV'||x.system==='Brake'||x.system==='Cooling')?'CAUTION':'NORMAL',
  hypotheses:chosen.map(x=>({system:x.system,priority:'investigate',tests:x.tests}))
 };
};

NS.buildContext=(vehicle,config,components,mods)=>{
 return {vehicle:vehicle||{},configuration:config||{},components:components||[],modifications:mods||[],generatedAt:new Date().toISOString(),engineVersion:NS.version};
};

function qs(id){return document.getElementById(id)}
function esc0(s){return typeof window.esc==='function'?window.esc(s):String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function toast0(s){if(typeof window.toast==='function')window.toast(s);else alert(s)}
async function rpc(name,args){return await state.sb.rpc(name,args)}

async function openTwin(vehicle){
 const {data,error}=await state.sb.from('vehicle_configurations').select('*').eq('vehicle_id',vehicle.id).maybeSingle();
 if(error)throw error;
 const cfg=data||{};
 const [comps,mods]=await Promise.all([
  state.sb.from('vehicle_components').select('*').eq('vehicle_id',vehicle.id).order('system').order('name'),
  state.sb.from('vehicle_modifications').select('*').eq('vehicle_id',vehicle.id).order('created_at',{ascending:false})
 ]);
 if(comps.error)throw comps.error;if(mods.error)throw mods.error;
 const m=modal(`<div class="row between"><div><h3>🧬 Digital Twin</h3><div class="small muted">Konfigurasi kendaraan + komponen + modifikasi</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="badge ${cfg.source_status==='verified'?'success':'warning'}">${esc0(cfg.source_status||'user_entered')}</div>
 <div class="two" style="margin-top:12px">
 <div class="field"><label>VIN</label><input id="tVin" value="${esc0(cfg.vin||'')}"></div>
 <div class="field"><label>Engine Code</label><input id="tEngine" value="${esc0(cfg.engine_code||'')}"></div>
 <div class="field"><label>Engine Type</label><select id="tEngineType"><option>unknown</option><option>ice</option><option>ev</option><option>hybrid</option></select></div>
 <div class="field"><label>Fuel Type</label><input id="tFuel" value="${esc0(cfg.fuel_type||'')}"></div>
 <div class="field"><label>Displacement (cc)</label><input id="tDisp" type="number" value="${cfg.displacement_cc??''}"></div>
 <div class="field"><label>Cylinders</label><input id="tCyl" type="number" value="${cfg.cylinders??''}"></div>
 <div class="field"><label>Battery (kWh)</label><input id="tBattery" type="number" value="${cfg.battery_kwh??''}"></div>
 <div class="field"><label>Motor Peak (kW)</label><input id="tMotor" type="number" value="${cfg.motor_peak_kw??''}"></div>
 <div class="field"><label>System Voltage (V)</label><input id="tVoltage" type="number" value="${cfg.system_voltage_v??''}"></div>
 <div class="field"><label>Transmission</label><input id="tTrans" value="${esc0(cfg.transmission_type||'')}"></div>
 <div class="field"><label>Drive Layout</label><input id="tDrive" value="${esc0(cfg.drive_layout||'')}"></div>
 <div class="field"><label>Weight (kg)</label><input id="tWeight" type="number" value="${cfg.curb_weight_kg??''}"></div>
 </div>
 <div class="field"><label>Current State JSON</label><textarea id="tState">${esc0(JSON.stringify(cfg.current_state||{},null,2))}</textarea></div>
 <button class="btn primary" style="width:100%" id="saveTwin">Simpan Digital Twin</button>
 <div class="section-title">Komponen (${comps.data?.length||0})</div>
 <div class="small muted">Komponen dapat dikembangkan per sistem; data tidak mengubah histori event.</div>
 <div id="twinComponents" style="margin-top:8px">${(comps.data||[]).slice(0,20).map(c=>`<div class="card" style="box-shadow:none;margin-bottom:6px"><strong>${esc0(c.name)}</strong><div class="small muted">${esc0(c.system)} · ${esc0(c.component_type)} · ${esc0(c.status)}</div></div>`).join('')||'<div class="empty">Belum ada komponen terstruktur.</div>'}</div>
 <div class="section-title">Modifikasi (${mods.data?.length||0})</div>
 <div class="small muted">Setiap modifikasi nantinya harus punya compatibility → calculation → test → validation.</div>
 <div>${(mods.data||[]).slice(0,10).map(x=>`<div class="card" style="box-shadow:none;margin-bottom:6px"><strong>${esc0(x.title)}</strong><div class="small muted">${esc0(x.system)} · compatibility: ${esc0(x.compatibility_status)} · validation: ${esc0(x.validation_status)}</div></div>`).join('')||'<div class="empty">Belum ada modifikasi.</div>'}</div>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 m.querySelector('#tEngineType').value=cfg.engine_type||'unknown';
 m.querySelector('#saveTwin').onclick=async()=>{
  try{
   const raw=m.querySelector('#tState').value.trim()||'{}';const current=JSON.parse(raw);
   const payload={vehicle_id:vehicle.id,vin:m.querySelector('#tVin').value.trim()||null,engine_code:m.querySelector('#tEngine').value.trim()||null,engine_type:m.querySelector('#tEngineType').value,fuel_type:m.querySelector('#tFuel').value.trim()||null,displacement_cc:Number(m.querySelector('#tDisp').value)||null,cylinders:Number(m.querySelector('#tCyl').value)||null,battery_kwh:Number(m.querySelector('#tBattery').value)||null,motor_peak_kw:Number(m.querySelector('#tMotor').value)||null,system_voltage_v:Number(m.querySelector('#tVoltage').value)||null,transmission_type:m.querySelector('#tTrans').value.trim()||null,drive_layout:m.querySelector('#tDrive').value.trim()||null,curb_weight_kg:Number(m.querySelector('#tWeight').value)||null,current_state:current,source_status:'user_entered'};
   const r=await state.sb.from('vehicle_configurations').upsert(payload,{onConflict:'vehicle_id'});if(r.error)throw r.error;toast0('Digital Twin tersimpan');m.remove();
  }catch(e){toast0('Twin gagal disimpan: '+e.message)}
 };
}

function openLab(vehicle){
 const m=modal(`<div class="row between"><div><h3>🧮 Engineering Calculation Engine</h3><div class="small muted">Perhitungan deterministik • formula versioned • bukan estimasi AI</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="field"><label>Calculation</label><select id="calcType">
 <option value="displacement">Engine displacement</option><option value="compression">Compression ratio</option><option value="piston">Mean piston speed</option><option value="power">Power from torque/RPM</option><option value="wheel">Wheel torque</option><option value="tire">Tyre diameter & circumference</option><option value="evcons">EV consumption</option><option value="battery">Battery energy</option></select></div>
 <div id="calcFields"></div><div class="card" style="box-shadow:none;background:#f8fafc;margin-top:8px"><div class="small muted">RESULT</div><pre id="calcResult" style="white-space:pre-wrap;margin-bottom:0">Isi input lalu hitung.</pre></div>
 <div class="row" style="margin-top:10px"><button class="btn primary" id="runCalc">Hitung</button><button class="btn ghost" id="saveCalc">Simpan hasil</button></div>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 const fields={
 displacement:[['boreMm','Bore (mm)'],['strokeMm','Stroke (mm)'],['cylinders','Cylinders']],
 compression:[['displacementCc','Displacement (cc)'],['clearanceCc','Clearance volume (cc)']],
 piston:[['strokeMm','Stroke (mm)'],['rpm','RPM']],
 power:[['torqueNm','Torque (Nm)'],['rpm','RPM']],
 wheel:[['engineTorqueNm','Engine torque (Nm)'],['gearRatio','Gear ratio'],['finalDriveRatio','Final drive ratio'],['efficiency','Efficiency 0–1']],
 tire:[['widthMm','Tyre width (mm)'],['aspectRatioPct','Aspect ratio (%)'],['rimIn','Rim (inch)']],
 evcons:[['usableKwh','Usable battery (kWh)'],['rangeKm','Range (km)']],
 battery:[['voltageV','Voltage (V)'],['capacityAh','Capacity (Ah)']]
 };
 function renderFields(){m.querySelector('#calcFields').innerHTML='<div class="two">'+fields[m.querySelector('#calcType').value].map(x=>'<div class="field"><label>'+x[1]+'</label><input id="f_'+x[0]+'" type="number" step="any"></div>').join('')+'</div>'}
 m.querySelector('#calcType').onchange=renderFields;renderFields();let last=null;
 m.querySelector('#runCalc').onclick=()=>{
  try{const type=m.querySelector('#calcType').value;const o={};fields[type].forEach(x=>o[x[0]]=Number(m.querySelector('#f_'+x[0]).value));
   const map={displacement:['displacement',NS.calc.displacementCc],compression:['compression',NS.calc.compressionRatio],piston:['pistonSpeed',NS.calc.meanPistonSpeed],power:['power',NS.calc.powerKw],wheel:['wheelTorqueNm',NS.calc.wheelTorqueNm],tire:['tireCircumference',NS.calc.tireCircumferenceM],evcons:['evConsumptionKwh100',NS.calc.evConsumptionKwh100],battery:['batteryEnergyKwh',NS.calc.batteryEnergyKwh]};
   const r=map[type][1](o);last={type,formulaVersion:NS.formulaVersions[map[type][0]]||'v1',inputs:o,outputs:r,assumptions:{},deterministic:true};m.querySelector('#calcResult').textContent=JSON.stringify(r,null,2);
  }catch(e){m.querySelector('#calcResult').textContent='ERROR: '+e.message;last=null}
 };
 m.querySelector('#saveCalc').onclick=async()=>{if(!last)return toast0('Hitung dulu');try{const r=await state.sb.from('vehicle_calculations').insert({vehicle_id:vehicle.id,calculation_type:last.type,formula_version:last.formulaVersion,inputs:last.inputs,outputs:last.outputs,assumptions:last.assumptions,deterministic:true,created_by:state.user.id}).select().single();if(r.error)throw r.error;toast0('Calculation tersimpan')}catch(e){toast0('Gagal simpan: '+e.message)}};
}

async function openDiagnostic(vehicle){
 const m=modal(`<div class="row between"><div><h3>🩺 Diagnostic Engine</h3><div class="small muted">Differential diagnosis: symptom → test → result → root cause → validation</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="field"><label>Keluhan / symptom *</label><textarea id="diagSymptom" placeholder="Contoh: mesin susah hidup saat dingin, setelah panas normal"></textarea></div>
 <div class="field"><label>Kondisi saat gejala</label><textarea id="diagCond" placeholder="Cold/hot, RPM, load, speed, cuaca, setelah servis/modifikasi, dll."></textarea></div>
 <button class="btn primary" style="width:100%" id="analyzeDiag">Buat Diagnostic Plan</button><div id="diagOut" style="margin-top:12px"></div>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 m.querySelector('#analyzeDiag').onclick=async()=>{
  const symptom=m.querySelector('#diagSymptom').value.trim();const cond=m.querySelector('#diagCond').value.trim();if(!symptom)return toast0('Symptom wajib');
  const plan=NS.diagnose(symptom,cond);
  m.querySelector('#diagOut').innerHTML='<div class="badge '+(plan.safety==='NORMAL'?'success':'warning')+'">SAFETY: '+plan.safety+'</div>'+plan.hypotheses.map((h,i)=>'<div class="card" style="box-shadow:none;margin-top:8px"><strong>'+(i+1)+'. '+esc0(h.system)+'</strong><ol>'+h.tests.map(t=>'<li class="small" style="margin:5px 0">'+esc0(t)+'</li>').join('')+'</ol></div>').join('')+'<button class="btn ghost" style="width:100%;margin-top:10px" id="saveDiag">Simpan Diagnostic Case</button>';
  m.querySelector('#saveDiag').onclick=async()=>{try{const first=plan.hypotheses[0];const r=await state.sb.from('diagnostic_cases').insert({vehicle_id:vehicle.id,title:symptom.slice(0,120),symptom,conditions:{text:cond},suspected_system:first?.system||null,safety_level:plan.safety==='NORMAL'?'normal':'caution',created_by:state.user.id}).select().single();if(r.error)throw r.error;const steps=(first?.tests||[]).map((t,i)=>({case_id:r.data.id,sequence_no:i+1,hypothesis:first.system,test_name:t,status:'planned'}));if(steps.length){const s=await state.sb.from('diagnostic_steps').insert(steps);if(s.error)throw s.error}toast0('Diagnostic case tersimpan');}
  catch(e){toast0('Gagal simpan diagnostic: '+e.message)}};
 };
}

async function openEvidence(vehicle){
 const m=modal(`<div class="row between"><div><h3>📚 Evidence Engine</h3><div class="small muted">Pisahkan fakta, sumber, observasi, confidence dan verification.</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="field"><label>Judul sumber *</label><input id="evTitle" placeholder="Contoh: Service Manual / hasil pengukuran"></div>
 <div class="two"><div class="field"><label>Tipe</label><select id="evType"><option value="user_statement">User statement</option><option value="measurement">Measurement</option><option value="service_manual">Service manual</option><option value="oem_manual">OEM manual</option><option value="photo">Photo</option><option value="invoice">Invoice</option><option value="other">Other</option></select></div><div class="field"><label>Trust</label><select id="evTrust"><option>unknown</option><option>low</option><option>medium</option><option>high</option><option>oem</option></select></div></div>
 <div class="field"><label>Claim / fakta yang didukung *</label><textarea id="evClaim"></textarea></div>
 <div class="field"><label>Observation</label><textarea id="evObs"></textarea></div>
 <div class="two"><div class="field"><label>Confidence 0–1</label><input id="evConf" type="number" step="0.01" min="0" max="1" value="0.5"></div><div class="field"><label>URL / document ref</label><input id="evRef"></div></div>
 <button class="btn primary" style="width:100%" id="saveEvidence">Simpan Evidence</button>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 m.querySelector('#saveEvidence').onclick=async()=>{try{const title=m.querySelector('#evTitle').value.trim(),claim=m.querySelector('#evClaim').value.trim();if(!title||!claim)throw Error('Judul dan claim wajib');const s=await state.sb.from('evidence_sources').insert({owner_id:state.user.id,source_type:m.querySelector('#evType').value,title,trust_level:m.querySelector('#evTrust').value,url:m.querySelector('#evRef').value.trim()||null}).select().single();if(s.error)throw s.error;const e=await state.sb.from('vehicle_evidence').insert({vehicle_id:vehicle.id,source_id:s.data.id,claim,observation:m.querySelector('#evObs').value.trim()||null,confidence:clamp(Number(m.querySelector('#evConf').value),0,1),created_by:state.user.id});if(e.error)throw e.error;toast0('Evidence tersimpan');m.remove()}catch(e){toast0('Gagal simpan evidence: '+e.message)}};
}

async function openExpertModal(){
 const v=typeof currentVehicle==='function'?currentVehicle():null;if(!v)return toast0('Pilih kendaraan dulu');
 const m=modal(`<div class="row between"><div><h3>🚘 Automotive Intelligence Hub</h3><div class="small muted">Digital Twin • EV/Engine • Diagnostics • Calculation • Evidence</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="grid" style="margin-top:12px">
 <button class="card" id="hubTwin" style="text-align:left"><strong>🧬 Digital Twin</strong><div class="small muted">Engine, EV, drivetrain, config & component state</div></button>
 <button class="card" id="hubDiag" style="text-align:left"><strong>🩺 Diagnostic Engine</strong><div class="small muted">Differential diagnosis berbasis test</div></button>
 <button class="card" id="hubCalc" style="text-align:left"><strong>🧮 Calculation Engine</strong><div class="small muted">Formula deterministik & tersimpan</div></button>
 <button class="card" id="hubEvidence" style="text-align:left"><strong>📚 Evidence Engine</strong><div class="small muted">Source, claim, confidence & verification</div></button>
 </div>
 <div class="card" style="margin-top:12px;background:#0f172a;color:#fff;box-shadow:none"><strong>AI Context Pipeline</strong><div class="small" style="opacity:.75;margin-top:6px">Vehicle → Configuration → Components → Modifications → Evidence → Measurements → Diagnostics → Calculations → Validation. AI hanya menerima context terstruktur; critical math tetap deterministic.</div></div>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 m.querySelector('#hubTwin').onclick=()=>{m.remove();openTwin(v)};
 m.querySelector('#hubDiag').onclick=()=>{m.remove();openDiagnostic(v)};
 m.querySelector('#hubCalc').onclick=()=>{m.remove();openLab(v)};
 m.querySelector('#hubEvidence').onclick=()=>{m.remove();openEvidence(v)};
}

function openInlineVoice(targetId){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return toast0('Speech Recognition tidak tersedia di browser ini.');
 const r=new SR();r.lang='id-ID';r.interimResults=true;r.continuous=false;
 r.onresult=e=>{let s='';for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;const t=qs(targetId);if(t)t.value=s};
 r.onerror=e=>toast0('Voice error: '+e.error);
 try{r.start()}catch(e){toast0('Voice sedang aktif atau browser menolak akses mic.')}
}

window.VehicleLifebookCore=NS;
window.openExpertModal=openExpertModal;
window.openInlineVoice=openInlineVoice;
})();
