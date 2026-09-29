import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const required=[
  "auth.signUp({email,password})",
  "auth.signInWithPassword({email,password})",
  "auth.onAuthStateChange",
  "state.sb.rpc('ensure_vehicle_profile')",
  "state.sb.rpc('get_my_entitlement')",
  "state.sb.rpc('activate_license'",
  "state.sb.auth.signOut()",
  "from('vehicles').insert"
];
const missing=required.filter(x=>!html.includes(x));
if(missing.length) throw new Error('Onboarding lifecycle missing: '+missing.join(', '));
const p=html.indexOf("async function afterLogin()");
const e=html.indexOf("async function loadEntitlement()",p);
if(p<0||e<0||!html.slice(p,e).includes("ensure_vehicle_profile")) throw new Error('Profile initialization is not before entitlement load');
console.log('Onboarding lifecycle static QA OK');
