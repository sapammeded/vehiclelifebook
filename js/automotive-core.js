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
 {system:'Fuel / Delivery',priority:3,keywords:/susah hidup|hard start|sulit start|no start|tidak hidup|mogok|bensin|fuel|injector|fuel pressure/i,tests:['Verifikasi battery/cranking voltage','Ukur fuel pressure sesuai dokumentasi kendaraan','Periksa injector command/pulse bila alat tersedia','Periksa air/fuel correction atau lambda data bila tersedia','Evaluasi compression bila indikasi mekanis']},
 {system:'Ignition / Combustion',priority:3,keywords:/misfire|brebet|mbrebet|pincang|busi|coil|pengapian|knocking|detonation/i,tests:['Baca DTC dan freeze-frame','Periksa ignition components sesuai arsitektur kendaraan','Bandingkan misfire counter/cylinder contribution bila tersedia','Periksa fuel/air correction','Uji compression/leak-down bila indikasi mekanis']},
 {system:'Air / Throttle / Control',priority:2,keywords:/idle|langsam|throttle|gas|ngempos|hesit|tersendat|responsif|responsiveness|akselerasi|akselerasi awal|tarikan awal|tarikan/i,tests:['Periksa intake/exhaust restriction dan kebocoran','Bandingkan throttle/accelerator request dengan actual','Periksa MAP/MAF/TPS atau sensor ekuivalen sesuai arsitektur','Periksa fuel/air correction atau torque request','Validasi pada kondisi operasi yang sama']},
 {system:'Cooling / Thermal',priority:3,keywords:/overheat|panas|temperatur|coolant|air radiator|radiator|thermal|derating/i,tests:['Hentikan pengujian bila temperatur berada pada kondisi berbahaya','Periksa level dan kebocoran saat aman','Bandingkan commanded vs actual cooling control','Periksa temperatur sensor dan thermal limits','Validasi thermal behavior setelah tindakan']},
 {system:'Lubrication / Mechanical',priority:3,keywords:/oli|oil pressure|tekanan oli|bunyi mesin|knocking|ngelitik|compression|kompresi/i,tests:['Periksa level dan kondisi lubricant','Ukur pressure/parameter yang relevan dengan alat yang sesuai','Karakterisasi noise berdasarkan RPM, load dan temperature','Periksa mechanical timing/compression bila ada indikasi','Jangan melakukan load test berisiko bila lubrication diragukan']},
 {system:'Transmission / Drivetrain',priority:2,keywords:/cvt|roller|variator|belt|kopling|clutch|selip|slip|transmisi|gearbox|dct|amt|torque converter|final drive|drivetrain|akselerasi|tarikan/i,tests:['Catat speed, RPM, accelerator/throttle, gear/ratio dan load saat gejala','Tentukan tipe transmission/drivetrain sebelum menyimpulkan komponen','Periksa engagement/slip/ratio behavior sesuai arsitektur','Periksa wear/temperature/fluid/actuator data bila relevan','Uji ulang dalam kondisi yang sama dan bandingkan baseline']},
 {system:'Brake / Chassis',priority:1,keywords:/rem|brake|abs|steering|setir|suspensi|suspension|ban|tyre|tire|getar/i,tests:['Hentikan penggunaan bila fungsi keselamatan terganggu','Periksa kebocoran, wear dan kondisi komponen','Scan ABS/ESC/steering modules bila tersedia','Periksa wheel/tire condition dan alignment bila relevan','Validasi melalui controlled road test yang aman']},
 {system:'Electrical / Network / ECU',priority:2,keywords:/listrik|electrical|battery|aki|alternator|charging|starter|ecu|tcu|bcm|can|dtc|sensor|actuator|wiring/i,tests:['Periksa supply voltage, ground dan fuse/relay','Baca DTC seluruh module yang relevan','Periksa live data dan command vs actual','Periksa wiring/connectors sebelum mengganti module','Clear/retest hanya setelah baseline tersimpan']},
 {system:'EV / HV / BMS',priority:3,keywords:/ev|hybrid|soc|soh|inverter|motor listrik|high voltage|hv|bms|traction battery|isolation/i,tests:['Jangan membuka HV system tanpa prosedur keselamatan dan kualifikasi yang sesuai','Baca DTC/BMS/VCU data dengan alat yang tepat','Catat SOC/SOH, pack voltage dan temperature bila tersedia','Periksa isolation/interlock hanya dengan prosedur aman','Validasi derating/thermal behavior setelah tindakan']}
];
const launchRules=[{re:/tarikan awal|akselerasi awal|responsif|responsiveness|ngempos awal|start awal/i,systems:['Transmission / Drivetrain','Air / Throttle / Control','Ignition / Combustion'],tests:['Reproduksi keluhan dan catat cold/hot, RPM, speed, accelerator/throttle, gear/ratio dan load','Identifikasi architecture: CVT, AT, DCT, AMT, MT, EV reduction drive atau lainnya','Bandingkan requested vs actual torque/throttle/ratio bila data tersedia','Periksa mechanical/transmission engagement dan slip sesuai architecture','Periksa engine/drive-unit response dan air/combustion/electrical data sesuai propulsion','Ulangi controlled test setelah tindakan dan bandingkan baseline']}];
function architectureContext(vehicle){const v=vehicle||{};return {engine:String(v.engine_type||'').toLowerCase(),trans:String(v.transmission_type||'').toLowerCase(),vehicle:String(v.vehicle_type||'').toLowerCase(),cls:String(v.vehicle_class||'').toLowerCase()};}
NS.diagnose=(symptom,conditions='',vehicle={})=>{const text=String(symptom||'')+' '+String(conditions||'');const a=architectureContext(vehicle);let hypotheses=[];const launch=launchRules.find(x=>x.re.test(text));if(launch){const ev=a.engine.includes('ev')||a.engine.includes('electric')||a.engine.includes('bev');const hv=a.engine.includes('hybrid')||a.engine.includes('phev');const cvt=/cvt|scooter|matic/.test(a.trans+' '+a.vehicle+' '+a.cls);const order=ev?['Air / Throttle / Control','Transmission / Drivetrain','Ignition / Combustion']:hv?['Transmission / Drivetrain','Air / Throttle / Control','Electrical / Network / ECU']:cvt?['Transmission / Drivetrain','Air / Throttle / Control','Ignition / Combustion']:launch.systems;hypotheses=order.map((system,i)=>({system,priority:i===0?'high':'investigate',status:'hypothesis_only',reason:'Symptom pattern requires testing; architecture and measurements are not sufficient to confirm root cause.',tests:launch.tests}));}else{const tests=[{system:'Fuel / Delivery',priority:3,keywords:/bensin|fuel|injector|fuel pressure/i},{system:'Ignition / Combustion',priority:3,keywords:/misfire|brebet|pincang|busi|coil|pengapian/i},{system:'Air / Throttle / Control',priority:2,keywords:/idle|langsam|throttle|gas|ngempos|hesit|tersendat/i},{system:'Cooling / Thermal',priority:3,keywords:/overheat|panas|coolant|radiator|temperature/i},{system:'Lubrication / Mechanical',priority:3,keywords:/oli|oil|compression|bunyi mesin|knocking/i},{system:'Transmission / Drivetrain',priority:2,keywords:/cvt|roller|variator|belt|kopling|clutch|selip|slip|transmisi|gearbox|dct|amt/i},{system:'Brake / Chassis',priority:1,keywords:/rem|brake|steering|setir|suspensi|shock|ban|tire/i},{system:'Electrical / Network / ECU',priority:2,keywords:/ecu|sensor|kelistrikan|battery|aki|charging|dtc|check engine/i},{system:'EV / HV / BMS',priority:3,keywords:/ev|hybrid|phev|bms|high voltage|motor listrik/i}];hypotheses=tests.filter(t=>t.keywords.test(text)).sort((a,b)=>b.priority-a.priority).map(t=>({system:t.system,priority:t.priority>=3?'high':'investigate',status:'hypothesis_only',reason:'Keyword match is a routing signal only; it does not establish root cause.',tests:['Define the diagnostic question and required operating conditions','Collect the applicable measurement, scan data, physical inspection or functional test','Compare actual result with vehicle-specific expected information','Record the result and reassess competing hypotheses']}));}const arch=[vehicle.engine_type,vehicle.transmission_type,vehicle.drive_layout,vehicle.vehicle_type,vehicle.vehicle_class].filter(Boolean).join(' ').toLowerCase();return {method:'VEHICLE IDENTITY → ARCHITECTURE → SYMPTOM → CONDITION → DIFFERENTIAL HYPOTHESES → EVIDENCE → TEST → RESULT → ROOT CAUSE → REPAIR/MODIFICATION → VALIDATION',safety:hypotheses.some(x=>/Brake|Cooling|EV|HV/i.test(x.system))?'CAUTION':'NORMAL',vehicleArchitecture:arch||'unknown',evidenceStatus:'insufficient_until_tested',hypotheses,missingData:['vehicle type/class','year/model/variant','propulsion/engine type','transmission/drive architecture','odometer','maintenance/modification history','cold/hot condition','RPM/speed/load/throttle or accelerator data','DTC/live data where applicable']};};
NS.buildDiagnosticTestCards=(diagnosis)=>{const out=[];(diagnosis?.hypotheses||[]).forEach(h=>(h.tests||[]).forEach(t=>out.push({hypothesis:h.system,test_name:t,expected_result:null,actual_result:null,status:'planned'})));return out;};
NS.buildExpertPrompt=(caseData={},vehicle={},context={})=>{
 const d=NS.diagnose(caseData.symptom||caseData.title||'',caseData.conditions||'',vehicle);
 const clean={vehicle,case:caseData,context,diagnosticFramework:d};
 return `VEHICLE LIFEBOOK — UNIVERSAL AUTOMOTIVE MASTER INTELLIGENCE

ROLE
Act as a multidisciplinary automotive master technician, diagnostic engineer and vehicle systems specialist. Cover motorcycles, scooters, passenger cars, commercial vehicles, trucks, buses, trailers/semitrailers, ICE, diesel, hybrid, PHEV, BEV, MT, AT, CVT, DCT, AMT and other architectures.

MISSION
Produce a technically defensible diagnostic plan from the supplied evidence. Do not pretend a hypothesis is a confirmed fault.

MANDATORY REASONING
VEHICLE IDENTITY → ARCHITECTURE → SYMPTOM → CONDITION → DIFFERENTIAL DIAGNOSIS → EVIDENCE REQUIRED → TEST → MEASUREMENT → RESULT → ROOT CAUSE → REPAIR/ADJUSTMENT/MODIFICATION → VALIDATION.

EVIDENCE LABELS
[FACT] [OEM VERIFIED] [SOURCED] [ENGINEERING INFERENCE] [ESTIMATE] [HYPOTHESIS] [UNKNOWN]

ANTI-HALLUCINATION
Never invent OEM specifications, torque values, fluid specs, service intervals, part numbers, DTC meanings, sensor thresholds, wiring, maintenance history, prices or vehicle data. If missing, mark UNKNOWN and state what evidence is required.

DIAGNOSTIC RULES
- Generate multiple plausible hypotheses when appropriate.
- Explain why each hypothesis is plausible.
- State evidence that would support or contradict it.
- Prefer safe, non-invasive, high-information tests first.
- Never recommend replacing a part merely because it is commonly associated with a symptom.
- Do not recommend a performance modification as a cure before baseline diagnosis.
- Respect vehicle-specific safety procedures, especially HV, brakes, fuel pressure, lifting, rotating components and thermal hazards.
- When OEM/model-specific data is required, request or verify the exact vehicle/market/variant before treating it as specification.

OUTPUT
1. Case understanding
2. Vehicle architecture
3. Missing information
4. Differential hypotheses
5. Evidence required
6. Diagnostic test sequence
7. Expected result + interpretation for each test
8. Root-cause decision tree
9. Repair/maintenance options only after evidence
10. Modification options separately, with compatibility/risk/validation
11. Validation procedure
12. Uncertainty and assumptions

VEHICLE LIFEBOOK DATA
${JSON.stringify(clean,null,2)}

Do not give a generic parts-shopping answer. Think like a diagnostic professional and show the reasoning path without claiming certainty beyond the evidence.`;
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
 <div class="row" style="margin-top:8px"><button class="btn gray" id="loadVerifiedSpecs">🔎 Muat OEM/Verified Specs</button><span id="specStatus" class="small muted">Belum dimuat</span></div><div id="engFields"></div><div class="small muted" style="margin-top:8px">⚠️ Input yang berasal dari sumber terverifikasi akan ditandai. Parameter kritis yang belum verified tidak boleh diperlakukan sebagai spesifikasi assembly.</div>
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
 m.querySelector('#loadVerifiedSpecs').onclick=async()=>{
  try{
   m.querySelector('#specStatus').textContent='Mencari data tersimpan…';
   const ctx=await loadVehicleVerifiedSpecs(vehicle);
   const specs=ctx?.specs||[];
   const map={bore_mm:'coldBoreMm',cylinder_bore_mm:'coldBoreMm',piston_diameter_mm:'coldPistonMm',ring_end_gap_mm:'coldGapMm',ring_diameter_mm:'ringDiameterMm',rod_length_mm:'rodLengthMm',stroke_mm:'strokeMm'};
   const selected={};
   specs.forEach(s=>{if(map[s.spec_key] && (s.verification_status==='verified'||s.verification_status==='corroborated')) selected[map[s.spec_key]]=s.value});
   render();
   Object.entries(selected).forEach(([k,v])=>{const el=m.querySelector('#e_'+k);if(el&&typeof v!=='object')el.value=String(v).replace(/[^0-9.\\-]/g,'').split('-')[0]});
   const verified=specs.filter(s=>s.verification_status==='verified').length;
   m.querySelector('#specStatus').textContent=specs.length+' spec ditemukan · '+verified+' verified';
  }catch(e){m.querySelector('#specStatus').textContent='Gagal: '+e.message}
 };
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
 <div id="modCompatOut" class="card" style="box-shadow:none;margin-top:10px;background:#f8fafc">Belum dilakukan compatibility gate.</div>
 <div class="row" style="margin-top:10px"><button class="btn gray" id="checkModCompat">🔎 Check Compatibility</button><button class="btn primary" id="saveMod" style="flex:1">Simpan Modification Record</button></div>`);
 m.querySelector('[data-close]').onclick=()=>m.remove();
 m.querySelector('#checkModCompat').onclick=async()=>{
  try{
    let baseline={};try{baseline=JSON.parse(m.querySelector('#modBase').value||'{}')}catch{throw Error('Baseline JSON tidak valid')}
    const ctx=await loadVehicleVerifiedSpecs(vehicle);const result=NS.oem.evaluateModificationCompatibility(vehicle,{system:m.querySelector('#modSystem').value.trim(),title:m.querySelector('#modTitle').value.trim(),baseline,target_effect:m.querySelector('#modTarget').value.trim()},ctx?.specs||[]);
    m.querySelector('#modCompatOut').textContent=JSON.stringify(result,null,2);
  }catch(e){m.querySelector('#modCompatOut').textContent='ERROR: '+e.message}
};
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
 <button class="card" id="hubExpertPrompt" style="text-align:left"><strong>🧠 Universal Engineering Mission</strong><div class="small muted">Goal → OEM baseline → evidence → engineering → validation</div></button>
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
 m.querySelector('#hubExpertPrompt').onclick=()=>{m.remove();openUniversalExpertPrompt(v)};
}

async function openUniversalExpertPrompt(vehicle){
 const m=modal(`<div class="row between"><div><h3>🧠 Universal Engineering Mission</h3><div class="small muted">Goal → OEM baseline → evidence → engineering → validation</div></div><button class="btn gray" data-close>✕</button></div>
 <div class="field"><label>Mission / tujuan *</label><textarea id="expertQuestion" rows="7" placeholder="Contoh: Honda BeAT standard 110 cc mau gue modif jadi 250 cc untuk race."></textarea></div>
 <div class="two"><div class="field"><label>Make</label><input id="expertMake" value="${esc0(vehicle.brand||vehicle.make||'')}"></div>
 <div class="field"><label>Model</label><input id="expertModel" value="${esc0(vehicle.model||'')}"></div>
 <div class="field"><label>Year</label><input id="expertYear" value="${esc0(vehicle.year||'')}"></div>
 <div class="field"><label>Variant</label><input id="expertVariant" value="${esc0(vehicle.variant||'')}"></div>
 <div class="field"><label>Engine Code</label><input id="expertEngine" value="${esc0(vehicle.engine_code||'')}"></div>
 <div class="field"><label>VIN</label><input id="expertVin" value="${esc0(vehicle.vin||'')}"></div></div>
 <div class="row"><button class="btn primary" id="buildExpertPrompt">⚡ Build Mission</button><button class="btn" id="liveOem">🌐 Retrieve OEM Live</button><button class="btn ghost" id="copyExpertPrompt">📋 Copy</button></div><div class="field"><label>OEM URL (opsional, harus domain OEM terdaftar)</label><input id="expertSourceUrl" placeholder="https://..."></div>
 <div id="expertAnalysis" class="card" style="margin-top:10px;box-shadow:none"></div><textarea id="expertPromptOut" rows="20" style="width:100%;margin-top:10px;font-family:monospace"></textarea>`);
 m.querySelector('[data-close]').onclick=()=>m.remove(); let lastPrompt='';
 m.querySelector('#buildExpertPrompt').onclick=async()=>{
  try{const q=m.querySelector('#expertQuestion').value.trim();if(!q)throw Error('Mission wajib diisi');
   const v={...vehicle,brand:m.querySelector('#expertMake').value.trim()||vehicle.brand,model:m.querySelector('#expertModel').value.trim()||vehicle.model,year:m.querySelector('#expertYear').value.trim()||vehicle.year,variant:m.querySelector('#expertVariant').value.trim()||vehicle.variant,engine_code:m.querySelector('#expertEngine').value.trim()||vehicle.engine_code,vin:m.querySelector('#expertVin').value.trim()||vehicle.vin};
   let ctx=null;try{ctx=await loadVehicleVerifiedSpecs(v)}catch(_){}
   const mission=NS.oem.buildEngineeringMission(v,q,ctx);lastPrompt=NS.oem.buildEngineeringMissionPrompt(v,q,ctx);
   m.querySelector('#expertPromptOut').value=lastPrompt;
   const delta=mission.target.delta_cc==null?'UNKNOWN':((mission.target.delta_cc>=0?'+':'')+mission.target.delta_cc+' cc');
   m.querySelector('#expertAnalysis').innerHTML='<strong>Engineering Mission siap</strong><div class="small" style="margin-top:6px">'+esc0(mission.identity.make||'UNKNOWN')+' '+esc0(mission.identity.model||'UNKNOWN')+' · target '+esc0(mission.target.target_cc??'UNKNOWN')+' cc · Δ '+esc0(delta)+'</div><div class="small muted" style="margin-top:6px">Evidence field: '+mission.requiredEvidence.length+' · critical UNKNOWN: '+mission.criticalUnknowns.length+'</div><div class="small muted" style="margin-top:6px">Gate: OEM baseline wajib dikunci sebelum kalkulasi/modifikasi.</div>';
   try{if(state?.sb?.from&&v.id)await state.sb.from('vehicle_spec_requests').insert({vehicle_id:v.id,requested_specs:mission.requiredEvidence,source_policy:'official_first/critical_requires_verified/never_guess',generated_prompt:lastPrompt,status:'pending',created_by:state.user?.id||null});}catch(_){}
  }catch(e){toast0('Mission gagal: '+e.message)}
 };
  m.querySelector('#liveOem').onclick=async()=>{try{const q=m.querySelector('#expertQuestion').value.trim();if(!q)return toast0('Isi mission dulu');const v={...vehicle,brand:m.querySelector('#expertMake').value.trim()||vehicle.brand,model:m.querySelector('#expertModel').value.trim()||vehicle.model,year:m.querySelector('#expertYear').value.trim()||vehicle.year,variant:m.querySelector('#expertVariant').value.trim()||vehicle.variant,engine_code:m.querySelector('#expertEngine').value.trim()||vehicle.engine_code,vin:m.querySelector('#expertVin').value.trim()||vehicle.vin};const d=await runLiveOemRetrieval(v,{question:q,sourceUrl:m.querySelector('#expertSourceUrl').value.trim(),maxPages:6});const n=(d.extracted_claims||[]).length;m.querySelector('#expertAnalysis').innerHTML='<strong>🌐 OEM Retrieval selesai</strong><div class="small" style="margin-top:6px">Pages: '+(d.pages||[]).length+' · extracted claims: '+n+'</div><div class="small muted" style="margin-top:6px">Data disimpan sebagai candidate/unverified. Belum boleh dipromosikan menjadi VERIFIED tanpa applicability + verification.</div>';toast0('OEM retrieval selesai: '+n+' claims');}catch(e){toast0('OEM retrieval gagal: '+e.message)}};
m.querySelector('#copyExpertPrompt').onclick=async()=>{if(!lastPrompt)return toast0('Build Mission dulu');try{await navigator.clipboard.writeText(lastPrompt);toast0('Mission prompt berhasil dicopy')}catch{m.querySelector('#expertPromptOut').select();document.execCommand('copy');toast0('Mission prompt berhasil dicopy')}};
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
  version:'3.0.0',
  criticalKeys:['displacement_cc','bore_mm','stroke_mm','compression_ratio','piston_diameter_mm','cylinder_bore_mm','connecting_rod_length_mm','rod_length_mm','deck_height_mm','ring_end_gap_mm','piston_to_wall_clearance_mm','valve_to_piston_clearance_mm','bearing_clearance_mm','cam_timing_deg','injector_flow','fuel_pressure','oil_pressure','service_interval_km','service_interval_months'],
  domainMap:{
    displacement:['displacement_cc','bore_mm','stroke_mm','compression_ratio','cylinders'],
    engine_build:['displacement_cc','bore_mm','stroke_mm','compression_ratio','piston_diameter_mm','cylinder_bore_mm','rod_length_mm','deck_height_mm','ring_end_gap_mm','piston_to_wall_clearance_mm','valve_to_piston_clearance_mm','bearing_clearance_mm','cam_timing_deg','fuel_pressure','oil_pressure'],
    fuel:['fuel_type','fuel_system','injector_flow','fuel_pressure','throttle_body','fuel_pump'],
    cooling:['cooling_system','coolant_capacity','thermostat','fan_control','operating_temperature'],
    lubrication:['oil_specification','oil_capacity','oil_pressure','service_interval_km','service_interval_months'],
    cvt:['transmission_type','gear_ratio','final_drive_ratio','belt_spec','roller_spec','clutch_spec'],
    drivetrain:['transmission_type','gear_ratio','final_drive_ratio','clutch_spec','differential_spec','drive_layout'],
    chassis:['frame_type','wheelbase_mm','curb_weight_kg','front_suspension','rear_suspension','tire_size','brake_spec'],
    brake:['front_brake','rear_brake','abs_type','brake_disc_size','brake_fluid'],
    suspension:['front_suspension','rear_suspension','spring_rate','shock_spec','wheel_travel'],
    ev:['battery_capacity_kwh','usable_battery_kwh','system_voltage_v','motor_peak_kw','motor_torque_nm','charger_spec','bms_limits','thermal_management'],
    hybrid:['engine_type','battery_capacity_kwh','system_voltage_v','motor_peak_kw','hybrid_architecture','fuel_system','cooling_system'],
    electrical:['battery_voltage','alternator_output','charging_system','fuse_rating','ecu_type','wiring_spec'],
    diagnostics:['dtc','freeze_frame','live_data','service_limits','test_procedure'],
    maintenance:['service_interval_km','service_interval_months','fluid_specification','fluid_capacity','wear_limit','replacement_interval'],
    modification:['baseline_specs','compatibility','dimensions','load','thermal_limit','electrical_limit','ecu_calibration','brake_capacity','chassis_capacity','validation_limits']
  },
  isCritical(key){return this.criticalKeys.includes(String(key||'').toLowerCase())},
  classifyQuestion(question=''){
    const q=String(question||'').toLowerCase();
    const domains=[];
    const add=(d,re)=>{if(re.test(q)&&!domains.includes(d))domains.push(d)};
    add('engine_build',/bore.?up|stroker|cc|cc.?jadi|kapasitas|piston|seher|kruk.?as|crank|connecting rod|stang seher|kompresi|compression|cam|noken|klep|valve|porting|head|turbo|supercharger|race|racing|power|tenaga|torsi|torque/);
    add('fuel',/injector|injektor|fuel|bensin|bbm|throttle body|tb|pompa bensin|fuel pump|afr|lambda|mixture/);
    add('cooling',/overheat|panas|coolant|radiator|thermostat|kipas|fan|temperature|temperatur/);
    add('lubrication',/oli|oil|oil pressure|tekanan oli|pelumas|bearing|clearance/);
    add('cvt',/cvt|roller|variator|v.?belt|belt|kampas ganda|clutch|kopling sentrifugal/);
    add('drivetrain',/transmisi|gear|rasio|final drive|differential|kopling|clutch|drivetrain/);
    add('chassis',/rangka|frame|wheelbase|berat|ban|tire|roda|wheel|chassis/);
    add('brake',/rem|brake|abs|disc|cakram|master|kaliper|caliper/);
    add('suspension',/suspensi|suspension|shock|fork|pegas|spring/);
    add('ev',/motor listrik|electric motor|ev|bev|baterai|battery|soc|soh|inverter|bms|high voltage|hv|charging|charger|kwh/);
    add('hybrid',/hybrid|phev/);
    add('electrical',/aki|battery 12v|alternator|kelistrikan|ecu|wiring|sekering|fuse|tegangan|voltage/);
    add('diagnostics',/diagnosa|diagnostic|diagnosis|error|dtc|check engine|brebet|misfire|susah hidup|mogok|gejala|problem|masalah|rusak/);
    add('maintenance',/service|servis|maintenance|interval|jadwal|ganti oli|wear limit|batas aus/);
    add('modification',/modif|modifikasi|upgrade|ubah|convert|konversi|swap|custom|build|racing|race/);
    if(!domains.length)domains.push('diagnostics');
    const vehicleType=/motor listrik|electric motorcycle|scooter listrik|bev|ev|baterai|inverter|bms/.test(q)?'ev':/mobil|sedan|suv|mpv|pickup|truck|truk|car/.test(q)?'car':/motor|matic|skutik|scooter|manual|bebek|sportbike|naked|supersport/.test(q)?'motorcycle':'unknown';
    const requested=[...new Set(domains.flatMap(d=>this.domainMap[d]||[]))];
    return {vehicleType,domains,requestedSpecs:requested};
  },
  isCritical(key){return this.criticalKeys.includes(String(key||'').toLowerCase())},
  buildResearchPrompt(vehicle,missing=[],question=''){
    const v=vehicle||{}, analysis=this.classifyQuestion(question), requested=[...new Set([...(missing||[]),...analysis.requestedSpecs])];
    const identity={make:v.brand||v.make||null,model:v.model||null,year:v.year||null,variant:v.variant||null,engine_code:v.engine_code||v.engineCode||null,vin:v.vin||null,vehicle_type:analysis.vehicleType};
    return [
      'VEHICLE LIFEBOOK — UNIVERSAL AUTOMOTIVE EXPERT RESEARCH PROMPT v3',
      'ROLE: Act as a senior automotive engineering expert covering ICE, motorcycle/scooter manual & CVT, passenger/commercial vehicles, hybrid, PHEV and BEV/EV.',
      'TASK: Analyze the USER QUESTION only after establishing the exact vehicle identity and an evidence-backed technical baseline.',
      'VEHICLE_IDENTITY='+JSON.stringify(identity),
      'USER_QUESTION='+JSON.stringify(String(question||'')),
      'QUESTION_CLASSIFICATION='+JSON.stringify({vehicleType:analysis.vehicleType,domains:analysis.domains}),
      'REQUIRED_DATA='+JSON.stringify(requested),
      'SOURCE PRIORITY: 1) OEM/manufacturer official specification, service/repair manual, parts catalogue, VIN/spec lookup, TSB/technical bulletin; 2) authorized manufacturer/dealer technical documentation; 3) reputable secondary source only for corroboration.',
      'VERIFICATION: Every numeric/technical claim must include publisher, source title, URL/document reference, revision/date when available, applicability (model/year/variant/engine), retrieval date and verification_status.',
      'NEVER GUESS. If authoritative evidence is unavailable or conflicting, output UNKNOWN or CONFLICT instead of inventing a value.',
      'CRITICAL RULE: Bore, stroke, piston diameter, cylinder bore, rod length, deck height, ring gap, piston-to-wall, valve-to-piston, bearing clearance, torque specs and service limits are assembly/safety-critical. Do not promote secondary estimates to VERIFIED.',
      'DISTINGUISH: OEM nominal specification vs measured value vs aftermarket component specification vs service limit vs modification target.',
      'CONFLICT RULE: Do not average conflicting specifications. Preserve each source, determine applicability/revision, and report the unresolved conflict when it cannot be resolved.',
      'ENGINEERING RULE: Separate OEM BASELINE from MODIFIED STATE. For modification analysis, calculate from verified inputs and explicitly list every assumption and unknown.',
      'SAFETY RULE: For brakes, steering, chassis, HV/EV systems, fuel pressure, thermal limits and engine assembly, provide test/validation requirements and do not claim safety without evidence.',
      'OUTPUT: vehicle_identity, question_analysis, verified_baseline, corroborated_data, unknown_data, conflicts, sources, calculations, modification_compatibility, risks, test_plan, validation_criteria, final_answer.',
      'Return concise evidence-backed reasoning; do not fabricate citations or URLs.'
    ].join('\n');
  },
  missionClassify(question=''){
    const q=String(question||'').toLowerCase();
    const cc=[...q.matchAll(/(\d+(?:[.,]\d+)?)\s*cc\b/gi)].map(x=>Number(x[1].replace(',','.')));
    const tm=q.match(/(?:jadi|ke|menjadi|target|hingga|sampai)\s*(\d+(?:[.,]\d+)?)\s*cc\b/i);
    const target=tm?Number(tm[1].replace(',','.')):(cc.length>1?cc[cc.length-1]:null);
    const domains=[];
    const add=(d,re)=>{if(re.test(q)&&!domains.includes(d))domains.push(d)};
    add('engine',/cc|bore|stroke|piston|seher|kruk|crank|rod|kompresi|compression|cam|noken|klep|valve|power|tenaga|torsi|torque/);
    add('fuel',/injector|injektor|fuel|bensin|throttle|afr|lambda|ecu/);
    add('cooling',/coolant|radiator|overheat|temperatur|thermostat|fan/);
    add('lubrication',/oli|oil|bearing|tekanan oli/);
    add('drivetrain',/cvt|roller|variator|belt|kopling|clutch|transmisi|gear|rasio/);
    add('chassis',/rangka|frame|ban|tire|roda|wheel|chassis/);
    add('brake',/rem|brake|abs|cakram|disc|kaliper|caliper/);
    add('suspension',/suspensi|shock|fork|pegas/);
    add('electrical',/aki|battery|alternator|wiring|fuse|voltage/);
    add('ev_hybrid',/ev|bev|hybrid|baterai|inverter|bms|motor listrik/);
    add('modification',/modif|modifikasi|upgrade|ubah|convert|konversi|swap|custom|build|racing|race/);
    if(!domains.length)domains.push('engine');
    return {domains,baselineCc:cc.length>1?cc[0]:null,targetCc:target,purpose:/drag/.test(q)?'drag':/race|racing|balap/.test(q)?'race':/endurance/.test(q)?'endurance':'unspecified',modificationRequested:/modif|modifikasi|upgrade|ubah|convert|konversi|swap|custom|build|racing|race/.test(q)};
  },
  buildEngineeringMission(vehicle,question,specContext){
    const g=this.missionClassify(question), specs=specContext?.specs||[];
    const required=[...new Set((g.domains||[]).flatMap(d=>this.domainMap[d]||this.domainMap[d==='engine'?'engine_build':d]||[]))];
    required.push('baseline_specs','target_configuration','compatibility','system_loads','thermal_limits','validation_limits');
    const verified=new Set(specs.filter(x=>x.verification_status==='verified').map(x=>x.spec_key));
    const criticalUnknowns=[...new Set(required.filter(k=>this.isCritical(k)&&!verified.has(k)))];
    const identity={make:vehicle?.brand||vehicle?.make||null,model:vehicle?.model||null,year:vehicle?.year||null,variant:vehicle?.variant||null,engine_code:vehicle?.engine_code||vehicle?.engineCode||null,vin:vehicle?.vin||null};
    return {version:'1.0.0',identity,goal:question,classification:g,target:{baseline_cc:g.baselineCc,target_cc:g.targetCc,delta_cc:g.baselineCc!=null&&g.targetCc!=null?g.targetCc-g.baselineCc:null,purpose:g.purpose},requiredEvidence:[...new Set(required)],criticalUnknowns,phases:['IDENTITY LOCK','OEM BASELINE','EVIDENCE RETRIEVAL','VERIFICATION','TARGET DEFINITION','ENGINEERING CALCULATION','COMPATIBILITY','RISK / FAILURE MODES','BUILD CONFIGURATION','TEST PLAN','ACCEPTANCE CRITERIA','VALIDATION'],sourcePolicy:{officialFirst:true,criticalRequiresVerified:true,neverGuess:true}};
  },
  buildEngineeringMissionPrompt(vehicle,question,specContext){
    const mission=this.buildEngineeringMission(vehicle,question,specContext);
    return ['VEHICLE LIFEBOOK — UNIVERSAL AUTOMOTIVE ENGINEERING MISSION v1','MISSION='+JSON.stringify(mission),'Do NOT jump directly to modification advice. First lock exact vehicle identity and establish the evidence-backed OEM baseline.','SOURCE ORDER: OEM official specification → OEM service/repair manual → OEM parts catalogue → OEM TSB/technical document → authorized technical documentation → reputable secondary cross-check.','Every technical/numeric claim must include source title, publisher, URL/document reference, revision/date when available, exact applicability, retrieval date and verification status.','NEVER GUESS. Missing or unverified critical inputs are UNKNOWN and block that calculation.','Separate OEM nominal, measured value, aftermarket component specification, service limit and modification target. Never average conflicting specifications.','Separate OEM BASELINE from TARGET/MODIFIED STATE. Calculate only from verified/measured inputs; show formulas, units, assumptions and provenance.','Check geometry/interfaces, loads, thermal, lubrication, fuel/air, ECU, electrical, drivetrain, brake, chassis and use-case implications.','Output: identity, OEM evidence matrix, verified baseline, unknowns/conflicts, target state, calculations, compatibility, system impacts, risks, build/measurement plan, test plan, acceptance criteria, validation and evidence-backed conclusion.','If evidence is insufficient, state UNKNOWN/NOT VERIFIED and specify exactly what evidence or measurement is required.'].join('\\n');
  },
  buildExpertPrompt(vehicle,question,specContext){
    const ctx=specContext||{}, specs=ctx.specs||[];
    const base=this.buildResearchPrompt(vehicle,[],question);
    return base+'\nSTORED_VERIFIED_CONTEXT='+JSON.stringify(specs)+'\n'+
      'CONTEXT RULE: Stored VERIFIED evidence may be reused only when applicability matches the exact vehicle. CORROBORATED data must remain labeled corroborated. Missing critical data blocks that calculation until sourced.';
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


NS.oem.evaluateModificationCompatibility=(vehicle,modification,verifiedSpecs=[])=>{
  const required=['dimensions','load','thermal_limit','electrical_limit','brake_capacity','chassis_capacity'];
  const text=JSON.stringify(modification||{}).toLowerCase();
  const systems=String(modification?.system||'').toLowerCase();
  const critical=verifiedSpecs.filter(s=>s.verification_status==='verified');
  const missing=required.filter(k=>{
    const hit=verifiedSpecs.some(s=>String(s.spec_key||'').toLowerCase().includes(k));
    return !hit && /engine|cvt|drivetrain|brake|suspension|ev|electrical|chassis/.test(systems);
  });
  const impacts=[];
  if(/engine|cvt|drivetrain/.test(systems)) impacts.push('drivetrain','thermal','fuel/electrical','brake/chassis');
  if(/brake/.test(systems)) impacts.push('hydraulic','thermal','tire/chassis');
  if(/suspension|chassis/.test(systems)) impacts.push('geometry','load','tire/brake');
  if(/ev|electrical/.test(systems)) impacts.push('voltage','current','thermal','BMS/ECU');
  if(!impacts.length) impacts.push('interface','load','thermal','validation');
  const blockers=missing.length?missing.map(x=>'Missing verified evidence: '+x):[];
  const status=blockers.length?'blocked':'requires_validation';
  return {status,compatibility_status:status,vehicle_id:vehicle?.id||null,system:modification?.system||null,impacts:[...new Set(impacts)],required_evidence:required,verified_evidence_count:critical.length,blockers,ruleVersion:'compatibility-gate-v1',never_guess:true};
};

async function runLiveOemRetrieval(vehicle,{question='',sourceUrl='',maxPages=6}={}){
  if(!vehicle||!state?.sb) throw Error('Vehicle/Supabase belum siap');
  const payload={vehicle:{id:vehicle.id,brand:vehicle.brand||vehicle.make,model:vehicle.model,year:vehicle.year,variant:vehicle.variant,engine_code:vehicle.engine_code||vehicle.engineCode,vin:vehicle.vin},question,max_pages:maxPages};
  if(sourceUrl)payload.source_url=sourceUrl;
  const {data,error}=await state.sb.functions.invoke('oem-retrieval-gateway',{body:payload});
  if(error)throw error;
  if(!data?.ok)throw Error(data?.error||'OEM gateway gagal');
  try{
    const pages=data.pages||[], claims=data.extracted_claims||[];
    const runInsert=await state.sb.from('oem_retrieval_runs').insert({vehicle_id:vehicle.id,requested_specs:[],source_policy:data.policy||{},status:'partial',sources:pages,extracted_claims:claims,errors:[],started_at:data.retrieved_at,completed_at:new Date().toISOString(),created_by:state.user?.id||null}).select('id').single();
    if(runInsert.error)console.warn('oem_retrieval_runs persist:',runInsert.error);
    for(const p of pages.filter(x=>x.finalUrl||x.url).slice(0,20)){
      const isPdf=!!p.pdf||/pdf/i.test(String(p.content_type||''));
      const src={source_type:isPdf?'oem_pdf':'oem_web',source_format:isPdf?'pdf':'web',title:String(p.finalUrl||p.url),publisher:vehicle.brand||vehicle.make,manufacturer:vehicle.brand||vehicle.make,model_scope:vehicle.model||null,engine_scope:vehicle.engine_code||null,revision:String(vehicle.year||''),url:p.finalUrl||p.url,document_ref:isPdf?String(p.finalUrl||p.url):null,trust_level:'official_candidate',retrieved_at:data.retrieved_at,content_hash:null,metadata:{gateway_score:p.score||0,content_type:p.content_type||null,pdf:isPdf,num_pages:p.num_pages||null,parse_quality:p.parse_quality||null}};
      const sr=await state.sb.from('technical_sources').insert(src).select('id').single();
      if(!sr.error&&sr.data?.id){
        const pc=claims.filter(x=>(x.source_url===p.finalUrl||x.source_url===p.url)).slice(0,100);
        if(pc.length) {
          const cr=await state.sb.from('technical_claims').insert(pc.map(x=>({source_id:sr.data.id,vehicle_id:vehicle.id,claim:String(x.field),canonical_key:x.canonical_key||String(x.field||'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),value:{value:x.value,extraction:x.extraction,source_score:x.source_score},unit:x.unit||null,raw_text:x.raw_text||null,source_page:Number(x.page)||null,source_format:x.source_format|| (isPdf?'pdf':'web'),applicability:{make:vehicle.brand||vehicle.make,model:vehicle.model,year:vehicle.year,variant:vehicle.variant,engine_code:vehicle.engine_code||null,vin:vehicle.vin||null},confidence:Math.min(0.99,Math.max(0.1,(Number(x.source_score)||0)/100)),verification_status:'unverified',created_by:state.user?.id||null})));
          if(cr.error)console.warn('technical_claims persist:',cr.error);
        }
      }
    }
    try{
      const rr=await state.sb.rpc('resolve_oem_claims',{p_vehicle_id:vehicle.id});
      if(rr.error)console.warn('OEM normalization:',rr.error); else data.normalization=rr.data;
    }catch(e){console.warn('OEM normalization:',e)}
  }catch(e){console.warn('OEM evidence persistence:',e)}
  return data;
}
NS.runLiveOemRetrieval=runLiveOemRetrieval;

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
