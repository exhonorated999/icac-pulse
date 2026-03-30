import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CyberTipIcon, P2PIcon, ChatIcon, OtherCaseIcon } from '../components/DashboardIcons';
import { useLicense } from '../lib/LicenseContext';

type CaseType = 'cybertip' | 'p2p' | 'chat' | 'other';

interface CaseTypeCard {
  type: CaseType;
  label: string;
  icon: 'cybertip' | 'p2p' | 'chat' | 'other';
  description: string;
  color: string;
}

const caseTypes: CaseTypeCard[] = [
  {
    type: 'cybertip',
    label: 'CyberTip',
    icon: 'cybertip',
    description: 'NCMEC CyberTipline report investigations',
    color: 'cyan'
  },
  {
    type: 'p2p',
    label: 'P2P',
    icon: 'p2p',
    description: 'Peer-to-peer file sharing investigations',
    color: 'purple'
  },
  {
    type: 'chat',
    label: 'Chat',
    icon: 'chat',
    description: 'Undercover chat operations',
    color: 'green'
  },
  {
    type: 'other',
    label: 'Other',
    icon: 'other',
    description: 'Other investigation types',
    color: 'yellow'
  }
];

export function CreateCase() {
  const [selectedType, setSelectedType] = useState<CaseType | null>(null);
  const navigate = useNavigate();
  const { canCreate } = useLicense();

  // Redirect to settings if demo expired
  useEffect(() => {
    if (!canCreate) navigate('/settings', { replace: true });
  }, [canCreate, navigate]);

  const handleTypeSelect = (type: CaseType) => {
    setSelectedType(type);
    // Navigate to the specific case form
    navigate(`/cases/new/${type}`);
  };

  const getHoverClasses = (color: string) => {
    const colorMap: Record<string, string> = {
      cyan: 'hover:border-[#00D4FF] hover:bg-[#00D4FF]/5 focus:ring-[#00D4FF]/50',
      purple: 'hover:border-[#7B68EE] hover:bg-[#7B68EE]/5 focus:ring-[#7B68EE]/50',
      green: 'hover:border-[#39FFA0] hover:bg-[#39FFA0]/5 focus:ring-[#39FFA0]/50',
      yellow: 'hover:border-[#FFB800] hover:bg-[#FFB800]/5 focus:ring-[#FFB800]/50'
    };
    return colorMap[color] || colorMap.cyan;
  };

  const getTitleHoverClass = (color: string) => {
    const colorMap: Record<string, string> = {
      cyan: 'group-hover:text-[#00D4FF]',
      purple: 'group-hover:text-[#7B68EE]',
      green: 'group-hover:text-[#39FFA0]',
      yellow: 'group-hover:text-[#FFB800]'
    };
    return colorMap[color] || colorMap.cyan;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Create New Case
          </h1>
          <p className="text-text-muted">
            Select the type of investigation to begin
          </p>
        </div>

        {/* Case Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {caseTypes.map((caseType) => (
            <button
              key={caseType.type}
              onClick={() => handleTypeSelect(caseType.type)}
              className={`group relative bg-panel border border-accent-cyan/20 rounded-lg p-8 text-left 
                         transition-all duration-200 focus:outline-none focus:ring-2
                         ${getHoverClasses(caseType.color)}`}
            >
              {/* Icon */}
              <div className="w-20 h-20 mb-4 group-hover:scale-110 transition-transform">
                {caseType.icon === 'cybertip' && <CyberTipIcon className="w-full h-full" />}
                {caseType.icon === 'p2p' && <P2PIcon className="w-full h-full" />}
                {caseType.icon === 'chat' && <ChatIcon className="w-full h-full" />}
                {caseType.icon === 'other' && <OtherCaseIcon className="w-full h-full" />}
              </div>

              {/* Label */}
              <h3 className={`text-2xl font-bold text-text-primary mb-2 transition-colors ${getTitleHoverClass(caseType.color)}`}>
                {caseType.label}
              </h3>

              {/* Description */}
              <p className="text-text-muted group-hover:text-text-primary transition-colors">
                {caseType.description}
              </p>

              {/* Arrow indicator */}
              <div className="absolute top-8 right-8 text-accent-cyan opacity-0 group-hover:opacity-100 
                             transform translate-x-2 group-hover:translate-x-0 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Back button */}
        <div className="mt-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-text-muted hover:text-text-primary transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
