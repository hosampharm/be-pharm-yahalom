/* Camera frames are decoded on this device and are never uploaded. */
(() => {
  let stopActive = () => {};
  const originalShow = window.show;
  window.show = function(id) { stopActive(); return originalShow(id); };
  document.addEventListener('visibilitychange', () => { if(document.hidden) stopActive(); });
  window.addEventListener('pagehide', () => stopActive());
  const key = value => String(value).padStart(14, '0');
  for (const [screenId,inputId] of [
    ['scan','dermoscanInput'],
    ['search','dermosearchInput'],
    ['supplementLookup','lookupQuery']
  ]) {
    const screen = document.getElementById(screenId);
    const box = document.createElement('section'); box.className = 'camera-scanner';
    const start = document.createElement('button'); start.type='button'; start.textContent='סריקת ברקוד במצלמה';
    const stop = document.createElement('button'); stop.type='button'; stop.textContent='סגירת המצלמה'; stop.hidden=true;
    const video = document.createElement('video'); video.muted=true; video.autoplay=true; video.playsInline=true; video.setAttribute('playsinline',''); video.hidden=true;
    const status = document.createElement('p'); status.setAttribute('role','status');
    status.textContent='כוונו לברקוד שעל האריזה. הצילום נשאר במכשיר ואינו נשמר או נשלח.';
    box.append(start,stop,video,status); screen.querySelector('h1').after(box);
    let stream, timer, generation=0;
    function close() {
      generation++; clearInterval(timer); stream?.getTracks().forEach(track=>track.stop());
      stream=null; video.srcObject=null; video.hidden=true; stop.hidden=true; start.disabled=false;
    }
    stop.addEventListener('click',()=>{close();status.textContent='המצלמה נסגרה. אפשר לסרוק שוב או להקליד ברקוד.';start.focus();});
    start.addEventListener('click',async()=>{
      stopActive(); stopActive=close; const token=++generation;
      if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia){status.textContent='יש לפתוח את האתר המאובטח ב-Safari או בדפדפן תומך מצלמה. אפשר גם להקליד ברקוד.';return;}
      start.disabled=true;stop.hidden=false;status.textContent='ממתין לאישור גישה למצלמה…';
      try {
        const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
        if(token!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
        stream=acquired;video.hidden=false;video.srcObject=stream;await video.play();
        if(token!==generation)return;
        const reader=new ZXingBrowser.BrowserMultiFormatOneDReader();
        const canvas=document.createElement('canvas');const context=canvas.getContext('2d',{willReadFrequently:true});
        status.textContent='כוונו את כל הברקוד למצלמה, באור טוב. התרחקו מעט אם התמונה מטושטשת.';
        timer=setInterval(()=>{
          if(!video.videoWidth)return;
          canvas.width=video.videoWidth;canvas.height=video.videoHeight;context.drawImage(video,0,0);
          let code;try{code=reader.decodeFromCanvas(canvas).getText();}catch{return;}
          if(!/^\d{8,14}$/.test(code))return;
          const sources=[
            {products:window.SUPPLEMENT_CATALOG.products,screen:'supplementLookup',input:'lookupQuery',list:'lookupList'},
            {products:window.DERMO_CATALOG.products,screen:'search',input:'dermosearchInput',list:'dermosearchList'}
          ];
          const destination=sources.find(source=>source.products.some(p=>key(p.barcode)===key(code)));
          const product=destination?.products.find(p=>key(p.barcode)===key(code));
          close();status.textContent=product?'הברקוד זוהה. פותח את המוצר…':'הברקוד '+code+' זוהה, אך לא נמצא בקטלוג. אפשר להקליד אותו שוב או לפנות לצוות.';
          if(destination)show(destination.screen);
          const input=document.getElementById(destination?.input||inputId);input.value=product?.barcode||code;input.dispatchEvent(new Event('input',{bubbles:true}));
          if(product)document.querySelector('#'+destination.list+' button')?.click();
        },250);
      } catch(error) {
        if(token!==generation)return;
        close();status.textContent=error.name==='NotAllowedError'?'לא ניתנה הרשאה למצלמה. אפשר לאפשר גישה בהגדרות האתר ב-Safari ולנסות שוב, או להקליד ברקוד.':'לא ניתן לפתוח את המצלמה. סגרו אפליקציה אחרת שמשתמשת בה ונסו שוב, או הקלידו ברקוד.';
      }
    });
  }
})();
