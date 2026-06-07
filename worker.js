const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization,X-GIOAI-Token'};
function handleOptions(r){if(r.method==='OPTIONS')return new Response(null,{status:204,headers:CORS})}
function json(d,s){s=s||200;return new Response(JSON.stringify(d),{status:s,headers:{...CORS,'Content-Type':'application/json'}})}
function encVar(v){var b=[];while(true){var g=v&0x7F;v>>=7;if(v)g|=0x80;b.push(g);if(!v)break}return new Uint8Array(b)}
function proto(parts){var c=[];for(var i=0;i<parts.length;i++){var f=parts[i][0],w=parts[i][1],v=parts[i][2];c.push(encVar((f<<3)|w));if(w===0){c.push(encVar(v))}else if(w===2){if(v instanceof Uint8Array){c.push(encVar(v.length));c.push(v)}else if(Array.isArray(v)){var inner=proto(v);c.push(encVar(inner.length));c.push(inner)}else{var e=new TextEncoder().encode(String(v));c.push(encVar(e.length));c.push(e)}}}var t=0;for(var i=0;i<c.length;i++)t+=c[i].length;var buf=new Uint8Array(t);var o=0;for(var i=0;i<c.length;i++){buf.set(c[i],o);o+=c[i].length}return buf}
async function grpc(tk,ep,parts,sid){sid=sid||'';var p=proto(parts);var h={'Authorization':'Bearer '+tk,'Content-Type':'application/grpc-web+proto','x-grpc-web':'1','x-server-offset':'0','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'};if(sid)h['x-session-id']=sid;var r=await fetch(ep,{method:'POST',headers:h,body:p});if(r.status!==200)return null;return new Uint8Array(await r.arrayBuffer())}
function btoaBytes(bytes){return btoa(Array.from(bytes).map(function(c){return String.fromCharCode(c)}).join(''))}

// ===== FCAPTCHA BYPASS with jitter & anti-tracking =====
function genFCaptchaToken(){
  var jitter=Math.random()*500-250; // +/- 250ms jitter
  var interactions=['click','scroll','keypress','mousemove','focus','blur'];
  var fakeSig={
    timestamp:Date.now()+jitter,
    score:0.03+Math.random()*0.25, // random score 0.03-0.28
    id:'fc_'+Math.random().toString(36).substr(2,12),
    v:'1.10.1',
    s:Math.floor(Math.random()*9)+1, // random session strength
    t:interactions[Math.floor(Math.random()*interactions.length)], // random interaction type
    r:Math.random().toString(36).substr(2,6) // random nonce
  };
  // Encode with slight mutation to avoid fingerprinting
  var raw=btoa(JSON.stringify(fakeSig));
  // Randomly swap one char to break pattern matching
  var pos=Math.floor(Math.random()*(raw.length-2))+1;
  return raw.slice(0,pos)+String.fromCharCode(65+Math.floor(Math.random()*26))+raw.slice(pos+1);
}

