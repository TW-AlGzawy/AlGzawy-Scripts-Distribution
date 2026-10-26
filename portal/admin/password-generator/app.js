// Local-only password hash generator for the owner on Safari/iPhone.
// This file intentionally makes no network requests and never persists passwords.
(()=>{
'use strict';
const el=id=>document.getElementById(id);
const password=el('password'),generate=el('generate'),status=el('status');
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
 const result=await crypto.subtle.deriveBits(
  {name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},key,256);
 return 'pbkdf2-sha256$210000$'+hex(salt)+'$'+hex(result);
}
function hideResult(){area.hidden=true;output.value='';copy.disabled=true;}
password.addEventListener('input',()=>{
 if(!area.hidden)hideResult();
 show('');
});
generate.addEventListener('click',async()=>{
 const value=password.value;
 if(value.length<12||value.length>256){
  show('كلمة المرور يجب أن تكون بين 12 و256 حرفًا.',true);
  hideResult();
  return;
 }
 generate.disabled=true;
 hideResult();
 show('جارٍ إنشاء البصمة على هذا الجهاز…');
 try{
  const record=await hashPassword(value);
  output.value=record;
  area.hidden=false;
  copy.disabled=false;
  password.value=''; // Do not keep the secret in the visible input after computing.
  show('✓ تم إنشاء البصمة محليًا. انسخ الناتج إلى Cloudflare كـ Secret.');
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
  show('✓ تم نسخ البصمة، ألصقها في ALG_ADMIN_PASSWORD_HASH.');
 }catch(_){
  output.focus();output.select();
  show('حدد النص وانسخه يدويًا من الحقل.',true);
 }
});
clear.addEventListener('click',()=>{
 password.value='';
 hideResult();
 show('تم مسح الحقول من الصفحة.');
});
hideResult();
})();
