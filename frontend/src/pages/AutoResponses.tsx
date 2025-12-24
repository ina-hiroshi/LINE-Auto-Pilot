import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, MessageSquare, Tag, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

interface AutoResponseRule {
  id: string;
  mainKeyword: string;
  subKeywords: string[];
  response: string;
  isActive: boolean;
}

export default function AutoResponses() {
  const [rules, setRules] = useState<AutoResponseRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [currentRule, setCurrentRule] = useState<AutoResponseRule | null>(null);
  const [newSubKeyword, setNewSubKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; ruleId: string | null }>({ isOpen: false, ruleId: null });
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get store_id
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!store) {
        console.error('Store not found');
        return;
      }
      setStoreId(store.id);

      // Get rules
      const { data: rules, error } = await supabase
        .from('auto_responses')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map DB columns to frontend state
      const mappedRules = rules.map(r => ({
        id: r.id,
        mainKeyword: r.keyword,
        subKeywords: r.sub_keywords || [],
        response: r.response_text,
        isActive: r.is_active
      }));

      setRules(mappedRules);
    } catch (error) {
      console.error('Error fetching rules:', error);
      setToast({ isVisible: true, message: 'データの取得に失敗しました', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rule: AutoResponseRule) => {
    setCurrentRule({ ...rule });
    setIsEditing(true);
  };

  const handleCreate = () => {
    setCurrentRule({
      id: '',
      mainKeyword: '',
      subKeywords: [],
      response: '',
      isActive: true,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!currentRule || !storeId) return;
    
    try {
      setSaving(true);
      
      const ruleData = {
        store_id: storeId,
        keyword: currentRule.mainKeyword,
        sub_keywords: currentRule.subKeywords,
        response_text: currentRule.response,
        is_active: currentRule.isActive,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (currentRule.id) {
        // Update
        const { error: updateError } = await supabase
          .from('auto_responses')
          .update(ruleData)
          .eq('id', currentRule.id);
        error = updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from('auto_responses')
          .insert(ruleData);
        error = insertError;
      }

      if (error) throw error;

      await fetchRules();
      setIsEditing(false);
      setCurrentRule(null);
      setToast({ isVisible: true, message: '保存しました', type: 'success' });
    } catch (error) {
      console.error('Error saving rule:', error);
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteModal({ isOpen: true, ruleId: id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.ruleId) return;

    try {
      const { error } = await supabase
        .from('auto_responses')
        .delete()
        .eq('id', deleteModal.ruleId);

      if (error) throw error;
      
      setRules(rules.filter(r => r.id !== deleteModal.ruleId));
      setToast({ isVisible: true, message: '削除しました', type: 'success' });
    } catch (error) {
      console.error('Error deleting rule:', error);
      setToast({ isVisible: true, message: '削除に失敗しました', type: 'error' });
    } finally {
      setDeleteModal({ isOpen: false, ruleId: null });
    }
  };

  const addSubKeyword = () => {
    if (newSubKeyword.trim() && currentRule) {
      if (!currentRule.subKeywords.includes(newSubKeyword.trim())) {
        setCurrentRule({
          ...currentRule,
          subKeywords: [...currentRule.subKeywords, newSubKeyword.trim()]
        });
      }
      setNewSubKeyword('');
    }
  };

  const removeSubKeyword = (keyword: string) => {
    if (currentRule) {
      setCurrentRule({
        ...currentRule,
        subKeywords: currentRule.subKeywords.filter(k => k !== keyword)
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">自動応答設定</h1>
          <p className="text-gray-500 mt-1">LINE公式アカウントの自動応答メッセージを管理します</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition shadow-sm"
        >
          <Plus size={20} />
          新規ルール作成
        </button>
      </div>

      {isEditing && currentRule ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 animate-in slide-in-from-top-4 duration-200">
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Edit2 size={18} className="text-primary-600" />
              {currentRule.id ? 'ルールを編集' : '新規ルール作成'}
            </h2>
            <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  メインキーワード <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={currentRule.mainKeyword}
                    onChange={(e) => setCurrentRule({ ...currentRule, mainKeyword: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="例: 営業時間"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">お客様がこの言葉を送ってきた時に、自動で返信します。</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  サブキーワード（関連語・判定補強）
                </label>
                <div className="bg-blue-50 p-3 rounded-lg mb-3 text-xs text-blue-800 leading-relaxed">
                  <p className="font-bold mb-1">💡 ヒント: 組み合わせで判定されます</p>
                  メインキーワードが含まれていなくても、サブキーワードが複数（2つ以上）含まれていれば自動応答します。<br/>
                  単なる言い換えだけでなく、文脈を補う言葉も登録しましょう。<br/>
                  <span className="text-blue-600 mt-1 block">例：「何時まで」「開店」を登録 → 「営業時間は何時まで？」に反応</span>
                </div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newSubKeyword}
                    onChange={(e) => setNewSubKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addSubKeyword()}
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="例: 何時まで"
                  />
                  <button
                    onClick={addSubKeyword}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                  >
                    追加
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {currentRule.subKeywords.length === 0 && (
                    <span className="text-sm text-gray-400">サブキーワードはまだありません</span>
                  )}
                  {currentRule.subKeywords.map((keyword) => (
                    <span key={keyword} className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700 shadow-sm">
                      {keyword}
                      <button onClick={() => removeSubKeyword(keyword)} className="text-gray-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  返信メッセージ <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 text-gray-400" size={18} />
                  <textarea
                    value={currentRule.response}
                    onChange={(e) => setCurrentRule({ ...currentRule, response: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent h-72 resize-none"
                    placeholder="自動返信するメッセージを入力してください"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only"
                    checked={currentRule.isActive}
                    onChange={(e) => setCurrentRule({ ...currentRule, isActive: e.target.checked })}
                  />
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors ${currentRule.isActive ? 'bg-primary-600' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${currentRule.isActive ? 'translate-x-6' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {currentRule.isActive ? '有効' : '無効'}
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!currentRule.mainKeyword || !currentRule.response || saving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    保存する
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      
      <div className="grid grid-cols-1 gap-4">
        {rules.map((rule) => (
          <div key={rule.id} className={`bg-white rounded-xl p-6 border transition-all hover:shadow-md ${!rule.isActive ? 'opacity-60 bg-gray-50 border-gray-100' : 'border-gray-100 shadow-sm'}`}>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Tag size={18} className="text-primary-600" />
                    {rule.mainKeyword}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    {rule.isActive ? '有効' : '無効'}
                  </span>
                </div>
                
                {rule.subKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {rule.subKeywords.map((sub, idx) => (
                      <span key={idx} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md border border-gray-200">
                        {sub}
                      </span>
                    ))}
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100">
                  {rule.response}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-6">
                <button 
                  onClick={() => handleEdit(rule)}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(rule.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {rules.length === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <div className="w-16 h-16 bg-blue-50 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">自動応答ルールを作成しましょう</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6 text-left w-fit">
              よくある質問への回答を登録しておくと、24時間365日自動で返信できます。<br/>
              例：「駐車場」→「近隣のコインパーキングをご利用ください」
            </p>
            <button 
              onClick={handleCreate}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition shadow-sm font-bold"
            >
              <Plus size={20} />
              最初のルールを作成する
            </button>
          </div>
        )}
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, ruleId: null })}
        onConfirm={confirmDelete}
        title="ルールを削除"
        message="この自動応答ルールを削除してもよろしいですか？この操作は取り消せません。"
        confirmText="削除する"
        variant="danger"
      />

      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isVisible: false })}
      />
    </div>
  );
}
