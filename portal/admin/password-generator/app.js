// Local-only password hash generator for the owner on Safari/iPhone.
// No network requests; all secrets are cleared from visible inputs after use.
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const password=el('password'),confirmation=el('confirmPassword'),generate=el('generate'),status=el('status');
const output=el('result'),area=el('resultArea'),copy=el('copy'),clear=el('clear');
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
function show(message,error=false){
 status.textContent=message;
 status.classList.toggle('error',error);
}
async function hashPassword(value){
 if(!crypto?.subtle||typeof crypto.getRandomValues!=='function')throw Error('browser_unsupported');
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);
 const settings={name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'};
 const digest=await crypto.subtle.deriveBits(settings,key,256);
 const record='pbkdf2-sha256$100000$'+hex(salt)+'$'+hex(digest);
 // Round-trip check uses exactly the same salt, password, iterations and digest
 // as the server; prevent copying a malformed or inconsistent record.
 const verified=await crypto.subtle.deriveBits(settings,key,256);
 if(!record.endsWith('$'+hex(verified)))throw Error('hash_verification_failed');
 return record;
}
function hideResult(){area.hidden=true;output.value='';copy.disabled=true;}
for(const field of [password,confirmation]){
 field.addEventListener('input',()=>{
  if(!area.hidden)hideResult();
  show('');
 });
}
generate.addEventListener('click',async()=>{
 const value=password.value;
 if(value.length<12||value.length>256){
  show('كلمة المرور يجب أن تكون بين 12 و256 حرفًا.',true);
  hideResult();
  return;
 }
 if(value!==confirmation.value){
  show('⚠ الكودان غير متطابقين. ألصق الكود الأصلي نفسه في الحقلين.',true);
  hideResult();
  return;
 }
 generate.disabled=true;
 hideResult();
 show('جارٍ إنشاء البصمة والتحقق منها على هذا الجهاز…');
 try{
  const record=await hashPassword(value);
  output.value=record;
  area.hidden=false;
  copy.disabled=false;
  password.value='';
  confirmation.value='';
  show('✓ تم التحقق من الكود والبصمة محليًا. استبدل بها Secret في Cloudflare.');
 }catch(_){
  hideResult();
  show('تعذر إنشاء البصمة. افتح هذه الصفحة في Safari وتأكد من دعم Web Crypto.',true);
 }finally{generate.disabled=false;}
});
copy.addEventListener('click',async()=>{
 if(area.hidden||!output.value)return;
 try{
  if(!navigator.clipboard?.writeText)throw Error('clipboard_unavailable');
  await navigator.clipboard.writeText(output.value);
  show('✓ تم نسخ البصمة. استبدل ALG_ADMIN_PASSWORD_HASH في Production وأعد النشر.');
 }catch(_){
  output.focus();output.select();
  show('حدد النص وانسخه يدويًا من الحقل.',true);
 }
});
clear.addEventListener('click',()=>{
 password.value='';
 confirmation.value='';
 hideResult();
 show('تم مسح الحقول من الصفحة.');
});
hideResult();
})();
