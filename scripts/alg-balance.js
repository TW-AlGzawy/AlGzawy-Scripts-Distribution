// @version      1.0.1
// @name         الغزااوي | موازنة الموارد
// ============================================================
//  AlGzawy - موازنة الموارد v1.0
//  © AlGzawy 2024 - جميع الحقوق محفوظة
//  https://github.com/TW-AlGzawy/TW-Tampermonkey
// ============================================================

(function () {
'use strict';

// ===== THEME =====
var BG       = '#102031';
var BG2      = '#13283a';
var HDR      = '#123e3d';
var BORDER   = '#263c4f';
var GOLD     = '#40e1bf';
var CREAM    = '#eaf3f8';
var DIM      = '#95acbc';
var ROW_A    = 'rgba(64,225,191,0.08)';
var ROW_B    = 'rgba(0,0,0,0.18)';

// ===== K-MEANS =====
function getClusters(coords, options) {
    var k = Math.min(options.numberOfClusters || 1, coords.length);
    var maxIter = options.maxIterations || 100;
    function mean(pts) {
        if (!pts.length) return [0,0];
        var sx=0,sy=0; pts.forEach(function(p){sx+=p[0];sy+=p[1];}); return [sx/pts.length,sy/pts.length];
    }
    if (k<=1) return [{data:coords.slice(),mean:mean(coords)}];
    var centroids=[],used=[];
    for (var i=0;i<k;i++){
        var idx; do{idx=Math.floor(Math.random()*coords.length);}while(used.indexOf(idx)!==-1);
        used.push(idx); centroids.push([coords[idx][0],coords[idx][1]]);
    }
    var asgn=new Array(coords.length).fill(0);
    for (var iter=0;iter<maxIter;iter++){
        var changed=false;
        for (var i=0;i<coords.length;i++){
            var minD=Infinity,best=0;
            for (var j=0;j<k;j++){var dx=coords[i][0]-centroids[j][0],dy=coords[i][1]-centroids[j][1],d=dx*dx+dy*dy;if(d<minD){minD=d;best=j;}}
            if(asgn[i]!==best){asgn[i]=best;changed=true;}
        }
        if(!changed)break;
        for (var j=0;j<k;j++){var m=coords.filter(function(_,i){return asgn[i]===j;});if(m.length)centroids[j]=mean(m);}
    }
    var clusters=[];
    for (var j=0;j<k;j++){var m=coords.filter(function(_,i){return asgn[i]===j;});if(m.length)clusters.push({data:m,mean:mean(m)});}
    return clusters;
}

// ===== getResourcesForAM stub =====
async function getResourcesForAM(map_farm_usage) {
    var result = [];
    for (var i=0;i<101;i++) result.push(new Map());
    return result;
}

// ===== UTILS =====
function calcDistance(c1,c2){
    var x1=parseInt(c1.split('|')[0]),y1=parseInt(c1.split('|')[1]),x2=parseInt(c2.split('|')[0]),y2=parseInt(c2.split('|')[1]);
    return Math.sqrt((x1-x2)*(x1-x2)+(y1-y2)*(y1-y2));
}
function fmtN(n){ return new Intl.NumberFormat().format(n); }
function httpGet(url){var x=new XMLHttpRequest();x.open('GET',url,false);x.send(null);return x.responseText;}

// ===== DATA FETCHING =====
function getDataProduction(){
    return new Promise(function(resolve,reject){
        var link=game_data.link_base_pure+'overview_villages&mode=prod';
        var dataPage=httpGet(link);
        var parser=new DOMParser();
        var htmlDoc=parser.parseFromString(dataPage,'text/html');
        var list_pages=[];
        if($(htmlDoc).find('.paged-nav-item').parent().find('select').length>0){
            Array.from($(htmlDoc).find('.paged-nav-item').parent().find('select').find('option')).forEach(function(item){list_pages.push(item.value);});
            list_pages.pop();
        } else if(htmlDoc.getElementsByClassName('paged-nav-item').length>0){
            var nr=0;
            Array.from(htmlDoc.getElementsByClassName('paged-nav-item')).forEach(function(item){
                var c=item.href;c=c.split('page=')[0]+'page='+nr;nr++;list_pages.push(c);
            });
        } else {list_pages.push(link);}
        list_pages=list_pages.reverse();
        var list_production=[],map_farm_usage=new Map();
        function ajaxRequest(urls){
            var current_url=urls.length>0?urls.pop():'stop';
            var t0=new Date().getTime();
            if(urls.length>=0&&current_url!='stop'){
                $.ajax({url:current_url,method:'get',success:function(data){
                    var parser=new DOMParser();
                    var htmlDoc=parser.parseFromString(data,'text/html');
                    var rows=Array.from($(htmlDoc).find('.row_a, .row_b'));
                    for(var i=0;i<rows.length;i++){
                        try{
                            var vn=rows[i].getElementsByClassName('quickedit-vn')[0];
                            var name=vn.innerText;
                            var coord=name.match(/[0-9]{3}\|[0-9]{3}/)[0];
                            var id=vn.getAttribute('data-id');
                            var wood=parseInt(rows[i].getElementsByClassName('wood')[0].innerText.replace(/\./g,''));
                            var stone=parseInt(rows[i].getElementsByClassName('stone')[0].innerText.replace(/\./g,''));
                            var iron=parseInt(rows[i].getElementsByClassName('iron')[0].innerText.replace(/\./g,''));
                            var mt=rows[i].querySelector("a[href*='market']").innerText;
                            var merchants=parseInt(mt.split('/')[0]);
                            var merchants_total=parseInt(mt.split('/')[1]);
                            var capacity=parseInt(rows[i].children[4].innerText.replace(/\./g,''));
                            var points=parseInt(rows[i].children[2].innerText.replace(/\./g,''));
                            var popT=rows[i].children[6].innerText;
                            var fpu=parseInt(popT.split('/')[0]);
                            var fpt=parseInt(popT.split('/')[1]);
                            list_production.push({coord:coord,id:id,wood:wood,stone:stone,iron:iron,name:name.trim(),merchants:merchants,merchants_total:merchants_total,capacity:capacity,points:points});
                            map_farm_usage.set(coord,fpu/fpt);
                        }catch(e){}
                    }
                    var diff=new Date().getTime()-t0;
                    window.setTimeout(function(){ajaxRequest(urls);UI.SuccessMessage('الإنتاج: صفحة '+urls.length,500);},Math.max(0,200-diff));
                },error:function(err){reject(err);}});
            } else {
                UI.SuccessMessage('تم جلب بيانات الإنتاج',800);
                resolve({list_production:list_production,map_farm_usage:map_farm_usage});
            }
        }
        ajaxRequest(list_pages);
    });
}

function getDataIncoming(){
    return new Promise(function(resolve,reject){
        var link=game_data.link_base_pure+'overview_villages&mode=trader&type=inc';
        var dataPage=httpGet(link);
        var parser=new DOMParser();
        var htmlDoc=parser.parseFromString(dataPage,'text/html');
        var list_pages=[];
        if($(htmlDoc).find('.paged-nav-item').parent().find('select').length>0){
            Array.from($(htmlDoc).find('.paged-nav-item').parent().find('select').find('option')).forEach(function(item){list_pages.push(item.value);});
            list_pages.pop();
        } else if(htmlDoc.getElementsByClassName('paged-nav-item').length>0){
            var nr=0;
            Array.from(htmlDoc.getElementsByClassName('paged-nav-item')).forEach(function(item){
                var c=item.href;c=c.split('page=')[0]+'page='+nr;nr++;list_pages.push(c);
            });
        } else {list_pages.push(link);}
        list_pages=list_pages.reverse();
        var map_incoming=new Map();
        function ajaxRequest(urls){
            var current_url=urls.length>0?urls.pop():'stop';
            var t0=new Date().getTime();
            if(urls.length>=0&&current_url!='stop'){
                $.ajax({url:current_url,method:'get',success:function(data){
                    var parser=new DOMParser();
                    var htmlDoc=parser.parseFromString(data,'text/html');
                    var rows=Array.from($(htmlDoc).find('.row_a, .row_b'));
                    for(var i=0;i<rows.length;i++){
                        try{
                            var coord=rows[i].children[4].innerText.match(/[0-9]{3}\|[0-9]{3}/)[0];
                            var wood=parseInt($(rows[i]).find('.wood').parent().text().replace(/\./g,''))||0;
                            var stone=parseInt($(rows[i]).find('.stone').parent().text().replace(/\./g,''))||0;
                            var iron=parseInt($(rows[i]).find('.iron').parent().text().replace(/\./g,''))||0;
                            if(map_incoming.has(coord)){var ex=map_incoming.get(coord);ex.wood+=wood;ex.stone+=stone;ex.iron+=iron;}
                            else{map_incoming.set(coord,{wood:wood,stone:stone,iron:iron});}
                        }catch(e){}
                    }
                    var diff=new Date().getTime()-t0;
                    window.setTimeout(function(){ajaxRequest(urls);},Math.max(0,200-diff));
                },error:function(err){reject(err);}});
            } else {resolve(map_incoming);}
        }
        ajaxRequest(list_pages);
    });
}

// ===== CALCULATE LAUNCHES (original logic, unchanged) =====
function calculateLaunches(list_production_cluster,list_production_home_cluster,map_resources_get_AM,clusters,averageFactor,reserveMerchants,merchantCapacity){
    var list_launches=[],list_clusters_stats=[];
    var total_wood_send_stats=0,total_stone_send_stats=0,total_iron_send_stats=0;
    var total_wood_get_stats=0,total_stone_get_stats=0,total_iron_get_stats=0;

    for(var i=0;i<list_production_cluster.length;i++){
        var list_prod=list_production_cluster[i];
        var list_prod_home=list_production_home_cluster[i];
        var avg_wood=0,avg_stone=0,avg_iron=0;
        var total_wood_send=0,total_stone_send=0,total_iron_send=0;
        var total_wood_get=0,total_stone_get=0,total_iron_get=0;
        var list_res_send=[],list_res_get=[];
        var total_wood_cluster=0,total_stone_cluster=0,total_iron_cluster=0;

        for(var j=0;j<list_prod.length;j++){
            avg_wood+=list_prod[j].wood/list_prod.length;
            avg_stone+=list_prod[j].stone/list_prod.length;
            avg_iron+=list_prod[j].iron/list_prod.length;
            total_wood_cluster+=list_prod[j].wood;
            total_stone_cluster+=list_prod[j].stone;
            total_iron_cluster+=list_prod[j].iron;
        }
        var avg_wood_factor=avg_wood*averageFactor;
        var avg_stone_factor=avg_stone*averageFactor;
        var avg_iron_factor=avg_iron*averageFactor;

        for(var j=0;j<list_prod.length;j++){
            var coord=list_prod[j].coord,name=list_prod[j].name,id=list_prod[j].id;
            var merchants=list_prod[j].merchants-reserveMerchants;
            var capacity=list_prod[j].capacity*0.95;
            var capacity_travel=merchants*merchantCapacity;
            var avg_wood_res=avg_wood_factor,avg_stone_res=avg_stone_factor,avg_iron_res=avg_iron_factor;
            if(map_resources_get_AM.has(list_prod[j].coord)){
                var obj_res_AM=map_resources_get_AM.get(list_prod[j].coord);
                avg_wood_res+=obj_res_AM.total_wood;avg_stone_res+=obj_res_AM.total_stone;avg_iron_res+=obj_res_AM.total_iron;
                list_prod[j].time_finished=obj_res_AM.time_finished;
            } else {list_prod[j].time_finished=0;}
            var diff_wood=list_prod[j].wood-Math.round(avg_wood_res);
            var diff_stone=list_prod[j].stone-Math.round(avg_stone_res);
            var diff_iron=list_prod[j].iron-Math.round(avg_iron_res);
            diff_wood=(diff_wood<0)?diff_wood:(list_prod_home[j].wood-diff_wood>0)?diff_wood:list_prod_home[j].wood;
            diff_stone=(diff_stone<0)?diff_stone:(list_prod_home[j].stone-diff_stone>0)?diff_stone:list_prod_home[j].stone;
            diff_iron=(diff_iron<0)?diff_iron:(list_prod_home[j].iron-diff_iron>0)?diff_iron:list_prod_home[j].iron;
            var total_res_available=0;
            if(diff_wood>0)total_res_available+=diff_wood;
            if(diff_stone>0)total_res_available+=diff_stone;
            if(diff_iron>0)total_res_available+=diff_iron;
            var norm_factor=(capacity_travel<=total_res_available&&total_res_available>0)?capacity_travel/total_res_available:1;
            var send_wood=(diff_wood>0)?parseInt(diff_wood*norm_factor):0;
            var send_stone=(diff_stone>0)?parseInt(diff_stone*norm_factor):0;
            var send_iron=(diff_iron>0)?parseInt(diff_iron*norm_factor):0;
            var get_wood=(diff_wood>0)?0:(list_prod[j].wood+Math.abs(diff_wood)<capacity)?Math.abs(diff_wood):capacity-list_prod[j].wood;
            var get_stone=(diff_stone>0)?0:(list_prod[j].stone+Math.abs(diff_stone)<capacity)?Math.abs(diff_stone):capacity-list_prod[j].stone;
            var get_iron=(diff_iron>0)?0:(list_prod[j].iron+Math.abs(diff_iron)<capacity)?Math.abs(diff_iron):capacity-list_prod[j].iron;
            total_wood_send+=send_wood;total_stone_send+=send_stone;total_iron_send+=send_iron;
            total_wood_get+=get_wood;total_stone_get+=get_stone;total_iron_get+=get_iron;
            var obj_send={coord:coord,id:id,name:name,wood:(send_wood>0)?send_wood:0,stone:(send_stone>0)?send_stone:0,iron:(send_iron>0)?send_iron:0};
            var obj_get={coord:coord,id:id,name:name,wood:(get_wood>0)?parseInt(get_wood):0,stone:(get_stone>0)?parseInt(get_stone):0,iron:(get_iron>0)?parseInt(get_iron):0};
            if(obj_send.wood>0||obj_send.stone>0||obj_send.iron>0)list_res_send.push(obj_send);
            if(obj_get.wood>0||obj_get.stone>0||obj_get.iron>0)list_res_get.push(obj_get);
        }

        var norm_wood=(total_wood_get>total_wood_send&&total_wood_get>0)?(total_wood_send/total_wood_get):1;
        var norm_stone=(total_stone_get>total_stone_send&&total_stone_get>0)?(total_stone_send/total_stone_get):1;
        var norm_iron=(total_iron_get>total_iron_send&&total_iron_get>0)?(total_iron_send/total_iron_get):1;
        for(var j=0;j<list_res_get.length;j++){
            list_res_get[j].wood=parseInt(list_res_get[j].wood*norm_wood);
            list_res_get[j].stone=parseInt(list_res_get[j].stone*norm_stone);
            list_res_get[j].iron=parseInt(list_res_get[j].iron*norm_iron);
        }

        var list_maxDistance=[];
        for(var j=0;j<list_res_get.length;j++){
            var id_destination=list_res_get[j].id,name_destination=list_res_get[j].name;
            for(var k=0;k<list_res_send.length;k++){list_res_send[k].distance=calcDistance(list_res_get[j].coord,list_res_send[k].coord);}
            list_res_send.sort(function(a,b){return a.distance-b.distance;});
            for(var k=0;k<list_res_send.length;k++){
                var coord_origin=list_res_send[k].coord,id_origin=list_res_send[k].id,name_origin=list_res_send[k].name;
                var sw=(list_res_send[k].wood>0)?Math.min(list_res_get[j].wood,list_res_send[k].wood):0;
                var ss=(list_res_send[k].stone>0)?Math.min(list_res_get[j].stone,list_res_send[k].stone):0;
                var si=(list_res_send[k].iron>0)?Math.min(list_res_get[j].iron,list_res_send[k].iron):0;
                list_res_get[j].wood-=sw;list_res_get[j].stone-=ss;list_res_get[j].iron-=si;
                list_res_send[k].wood-=sw;list_res_send[k].stone-=ss;list_res_send[k].iron-=si;
                var total_send=sw+ss+si;
                var restDivision=total_send%merchantCapacity;
                var minim_resources=(merchantCapacity==1000)?700:1200;
                if(restDivision<minim_resources){
                    if(sw>restDivision){sw-=restDivision;total_send-=restDivision;}
                    else if(ss>restDivision){ss-=restDivision;total_send-=restDivision;}
                    else if(si>restDivision){si-=restDivision;total_send-=restDivision;}
                }
                list_maxDistance.push(list_res_send[k].distance);
                if(total_send>=minim_resources){
                    list_launches.push({total_send:total_send,wood:sw,stone:ss,iron:si,coord_origin:coord_origin,name_origin:name_origin,id_destination:id_destination,id_origin:id_origin,coord_destination:list_res_get[j].coord,name_destination:name_destination,distance:list_res_send[k].distance});
                }
                if(list_res_get[j].wood+list_res_get[j].stone+list_res_get[j].iron<minim_resources)break;
            }
        }
        total_wood_send_stats+=total_wood_send;total_stone_send_stats+=total_stone_send;total_iron_send_stats+=total_iron_send;
        total_wood_get_stats+=total_wood_get;total_stone_get_stats+=total_stone_get;total_iron_get_stats+=total_iron_get;
        var max_distance=0;
        for(var j=0;j<list_maxDistance.length;j++){if(max_distance<list_maxDistance[j])max_distance=list_maxDistance[j];}
        list_clusters_stats.push({nr_coords:clusters[i].data.length,center:parseInt(clusters[i].mean[0])+'|'+parseInt(clusters[i].mean[1]),max_distance:max_distance,avg_wood:Math.round(avg_wood),avg_stone:Math.round(avg_stone),avg_iron:Math.round(avg_iron),total_wood_send:total_wood_send,total_stone_send:total_stone_send,total_iron_send:total_iron_send,total_wood_get:total_wood_get,total_stone_get:total_stone_get,total_iron_get:total_iron_get,total_wood_cluster:total_wood_cluster,total_stone_cluster:total_stone_cluster,total_iron_cluster:total_iron_cluster});
    }
    return{list_clusters_stats:list_clusters_stats,list_launches:list_launches,total_wood_send_stats:total_wood_send_stats,total_stone_send_stats:total_stone_send_stats,total_iron_send_stats:total_iron_send_stats,total_wood_get_stats:total_wood_get_stats,total_stone_get_stats:total_stone_get_stats,total_iron_get_stats:total_iron_get_stats};
}

// ===== SEND RESOURCES =====
function sendResources(target_id,data){
    var tw=window.TribalWars;
    if(!tw){console.error('[AlGzawy Balance] TribalWars غير متاح');return false;}
    var csrf=window.csrf_token||(window.game_data&&window.game_data.csrf)||'';
    if(!csrf){console.error('[AlGzawy Balance] CSRF token مفقود');return false;}
    console.log('[AlGzawy Balance] إرسال إلى',target_id,'csrf:',csrf,'data:',JSON.stringify(data));
    tw.post('market',{village:target_id,ajaxaction:'call',h:csrf},data,function(response){
        console.log('[AlGzawy Balance] استجابة:',response);
        try{if(response&&response.success)UI.SuccessMessage(response.success,1000);}catch(e){}
    });
    return true;
}

// ===== MAIN BALANCE FUNCTION =====
async function balancingResources(){
    var time_construction_total=parseFloat(document.getElementById('alg-time_construction').value)||0;
    var averageFactor=parseFloat(document.getElementById('alg-nr_average_factor').value);
    var reserveMerchants=parseInt(document.getElementById('alg-nr_merchants_reserve').value)||0;
    var merchantCapacity=parseInt(document.getElementById('alg-merchant_capacity').value)||1000;
    var nrClusters=parseInt(document.getElementById('alg-nr_clusters').value)||1;
    var maxConstruction=document.getElementById('alg-max_construction').checked;

    reserveMerchants=isNaN(reserveMerchants)||reserveMerchants<0?0:reserveMerchants;
    nrClusters=isNaN(nrClusters)||nrClusters<1?1:nrClusters;
    time_construction_total=isNaN(time_construction_total)||time_construction_total<0?0:Math.min(50,time_construction_total);
    averageFactor=isNaN(averageFactor)?1:Math.max(0,Math.min(1,averageFactor));
    merchantCapacity=isNaN(merchantCapacity)?1000:Math.min(1500,Math.max(1000,merchantCapacity));

    setStatus('جاري جلب بيانات الإنتاج...');
    document.getElementById('alg-div_tables').hidden=true;

    var prodData=await getDataProduction().catch(function(e){alert('خطأ في جلب بيانات الإنتاج: '+e);return null;});
    if(!prodData)return;
    var list_production=prodData.list_production;
    var map_farm_usage=prodData.map_farm_usage;

    setStatus('جاري جلب الموارد الواردة...');
    var map_incoming=await getDataIncoming().catch(function(e){alert('خطأ: '+e);return new Map();});

    setStatus('جاري حساب التوزيع المثالي...');
    var map_resources_get_AM_data=await getResourcesForAM(map_farm_usage);
    var list_production_home=JSON.parse(JSON.stringify(list_production));
    var map_resources_get_AM=time_construction_total>0?map_resources_get_AM_data[time_construction_total-1]:new Map();

    var kmeans_coords=[];
    for(var i=0;i<list_production.length;i++){kmeans_coords.push([parseInt(list_production[i].coord.split('|')[0]),parseInt(list_production[i].coord.split('|')[1])]);}
    var clusters=getClusters(kmeans_coords,{numberOfClusters:nrClusters,maxIterations:100});

    var list_production_cluster=[],list_production_home_cluster=[];
    for(var i=0;i<clusters.length;i++){
        var list_coords=clusters[i].data,list_prod=[],list_prod_home=[];
        for(var j=0;j<list_coords.length;j++){
            var coord=list_coords[j].join('|');
            for(var k=0;k<list_production.length;k++){
                if(list_production[k].coord===coord){list_prod.push(list_production[k]);list_prod_home.push(list_production_home[k]);break;}
            }
        }
        list_production_cluster.push(list_prod);list_production_home_cluster.push(list_prod_home);
    }

    var total_wood_home=0,total_stone_home=0,total_iron_home=0;
    var avg_wood_total=0,avg_stone_total=0,avg_iron_total=0;
    for(var i=0;i<list_production.length;i++){
        var coord=list_production[i].coord;
        if(map_incoming.has(coord)){
            list_production[i].wood=Math.min(list_production[i].wood+map_incoming.get(coord).wood,list_production[i].capacity);
            list_production[i].stone=Math.min(list_production[i].stone+map_incoming.get(coord).stone,list_production[i].capacity);
            list_production[i].iron=Math.min(list_production[i].iron+map_incoming.get(coord).iron,list_production[i].capacity);
        }
        avg_wood_total+=list_production[i].wood/list_production.length;
        avg_stone_total+=list_production[i].stone/list_production.length;
        avg_iron_total+=list_production[i].iron/list_production.length;
        total_wood_home+=list_production[i].wood;
        total_stone_home+=list_production[i].stone;
        total_iron_home+=list_production[i].iron;
    }

    var launchesData;
    if(!maxConstruction||averageFactor>0.5){
        launchesData=calculateLaunches(list_production_cluster,list_production_home_cluster,map_resources_get_AM,clusters,averageFactor,reserveMerchants,merchantCapacity);
    } else {
        launchesData=calculateLaunches(list_production_cluster,list_production_home_cluster,map_resources_get_AM_data[0],clusters,averageFactor,reserveMerchants,merchantCapacity);
        for(var count=1;count<100;count++){
            var ld2=calculateLaunches(list_production_cluster,list_production_home_cluster,map_resources_get_AM_data[count],clusters,averageFactor,reserveMerchants,merchantCapacity);
            var notEnough=false;
            for(var si=0;si<ld2.list_clusters_stats.length;si++){
                if(ld2.list_clusters_stats[si].total_iron_get>ld2.list_clusters_stats[si].total_iron_send||ld2.list_clusters_stats[si].total_stone_get>ld2.list_clusters_stats[si].total_stone_send||ld2.list_clusters_stats[si].total_wood_get>ld2.list_clusters_stats[si].total_wood_send){notEnough=true;break;}
            }
            if(notEnough)break;
            launchesData=ld2;
        }
    }

    var list_launches=launchesData.list_launches;

    // Merchant count
    var map_nr_merchants=new Map();
    for(var i=0;i<list_launches.length;i++){
        var nm=Math.ceil((list_launches[i].wood+list_launches[i].stone+list_launches[i].iron)/merchantCapacity);
        if(map_nr_merchants.has(list_launches[i].coord_origin))map_nr_merchants.set(list_launches[i].coord_origin,nm+map_nr_merchants.get(list_launches[i].coord_origin));
        else map_nr_merchants.set(list_launches[i].coord_origin,nm);
    }
    var map_result_wood=new Map(),map_result_stone=new Map(),map_result_iron=new Map();
    for(var i=0;i<list_launches.length;i++){
        var co=list_launches[i].coord_origin,cd=list_launches[i].coord_destination;
        map_result_wood.set(co,(map_result_wood.get(co)||0)-list_launches[i].wood);
        map_result_stone.set(co,(map_result_stone.get(co)||0)-list_launches[i].stone);
        map_result_iron.set(co,(map_result_iron.get(co)||0)-list_launches[i].iron);
        map_result_wood.set(cd,(map_result_wood.get(cd)||0)+list_launches[i].wood);
        map_result_stone.set(cd,(map_result_stone.get(cd)||0)+list_launches[i].stone);
        map_result_iron.set(cd,(map_result_iron.get(cd)||0)+list_launches[i].iron);
    }
    for(var i=0;i<list_production.length;i++){
        var coord=list_production[i].coord;
        list_production[i].merchantAvailable=list_production[i].merchants-(map_nr_merchants.get(coord)||0);
        list_production[i].result_wood=map_result_wood.get(coord)||0;
        list_production[i].result_stone=map_result_stone.get(coord)||0;
        list_production[i].result_iron=map_result_iron.get(coord)||0;
    }

    var obj_stats={
        avg_wood:Math.round(avg_wood_total),avg_stone:Math.round(avg_stone_total),avg_iron:Math.round(avg_iron_total),
        total_wood_send:Math.round(launchesData.total_wood_send_stats),total_stone_send:Math.round(launchesData.total_stone_send_stats),total_iron_send:Math.round(launchesData.total_iron_send_stats),
        total_wood_get:Math.round(launchesData.total_wood_get_stats),total_stone_get:Math.round(launchesData.total_stone_get_stats),total_iron_get:Math.round(launchesData.total_iron_get_stats),
        total_wood_home:Math.round(total_wood_home),total_stone_home:Math.round(total_stone_home),total_iron_home:Math.round(total_iron_home)
    };

    var map_launches_mass=new Map();
    for(var i=0;i<list_launches.length;i++){
        var tid=list_launches[i].id_destination,oid=list_launches[i].id_origin;
        var wk='resource['+oid+'][wood]',sk='resource['+oid+'][stone]',ik='resource['+oid+'][iron]';
        if(map_launches_mass.has(tid)){
            var u=map_launches_mass.get(tid);u.send_resources[wk]=list_launches[i].wood;u.send_resources[sk]=list_launches[i].stone;u.send_resources[ik]=list_launches[i].iron;
            u.total_send+=list_launches[i].total_send;u.total_wood+=list_launches[i].wood;u.total_stone+=list_launches[i].stone;u.total_iron+=list_launches[i].iron;
            u.distance=Math.max(u.distance,list_launches[i].distance);
        } else {
            var sr={};sr[wk]=list_launches[i].wood;sr[sk]=list_launches[i].stone;sr[ik]=list_launches[i].iron;
            map_launches_mass.set(tid,{target_id:tid,coord_destination:list_launches[i].coord_destination,name_destination:list_launches[i].name_destination,send_resources:sr,total_send:list_launches[i].total_send,total_wood:list_launches[i].wood,total_stone:list_launches[i].stone,total_iron:list_launches[i].iron,distance:list_launches[i].distance});
        }
    }
    var list_launches_mass=Array.from(map_launches_mass.entries()).map(function(e){return e[1];});
    list_launches_mass.sort(function(a,b){return b.total_send-a.total_send;});

    setStatus('');
    document.getElementById('alg-div_tables').hidden=false;
    buildTable(list_launches_mass,obj_stats,list_production,launchesData.list_clusters_stats);
}

// ===== UI =====
var statusEl=null;
function setStatus(msg){if(statusEl)statusEl.textContent=msg;}

function injectCSS(){
    if(document.getElementById('alg-bal-css'))return;
    var s=document.createElement('style');s.id='alg-bal-css';
    s.textContent=[
        '#alg-window{font-family:"Trebuchet MS",sans-serif;direction:rtl;color:'+CREAM+';box-sizing:border-box;}',
        '#alg-window *{box-sizing:border-box;}',
        '.alg-T{width:100%;border-collapse:collapse;font-size:13px;}',
        '.alg-T td,.alg-T th{padding:6px 10px;border:1px solid '+BORDER+';vertical-align:middle;}',
        '.alg-T tr:nth-child(even){background:'+ROW_A+';}',
        '.alg-T tr:nth-child(odd){background:'+ROW_B+';}',
        '.alg-TH{background:linear-gradient(to bottom,'+HDR+','+BG2+');color:'+GOLD+';font-weight:bold;text-align:center;}',
        '.alg-IN{background:#07111c;color:'+CREAM+';border:1px solid '+BORDER+';padding:4px 6px;border-radius:3px;width:80px;text-align:center;}',
        '.alg-BTN{background:linear-gradient(to bottom,#143e3a,#123e3d);color:'+GOLD+';border:1px solid '+BORDER+';padding:5px 14px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;}',
        '.alg-BTN:hover{background:linear-gradient(to bottom,#1c5b4c,#143e3a);}',
        '.alg-BIG-BTN{background:linear-gradient(to bottom,#247a68,#143e3a);color:#eaf3f8;border:1px solid #286459;padding:9px 30px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:15px;}',
        '.alg-BIG-BTN:hover{background:linear-gradient(to bottom,#2d9074,#247a68);}',
        '.alg-SEND-BTN{background:linear-gradient(to bottom,#31556a,#183345);color:#fff;border:1px solid #40e1bf;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:12px;}',
        '.alg-SEND-BTN:hover{background:linear-gradient(to bottom,#469d8d,#31556a);}',
        '.alg-SEND-BTN:disabled{opacity:0.5;cursor:default;}',
        '#alg-scroll{max-height:350px;overflow-y:auto;}',
        '#alg-scroll::-webkit-scrollbar{width:6px;}',
        '#alg-scroll::-webkit-scrollbar-track{background:'+BG+';}',
        '#alg-scroll::-webkit-scrollbar-thumb{background:'+BORDER+';border-radius:3px;}'
    ].join('');
    document.head.appendChild(s);
}

function createMainInterface(){
    var _ex=document.getElementById('alg-window');if(_ex)_ex.parentNode.removeChild(_ex);
    injectCSS();

    var saved={};
    try{saved=JSON.parse(localStorage.getItem(game_data.world+'_alg_bal_v1')||'{}');}catch(e){}

    var w='55%',minW='480px';
    var html='<div id="alg-window" style="position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:99999;background:'+BG+';border:2px solid '+BORDER+';border-radius:8px;box-shadow:0 6px 30px rgba(0,0,0,0.8);width:'+w+';min-width:'+minW+';max-width:94vw;">'+
        // HEADER
        '<div id="alg-hdr" style="background:linear-gradient(to bottom,'+HDR+','+BG2+');padding:10px 14px;border-radius:6px 6px 0 0;cursor:move;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid '+BORDER+';">'+
            '<span style="color:'+GOLD+';font-weight:bold;font-size:15px;">&#9878; AlGzawy &mdash; موازنة الموارد</span>'+
            '<span>'+
                '<button id="alg-min-btn" style="background:none;border:none;color:'+CREAM+';cursor:pointer;font-size:18px;padding:0 6px;" title="تصغير">&#8722;</button>'+
                '<button id="alg-close-btn" style="background:none;border:none;color:#965160;cursor:pointer;font-size:18px;padding:0 6px;" title="إغلاق">&#10005;</button>'+
            '</span>'+
        '</div>'+
        // BODY
        '<div id="alg-body" style="padding:14px;">'+
            // SETTINGS TABLE
            '<table class="alg-T" style="margin-bottom:12px;">'+
                '<tr><td class="alg-TH">الإعداد</td><td class="alg-TH">القيمة</td></tr>'+
                '<tr><td>احتياطي التجار</td><td style="text-align:center;"><input type="number" id="alg-nr_merchants_reserve" class="alg-IN" value="'+(saved.m||0)+'" min="0"></td></tr>'+
                '<tr><td>وقت البناء [ساعات] <span style="color:'+DIM+';font-size:11px;">(0 = تجاهل)</span></td><td style="text-align:center;"><input type="number" id="alg-time_construction" class="alg-IN" value="'+(saved.t||0)+'" min="0" max="50"></td></tr>'+
                '<tr><td>عامل التوزيع [0&#8209;1]</td><td style="text-align:center;"><input type="number" id="alg-nr_average_factor" class="alg-IN" value="'+(saved.f!==undefined?saved.f:1)+'" min="0" max="1" step="0.1"></td></tr>'+
                '<tr><td>عدد المجموعات</td><td style="text-align:center;"><input type="number" id="alg-nr_clusters" class="alg-IN" value="'+(saved.c||1)+'" min="1"></td></tr>'+
                '<tr id="alg-cap-row" style="display:none;"><td>سعة التاجر</td><td style="text-align:center;"><input type="number" id="alg-merchant_capacity" class="alg-IN" value="'+(saved.mc||1000)+'"></td></tr>'+
                '<tr><td>أقصى بناء</td><td style="text-align:center;"><input type="checkbox" id="alg-max_construction" '+(saved.mx?'checked':'')+' style="width:18px;height:18px;cursor:pointer;"></td></tr>'+
            '</table>'+
            // START BUTTON
            '<div style="text-align:center;margin-bottom:12px;">'+
                '<button class="alg-BIG-BTN" id="alg-start-btn">&#9654; ابدأ الموازنة</button>'+
            '</div>'+
            '<div id="alg-status" style="text-align:center;color:'+GOLD+';font-size:13px;min-height:22px;margin-bottom:10px;"></div>'+
            '<div id="alg-div_tables" hidden>'+
                '<div id="alg-stats-div" style="margin-bottom:8px;"></div>'+
                '<div id="alg-scroll"><div id="alg-sends-div"></div></div>'+
            '</div>'+
        '</div>'+
        // FOOTER
        '<div style="background:'+HDR+';padding:6px 14px;border-radius:0 0 6px 6px;border-top:1px solid '+BORDER+';text-align:center;font-size:11px;color:'+DIM+';">'+
            '&copy; AlGzawy 2024 &bull; موازنة الموارد v1.0 &bull; جميع الحقوق محفوظة &bull; <a href="https://github.com/TW-AlGzawy" style="color:'+GOLD+';">GitHub</a>'+
        '</div>'+
    '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    statusEl=document.getElementById('alg-status');

    try{if(['pt_PT','de_DE'].includes(game_data.locale)){document.getElementById('alg-cap-row').style.display='';}}catch(e){}

    // Drag
    var el=document.getElementById('alg-window'),hdr=document.getElementById('alg-hdr');
    var drag=false,sX,sY,sL,sT;
    hdr.onmousedown=function(e){
        if(e.target.tagName==='BUTTON')return;
        drag=true;sX=e.clientX;sY=e.clientY;
        var r=el.getBoundingClientRect();sL=r.left;sT=r.top;
        el.style.left=sL+'px';el.style.top=sT+'px';el.style.transform='none';
    };
    document.addEventListener('mousemove',function(e){if(!drag)return;el.style.left=(sL+e.clientX-sX)+'px';el.style.top=(sT+e.clientY-sY)+'px';});
    document.addEventListener('mouseup',function(){drag=false;});

    document.getElementById('alg-min-btn').onclick=function(){
        var b=document.getElementById('alg-body');
        var hidden=b.style.display==='none';
        b.style.display=hidden?'block':'none';
        this.textContent=hidden?'−':'+';
    };
    document.getElementById('alg-close-btn').onclick=function(){$('#alg-window').remove();};
    document.getElementById('alg-start-btn').onclick=function(){balancingResources();};

    // Save on change
    $('#alg-window input').on('change input',function(){
        try{
            localStorage.setItem(game_data.world+'_alg_bal_v1',JSON.stringify({
                m:document.getElementById('alg-nr_merchants_reserve').value,
                t:document.getElementById('alg-time_construction').value,
                f:document.getElementById('alg-nr_average_factor').value,
                c:document.getElementById('alg-nr_clusters').value,
                mc:document.getElementById('alg-merchant_capacity').value,
                mx:document.getElementById('alg-max_construction').checked
            }));
        }catch(e){}
    });
}

function buildTable(list_launches,obj_stats,list_production,list_clusters_stats){
    // Stats
    var sH='<table class="alg-T" style="font-size:12px;margin-bottom:4px;"><tr>'+
        '<td class="alg-TH" colspan="2"><button class="alg-BTN" id="alg-res-btn">النتائج</button>&nbsp;<button class="alg-BTN" id="alg-clust-btn">المجموعات</button></td>'+
        '<td class="alg-TH"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/wood.png"/></td>'+
        '<td class="alg-TH"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/stone.png"/></td>'+
        '<td class="alg-TH"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/iron.png"/></td></tr>'+
        '<tr><td colspan="2">الإجمالي</td><td>'+fmtN(obj_stats.total_wood_home)+'</td><td>'+fmtN(obj_stats.total_stone_home)+'</td><td>'+fmtN(obj_stats.total_iron_home)+'</td></tr>'+
        '<tr><td colspan="2">المتوسط</td><td>'+fmtN(obj_stats.avg_wood)+'</td><td>'+fmtN(obj_stats.avg_stone)+'</td><td>'+fmtN(obj_stats.avg_iron)+'</td></tr>'+
        '<tr><td colspan="2">الفائض</td><td>'+fmtN(obj_stats.total_wood_send)+'</td><td>'+fmtN(obj_stats.total_stone_send)+'</td><td>'+fmtN(obj_stats.total_iron_send)+'</td></tr>'+
        '<tr><td colspan="2">العجز</td><td>'+fmtN(obj_stats.total_wood_get)+'</td><td>'+fmtN(obj_stats.total_stone_get)+'</td><td>'+fmtN(obj_stats.total_iron_get)+'</td></tr>'+
    '</table>';
    document.getElementById('alg-stats-div').innerHTML=sH;

    // Sends table
    var tH='<div style="margin-bottom:6px;display:flex;gap:8px;align-items:center;">'+
        '<button id="alg-send-all-btn" class="alg-BIG-BTN" style="padding:6px 20px;font-size:13px;">&#9654;&#9654; إرسال الكل تلقائياً</button>'+
        '<span id="alg-send-all-status" style="font-size:12px;color:'+GOLD+';"></span>'+
        '</div>'+
        '<table class="alg-T" id="alg-sends-table" style="font-size:12px;"><tr>'+
        '<td class="alg-TH">م</td><td class="alg-TH" style="min-width:120px;">القرية المستهدفة</td>'+
        '<td class="alg-TH">أقصى مسافة</td><td class="alg-TH">إجمالي</td>'+
        '<td class="alg-TH"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/wood.png"/></td>'+
        '<td class="alg-TH"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/stone.png"/></td>'+
        '<td class="alg-TH"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/iron.png"/></td>'+
        '<td class="alg-TH">إرسال</td></tr>';

    if(list_launches.length===0){
        tH+='<tr><td colspan="8" style="text-align:center;padding:18px;color:'+GOLD+';">الموارد متوازنة بالفعل &mdash; لا شيء للإرسال</td></tr>';
    } else {
        for(var i=0;i<list_launches.length;i++){
            var dat=JSON.stringify(list_launches[i].send_resources).replace(/'/g,'&apos;');
            tH+='<tr id="alg-row-'+i+'">'+
                '<td style="text-align:center;">'+(i+1)+'</td>'+
                '<td><a href="'+game_data.link_base_pure+'info_village&id='+list_launches[i].target_id+'" style="color:'+GOLD+';">'+list_launches[i].name_destination+'</a></td>'+
                '<td style="text-align:center;">'+list_launches[i].distance.toFixed(1)+'</td>'+
                '<td style="text-align:center;">'+fmtN(list_launches[i].total_send)+'</td>'+
                '<td style="text-align:center;">'+fmtN(list_launches[i].total_wood)+'</td>'+
                '<td style="text-align:center;">'+fmtN(list_launches[i].total_stone)+'</td>'+
                '<td style="text-align:center;">'+fmtN(list_launches[i].total_iron)+'</td>'+
                '<td style="text-align:center;"><button class="alg-SEND-BTN" data-row="'+i+'" data-tid="'+list_launches[i].target_id+'" data-res=\''+dat+'\'>إرسال</button></td>'+
            '</tr>';
        }
    }
    tH+='</table>';
    document.getElementById('alg-sends-div').innerHTML=tH;

    // Bind send buttons
    $('.alg-SEND-BTN').on('click',function(){
        if($(this).is(':disabled'))return;
        var row=$(this).data('row');
        var tid=$(this).data('tid');
        var res=JSON.parse($(this).attr('data-res'));
        $('.alg-SEND-BTN').prop('disabled',true);
        sendResources(tid,res);
        window.setTimeout(function(){
            $('#alg-row-'+row).remove();
            $('.alg-SEND-BTN').prop('disabled',false);
        },250);
    });

    // Send All button
    document.getElementById('alg-send-all-btn').onclick=function(){
        autoSendAll(null,false);
    };

    // Enter key
    if($('.alg-SEND-BTN').length>0)$('.alg-SEND-BTN').first().focus();
    window.onkeydown=function(e){if(e.which===13&&$('.alg-SEND-BTN:not(:disabled)').length>0)$('.alg-SEND-BTN:not(:disabled)').first().click();};

    // Stats buttons
    document.getElementById('alg-res-btn').onclick=function(){buildResultsDialog(list_production,obj_stats);};
    document.getElementById('alg-clust-btn').onclick=function(){buildClustersDialog(list_clusters_stats);};
}

function buildResultsDialog(list_production,obj_stats){
    var html='<div style="max-height:70vh;overflow:auto;direction:rtl;"><table class="alg-T" style="font-size:12px;min-width:500px;">'+
        '<tr><td class="alg-TH">الإحداثيات</td><td class="alg-TH">النقاط</td><td class="alg-TH">تجار</td>'+
        '<td class="alg-TH" colspan="2"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/wood.png"/></td>'+
        '<td class="alg-TH" colspan="2"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/stone.png"/></td>'+
        '<td class="alg-TH" colspan="2"><img src="https://dsen.innogamescdn.com/asset/c2e59f13/graphic/buildings/iron.png"/></td></tr>';
    for(var i=0;i<list_production.length;i++){
        var p=list_production[i];
        var gC=p.result_wood>=0?'#013e27':'#372330';
        var sC=p.result_stone>=0?'#013e27':'#372330';
        var iC=p.result_iron>=0?'#013e27':'#372330';
        html+='<tr><td><a href="'+game_data.link_base_pure+'info_village&id='+p.id+'" style="color:'+GOLD+';">'+p.coord+'</a></td>'+
            '<td style="text-align:center;">'+fmtN(p.points||0)+'</td>'+
            '<td style="text-align:center;">'+(p.merchantAvailable||0)+'/'+p.merchants_total+'</td>'+
            '<td style="text-align:center;">'+fmtN(p.wood)+'</td><td style="background:'+gC+';text-align:center;">'+(p.result_wood>=0?'+':'')+fmtN(p.result_wood||0)+'</td>'+
            '<td style="text-align:center;">'+fmtN(p.stone)+'</td><td style="background:'+sC+';text-align:center;">'+(p.result_stone>=0?'+':'')+fmtN(p.result_stone||0)+'</td>'+
            '<td style="text-align:center;">'+fmtN(p.iron)+'</td><td style="background:'+iC+';text-align:center;">'+(p.result_iron>=0?'+':'')+fmtN(p.result_iron||0)+'</td></tr>';
    }
    html+='</table></div>';
    Dialog.show('content',html);
}

function buildClustersDialog(list_clusters_stats){
    var html='<div style="max-height:70vh;overflow:auto;direction:rtl;"><table class="alg-T" style="font-size:12px;min-width:400px;">'+
        '<tr><td class="alg-TH">م</td><td class="alg-TH">قرى</td><td class="alg-TH">المركز</td><td class="alg-TH">أقصى مسافة</td></tr>';
    for(var i=0;i<list_clusters_stats.length;i++){
        var c=list_clusters_stats[i];
        html+='<tr><td style="text-align:center;">'+(i+1)+'</td><td style="text-align:center;">'+c.nr_coords+'</td><td style="text-align:center;">'+c.center+'</td><td style="text-align:center;">'+c.max_distance.toFixed(1)+'</td></tr>';
    }
    html+='</table></div>';
    Dialog.show('content',html);
}

// ===== MINI PANEL (auto-run) =====
var autoTimer=null,countdownTimer=null,autoEnabled=false;

function buildMiniPanel(){
    var _ex=document.getElementById('alg-mini-panel');if(_ex)_ex.parentNode.removeChild(_ex);

    var top=GM_getValue('alg_bal_miniTop','200px');
    var left=GM_getValue('alg_bal_miniLeft','8px');
    var minimized=GM_getValue('alg_bal_miniMin',false);
    var interval=GM_getValue('alg_bal_interval',7200);
    autoEnabled=GM_getValue('alg_bal_autoEnabled',false);

    var p=document.createElement('div');
    p.id='alg-mini-panel';
    p.style.cssText='position:fixed;top:'+top+';left:'+left+';z-index:99999;background:'+BG+';border:2px solid '+BORDER+';border-radius:8px;font-family:Trebuchet MS,sans-serif;font-size:13px;color:'+CREAM+';direction:rtl;min-width:190px;box-shadow:3px 3px 10px rgba(0,0,0,0.6);user-select:none;';

    var bodyStyle='padding:10px;display:'+(minimized?'none':'block')+';';
    var inpS='background:#07111c;color:'+CREAM+';border:1px solid '+BORDER+';padding:3px 6px;border-radius:3px;width:100%;box-sizing:border-box;';

    p.innerHTML=
        '<div id="alg-mini-hdr" style="background:linear-gradient(to bottom,'+HDR+','+BG2+');color:'+GOLD+';padding:7px 10px;border-radius:6px 6px 0 0;cursor:move;display:flex;justify-content:space-between;align-items:center;">'+
            '<b style="font-size:12px;">&#9878; AlGzawy - الموازنة</b>'+
            '<button id="alg-mini-min" style="background:none;border:none;color:'+CREAM+';cursor:pointer;font-size:16px;line-height:1;padding:0 4px;">'+(minimized?'+':'−')+'</button>'+
        '</div>'+
        '<div id="alg-mini-body" style="'+bodyStyle+'">'+
            '<div style="margin-bottom:6px;">'+
                '<label style="display:block;margin-bottom:2px;font-size:11px;color:'+DIM+';">الفترة (ثانية)</label>'+
                '<input id="alg-mini-interval" type="number" min="60" value="'+interval+'" style="'+inpS+'">'+
            '</div>'+
            '<button id="alg-mini-run" style="width:100%;padding:7px;border-radius:4px;border:1px solid '+BORDER+';cursor:pointer;font-weight:bold;font-size:13px;margin-bottom:6px;background:'+(autoEnabled?'linear-gradient(to bottom,#392532,#372330)':'linear-gradient(to bottom,#247a68,#143e3a)')+';color:'+(autoEnabled?'#f2abb1':'#eaf3f8')+';">'+(autoEnabled?'&#9632; إيقاف':'&#9654; تشغيل تلقائي')+'</button>'+
            '<div id="alg-mini-status" style="text-align:center;font-size:11px;color:'+GOLD+';min-height:16px;margin-bottom:6px;">'+(autoEnabled?'جاري...':'متوقف')+'</div>'+
            '<button id="alg-mini-open" style="width:100%;padding:5px;border-radius:4px;border:1px solid '+BORDER+';cursor:pointer;font-size:12px;background:linear-gradient(to bottom,#123e3d,#13283a);color:'+CREAM+';">&#9881; فتح الإعدادات</button>'+
            '<div style="text-align:center;margin-top:8px;font-size:10px;color:'+DIM+';border-top:1px solid '+BORDER+';padding-top:6px;">AlGzawy &bull; موازنة v1.0</div>'+
        '</div>';

    document.body.appendChild(p);

    // Drag
    var drag=false,sX,sY,sL,sT;
    var hdrEl=document.getElementById('alg-mini-hdr');
    hdrEl.onmousedown=function(e){
        if(e.target.tagName==='BUTTON')return;
        drag=true;sX=e.clientX;sY=e.clientY;
        var r=p.getBoundingClientRect();sL=r.left;sT=r.top;
        p.style.left=sL+'px';p.style.top=sT+'px';
    };
    document.addEventListener('mousemove',function(e){
        if(!drag)return;
        p.style.left=(sL+e.clientX-sX)+'px';
        p.style.top=(sT+e.clientY-sY)+'px';
    });
    document.addEventListener('mouseup',function(){
        if(!drag)return;
        drag=false;
        GM_setValue('alg_bal_miniTop',p.style.top);
        GM_setValue('alg_bal_miniLeft',p.style.left);
    });

    // Minimize
    document.getElementById('alg-mini-min').onclick=function(){
        var b=document.getElementById('alg-mini-body');
        var isMin=b.style.display==='none';
        b.style.display=isMin?'block':'none';
        this.textContent=isMin?'−':'+';
        GM_setValue('alg_bal_miniMin',!isMin);
    };

    // Open main
    document.getElementById('alg-mini-open').onclick=function(){
        createMainInterface();
    };

    // Toggle auto-run
    document.getElementById('alg-mini-run').onclick=function(){
        var iv=parseInt(document.getElementById('alg-mini-interval').value)||7200;
        GM_setValue('alg_bal_interval',iv);
        autoEnabled=!autoEnabled;
        GM_setValue('alg_bal_autoEnabled',autoEnabled);
        if(autoEnabled){
            this.style.background='linear-gradient(to bottom,#392532,#372330)';
            this.style.color='#f2abb1';
            this.innerHTML='&#9632; إيقاف';
            startAutoRun(iv);
        } else {
            this.style.background='linear-gradient(to bottom,#247a68,#143e3a)';
            this.style.color='#eaf3f8';
            this.innerHTML='&#9654; تشغيل تلقائي';
            stopAutoRun();
            setMiniStatus('متوقف');
        }
    };

    if(autoEnabled){
        var iv=parseInt(GM_getValue('alg_bal_interval',7200))||7200;
        startAutoRun(iv);
    }
}

function setMiniStatus(msg){
    var el=document.getElementById('alg-mini-status');
    if(el)el.textContent=msg;
}

function autoSendAll(onComplete,closeAfter){
    var allBtns=$('.alg-SEND-BTN:not(:disabled)');
    var total=allBtns.length,sent=0;
    var sendBtn=document.getElementById('alg-send-all-btn');
    var statusEl=document.getElementById('alg-send-all-status');
    if(total===0){
        if(closeAfter){var w=document.getElementById('alg-window');if(w)w.parentNode.removeChild(w);setMiniStatus('متوازن ✓');}
        if(onComplete)onComplete();
        return;
    }
    if(sendBtn){sendBtn.disabled=true;sendBtn.style.opacity='0.6';}
    if(statusEl)statusEl.textContent='0 / '+total;
    function sendNext(idx){
        if(idx>=total){
            if(statusEl)statusEl.textContent='تم إرسال '+sent+' طلب';
            if(sendBtn){sendBtn.disabled=false;sendBtn.style.opacity='1';}
            if(closeAfter){
                window.setTimeout(function(){
                    var w=document.getElementById('alg-window');
                    if(w)w.parentNode.removeChild(w);
                    setMiniStatus('اكتمل ✓');
                    if(onComplete)onComplete();
                },600);
            } else {
                if(onComplete)onComplete();
            }
            return;
        }
        var b=allBtns[idx];
        if(!b||$(b).closest('tr').length===0){sendNext(idx+1);return;}
        var row=$(b).data('row');
        var tid=$(b).data('tid');
        var res;
        try{res=JSON.parse($(b).attr('data-res'));}catch(e){sendNext(idx+1);return;}
        var ok=sendResources(tid,res);
        if(!ok){console.error('[AlGzawy Balance] فشل الإرسال للقرية',tid);sendNext(idx+1);return;}
        sent++;
        if(statusEl)statusEl.textContent=sent+' / '+total;
        window.setTimeout(function(){
            $('#alg-row-'+row).remove();
            sendNext(idx+1);
        },400);
    }
    sendNext(0);
}

function stopAutoRun(){
    if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}
    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
}

function startAutoRun(intervalSec){
    stopAutoRun();
    function runCycle(){
        setMiniStatus('جاري تحضير النافذة...');
        createMainInterface();
        window.setTimeout(function(){
            setMiniStatus('جاري الموازنة...');
            balancingResources().then(function(){
                setMiniStatus('جاري الإرسال...');
                window.setTimeout(function(){
                    autoSendAll(function(){
                        scheduleNext(intervalSec);
                    },true);
                },500);
            }).catch(function(e){
                console.error('[AlGzawy Balance] خطأ في الموازنة التلقائية:',e);
                var w=document.getElementById('alg-window');
                if(w)w.parentNode.removeChild(w);
                setMiniStatus('خطأ - سيعاد المحاولة');
                scheduleNext(intervalSec);
            });
        },800);
    }
    function scheduleNext(sec){
        var end=Date.now()+sec*1000;
        countdownTimer=setInterval(function(){
            var rem=Math.max(0,Math.round((end-Date.now())/1000));
            var h=Math.floor(rem/3600),m=Math.floor((rem%3600)/60),s=rem%60;
            setMiniStatus('التالي: '+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s);
            if(rem<=0){clearInterval(countdownTimer);}
        },1000);
        autoTimer=setTimeout(function(){
            clearInterval(countdownTimer);
            runCycle();
        },sec*1000);
    }
    runCycle();
}

// ===== INIT =====
buildMiniPanel();

})();


// Portal palette: scoped presentation only; no engine settings or scheduling changes.
(function () {
  const id='alg-portal-colors-alg-balance';
  if(document.getElementById(id))return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=":is(#alg-window,#alg-mini-panel){background-color:#102031;color:#eaf3f8;border-color:#263c4f;color-scheme:dark}\n:is(#alg-window,#alg-mini-panel) :is(input,select,textarea){background-color:#07111c;color:#eaf3f8;border-color:#263c4f;accent-color:#40e1bf;color-scheme:dark}\n:is(#alg-window,#alg-mini-panel) :is(button,.btn){background-color:#143e3a;background-image:none;color:#eaf3f8;border-color:#286459}\n:is(#alg-window,#alg-mini-panel) :is(button,a,input,select,textarea):focus-visible{outline-color:#40e1bf}\n:is(#alg-window,#alg-mini-panel) :is(th,td){border-color:#263c4f}\n:is(#alg-window,#alg-mini-panel) option{background-color:#07111c;color:#eaf3f8}";
  (document.head||document.documentElement).appendChild(style);
})();
