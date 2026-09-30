import { chromium } from 'playwright';
const url='https://sapammeded.github.io/vehiclelifebook/';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message)));
 const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
 if(!res||!res.ok())throw new Error('Pages HTTP '+(res?.status()||'unknown'));
 await page.waitForSelector('#app',{timeout:10000});
 await page.waitForSelector('#login',{timeout:10000});
 await page.waitForSelector('#signup',{timeout:10000});
 const intel=await page.evaluate(()=>({
   intelligence:!!window.VehicleLifebookIntelligence,
   heavy:[...document.scripts].some(s=>/xlsx-js-style|jspdf\/|docx@/i.test(s.src)),
   mobile:innerWidth<=430
 }));
 if(!intel.intelligence)throw new Error('Vehicle Intelligence module not loaded');
 if(intel.heavy)throw new Error('Heavy export library still eager-loaded');
 if(errors.length)throw new Error('Browser pageerror: '+errors.join(' | '));
 console.log('Browser smoke OK',JSON.stringify(intel));
}finally{await browser.close()}