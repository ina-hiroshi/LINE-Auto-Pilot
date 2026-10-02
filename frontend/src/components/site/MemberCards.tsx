import { Stamp } from 'lucide-react'

// 会員証の見本。MemberCardLIFF.tsx（お客様が実際に見る会員証）と同じ見た目にしてある。
// 会員証の見た目を変えたときは、ここも合わせて直すこと。

// Mock data for preview
const mockCustomer = {
  display_name: '山田 太郎',
  points: 1250,
  member_no: 'ABC12345',
  rank: 'Gold'
}

// Card Template Component - Matches MemberCardLIFF.tsx exactly
export function MemberCardPreview({ template, color = '#00c3dc', title = "MEMBER'S CARD" }: { 
  template: 'simple' | 'dark' | 'elegant' | 'pop'
  color?: string
  title?: string
}) {
  const getCardStyle = () => {
    const base = "ui-real w-full max-w-sm min-h-[220px] rounded-xl shadow-xl p-4 relative overflow-hidden transition-all duration-300 flex flex-col"
    switch (template) {
      case 'simple': return `${base} text-gray-800 border border-gray-100 bg-white`
      case 'elegant': return `${base} text-[#44403C] border border-[#E7E5E4] bg-white`
      case 'pop': return `${base} text-gray-800 border-2 border-white bg-white`
      case 'dark': return `${base} text-slate-200 border border-slate-700 bg-slate-900`
      default: return `${base} text-white`
    }
  }

  return (
    <div className={getCardStyle()}>
      {/* Background Accents */}
      {template === 'simple' && (
        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }}></div>
      )}
      {template === 'elegant' && (
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#44403C 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      )}
      {template === 'pop' && (
        <>
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-200 rounded-bl-full opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary-200 rounded-tr-full opacity-50"></div>
        </>
      )}
      {template === 'dark' && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-slate-800/50 to-transparent"></div>
        </>
      )}

      {/* Card Content */}
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start mb-2">
          <h3 className={`font-bold text-lg tracking-wider ${template === 'elegant' ? 'font-serif' : ''}`}>
            {title}
          </h3>
        </div>
        
        <div className="flex-1 flex flex-col justify-center space-y-3">
          <div className="flex justify-between items-end">
            <div>
              <p className={`text-xs mb-1 ${template === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
              <p className={`font-medium text-base tracking-wide ${template === 'elegant' ? 'font-serif' : ''}`}>
                {mockCustomer.display_name}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-xs mb-1 ${template === 'pop' ? 'opacity-75' : 'opacity-60'}`}>POINTS</p>
              <p className={`text-3xl font-bold ${template === 'pop' ? 'text-primary-600' : template === 'elegant' ? 'font-serif' : ''}`}>
                {mockCustomer.points.toLocaleString()} pt
              </p>
            </div>
          </div>
          
          <div className={`pt-2 border-t flex justify-between text-xs ${
            template === 'simple' ? 'border-gray-100 text-gray-400' :
            template === 'elegant' ? 'border-[#E7E5E4]' :
            template === 'pop' ? 'border-gray-100 text-gray-500' :
            'border-slate-700 text-slate-500'
          }`}>
            <span>No. {mockCustomer.member_no}</span>
            <span>Rank: {mockCustomer.rank}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Stamp Card Preview Component - Matches MemberCardLIFF.tsx exactly
export function StampCardPreview({ template, color = '#00c3dc' }: { 
  template: 'simple' | 'dark' | 'elegant' | 'pop'
  color?: string
}) {
  const stampCount = 7
  const totalSlots = 10

  const getCardStyle = () => {
    const base = "ui-real w-full max-w-sm min-h-[220px] rounded-xl shadow-xl p-4 relative overflow-hidden transition-all duration-300 flex flex-col"
    switch (template) {
      case 'simple': return `${base} text-gray-800 border border-gray-100 bg-white`
      case 'elegant': return `${base} text-[#44403C] border border-[#E7E5E4] bg-white`
      case 'pop': return `${base} text-gray-800 border-2 border-white bg-white`
      case 'dark': return `${base} text-slate-200 border border-slate-700 bg-slate-900`
      default: return `${base} text-white`
    }
  }

  const getStampStyle = (filled: boolean) => {
    if (!filled) {
      switch (template) {
        case 'dark': return 'border-slate-700 text-slate-700'
        default: return 'border-gray-200 text-gray-300'
      }
    }
    switch (template) {
      case 'pop': return 'border-primary-500 text-primary-500 bg-primary-50'
      case 'dark': return 'border-current opacity-80'
      case 'elegant': return 'border-current opacity-80'
      default: return 'border-current opacity-80'
    }
  }
  
  return (
    <div className={getCardStyle()}>
      {/* Background Accents */}
      {template === 'simple' && (
        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }}></div>
      )}
      {template === 'elegant' && (
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#44403C 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      )}
      {template === 'pop' && (
        <>
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-200 rounded-bl-full opacity-50"></div>
          <div className="absolute bottom-0 left-0 w-16 h-16 bg-primary-200 rounded-tr-full opacity-50"></div>
        </>
      )}
      {template === 'dark' && (
        <>
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]"></div>
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-slate-800/50 to-transparent"></div>
        </>
      )}
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <h3 className={`font-bold text-lg tracking-wider ${template === 'elegant' ? 'font-serif' : ''}`}>STAMP CARD</h3>
        
        <div className="flex-1 flex flex-col justify-between py-1">
          <div className="grid grid-cols-5 gap-1 px-8">
            {Array.from({ length: totalSlots }).map((_, i) => (
              <div 
                key={i} 
                className={`aspect-square rounded-full border flex items-center justify-center text-[8px] ${getStampStyle(i < stampCount)}`}
              >
                {i < stampCount ? <Stamp className="w-2.5 h-2.5" /> : i + 1}
              </div>
            ))}
          </div>
          
          <div className="space-y-0.5 mt-auto">
            <div className={`text-right text-[10px] ${template === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>
              あと {totalSlots - stampCount} 個で 特典チケット
            </div>

            <div className="flex justify-between items-end border-t pt-1 border-dashed border-gray-300/30">
              <div>
                <p className={`text-[8px] mb-0.5 ${template === 'pop' ? 'opacity-75' : 'opacity-60'}`}>MEMBER NAME</p>
                <p className={`font-medium text-sm tracking-wide ${template === 'elegant' ? 'font-serif' : ''}`}>
                  {mockCustomer.display_name}
                </p>
              </div>
            </div>
            
            <div className={`flex justify-between text-[10px] mt-1 flex-shrink-0 ${
              template === 'simple' ? 'text-gray-500' :
              template === 'elegant' ? 'text-[#44403C]/80' :
              template === 'pop' ? 'text-gray-600' :
              'text-slate-400'
            }`}>
              <span>No. {mockCustomer.member_no}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
