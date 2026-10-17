const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'quiz-bilder');fs.mkdirSync(dir,{recursive:true});
const queries=[
'David Beckham','Victoria Beckham','Ryan Reynolds','Blake Lively','Beyonce','Jay-Z','Tom Hanks','Rita Wilson','John Legend','Chrissy Teigen',
'Volkswagen Golf','BMW 3 Series','Mercedes-Benz C-Class','Audi A4','Opel Corsa','Ford Mustang','Porsche 911','Tesla Model 3','Toyota Prius','Fiat 500',
'Taylor Swift','Selena Gomez','Leonardo DiCaprio','Brad Pitt','Adele singer','Rihanna','Billie Eilish','Ariana Grande','Cristiano Ronaldo','Jennifer Aniston','Angelina Jolie','Tom Cruise','George Clooney','Ed Sheeran','Justin Bieber','Emma Watson','Daniel Radcliffe'];
async function run(){
const records=[];
for(const term of queries){
const file=term.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.jpg';
const target=path.join(dir,file);
if(fs.existsSync(target)){console.log('Vorhanden',file);continue}
try{
const u=new URL('https://commons.wikimedia.org/w/api.php');
for(const [k,v] of Object.entries({action:'query',generator:'search',gsrsearch:term,gsrnamespace:'6',gsrlimit:'10',prop:'imageinfo',iiprop:'url|mime|extmetadata',iiurlwidth:'900',format:'json'}))u.searchParams.set(k,v);
const data=await (await fetch(u)).json();
const pages=Object.values(data.query?.pages||{});
const found=pages.map(p=>({p,i:p.imageinfo?.[0]})).find(x=>x.i&&/image\/jpeg/.test(x.i.mime||'')&&/cc by|public domain|cc0|pd-/i.test(x.i.extmetadata?.LicenseShortName?.value||''));
if(!found){console.log('Kein freies JPEG gefunden:',term);continue}
const response=await fetch(found.i.thumburl||found.i.url);if(!response.ok)throw Error('HTTP '+response.status);
const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>6000000)throw Error('Zu gross');
fs.writeFileSync(target,bytes);
records.push({suchbegriff:term,datei:file,quelle:found.i.descriptionurl,lizenz:found.i.extmetadata?.LicenseShortName?.value,urheber:found.i.extmetadata?.Artist?.value||'',pruefen:'Identitaet und Lizenz vor Einsatz kontrollieren'});
console.log('Gespeichert:',file);
}catch(e){console.log('Fehler:',term,e.message)}
}
const out=path.join(dir,'bildquellen.json');let previous=[];try{previous=JSON.parse(fs.readFileSync(out))}catch{}
fs.writeFileSync(out,JSON.stringify([...previous.filter(x=>!records.some(y=>y.datei===x.datei)),...records],null,2));
console.log('Fertig. Bilder vor Veranstaltung pruefen.');
}
run().catch(console.error);