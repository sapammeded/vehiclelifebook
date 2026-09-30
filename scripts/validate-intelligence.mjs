import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const intelligence=fs.readFileSync('js/vehicle-intelligence-ui.js','utf8');
const source=html+'\n'+intelligence;
const required=[
  'js/global-automotive-intelligence.js',
  'js/vehicle-intelligence-ui.js',
  'id="vehicleIntelBtn"',
  'VehicleLifebookIntelligence.open',
  'function ensureExportEngine',
  "vehicle_configurations",
  "vehicle_components",
  "vehicle_modifications",
  "diagnostic_cases",
  "vehicle_calculations",
  "vehicle_evidence",
  "validation_records"
];
const missing=required.filter(x=>!source.includes(x));
if(missing.length)throw new Error('Intelligence/lazy-export wiring missing: '+missing.join(', '));
for(const path of ['js/vehicle-intelligence-ui.js','js/global-automotive-intelligence.js','js/automotive-core.js']){
 if(!fs.existsSync(path))throw new Error('Missing '+path);
 try{new Function(fs.readFileSync(path,'utf8'))}catch(e){throw new Error(path+' invalid JavaScript: '+e.message)}
}
if(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/(xlsx-js-style|jspdf|docx)/i.test(html))throw new Error('Heavy export library still loaded eagerly');
console.log('Intelligence/lazy-export static QA OK');