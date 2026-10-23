import test from 'node:test';
import assert from 'node:assert/strict';
import {attachCanvasGestures} from '../dist/map-gestures.js';
import {createOffice,moveSeat} from '../dist/office-model.js';
import {validateLayoutResize} from '../dist/map-resize.js';

function canvas({editing=true,scale=2}={}){
  const floor=createOffice([]).floors[0],seat=floor.seats[0],saved=[],messages=[],handlers={};
  const classes=new Set(),label={textContent:''},element={
    dataset:{seat:seat.id},classList:{add:(c)=>classes.add(c),remove:(...cs)=>cs.forEach(c=>classes.delete(c)),toggle:(c,on)=>on?classes.add(c):classes.delete(c)},
    setAttribute:(key,value)=>element[key]=value,querySelector:()=>label,
    closest:selector=>selector==='.office-seat'?element:null,
    setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}
  };
  const svg={addEventListener:(name,fn)=>handlers[name]=fn,querySelector:()=>element,querySelectorAll:()=>[element]};
  const map={editing,camera:{x:0,y:0,w:1000,h:680},gestures:new Map()};
  let renders=0;
  attachCanvasGestures({svg,map,getFloor:()=>floor,toWorld:(x,y)=>({x:x*scale,y:y*scale,scale}),zoom(){},applyCamera(){},
    saveSeat:async(id,point)=>{moveSeat(floor,id,point.x,point.y,{snap:1});saved.push(point);},saveRoom(){},
    render:()=>renders++,report:(message,error)=>messages.push({message,error}),isActive:()=>true});
  const event=(name,x,y,extra={})=>handlers[name]({type:name,button:0,pointerId:1,clientX:x,clientY:y,target:element,...extra});
  return{seat,element,map,saved,messages,classes,label,event,renders:()=>renders};
}

test('screen drag uses the current zoom and saves a snapped position',async()=>{
  const c=canvas();c.event('pointerdown',100,100);c.event('pointermove',110,125);
  assert.equal(c.element.transform,'translate(70 160)');
  await c.event('pointerup',110,125);
  assert.deepEqual(c.saved,[{x:70,y:160}]);assert.equal(c.renders(),1);
});
test('Shift preserves the original position on the perpendicular axis',async()=>{
  const c=canvas();c.event('pointerdown',100,100);c.event('pointermove',107,125,{shiftKey:true});
  await c.event('pointerup',107,125);
  assert.deepEqual(c.saved,[{x:45,y:160}]);
});
test('overlapping drag is marked and rolls back without saving',async()=>{
  const c=canvas();c.event('pointerdown',100,100);c.event('pointermove',182.5,100);
  assert.ok(c.classes.has('drag-invalid'));
  await c.event('pointerup',182.5,100);
  assert.equal(c.saved.length,0);assert.equal(c.seat.x,45);
  assert.ok(c.messages.at(-1).error);assert.equal(c.renders(),1);
});
test('cancelling a drag does not change the saved layout',async()=>{
  const c=canvas();c.event('pointerdown',100,100);c.event('pointermove',110,125);
  await c.event('pointercancel',110,125);
  assert.equal(c.saved.length,0);assert.equal(c.seat.x,45);assert.equal(c.renders(),1);
});
test('a second finger restores the preview before beginning a pinch',async()=>{
  const c=canvas();c.event('pointerdown',100,100);c.event('pointermove',110,125);
  c.event('pointerdown',180,180,{pointerId:2});
  assert.equal(c.element.transform,'translate(45 110)');assert.equal(c.label.textContent,'X 45 · Y 110');
  assert.ok(!c.classes.has('dragging'));
  await c.event('pointerup',180,180,{pointerId:2});await c.event('pointerup',110,125);
  assert.equal(c.saved.length,0);
});
test('the hand tool pans without moving a workplace',async()=>{
  const c=canvas();c.map.spacePanning=true;c.event('pointerdown',100,100);c.event('pointermove',110,125);
  await c.event('pointerup',110,125);
  assert.equal(c.saved.length,0);assert.deepEqual(c.map.camera,{x:-20,y:-50,w:1000,h:680});
});
test('successive pan moves do not feed the moved camera back into the delta',()=>{
  const handlers={},map={editing:false,camera:{x:0,y:0,w:1000,h:680},gestures:new Map()},target={closest:()=>null,setPointerCapture(){}};
  const svg={addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:()=>[]};
  attachCanvasGestures({svg,map,getFloor:()=>createOffice([]).floors[0],toWorld:(x,y)=>({x:x*2+map.camera.x,y:y*2+map.camera.y,view:{x:x*2+map.camera.x,y:y*2+map.camera.y},scale:2}),applyCamera(){},select(){},report(){},render(){},isActive:()=>true});
  handlers.pointerdown({button:0,pointerId:1,clientX:100,clientY:100,target});
  for(const x of [110,120,130]){handlers.pointermove({pointerId:1,clientX:x,clientY:100,target});assert.equal(map.camera.x,-(x-100)*2);}
});

