'use client';

import { useEffect, useRef } from 'react';
import { LineChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function EcgSensorCard() {

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const buffer = useRef<number[]>(new Array(300).fill(0))

  const draw = () => {

    const canvas = canvasRef.current
    if(!canvas) return

    const ctx = canvas.getContext("2d")
    if(!ctx) return

    ctx.clearRect(0,0,canvas.width,canvas.height)

    ctx.beginPath()

    buffer.current.forEach((v,i)=>{

      const x = i * canvas.width / buffer.current.length
    
      let y = canvas.height - v * 40
    
      if (y < 0) y = 0
    
      if(i===0) ctx.moveTo(x,y)
      else ctx.lineTo(x,y)
    
    })

    ctx.strokeStyle="red"
    ctx.lineWidth=2
    ctx.stroke()
  }

  useEffect(()=>{

    const handler = (event: Event)=>{

      const customEvent = event as CustomEvent
      const data = customEvent.detail

      if(!data) return

      const ecg = Math.max(0, (data.ecg - 2048) / 100)

      buffer.current.push(ecg)
      buffer.current.shift()

      draw()

    }

    window.addEventListener("esp-data",handler)

    return ()=>window.removeEventListener("esp-data",handler)

  },[])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <LineChart className="w-6 h-6" />
          ECG Real-time
        </CardTitle>
      </CardHeader>

      <CardContent>
         <div className="text-sm text-muted-foreground">25mm/sec 10mm/mV</div>
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          className="w-full border rounded mt-4"
        />
      </CardContent>
    </Card>
  )
}