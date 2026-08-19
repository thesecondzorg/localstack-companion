import React, { useState, useEffect } from 'react';
import { fetchConfigYaml, updateConfigYaml } from '../services/api';
import { FileCode, Save, Check, Copy } from 'lucide-react';

export const YamlViewer: React.FC = () => {
  const [yamlContent, setYamlContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchConfigYaml().then((res) => {
      if (res && res.yaml) {
        setYamlContent(res.yaml);
      }
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateConfigYaml(yamlContent);
      setSaveStatus('Saved & Synced with LocalStack!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (e) {
      setSaveStatus('Failed to save YAML');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(yamlContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <FileCode className="w-5 h-5 text-amber-500" />
          <div>
            <h3 className="text-base font-bold text-slate-800">Declarative Configuration (`resources.yaml`)</h3>
            <p className="text-xs text-slate-400">
              Edits made here or approved via UI are synced automatically with LocalStack.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {saveStatus && (
            <span className="text-xs text-emerald-600 font-semibold animate-pulse">{saveStatus}</span>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 rounded-lg text-xs font-medium border border-slate-200 transition"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save & Sync'}</span>
          </button>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm">
        <textarea
          value={yamlContent}
          onChange={(e) => setYamlContent(e.target.value)}
          rows={22}
          spellCheck={false}
          className="w-full bg-slate-50 text-slate-700 font-mono text-xs p-6 outline-none resize-none leading-relaxed selection:bg-amber-400/20"
        />
      </div>
    </div>
  );
};
