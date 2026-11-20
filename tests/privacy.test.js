import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
// The repository is public: no personal correspondence (letters, email drafts, chat transcripts), no
// personal email addresses and no owner name outside the licence. See AGENTS.md, "Privacy".
const binary=/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|mp4|webm|pdf|stl|3mf|zip|gz|der|bin)$/i;
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&!binary.test(f)&&f!=='package-lock.json');
const owner=(readFileSync('LICENSE','utf8').match(/Copyright \(c\) \d{4} (.+)/)||[])[1]?.trim();
const salutation=/^\s*(?:\*\*)?(?:Hi|Hello|Hey|Dear|Hoi|Beste|Hallo|Geachte)\s+[A-Z][\p{L}'-]+\s*,/mu;
const signOff=/\b(?:Best|Kind|Warm) regards\b|\bMet vriendelijke groet|\bGroetjes\b|\bCheers,\s*$/mi;
const email=/(?<![\/:A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
const allowedDomain=d=>/(^|\.)(test|example|invalid|localhost|local|service)$/i.test(d)||/(^|\.)(?:example\.(?:com|org|net)|noreply\.github\.com|anthropic\.com)$/i.test(d);
const allowedEmail=a=>/^noreply@|users\.noreply\.github\.com$/i.test(a);
test('no personal correspondence, email addresses or owner name in tracked files',()=>{
 const problems=[];
 for(const file of files){
  let text;try{text=readFileSync(file,'utf8');}catch{continue;}
  if(file==='tests/privacy.test.js')continue;
  if(salutation.test(text))problems.push(`${file}: letter/email salutation`);
  if(signOff.test(text))problems.push(`${file}: letter/email sign-off`);
  for(const m of text.matchAll(email))if(!allowedDomain(m[1])&&!allowedEmail(m[0]))problems.push(`${file}: email address ${m[0].replace(/^[^@]+/,'…')}`);
  if(owner&&file!=='LICENSE'&&text.includes(owner))problems.push(`${file}: owner name outside LICENSE`);
  if(/(^|\/)[^/]*(correspondence|e-?mail-draft|follow-up-email|transcript)[^/]*$/i.test(file))problems.push(`${file}: correspondence-like file name`);
 }
 assert.deepEqual(problems,[]);
});
test('the privacy check recognises a letter, a signature and a personal address',()=>{
 assert.ok(salutation.test('# Draft\n\nHi Alex,\n\nThanks'));assert.ok(salutation.test('Beste Sam,'));assert.ok(!salutation.test('Hi there, this is TuneBox'));
 assert.ok(signOff.test('Best regards,\nX'));assert.ok(signOff.test('Met vriendelijke groet,'));
 const found=[...'mail me at someone@mail.example.org or a@icloud.com, not getty@tty1.service or https://user@youtube.com/x'.matchAll(email)].filter(m=>!allowedDomain(m[1])).map(m=>m[1]);assert.deepEqual(found,['icloud.com']);
});
