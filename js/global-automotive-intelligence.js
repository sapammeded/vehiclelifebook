/* Vehicle Lifebook — Global Automotive Intelligence Engine
 * Vehicle-agnostic: motorcycle, car, truck, bus, ICE, hybrid, PHEV, EV.
 * Evidence-first. No guessed compatibility or specifications.
 */
(function(){
'use strict';
const norm=v=>String(v??'').trim();
const partNo=v=>norm(v).toUpperCase().replace(/[^A-Z0-9]/g,'');

const DOMAIN_RULES={
 engine:['displacement','bore','stroke','compression_ratio','bore_stroke','valve_clearance','oil_capacity','oil_pressure','cooling_capacity'],
 fuel:['fuel_type','fuel_pressure','injector','throttle_body','fuel_pump','fuel_tank'],
 ignition:['spark_plug','plug_gap','ignition_timing','coil'],
 drivetrain:['transmission_type','gear_ratio','final_drive','clutch','torque_capacity'],
 cvt:['roller_weight','roller_part_number','variator','belt','clutch','drive_face','driven_face','spring'],
 brake:['disc_diameter','pad','caliper','master_cylinder','brake_fluid','abs'],
 suspension:['fork','shock','spring_rate','damping','travel','ride_height','geometry'],
 electrical:['battery_voltage','battery_capacity','alternator','stator','fuse','ecu','can','lin'],
 ev:['battery_pack','cell','soc','soh','inverter','motor','dc_dc','charger','thermal_management'],
 chassis:['wheelbase','rake','trail','track_width','curb_weight','axle_load','mounting'],
 tyres:['tyre_size','load_rating','speed_rating','pressure','wheel_size'],
 thermal:['coolant_capacity','coolant_type','oil_temperature','thermal_limit'],
 maintenance:['service_interval','fluid','filter','belt_interval','inspection_interval'],
 diagnostics:['dtc','freeze_frame','sensor_range','actuator_test','reference_voltage'],
 modification:['dimensions','interface','clearance','load_rating','thermal_limit','electrical_limit','calibration','compatibility']
};

function classify(question){
 const q=norm(question).toLowerCase(),domains=[];
 const map={
  engine:/engine|mesin|bore|stroke|piston|cam|valve|head|compression|cc\b/,
  fuel:/fuel|bbm|injector|throttle|afr|lambda/,
  ignition:/ignition|busi|spark|coil/,
  drivetrain:/transmission|gearbox|clutch|dct|automatic|manual|differential|drivetrain/,
  cvt:/cvt|roller|variator|pulley|belt|contra|torque spring/,
  brake:/brake|rem|abs|caliper|disc|pad/,
  suspension:/suspension|shock|fork|spring|suspensi/,
  electrical:/electrical|ecu|tcu|can\b|lin\b|battery|wiring|sensor/,
  ev:/ev\b|bev|phev|hybrid|inverter|bms|motor listrik|high voltage/,
  chassis:/chassis|frame|sasis|rake|trail|wheelbase|geometry/,
  tyres:/tyre|tire|ban|wheel|rim/,
  thermal:/cooling|coolant|radiator|temperature|thermal|overheat/,
  maintenance:/service|maintenance|servis|perawatan/,
  diagnostics:/diagnos|dtc|error code|fault|misfire|mogok/,
  modification:/modif|upgrade|bore up|tuning|race|racing|swap|ganti part/
 };
 for(const [d,re] of Object.entries(map))if(re.test(q))domains.push(d);
 const m=q.match(/(?:jadi|ke|target|naik|turun)[^\d]{0,12}(\d{2,5})\s*cc/);
 const p=q.match(/\b[A-Z]{1,5}[- ]?\d{2,6}[- ]?[A-Z0-9-]{2,8}\b/i);
 return {domains:[...new Set(domains)].length?[...new Set(domains)]:['general'],targetCc:m?Number(m[1]):null,requestedPartNumber:partNo(p?p[0]:'')};
}

function buildMission(vehicle,question){
 const c=classify(question),domains=c.domains.filter(x=>x!=='general');
 const required=[...new Set(domains.flatMap(d=>DOMAIN_RULES[d]||[]))];
 const critical=required.filter(x=>['dimensions','interface','clearance','load_rating','thermal_limit','electrical_limit','calibration','compatibility','roller_weight','roller_part_number'].includes(x));
 return {
  vehicle:{id:vehicle?.id||null,make:vehicle?.brand||vehicle?.make||null,model:vehicle?.model||null,variant:vehicle?.variant||null,year:vehicle?.year||null,vehicle_type:vehicle?.vehicle_type||null,vin_or_frame:vehicle?.chassis_number||vehicle?.vin||null,engine_number:vehicle?.engine_number||null,engine_code:vehicle?.metadata?.engine_code||vehicle?.engine_code||null},
  question:norm(question),domains:domains.length?domains:['general'],target:{displacement_cc:c.targetCc},
  required_evidence:required,critical_evidence:critical,
  pipeline:['IDENTITY','OEM BASELINE','TARGET','DATA MATRIX','PRIMARY SOURCE RETRIEVAL','NORMALIZE','VERIFY','CONFLICT RESOLUTION','CALCULATE','COMPATIBILITY','RISK','BUILD','TEST','VALIDATE'],
  source_policy:{official_first:true,primary_source_required_for_critical:true,secondary_sources_cross_check_only:true,never_guess:true}
 };
}

function buildPrompt(vehicle,question,mission){
 const m=mission||buildMission(vehicle,question);
 return [
 'VEHICLE LIFEBOOK — GLOBAL AUTOMOTIVE ENGINEERING MISSION','',
 'OBJECTIVE','Produce an evidence-backed engineering answer for the exact vehicle. This is not a generic automotive answer.','',
 'VEHICLE IDENTITY',JSON.stringify(m.vehicle,null,2),'',
 'OWNER GOAL',norm(question),'',
 'REQUIRED EVIDENCE',JSON.stringify(m.required_evidence),'',
 'CRITICAL EVIDENCE',JSON.stringify(m.critical_evidence),'',
 'EXECUTION PIPELINE',m.pipeline.join(' → '),'',
 'NON-NEGOTIABLE RULES',
 '1. Identify exact make/model/year/variant/market and VIN/frame/engine/type when available.',
 '2. OEM official model/spec/manual/parts catalogue/service/TSB/VIN data first.',
 '3. Never invent a specification, dimension, torque, clearance, part number, mass, compatibility or performance result.',
 '4. Same engine family, same cc, same platform or physically installable part is NOT proof of compatibility.',
 '5. For cross-model parts, prove fitment through exact OEM part number or explicit applicability/interchange evidence before calling it compatible.',
 '6. Distinguish FACT, VERIFIED, CORROBORATED, CANDIDATE, UNKNOWN and CONFLICT.',
 '7. If a critical input is unknown, stop the affected calculation and state exactly what evidence/measurement is required.',
 '8. Separate OEM baseline from proposed modification.',
 '9. Calculate engineering effects only from verified inputs and show assumptions.',
 '10. Finish with risks, test procedure, acceptance criteria and validation data required.','',
 'OUTPUT','A. EXACT VEHICLE IDENTITY','B. OEM BASELINE WITH SOURCE','C. TARGET STATE','D. EVIDENCE GAPS / CONFLICTS',
 'E. ENGINEERING CALCULATIONS','F. PARTS / COMPATIBILITY MATRIX','G. RISKS & FAILURE MODES','H. BUILD / REPAIR CONFIGURATION',
 'I. TEST PLAN','J. ACCEPTANCE CRITERIA','K. VALIDATION RESULT','',
 'If evidence is insufficient, say UNKNOWN — REQUIRES VERIFICATION. Do not fill the gap with a guess.'
 ].join('\n');
}

function assessInterchange(a,b){
 const A=a||{},B=b||{};
 const exactPart=!!partNo(A.part_number)&&partNo(A.part_number)===partNo(B.part_number);
 const sameVehicle=norm(A.make).toLowerCase()===norm(B.make).toLowerCase()&&norm(A.model).toLowerCase()===norm(B.model).toLowerCase()&&String(A.year||'')===String(B.year||'');
 const explicit=Boolean(A.explicit_fitment||B.explicit_fitment),dimensions=Boolean(A.same_dimensions),iface=Boolean(A.same_interface),load=Boolean(A.same_load_rating);
 let status='insufficient_evidence',reason='No sufficient fitment evidence.';
 if(exactPart){status='shared_oem_part';reason='Exact normalized OEM part number matches.'}
 else if(explicit&&dimensions&&iface&&load){status='conditionally_compatible';reason='Explicit fitment plus required interface/load evidence supplied.'}
 else if(explicit){status='conditionally_compatible';reason='Explicit fitment exists, but engineering interface evidence is incomplete.'}
 else if(sameVehicle){status='same_vehicle_candidate';reason='Same vehicle identity; still requires exact applicability.'}
 return {status,reason,evidence:{exact_oem_part_number:exactPart,explicit_fitment:explicit,same_dimensions:dimensions,same_interface:iface,same_load_rating:load},never_guess:true};
}

async function queryParts({supabase,vehicle,query='',partNumber='',component=''}={}){
 if(!supabase)throw new Error('Supabase belum siap');
 if(!vehicle?.id)throw new Error('Pilih kendaraan dulu');
 const {data,error}=await supabase.rpc('get_vehicle_part_intelligence',{p_vehicle_id:vehicle.id,p_query:norm(query),p_part_number:partNo(partNumber),p_component:component||null});
 if(error)throw error;
 return data||{matches:[],relations:[],rules:{}};
}

function renderPartResults(data,escFn){
 const esc=escFn||((x)=>String(x??'')),matches=Array.isArray(data?.matches)?data.matches:[],relations=Array.isArray(data?.relations)?data.relations:[];
 let h='';
 if(!matches.length)h+='<div class="empty">Belum ada part evidence yang cocok untuk kendaraan ini.</div>';
 matches.forEach(p=>{
  h+='<div class="card" style="box-shadow:none;margin-top:8px">';
  h+='<div class="row between"><strong>'+esc(p.part_number)+'</strong><span class="badge success">OEM EVIDENCE</span></div>';
  h+='<div style="margin-top:5px">'+esc(p.part_name||'')+'</div>';
  h+='<div class="small muted" style="margin-top:5px">'+esc([p.make,p.model,p.variant,p.year_from&&p.year_to?String(p.year_from)+'–'+p.year_to:'',p.market].filter(Boolean).join(' · '))+'</div>';
  h+='<div class="small" style="margin-top:6px">Source page: '+esc(p.source_page||'—')+' · applicability: '+esc(p.applicability_status||'documented')+'</div>';
  h+='</div>';
 });
 if(relations.length){
  h+='<div class="card" style="margin-top:10px;box-shadow:none;background:#f8fafc"><strong>🔗 OEM Part Interchange Evidence</strong>';
  relations.forEach(r=>{
    const verified=r.verification_status==='verified';
    h+='<div class="card" style="margin-top:8px;box-shadow:none"><div><strong>'+esc(r.from_part_number)+'</strong> ↔ <strong>'+esc(r.to_part_number)+'</strong></div><div class="small muted" style="margin-top:4px">'+esc(r.relation_type)+' · '+esc(r.verification_status)+' · confidence '+esc(Math.round(Number(r.confidence||0)*100))+'%</div><div class="small" style="margin-top:4px">'+esc(r.reason||'')+'</div></div>';
  });
  h+='<div class="small muted" style="margin-top:8px">STATUS = shared_oem_part berarti nomor part OEM yang sama ditemukan pada applicability model berbeda. Ini evidence interchange OEM, bukan izin mengganti varian tanpa verifikasi fitment lengkap.</div></div>';
 }
 return h;
}

window.VehicleLifebookGlobal={version:'global-automotive-v1',classify,buildMission,buildPrompt,assessInterchange,queryParts,renderPartResults,normalizePartNumber:partNo};
})();