async function handleRequest(r){
if(r.method==='OPTIONS')return handleOptions(r);
var url=new URL(r.url),path=url.pathname;
if(url.searchParams.has('url')){var target=url.searchParams.get('url');var body=r.method==='POST'?await r.text():null;var h={};r.headers.forEach(function(v,k){h[k]=v});var f=await fetch(target,{method:r.method,headers:h,body:body});var rh={...CORS};f.headers.forEach(function(v,k){if(!['set-cookie','access-control-allow-origin'].includes(k.toLowerCase()))rh[k]=v});return new Response(await f.text(),{status:f.status,headers:rh})}
try{

// ===== SPARX SCHOOL SEARCH (v5.2 style) =====
if(path==='/api/sparx/search-school'&&r.method==='POST'){var b=await r.json();if(!b.query)return json({error:'query required'},400);
  var schools=await(await fetch('https://static.sparx-learning.com/sl/spx001/data.txt')).text();
  var lines=schools.split('\n').slice(1);
  var results=lines.map(function(l){var p=l.split(',');return{id:p[0],name:p[1],town:p[2]||''}}).filter(function(s){return s.name.toLowerCase().includes(b.query.toLowerCase())}).slice(0,15);
  return json({results:results,count:results.length})}

// ===== SPARX MATHS =====
if(path==='/api/sparx/login'&&r.method==='POST'){b=await r.json();if(!b.username||!b.password)return json({error:'username and password required'},400);var tokResp=await fetch('https://auth.sparxmaths.uk/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'application/json','Origin':'https://maths.sparx-learning.com','Referer':'https://maths.sparx-learning.com/'},body:new URLSearchParams({client_id:'sparx-maths-sw',hd:b.schoolId||'1',username:b.username,password:b.password,grant_type:'password',scope:'openid profile email'})});if(tokResp.ok){try{var d=await tokResp.json();if(d.access_token)return json({token:d.access_token,session_id:d.session_state||'',username:b.username})}catch(e){}}var params=new URLSearchParams({client_id:'sparx-maths-sw',hd:b.schoolId||'1',response_type:'code',scope:'openid profile email',redirect_uri:'https://maths.sparx-learning.com/oauth2/callback'});var page=await fetch('https://auth.sparxmaths.uk/oauth2/auth?'+params,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'text/html'},redirect:'manual'});var html=await page.text();var csrfMatch=html.match(/name=["']_csrf["'][^>]*value=["']([^"']+)["']/);if(!csrfMatch)return json({error:'Login failed'},401);var csrf=csrfMatch[1];var stateMatch=html.match(/name=["']state["'][^>]*value=["']([^"']+)["']/);var state=stateMatch?stateMatch[1]:'';var loginResp=await fetch('https://auth.sparxmaths.uk/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Origin':'https://auth.sparxmaths.uk'},redirect:'manual',body:new URLSearchParams({_csrf:csrf,state:state,username:b.username,password:b.password})});var location=loginResp.headers.get('Location')||'';var codeMatch=location.match(/[?&]code=([^&#]+)/);if(!codeMatch)return json({error:'Login failed: wrong credentials'},401);var code=codeMatch[1];var tokenResp=await fetch('https://auth.sparxmaths.uk/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'application/json'},body:new URLSearchParams({client_id:'sparx-maths-sw',code:code,grant_type:'authorization_code',redirect_uri:'https://maths.sparx-learning.com/oauth2/callback',hd:b.schoolId||'1'})});if(!tokenResp.ok)return json({error:'Token exchange failed'},401);d=await tokenResp.json();return json({token:d.access_token,session_id:d.session_state||'',username:b.username})}
if(path==='/api/sparx/homeworks'&&r.method==='POST'){b=await r.json();if(!b.token)return json({error:'token required'},400);var raw=await grpc(b.token,'https://studentapi.api.sparxmaths.uk/sparx.swworker.v1.Sparxweb/GetPackageListForActiveUser',[[1,0,1]],b.session_id);return json({raw:raw?btoaBytes(raw):null})}
if(path==='/api/sparx/tasks'&&r.method==='POST'){b=await r.json();if(!b.token||!b.packageId)return json({error:'token and packageId required'},400);raw=await grpc(b.token,'https://studentapi.api.sparxmaths.uk/sparx.swworker.v1.Sparxweb/GetTaskList',[[1,0,1],[2,2,[[3,2,b.packageId]]]],b.session_id);return json({raw:raw?btoaBytes(raw):null})}
if(path==='/api/sparx/activity'&&r.method==='POST'){b=await r.json();if(!b.token||!b.packageId)return json({error:'token and packageId required'},400);raw=await grpc(b.token,'https://studentapi.api.sparxmaths.uk/sparx.swworker.v1.Sparxweb/GetActivity',[[1,0,1],[2,2,[[3,2,b.packageId],[5,0,b.taskIndex||0],[6,2,[[5,0,b.activityId||0]]]]]],b.session_id);return json({raw:raw?btoaBytes(raw):null})}
if(path==='/api/sparx/submit'&&r.method==='POST'){b=await r.json();if(!b.token||!b.packageId||!b.answers)return json({error:'token, packageId, answers required'},400);raw=await grpc(b.token,'https://studentapi.api.sparxmaths.uk/sparx.swworker.v1.Sparxweb/SubmitAnswer',[[1,0,1],[2,2,[[3,2,b.packageId],[5,0,b.taskIndex||0],[6,2,[[5,0,b.activityId||0]]]]],[3,2,JSON.stringify(b.answers)]],b.session_id);return json({raw:raw?btoaBytes(raw):null})}
if(path==='/api/sparx/bookwork'&&r.method==='POST'){b=await r.json();if(!b.token||!b.packageId||b.answer===undefined)return json({error:'token, packageId, answer required'},400);raw=await grpc(b.token,'https://studentapi.api.sparxmaths.uk/sparx.swworker.v1.Sparxweb/SubmitBookworkCheck',[[1,0,1],[2,2,[[3,2,b.packageId],[5,0,b.taskIndex||0],[6,2,[[5,0,b.activityId||0]]]]],[3,2,String(b.answer)]],b.session_id);return json({raw:raw?btoaBytes(raw):null})}
if(path==='/api/sparx/regstart'&&r.method==='POST'){b=await r.json();if(!b.token||!b.activityId)return json({error:'token and activityId required'},400);raw=await grpc(b.token,'https://studentapi.api.sparxmaths.uk/sparx.swworker.v1.Sparxweb/RegStart',[[1,0,1],[2,2,[[5,0,b.activityId]]]],b.session_id);return json({raw:raw?btoaBytes(raw):null})}

// ===== AI SOLVE with Working Out (Gemini + Groq + Mistral) =====
if(path==='/api/ai/solve'&&r.method==='POST'){b=await r.json();if(!b.question)return json({error:'question required'},400);
  var providers=[];
  if(env.GEMINI_KEY)providers.push('gemini');
  if(env.GROQ_KEY)providers.push('groq');
  if(env.MISTRAL_KEY)providers.push('mistral');
  if(!providers.length)return json({error:'No AI key configured. Set GEMINI_KEY, GROQ_KEY, or MISTRAL_KEY'},400);
  var provider=providers[Math.floor(Math.random()*providers.length)];
  var showWorking=b.showWorking!==false;
  var prompt='Solve this Sparx Maths question. '+ (showWorking?'Show full step-by-step working out. ':'') +'Return the final answer on a separate line starting with "ANSWER:" (exactly). If showing working, put it before the ANSWER line.\nQuestion: '+b.question;
  var answer,working;
  if(provider==='gemini'){
    var resp=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key='+env.GEMINI_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.7,maxOutputTokens:1024}})});
    d=await resp.json();var text=(d&&d.candidates&&d.candidates[0]&&d.candidates[0].content&&d.candidates[0].content.parts&&d.candidates[0].content.parts[0]&&d.candidates[0].content.parts[0].text||'').trim();
    var aMatch=text.match(/ANSWER:\s*(.+)/i);answer=aMatch?aMatch[1].trim():text.split('\n').pop().trim();working=text.replace(/ANSWER:\s*.+/i,'').trim()}
  else if(provider==='groq'){
    resp=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.GROQ_KEY},body:JSON.stringify({model:'mixtral-8x7b-32768',messages:[{role:'user',content:prompt}],temperature:0.7,max_tokens:1024})});
    d=await resp.json();text=(d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content||'').trim();
    aMatch=text.match(/ANSWER:\s*(.+)/i);answer=aMatch?aMatch[1].trim():text.split('\n').pop().trim();working=text.replace(/ANSWER:\s*.+/i,'').trim()}
  else if(provider==='mistral'){
    resp=await fetch('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.MISTRAL_KEY},body:JSON.stringify({model:'mistral-large-latest',messages:[{role:'user',content:prompt}],temperature:0.7,max_tokens:1024})});
    d=await resp.json();text=(d&&d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content||'').trim();
    aMatch=text.match(/ANSWER:\s*(.+)/i);answer=aMatch?aMatch[1].trim():text.split('\n').pop().trim();working=text.replace(/ANSWER:\s*.+/i,'').trim()}
  return json({answer:answer,working:working||null,provider:provider})}

// ===== LANGUAGE NUT =====
if(path==='/api/lnut/login'&&r.method==='POST'){b=await r.json();if(!b.username||!b.password)return json({error:'username and password required'},400);
  var fToken=genFCaptchaToken();
  // Add random delay to mimic human timing
  await new Promise(function(r){setTimeout(r,Math.random()*800+200)});
  var resp=await fetch('https://api.languagenut.com/loginController/attemptLogin?'+new URLSearchParams({username:b.username,pass:b.password,friendlyCaptchaToken:fToken}),{
    method:'POST',headers:{'User-Agent':randomUA(),'Accept':'application/json','Referer':'https://www.languagenut.com/','Origin':'https://www.languagenut.com','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}});
  if(!resp.ok)return json({error:'Login failed HTTP: '+resp.status},401);
  d=await resp.json();
  if(!d.newToken)return json({error:d.loginError||'Login failed: no token'},401);
  return json({token:d.newToken,username:b.username,user:d.user||{},loginData:d})}
if(path==='/api/lnut/homeworks'&&r.method==='POST'){b=await r.json();if(!b.token)return json({error:'token required'},400);resp=await fetch('https://api.languagenut.com/assignmentController/getViewableAll?token='+b.token,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}});return json(await resp.json())}
if(path==='/api/lnut/module-translations'&&r.method==='POST'){b=await r.json();if(!b.token)return json({error:'token required'},400);resp=await fetch('https://api.languagenut.com/translationController/getUserModuleTranslations?token='+b.token,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}});return json(await resp.json())}
if(path==='/api/lnut/public-translations'&&r.method==='GET'){resp=await fetch('https://api.languagenut.com/publicTranslationController/getTranslations',{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}});return json(await resp.json())}
if(path==='/api/lnut/score'&&r.method==='POST'){b=await r.json();if(!b.token||!b.scoreData)return json({error:'token and scoreData required'},400);
  var fToken2=genFCaptchaToken();var sd=b.scoreData;var ts=new Date().toISOString().replace('Z','.000Z');
  await new Promise(function(r){setTimeout(r,Math.random()*300+100)});
  resp=await fetch('https://api.languagenut.com/gameDataController/addGameScore',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','User-Agent':randomUA()},body:new URLSearchParams({token:b.token,moduleUid:sd.moduleUid||'',gameUid:sd.gameUid||'',gameType:sd.gameType||'',isTest:sd.isTest!==false?'true':'false',toietf:sd.toietf||'',fromietf:sd.fromietf||'en-US',score:String(sd.score||200),correctVocabUids:JSON.stringify(sd.correctVocabUids||sd.correctUids||[]),incorrectVocabUids:JSON.stringify(sd.incorrectVocabUids||sd.incorrectUids||[]),homeworkUid:sd.homeworkUid||'',isSentence:sd.isSentence?'true':'false',timeStamp:ts,vocabNumber:String(sd.vocabNumber||''),rel_module_uid:sd.rel_module_uid||'',dontStoreStats:'true',product:'secondary',friendlyCaptchaToken:fToken2})});
  return json(resp.ok?await resp.json():{error:resp.statusText},resp.status)}
if(path==='/api/lnut/vocab'&&r.method==='POST'){b=await r.json();if(!b.token||!b.curriculumUid)return json({error:'token and curriculumUid required'},400);resp=await fetch('https://api.languagenut.com/gameDataController/getGameVocab?curriculumUid='+b.curriculumUid+'&product=secondary&_='+Date.now()+'&token='+b.token,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}});return json(await resp.json())}

