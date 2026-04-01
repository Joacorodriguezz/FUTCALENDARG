interface ModeTabsProps {
  mode: 'liga' | 'mundial';
  onModeChange: (mode: 'liga' | 'mundial') => void;
}

export default function ModeTabs({ mode, onModeChange }: ModeTabsProps) {
  return (
    <div className="flex justify-center gap-4 mb-8">
      <button
        onClick={() => onModeChange('liga')}
        className={`
          px-8 py-3 font-bold text-sm tracking-wide transition-all
          border-2
          ${
            mode === 'liga'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-transparent text-blue-600 border-blue-600 hover:bg-blue-50'
          }
        `}
      >
        LIGA PROFESIONAL
      </button>
      <button
        onClick={() => onModeChange('mundial')}
        className={`
          px-8 py-3 font-bold text-sm tracking-wide transition-all
          border-2
          ${
            mode === 'mundial'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-transparent text-green-600 border-green-600 hover:bg-green-50'
          }
        `}
      >
        MUNDIAL 2026
      </button>
    </div>
  );
}
