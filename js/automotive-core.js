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

function openEngineeringLab(vehicle){
 const m=modal(`<div class="row between"><div><h3>⚙️ Mechanical Engineering Lab</h3><div class="small muted">Thermal expansion, piston/block clearance, ring gap, deck & bearing clearance.</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="field"><label>Calculator</label><select id="engType">
 <option value="pistonwall">Piston ↔ Cylinder Wall</option><option value="ringgap">Ring End Gap at Temperature</option><option value="deck">Piston-to-Deck</option><option value="bearing">Bearing Oil Clearance</option><option value="rod">Rod Ratio</option><option value="valve">Piston-to-Valve Safety</option></select></div>
 <div id="engFields"></div><div class="small muted" style="margin-top:8px">⚠️ Coefficient/material dan minimum clearance harus berasal dari OEM/piston manufacturer bila tersedia. Tanpa spec tersebut hasil hanya engineering calculation, bukan assembly specification.</div>
 <pre id="engResult" style="white-space:pre-wrap;margin-top:10px">Isi parameter.</pre><button class="btn primary" id="runEng" style="width:100%">Hitung & Simpan</button>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 const fs={
 pistonwall:[['coldBoreMm','Cold bore (mm)'],['coldPistonMm','Cold piston (mm)'],['boreAlphaPerC','Bore α /°C'],['pistonAlphaPerC','Piston α /°C'],['referenceTempC','Reference °C'],['operatingTempC','Operating °C']],
 ringgap:[['coldGapMm','Cold ring gap (mm)'],['ringAlphaPerC','Ring α /°C'],['ringDiameterMm','Ring diameter (mm)'],['referenceTempC','Reference °C'],['operatingTempC','Operating °C']],
 deck:[['blockDeckHeightMm','Block deck height (mm)'],['headGasketCompressedMm','Compressed gasket (mm)'],['pistonCompressionHeightMm','Piston compression height (mm)'],['rodLengthMm','Rod length (mm)'],['strokeMm','Stroke (mm)'],['pistonAboveDeckMm','Measured piston above deck (mm)']],
 bearing:[['journalDiameterMm','Journal diameter (mm)'],['bearingBoreDiameterMm','Bearing bore diameter (mm)']],
 rod:[['rodLengthMm','Rod length (mm)'],['strokeMm','Stroke (mm)']],
 valve:[['measuredClearanceMm','Measured clearance (mm)'],['minimumRequiredMm','OEM minimum (mm)']]
 };
 const funcs={pistonwall:'pistonWallClearance',ringgap:'ringEndGapAtTemp',deck:'deckHeight',bearing:'bearingClearance',rod:'rodRatio',valve:'valvePistonSafety'};
 function render(){m.querySelector('#engFields').innerHTML='<div class="two">'+fs[m.querySelector('#engType').value].map(x=>'<div class="field"><label>'+x[1]+'</label><input id="e_'+x[0]+'" type="number" step="any"></div>').join('')+'</div>'}
 m.querySelector('#engType').onchange=render;render();
 m.querySelector('#runEng').onclick=async()=>{try{const type=m.querySelector('#engType').value,o={};fs[type].forEach(x=>o[x[0]]=Number(m.querySelector('#e_'+x[0]).value));const out=NS.engineering[funcs[type]](o);m.querySelector('#engResult').textContent=JSON.stringify(out,null,2);const s=await state.sb.from('vehicle_calculations').insert({vehicle_id:vehicle.id,calculation_type:'mechanical_'+type,formula_version:out.formulaVersion||'engineering-v1',inputs:o,outputs:out,assumptions:{requiresOemSpec:type==='valve'},deterministic:true,created_by:state.user.id});if(s.error)throw s.error;toast0('Engineering calculation tersimpan')}catch(e){m.querySelector('#engResult').textContent='ERROR: '+e.message}};
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


async function openModification(vehicle){
 const m=modal(`<div class="row between"><div><h3>🔧 Modification Engineering</h3><div class="small muted">Compatibility → calculation → test → validation</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="two">
  <div class="field"><label>System *</label><input id="modSystem" placeholder="Engine / CVT / Brake / Suspension / EV"></div>
  <div class="field"><label>Modification *</label><input id="modTitle" placeholder="Contoh: upgrade brake pad"></div>
  <div class="field"><label>Type</label><select id="modType"><option>performance</option><option>reliability</option><option>comfort</option><option>restoration</option><option>other</option></select></div>
  <div class="field"><label>Risk</label><select id="modRisk"><option>unknown</option><option>low</option><option>medium</option><option>high</option><option>critical</option></select></div>
 </div>
 <div class="field"><label>Target effect</label><textarea id="modTarget" placeholder="Apa yang ingin dicapai?"></textarea></div>
 <div class="field"><label>Baseline JSON</label><textarea id="modBase">{}</textarea></div>
 <div class="field"><label>Test plan</label><textarea id="modTest" placeholder="Parameter, kondisi, acceptance criteria..."></textarea></div>
 <div class="small muted">Status compatibility tetap UNKNOWN sampai interface, dimension, load, electrical/thermal compatibility dan evidence diverifikasi.</div>
 <button class="btn primary" style="width:100%;margin-top:10px" id="saveMod">Simpan Modification Record</button>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 m.querySelector('#saveMod').onclick=async()=>{
  try{
   const system=m.querySelector('#modSystem').value.trim(),title=m.querySelector('#modTitle').value.trim();if(!system||!title)throw Error('System dan nama modifikasi wajib');
   let baseline={};try{baseline=JSON.parse(m.querySelector('#modBase').value||'{}')}catch{throw Error('Baseline JSON tidak valid')}
   const r=await state.sb.from('vehicle_modifications').insert({vehicle_id:vehicle.id,system,title,modification_type:m.querySelector('#modType').value,risk_level:m.querySelector('#modRisk').value,target_effect:m.querySelector('#modTarget').value.trim()||null,baseline,test_plan:m.querySelector('#modTest').value.trim()||null,compatibility_status:'unknown',validation_status:'not_tested'}).select().single();
   if(r.error)throw r.error;toast0('Modification record tersimpan');m.remove();
  }catch(e){toast0('Gagal simpan modification: '+e.message)}
 };
}

async function openValidation(vehicle){
 const mods=await state.sb.from('vehicle_modifications').select('id,title,system,validation_status,compatibility_status,risk_level').eq('vehicle_id',vehicle.id).order('created_at',{ascending:false});
 if(mods.error)throw mods.error;
 const cases=await state.sb.from('diagnostic_cases').select('id,title,diagnosis_status').eq('vehicle_id',vehicle.id).order('opened_at',{ascending:false}).limit(20);
 if(cases.error)throw cases.error;
 const m=modal(`<div class="row between"><div><h3>✅ Validation Engine</h3><div class="small muted">Uji hasil modifikasi/diagnosis terhadap baseline dan acceptance criteria.</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="field"><label>Validation type *</label><input id="valType" placeholder="road test / dyno / measurement / repair verification"></div>
 <div class="two"><div class="field"><label>Link Modification</label><select id="valMod"><option value="">—</option>${(mods.data||[]).map(x=>`<option value="${esc0(x.id)}">${esc0(x.title)} · ${esc0(x.system)}</option>`).join('')}</select></div><div class="field"><label>Link Diagnostic Case</label><select id="valCase"><option value="">—</option>${(cases.data||[]).map(x=>`<option value="${esc0(x.id)}">${esc0(x.title)}</option>`).join('')}</select></div></div>
 <div class="field"><label>Baseline JSON</label><textarea id="valBase">{}</textarea></div>
 <div class="field"><label>Test Conditions JSON</label><textarea id="valCond">{}</textarea></div>
 <div class="field"><label>Result JSON</label><textarea id="valResult">{}</textarea></div>
 <div class="field"><label>Verdict</label><select id="valVerdict"><option>pending</option><option>pass</option><option>fail</option><option>conditional</option><option>inconclusive</option></select></div>
 <button class="btn primary" style="width:100%" id="saveVal">Simpan Validation</button>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 m.querySelector('#saveVal').onclick=async()=>{
  try{
   const parse=id=>{try{return JSON.parse(m.querySelector(id).value||'{}')}catch{throw Error('JSON tidak valid: '+id)}};
   const type=m.querySelector('#valType').value.trim();if(!type)throw Error('Validation type wajib');
   const r=await state.sb.from('validation_records').insert({vehicle_id:vehicle.id,modification_id:m.querySelector('#valMod').value||null,diagnostic_case_id:m.querySelector('#valCase').value||null,validation_type:type,baseline:parse('#valBase'),test_conditions:parse('#valCond'),result:parse('#valResult'),verdict:m.querySelector('#valVerdict').value,validated_at:new Date().toISOString(),validated_by:state.user.id}).select().single();
   if(r.error)throw r.error;
   if(m.querySelector('#valMod').value){
    const status=m.querySelector('#valVerdict').value==='pass'?'passed':m.querySelector('#valVerdict').value==='fail'?'failed':m.querySelector('#valVerdict').value==='conditional'?'conditional':'not_tested';
    await state.sb.from('vehicle_modifications').update({validation_status:status}).eq('id',m.querySelector('#valMod').value).eq('vehicle_id',vehicle.id);
   }
   toast0('Validation tersimpan');m.remove();
  }catch(e){toast0('Gagal simpan validation: '+e.message)}
 };
}


async function openExpertModal(){
 const v=typeof currentVehicle==='function'?currentVehicle():null;if(!v)return toast0('Pilih kendaraan dulu');
 const m=modal(`<div class="row between"><div><h3>🚘 Automotive Intelligence Hub</h3><div class="small muted">Digital Twin • EV/Engine • Diagnostics • Calculation • Evidence</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="grid" style="margin-top:12px">
 <button class="card" id="hubTwin" style="text-align:left"><strong>🧬 Digital Twin</strong><div class="small muted">Engine, EV, drivetrain, config & component state</div></button>
 <button class="card" id="hubDiag" style="text-align:left"><strong>🩺 Diagnostic Engine</strong><div class="small muted">Differential diagnosis berbasis test</div></button>
 <button class="card" id="hubCalc" style="text-align:left"><strong>🧮 Calculation Engine</strong><div class="small muted">Formula deterministik & tersimpan</div></button>
 <button class="card" id="hubEvidence" style="text-align:left"><strong>📚 Evidence Engine</strong><div class="small muted">Source, claim, confidence & verification</div></button>
 <button class="card" id="hubMod" style="text-align:left"><strong>🔧 Modification Engineering</strong><div class="small muted">Compatibility, risk, baseline & test plan</div></button>
 <button class="card" id="hubValidation" style="text-align:left"><strong>✅ Validation Engine</strong><div class="small muted">Test result & acceptance record</div></button>
 <button class="card" id="hubEngineering" style="text-align:left"><strong>⚙️ Mechanical Engineering Lab</strong><div class="small muted">Clearance, thermal expansion, deck, ring & bearing calculations</div></button>
 </div>
 <div class="card" style="margin-top:12px;background:#0f172a;color:#fff;box-shadow:none"><strong>AI Context Pipeline</strong><div class="small" style="opacity:.75;margin-top:6px">Vehicle → Configuration → Components → Modifications → Evidence → Measurements → Diagnostics → Calculations → Validation. AI hanya menerima context terstruktur; critical math tetap deterministic.</div></div>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 m.querySelector('#hubTwin').onclick=()=>{m.remove();openTwin(v)};
 m.querySelector('#hubDiag').onclick=()=>{m.remove();openDiagnostic(v)};
 m.querySelector('#hubCalc').onclick=()=>{m.remove();openLab(v)};
 m.querySelector('#hubEvidence').onclick=()=>{m.remove();openEvidence(v)};
 m.querySelector('#hubMod').onclick=()=>{m.remove();openModification(v)};
 m.querySelector('#hubValidation').onclick=()=>{m.remove();openValidation(v)};
 m.querySelector('#hubEngineering').onclick=()=>{m.remove();openEngineeringLab(v)};
}

function openInlineVoice(targetId){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return toast0('Speech Recognition tidak tersedia di browser ini.');
 const r=new SR();r.lang='id-ID';r.interimResults=true;r.continuous=false;
 r.onresult=e=>{let s='';for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;const t=qs(targetId);if(t)t.value=s};
 r.onerror=e=>toast0('Voice error: '+e.error);
 try{r.start()}catch(e){toast0('Voice sedang aktif atau browser menolak akses mic.')}
}


NS.engineering={
 thermalExpansionMm({lengthMm,alphaPerC,deltaTempC}){const L=n(lengthMm),a=n(alphaPerC),d=n(deltaTempC);if(!(L>0&&a>=0))throw Error('Length dan coefficient wajib valid');return round(L*a*d,6)},
 operatingBoreMm({coldBoreMm,boreAlphaPerC,referenceTempC,operatingTempC}){return round(n(coldBoreMm)*(1+n(boreAlphaPerC)*(n(operatingTempC)-n(referenceTempC))),6)},
 operatingPistonMm({coldPistonMm,pistonAlphaPerC,referenceTempC,operatingTempC}){return round(n(coldPistonMm)*(1+n(pistonAlphaPerC)*(n(operatingTempC)-n(referenceTempC))),6)},
 pistonWallClearance({coldBoreMm,coldPistonMm,boreAlphaPerC,pistonAlphaPerC,referenceTempC,operatingTempC}){
  const bore=NS.engineering.operatingBoreMm({coldBoreMm,boreAlphaPerC,referenceTempC,operatingTempC});
  const piston=NS.engineering.operatingPistonMm({coldPistonMm,pistonAlphaPerC,referenceTempC,operatingTempC});
  return {coldClearanceMm:round(n(coldBoreMm)-n(coldPistonMm),6),operatingBoreMm:bore,operatingPistonMm:piston,operatingClearanceMm:round(bore-piston,6),formulaVersion:'thermal-piston-wall-v1'};
 },
 ringEndGapAtTemp({coldGapMm,ringAlphaPerC,ringDiameterMm,referenceTempC,operatingTempC}){
  const d=n(ringDiameterMm),a=n(ringAlphaPerC),dt=n(operatingTempC)-n(referenceTempC);
  if(!(d>0&&a>=0))throw Error('Ring diameter/coefficient wajib valid');
  return {thermalGrowthMm:round(Math.PI*d*a*dt,6),estimatedGapMm:round(n(coldGapMm)+Math.PI*d*a*dt,6),formulaVersion:'thermal-ring-gap-v1'};
 },
 deckHeight({blockDeckHeightMm,headGasketCompressedMm,pistonCompressionHeightMm,rodLengthMm,strokeMm,pistonAboveDeckMm=0}){
  const v=n(blockDeckHeightMm)+n(headGasketCompressedMm)-(n(pistonCompressionHeightMm)+n(rodLengthMm)+n(strokeMm)/2);
  return {theoreticalPistonToDeckMm:round(v,4),measuredCorrectionMm:n(pistonAboveDeckMm),formulaVersion:'deck-height-v1'};
 },
 pistonSpeed({strokeMm,rpm}){return NS.calc.meanPistonSpeed({strokeMm,rpm})},
 rodRatio({rodLengthMm,strokeMm}){const r=n(rodLengthMm),s=n(strokeMm);if(!(r>0&&s>0))throw Error('Rod length/stroke wajib > 0');return round(r/s,4)},
 bearingClearance({journalDiameterMm,bearingBoreDiameterMm}){const j=n(journalDiameterMm),b=n(bearingBoreDiameterMm);if(!(j>0&&b>0))throw Error('Journal/bearing bore wajib > 0');return {clearanceMm:round(b-j,5),clearanceMicron:round((b-j)*1000,1),formulaVersion:'bearing-clearance-v1'}},
 valvePistonSafety({measuredClearanceMm,minimumRequiredMm}){const m=n(measuredClearanceMm),r=n(minimumRequiredMm);return {marginMm:round(m-r,4),status:m>=r?'pass':'fail',requiresOemSpec:true,formulaVersion:'valve-piston-v1'}}
};
NS.maintenance={
 predict({currentKm,lastServiceKm,intervalKm,currentDate,lastServiceDate,intervalMonths}){
  const kmLeft=intervalKm==null?null:n(intervalKm)-Math.max(0,n(currentKm)-n(lastServiceKm));
  let monthsLeft=null;
  if(intervalMonths!=null&&lastServiceDate&&currentDate){const a=new Date(lastServiceDate),b=new Date(currentDate);monthsLeft=n(intervalMonths)-((b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth())}
  return {kmRemaining:kmLeft,monthsRemaining:monthsLeft,due:(kmLeft!=null&&kmLeft<=0)||(monthsLeft!=null&&monthsLeft<=0),formulaVersion:'maintenance-interval-v1'};
 }
};
NS.health={
 score({reliability=100,maintenance=100,diagnostics=100,telemetry=100,evidence=100,safety=100}){
  const d={reliability:clamp(n(reliability),0,100),maintenance:clamp(n(maintenance),0,100),diagnostics:clamp(n(diagnostics),0,100),telemetry:clamp(n(telemetry),0,100),evidence:clamp(n(evidence),0,100),safety:clamp(n(safety),0,100)};
  const score=round(d.reliability*.22+d.maintenance*.20+d.diagnostics*.18+d.telemetry*.12+d.evidence*.10+d.safety*.18,2);
  return {score,grade:score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'E',dimensions:d,methodVersion:'vehicle-health-v1'};
 }
};


// v2.3 Universal OEM Evidence + telemetry/maintenance context
NS.oem={
  criticalKeys:['displacement_cc','bore_mm','stroke_mm','compression_ratio','piston_diameter_mm','cylinder_bore_mm','connecting_rod_length_mm','rod_length_mm','deck_height_mm','ring_end_gap_mm','piston_to_wall_clearance_mm','valve_to_piston_clearance_mm','bearing_clearance_mm','cam_timing_deg','injector_flow','fuel_pressure','oil_pressure','service_interval_km','service_interval_months'],
  isCritical(key){return this.criticalKeys.includes(String(key||'').toLowerCase())},
  buildResearchPrompt(vehicle,missing=[]){
    const v=vehicle||{};
    const requested=missing.length?missing:this.criticalKeys;
    return [
      'VEHICLE LIFEBOOK — OEM VERIFIED SPECIFICATION RESEARCH',
      'Identify the exact vehicle using make, model, year, variant, engine code and VIN when available.',
      'RULES: OEM/manufacturer source first. Prefer official model specification, official service/manual, official parts catalogue, official VIN lookup, official TSB.',
      'Use secondary sources only to cross-check; never promote them to OEM-verified without corroboration.',
      'For every numeric claim return source URL, publisher, document title/revision, applicability, retrieval date and verification status.',
      'NEVER GUESS. If a value cannot be verified from an authoritative source, return UNKNOWN.',
      'Assembly-critical dimensions must be VERIFIED before being used as an assembly specification.',
      'Do not confuse piston-pin diameter, ring diameter, bore, nominal piston diameter, or service limit.',
      'Return strict JSON: vehicle_identity, specs[], missing_specs[], conflicts[], sources[].',
      'vehicle_identity='+JSON.stringify({make:v.brand,model:v.model,year:v.year,variant:v.variant,engine_code:v.engine_code,vin:v.vin}),
      'requested_specs='+JSON.stringify(requested)
    ].join('\n');
  }
};

NS.telemetry={
  normalize({channel,value,unit,quality='valid',observedAt=new Date().toISOString(),rawValue=null}){
    return {channel,value:Number(value),unit:unit||null,quality,observedAt,rawValue};
  },
  trend(samples){
    const a=(samples||[]).filter(x=>Number.isFinite(Number(x.value))).map(x=>({t:new Date(x.observed_at||x.observedAt).getTime(),v:Number(x.value)})).sort((x,y)=>x.t-y.t);
    if(a.length<2)return {status:'insufficient',slope:null,samples:a.length};
    const dt=a[a.length-1].t-a[0].t;
    return {status:'ok',slope:dt?round((a[a.length-1].v-a[0].v)/(dt/3600000),6):null,samples:a.length};
  }
};

NS.maintenance.predictFromTelemetry=({rule,lastServiceOdometer,currentOdometer,intervalKm,telemetryTrend=null}={})=>{
  const last=n(lastServiceOdometer), current=n(currentOdometer), interval=n(intervalKm);
  if(!(interval>0))return {status:'unknown',reason:'interval_km_missing'};
  const dueAt=last+interval, remaining=Math.max(0,dueAt-current);
  return {status:remaining<=0?'due':remaining<=Math.max(500,interval*.1)?'due_soon':'ok',dueAtOdometer:dueAt,remainingKm:round(remaining,1),telemetryTrend};
};

NS.healthEngine={
  score({reliability=100,maintenance=100,diagnostics=100,telemetry=100,evidence=100,safety=100}={}){
    const score=round(n(reliability)*.22+n(maintenance)*.20+n(diagnostics)*.18+n(telemetry)*.12+n(evidence)*.10+n(safety)*.18,2);
    const grade=score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'E';
    return {score,grade,dimensions:{reliability,maintenance,diagnostics,telemetry,evidence,safety},methodVersion:'vehicle-health-v2'};
  }
};

async function loadVehicleVerifiedSpecs(vehicle){
  if(!vehicle||!state?.sb) return null;
  const r=await state.sb.rpc('get_vehicle_spec_context',{p_vehicle_id:vehicle.id});
  if(r.error)throw r.error;
  return r.data;
}
NS.loadVehicleVerifiedSpecs=loadVehicleVerifiedSpecs;

function buildAutoPrompt(vehicle,specContext,goal='modification/performance engineering'){
  const specs=specContext?.specs||[];
  return NS.oem.buildResearchPrompt(vehicle,[])+
    '\nCURRENT_VERIFIED_CONTEXT='+JSON.stringify(specs)+
    '\nGOAL='+goal+
    '\nUse verified context first. If a required parameter is missing, stop that calculation and request/source it; do not infer it.';
}
NS.buildAutoPrompt=buildAutoPrompt;

window.VehicleLifebookCore=NS;
window.openExpertModal=openExpertModal;
window.openInlineVoice=openInlineVoice;
})();
