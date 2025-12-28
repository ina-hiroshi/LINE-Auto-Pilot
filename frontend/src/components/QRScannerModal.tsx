import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { X, Camera, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type QRScannerModalProps = {
  isOpen: boolean
  onClose: () => void
  onScan: (data: string) => void
}

export default function QRScannerModal({ isOpen, onClose, onScan }: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isOpen) {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError(null)

    let stream: MediaStream | null = null

    const tick = () => {
      if (!videoRef.current || !canvasRef.current) return

      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        if (ctx) {
          canvas.height = video.videoHeight
          canvas.width = video.videoWidth
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          })

          if (code) {
            // Draw box around QR code
            ctx.beginPath()
            ctx.lineWidth = 4
            ctx.strokeStyle = '#00c3dc'
            ctx.moveTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y)
            ctx.lineTo(code.location.topRightCorner.x, code.location.topRightCorner.y)
            ctx.lineTo(code.location.bottomRightCorner.x, code.location.bottomRightCorner.y)
            ctx.lineTo(code.location.bottomLeftCorner.x, code.location.bottomLeftCorner.y)
            ctx.lineTo(code.location.topLeftCorner.x, code.location.topLeftCorner.y)
            ctx.stroke()

            onScan(code.data)
            return // Stop scanning
          }
        }
      }

      requestRef.current = requestAnimationFrame(tick)
    }

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Wait for video to be ready
          videoRef.current.onloadedmetadata = () => {
            setLoading(false)
            videoRef.current?.play()
            requestRef.current = requestAnimationFrame(tick)
          }
        }
      } catch (err) {
        console.error('Error accessing camera:', err)
        setError('カメラへのアクセスが許可されていません。')
        setLoading(false)
      }
    }

    startCamera()

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [isOpen, onScan])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary-600" />
              QRコードを読み取る
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Camera View */}
          <div className="relative aspect-square bg-black flex items-center justify-center overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm">カメラを起動中...</p>
              </div>
            )}
            
            {error ? (
              <div className="text-white text-center p-6">
                <p className="text-red-400 font-bold mb-2">エラー</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />
                
                {/* Overlay Guide */}
                <div className="absolute inset-0 border-[40px] border-black/50 pointer-events-none">
                  <div className="w-full h-full border-2 border-primary-500/50 relative">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-primary-500"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-primary-500"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-primary-500"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-primary-500"></div>
                  </div>
                </div>
                <p className="absolute bottom-8 left-0 right-0 text-center text-white text-sm font-medium drop-shadow-md">
                  枠内にQRコードを合わせてください
                </p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
