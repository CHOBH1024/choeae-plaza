/* Installation is always user initiated; no credential/API response is cached. */
(function(){
  var footer=document.querySelector('footer');
  if(!footer)return;
  var entry=document.createElement('div');entry.className='install-entry';
  entry.innerHTML='<button type="button" id="installApp">앱 설치 안내</button><span id="installStatus" role="status" aria-live="polite"></span>';
  footer.prepend(entry);
  var dialog=document.createElement('dialog');dialog.className='install-dialog';dialog.setAttribute('aria-labelledby','installHeading');
  dialog.innerHTML='<h2 id="installHeading">최애광장을 홈 화면에</h2><p>App Store·Play Store 앱이나 APK 다운로드가 아닌 웹앱(PWA)입니다. 설치와 삭제는 직접 선택하며 영상·검색·로그인에는 인터넷이 필요합니다.</p><h3>아이폰·아이패드</h3><ol><li>이 사이트를 Safari에서 엽니다.</li><li>공유 메뉴에서 홈 화면에 추가를 선택합니다.</li><li>웹 앱으로 열기 옵션이 보이면 켜고 추가를 누릅니다.</li></ol><h3>안드로이드</h3><ol><li>이 사이트를 Chrome에서 엽니다.</li><li>메뉴에서 앱 설치 또는 홈 화면에 추가를 선택합니다.</li><li>설치 안내가 나오면 직접 확인합니다.</li></ol><p>브라우저·기기에 따라 메뉴 이름이나 설치 지원이 다릅니다. 웹앱과 브라우저의 기기 저장소·Google 로그인 상태가 다를 수 있습니다. 아이돌 화면을 기본으로 열려면 아이돌 뮤직 화면에서 홈 화면에 추가하세요.</p><button type="button" id="installClose">닫기</button>';
  document.body.append(dialog);
  var button=document.getElementById('installApp'),status=document.getElementById('installStatus'),pending=null;
  function installed(){return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;}
  button.hidden=installed();
  function showGuide(){dialog.showModal();document.getElementById('installClose').focus();}
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();pending=e;button.textContent='앱 설치';button.hidden=installed();});
  window.addEventListener('appinstalled',function(){pending=null;button.hidden=true;status.textContent='웹앱 설치가 확인되었습니다.';});
  button.addEventListener('click',async function(){
    if(!pending){showGuide();return;}
    var prompt=pending;pending=null;button.disabled=true;
    try{await prompt.prompt();var result=await prompt.userChoice;status.textContent=result.outcome==='accepted'?'설치 요청을 전달했습니다. 기기의 완료 화면을 확인해주세요.':'설치하지 않았습니다. 언제든 설치 안내를 다시 볼 수 있어요.';}
    catch(e){showGuide();}
    finally{button.disabled=false;button.textContent='앱 설치 안내';}
  });
  document.getElementById('installClose').addEventListener('click',function(){dialog.close();button.focus();});
  if('serviceWorker' in navigator && window.isSecureContext)navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(function(){});
})();
