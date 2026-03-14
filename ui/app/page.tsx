"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalculator } from '@fortawesome/free-solid-svg-icons';
import { model_call } from "@/utils/model_call";	


interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}
export default function Home() {



//history
const history=useRef<ImageData[]>([]);

const [mouseDown ,setMouseDown]=useState(false);
const canvasRef=useRef<HTMLCanvasElement>(null)

const prevPoint= useRef<{x:number ,y:number} | null>(null)

//screenshot constant 
const [isSelecting,setIsSelecting]=useState(false)
const [isDragging,setIsDragging]= useState(false)
const [selection,setSelection] =useState<SelectionRect | null>(null)
const [capturedImage,setCapturedImage]=useState<HTMLImageElement | null>(null)
const [selectionStyle,setSelectionStyle]= useState({
left:0,
top:0,
width:0,
height:0,
})

const dragStart=useRef<{x:number,y:number} | null >(null);


//screenshot functions
const download = (dataURL: string) => {
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = "screenshot.png";
  link.click();
};
const handleMouseDown_ss= (e:React.MouseEvent)=>{
	if(!isSelecting)return;
	e.preventDefault();
	const {x,y}= getCurrentPosition(e)
	dragStart.current={x,y}
	setIsDragging(true)

  setSelection({ startX: x, startY: y, endX: x, endY: y });


}

const handleMouseMove_ss=(e:React.MouseEvent)=>{
if(!isDragging || !dragStart.current)return;
e.preventDefault()

const {x,y}= getCurrentPosition(e)
const start= dragStart.current
const rect = {
      left: Math.min(start.x, x),
      top: Math.min(start.y, y),
      width: Math.abs(x - start.x),
      height: Math.abs(y - start.y),
    };


  setSelectionStyle(rect);
    setSelection({ startX: start.x, startY: start.y, endX: x, endY: y });


}



////////////orchestration stuff
const handleMouseDown = (e: React.MouseEvent) => {
  if (isSelecting) {
    handleMouseDown_ss(e); 
  }
  else {
    setMouseDown(true);      }
};
const handleMouseMove = (e: React.MouseEvent) => {
  if (isSelecting) {
    handleMouseMove_ss(e);
  }
};
const handleMouseUpMain = (e: React.MouseEvent) => {
  if (isSelecting) {
    handleMouseUp_ss(e);
  }
  else {
    setMouseDown(false);
    prevPoint.current = null;
  }
};
//////////////////
const handleMouseUp_ss = async (e:React.MouseEvent)=>{
if(!isDragging) return ;
e.preventDefault();
setIsDragging(false);

const canvas=canvasRef.current;
  if (!canvas || !selection) return;

  const x = Math.min(selection.startX, selection.endX);
    const y = Math.min(selection.startY, selection.endY);
    const w = Math.abs(selection.endX - selection.startX);
    const h = Math.abs(selection.endY - selection.startY);

    if (w < 5 || h < 5) {
      setSelection(null);
      return;
    }

    const scaleX = canvas.width / canvas.getBoundingClientRect().width;
    const scaleY = canvas.height / canvas.getBoundingClientRect().height;


    const offscreen = document.createElement("canvas");
    offscreen.width = w * scaleX;
    offscreen.height = h * scaleY;
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) return;
offCtx.fillStyle = "white";
offCtx.fillRect(0, 0, offscreen.width, offscreen.height);

    offCtx.drawImage(
      canvas,
      x * scaleX, y * scaleY,
      w * scaleX, h * scaleY,
      0, 0,
      w * scaleX, h * scaleY
    );

    const dataURL = offscreen.toDataURL("image/png");
    const img = new Image();
    img.src = dataURL;
    img.onload = () => {
      console.log("Captured HTMLImageElement");
      setCapturedImage(img);
    };

    setIsSelecting(false);
    //download(dataURL);
    const result= await model_call(dataURL)
	console.log("RESULTTTTTTTTTTTTTTTTTT",result)


	    const ctx = canvas.getContext("2d");
   if (ctx && selection) {
    ctx.font = "50px Arial";
    ctx.fillStyle = "black";

    const textX = Math.max(selection.startX, selection.endX)+50;
    const textY = Math.max(selection.startY, selection.endY)-20;

    ctx.fillText(result, textX, textY);
}
}

