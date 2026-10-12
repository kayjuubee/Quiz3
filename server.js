import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { networkInterfaces } from 'node:os';
import { randomUUID } from 'node:crypto';
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
let quizzes;
try{quizzes=JSON.parse(fs.readFileSync('quizzes.json','utf8'))}catch{quizzes=defaultQuizzes}
const persist=()=>fs.writeFileSync('quizzes.json',JSON.stringify(quizzes,null,2));
const ip=()=>Object.values(networkInterfaces()).flat().find(x=>x.family==='IPv4'&&!x.internal)?.address||'localhost';
let selected=quizzes[0].id, players={}, index=-1, phase='lobby', started=0, deadline=0, answers={}, leaderboardVisible=true;
const quiz=()=>quizzes.find(q=>q.id===selected)||quizzes[0];
const question=()=>quiz().questions[index];
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
function scoreAnswer(q,a){const speed=Math.max(0,Math.min(1,(deadline-a.at)/Math.max(1,deadline-started)));if(q.type==='estimate'){if(a.value===''||a.value==null||!Number.isFinite(Number(a.value)))return 0;const d=Math.abs(Number(a.value)-Number(q.correct)),t=Number(q.tolerance);if(!Number.isFinite(t)||t<0||d>t)return 0;const accuracy=t===0?1:1-d/t;return Math.round((800+200*speed)*accuracy)}return correct(q,a.value)?Math.round(800+200*speed):0}
function publicQuestion(q){if(!q)return null;const {correct,tolerance,...safe}=q;return safe}
function snapshot(){
 const q=question();
 return {leaderboardVisible,phase,index,quizId:selected,quizTitle:quiz().title,total:quiz().questions.length,question:publicQuestion(q),deadline,now:Date.now(),players:Object.values(players).map(({id,name,score})=>({id,name,score})).sort((a,b)=>b.score-a.score),answered:Object.keys(answers).length,quizzes:quizzes.map(({id,title})=>({id,title})),results:phase==='result'&&q?{correct:q.correct,tolerance:q.tolerance,answers:Object.values(answers).map(a=>({name:players[a.id]?.name,answer:a.value,correct:a.correct,points:a.points}))}:null};
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
 if(index>=quiz().questions.length){phase='finished';emit();return}
 phase='question';answers={};started=Date.now();deadline=started+Math.max(5,Number(question().time)||20)*1000;emit();
}
setInterval(()=>{if(phase==='question'&&Date.now()>=deadline)reveal()},250);
app.get('/logo-original.webp',(req,res)=>{const path=process.cwd()+'/logo-original.webp';if(!fs.existsSync(path))return res.sendStatus(404);res.sendFile(path)});
app.get('/logo.svg',(req,res)=>res.sendFile(process.cwd()+'/logo.svg'));
app.get('/api/network',(req,res)=>res.json({ip:ip(),port:PORT,url:'http://'+ip()+':'+PORT+'/play'}));
app.get('/api/qr',async(req,res)=>{try{res.type('png').send(await QRCode.toBuffer('http://'+ip()+':'+PORT+'/play',{width:350,margin:2}))}catch(e){res.status(500).send(e.message)}});
app.get('/api/quizzes',(req,res)=>res.json(quizzes));
app.put('/api/quizzes',(req,res)=>{if(process.env.HOST_KEY&&req.get('x-host-key')!==process.env.HOST_KEY)return res.sendStatus(403);if(!Array.isArray(req.body)||!req.body.every(q=>q.id&&q.title&&Array.isArray(q.questions)))return res.sendStatus(400);quizzes=req.body;persist();selected=quizzes[0]?.id;index=-1;phase='lobby';players={};answers={};emit();res.json({ok:true})});
app.get('/:view(host|screen|play)',(req,res)=>res.sendFile(process.cwd()+'/index.html'));
app.get('/',(req,res)=>res.redirect('/host'));
io.on('connection',socket=>{
 socket.emit('state',snapshot());
 socket.on('join',(data,cb)=>{const name=String(data?.name||'').trim().slice(0,35);if(!name)return cb?.({error:'Bitte Namen eingeben'});let id=String(data?.id||'');if(!players[id])id=randomUUID();players[id]={id,name,score:players[id]?.score||0};socket.data.playerId=id;cb?.({id});emit()});
 socket.on('answer',(value,cb)=>{const id=socket.data.playerId;if(!id||!players[id]||phase!=='question'||Date.now()>deadline||answers[id])return cb?.({ok:false});answers[id]={id,value,at:Date.now()};cb?.({ok:true});emit()});
 socket.on('host',(action,cb)=>{if(process.env.HOST_KEY&&action?.key!==process.env.HOST_KEY)return cb?.({error:'Host-Schlüssel falsch'});switch(action?.type){case 'leaderboard':leaderboardVisible=!!action.visible;emit();break;case 'next':next();break;case 'reveal':reveal();break;case 'reset':index=-1;phase='lobby';players={};answers={};emit();break;case 'select':if(quizzes.some(q=>q.id===action.id)){selected=action.id;index=-1;phase='lobby';players={};answers={};emit()}break;default:return cb?.({error:'Unbekannte Aktion'})}cb?.({ok:true})});
});
http.listen(PORT,'0.0.0.0',()=>console.log('KayJuuBee Quiz: http://localhost:'+PORT+'/host | Bildschirm: /screen | WLAN-IP: http://'+ip()+':'+PORT+'/play'));