// ===== SENECA LEARNING =====
if(path==='/api/seneca/login'&&r.method==='POST'){b=await r.json();if(!b.email||!b.password)return json({error:'email and password required'},400);
  resp=await fetch('https://auth.app.senecalearning.com/api/login',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':randomUA(),'Origin':'https://app.senecalearning.com','Referer':'https://app.senecalearning.com/'},body:JSON.stringify({email:b.email,password:b.password})});
  if(!resp.ok)return json({error:'Login failed: '+resp.status},401);d=await resp.json();
  if(!d||!d.idToken)return json({error:'Login failed: no idToken'},401);
  return json({idToken:d.idToken,refreshToken:d.refreshToken||'',localId:d.localId||'',username:b.email})}
if(path==='/api/seneca/courses'&&r.method==='POST'){b=await r.json();if(!b.idToken)return json({error:'idToken required'},400);
  resp=await fetch('https://course.app.senecalearning.com/api/courses',{headers:{'access-key':b.idToken,'User-Agent':randomUA(),'Origin':'https://app.senecalearning.com'}});
  if(!resp.ok)return json({error:'Failed to fetch courses'},401);return json(await resp.json())}
if(path==='/api/seneca/sections'&&r.method==='POST'){b=await r.json();if(!b.idToken||!b.courseId)return json({error:'idToken and courseId required'},400);
  resp=await fetch('https://course.app.senecalearning.com/api/courses/'+b.courseId+'/sections',{headers:{'access-key':b.idToken,'User-Agent':randomUA(),'Origin':'https://app.senecalearning.com'}});
  if(!resp.ok)return json({error:'Failed to fetch sections'},401);return json(await resp.json())}
if(path==='/api/seneca/signed-url'&&r.method==='POST'){b=await r.json();if(!b.idToken||!b.courseId||!b.sectionId)return json({error:'idToken, courseId, sectionId required'},400);
  resp=await fetch('https://course.app.senecalearning.com/api/courses/'+b.courseId+'/signed-url?sectionId='+b.sectionId+'&contentTypes=standard,hardestQuestions',{headers:{'access-key':b.idToken,'User-Agent':randomUA(),'Origin':'https://app.senecalearning.com'}});
  if(!resp.ok)return json({error:'Failed to get signed URL'},401);return json(await resp.json())}
if(path==='/api/seneca/submit-session'&&r.method==='POST'){b=await r.json();if(!b.idToken||!b.sessionData)return json({error:'idToken and sessionData required'},400);
  resp=await fetch('https://session.app.senecalearning.com/api/session',{method:'POST',headers:{'Content-Type':'application/json','access-key':b.idToken,'User-Agent':randomUA(),'Origin':'https://app.senecalearning.com','Referer':'https://app.senecalearning.com/'},body:JSON.stringify(b.sessionData)});
  if(!resp.ok)return json({error:'Submit failed: '+resp.status},401);return json(await resp.json())}

// ===== ADMIN / SLOTS =====
if(path==='/api/admin/give-slots'&&r.method==='POST'){b=await r.json();if(!b.username||!b.amount)return json({error:'username and amount required'},400);
  var adminKey=env.ADMIN_KEY||'gioai-default-admin-key';
  if(b.adminKey!==adminKey)return json({error:'Invalid admin key'},403);
  return json({success:true,user:b.username,slotsAdded:parseInt(b.amount),totalSlots:b.amount,message:'Added '+b.amount+' slots to '+b.username})}

// ===== STATUS =====
if(path==='/api/keys'&&r.method==='GET'){return json({worker:'gioai-v3',platforms:['sparx','languagenut','seneca'],status:'operational',endpoints:['POST /api/sparx/search-school','POST /api/sparx/login','POST /api/sparx/homeworks','POST /api/sparx/tasks','POST /api/sparx/activity','POST /api/sparx/submit','POST /api/sparx/bookwork','POST /api/sparx/regstart','POST /api/ai/solve','POST /api/lnut/login','POST /api/lnut/homeworks','POST /api/lnut/score','POST /api/lnut/vocab','POST /api/seneca/login','POST /api/seneca/courses','POST /api/seneca/sections','POST /api/seneca/signed-url','POST /api/seneca/submit-session','POST /api/admin/give-slots']})}

// ===== USER AGENT ROTATION =====
function randomUA(){
  var agents=[
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  ];
  return agents[Math.floor(Math.random()*agents.length)];
}

return json({error:'Not found',path:path},404)}catch(e){return json({error:e.message},500)}}
addEventListener('fetch',function(event){event.respondWith(handleRequest(event.request))});

