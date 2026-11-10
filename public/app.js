"use strict";
const $ = id => document.getElementById(id);
const STORAGE_KEY = "caraxes_conversations_v1";
let conversations = loadConversations();
let currentId = null;
let attachedText = "";
let attachedName = "";
let busy = false;

function loadConversations(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]")}catch{return[]}}
function saveConversations(){localStorage.setItem(STORAGE_KEY,JSON.stringify(conversations.slice(0,60)))}
function makeId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function currentConversation(){return conversations.find(c=>c.id===currentId)}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderHistory(){
  const list=$("historyList");list.innerHTML="";
  conversations.forEach(c=>{const b=document.createElement("button");b.className="history-entry";b.textContent=c.title||"New conversation";b.title=b.textContent;b.onclick=()=>openConversation(c.id);list.appendChild(b)});
}
function renderMessages(){
  const c=currentConversation();$("messages").innerHTML="";
  $("welcome").style.display=c&&c.messages.length?"none":"block";
  if(!c)return;
  c.messages.forEach((m,index)=>{
    const el=document.createElement("div");el.className="message "+(m.role==="user"?"user":"assistant");
    const bubble=document.createElement("div");bubble.className="bubble";
    if(m.role==="assistant"){
      const label=document.createElement("div");label.className="message-label";label.textContent="CARAXES AI";bubble.appendChild(label);
    }
    const content=document.createElement("div");content.className="message-content";content.textContent=m.text;bubble.appendChild(content);
    el.appendChild(bubble);
    if(m.role==="assistant"){
      const actions=document.createElement("div");actions.className="message-actions";
      const copy=document.createElement("button");copy.textContent="Copy";copy.onclick=()=>navigator.clipboard?.writeText(m.text);
      const speak=document.createElement("button");speak.textContent="Read aloud";speak.onclick=()=>speakText(m.text);
      actions.append(copy,speak);bubble.appendChild(actions);
    }
    $("messages").appendChild(el);
  });
  $("chatScroll").scrollTop=$("chatScroll").scrollHeight;
}
function startNewChat(){
  currentId=makeId();conversations.unshift({id:currentId,title:"New conversation",messages:[],updated:Date.now()});
  saveConversations();renderHistory();renderMessages();$("topTitle").textContent="New conversation";$("messageInput").focus();
}
function openConversation(id){currentId=id;const c=currentConversation();$("topTitle").textContent=c?.title||"Conversation";renderMessages();closeSidebar()}
function addMessage(role,text){
  let c=currentConversation();if(!c){startNewChat();c=currentConversation()}
  c.messages.push({role,text});c.updated=Date.now();
  if(role==="user"&&c.title==="New conversation")c.title=text.slice(0,42)+(text.length>42?"…":"");
  saveConversations();renderHistory();renderMessages();$("topTitle").textContent=c.title;
}
function setBusy(v){busy=v;$("sendBtn").disabled=v;$("messageInput").disabled=v}
function showTyping(){
  const el=document.createElement("div");el.className="message assistant";el.id="typing";
  el.innerHTML='<div class="bubble"><div class="message-label">CARAXES AI</div><div class="typing">Thinking…</div></div>';
  $("messages").appendChild(el);$("chatScroll").scrollTop=$("chatScroll").scrollHeight;
}
async function sendMessage(text){
  if(busy||!text.trim())return;
  if(!currentConversation())startNewChat();
  const finalText=attachedText?`${text.trim()}\n\n[Attached file: ${attachedName}]\n${attachedText}`:text.trim();
  attachedText="";attachedName="";$("attachmentChip").hidden=true;$("attachmentChip").textContent="";
  addMessage("user",finalText);$("messageInput").value="";resizeInput();setBusy(true);showTyping();
  const c=currentConversation();
  const messages=c.messages.slice(-24).map(m=>({role:m.role==="assistant"?"model":"user",text:m.text}));
  try{
    const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages})});
    const data=await response.json();
    $("typing")?.remove();
    if(!response.ok)throw new Error(data.error||"The request failed.");
    addMessage("assistant",data.reply);
  }catch(err){
    $("typing")?.remove();
    addMessage("assistant","I couldn't complete that request: "+err.message);
  }finally{setBusy(false);$("messageInput").focus()}
}
function resizeInput(){const t=$("messageInput");t.style.height="auto";t.style.height=Math.min(t.scrollHeight,180)+"px"}
function speakText(text){if(!("speechSynthesis"in window)){alert("Text-to-speech is not supported in this browser.");return}speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(text))}
function closeSidebar(){$("sidebar").classList.remove("open");$("scrim").classList.remove("show")}
function showView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  const target=$(name+"View");if(target)target.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  $("topTitle").textContent=({chat:"New conversation",image:"Image studio",video:"Video studio",audio:"Voice tools",files:"Documents"})[name]||"Workspace";
  closeSidebar();
}
$("newChat").onclick=startNewChat;
$("chatForm").addEventListener("submit",e=>{e.preventDefault();sendMessage($("messageInput").value)});
$("messageInput").addEventListener("input",resizeInput);
$("messageInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chatForm").requestSubmit()}});
document.querySelectorAll(".suggestion").forEach(b=>b.onclick=()=>sendMessage(b.dataset.prompt));
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$("clearHistory").onclick=()=>{if(confirm("Clear all saved chat history on this device?")){conversations=[];currentId=null;saveConversations();renderHistory();renderMessages();$("topTitle").textContent="New conversation"}};
$("openSidebar").onclick=()=>{$("sidebar").classList.add("open");$("scrim").classList.add("show")};
$("closeSidebar").onclick=closeSidebar;$("scrim").onclick=closeSidebar;
$("fileInput").onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>300000){alert("Please choose a text file under 300 KB.");e.target.value="";return}
  try{attachedText=await file.text();attachedName=file.name;$("attachmentChip").textContent="Attached: "+file.name;$("attachmentChip").hidden=false}
  catch{alert("Could not read this file.")}
  e.target.value="";
};
$("voiceInput").onclick=()=>{
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert("Voice input is not supported in this browser. Try Chrome.");return}
  const rec=new SR();rec.lang=navigator.language||"en-IN";rec.interimResults=false;
  $("voiceInput").textContent="Listening…";
  rec.onresult=e=>{$("messageInput").value+=($("messageInput").value?" ":"")+e.results[0][0].transcript;resizeInput()};
  rec.onerror=()=>alert("Voice input could not start. Check microphone permission.");
  rec.onend=()=>$("voiceInput").textContent="⌁";rec.start();
};
$("testVoice").onclick=()=>speakText("Hello. This is CARAXES AI voice output.");
$("stopVoice").onclick=()=>speechSynthesis?.cancel();
$("voiceSupport").textContent=("speechSynthesis"in window)?"Device text-to-speech is available. Voice input depends on browser support.":"Text-to-speech is not supported in this browser.";
(async()=>{
  try{const r=await fetch("/api/health");const d=await r.json();$("connectionText").textContent=d.aiConfigured?"AI connected":"Server online · API key needed";$("connectionText").previousElementSibling.style.background=d.aiConfigured?"#8a9c77":"#b49a70"}
  catch{$("connectionText").textContent="Server connection unavailable"}
})();
renderHistory();
if(conversations.length){currentId=conversations[0].id;openConversation(currentId)}else{renderMessages()}
