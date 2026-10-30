import {confirmMapPoint,project,unproject} from './photo-location.js?v=20261030-gps-common-navi';
// No geolocation, geocoding, search, uploads, or automatic retries. Tiles load only
// while this user-opened dialog is visible, with normal browser HTTP caching.
export function choosePhotoLocation(row,{isCurrent=()=>true}={}){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='photo-location-dialog';
  dialog.style.cssText='width:min(94vw,560px);max-height:90vh;overflow:auto;box-sizing:border-box';
  dialog.innerHTML=`<h3>地図で撮影地点を指定</h3><p>初期表示は案内用です。写真の撮影地点・現在地・店舗の所在地を示しません。</p><p>地図を動かし、拡大して撮影地点をタップしてください。確定するまで写真に反映しません。</p><p><small>表示範囲の地図画像をOpenStreetMapから取得します。写真やEXIFは送信しません。地図が表示されない場合は地点なしで続行できます。</small></p><div data-map tabindex="0" role="group" aria-label="撮影地点の地図。ドラッグまたは矢印で移動、拡大後タップで選択" style="height:280px;position:relative;overflow:hidden;touch-action:none;background:#eee;border:1px solid #777"><div data-tiles></div><span data-pin hidden style="position:absolute;pointer-events:none;transform:translate(-50%,-100%);font-size:28px;color:#b00020">📍</span></div><p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a></p><div><button type="button" data-zoom="1" aria-label="地図を拡大">＋</button> <button type="button" data-zoom="-1" aria-label="地図を縮小">−</button> <button type="button" data-center>中心を候補にする</button></div><p data-map-status role="status"></p><p data-selection>地点は未選択です</p><button type="button" data-use disabled>この地点を使用</button> <button type="button" data-skip>地点を指定せず続行する</button> <button type="button" data-cancel>キャンセル</button>`;
  const map=dialog.querySelector('[data-map]'),tiles=dialog.querySelector('[data-tiles]'),pin=dialog.querySelector('[data-pin]'),use=dialog.querySelector('[data-use]'),message=dialog.querySelector('[data-map-status]'),selection=dialog.querySelector('[data-selection]');
  let center={latitude:36,longitude:138},zoom=5,point=null,ready=false,epoch=0,finished=false,down=null;
  const finish=value=>{if(finished)return;finished=true;epoch++;dialog.remove();resolve(value);};
  function update(){
   use.disabled=!point||!ready||zoom<16||!isCurrent();
   selection.textContent=point?`選択候補：${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}（未確定）`:'地点は未選択です';
   pin.hidden=!point;
   if(point){const c=project(center,zoom),p=project(point,zoom);pin.style.left=(map.clientWidth/2+p.x-c.x)+'px';pin.style.top=(map.clientHeight/2+p.y-c.y)+'px';}
  }
  function draw(){
   if(finished)return;const id=++epoch;ready=false;tiles.replaceChildren();update();message.textContent='地図を読み込み中…';
   const c=project(center,zoom),w=map.clientWidth,h=map.clientHeight,left=c.x-w/2,top=c.y-h/2,n=2**zoom;
   const positions=[];for(let y=Math.floor(top/256);y<=Math.floor((top+h-1)/256);y++)for(let x=Math.floor(left/256);x<=Math.floor((left+w-1)/256);x++)if(y>=0&&y<n)positions.push({x,y});
   let pending=positions.length,failed=false;
   for(const {x,y} of positions){const img=document.createElement('img');img.alt='';img.draggable=false;img.style.cssText=`position:absolute;width:256px;height:256px;max-width:none;left:${x*256-left}px;top:${y*256-top}px`;img.referrerPolicy='strict-origin-when-cross-origin';
    const done=ok=>{if(id!==epoch||finished)return;failed ||= !ok;if(--pending===0){ready=!failed;message.textContent=failed?'地図を取得できませんでした。自動再試行しません。地点なしで続行できます。':zoom<16?'拡大して撮影地点を確認してください（確定にはズーム16以上）。':'地図上の撮影地点を選び、座標を確認して確定してください。';update();}};
    img.onload=()=>done(true);img.onerror=()=>done(false);img.src=`https://tile.openstreetmap.org/${zoom}/${((x%n)+n)%n}/${y}.png`;tiles.append(img);
   }
  }
  function select(x,y){if(!ready)return;const c=project(center,zoom);point=unproject(c.x+x-map.clientWidth/2,c.y+y-map.clientHeight/2,zoom);update();}
  map.onpointerdown=e=>{down={x:e.clientX,y:e.clientY,id:e.pointerId};map.setPointerCapture(e.pointerId);};
  map.onpointercancel=()=>{down=null;};
  map.onpointerup=e=>{if(!down||down.id!==e.pointerId)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;down=null;if(Math.hypot(dx,dy)>8){const c=project(center,zoom);center=unproject(c.x-dx,c.y-dy,zoom);point=null;draw();}else{const r=map.getBoundingClientRect();select(e.clientX-r.left,e.clientY-r.top);}};
  map.onkeydown=e=>{const d={ArrowLeft:[-128,0],ArrowRight:[128,0],ArrowUp:[0,-128],ArrowDown:[0,128]}[e.key];if(d){e.preventDefault();const c=project(center,zoom);center=unproject(c.x+d[0],c.y+d[1],zoom);point=null;draw();}else if(e.key==='Enter'||e.key===' '){e.preventDefault();select(map.clientWidth/2,map.clientHeight/2);}};
  dialog.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{const next=Math.max(2,Math.min(19,zoom+Number(b.dataset.zoom)));if(next===zoom)return;if(point)center=point;zoom=next;point=null;draw();});
  dialog.querySelector('[data-center]').onclick=()=>select(map.clientWidth/2,map.clientHeight/2);
  use.onclick=()=>{if(use.disabled||!isCurrent())return;finish(confirmMapPoint(row,point));};
  dialog.querySelector('[data-skip]').onclick=()=>finish(null);dialog.querySelector('[data-cancel]').onclick=()=>finish(null);
  dialog.oncancel=e=>{e.preventDefault();finish(null);};dialog.onclose=()=>finish(null);
  document.body.append(dialog);dialog.showModal();draw();
 });
}