for(const editing of [false,true])test(`a captured pointer click selects a visible 3D model without Space in ${editing?'edit':'normal'} mode`,async()=>{
  const floor=createOffice([]).floors[0],handlers={},selected=[],root={closest:()=>null,setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}},element={...root,classList:{toggle(){}}};
  const svg={...root,style:{},addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:()=>[element]};
  const map={editing,camera:{x:0,y:0,w:1000,h:680},gestures:new Map()};
  attachCanvasGestures({svg,map,getFloor:()=>floor,toWorld:(x,y)=>({x,y,scale:1}),pick:()=>({kind:'object',id:floor.objects[0].id}),activate:(kind,id)=>selected.push({kind,id}),select(){},render(){},report(){},isActive:()=>true});
  const event={button:0,pointerId:1,clientX:200,clientY:100,target:root};handlers.pointerdown(event);await handlers.pointerup({...event,type:'pointerup'});
  assert.deepEqual(selected,[{kind:'object',id:floor.objects[0].id}]);let prevented=false;handlers.click({preventDefault(){prevented=true;},stopPropagation(){}});assert.ok(prevented);assert.equal(selected.length,1);
});

function resizing({kind='object',axis='e'}={}){
  const floor=createOffice([]).floors[0],object=floor.objects[0],handlers={},saved=[],previews=[],messages=[];
  const id=kind==='floor'?floor.id:object.id;
  const element={dataset:{resizeKind:kind,resizeId:id,resizeAxis:axis},closest:selector=>selector==='[data-resize-kind]'?element:null,setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}};
  const svg={addEventListener:(name,fn)=>handlers[name]=fn,querySelectorAll:()=>[],classList:{toggle(){},remove(){}},setPointerCapture(){}};
  const map={editing:true,camera:{x:0,y:0,w:1000,h:680},gestures:new Map()};let renders=0;
  attachCanvasGestures({svg,map,getFloor:()=>floor,toWorld:(x,y)=>({x:x*2,y:y*2,scale:2}),zoom(){},applyCamera(){},saveResize:async result=>{validateLayoutResize(result);saved.push(result);},previewResize:result=>previews.push(result),render:()=>renders++,report:(message,error)=>messages.push({message,error}),isActive:()=>true});
  const event=(name,x,y,extra={})=>handlers[name]({type:name,button:0,pointerId:1,clientX:x,clientY:y,target:element,...extra});
  return{floor,object,event,saved,previews,messages,renders:()=>renders};
}
test('dragging an object boundary uses zoom and saves the previewed size',async()=>{
  const c=resizing();c.event('pointerdown',100,100);c.event('pointermove',115,100);await c.event('pointerup',115,100);
  assert.equal(c.saved[0].floor.objects[0].width,c.object.width+30);assert.equal(c.renders(),1);
});
test('floor left edge resize is persisted and not treated as a pan',async()=>{
  const c=resizing({kind:'floor',axis:'w'});c.event('pointerdown',100,100);c.event('pointermove',80,100);await c.event('pointerup',80,100);
  assert.equal(c.saved[0].floor.width,c.floor.width+40);assert.equal(c.saved[0].origin.x,-40);
});
test('cancelling a boundary resize rolls back without saving',async()=>{
  const c=resizing();c.event('pointerdown',100,100);c.event('pointermove',115,100);await c.event('pointercancel',115,100);
  assert.equal(c.saved.length,0);assert.equal(c.renders(),1);
});
test('an invalid boundary resize reports the constraint without saving',async()=>{
  const c=resizing();c.event('pointerdown',100,100);c.event('pointermove',600,100);await c.event('pointerup',600,100);
  assert.equal(c.saved.length,0);assert.ok(c.messages.at(-1).error);assert.equal(c.renders(),1);
});
