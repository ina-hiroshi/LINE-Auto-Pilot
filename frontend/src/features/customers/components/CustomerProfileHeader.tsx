import { User } from 'lucide-react'
import type { CustomerDetail } from '../types'

type CustomerProfileHeaderProps = {
  customer: CustomerDetail
}

export function CustomerProfileHeader({ customer }: CustomerProfileHeaderProps) {
  return (
    <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
      <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden shrink-0">
        {customer.profile_picture_url ? (
          <img src={customer.profile_picture_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200">
            <User className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>
      <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 items-center min-w-0">
        <div className="font-bold text-gray-900 text-lg leading-tight truncate">
          {customer.real_name ? (
            <div className="flex items-baseline gap-2">
              <span>{customer.real_name}</span>
              {customer.furigana && (
                <span className="text-xs text-gray-500 font-normal truncate">{customer.furigana}</span>
              )}
            </div>
          ) : (
            customer.display_name || 'ゲスト'
          )}
        </div>
        <div className="flex justify-end">
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              customer.status === 'VIP'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-primary-100 text-primary-800'
            }`}
          >
            {customer.status === 'VIP' ? 'VIP' : '会員'}
          </span>
        </div>
        <div className="text-xs text-gray-500 truncate">
          {customer.real_name && customer.display_name ? `LINE: ${customer.display_name}` : '\u00a0'}
        </div>
        <div className="text-xs text-gray-400 text-right font-mono">
          ID: {customer.line_user_id.substring(0, 8)}…
        </div>
      </div>
    </div>
  )
}
