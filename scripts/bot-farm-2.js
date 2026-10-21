// ==UserScript==
// @name  Bot  2نهب
// @version 0.1
// @description a- b -c
// @author
// @match        https://*/*=am_farm*
// @icon  https://th.bing.com/th/id/OIP.toZcYYWV8MicjIrxEmV6sAHaH7?rs=1&pid=ImgDetMain
// @grant none
// ==/UserScript==
/*
A = 8
B = 9
C = 10
*/
var type = 8;
var speed = Math.random() * 3000 + 7000;
setInterval(
function(){
$('#plunder_list tr:eq(1) td:eq('+ type +') a').click();
$('#plunder_list tr:eq(1)').remove();
},Math.ceil( (Math.random() * 300) + 700 ));
setTimeout(
function(){
if ( $('#village_switch_right').length === 0){
location.reload();
}else{
location.href = $('#village_switch_right').attr('href');
}
}, speed);

