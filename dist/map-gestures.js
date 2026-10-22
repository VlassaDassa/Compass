import {snapSeatPosition,validateSeatPosition} from './office-model.js';

/** SVG coordinates stay independent of screen size and the current zoom. */
export function attachCanvasGestures({svg,map,getFloor,toWorld,zoom,applyCamera,saveSeat,saveRoom,render,report,isActive}){
  let drag=null,pinch=null;
  const preview=()=>{
    if(drag?.seat){
      const el=svg.querySelector(`[data-seat="${drag.seat.id}"]`);
      el?.setAttribute('transform',`translate(${drag.seat.x} ${drag.seat.y})`);
      el?.classList.remove('dragging','drag-invalid');
      const label=el?.querySelector('.seat-coordinate');
      if(label)label.textContent=`X ${drag.seat.x} · Y ${drag.seat.y}`;
    }
    if(drag?.room)svg.querySelector(`[data-room-shape="${drag.room.id}"]`)?.setAttribute('transform',`translate(${drag.room.x} ${drag.room.y})`);
  };
  svg.addEventListener('pointerenter',()=>map.canvasHovered=true);
  svg.addEventListener('pointerleave',()=>map.canvasHovered=false);
  svg.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.target.setPointerCapture(event.pointerId);
    map.gestures.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(map.gestures.size===2){
      preview();
      const [a,b]=[...map.gestures.values()];
      pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),camera:{...map.camera},anchor:toWorld((a.x+b.x)/2,(a.y+b.y)/2)};
      drag=null;map.moved=true;map.dragging=false;
      return;
    }
    map.moved=false;
    const point=toWorld(event.clientX,event.clientY),floor=getFloor();
    const editable=map.editing&&!map.spacePanning&&map.gestures.size===1;
    const seatId=editable?event.target.closest('.office-seat')?.dataset.seat:null;
    const roomId=editable&&!seatId?event.target.closest('[data-room-drag]')?.dataset.roomDrag:null;
    drag={start:{x:event.clientX,y:event.clientY},camera:{...map.camera},point,seat:seatId?structuredClone(floor.seats.find(s=>s.id===seatId)):null,room:roomId?structuredClone(floor.rooms.find(r=>r.id===roomId)):null};
    if(drag.seat){
      map.seatId=drag.seat.id;
      svg.querySelectorAll('.office-seat').forEach(el=>el.classList.toggle('selected',el.dataset.seat===seatId));
    }
  });
  svg.addEventListener('pointermove',event=>{
    if(!map.gestures.has(event.pointerId))return;
    map.gestures.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(map.gestures.size===2&&pinch){
      const [a,b]=[...map.gestures.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);
      map.camera={...pinch.camera};zoom(pinch.distance/Math.max(1,distance),pinch.anchor);map.moved=true;return;
    }
    if(!drag||map.gestures.size!==1)return;
    let dx=event.clientX-drag.start.x,dy=event.clientY-drag.start.y;
    if(Math.hypot(dx,dy)>5)map.moved=true;
    if(!map.moved)return;
    map.dragging=true;
    if(drag.seat){
      const horizontal=Math.abs(dx)>=Math.abs(dy);
      if(event.shiftKey){if(horizontal)dy=0;else dx=0;}
      const point=snapSeatPosition(getFloor(),drag.seat.id,drag.seat.x+dx*drag.point.scale,drag.seat.y+dy*drag.point.scale);
      if(event.shiftKey){if(horizontal)point.y=drag.seat.y;else point.x=drag.seat.x;}
      drag.nextSeat=point;drag.error='';
      try{validateSeatPosition(getFloor(),drag.seat.id,point.x,point.y);}catch(error){drag.error=error.message;}
      const el=svg.querySelector(`[data-seat="${drag.seat.id}"]`);
      el.setAttribute('transform',`translate(${point.x} ${point.y})`);
      el.classList.add('dragging');el.classList.toggle('drag-invalid',!!drag.error);
      const label=el.querySelector('.seat-coordinate');if(label)label.textContent=`X ${point.x} · Y ${point.y}`;
      report(drag.error||`X ${point.x} · Y ${point.y}`,!!drag.error);
    }else if(drag.room){
      const x=Math.max(20,Math.round((drag.room.x+dx*drag.point.scale)/20)*20),y=Math.max(20,Math.round((drag.room.y+dy*drag.point.scale)/20)*20);
      drag.nextRoom={...drag.room,x,y};
      svg.querySelector(`[data-room-shape="${drag.room.id}"]`)?.setAttribute('transform',`translate(${x} ${y})`);
      report(`Кабинет · X ${x} · Y ${y}`);
    }else{
      map.camera={...drag.camera,x:drag.camera.x-dx*drag.point.scale,y:drag.camera.y-dy*drag.point.scale};applyCamera();
    }
  });
  const finish=async event=>{
    const moved=map.moved,finished=drag;
    map.gestures.delete(event.pointerId);
    if(event.target.hasPointerCapture?.(event.pointerId))event.target.releasePointerCapture(event.pointerId);
    if(map.gestures.size<2)pinch=null;
    drag=null;map.dragging=false;
    if(event.type==='pointercancel'){if(isActive())render();return;}
    if(!moved||!finished)return;
    try{
      if(finished.nextSeat){
        if(finished.error)throw new Error(finished.error);
        await saveSeat(finished.seat.id,finished.nextSeat);
        if(isActive()){render();report(`Сохранено · X ${finished.nextSeat.x} · Y ${finished.nextSeat.y}`);}
      }else if(finished.nextRoom){
        await saveRoom(finished.nextRoom);
        if(isActive()){render();report('Положение кабинета сохранено');}
      }
    }catch(error){if(isActive()){render();report(error.message,true);}}
  };
  svg.addEventListener('pointerup',finish);
  svg.addEventListener('pointercancel',finish);
  svg.addEventListener('click',event=>{if(map.moved){event.preventDefault();event.stopPropagation();map.moved=false;}},true);
  svg.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey){event.preventDefault();if(!map.gestures.size)zoom(event.deltaY>0?1.12:.89,toWorld(event.clientX,event.clientY));}
  },{passive:false});
}
