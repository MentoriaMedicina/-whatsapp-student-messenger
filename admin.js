import {
  auth, db, signInWithEmailAndPassword, signOut, doc, getDoc,
  collection, getDocs, addDoc, setDoc, serverTimestamp
} from "./firebase.js";

const $=id=>document.getElementById(id);
let adminUser=null;

async function checkAdmin(user) {

  console.log("LOGIN EMAIL:", user.email);
  console.log("LOGIN UID:", user.uid);

  const adminRef = doc(db, "admin1", user.uid);
  const snap = await getDoc(adminRef);

  console.log("DOCUMENT EXISTS:", snap.exists());

  if (snap.exists()) {
    console.log("ADMIN DATA:", snap.data());
  }

  if (!snap.exists()) {
    throw new Error("Admin document not found. UID mismatch: " + user.uid);
  }

  const data = snap.data();

  if (data.role !== "admin" || data.active !== true) {
    throw new Error("Admin role or active status is incorrect.");
  }

  adminUser = user;

  $("loginPanel").hidden = true;
  $("dashboard").hidden = false;

  $("adminWelcome").textContent = `Signed in: ${user.email}`;

  await refreshBundles();
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("loginMessage").textContent="Signing in…";
  try {
    const cred=await signInWithEmailAndPassword(auth,$("adminEmail").value.trim(),$("adminPassword").value);
    await checkAdmin(cred.user);
  } catch(err) {$("loginMessage").textContent=err.message;}
});
async function refreshBundles(){
  const snap=await getDocs(collection(db,"bundles"));
  const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
  $("mcqBundle").innerHTML=rows.map(b=>`<option value="${b.id}">${b.title}</option>`).join("");
  $("databaseStatus").textContent=`Loaded ${rows.length} bundles. students, questions, subjectiveQuestions and results collections will appear when their first records are saved.`;
}
$("bundleForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try {
    const ref=await addDoc(collection(db,"bundles"),{
      title:$("bundleTitle").value.trim(),subject:$("bundleSubject").value.trim(),
      description:$("bundleDescription").value.trim(),year:$("bundleYear").value,
      durationMinutes:Number($("bundleDuration").value)||20,questionCount:0,
      active:true,createdBy:adminUser.uid,createdAt:serverTimestamp()
    });
    $("bundleForm").reset();$("bundleDuration").value=20;
    await refreshBundles();$("mcqBundle").value=ref.id;
    alert("Bundle saved. Firestore created the bundles collection automatically.");
  } catch(err){alert("Could not save bundle: "+err.message);}
});
$("mcqForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const bundleId=$("mcqBundle").value;
  if(!bundleId){alert("Create a bundle first.");return;}
  try {
    await addDoc(collection(db,"questions"),{
      bundleId,question:$("mcqQuestion").value.trim(),
      options:[0,1,2,3].map(i=>$("opt"+i).value.trim()),
      answer:Number($("mcqAnswer").value),explanation:$("mcqExplanation").value.trim(),
      active:true,createdBy:adminUser.uid,createdAt:serverTimestamp()
    });
    const bRef=doc(db,"bundles",bundleId),bSnap=await getDoc(bRef);
    await setDoc(bRef,{questionCount:Number(bSnap.data().questionCount||0)+1,updatedAt:serverTimestamp()},{merge:true});
    $("mcqForm").reset();await refreshBundles();
    alert("MCQ saved. Firestore created the questions collection automatically.");
  } catch(err){alert("Could not save MCQ: "+err.message);}
});
$("subjectiveForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try {
    await addDoc(collection(db,"subjectiveQuestions"),{
      question:$("subQuestion").value.trim(),year:$("subYear").value,
      answer:$("subAnswer").value.trim(),explanation:$("subExplanation").value.trim(),
      active:true,createdBy:adminUser.uid,createdAt:serverTimestamp()
    });
    $("subjectiveForm").reset();
    alert("Subjective question saved. Firestore created the subjectiveQuestions collection automatically.");
  } catch(err){alert("Could not save practice question: "+err.message);}
});
$("logoutButton").addEventListener("click",async()=>{await signOut(auth);location.reload();});
