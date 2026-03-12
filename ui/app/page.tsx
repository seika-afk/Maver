"use client";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalculator } from '@fortawesome/free-solid-svg-icons';

export default function Home() {

//history
const history=useRef<ImageData[]>([]);

const [mouseDown ,setMouseDown]=useState(false);
const canvasRef=useRef<HTMLCanvasElement>(null)

const prevPoint= useRef<{x:number ,y:number} | null>(null)






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




const handler=(e:MouseEvent)=>{
if(!mouseDown) return;

const currentP= getCurrentPosition(e);
const ctx= canvasRef?.current?.getContext("2d");

if (!currentP || !ctx) return;

draw({ctx,currentP,prevPosition:prevPoint.current

})
prevPoint.current=currentP;

};
const getCurrentPosition=(e)=>{
const canvas= canvasRef?.current;
if(!canvas) return

const rect=canvas?.getBoundingClientRect();
const x = e.clientX- rect.left;
const y= e.clientY- rect.top;


return {x,y};

}

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
},[mouseDown]);

return (
<div className="main_div">

<canvas 
ref={canvasRef}
onMouseDown={() => setMouseDown(true)}
width={700} 
height={700} 
className="bg-white border-white rounded-lg">

</canvas>



<div className="  text-white mt-2.5 hover:text-gray-400 cursor-pointer">
 <FontAwesomeIcon icon={faCalculator} size="2x"  />

</div>





</div>

    
    );
}




