import { Clock, User, FileText, MessageSquare, XCircle } from 'lucide-react'
import Modal from '../../../components/Modal'
import {
  canPayReservation,
  formatYen,
  getPaymentStatusBadgeClass,
  getReservationStatusLabel,
  isLineCustomer,
} from '../../../lib/reservationStatus'
import type { Reservation } from '../types'

type ReservationConfirmModalProps = {
  isOpen: boolean
  onClose: () => void
  reservation: Reservation | null
  onPay: () => void
  onPoints: () => void
  onModify: () => void
  onCancel: () => void
  pointsDisabled?: boolean
  pointsDisabledReason?: string
}

export function ReservationConfirmModal({
  isOpen,
  onClose,
  reservation,
  onPay,
  onPoints,
  onModify,
  onCancel,
  pointsDisabled = false,
  pointsDisabledReason,
}: ReservationConfirmModalProps) {
  if (!reservation) return null

  const isCancelled = reservation.status === 'cancelled'
  const isPaid = reservation.status === 'paid'
  const isConfirmed = reservation.status === 'confirmed'
  const payDisabled = isConfirmed && !canPayReservation(reservation.start_time)

  const registrationLabel =
    reservation.registration_type === 'manual' ? '手動登録' : 'LINE予約'

  const showCancelLink = !isCancelled && !isPaid

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="予約確認"
      showDefaultButtons={false}
      footerContent={
        <div className="flex flex-col gap-3 w-full">
          {showCancelLink && (
            <button
              type="button"
              onClick={onCancel}
              className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-1 self-start px-2 py-1 rounded hover:bg-red-50"
            >
              <XCircle size={16} />
              予約をキャンセル
            </button>
          )}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 w-full">
            {!isCancelled && (
              <>
                <button
                  type="button"
                  onClick={onPoints}
                  disabled={pointsDisabled || isCancelled}
                  title={pointsDisabledReason}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 order-2 sm:order-1"
                >
                  ポイント
                </button>
                {!isPaid && (
                  <button
                    type="button"
                    onClick={onModify}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 order-3 sm:order-2"
                  >
                    変更
                  </button>
                )}
              </>
            )}
            {(isPaid || isCancelled || isConfirmed) && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 order-4 sm:order-3 w-full sm:w-auto"
              >
                閉じる
              </button>
            )}
            {isConfirmed && (
              <button
                type="button"
                onClick={onPay}
                disabled={payDisabled}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 order-1 sm:order-4 w-full sm:w-auto"
              >
                決済する
              </button>
            )}
          </div>
          {payDisabled && (
            <p className="text-xs text-gray-500 text-right">予約日以降に決済できます</p>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {!isCancelled && (
            <span
              className={`px-2 py-1 text-xs font-bold rounded-full ${getPaymentStatusBadgeClass(reservation.status)}`}
            >
              {getReservationStatusLabel(reservation.status)}
            </span>
          )}
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
            {registrationLabel}
          </span>
          {isCancelled && (
            <span className="px-2 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700">
              キャンセル
            </span>
          )}
        </div>

        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
              {reservation.customer?.profile_picture_url ? (
                <img
                  src={reservation.customer.profile_picture_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={32} className="text-gray-400" />
              )}
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900">
                {reservation.customer?.real_name ||
                  reservation.customer?.display_name ||
                  'ゲスト'}
              </div>
              {reservation.customer?.furigana && (
                <div className="text-sm text-gray-500">{reservation.customer.furigana}</div>
              )}
              {isLineCustomer(reservation.line_user_id) && (
                <div className="text-xs text-gray-400 mt-1">
                  LINE名: {reservation.customer?.display_name || '-'}
                </div>
              )}
            </div>
          </div>
        </div>

        <AmountCard reservation={reservation} />

        <div className="grid grid-cols-1 gap-3 text-sm">
          <InfoCard
            icon={<Clock className="w-5 h-5 text-primary-500 mt-0.5" />}
            label="日時"
          >
            <div className="text-gray-900 font-medium">
              {new Date(reservation.start_time).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'short',
              })}
            </div>
            <div className="text-xl font-bold text-primary-600 mt-0.5">
              {new Date(reservation.start_time).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' - '}
              {new Date(reservation.end_time).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </InfoCard>

          <InfoCard icon={<User className="w-5 h-5 text-gray-400" />} label="担当スタッフ">
            {reservation.staff?.name || '指定なし'}
          </InfoCard>

          <InfoCard icon={<FileText className="w-5 h-5 text-gray-400" />} label="メニュー">
            {reservation.menu?.name || '指定なし'}
            {reservation.menu?.price != null && ` (¥${reservation.menu.price.toLocaleString()})`}
          </InfoCard>

          <InfoCard icon={<MessageSquare className="w-5 h-5 text-gray-400 mt-0.5" />} label="メモ (店舗用)">
            {reservation.memo &&
            reservation.memo !== 'LINE予約' &&
            reservation.memo !== 'LINE予約(変更)' ? (
              <span className="whitespace-pre-wrap">{reservation.memo}</span>
            ) : (
              <span className="text-gray-400 text-xs">メモはありません</span>
            )}
          </InfoCard>
        </div>
      </div>
    </Modal>
  )
}

function AmountCard({ reservation }: { reservation: Reservation }) {
  const isPaid = reservation.status === 'paid'

  if (isPaid) {
    return (
      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
        <div className="flex justify-between items-start">
          <span className="text-xs font-bold text-emerald-800">決済金額</span>
          <span className="text-xs text-emerald-600">税込</span>
        </div>
        <p className="text-2xl font-bold text-emerald-900 mt-1">
          {formatYen(reservation.paid_amount)}
        </p>
        {reservation.paid_at && (
          <p className="text-xs text-emerald-700 mt-2">
            決済完了:{' '}
            {new Date(reservation.paid_at).toLocaleString('ja-JP', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        {reservation.quoted_amount != null &&
          reservation.paid_amount != null &&
          reservation.quoted_amount !== reservation.paid_amount && (
            <p className="text-xs text-emerald-600 mt-1">
              見込み {formatYen(reservation.quoted_amount)} から変更あり
            </p>
          )}
      </div>
    )
  }

  return (
    <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-amber-800">お会計（見込み）</span>
        <span className="text-xs text-amber-600">税込</span>
      </div>
      <p className="text-2xl font-bold text-amber-900 mt-1">
        {reservation.quoted_amount != null ? formatYen(reservation.quoted_amount) : '未設定'}
      </p>
      {reservation.menu?.name && (
        <p className="text-xs text-amber-700 mt-2">メニュー: {reservation.menu.name}</p>
      )}
      {reservation.quoted_amount == null && !reservation.menu?.name && (
        <p className="text-xs text-amber-600 mt-1">決済時に金額を入力してください</p>
      )}
    </div>
  )
}

function InfoCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      {icon}
      <div>
        <div className="font-bold text-gray-700 text-xs mb-1">{label}</div>
        <div className="text-gray-900 font-medium">{children}</div>
      </div>
    </div>
  )
}
