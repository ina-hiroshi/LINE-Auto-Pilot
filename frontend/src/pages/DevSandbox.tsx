import { useState, useEffect } from 'react';
import { Code, Crown, Zap, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Toast from '../components/Toast';

export default function DevSandbox() {
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({
    isVisible: false,
    message: '',
    type: 'success'
  });

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setCurrentPlan(data.plan || 'free');
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    }
  };

  const updatePlan = async (newPlan: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase
        .from('profiles')
        .update({ plan: newPlan })
        .eq('id', user.id);

      if (error) throw error;

      setCurrentPlan(newPlan);
      setToast({
        isVisible: true,
        message: `プランを ${newPlan} に変更しました`,
        type: 'success'
      });
      
      // Notify other components
      window.dispatchEvent(new Event('profile-updated'));

    } catch (error) {
      console.error('Error updating plan:', error);
      setToast({
        isVisible: true,
        message: 'プランの変更に失敗しました',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Code className="text-primary-600" />
          開発用サンドボックス
        </h1>
        <p className="text-gray-500 mt-1">
          開発用のデバッグ機能を提供します。
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Crown size={20} className="text-yellow-500" />
          プラン切り替え
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          現在のプラン: <span className="font-bold uppercase text-primary-600">{currentPlan}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => updatePlan('free')}
            disabled={loading || currentPlan === 'free'}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
              currentPlan === 'free'
                ? 'border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <Shield size={20} className="text-gray-600" />
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">Free Plan</div>
              <div className="text-xs text-gray-500">無料プラン</div>
            </div>
          </button>

          <button
            onClick={() => updatePlan('pro')}
            disabled={loading || currentPlan === 'pro'}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
              currentPlan === 'pro'
                ? 'border-primary-200 bg-primary-50 text-primary-400 cursor-not-allowed'
                : 'border-gray-200 hover:border-primary-400 hover:bg-primary-50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
              <Zap size={20} className="text-primary-600" />
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">Pro Plan</div>
              <div className="text-xs text-gray-500">AI応答・無制限</div>
            </div>
          </button>

          <button
            onClick={() => updatePlan('executive')}
            disabled={loading || currentPlan === 'executive'}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
              currentPlan === 'executive'
                ? 'border-purple-200 bg-purple-50 text-purple-400 cursor-not-allowed'
                : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50'
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Crown size={20} className="text-purple-600" />
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900">Executive Plan</div>
              <div className="text-xs text-gray-500">全機能・優先サポート</div>
            </div>
          </button>
        </div>
      </div>

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
}
