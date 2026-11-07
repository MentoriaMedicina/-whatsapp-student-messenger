import {
  auth, db, signInAnonymously, collection, doc, getDoc, getDocs,
  setDoc, addDoc, query, where, orderBy, serverTimestamp
} from "./firebase.js";

const $ = id => document.getElementById(id);
const screens = ["homeScreen","examScreen","practiceScreen","resultScreen","reviewScreen","historyScreen"];
const state = { student:null, bundle:null, bundles:[], index:0, answers:{}, remaining:20*60, timerId:null, lastResult:null, history:[] };

function showScreen(id) {
  screens.forEach(s => $(s).classList.toggle("active", s === id));
  window.scrollTo({top:0, behavior:"smooth"});
}
function toast(message) {
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2200);
}
function safeText(value="") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// Firestore creates a collection automatically when the first document is written.
// This function creates/updates one student document using the anonymous Auth UID.
async function saveStudent(name, year) {
  const uid = auth.currentUser.uid;
  const studentRef = doc(db, "students", uid);
  const old = await getDoc(studentRef);
  await setDoc(studentRef, {
    name, year, uid,
    createdAt: old.exists() ? old.data().createdAt : serverTimestamp(),
    updatedAt: serverTimestamp()
  }, {merge:true});
  return {uid, name, year};
}
async function loadBundles() {
  const snap = await getDocs(query(collection(db,"bundles"), where("active","==",true)));
  state.bundles = snap.docs.map(d => ({id:d.id,...d.data()}));
  renderBundles();
  $("loadingMessage").textContent = state.bundles.length ? "" : "No exam packages yet. Admin can add bundles from admin.html.";
}
function renderBundles() {
  $("bundleList").innerHTML = state.bundles.map((b,i)=>`
    <article class="bundle-card" data-id="${safeText(b.id)}">
      <div class="bundle-art" style="background:${["#e5f8fc","#e9f9ee","#f2eafd"][i%3]}">📘</div>
      <h3>${safeText(b.title)}</h3><p>${safeText(b.description||"")}</p>
      <div class="bundle-meta"><span>${Number(b.questionCount||0)} Questions</span><span>${safeText(b.subject||"")}</span></div>
    </article>`).join("");
  document.querySelectorAll(".bundle-card").forEach(el=>el.addEventListener("click",()=>startBundle(el.dataset.id)));
}
async function loadQuestions(bundleId) {
  const snap=await getDocs(query(collection(db,"questions"),where("bundleId","==",bundleId)));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function startBundle(id) {
  if(!state.student){state.pendingBundle=id;$("studentModal").classList.add("show");return;}
  try {
    const bundle=state.bundles.find(b=>b.id===id);
    const questions=await loadQuestions(id);
    if(!questions.length){toast("No MCQ questions in this package yet.");return;}
    state.bundle={...bundle,questions};state.index=0;state.answers={};state.remaining=Number(bundle.durationMinutes||20)*60;
    $("examTitle").textContent=bundle.title;$("examSubject").textContent=(bundle.subject||"").toUpperCase();
    showScreen("examScreen");renderQuestion();startTimer();
  } catch(e) { console.error(e);toast("Could not load questions. Check Firestore Rules."); }
}
function renderQuestion() {
  const q=state.bundle.questions[state.index],total=state.bundle.questions.length;
  $("questionCounter").textContent=`Question ${state.index+1} of ${total}`;
  $("questionNumber").textContent=`QUESTION ${String(state.index+1).padStart(2,"0")}`;
  $("answeredCounter").textContent=`${Object.keys(state.answers).length} answered`;
  $("progressFill").style.width=`${((state.index+1)/total)*100}%`;
  $("questionText").textContent=q.question||q.q||"";
  const opts=q.options||[];
  $("optionsList").innerHTML=opts.map((op,i)=>`
    <button class="option ${state.answers[state.index]===i?"selected":""}" data-option="${i}">
      <span class="letter">${String.fromCharCode(65+i)}</span><span>${safeText(op)}</span>
    </button>`).join("");
  document.querySelectorAll(".option").forEach(btn=>btn.addEventListener("click",()=>{state.answers[state.index]=Number(btn.dataset.option);renderQuestion();}));
  $("previousButton").disabled=state.index===0;
  $("previousButton").style.opacity=state.index===0?".45":"1";
  $("nextButton").textContent=state.index===total-1?"Finish":"Next question";
}
function startTimer() {
  clearInterval(state.timerId);updateTimer();
  state.timerId=setInterval(()=>{state.remaining--;updateTimer();if(state.remaining<=0){clearInterval(state.timerId);submitExam();}},1000);
}
function updateTimer() {
  const m=Math.floor(state.remaining/60),s=state.remaining%60;
  $("timer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  if(state.remaining<=60)$("timer").style.color="#d94f59";
}
async function submitExam() {
  if(!state.bundle)return;
  clearInterval(state.timerId);
  const qs=state.bundle.questions;
  const correct=qs.filter((q,i)=>state.answers[i]===Number(q.answer)).length;
  const answered=Object.keys(state.answers).length,wrong=answered-correct,unanswered=qs.length-answered;
  const result={
    studentId:state.student.uid,studentName:state.student.name,year:state.student.year,
    bundleId:state.bundle.id,bundle:state.bundle.title,subject:state.bundle.subject||"",
    total:qs.length,correct,wrong,unanswered,obtainedMarks:correct,
    totalMarks:qs.length,percent:Math.round(correct/qs.length*100),
    answers:state.answers,createdAt:serverTimestamp()
  };
  try {
    // First result write automatically creates the "results" collection.
    const ref=await addDoc(collection(db,"results"),result);
    state.lastResult={...result,id:ref.id,questions:qs};
    $("resultName").textContent=state.student.name.split(" ")[0];
    $("scorePercent").textContent=result.percent+"%";
    $("resultSummary").textContent=`${correct} out of ${qs.length} questions answered correctly`;
    $("totalStat").textContent=qs.length;$("correctStat").textContent=correct;
    $("wrongStat").textContent=wrong;$("unansweredStat").textContent=unanswered;
    showScreen("resultScreen");
  } catch(e) { console.error(e);toast("Result could not be saved. Check Firestore Rules."); }
}
function renderReview() {
  const r=state.lastResult;if(!r)return;
  $("reviewList").innerHTML=r.questions.map((q,i)=>{
    const selected=r.answers[i],isCorrect=selected===Number(q.answer),opts=q.options||[];
    const chosen=selected===undefined?"Not answered":opts[selected]||"";
    return `<article class="review-item"><p class="eyebrow">QUESTION ${String(i+1).padStart(2,"0")}</p>
      <h3>${safeText(q.question||q.q)}</h3>
      <div class="review-choice ${isCorrect?"correct-answer":"wrong-answer"}">Your answer: ${safeText(chosen)}</div>
      <div class="review-choice correct-answer">Correct answer: ${safeText(opts[Number(q.answer)]||"")}</div>
      <p class="explanation"><b>Explanation:</b> ${safeText(q.explanation||"")}</p></article>`;
  }).join("");
}
async function renderHistory() {
  if(!state.student)return;
  $("historyList").innerHTML="<p>Loading your results…</p>";
  try {
    const snap=await getDocs(query(collection(db,"results"),where("studentId","==",state.student.uid)));
    const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    $("historyList").innerHTML=rows.length?rows.map(r=>`
      <div class="history-item"><div><strong>${safeText(r.bundle||r.examName||"Exam")}</strong><small>${safeText(r.studentName)} • ${safeText(r.year)}</small></div><div class="history-score">${Number(r.percent||0)}%</div></div>`).join(""):`<p class="result-subtitle">No completed exams yet.</p>`;
  } catch(e) {console.error(e);$("historyList").textContent="Could not load history. Check Firestore Rules.";}
}
async function loadPracticeQuestions() {
  $("subjectiveList").innerHTML="<p>Loading practice questions…</p>";
  try {
    const snap=await getDocs(collection(db,"subjectiveQuestions"));
    const docs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(q=>q.active!==false && (!q.year||q.year===state.student.year));
    $("subjectiveList").innerHTML=docs.length?docs.map((q,i)=>`
      <article class="review-item"><p class="eyebrow">PRACTICE QUESTION ${i+1}</p><h3>${safeText(q.question)}</h3>
      <textarea rows="5" placeholder="Write your answer here…" style="width:100%;padding:12px;border:1px solid #d7e0e8;border-radius:12px"></textarea>
      <details><summary>Show answer / explanation</summary><p>${safeText(q.answer||"Answer not added yet.")}</p><p class="explanation">${safeText(q.explanation||"")}</p></details></article>`).join(""):`<p class="result-subtitle">No subjective questions have been added yet.</p>`;
  } catch(e) {console.error(e);$("subjectiveList").textContent="Could not load practice questions. Check Firestore Rules.";}
}
function goHome(){clearInterval(state.timerId);showScreen("homeScreen");}
async function boot() {
  try {
    // Anonymous Auth gives each student a stable UID without asking for an email/password.
    if(!auth.currentUser) await signInAnonymously(auth);
    await loadBundles();
    const saved=localStorage.getItem("mentoriaStudent");
    if(saved){
      const s=JSON.parse(saved);
      state.student=await saveStudent(s.name,s.year);
      $("welcomeName").textContent=s.name.split(" ")[0];
    } else $("studentModal").classList.add("show");
  } catch(e) {
    console.error(e);
    $("loadingMessage").textContent="Firebase connection failed. Check firebase.js, enable Anonymous sign-in, and verify Firestore Rules.";
  }
}
$("studentForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const name=$("studentName").value.trim(),year=$("studentYear").value;
  if(!name||!year)return;
  try {
    state.student=await saveStudent(name,year);
    localStorage.setItem("mentoriaStudent",JSON.stringify({name,year}));
    $("welcomeName").textContent=name.split(" ")[0];$("studentModal").classList.remove("show");
    toast("Welcome, "+name.split(" ")[0]+"!");
    if(state.pendingBundle){const id=state.pendingBundle;state.pendingBundle=null;startBundle(id);}
  } catch(err){console.error(err);toast("Could not save student details. Check Firestore Rules.");}
});
$("selfExamCard").addEventListener("click",()=>state.bundles[0]&&startBundle(state.bundles[0].id));
$("groupExamCard").addEventListener("click",()=>state.bundles[0]&&startBundle(state.bundles[0].id));
$("practiceCard").addEventListener("click",async()=>{if(!state.student){$("studentModal").classList.add("show");return;}showScreen("practiceScreen");await loadPracticeQuestions();});
$("previousButton").addEventListener("click",()=>{if(state.index>0){state.index--;renderQuestion();}});
$("nextButton").addEventListener("click",()=>{if(state.index<state.bundle.questions.length-1){state.index++;renderQuestion();}else submitExam();});
$("submitButton").addEventListener("click",()=>{const n=state.bundle.questions.length-Object.keys(state.answers).length;if(n&&!confirm(`You have ${n} unanswered question(s). Submit anyway?`))return;submitExam();});
$("reviewButton").addEventListener("click",()=>{renderReview();showScreen("reviewScreen");});
$("homeButton").addEventListener("click",goHome);$("reviewHomeButton").addEventListener("click",goHome);
$("backHome").addEventListener("click",()=>{if(confirm("Exit this exam? Your current answers will be lost."))goHome();});
$("backResult").addEventListener("click",()=>showScreen("resultScreen"));
$("practiceBack").addEventListener("click",goHome);$("historyBack").addEventListener("click",goHome);
$("myResultsButton").addEventListener("click",async()=>{showScreen("historyScreen");await renderHistory();});
$("examHistoryButton").addEventListener("click",async()=>{showScreen("historyScreen");await renderHistory();});
$("navResults").addEventListener("click",async()=>{showScreen("historyScreen");await renderHistory();});
$("navHome").addEventListener("click",goHome);
$("navExam").addEventListener("click",()=>state.bundles[0]&&startBundle(state.bundles[0].id));
$("navProfile").addEventListener("click",()=>toast(state.student?`${state.student.name} • ${state.student.year}`:"Enter your details first"));
$("profileButton").addEventListener("click",()=>toast(state.student?`${state.student.name} • ${state.student.year}`:"Enter your details first"));
$("navMenu").addEventListener("click",()=>toast("Choose a learning section from the home screen."));
$("howButton").addEventListener("click",()=>alert("1. Enter your name and academic year.\\n2. Choose an exam package.\\n3. Answer MCQs or practise subjective questions.\\n4. Your exam result is saved to Firestore."));
boot();
