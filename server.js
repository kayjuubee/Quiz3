import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { networkInterfaces } from 'node:os';
import { randomUUID, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import fs from 'node:fs';

const app=express(), http=createServer(app), io=new Server(http);
app.use(express.json({limit:'1mb'}));
const PORT=process.env.PORT||3000;
const defaultQuizzes=[{id:'saalfeld',title:'Saalfeld-Quiz',questions:[
 {type:'single',text:'In welchem Bundesland liegt Saalfeld?',options:['Thüringen','Sachsen','Bayern','Hessen'],correct:0,time:20},
 {type:'boolean',text:'Saalfeld liegt an der Saale.',correct:true,time:15},
 {type:'multi',text:'Welche Orte liegen in Thüringen?',options:['Saalfeld','Jena','Leipzig','Erfurt'],correct:[0,1,3],time:25},
 {type:'estimate',text:'In welchem Jahr wurde Saalfeld erstmals urkundlich erwähnt?',correct:899,tolerance:30,time:30},
 {type:'order',text:'Sortiere diese Zahlen aufsteigend.',options:['7','2','9','4'],correct:[1,3,0,2],time:30},
 {type:'text',text:'Wie heißt der Fluss, der durch Saalfeld fließt?',correct:'Saale',time:20},
 {type:'logic',text:'Was wird nasser, während es trocknet?',options:['Ein Handtuch','Ein Stein','Eine Kerze','Ein Schuh'],correct:0,time:25}
]}];
const kidsQuiz={id:'kinder',title:'KayJuuBee Kinderquiz',kids:true,questions:[
{type:'single',text:'Welches Tier macht Miau?',options:['Hund 🐶','Katze 🐱','Kuh 🐮'],correct:1,time:35},
{type:'single',text:'Welche Farbe hat eine reife Banane meistens?',options:['Blau 💙','Gelb 💛','Lila 💜'],correct:1,time:35},
{type:'single',text:'Wie viele Beine hat eine Spinne?',options:['6','8','10'],correct:1,time:40},
{type:'boolean',text:'Ein Fisch lebt im Wasser. 🐟',correct:true,time:35},
{type:'single',text:'Was brauchst du bei Regen?',options:['Regenschirm ☂️','Sonnenbrille 🕶️','Badehose 🩳'],correct:0,time:35},
{type:'single',text:'Was ist größer?',options:['Maus 🐭','Elefant 🐘','Marienkäfer 🐞'],correct:1,time:35},
{type:'single',text:'Welche Jahreszeit kommt nach dem Sommer?',options:['Frühling 🌷','Herbst 🍂','Winter ❄️'],correct:1,time:40},
{type:'single',text:'Was ergibt 2 + 3?',options:['4','5','6'],correct:1,time:40},
{type:'boolean',text:'Die Sonne scheint in der Nacht immer am Himmel.',correct:false,time:35},
{type:'single',text:'Welches Tier kann fliegen?',options:['Pferd 🐴','Vogel 🐦','Schaf 🐑'],correct:1,time:35}
]};
let quizzes;
try{quizzes=JSON.parse(fs.readFileSync('quizzes.json','utf8'))}catch{quizzes=defaultQuizzes}
quizzes=quizzes.filter(q=>q.id!=='kinder');quizzes.push(kidsQuiz);
const persist=()=>fs.writeFileSync('quizzes.json',JSON.stringify(quizzes,null,2));
const ip=()=>Object.values(networkInterfaces()).flat().find(x=>x.family==='IPv4'&&!x.internal)?.address||'localhost';
let selected=quizzes[0].id, players={}, index=-1, phase='lobby', started=0, deadline=0, answers={}, leaderboardVisible=true, kidsMode=false, previousQuiz=quizzes[0].id;

const DATA_FILE='player-history.json';
let history={profiles:{},rounds:[]};
try{const loaded=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));if(loaded&&typeof loaded==='object'&&loaded.profiles&&Array.isArray(loaded.rounds))history=loaded}catch(e){if(e.code!=='ENOENT')console.error('Spielerhistorie konnte nicht gelesen werden:',e.message)}
function saveHistory(){const tmp=DATA_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(history,null,2));fs.renameSync(tmp,DATA_FILE)}
const cleanCode=c=>String(c||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
function newCode(){let c;do{c=randomBytes(6).toString('hex').toUpperCase()}while(history.profiles[c]);return c}
let roundId=randomUUID(),roundPlayed=false;
function archiveRound(){if(roundPlayed||index<0)return;roundPlayed=true;const sorted=Object.values(players).sort((a,b)=>b.score-a.score);const at=new Date().toISOString();const entries=sorted.map((p,i)=>({name:p.name,code:p.code||null,score:p.score,rank:i+1}));history.rounds.push({id:roundId,quizId:selected,quizTitle:quiz().title,date:at,players:entries.length,entries});for(const p of entries){if(!p.code||!history.profiles[p.code])continue;const profile=history.profiles[p.code];profile.name=p.name;profile.lastPlayed=at;profile.games=(profile.games||0)+1;profile.totalPoints=(profile.totalPoints||0)+p.score;profile.wins=(profile.wins||0)+(p.rank===1?1:0)}saveHistory()}
function hall(quizId){const scores=new Map();for(const round of history.rounds){if(round.quizId!==quizId)continue;for(const p of round.entries){const key=p.code?'code:'+p.code:'guest:'+round.id+':'+p.rank;const old=scores.get(key);if(!old||p.score>old.score)scores.set(key,{name:p.name,score:p.score,date:round.date})}}return [...scores.values()].sort((a,b)=>b.score-a.score).slice(0,25)}
function report(){return {rounds:history.rounds.length,registered:Object.keys(history.profiles).length,participations:history.rounds.reduce((sum,r)=>sum+r.entries.length,0),quizzes:quizzes.map(q=>({id:q.id,title:q.title,rounds:history.rounds.filter(r=>r.quizId===q.id).length,top:hall(q.id)}))}}

const quiz=()=>quizzes.find(q=>q.id===selected)||quizzes[0];
const question=()=>quiz().questions[index];
const resetGame=()=>{roundId=randomUUID();roundPlayed=false;index=-1;phase='lobby';players={};answers={};started=0;deadline=0;emit()};
const validAvatar=a=>typeof a==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(a)&&a.length<180000;
const normalize=s=>String(s??'').trim().toLocaleLowerCase('de');
function correct(q,a){
 if(a===undefined||a===null)return false;
 if(q.type==='single'||q.type==='logic')return Number(a)===Number(q.correct);
 if(q.type==='boolean')return String(a)===String(q.correct);
 if(q.type==='multi'||q.type==='order')return JSON.stringify(a)===JSON.stringify(q.correct);
 if(q.type==='estimate')return Math.abs(Number(a)-Number(q.correct))<=Number(q.tolerance??0);
 if(q.type==='text')return normalize(a)===normalize(q.correct);
 return false;
}
function scoreAnswer(q,a){if(kidsMode){if(q.type==='estimate'){const t=Number(q.tolerance),d=Math.abs(Number(a.value)-Number(q.correct));return Number.isFinite(d)&&Number.isFinite(t)&&t>=0&&d<=t?Math.round(1000*(t===0?1:1-d/t)):0}return correct(q,a.value)?1000:0}const speed=Math.max(0,Math.min(1,(deadline-a.at)/Math.max(1,deadline-started)));if(q.type==='estimate'){if(a.value===''||a.value==null||!Number.isFinite(Number(a.value)))return 0;const d=Math.abs(Number(a.value)-Number(q.correct)),t=Number(q.tolerance);if(!Number.isFinite(t)||t<0||d>t)return 0;const accuracy=t===0?1:1-d/t;return Math.round((800+200*speed)*accuracy)}return correct(q,a.value)?Math.round(800+200*speed):0}
function publicQuestion(q){if(!q)return null;const {correct,tolerance,...safe}=q;return safe}
function snapshot(){
 const q=question();
 return {kidsMode,leaderboardVisible,phase,index,quizId:selected,quizTitle:quiz().title,total:quiz().questions.length,question:publicQuestion(q),deadline,now:Date.now(),players:Object.values(players).map(({id,name,score,avatar})=>({id,name,score,avatar:avatar||null})).sort((a,b)=>b.score-a.score),answered:Object.keys(answers).length,quizzes:quizzes.map(({id,title})=>({id,title})),results:phase==='result'&&q?{correct:q.correct,tolerance:q.tolerance,answers:Object.values(answers).map(a=>({name:players[a.id]?.name,answer:a.value,correct:a.correct,points:a.points}))}:null};
}
function emit(){io.emit('state',snapshot())}
function reveal(){
 if(phase!=='question')return;
 const q=question();phase='result';
 for(const a of Object.values(answers)){a.correct=correct(q,a.value);a.points=scoreAnswer(q,a);if(players[a.id])players[a.id].score+=a.points}
 emit();
}
function next(){
 if(phase==='question')reveal();
 index++;
 if(index>=quiz().questions.length){phase='finished';archiveRound();emit();return}
 phase='question';answers={};started=Date.now();deadline=started+Math.max(5,Number(question().time)||20)*1000;emit();
}
setInterval(()=>{if(phase==='question'&&Date.now()>=deadline)reveal()},250);
app.get('/logo-original.webp',(req,res)=>{const path=process.cwd()+'/logo-original.webp';if(!fs.existsSync(path))return res.sendStatus(404);res.sendFile(path)});
app.get('/logo.svg',(req,res)=>res.sendFile(process.cwd()+'/logo.svg'));
app.get('/api/network',(req,res)=>res.json({ip:ip(),port:PORT,url:'http://'+ip()+':'+PORT+'/play'}));
app.get('/api/qr',async(req,res)=>{try{res.type('png').send(await QRCode.toBuffer('http://'+ip()+':'+PORT+'/play',{width:350,margin:2}))}catch(e){res.status(500).send(e.message)}});
app.get('/api/hall/:quizId',(req,res)=>res.json(hall(req.params.quizId)));
app.get('/api/stats',(req,res)=>{if(!process.env.HOST_KEY||req.get('x-host-key')!==process.env.HOST_KEY)return res.sendStatus(403);res.json(report())});
app.get('/api/stats.csv',(req,res)=>{if(!process.env.HOST_KEY||req.get('x-host-key')!==process.env.HOST_KEY)return res.sendStatus(403);const csvCell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';const rows=[['Datum','Quiz','Runde','Platz','Spieler','Punkte','Profil'].map(csvCell).join(';')];for(const r of history.rounds)for(const p of r.entries)rows.push([r.date,r.quizTitle,r.id,p.rank,p.name,p.score,p.code?'Registriert':'Gast'].map(csvCell).join(';'));res.type('text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="kayjuubee-auswertung.csv"').send('\uFEFF'+rows.join('\r\n'))});
app.get('/api/quizzes',(req,res)=>res.json(quizzes.filter(q=>q.id!=='kinder')));
app.put('/api/quizzes',(req,res)=>{if(process.env.HOST_KEY&&req.get('x-host-key')!==process.env.HOST_KEY)return res.sendStatus(403);if(!Array.isArray(req.body)||!req.body.every(q=>q.id&&q.title&&Array.isArray(q.questions)))return res.sendStatus(400);quizzes=[...req.body.filter(q=>q.id!=='kinder'),kidsQuiz];persist();selected=kidsMode?'kinder':quizzes[0]?.id;resetGame();res.json({ok:true})});
app.get('/:view(host|screen|play)',(req,res)=>res.sendFile(process.cwd()+'/index.html'));
app.get('/',(req,res)=>res.redirect('/host'));
io.on('connection',socket=>{
 socket.emit('state',snapshot());
 socket.on('join',(data,cb)=>{let id=String(data?.id||'');if(id&&players[id]){socket.data.playerId=id;cb?.({id,name:players[id].name,restored:true,code:players[id].code||null});emit();return}
const code=cleanCode(data?.code);if(code&&!history.profiles[code])return cb?.({error:'Spielercode nicht gefunden'});
const profile=code?history.profiles[code]:null;const name=profile?.name||String(data?.name||'').trim().slice(0,35);if(!name)return cb?.({error:'Bitte Namen eingeben'});
if(code&&Object.values(players).some(p=>p.code===code))return cb?.({error:'Dieses Spielerprofil ist bereits in der Runde angemeldet'});
id=randomUUID();players[id]={id,name,score:0,code:code||null,avatar:validAvatar(data?.avatar)?data.avatar:null};socket.data.playerId=id;cb?.({id,name,restored:false,code:code||null});emit()});
 socket.on('createProfile',(data,cb)=>{const id=socket.data.playerId,p=players[id];if(!p)return cb?.({error:'Bitte zuerst am Quiz teilnehmen'});if(p.code)return cb?.({code:p.code,existing:true});const code=newCode();history.profiles[code]={name:p.name,created:new Date().toISOString(),games:0,wins:0,totalPoints:0};try{saveHistory()}catch(e){delete history.profiles[code];return cb?.({error:'Profil konnte nicht gespeichert werden'})}p.code=code;cb?.({code});emit()});
 socket.on('deleteProfile',(code,cb)=>{const id=socket.data.playerId,p=players[id];if(!p||!p.code||p.code!==cleanCode(code))return cb?.({error:'Kein zugehöriges Profil'});delete history.profiles[p.code];for(const r of history.rounds)for(const entry of r.entries)if(entry.code===p.code){entry.code=null;entry.name='Gelöschtes Profil'}p.code=null;saveHistory();cb?.({ok:true});emit()});
 socket.on('avatar',(avatar,cb)=>{const id=socket.data.playerId;if(!id||!players[id])return cb?.({error:'Nicht angemeldet'});if(avatar!==null&&!validAvatar(avatar))return cb?.({error:'Bild zu groß oder ungültig'});players[id].avatar=avatar;cb?.({ok:true});emit()});
 socket.on('answer',(value,cb)=>{const id=socket.data.playerId;if(!id||!players[id]||phase!=='question'||Date.now()>deadline||answers[id])return cb?.({ok:false});answers[id]={id,value,at:Date.now()};cb?.({ok:true});emit()});
 socket.on('host',(action,cb)=>{if(process.env.HOST_KEY&&action?.key!==process.env.HOST_KEY)return cb?.({error:'Host-Schlüssel falsch'});switch(action?.type){case 'kidsMode':{const enable=!!action.enabled;if(enable!==kidsMode){if(enable){previousQuiz=selected;selected='kinder'}else{selected=quizzes.some(q=>q.id===previousQuiz)?previousQuiz:quizzes.find(q=>q.id!=='kinder')?.id||'kinder'}kidsMode=enable;resetGame()}break}case 'leaderboard':leaderboardVisible=!!action.visible;emit();break;case 'next':next();break;case 'reveal':reveal();break;case 'reset':resetGame();break;case 'select':if(!kidsMode&&quizzes.some(q=>q.id===action.id&&q.id!=='kinder')){selected=action.id;previousQuiz=selected;resetGame()}break;default:return cb?.({error:'Unbekannte Aktion'})}cb?.({ok:true})});
});
http.listen(PORT,'0.0.0.0',()=>console.log('KayJuuBee Quiz: http://localhost:'+PORT+'/host | Bildschirm: /screen | WLAN-IP: http://'+ip()+':'+PORT+'/play'));
