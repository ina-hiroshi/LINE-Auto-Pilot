import { useState } from 'react';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import { Code, MessageSquare, AlertTriangle } from 'lucide-react';

export default function DevSandbox() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDangerModalOpen, setIsDangerModalOpen] = useState(false);
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ isVisible: true, message, type });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Code className="text-indigo-600" />
          開発用サンドボックス
        </h1>
        <p className="text-gray-500 mt-1">共通コンポーネントの動作確認用ページです。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Modal Section */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-blue-500" />
            共通モーダル
          </h2>
          <div className="space-y-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              通常モーダルを表示
            </button>
            <button
              onClick={() => setIsDangerModalOpen(true)}
              className="w-full px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              危険操作モーダルを表示
            </button>
          </div>
        </section>

        {/* Toast Section */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-orange-500" />
            共通トースト
          </h2>
          <div className="space-y-4">
            <button
              onClick={() => showToast('操作が正常に完了しました')}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              成功トーストを表示
            </button>
            <button
              onClick={() => showToast('エラーが発生しました', 'error')}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              エラートーストを表示
            </button>
          </div>
        </section>
      </div>

      {/* Modal Instances */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={() => showToast('保存しました')}
        title="設定の保存"
        message="変更内容を保存してもよろしいですか？"
        confirmText="保存する"
      />

      <Modal
        isOpen={isDangerModalOpen}
        onClose={() => setIsDangerModalOpen(false)}
        onConfirm={() => showToast('削除しました', 'error')}
        title="データの削除"
        message="この操作は取り消せません。本当に削除しますか？"
        confirmText="削除する"
        variant="danger"
      />

      {/* Toast Instance */}
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
}
