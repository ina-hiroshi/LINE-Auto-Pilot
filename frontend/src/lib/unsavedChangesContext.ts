import { createContext } from 'react'

/** 設定画面が Provider に渡す、現在の「未保存の変更」の状態と保存処理 */
export type UnsavedChangesSnapshot = {
  isDirty: boolean
  /** 反映（保存）に成功したら true。検証エラーや失敗は false を返し、移動を止める */
  save: () => Promise<boolean>
}

export type UnsavedChangesRegistry = {
  /** 登録を解除する関数を返す。getter は呼ばれた時点の最新値を返すこと */
  register: (getSnapshot: () => UnsavedChangesSnapshot) => () => void
}

// Provider の外（テストなど）では null。フックは何もしない。
export const UnsavedChangesContext = createContext<UnsavedChangesRegistry | null>(null)
