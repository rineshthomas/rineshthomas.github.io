(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const menu=$('mobileNav'), menuToggle=$('menuToggle'), help=$('helpPanel');
  const helpButtons = [...document.querySelectorAll('[data-flight-help]')];
  if (window.logicWorld) helpButtons.forEach(button => { button.hidden = false; });
  let helpTrigger;
  const signalLayout=()=>document.dispatchEvent(new Event('worldlayoutchange'));
  const signalLock=()=>document.dispatchEvent(new CustomEvent('worldlock',{detail:!menu.hidden||!help.hidden}));
  function setMenu(open){menu.hidden=!open;menuToggle.setAttribute('aria-expanded',String(open));menuToggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');menuToggle.querySelector('use').setAttribute('href',open?'#i-close':'#i-menu');signalLock();signalLayout();}
  function setHelp(open, restore = false) {
    help.hidden = !open;
    helpButtons.forEach(button => button.setAttribute('aria-expanded', String(open)));
    signalLock();
    if (open) $('closeHelp').focus({preventScroll: true});
    else if (restore) helpTrigger?.focus({preventScroll: true});
  }
  menuToggle.addEventListener('click',()=>{if(!menu.hidden)setMenu(false);else{setHelp(false);setMenu(true);}});
  helpButtons.forEach(button => button.addEventListener('click', () => {
    helpTrigger = menu.contains(button) ? menuToggle : button;
    setMenu(false);
    setHelp(help.hidden);
  }));
  $('closeHelp').addEventListener('click',()=>setHelp(false,true));
  menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
  document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!help.hidden){setHelp(false,true);e.stopImmediatePropagation();}else if(!menu.hidden){setMenu(false);menuToggle.focus({preventScroll:true});e.stopImmediatePropagation();}} , true);
  document.addEventListener('click',e=>{if(!help.hidden&&!help.contains(e.target)&&!helpButtons.some(button=>button.contains(e.target))){setHelp(false);}if(!menu.hidden&&!menu.contains(e.target)&&!menuToggle.contains(e.target)){setMenu(false);}});
  addEventListener('resize',()=>{if(innerWidth>850&&!menu.hidden)setMenu(false);},{passive:true});
  const zoneIds=['home','capabilities','ai','process','contact'];
  document.addEventListener('worldzonechange',e=>document.querySelectorAll('.desktop-nav a,.mobile-nav a').forEach(a=>{if(a.hash==='#'+zoneIds[e.detail.zone])a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');}));
  document.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',signalLayout));
  document.querySelectorAll('[data-service]').forEach(a=>a.addEventListener('click',()=>{$('briefType').value=a.dataset.service;}));
  const form=$('briefForm'),email=$('briefEmail'),idea=$('briefIdea'),result=$('briefResult'),preview=$('briefPreview');
  let latestBrief='';
  function validate(){
    const emailBad=email.value.trim()!==''&&!email.validity.valid,ideaBad=idea.value.trim().length<3;
    $('emailError').hidden=!emailBad;$('ideaError').hidden=!ideaBad;
    email.setAttribute('aria-invalid',String(emailBad));idea.setAttribute('aria-invalid',String(ideaBad));
    signalLayout();if(emailBad){email.focus();return false;}if(ideaBad){idea.focus();return false;}return true;
  }
  form.addEventListener('submit',e=>{
    e.preventDefault();if(!validate())return;
    latestBrief=['PROJECT BRIEF — LOGICLEAP TECHNOLOGIES','',`Name: ${$('briefName').value.trim()||'Not provided'}`,`Email: ${email.value.trim()||'Not provided'}`,`Project: ${$('briefType').value}`,'','IDEA / CHALLENGE',idea.value.trim(),'','TIMELINE / CONSTRAINTS',$('briefTiming').value.trim()||'To discuss'].join('\n');
    preview.value=latestBrief;result.hidden=false;$('briefStatus').textContent='Brief created locally. Nothing has been sent.';signalLayout();
    result.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
  });
  [email,idea].forEach(el=>el.addEventListener('input',()=>{if(el.getAttribute('aria-invalid')==='true'){el.removeAttribute('aria-invalid');$(el===email?'emailError':'ideaError').hidden=true;}if(!result.hidden){result.hidden=true;latestBrief='';signalLayout();}}));
  form.addEventListener('input',e=>{if(e.target!==preview&&!result.hidden){result.hidden=true;latestBrief='';signalLayout();}});
  $('copyBrief').addEventListener('click',async()=>{
    if(!latestBrief)return;
    try{if(!navigator.clipboard||!window.isSecureContext)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(latestBrief);$('briefStatus').textContent='Copied. Paste the brief into your message to LogicLeap.';}
    catch{preview.focus();preview.select();$('briefStatus').textContent='Automatic copy is unavailable here. Your brief is selected: use Copy from your device’s menu, or save the .txt file.';}
  });
  $('saveBrief').addEventListener('click',()=>{if(!latestBrief)return;const url=URL.createObjectURL(new Blob([latestBrief],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='logicleap-project-brief.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);$('briefStatus').textContent='The brief has been saved as a text file. Nothing has been sent.';});
  $('briefFields').disabled=false;
})();
