'use strict';
(async()=>{
 const get=id=>document.getElementById(id),dialog=get('poster-reader'),collections=get('poster-collections');
 const filters=get('poster-filters'),buttons=[...filters.querySelectorAll('[data-filter]')];
 const sections=[...collections.querySelectorAll('.collection-section')];
 const categories=buttons.map(button=>button.dataset.filter);
 let data,items=[],index=-1,returnFocus=null,returnY=0,openedFromGallery=false,renderToken=0;
 const readFilter=()=>{const type=new URL(location.href).searchParams.get('type');return categories.includes(type)?type:'all';};
 const visibleItems=()=>items.filter(item=>readFilter()==='all'||item.group===readFilter());
 function urlFor(id){
  const url=new URL(location.href),poster=items.find(item=>item.id===id);
  if(poster&&readFilter()!=='all'&&poster.group!==readFilter())url.searchParams.set('type',poster.group);
  url.hash='poster='+encodeURIComponent(id);return url.pathname+url.search+url.hash;
 }
 function applyFilter(category){
  sections.forEach(section=>{section.hidden=category!=='all'&&section.id!==category;});
  buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===category)));
  const count=items.filter(item=>category==='all'||item.group===category).length;
  const label=category==='all'?'':data.groups.find(group=>group.id===category)?.title;
  get('poster-count').textContent=`${count} ${count===1?'poster':'posters'}${label?' · '+label:''}`;
 }
 function normalizeLocation(){
  const url=new URL(location.href),type=url.searchParams.get('type');
  if(url.searchParams.has('type')&&(!categories.includes(type)||type==='all'))url.searchParams.delete('type');
  const hash=new URLSearchParams(url.hash.slice(1)),id=hash.get('poster');
  const poster=items.find(item=>item.id===id);
  if(hash.has('poster')&&!poster)url.hash='';
  else if(poster){
   const category=url.searchParams.get('type')||'all';
   if(category!=='all'&&category!==poster.group)url.searchParams.set('type',poster.group);
  }else if(url.hash){
   let target;try{target=document.getElementById(decodeURIComponent(url.hash.slice(1)));}catch{}
   if(!target)url.hash='';
   else if(sections.includes(target)&&url.searchParams.get('type')&&url.searchParams.get('type')!==target.id)url.hash='collections';
  }
  if(url.href!==location.href)history.replaceState(history.state,'',url);
  return poster?.id;
 }
 function syncLocation(){
  if(!data)return;
  const id=normalizeLocation();applyFilter(readFilter());
  if(id){
   openedFromGallery=Boolean(history.state?.posterReader);
   if(openedFromGallery){
    const origin=history.state.origin==='story'?get('introduction'):collections;
    returnFocus=origin.querySelector(`[data-poster="${history.state.posterId||id}"]`);
    returnY=history.state.returnY??scrollY;
   }else if(!dialog.open){returnFocus=collections.querySelector(`[data-poster="${id}"]`);returnY=scrollY;}
   show(id);
  }else closeView();
 }
 function showFilmReferences(poster){
  const container=get('reader-films');container.replaceChildren();
  const films=(poster.filmIds||[]).map(id=>data.films?.[id]).filter(Boolean);
  container.hidden=films.length===0;
  films.forEach(film=>{
   const row=document.createElement('p'),link=document.createElement('a'),rating=document.createElement('span');
   row.className='reader-film';link.href='https://www.imdb.com/title/'+film.imdbId+'/';
   link.target='_blank';link.rel='noopener noreferrer';link.textContent=film.title+' ('+film.year+')';
   link.setAttribute('aria-label',film.title+' ('+film.year+') on IMDb (opens in a new tab)');
   rating.className='reader-film-rating';rating.textContent=Number.isFinite(film.rating)?'IMDb '+film.rating.toFixed(1)+'/10':'IMDb rating unavailable';
   row.append(link,rating);container.append(row);
  });
  if(films.length&&data.filmRatingsCheckedOn){
   const checked=document.createElement('p');checked.className='reader-films-checked';
   const date=new Date(data.filmRatingsCheckedOn+'T00:00:00Z');
   checked.textContent='Ratings checked '+new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(date);
   container.append(checked);
  }
 }
 function show(id){
  index=items.findIndex(c=>c.id===id);if(index<0)return;
  const c=items[index],groupItems=visibleItems(),position=groupItems.findIndex(i=>i.id===id);
  if(position<0)return;
  get('reader-title').textContent=c.title;get('reader-group').textContent=data.groups.find(g=>g.id===c.group).title;
  showFilmReferences(c);
  get('reader-position').textContent=`${position+1} of ${groupItems.length}`;
  const picture=document.querySelector('.reader-picture'),image=get('reader-image'),token=++renderToken;
  picture.setAttribute('aria-busy','true');image.src=c.image;image.alt=c.alt;
  image.width=c.width;image.height=c.height;
  get('reader-download').href=c.image;
  get('reader-download').download=c.title.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'.png';
  get('reader-prev').disabled=position===0;get('reader-next').disabled=position===groupItems.length-1;
  get('reader-message').textContent='Loading poster…';get('copy-fallback').hidden=true;
  document.title=c.title+' · Movie Posters';
  if(!dialog.open)dialog.showModal();
  document.querySelector('.reader-content').scrollTop=0;
  image.decode().then(()=>{
   if(token!==renderToken)return;
   picture.setAttribute('aria-busy','false');
   if(get('reader-message').textContent==='Loading poster…')get('reader-message').textContent='';
  }).catch(()=>{
   if(token!==renderToken)return;
   get('reader-message').textContent='Could not load this poster. Try downloading the PNG.';
  });
 }
 function closeView(){
  if(!dialog.open)return;dialog.close();index=-1;renderToken++;document.title='Movie Posters · Ben Tan';
  requestAnimationFrame(()=>{
   if(openedFromGallery){window.scrollTo(0,returnY);returnFocus?.focus({preventScroll:true});}
   else returnFocus?.focus();
  });
 }
 function close(){
  if(openedFromGallery&&history.state?.posterReader){history.back();return;}
  history.replaceState(null,'',location.pathname+location.search);closeView();
 }
 function step(delta){
  const candidates=visibleItems(),position=candidates.findIndex(item=>item.id===items[index]?.id),next=candidates[position+delta];if(!next)return;
  history.replaceState(history.state,'',urlFor(next.id));show(next.id);get('reader-title').focus({preventScroll:true});
 }
 get('main').addEventListener('click',e=>{
  const a=e.target.closest('[data-poster]');if(!a||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;
  if(!items.some(item=>item.id===a.dataset.poster))return;
  e.preventDefault();returnFocus=a;returnY=scrollY;openedFromGallery=true;
  history.pushState({posterReader:true,posterId:a.dataset.poster,origin:a.closest('.poster-link')?'gallery':'story',returnY},'',urlFor(a.dataset.poster));applyFilter(readFilter());show(a.dataset.poster);
 });
 buttons.forEach(button=>button.addEventListener('click',()=>{
  const category=button.dataset.filter;if(category===readFilter())return;
  const url=new URL(location.href);
  if(category==='all')url.searchParams.delete('type');else url.searchParams.set('type',category);
  url.hash='';history.pushState({posterFilter:true},'',url);applyFilter(category);
 }));
 filters.addEventListener('keydown',event=>{
  const current=buttons.indexOf(event.target);if(current<0)return;
  let next;
  if(event.key==='ArrowRight')next=(current+1)%buttons.length;
  if(event.key==='ArrowLeft')next=(current-1+buttons.length)%buttons.length;
  if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;
  if(next===undefined)return;event.preventDefault();buttons[next].focus();
 });
 get('reader-close').addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 get('reader-prev').addEventListener('click',()=>step(-1));get('reader-next').addEventListener('click',()=>step(1));
 dialog.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea'))return;
  if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}
 });
 get('reader-copy').addEventListener('click',async()=>{
  const url=new URL(urlFor(items[index].id),location.origin).href;
  try{await navigator.clipboard.writeText(url);get('reader-message').textContent='Link copied.';}
  catch{get('copy-fallback').hidden=false;get('copy-url').value=url;get('copy-url').focus();get('copy-url').select();get('reader-message').textContent='Select and copy the link below.';}
 });
 addEventListener('popstate',syncLocation);
 try{
  const response=await fetch('/guides/movie-posters/posters-data.json');if(!response.ok)throw Error('Could not load posters');
  data=await response.json();items=data.items;
  buttons.forEach(button=>{
   const count=items.filter(item=>button.dataset.filter==='all'||item.group===button.dataset.filter).length;
   button.querySelector('.filter-count').textContent=count;
   button.setAttribute('aria-label',`${button.querySelector('span').textContent}, ${count} posters`);
  });
  syncLocation();filters.hidden=false;
 }catch{
  // The server-rendered gallery remains usable as direct full-resolution links.
  get('main').querySelectorAll('[data-poster]').forEach(a=>{a.removeAttribute('data-poster');});
 }
})();
