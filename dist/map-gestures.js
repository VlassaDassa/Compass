import {snapSeatPosition,validateSeatPosition,snapObjectPosition,validateObject,validateRoom} from './office-model.js';
import {resizeLayout,validateLayoutResize} from './map-resize.js';

/** SVG coordinates stay independent of screen size and the current zoom. */
export function attachCanvasGestures({svg,map,getFloor,toWorld,zoom,applyCamera,saveSeat,saveRoom,saveObject,saveResize,previewResize,previewRoom,select,render,report,isActive}){
  let drag=null,pinch=null;
  const screenPoint=point=>point.view||point;
  const preview=()=>{
    if(drag?.seat){
      const el=svg.querySelector(`[data-seat="${drag.seat.id}"]`);
      el?.setAttribute('transform',`translate(${drag.seat.x} ${drag.seat.y})`);
      el?.classList.remove('dragging','drag-invalid');
      const label=el?.querySelector('.seat-coordinate');
      if(label)label.textContent=`X ${drag.seat.x} · Y ${drag.seat.y}`;
    }
    if(drag?.room&&previewRoom)previewRoom(drag.room);
    if(drag?.room&&!previewRoom)svg.querySelector(`[data-room-shape="${drag.room.id}"]`)?.setAttribute('transform',`translate(${drag.room.x} ${drag.room.y})`);
    if(drag?.object)svg.querySelector(`[data-object="${drag.object.id}"]`)?.setAttribute('transform',`translate(${drag.object.x} ${drag.object.y})`);
    if(drag?.resize)previewResize?.({floor:drag.floor,origin:{x:0,y:0}});
    svg.querySelectorAll('.map-object.dragging,.office-room.drag-invalid').forEach(el=>el.classList.remove('dragging','drag-invalid'));
    svg.classList?.remove('map-resize-invalid');
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
      pinch={distance:Math.hypot(a.x-b.x,a.y-b.y),camera:{...map.camera},anchor:screenPoint(toWorld((a.x+b.x)/2,(a.y+b.y)/2))};
      drag=null;map.moved=true;map.dragging=false;
      return;
    }
    if(map.gestures.size>2)return;
    map.moved=false;
    const point=toWorld(event.clientX,event.clientY),floor=getFloor();
    const editable=map.editing&&!map.spacePanning&&map.gestures.size===1;
    const handle=editable?event.target.closest('[data-resize-kind]'):null;
    const seatId=editable&&!handle?event.target.closest('.office-seat')?.dataset.seat:null;
    const objectId=editable&&!handle&&!seatId?event.target.closest('[data-object]')?.dataset.object:null;
    const zone=editable&&!handle&&!seatId&&!objectId?event.target.closest('[data-room-shape]'):null;
    const roomId=zone?.dataset.roomShape||(!handle&&!objectId&&editable&&!seatId?event.target.closest('[data-room-drag]')?.dataset.roomDrag:null);
    const resizeKind=handle?.dataset.resizeKind;
    const collection=resizeKind==='room'?floor.rooms:resizeKind==='seat'?floor.seats:floor.objects;
    const sized=handle&&resizeKind!=='floor'?collection?.find(r=>r.id===handle.dataset.resizeId):null;
    const resizeItem=resizeKind==='floor'?floor:sized;
    drag={start:{x:event.clientX,y:event.clientY},camera:{...map.camera},point,seat:seatId?structuredClone(floor.seats.find(s=>s.id===seatId)):null,room:roomId?structuredClone(floor.rooms.find(r=>r.id===roomId)):null,object:objectId?structuredClone(floor.objects.find(o=>o.id===objectId)):null,floor:handle?structuredClone(floor):null,resize:handle&&resizeItem?{kind:resizeKind,id:handle.dataset.resizeId,axis:handle.dataset.resizeAxis}:null};
    if(handle&&resizeKind!=='floor')select?.(resizeKind,resizeItem.id);
    else if(seatId)select?.('seat',seatId);
    else if(objectId)select?.('object',objectId);
    else if(roomId)select?.('room',roomId);
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
    const currentPoint=toWorld(event.clientX,event.clientY),currentView=screenPoint(currentPoint),startView=screenPoint(drag.point),worldDx=currentPoint.x-drag.point.x,worldDy=currentPoint.y-drag.point.y,viewDx=currentView.x-startView.x,viewDy=currentView.y-startView.y;
    if(Math.hypot(dx,dy)>5)map.moved=true;
    if(!map.moved)return;
    map.dragging=true;
    if(drag.resize){
      const item=drag.resize;
      drag.nextResize=resizeLayout(drag.floor,item.kind,item.id,item.axis,worldDx,worldDy);drag.error='';
      try{validateLayoutResize(drag.nextResize);}catch(error){drag.error=error.message;}
      svg.setPointerCapture?.(event.pointerId);
      previewResize?.(drag.nextResize);svg.classList.toggle('map-resize-invalid',!!drag.error);
      report(drag.error||`Размер · ${drag.nextResize.width} × ${drag.nextResize.height}`,!!drag.error);
    }else if(drag.object){
      const horizontal=Math.abs(dx)>=Math.abs(dy);if(event.shiftKey){if(horizontal)dy=0;else dx=0;}
      const point=snapObjectPosition(getFloor(),drag.object.id,drag.object.x+worldDx,drag.object.y+worldDy);
      if(event.shiftKey){if(horizontal)point.y=drag.object.y;else point.x=drag.object.x;}
      drag.nextObject={...drag.object,...point};drag.error='';
      try{validateObject(getFloor(),drag.nextObject);}catch(error){drag.error=error.message;}
      const el=svg.querySelector(`[data-object="${drag.object.id}"]`);el.setAttribute('transform',`translate(${point.x} ${point.y})`);el.classList.add('dragging');
      report(drag.error||`${drag.object.name} · X ${point.x} · Y ${point.y}`,!!drag.error);
    }else if(drag.seat){
      const horizontal=Math.abs(dx)>=Math.abs(dy);
      if(event.shiftKey){if(horizontal)dy=0;else dx=0;}
      const point=snapSeatPosition(getFloor(),drag.seat.id,drag.seat.x+worldDx,drag.seat.y+worldDy);
      if(event.shiftKey){if(horizontal)point.y=drag.seat.y;else point.x=drag.seat.x;}
      drag.nextSeat=point;drag.error='';
      try{validateSeatPosition(getFloor(),drag.seat.id,point.x,point.y);}catch(error){drag.error=error.message;}
      const el=svg.querySelector(`[data-seat="${drag.seat.id}"]`);
      el.setAttribute('transform',`translate(${point.x} ${point.y})`);
      el.classList.add('dragging');el.classList.toggle('drag-invalid',!!drag.error);
      const label=el.querySelector('.seat-coordinate');if(label)label.textContent=`X ${point.x} · Y ${point.y}`;
      report(drag.error||`X ${point.x} · Y ${point.y}`,!!drag.error);
    }else if(drag.room){
      const x=Math.max(20,Math.round((drag.room.x+worldDx)/20)*20),y=Math.max(20,Math.round((drag.room.y+worldDy)/20)*20);
      drag.nextRoom={...drag.room,x,y};
      drag.error='';try{validateRoom(getFloor(),drag.nextRoom);}catch(error){drag.error=error.message;}
      if(previewRoom){svg.setPointerCapture?.(event.pointerId);previewRoom(drag.nextRoom);}else svg.querySelector(`[data-room-shape="${drag.room.id}"]`)?.setAttribute('transform',`translate(${x} ${y})`);
      svg.querySelector(`[data-room-shape="${drag.room.id}"]`)?.classList.toggle('drag-invalid',!!drag.error);
      report(drag.error||`Зона · X ${x} · Y ${y}`,!!drag.error);
    }else{
      map.camera={...drag.camera,x:drag.camera.x-viewDx,y:drag.camera.y-viewDy};applyCamera();
    }
  });
  const finish=async event=>{
    const moved=map.moved,finished=drag;
    map.gestures.delete(event.pointerId);
    if(event.target.hasPointerCapture?.(event.pointerId))event.target.releasePointerCapture(event.pointerId);
    if(map.gestures.size<2)pinch=null;
    drag=null;map.dragging=false;
    svg.classList?.remove('map-resize-invalid');
    if(event.type==='pointercancel'){if(isActive())render();return;}
    if(!moved||!finished)return;
    try{
      if(finished.error)throw new Error(finished.error);
      if(finished.nextResize){
        await saveResize(finished.nextResize);
        if(isActive()){render();report(`Размер сохранён · ${finished.nextResize.width} × ${finished.nextResize.height}`);}
      }else if(finished.nextObject){
        await saveObject(finished.nextObject);if(isActive()){render();report('Положение объекта сохранено');}
      }else if(finished.nextSeat){
        await saveSeat(finished.seat.id,finished.nextSeat);
        if(isActive()){render();report(`Сохранено · X ${finished.nextSeat.x} · Y ${finished.nextSeat.y}`);}
      }else if(finished.nextRoom){
        await saveRoom(finished.nextRoom);
        if(isActive()){render();report('Положение зоны сохранено');}
      }
    }catch(error){if(isActive()){render();report(error.message,true);}}
  };
  svg.addEventListener('pointerup',finish);
  svg.addEventListener('pointercancel',finish);
  svg.addEventListener('click',event=>{if(map.moved){event.preventDefault();event.stopPropagation();map.moved=false;}},true);
  svg.addEventListener('wheel',event=>{
    if(event.ctrlKey||event.metaKey){event.preventDefault();if(!map.gestures.size)zoom(event.deltaY>0?1.12:.89,screenPoint(toWorld(event.clientX,event.clientY)));}
  },{passive:false});
}
