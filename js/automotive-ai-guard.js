/* Vehicle Lifebook AI Guard v1 — universal intent/evidence/prompt hardening */
(function(){
'use strict';

const CORE=window.VehicleLifebookCore||{};
const GLOBAL=window.VehicleLifebookGlobal||{};

function norm(v){return String(v??'').trim().toLowerCase();}
function words(v){return norm(v).split(/[^a-z0-9]+/i).filter(Boolean);}
function hasAny(v, arr){
  const s=norm(v), ws=new Set(words(s));
  return arr.some(x=>{
    const t=norm(x);
    if(!t)return false;
    if(t.includes(' '))return s.includes(t);
    return ws.has(t);
  });
}

const ALIASES={
 scooter:['pcx','nmax','aerox','vario','scoopy','beat','adv','vespa','scooter','skutik','matic'],
 motorcycle:['motorcycle','sportbike','naked','cruiser','touring','adventure','dirtbike','underbone','bebek'],
 passenger:['sedan','hatchback','wagon','coupe','convertible','mpv','suv','crossover','passenger car'],
 commercial:['pickup','van','minivan','truck','truk','bus','coach','commercial'],
 heavy:['tractor','heavy equipment','construction','excavator','loader','bulldozer','grader','crane','agricultural'],
 ev:['bev','electric','motor listrik','battery electric','kendaraan listrik'],
 hybrid:['hybrid','phev'],
 propulsion:{
   gasoline:['gasoline','bensin','petrol','ice'],
   diesel:['diesel','solar'],
   bev:['bev','electric','motor listrik','battery electric','ev'],
   hybrid:['hybrid'],
   phev:['phev'],
   fuel_cell:['fuel cell','hydrogen fuel cell'],
   lpg:['lpg'],cng:['cng'],ethanol:['ethanol'],flex:['flex fuel']
 },
 transmission:{
   cvt:['cvt','continuously variable'],at:['at','automatic','automatic transmission'],
   mt:['mt','manual','manual transmission'],dct:['dct','dual clutch'],
   amt:['amt','automated manual','automated manual transmission'],
   powershift:['powershift'],hydrostatic:['hydrostatic'],
   ev:['single speed ev','reduction drive','electric reduction']
 }
};

function universalArchitecture(vehicle={}){
  const fields=[vehicle.brand,vehicle.make,vehicle.model,vehicle.variant,vehicle.vehicle_type,
    vehicle.vehicle_class,vehicle.body_type,vehicle.engine_type,vehicle.fuel_type,
    vehicle.transmission_type,vehicle.drive_layout].filter(Boolean).join(' ');
  let cls=norm(vehicle.vehicle_class||vehicle.vehicle_type);
  if(hasAny(fields,ALIASES.scooter))cls='scooter';
  else if(hasAny(fields,ALIASES.motorcycle))cls='motorcycle';
  else if(hasAny(fields,ALIASES.heavy))cls='heavy_equipment';
  else if(hasAny(fields,ALIASES.commercial))cls='commercial';
  else if(hasAny(fields,ALIASES.passenger))cls='passenger_car';
  if(!cls)cls='unknown';

  let propulsion=norm(vehicle.engine_type||vehicle.fuel_type);
  if(hasAny(fields,ALIASES.ev))propulsion='bev';
  else if(hasAny(fields,ALIASES.hybrid))propulsion=hasAny(fields,['phev'])?'phev':'hybrid';
  else {
    for(const [k,a] of Object.entries(ALIASES.propulsion)){
      if(hasAny(fields,a)){propulsion=k;break;}
    }
  }
  if(!propulsion)propulsion='unknown';

  let transmission=norm(vehicle.transmission_type);
  if(hasAny(transmission,ALIASES.transmission.dct))transmission='dct';
  else if(hasAny(transmission,ALIASES.transmission.amt))transmission='amt';
  else if(hasAny(transmission,ALIASES.transmission.cvt))transmission='cvt';
  else if(hasAny(transmission,ALIASES.transmission.powershift))transmission='powershift';
  else if(hasAny(transmission,ALIASES.transmission.hydrostatic))transmission='hydrostatic';
  else if(hasAny(transmission,ALIASES.transmission.ev))transmission='single_speed_ev';
  else if(hasAny(transmission,ALIASES.transmission.mt))transmission='mt';
  else if(hasAny(transmission,ALIASES.transmission.at))transmission='at';
  else if(hasAny(fields,['pcx','nmax','aerox','vario','scoopy','beat','adv','vespa','scooter','skutik','matic']))transmission='cvt';
  else transmission=transmission||'unknown';

  return {class:cls,propulsion,transmission,drive:vehicle.drive_layout||'unknown',universal:true,
    inference:'explicit_or_identity_inferred'};
}
CORE.universalArchitecture=universalArchitecture;
CORE.vehicleArchitecture=Object.assign({},CORE.vehicleArchitecture||{},{
  universal:true,
  matching:'token_safe',
  falsePositiveProtection:'enabled'
});

const INDICATORS=[
 ['electrical','battery',['battery','aki','baterai','charging','alternator','dc dc'],
  'Kategori peringatan baterai atau sistem pengisian. Simbol saja tidak membuktikan aki habis atau alternator rusak.',
  ['ukur tegangan sesuai prosedur OEM','periksa charging/DC-DC','periksa terminal dan ground','scan DTC bila tersedia']],
 ['lubrication','oil_pressure',['oil pressure','tekanan oli','oil','oli'],
  'Kategori peringatan pelumasan/tekanan oli; arti persis mengikuti simbol, pesan dan OEM.',
  ['ikuti stop/continue guidance OEM','cek level dan kebocoran','ukur tekanan bila prosedur tersedia','scan DTC']],
 ['thermal','temperature',['temperature','temperatur','suhu','coolant','overheat','overheating'],
  'Kategori peringatan temperatur atau sistem pendinginan.',
  ['hentikan operasi bila OEM mensyaratkan','cek coolant saat aman','periksa fan/pump/thermostat sesuai arsitektur','cek sensor/live data']],
 ['brake','brake',['brake','rem','abs','epb','parking brake'],
  'Kategori peringatan rem, ABS atau parking brake. Jangan langsung menyimpulkan kampas habis.',
  ['cek kondisi dan level fluida bila applicable','cek kebocoran/wear','scan ABS/ESC/EPB','ikuti prosedur keselamatan OEM']],
 ['engine','check_engine',['check engine','engine warning','mil','malfunction indicator','eml'],
  'ECU mendeteksi kondisi yang membutuhkan diagnosis; ikon tidak menentukan komponen yang rusak.',
  ['scan DTC','simpan freeze frame','baca live data','ikuti prosedur diagnosis OEM']],
 ['transmission','transmission',['transmission','transmisi','gear','cvt','gearbox'],
  'Kategori peringatan kontrol/transmisi; penyebab harus ditentukan dari architecture dan data.',
  ['cek DTC','cek temperature/fluid bila applicable','cek ratio/slip/engagement data','ikuti prosedur OEM']],
 ['tire','tire_pressure',['tpms','tire pressure','tekanan ban','tire','tyre'],
  'Kategori tekanan ban/TPMS; verifikasi tekanan aktual dengan alat.',
  ['ukur tekanan aktual','cek kebocoran','cek sensor/TPMS relearn sesuai OEM']],
 ['safety','airbag',['airbag','srs'],
  'Kategori peringatan SRS/airbag. Ini adalah sistem keselamatan dan memerlukan prosedur khusus.',
  ['jangan menonaktifkan/menjembatani rangkaian','scan SRS DTC','cek wiring/connectors sesuai OEM']],
 ['stability','esc',['esc','esp','traction control','tcs','stability control'],
  'Kategori kontrol stabilitas/traksi; penyebab tidak boleh ditebak dari ikon saja.',
  ['scan ABS/ESC','cek wheel speed/sensor data','cek kondisi ban dan sistem terkait']],
 ['steering','eps',['eps','electric power steering','power steering','steering assist'],
  'Kategori peringatan bantuan kemudi; tingkat risiko bergantung pesan dan perilaku kendaraan.',
  ['ikuti stop/continue guidance','scan steering module','cek supply voltage','cek steering data/procedure']],
 ['fuel','low_fuel',['low fuel','fuel low','bensin rendah','bbm rendah','fuel level'],
  'Kategori level bahan bakar rendah atau sistem fuel-level.',
  ['verifikasi level aktual','cek sensor level bila indikasi tidak masuk akal','jangan menyimpulkan pompa fuel rusak']],
 ['diesel','glow_plug',['glow plug','glowplug','preheat','diesel preheat'],
  'Kategori preheat/glow system pada diesel; diagnosis mengikuti engine strategy.',
  ['scan DTC','cek glow command dan circuit','ikuti cold-start test OEM']],
 ['diesel','dpf',['dpf','diesel particulate filter','particulate filter'],
  'Kategori DPF/particulate filter status atau fault; jangan memulai forced regeneration tanpa syarat OEM.',
  ['baca soot/ash/load data bila tersedia','cek DTC','cek regeneration conditions','ikuti prosedur OEM']],
 ['diesel','def',['def','adblue','urea','scr'],
  'Kategori DEF/AdBlue/SCR emission system.',
  ['cek level dan kualitas sesuai OEM','scan SCR/NOx DTC','cek dosing/temperature data']],
 ['diesel','water_in_fuel',['water in fuel','fuel water','water separator'],
  'Kategori indikasi air pada bahan bakar atau fuel-water separator.',
  ['ikuti prosedur drain/inspection OEM','cek filter dan contamination','jangan menyimpulkan injector rusak tanpa evidence']],
 ['ev_hybrid','hv',['high voltage','hv','hv battery','hybrid','ev','bms','traction battery'],
  'Kategori sistem EV/HV/BMS. Komponen HV tidak boleh dibuka tanpa prosedur keselamatan dan kualifikasi yang sesuai.',
  ['baca warning message/DTC','cek SOC/temperature/live data','cek isolation/interlock hanya sesuai prosedur','ikuti HV safety procedure']],
 ['ev_hybrid','charging_fault',['charging fault','charge fault','charging system','plug fault'],
  'Kategori fault pengisian kendaraan listrik/hybrid.',
  ['cek charger/EVSE status','cek vehicle charging DTC','cek connector/interlock','ikuti OEM charging procedure']],
 ['ev_hybrid','regen',['regenerative braking','regen braking','regeneration'],
  'Kategori status/fault regenerative braking.',
  ['cek brake/regen messages','cek DTC','cek battery temperature/SOC limits']],
 ['ev_hybrid','reduced_power',['reduced power','limp mode','turtle','power limited','derating'],
  'Kategori pembatasan daya; penyebab dapat berasal dari thermal, electrical, propulsion atau protection strategy.',
  ['baca DTC','catat kondisi saat derating','cek thermal/SOC/voltage data','ikuti OEM diagnostic tree']],
 ['adas','adas',['adas','lane keep','lane departure','forward collision','aeb','adaptive cruise','blind spot','parking assist'],
  'Kategori sistem bantuan pengemudi/ADAS. Kalibrasi dan kondisi sensor sangat vehicle-specific.',
  ['baca message/DTC','cek sensor/camera/radar condition','cek calibration status','ikuti prosedur OEM']],
 ['body','seatbelt',['seat belt','seatbelt','sabuk pengaman'],
  'Kategori pengingat atau fault sabuk pengaman/restraint.',
  ['verifikasi belt/latch','scan SRS bila fault','ikuti prosedur OEM']],
 ['body','door_hood',['door open','hood open','bonnet open','tailgate open','pintu terbuka'],
  'Kategori status body/closure.',
  ['verifikasi closure aktual','cek latch/switch bila status salah']],
 ['service','maintenance',['service','maintenance','wrench','spanner','servis'],
  'Kategori pengingat servis/maintenance. Interval dan tindakan mengikuti jadwal OEM kendaraan.',
  ['cek odometer/time','cek maintenance history','ikuti service schedule OEM']],
 ['commercial','air_brake',['air brake','brake pressure','air pressure','air tank'],
  'Kategori sistem rem udara pada kendaraan yang menggunakannya.',
  ['jangan mengoperasikan bila tekanan tidak aman','cek pressure sesuai OEM','cek compressor/leak/protection system']],
 ['commercial','trailer',['trailer abs','trailer ebs','trailer connection'],
  'Kategori trailer brake/electrical connection.',
  ['cek konektor','scan trailer system','ikuti prosedur kendaraan dan trailer']],
 ['heavy','hydraulic',['hydraulic','hydraulic pressure','hydraulic oil'],
  'Kategori sistem hidrolik pada kendaraan/alat yang menggunakannya.',
  ['cek level/kebocoran','ukur pressure hanya dengan prosedur aman','cek filter/temperature']],
 ['heavy','pto',['pto','power take off'],
  'Kategori PTO/auxiliary drive.',
  ['ikuti interlock dan safety procedure','cek status switch/actuator','scan controller bila tersedia']],
 ['drivetrain','four_wd',['4wd','4x4','four wheel drive','differential lock','axle lock'],
  'Kategori mode drivetrain/axle lock.',
  ['verifikasi mode aktual','cek indicator switch/sensor','ikuti prosedur engagement OEM']]
];

function indicatorFind(input){
  const q=norm(input), out=[];
  for(const [group,id,aliases,meaning,checks] of INDICATORS){
    if(hasAny(q,aliases))out.push({group,id,aliases,meaning,checks});
  }
  return out;
}
const catalog=CORE.indicatorCatalog||{};
catalog.version='global-indicators-v2';
catalog.groups=catalog.groups||{};
catalog.find=indicatorFind;
catalog.analyze=function({vehicle={},indicator='',state='on',message='',conditions=''}={}){
  const matches=indicatorFind(String(indicator)+' '+String(message));
  const critical=matches.some(x=>['oil_pressure','brake','temperature','airbag','hv','air_brake'].includes(x.id));
  return {
    version:this.version,
    vehicle:{make:vehicle.brand||vehicle.make||null,model:vehicle.model||null,year:vehicle.year||null,variant:vehicle.variant||null},
    input:{indicator,state,message,conditions},
    matches,
    evidenceRule:'indicator is a category/routing signal, not a root cause',
    criticalRule:critical?'Follow safety/OEM procedure before continued operation.':'Diagnose before replacing parts.',
    unknownIfNoMatch:!matches.length,
    nextAction:matches.length?'Identify exact symbol/message and verify it against the exact vehicle OEM documentation.':'Capture the exact icon/message or photo and complete vehicle identity before interpretation.'
  };
};
catalog.prompt=function(vehicle,indicator,details=''){
  return buildExpertPrompt(vehicle,
    'DASHBOARD/WARNING INDICATOR',
    String(indicator||'')+'\n'+String(details||''),
    {indicator:true});
};
CORE.indicatorCatalog=catalog;

function mission(question,vehicle={}){
  const q=norm(question);
  let intent='general_automotive_question';
  if(/kenapa|mengapa|gejala|masalah|rusak|bunyi|bergetar|boros|panas|lambat|ngempos|brebet|mogok|tidak hidup|warning|lampu/.test(q))intent='diagnosis';
  else if(/ganti|upgrade|modif|modifikasi|pasang|turun mesin|naik kompresi|roller|per cvt|shock|remap|ecu|tune/.test(q))intent='repair_or_modification';
  else if(/servis|service|perawatan|maintenance|interval|kapan/.test(q))intent='maintenance';
  else if(/berapa|spesifikasi|spec|ukuran|kapasitas|torsi|tenaga|oli|part number/.test(q))intent='specification_or_parts';
  else if(/hitung|kalkulasi|rasio|diameter|kompresi|displacement|power/.test(q))intent='engineering_calculation';
  return {intent,question,vehicle};
}

function vehicleBlock(v){
  const fields=[
    ['make',v.brand||v.make],['model',v.model],['variant',v.variant],['year',v.year],
    ['plate',v.plate_number],['vehicle_class',v.vehicle_class||v.vehicle_type],
    ['engine_type',v.engine_type],['fuel_type',v.fuel_type],
    ['transmission',v.transmission_type],['drive_layout',v.drive_layout],
    ['odometer',v.current_odometer]
  ];
  return fields.map(([k,x])=>k+': '+(x===undefined||x===null||x===''?'UNKNOWN':x)).join('\n');
}

function buildExpertPrompt(vehicle,question,missionData,mode='technical',extra={}){
  const m=missionData||mission(question,vehicle);
  const indicator=extra.indicator?'\nINDICATOR INPUT: '+question:'';
  return [
'VEHICLE LIFEBOOK — UNIVERSAL AUTOMOTIVE EXPERT CONTRACT v3',
'',
'ROLE',
'Act as a multidisciplinary automotive diagnostic engineer, master technician, service advisor, vehicle systems engineer, modification engineer and technical trainer. Cover motorcycles, scooters, cars, SUVs, MPVs, pickups, vans, trucks, buses, commercial vehicles, heavy equipment, ICE gasoline/diesel, hybrid/PHEV, BEV/HV and their relevant transmission/drivetrain architectures.',
'Do not claim real-world credentials. Your authority comes from explicit evidence, documented sources, engineering reasoning and transparent uncertainty.',
'',
'PRIMARY OBJECTIVE',
'Answer the user’s actual need, not merely the wording. First understand the exact vehicle and intended outcome. Then select the correct automotive domain and workflow.',
'',
'VEHICLE IDENTITY GATE',
vehicleBlock(vehicle||{}),
'If a field is UNKNOWN and it materially affects the answer, do not silently assume it. Ask for it or give clearly separated conditional branches.',
'',
'USER REQUEST',
String(question||'UNKNOWN'),
'',
'INTENT',
JSON.stringify(m),
indicator,
'',
'NON-HALLUCINATION CONTRACT — MANDATORY',
'1. Never invent vehicle specifications, tolerances, DTC codes, part numbers, service intervals, capacities, torque values, temperatures, pressures, dimensions, compatibility, maintenance history or test results.',
'2. Never present a hypothesis as a confirmed fault.',
'3. Never infer a failed component merely because a warning icon is present.',
'4. Numeric or safety-critical claims require an applicable OEM/service-manual source or another clearly identified authoritative technical source. If unavailable, mark UNKNOWN and explain what source is needed.',
'5. Separate FACT/VERIFIED from INFERENCE/HYPOTHESIS/ESTIMATE/AFTERMARKET RECOMMENDATION/UNKNOWN.',
'6. If sources conflict, show the conflict and explain which vehicle/market/model-year each source applies to. Do not silently choose.',
'7. Do not fabricate the user’s history. Use only the supplied context.',
'8. Do not recommend replacing parts before a reasonable diagnostic test unless the evidence already establishes the failure.',
'9. If the request is unsafe, stop and provide the relevant safety boundary and professional/OEM procedure instead of unsafe instructions.',
'',
'DIAGNOSTIC STATE MACHINE',
'S0 SAFETY → S1 IDENTITY → S2 SYMPTOM/GOAL → S3 DIFFERENTIAL HYPOTHESES → S4 TEST → S5 ACTUAL RESULT → S6 ELIMINATION → S7 ROOT CAUSE → S8 REPAIR/MODIFICATION → S9 VERIFICATION → S10 CLOSE.',
'Never jump from S2 directly to S7 when evidence is insufficient.',
'',
'WHEN DIAGNOSING',
'Build a differential diagnosis appropriate to the actual architecture. For each candidate: why it is plausible, evidence required, safest/highest-information test, expected observations, and what result would weaken/eliminate it. Keep all untested candidates labeled HYPOTHESIS ONLY.',
'',
'WHEN MODIFYING',
'Before recommending a modification: establish baseline condition, identify architecture, check compatibility, explain expected effect, side effects, reliability implications, required supporting changes, tuning/calibration needs, safety/legal implications where relevant, and verification test. Distinguish OEM specification from engineering estimate and aftermarket recommendation.',
'',
'WHEN THE USER ASKS A SIMPLE QUESTION',
'Do not overwhelm the user with irrelevant theory. Give the direct answer first, then the evidence/conditions that qualify it. If the answer depends on missing vehicle data, state exactly which data is missing.',
'',
'RESPONSE FORMAT',
'1. Direct answer / current understanding',
'2. Vehicle-specific facts actually known',
'3. What is UNKNOWN or needs confirmation',
'4. Technical reasoning / differential if applicable',
'5. Evidence or source required',
'6. Step-by-step safe action/test',
'7. Expected result and how to interpret it',
'8. What NOT to do',
'9. Recommendation only after evidence',
'10. Verification / next step',
'',
'FINAL QUALITY GATE',
'Before answering, silently check: Did I identify the exact vehicle? Did I distinguish fact from hypothesis? Did I invent any number or history? Did I use the correct architecture? Did I provide an evidence path? Did I address safety? Did I explain uncertainty? If any answer is no, correct the response before sending.',
'',
'OUTPUT LANGUAGE',
'Answer in Indonesian unless the user requests another language. Use clear terminology and explain technical terms when useful.',
'',
'CONTEXT PAYLOAD',
JSON.stringify(extra||{})
].join('\n');
}

const previousBuild=GLOBAL.buildPrompt;
GLOBAL.buildMission=mission;
GLOBAL.buildPrompt=buildExpertPrompt;
GLOBAL.version='global-automotive-v3-ai-guard';
GLOBAL.aiContractVersion='v3';
GLOBAL.buildPromptLegacy=previousBuild||null;
GLOBAL.createPrompt=(vehicle,question,extra={})=>buildExpertPrompt(vehicle,question,mission(question,vehicle),'technical',extra);
window.VehicleLifebookAI={
  version:'ai-guard-v1',
  buildPrompt:buildExpertPrompt,
  buildMission:mission,
  indicatorCatalog:catalog,
  architecture:universalArchitecture,
  test(q,v){const p=buildExpertPrompt(v,q,mission(q,v),'technical');return {ok:true,length:p.length,hasEvidenceGate:/NON-HALLUCINATION CONTRACT/.test(p),hasStateMachine:/DIAGNOSTIC STATE MACHINE/.test(p)}}
};
})();