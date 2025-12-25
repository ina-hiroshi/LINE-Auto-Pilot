import { Code } from 'lucide-react';

export default function DevSandbox() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Code className="text-primary-600" />
          開発用サンドボックス
        </h1>
        <p className="text-gray-500 mt-1">
          現在、開発中の機能はありません。
        </p>
      </div>
    </div>
  );
}
