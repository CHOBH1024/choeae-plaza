import {LANGUAGES,selectLocale} from './locale-core.js';
import {ownedText,ownedTimedText,ownedParamText} from './locale-copy.js?v=20261009-footer';
// Native confirmation prompts need synchronous copy, before any DOM observer runs.
// This reads the same owned catalog and never translates external text.
window.choeaeLocaleText = (key, fallback) => ownedText(key, document.documentElement.dataset.locale || 'ko') ?? fallback;
const labels={
  ko:['가수','음악','소식','놀이터','아이돌 뮤직','트로트·큰글씨','내 저장소','지금, 이 아티스트','나의 최애','다음 최애를 발견하세요','좋아하는 콘텐츠를 공유하세요','대표곡 탐색','새로운 소식','내 컬렉션','밝게','어둡게','언어','접속 국가·브라우저 기준','직접 선택','인터페이스 일부 번역 · 가수명과 외부 콘텐츠는 원문으로 표시됩니다.'],
  zh:['艺人','音乐','资讯','互动','偶像音乐','Trot · 大字','我的收藏','此刻，发现艺人','我的最爱','发现下一位喜爱的艺人','分享你的音乐品味','探索代表歌曲','最新资讯','我的收藏','浅色','深色','语言','按所在国家或浏览器选择','手动选择','部分界面翻译 · 艺人名称和外部内容保留原文。'],
  ja:['アーティスト','音楽','ニュース','ファン広場','アイドル音楽','トロット・大きな文字','マイライブラリ','今、出会いたいアーティスト','お気に入り','次のお気に入りを見つけよう','好きな音楽をシェアしよう','代表曲を探す','新しいニュース','マイコレクション','ライト','ダーク','言語','国・ブラウザーに基づく選択','手動選択','インターフェースの一部を翻訳 · アーティスト名と外部コンテンツは原文で表示します。'],
  en:['Artists','Music','News','Fans','Idol music','Trot · large text','My library','Discover your next artist','My favorites','Find your next favorite','Share your music taste','Explore signature songs','Latest news','My collection','Light','Dark','Language','Country/browser default','Manual selection','Partial interface translation · Artist names and external content stay in their original language.'],
  es:['Artistas','Música','Noticias','Fans','Música idol','Trot · texto grande','Mi biblioteca','Descubre tu próximo artista','Mis favoritos','Encuentra tu próximo favorito','Comparte tu gusto musical','Explorar canciones destacadas','Últimas noticias','Mi colección','Claro','Oscuro','Idioma','Según país o navegador','Selección manual','Traducción parcial de la interfaz · Los nombres y el contenido externo conservan su idioma original.'],
  fr:['Artistes','Musique','Infos','Fans','Musique idol','Trot · grands caractères','Ma bibliothèque','Découvrez votre prochain artiste','Mes favoris','Trouvez votre prochain favori','Partagez vos goûts musicaux','Explorer les titres emblématiques','Dernières actualités','Ma collection','Clair','Sombre','Langue','Selon le pays ou le navigateur','Sélection manuelle','Traduction partielle de l’interface · Les noms et les contenus externes restent dans leur langue d’origine.']
};
// Only owned interface text is translated. Never rewrite artist names, titles or provider content.
const access={
  ko:['다크 모드','화면 선택','주요 메뉴','화면 및 저장 설정','나의 컬렉션','콘텐츠 바로가기'],
  zh:['深色模式','选择界面','主菜单','界面和收藏设置','我的收藏','内容快捷方式'],
  ja:['ダークモード','画面の選択','メインメニュー','画面と保存の設定','マイコレクション','コンテンツへのショートカット'],
  en:['Dark mode','Choose a view','Main navigation','Display and library settings','My collection','Content shortcuts'],
  es:['Modo oscuro','Elegir vista','Menú principal','Ajustes de pantalla y biblioteca','Mi colección','Accesos al contenido'],
  fr:['Mode sombre','Choisir une vue','Navigation principale','Réglages de l’affichage et de la bibliothèque','Ma collection','Raccourcis de contenu']
};
const main=document.getElementById('main');
if(main){
  const row=document.createElement('div');row.className='locale-tools';row.id='localeTools';
  row.innerHTML='<label for="localeSelect" id="localeLabel">언어</label><select id="localeSelect"><option value="auto" lang="en">Auto</option><option value="ko" lang="ko">한국어</option><option value="zh" lang="zh-Hans">中文（简体）</option><option value="ja" lang="ja">日本語</option><option value="en" lang="en">English</option><option value="es" lang="es">Español</option><option value="fr" lang="fr">Français</option></select><span id="localeStatus" role="status"></span><small id="localeNote"></small>';
  main.prepend(row);
  const select=document.getElementById('localeSelect');let chosen=null,automatic=selectLocale(null,(navigator.languages||[navigator.language]).join(',')).lang,active='ko',pending=false;
  try{const saved=localStorage.getItem('choeae_locale');if(LANGUAGES.includes(saved))chosen=saved;}catch{}
  select.value=chosen||'auto';
  function write(selector,text){const el=document.querySelector(selector);if(el){el.lang=active;if(el.textContent!==text)el.textContent=text;}}
  function aria(selector,text){const el=document.querySelector(selector);if(el && el.getAttribute('aria-label')!==text)el.setAttribute('aria-label',text);}
  function render(){
    active=chosen||automatic;const t=labels[active];
    // Card/status updates are not language changes. Re-setting the same attribute
    // would notify dynamic-card observers, whose DOM updates notify us again.
    if(document.documentElement.dataset.locale!==active)document.documentElement.dataset.locale=active;
    row.lang=active;
    ['#tab-singer','#tab-music','#tab-news','#tab-play','[data-act="experience"][data-experience="idol"]','[data-act="experience"][data-experience="classic"]','[data-act="drive"]'].forEach((s,i)=>write(s,t[i]));
    if(document.documentElement.dataset.experience==='idol'){
      ['#heroLead h1','#hubFavoritesHeading','#artistBrowseHeading','#shareHeading'].forEach((s,i)=>write(s,t[7+i]));
    }
    ['#hubQuickNav [data-act="tab"][data-tab="music"]','#hubQuickNav [data-act="tab"][data-tab="news"]','#hubQuickNav [data-act="hub-drive"]'].forEach((s,i)=>write(s,t[11+i]));
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const stamp=el.getAttribute('data-i18n-time');
      const text=stamp===null?parameterText(el,el.getAttribute('data-i18n')):ownedTimedText(el.getAttribute('data-i18n'),active,stamp);
      if(text!==null){el.lang=active;if(el.textContent!==text)el.textContent=text;}
    });
    // Translate only explicitly marked attributes, never input values or provider text.
    for(const [marker,attribute] of [['data-i18n-placeholder','placeholder'],['data-i18n-aria-label','aria-label']]){
      document.querySelectorAll('['+marker+']').forEach(el=>{
        const text=parameterText(el,el.getAttribute(marker));
        if(text!==null){el.lang=active;if(el.getAttribute(attribute)!==text)el.setAttribute(attribute,text);}
      });
    }
    const input=document.getElementById('searchInput');if(input){const placeholder=ownedText(document.documentElement.dataset.experience==='idol'?'searchIdol':'searchClassic',active);if(input.placeholder!==placeholder)input.placeholder=placeholder;input.lang=active;}
    aria('#searchResults',ownedText('searchResults',active));
    if(document.documentElement.dataset.experience==='idol'){write('#heroLead .sub',ownedText('idolSubtitle',active));write('#artistBrowseDescription',ownedText('idolBrowse',active));}
    else {write('#heroLead h1',ownedText('trotHeading',active));write('#heroLead .badge',ownedText('trotBadge',active));write('#heroLead .sub',ownedText('trotSubtitle',active));write('#artistBrowseDescription',ownedText('trotBrowse',active));}
    const idol=document.documentElement.dataset.experience==='idol';
    write('#musicCollectionDescription',ownedText(idol?'idolMusicNote':'trotMusicNote',active));
    write('#shareDescription',ownedText(idol?'idolShareDescription':'trotShareDescription',active));
    const theme=document.getElementById('themeBtn');if(theme)write('#themeBtn',t[theme.getAttribute('aria-pressed')==='true'?14:15]);
    ['#themeBtn','.experience-switch','.tabbar','#headerTools','#hubLibrary','#hubQuickNav'].forEach((s,i)=>aria(s,access[active][i]));
    aria('[data-act="drive"]',t[6]);
    aria('#mobileSettingsToggle',ownedText('displaySettings',active));
    write('#localeLabel',t[16]);select.setAttribute('aria-label',t[16]);write('#localeStatus',t[chosen?18:17]);write('#localeNote',t[19]);
  }
  function parameterText(el,key){
    const values={};
    const name=el.getAttribute('data-i18n-name');if(name!==null)values.name=name;
    for(const key of ['count','total','index']){const value=el.getAttribute('data-i18n-'+key);if(value!==null&&/^\d+$/.test(value)&&Number.isSafeInteger(Number(value)))values[key]=Number(value);}
    return ownedParamText(key,active,values);
  }
  select.addEventListener('change',()=>{chosen=LANGUAGES.includes(select.value)?select.value:null;try{if(chosen)localStorage.setItem('choeae_locale',chosen);else localStorage.removeItem('choeae_locale');}catch{}render();});
  new MutationObserver(()=>{if(!pending){pending=true;queueMicrotask(()=>{pending=false;render();});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-i18n','data-i18n-time','data-i18n-aria-label','data-i18n-placeholder','data-i18n-name','data-i18n-count','data-i18n-total','data-i18n-index']});
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['data-experience']});
  const theme=document.getElementById('themeBtn');if(theme)new MutationObserver(render).observe(theme,{attributes:true,attributeFilter:['aria-pressed']});
  render();
  fetch('/api/locale',{signal:AbortSignal.timeout(3000)}).then(r=>{if(!r.ok)throw Error('LOCALE_FAILED');return r.json();}).then(d=>{if(LANGUAGES.includes(d.lang)){automatic=d.lang;render();}}).catch(()=>{});
}
