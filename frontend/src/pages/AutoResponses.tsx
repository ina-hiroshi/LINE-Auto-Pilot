import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Save, MessageSquare, Tag, Loader2, Upload, FileText, Settings, BookOpen, Search, Crown, Smartphone, RefreshCw, Send, Link as LinkIcon } from 'lucide-react';
import ProBadge from '../components/ProBadge';
import { supabase } from '../lib/supabase';
import { extractTextFromFile, extractTextFromPdfBuffer } from '../lib/fileParser';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

// --- Types ---

interface AutoResponseRule {
  id: string;
  mainKeyword: string;
  subKeywords: string[];
  response: string;
  isActive: boolean;
}

type AiSettings = {
  id: string
  is_enabled: boolean
  tone: 'polite' | 'friendly'
  persona_prompt: string
  fixed_replies: { question: string; answer: string }[]
}

type KnowledgeDoc = {
  id: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  is_active: boolean
  created_at: string
}

type TabType = 'keyword' | 'ai_settings' | 'knowledge';

// --- Components ---

const ChatPreview = ({ 
  messages, 
  input, 
  setInput, 
  loading, 
  onSend, 
  scrollRef,
  onRefresh
}: {
  messages: { role: 'user' | 'assistant'; content: string }[];
  input: string;
  setInput: (s: string) => void;
  loading: boolean;
  onSend: () => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onRefresh: () => void;
}) => {
  return (
    <div className="lg:sticky lg:top-8 h-fit mt-8 lg:mt-0">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Smartphone size={16} /> プレビュー
        </h3>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          現在の設定でAIの応答をテストできます
        </p>
      </div>

      <div className="bg-gray-800 rounded-[3rem] p-4 border-4 border-gray-900 shadow-2xl max-w-[320px] mx-auto relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20" />
        
        <div className="bg-[#8c9eff] w-full h-[600px] rounded-[2rem] overflow-hidden relative flex flex-col">
          {/* Preview Header */}
          <div className="h-14 bg-[#2c3e50] text-white z-10 flex items-center justify-between px-4 pt-4 shrink-0">
            <div className="font-bold text-sm truncate">AIアシスタント</div>
            <button 
              type="button"
              onClick={onRefresh}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
              title="チャットをリセット"
            >
              <RefreshCw size={14} className="text-white" />
            </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#7494c0]" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/70 text-xs text-center px-4">
                <p>メッセージを送信して<br/>AIの応答を確認できます</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-[#8de055] text-black rounded-tr-none'
                        : 'bg-white text-black rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white p-2.5 rounded-2xl rounded-tl-none shadow-sm">
                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="bg-white p-2 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && onSend()}
                placeholder="メッセージを入力"
                className="flex-1 px-3 py-2 bg-gray-100 border-none rounded-full text-xs focus:ring-0 focus:outline-none"
                disabled={loading}
              />
              <button
                onClick={onSend}
                disabled={loading || !input.trim()}
                className="p-2 bg-[#2c3e50] text-white rounded-full hover:bg-[#34495e] disabled:opacity-50 transition-colors flex items-center justify-center"
              >
                <Send size={14} className="rotate-45 ml-0.5 mt-0.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-500 mt-4">※実際のLINE画面とは多少異なります</p>
    </div>
  );
};

export default function AutoResponses() {
  const [activeTab, setActiveTab] = useState<TabType>('keyword');
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [toast, setToast] = useState<{ isVisible: boolean; message: string; type: 'success' | 'error' }>({ isVisible: false, message: '', type: 'success' });

  // --- Keyword Response State ---
  const [rules, setRules] = useState<AutoResponseRule[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRule, setCurrentRule] = useState<AutoResponseRule | null>(null);
  const [newSubKeyword, setNewSubKeyword] = useState('');
  const [savingRule, setSavingRule] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; ruleId: string | null }>({ isOpen: false, ruleId: null });
  const [keywordSearch, setKeywordSearch] = useState('');

  // --- AI Response State ---
  const [aiSettings, setAiSettings] = useState<AiSettings>({
    id: '',
    is_enabled: false,
    tone: 'polite',
    persona_prompt: '',
    fixed_replies: []
  });
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [savingAi, setSavingAi] = useState(false);
  const [deleteDocModal, setDeleteDocModal] = useState<{ isOpen: boolean; docId: string | null }>({ isOpen: false, docId: null });

  // --- Test Chat State ---
  const [testChatMessages, setTestChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [testChatMessage, setTestChatMessage] = useState('');
  const [isTestChatLoading, setIsTestChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [testChatMessages]);

  useEffect(() => {
    fetchData();

    const handleProfileUpdate = () => {
      fetchData();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile for plan
      const { data: profile } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user.id)
        .single();
      
      setIsPro(profile?.plan === 'pro' || profile?.plan === 'executive');

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

      // --- Fetch Keyword Rules ---
      const { data: rulesData, error: rulesError } = await supabase
        .from('auto_responses')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (rulesError) throw rulesError;

      const mappedRules = rulesData.map(r => ({
        id: r.id,
        mainKeyword: r.keyword,
        subKeywords: r.sub_keywords || [],
        response: r.response_text,
        isActive: r.is_active
      }));
      setRules(mappedRules);

      // --- Fetch AI Settings ---
      const { data: aiData } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('store_id', store.id)
        .maybeSingle();

      if (aiData) {
        setAiSettings(aiData);
      } else {
        // Create default settings if not exists
        const { data: newSettings, error: createError } = await supabase
          .from('ai_settings')
          .insert({ store_id: store.id })
          .select()
          .single();
        
        if (createError) throw createError;
        if (newSettings) setAiSettings(newSettings);
      }

      // --- Fetch Knowledge Base ---
      const { data: docs } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('store_id', store.id)
        .order('created_at', { ascending: false });

      if (docs) setDocuments(docs);

    } catch (error) {
      console.error('Error fetching data:', error);
      setToast({ isVisible: true, message: 'データの取得に失敗しました', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // --- Keyword Response Handlers ---

  const handleEditRule = (rule: AutoResponseRule) => {
    setCurrentRule({ ...rule });
    setIsEditing(true);
  };

  const handleCreateRule = () => {
    if (!isPro && rules.length >= 10) {
      setToast({ isVisible: true, message: 'Freeプランでは10件までしか登録できません。Proプランにアップグレードすると無制限になります。', type: 'error' });
      return;
    }

    setCurrentRule({
      id: '',
      mainKeyword: '',
      subKeywords: [],
      response: '',
      isActive: true,
    });
    setIsEditing(true);
  };

  const handleSaveRule = async () => {
    if (!currentRule || !storeId) return;
    
    try {
      setSavingRule(true);
      
      const ruleData = {
        store_id: storeId,
        keyword: currentRule.mainKeyword,
        sub_keywords: currentRule.subKeywords,
        response_text: currentRule.response,
        is_active: currentRule.isActive,
        updated_at: new Date().toISOString()
      };

      if (currentRule.id) {
        const { error } = await supabase
          .from('auto_responses')
          .update(ruleData)
          .eq('id', currentRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('auto_responses')
          .insert(ruleData);
        if (error) throw error;
      }

      setToast({ isVisible: true, message: '保存しました', type: 'success' });
      setIsEditing(false);
      fetchData(); // Refresh all data
    } catch (error) {
      console.error('Error saving rule:', error);
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' });
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteModal.ruleId) return;

    try {
      const { error } = await supabase
        .from('auto_responses')
        .delete()
        .eq('id', deleteModal.ruleId);

      if (error) throw error;

      setToast({ isVisible: true, message: '削除しました', type: 'success' });
      setDeleteModal({ isOpen: false, ruleId: null });
      fetchData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      setToast({ isVisible: true, message: '削除に失敗しました', type: 'error' });
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

  const handleToggleRule = async (rule: AutoResponseRule) => {
    if (!storeId) return;
    try {
      const { error } = await supabase
        .from('auto_responses')
        .update({ is_active: !rule.isActive })
        .eq('id', rule.id);

      if (error) throw error;

      setRules(rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
    } catch (error) {
      console.error('Error toggling rule:', error);
      setToast({ isVisible: true, message: '更新に失敗しました', type: 'error' });
    }
  };

  // --- AI Response Handlers ---

  const handleSaveAiSettings = async () => {
    try {
      setSavingAi(true);
      const { error } = await supabase
        .from('ai_settings')
        .update({
          is_enabled: aiSettings.is_enabled,
          tone: aiSettings.tone,
          persona_prompt: aiSettings.persona_prompt,
          fixed_replies: aiSettings.fixed_replies,
          updated_at: new Date().toISOString()
        })
        .eq('id', aiSettings.id);

      if (error) throw error;
      setToast({ isVisible: true, message: 'AI設定を保存しました', type: 'success' });
    } catch (error) {
      console.error('Error saving AI settings:', error);
      setToast({ isVisible: true, message: '保存に失敗しました', type: 'error' });
    } finally {
      setSavingAi(false);
    }
  };

  // --- Knowledge Base Handlers ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isAddingUrl, setIsAddingUrl] = useState(false);
  const [refreshingUrlId, setRefreshingUrlId] = useState<string | null>(null);

  const handleAddUrl = async () => {
    if (!urlInput || !storeId) return;
    
    try {
      setIsAddingUrl(true);
      
      const { data, error } = await supabase.functions.invoke('fetch-url-content', {
        body: { url: urlInput }
      });

      if (error) throw error;

      let extractedText = '';
      let title = data.title || urlInput;

      if (data.type === 'pdf') {
        // Convert base64 to ArrayBuffer
        const binaryString = atob(data.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        extractedText = await extractTextFromPdfBuffer(bytes.buffer);
      } else {
        extractedText = data.content;
      }

      if (!extractedText) {
        throw new Error('No text could be extracted from this URL');
      }

      // Insert into DB
      const { error: dbError } = await supabase
        .from('knowledge_base')
        .insert({
          store_id: storeId,
          file_name: `[URL] ${title}`,
          file_path: urlInput, // Store URL as path
          file_type: data.type === 'pdf' ? 'application/pdf' : 'text/html',
          file_size: extractedText.length,
          extracted_text: extractedText,
          is_active: true
        });

      if (dbError) throw dbError;

      setToast({ isVisible: true, message: 'URLから情報を追加しました', type: 'success' });
      setUrlInput('');
      fetchData();

    } catch (error: any) {
      console.error('Error adding URL:', error);
      setToast({ isVisible: true, message: 'URLからの追加に失敗しました: ' + (error.message || 'Unknown error'), type: 'error' });
    } finally {
      setIsAddingUrl(false);
    }
  };

  const handleRefreshUrl = async (doc: KnowledgeDoc) => {
    if (!doc.file_path.startsWith('http')) return;
    
    try {
      setRefreshingUrlId(doc.id);
      
      const { data, error } = await supabase.functions.invoke('fetch-url-content', {
        body: { url: doc.file_path }
      });

      if (error) throw error;

      let extractedText = '';
      let title = data.title || doc.file_path;

      if (data.type === 'pdf') {
        const binaryString = atob(data.data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        extractedText = await extractTextFromPdfBuffer(bytes.buffer);
      } else {
        extractedText = data.content;
      }

      if (!extractedText) {
        throw new Error('No text could be extracted from this URL');
      }

      // Update DB
      const { error: dbError } = await supabase
        .from('knowledge_base')
        .update({
          file_name: `[URL] ${title}`,
          file_size: extractedText.length,
          extracted_text: extractedText,
          updated_at: new Date().toISOString()
        })
        .eq('id', doc.id);

      if (dbError) throw dbError;

      setToast({ isVisible: true, message: 'URLの内容を更新しました', type: 'success' });
      fetchData();

    } catch (error) {
      console.error('Error refreshing URL:', error);
      setToast({ isVisible: true, message: '更新に失敗しました', type: 'error' });
    } finally {
      setRefreshingUrlId(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !storeId) return;

    // Validate file type and size
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      setToast({ isVisible: true, message: '対応していないファイル形式です', type: 'error' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast({ isVisible: true, message: 'ファイルサイズは10MB以下にしてください', type: 'error' });
      return;
    }

    try {
      setUploading(true);
      
      // Extract text from file
      let extractedText = '';
      try {
        extractedText = await extractTextFromFile(file);
      } catch (extractError) {
        console.error('Error extracting text:', extractError);
        setToast({ isVisible: true, message: 'テキスト抽出に失敗しましたが、ファイルはアップロードします', type: 'error' });
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${storeId}/${Date.now()}.${fileExt}`;

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('knowledge_docs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Insert into DB
      const { error: dbError } = await supabase
        .from('knowledge_base')
        .insert({
          store_id: storeId,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          extracted_text: extractedText,
          is_active: true
        });

      if (dbError) throw dbError;

      setToast({ isVisible: true, message: 'ファイルをアップロードしました', type: 'success' });
      fetchData();
    } catch (error) {
      console.error('Error uploading file:', error);
      setToast({ isVisible: true, message: 'アップロードに失敗しました', type: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDoc = (docId: string) => {
    setDeleteDocModal({ isOpen: true, docId });
  };

  const confirmDeleteDoc = async () => {
    if (!deleteDocModal.docId) return;

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', deleteDocModal.docId);

      if (error) throw error;

      setToast({ isVisible: true, message: '資料を削除しました', type: 'success' });
      fetchData();
    } catch (error) {
      console.error('Error deleting doc:', error);
      setToast({ isVisible: true, message: '削除に失敗しました', type: 'error' });
    } finally {
      setDeleteDocModal({ isOpen: false, docId: null });
    }
  };

  const handleSendTestChat = async () => {
    if (!testChatMessage.trim()) return;
    
    const userMsg = testChatMessage;
    setTestChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setTestChatMessage('');
    setIsTestChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat-preview', {
        body: {
          message: userMsg,
          store_id: storeId,
          ai_settings: aiSettings
        }
      });

      if (error) throw error;

      setTestChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error('Error sending test chat:', error);
      setToast({ isVisible: true, message: 'AI応答の取得に失敗しました', type: 'error' });
      setTestChatMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' }]);
    } finally {
      setIsTestChatLoading(false);
    }
  };

  const handleRefreshChat = () => {
    setTestChatMessages([]);
    setTestChatMessage('');
  };

  const filteredRules = rules.filter(rule => 
    rule.mainKeyword.includes(keywordSearch) || 
    rule.subKeywords.some(k => k.includes(keywordSearch)) ||
    rule.response.includes(keywordSearch)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            自動応答設定
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            LINE公式アカウントの自動応答ルールとAIアシスタントの設定を行います。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px]">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-gray-200 px-2 md:px-6 pt-2 md:pt-4">
          <button
            onClick={() => setActiveTab('keyword')}
            className={`flex-1 md:flex-none justify-center md:justify-start px-2 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'keyword'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            title="キーワード応答"
          >
            <MessageSquare size={20} />
            <span className="hidden md:inline">キーワード応答</span>
          </button>
          <button
            onClick={() => setActiveTab('ai_settings')}
            className={`flex-1 md:flex-none justify-center md:justify-start px-2 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'ai_settings'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            title="AI基本設定"
          >
            <Settings size={20} />
            <span className="hidden md:inline">AI基本設定</span>
            {!isPro && <ProBadge className="hidden md:inline-flex" />}
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex-1 md:flex-none justify-center md:justify-start px-2 md:px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'knowledge'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            title="AI学習データ"
          >
            <BookOpen size={20} />
            <span className="hidden md:inline">AI学習データ</span>
            {!isPro && <ProBadge className="hidden md:inline-flex" />}
          </button>
        </div>

        {/* Content Area */}
        <div>
          
          {/* --- Keyword Response Content --- */}
          {activeTab === 'keyword' && (
            <div className="flex flex-col h-full">
              {/* Toolbar */}
              <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 flex-1 w-full">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="キーワードを検索..."
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <span>登録数:</span>
                    <span className={`font-bold ${!isPro && rules.length >= 10 ? 'text-red-500' : 'text-gray-900'}`}>
                      {rules.length}
                    </span>
                    {!isPro ? (
                      <span className="text-gray-400">/ 10 (Free)</span>
                    ) : (
                      <span className="text-primary-600 font-medium flex items-center gap-1">
                        <Crown size={14} />
                        Pro: 無制限
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCreateRule}
                  disabled={!isPro && rules.length >= 10}
                  className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-sm text-sm font-medium ${
                    !isPro && rules.length >= 10
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  <Plus size={18} />
                  新規ルール作成
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filteredRules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                    <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                    <p>ルールが見つかりません</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="group p-3 md:p-4 hover:bg-gray-50 transition-colors flex items-start gap-3 md:gap-4"
                      >
                        <div className="pt-1 flex flex-col items-center gap-1 min-w-[50px] md:min-w-[60px]">
                           <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={rule.isActive}
                              onChange={() => handleToggleRule(rule)}
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
                          </label>
                          <span className={`text-[10px] font-medium ${rule.isActive ? 'text-primary-600' : 'text-gray-400'}`}>
                            {rule.isActive ? '有効' : '無効'}
                          </span>
                        </div>
                        <div className="flex-1 space-y-1 md:space-y-2 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 md:gap-3">
                            <h3 className="font-bold text-gray-900 text-sm md:text-base truncate">{rule.mainKeyword}</h3>
                            {rule.subKeywords.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                <Tag size={12} />
                                <span className="truncate max-w-[150px]">{rule.subKeywords.join(', ')}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-xs md:text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap break-words">
                            {rule.response}
                          </p>
                        </div>
                        
                        <div className="flex flex-col md:flex-row items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEditRule(rule)}
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="編集"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ isOpen: true, ruleId: rule.id })}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="削除"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- AI Settings Content --- */}
          {activeTab === 'ai_settings' && (
            <div className="p-6 relative">
              {!isPro && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6">
                  <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md text-left">
                    <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Crown size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Proプラン限定機能</h3>
                    <p className="text-gray-600 mb-6">
                      AI自動応答機能を使用するにはProプランへのアップグレードが必要です。<br />
                      AIがお客様の質問に自動で回答し、接客を効率化します。
                    </p>
                    <div className="text-center">
                      <button className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30">
                        プランをアップグレード
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${!isPro ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                <div className="space-y-8">
                  {/* Enable Switch */}
                  <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">AI自動応答を有効にする</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        有効にすると、キーワード応答に該当しないメッセージに対してAIが自動で返信します。
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer ml-4">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={aiSettings.is_enabled}
                        onChange={(e) => setAiSettings({ ...aiSettings, is_enabled: e.target.checked })}
                      />
                      <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>

                  {/* Tone Selection */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-3">
                      AIの口調（キャラクター）
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setAiSettings({ ...aiSettings, tone: 'polite' })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          aiSettings.tone === 'polite'
                            ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-bold text-gray-900">丁寧・フォーマル</div>
                        <div className="text-sm text-gray-500 mt-1">
                          「承知いたしました。ご予約ありがとうございます。」
                        </div>
                      </button>
                      <button
                        onClick={() => setAiSettings({ ...aiSettings, tone: 'friendly' })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          aiSettings.tone === 'friendly'
                            ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-bold text-gray-900">フレンドリー・親しみやすく</div>
                        <div className="text-sm text-gray-500 mt-1">
                          「わかったよ！予約ありがとう！待ってるね！」
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Persona Prompt */}
                  <div>
                    <label className="block text-sm font-bold text-gray-900 mb-2">
                      追加の指示・ペルソナ設定
                    </label>
                    <div className="relative">
                      <textarea
                        value={aiSettings.persona_prompt || ''}
                        onChange={(e) => setAiSettings({ ...aiSettings, persona_prompt: e.target.value })}
                        placeholder="例: あなたは創業50年の老舗和菓子屋の店主です。頑固ですがお客様への感謝は忘れません。"
                        className="w-full h-40 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-sm leading-relaxed"
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {aiSettings.persona_prompt?.length || 0}文字
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      AIに特定の役割や振る舞いをさせたい場合に入力してください。
                    </p>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-6 border-t border-gray-100">
                    <button
                      onClick={handleSaveAiSettings}
                      disabled={savingAi}
                      className="flex items-center gap-2 px-8 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors font-bold shadow-sm"
                    >
                      {savingAi ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save size={20} />
                          設定を保存
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Preview Column */}
                <ChatPreview
                  messages={testChatMessages}
                  input={testChatMessage}
                  setInput={setTestChatMessage}
                  loading={isTestChatLoading}
                  onSend={handleSendTestChat}
                  scrollRef={chatScrollRef}
                  onRefresh={handleRefreshChat}
                />
              </div>
            </div>
          )}

          {/* --- Knowledge Base Content --- */}
          {activeTab === 'knowledge' && (
            <div className="p-6 relative">
              {!isPro && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6">
                  <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md text-left">
                    <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Crown size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 text-center">Proプラン限定機能</h3>
                    <p className="text-gray-600 mb-6">
                      AI学習データ機能を使用するにはProプランへのアップグレードが必要です。<br />
                      店舗独自の資料をAIに学習させ、より正確な回答を実現します。
                    </p>
                    <div className="text-center">
                      <button className="px-6 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30">
                        プランをアップグレード
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 ${!isPro ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                <div className="space-y-6">
                  {/* Upload Area */}
                  <div 
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:bg-gray-50 transition-colors cursor-pointer group bg-gray-50/30 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.docx,.txt"
                    />
                    <div className="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-sm">
                      {uploading ? <Loader2 className="animate-spin" size={28} /> : <Upload size={28} />}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{uploading ? 'アップロード中...' : '資料をアップロード'}</h3>
                    <p className="text-gray-500 mt-2 mb-6">
                      PDF, Word, テキストファイルをドラッグ＆ドロップ<br />
                      またはクリックして選択
                    </p>
                    <button className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm shadow-sm transition-all hover:shadow">
                      ファイルを選択
                    </button>
                    <p className="text-xs text-gray-400 mt-6">
                      最大サイズ: 10MB / 対応形式: .pdf, .docx, .txt
                    </p>
                  </div>

                  {/* URL Input Area */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <LinkIcon size={20} className="text-primary-500" />
                      URLから追加
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/menu.pdf"
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      />
                      <button
                        onClick={handleAddUrl}
                        disabled={isAddingUrl || !urlInput}
                        className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                      >
                        {isAddingUrl ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                        追加
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      WebページやPDFのURLを入力して、その内容をAI学習データに追加します。
                    </p>
                  </div>

                  {/* Document List */}
                  <div>
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-lg">
                      <FileText size={20} className="text-primary-500" />
                      登録済み資料 ({documents.length})
                    </h3>
                    
                    {documents.length === 0 ? (
                      <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-100">
                        <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">登録された資料はありません</p>
                        <p className="text-sm text-gray-400 mt-1">店舗のメニューやQ&Aなどをアップロードしてください</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md transition-all group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                <FileText size={24} />
                              </div>
                              <div>
                                <div className="font-bold text-gray-900">{doc.file_name}</div>
                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                                    {doc.file_type.split('/')[1].toUpperCase()}
                                  </span>
                                  <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                                  <span>•</span>
                                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                doc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {doc.is_active ? '学習中' : '無効'}
                              </div>

                              {doc.file_path.startsWith('http') && (
                                <button
                                  onClick={() => handleRefreshUrl(doc)}
                                  disabled={refreshingUrlId === doc.id}
                                  className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                  title="URLの内容を更新"
                                >
                                  {refreshingUrlId === doc.id ? (
                                    <Loader2 size={20} className="animate-spin" />
                                  ) : (
                                    <RefreshCw size={20} />
                                  )}
                                </button>
                              )}

                              <button 
                                onClick={() => handleDeleteDoc(doc.id)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview Column */}
                <ChatPreview
                  messages={testChatMessages}
                  input={testChatMessage}
                  setInput={setTestChatMessage}
                  loading={isTestChatLoading}
                  onSend={handleSendTestChat}
                  scrollRef={chatScrollRef}
                  onRefresh={handleRefreshChat}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Rule Modal */}
      <Modal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title={currentRule?.id ? '自動応答ルールを編集' : '新規ルール作成'}
        footerContent={
          <div className="flex justify-end gap-3 w-full">
            <button
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              閉じる
            </button>
            <button
              onClick={handleSaveRule}
              disabled={savingRule || !currentRule?.mainKeyword || !currentRule?.response}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors font-bold shadow-sm flex items-center gap-2"
            >
              {savingRule ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={18} />
                  保存する
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              メインキーワード <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={currentRule?.mainKeyword || ''}
              onChange={(e) => setCurrentRule(prev => prev ? { ...prev, mainKeyword: e.target.value } : null)}
              placeholder="例: 営業時間"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              このキーワードがメッセージに含まれる場合に反応します
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              サブキーワード（関連語・表記ゆれ）
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newSubKeyword}
                onChange={(e) => setNewSubKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addSubKeyword()}
                placeholder="例: 開店時間"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={addSubKeyword}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                追加
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              メインキーワードの言い換えや関連語を登録してください。これらが含まれていると、この回答が選ばれやすくなります。
            </p>
            <div className="flex flex-wrap gap-2">
              {currentRule?.subKeywords.map((keyword, index) => (
                <span key={index} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-sm">
                  {keyword}
                  <button
                    onClick={() => removeSubKeyword(keyword)}
                    className="ml-1 text-gray-400 hover:text-gray-600"
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              返信メッセージ <span className="text-red-500">*</span>
            </label>
            <textarea
              value={currentRule?.response || ''}
              onChange={(e) => setCurrentRule(prev => prev ? { ...prev, response: e.target.value } : null)}
              placeholder="返信する内容を入力してください"
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-sm font-bold text-gray-700">このルールを有効にする</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={currentRule?.isActive ?? true}
                onChange={(e) => setCurrentRule(prev => prev ? { ...prev, isActive: e.target.checked } : null)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, ruleId: null })}
        title="ルールを削除"
        footerContent={
          <div className="flex justify-end gap-3 w-full">
            <button
              onClick={() => setDeleteModal({ isOpen: false, ruleId: null })}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              閉じる
            </button>
            <button
              onClick={handleDeleteRule}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
            >
              削除する
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            この自動応答ルールを削除してもよろしいですか？<br />
            この操作は取り消せません。
          </p>
        </div>
      </Modal>

      {/* Delete Document Confirmation Modal */}
      <Modal
        isOpen={deleteDocModal.isOpen}
        onClose={() => setDeleteDocModal({ isOpen: false, docId: null })}
        title="資料を削除"
        footerContent={
          <div className="flex justify-end gap-3 w-full">
            <button
              onClick={() => setDeleteDocModal({ isOpen: false, docId: null })}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            >
              閉じる
            </button>
            <button
              onClick={confirmDeleteDoc}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-sm"
            >
              削除する
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            この資料を削除してもよろしいですか？<br />
            この操作は取り消せません。
          </p>
        </div>
      </Modal>

      {toast.isVisible && (
        <Toast
          isVisible={toast.isVisible}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, isVisible: false })}
        />
      )}
    </div>
  );
}
