/** Mentoria Medicina Google Sheets backend.
 * Create sheets automatically. Admin password is set in Script Properties.
 * IMPORTANT: This is a starter backend. Review security before using for high-stakes exams.
 */
const SHEETS = {
  Bundles: ['id','title','subject','description','year','durationMinutes','questionCount','active','createdAt'],
  Questions: ['id','bundleId','question','options','answer','explanation','active','createdAt'],
  PracticeQuestions: ['id','question','year','answer','explanation','active','createdAt'],
  Students: ['studentId','name','year','createdAt'],
  Submissions: ['examId','type','studentId','studentName','year','group','bundleId','bundleTitle','subject','questionId','question','studentAnswer','answersJson','totalQuestions','correct','wrong','unanswered','percent','submittedAt','status'],
  Evaluations: ['examId','questionId','marks','maxMarks','feedback','correction','published','evaluatedAt']
};
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
  });
  return 'Sheets ready. Set Script Property ADMIN_PASSWORD before deployment.';
}
function doGet(e) {
  const action = (e.parameter.action || '').trim();
  let result;
  try { result = handleGet(action, e.parameter); }
  catch (err) { result = {success:false,error:String(err.message || err)}; }
  const callback = e.parameter.callback;
  if (callback && /^[A-Za-z_$][\w$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(result);
}
function doPost(e) {
  let result;
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    result = handlePost(payload);
  } catch (err) { result = {success:false,error:String(err.message || err)}; }
  return json_(result);
}
function handleGet(action, p) {
  if (action === 'bundles') return {success:true,bundles:rows_('Bundles').filter(r => String(r.active) === 'true')};
  if (action === 'questions') return {success:true,questions:rows_('Questions').filter(r => String(r.active) === 'true' && r.bundleId === p.bundleId).map(q=>({...q,options:typeof q.options==='string'?JSON.parse(q.options||'[]'):q.options}))};
  if (action === 'practice') return {success:true,questions:rows_('PracticeQuestions').filter(r => String(r.active) === 'true' && (!r.year || r.year === p.year)).map(q=>({id:q.id,question:q.question,year:q.year}))};
  if (action === 'result') {
    const id = String(p.examId || '').toUpperCase().trim();
    const studentName = String(p.studentName || '').trim().toLowerCase();
    if (!id || !studentName) return {success:false,error:'Exam ID and student name required'};
    const submission = rows_('Submissions').find(r => String(r.examId).toUpperCase() === id && String(r.studentName).trim().toLowerCase() === studentName);
    if (!submission) return {success:false,error:'No matching submission found'};
    const evaluation = rows_('Evaluations').filter(r => r.examId === id && String(r.published) === 'true');
    const published = submission.type === 'MCQ' ? String(submission.status) === 'Published' : evaluation.length > 0;
    return {success:true,submission,evaluations:evaluation,hasPublishedEvaluation:published};
  }
  return {success:false,error:'Unknown action'};
}
function handlePost(p) {
  const action = p.action;
  if (action === 'adminLogin') return {success:adminPasswordOk_(p.password)};
  if (action === 'adminSubmissions') {requireAdmin_(p.password);const all=rows_('Submissions');const evals=rows_('Evaluations');return {success:true,submissions:all.map(s=>({...s,evaluation:evals.find(v=>v.examId===s.examId&&v.questionId===s.questionId)||null}))};}
  if (action === 'saveStudent') {
    const name = String(p.name || '').trim(); const year = String(p.year || '').trim(); const studentId = String(p.studentId || '').trim();
    if (!name || !year || !studentId) throw new Error('Student name, year and student ID are required');
    const sh = sheet_('Students');
    const existing = rows_('Students').find(r => r.studentId === studentId);
    if (!existing) sh.appendRow([studentId,name,year,new Date()]);
    return {success:true};
  }
  if (action === 'startMCQ') {
    ['studentId','studentName','year','bundleId','bundleTitle','subject'].forEach(k=>{if(!p[k]) throw new Error('Missing '+k);});
    const lock=LockService.getScriptLock();lock.waitLock(10000);try{const examId=uniqueExamId_();sheet_('Submissions').appendRow([examId,'MCQ',p.studentId,p.studentName,p.year,p.group||'',p.bundleId,p.bundleTitle,p.subject,'','','','{}',Number(p.totalQuestions||0),0,0,Number(p.totalQuestions||0),0,new Date(),'Started']);return {success:true,examId};}finally{lock.releaseLock();}
  }
  if (action === 'submitMCQ') {
    const required = ['studentId','studentName','year','bundleId','bundleTitle','subject'];
    required.forEach(k => { if (!p[k]) throw new Error('Missing ' + k); });
    const answers = p.answers || {};
    const examId=String(p.examId||'').toUpperCase();if(!examId)throw new Error('Exam ID missing');
    const row=findRow_('Submissions','examId',examId);if(!row)throw new Error('Exam session not found');
    const sh=sheet_('Submissions');const existing=sh.getRange(row,1,20).getValues()[0];if(String(existing[2])!==String(p.studentId)||String(existing[1])!=='MCQ')throw new Error('Exam session mismatch');sh.getRange(row,1,1,20).setValues([[examId,'MCQ',p.studentId,p.studentName,p.year,p.group||'',p.bundleId,p.bundleTitle,p.subject,'','','',JSON.stringify(answers),Number(p.totalQuestions||0),Number(p.correct||0),Number(p.wrong||0),Number(p.unanswered||0),Number(p.percent||0),new Date(),'Published']]);
    return {success:true,examId};
  }
  if (action === 'submitPractice') {
    ['studentId','studentName','year','questionId','question','answer'].forEach(k=>{if(!p[k]) throw new Error('Missing '+k);});
    const lock=LockService.getScriptLock();lock.waitLock(10000);try{const examId = uniqueExamId_();
    sheet_('Submissions').appendRow([examId,'Practice',p.studentId,p.studentName,p.year,p.group||'','','Practice Question','Practice',''+p.questionId,p.question,p.answer,'',1,0,0,0,0,new Date(),'Pending']);
    return {success:true,examId};}finally{lock.releaseLock();}
  }
  if (action === 'createBundle') {
    requireAdmin_(p.password); const id=Utilities.getUuid();
    sheet_('Bundles').appendRow([id,p.title,p.subject,p.description||'',p.year,Number(p.durationMinutes||20),0,true,new Date()]);
    return {success:true,id};
  }
  if (action === 'addMCQ') {
    requireAdmin_(p.password); const id=Utilities.getUuid();
    sheet_('Questions').appendRow([id,p.bundleId,p.question,JSON.stringify(p.options||[]),Number(p.answer),p.explanation||'',true,new Date()]);
    const b=rows_('Bundles').find(x=>x.id===p.bundleId); if(b){const sh=sheet_('Bundles');const row=findRow_('Bundles','id',p.bundleId);sh.getRange(row,7).setValue(Number(b.questionCount||0)+1);}
    return {success:true,id};
  }
  if (action === 'addPractice') {
    requireAdmin_(p.password); const id=Utilities.getUuid();
    sheet_('PracticeQuestions').appendRow([id,p.question,p.year,p.answer||'',p.explanation||'',true,new Date()]);
    return {success:true,id};
  }
  if (action === 'evaluate') {
    requireAdmin_(p.password);
    const sh=sheet_('Evaluations'); const row=findRow_('Evaluations','examId',p.examId,p.questionId);
    const record=[p.examId,p.questionId||'',Number(p.marks||0),Number(p.maxMarks||0),p.feedback||'',p.correction||'',p.published===true,new Date()];
    if(row) sh.getRange(row,1,1,record.length).setValues([record]); else sh.appendRow(record);
    const subRow=findRow_('Submissions','examId',p.examId);if(subRow)sheet_('Submissions').getRange(subRow,20).setValue(p.published===true?'Published':'Evaluated');
    return {success:true};
  }
  if (action === 'publishExamResult') {
    requireAdmin_(p.password);
    const sh=sheet_('Submissions'); const row=findRow_('Submissions','examId',p.examId);
    if(!row) throw new Error('Submission not found'); sh.getRange(row,20).setValue('Published');
    return {success:true};
  }
  throw new Error('Unknown POST action');
}
function uniqueExamId_(){
  const used=new Set(rows_('Submissions').map(r=>String(r.examId)));
  let id; do { id=String.fromCharCode(65+Math.floor(Math.random()*26))+String(Math.floor(Math.random()*10000)).padStart(4,'0'); } while(used.has(id)); return id;
}
function rows_(name){
  const sh=sheet_(name); const data=sh.getDataRange().getValues(); if(data.length<2)return [];
  const headers=data[0]; return data.slice(1).filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i]);return o;});
}
function sheet_(name){const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(name);if(!sh){sh=ss.insertSheet(name);sh.appendRow(SHEETS[name]);}return sh;}
function findRow_(sheetName, key, value, secondKey){const sh=sheet_(sheetName);const vals=sh.getDataRange().getValues();if(!vals.length)return 0;const headers=vals[0];const ix=headers.indexOf(key);const ix2=secondKey===undefined?-1:headers.indexOf('questionId');for(let i=1;i<vals.length;i++){if(ix>=0&&String(vals[i][ix])===String(value)&&(ix2<0||String(vals[i][ix2])===String(secondKey)))return i+1;}return 0;}
function adminPasswordOk_(password){const expected=PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');return !!expected && String(password||'')===expected;}
function requireAdmin_(password){if(!adminPasswordOk_(password))throw new Error('Admin authentication failed');}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