const getCurrentPosition=(e:React.MouseEvent)=>{
const canvas= canvasRef?.current;
if (!canvas) return { x: 0, y: 0 };

const rect=canvas?.getBoundingClientRect();
const x = e.clientX- rect.left;
const y= e.clientY- rect.top;


return {x,y};

}


//MAIN DRAW FN 
const draw=({ctx,currentP,prevPosition}:any)=>{
const {x:currX,y:currY}= currentP;
const startPosition=prevPosition??currentP;

//add to history 
	if (prevPosition == null){
		const canvas=canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
	      let snapshot=ctx.getImageData(0, 0, canvas.width, canvas.height)
	      history.current.push(snapshot);      }}
	}


ctx.beginPath();
ctx.lineWidth = 4;
ctx.lineCap = "round";
ctx.lineJoin = "round";

ctx.moveTo(startPosition.x,startPosition.y);
ctx.lineTo(currX,currY);
ctx.stroke();
}

//use effect for ctrl z-> undo
useEffect(()=>{
const handleUndo=(e:KeyboardEvent)=>{
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx || history.current.length === 0) return;
      const prevState = history.current.pop();
      if (prevState) ctx.putImageData(prevState, 0, 0);
    }
	    	

}

window.addEventListener("keydown", handleUndo);
  return () => window.removeEventListener("keydown", handleUndo);



},[]);
//use effect for cursor on canvas operations
useEffect(()=>{




const handler=(e:React.MouseEvent)=>{
if(!mouseDown) return;
if (isSelecting) return;

const currentP= getCurrentPosition(e);
const ctx= canvasRef?.current?.getContext("2d");

if (!currentP || !ctx) return;

draw({ctx,currentP,prevPosition:prevPoint.current

})
prevPoint.current=currentP;

};

const handleMouse=()=>{

setMouseDown(false)
prevPoint.current=null;


}

canvasRef?.current?.addEventListener("mousemove",handler);

window.addEventListener("mouseup",handleMouse);

return ()=>{
canvasRef?.current?.removeEventListener("mousemove",handler);
window.removeEventListener("mouseup",handleMouse);


}
},[mouseDown,isSelecting]);

return (
<div className="main_div" >
 <div style={{ position: "relative", width: "fit-content" }}>
<canvas 
ref={canvasRef}
onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUpMain}

width={700} 
height={700} 
className="bg-white border-white rounded-lg">

</canvas>



                {isDragging && selectionStyle.width > 0 && (
            <div
              style={{
                position: "absolute",
                left: selectionStyle.left,
                top: selectionStyle.top,
                width: selectionStyle.width,
                height: selectionStyle.height,
                border: "2px dashed #4ecdc4",
                background: "rgba(78,205,196,0.08)",
                pointerEvents: "none",
                boxShadow: "0 0 0 1px rgba(78,205,196,0.3)",
              }}
            />
          )}

          {isSelecting && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(0,0,0,0.25)",
              borderRadius: "12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <p style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: "14px",
                background: "rgba(0,0,0,0.5)",
                padding: "8px 16px",
                borderRadius: "6px",
                letterSpacing: "0.05em",
              }}>
                Drag to select a region
              </p>
            </div>
          )}
        </div>



<div 
className="  text-white mt-2.5 hover:text-gray-400 cursor-pointer"
 onClick={() => { setIsSelecting(true); setSelection(null); setCapturedImage(null); }}
>
 <FontAwesomeIcon icon={faCalculator} size="2x"  />

</div>




</div>

    
    );
}




