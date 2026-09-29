const url='https://sapammeded.github.io/vehiclelifebook/';
const res=await fetch(url,{redirect:'follow'});
if(!res.ok) throw new Error('Pages HTTP '+res.status);
const html=await res.text();
const required=['Vehicle Lifebook','supabase.co','id="login"','id="signup"','id="app"'];
const missing=required.filter(x=>!html.includes(x));
if(missing.length) throw new Error('Pages smoke missing: '+missing.join(', '));
console.log('Pages smoke OK:',res.status,url);
