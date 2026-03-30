// Custom SVG icons for Dashboard with neon cyberpunk theme

export const WaitingEspIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Glow effect */}
    <defs>
      <filter id="glow-yellow">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Document */}
    <path 
      d="M25 15 L60 15 L75 30 L75 85 L25 85 Z" 
      stroke="#FFB800" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-yellow)"
    />
    <path 
      d="M60 15 L60 30 L75 30" 
      stroke="#FFB800" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-yellow)"
    />
    
    {/* Document lines */}
    <line x1="35" y1="40" x2="55" y2="40" stroke="#FFB800" strokeWidth="2" opacity="0.8" filter="url(#glow-yellow)"/>
    <line x1="35" y1="50" x2="65" y2="50" stroke="#FFB800" strokeWidth="2" opacity="0.8" filter="url(#glow-yellow)"/>
    <line x1="35" y1="60" x2="60" y2="60" stroke="#FFB800" strokeWidth="2" opacity="0.8" filter="url(#glow-yellow)"/>
    <line x1="35" y1="70" x2="65" y2="70" stroke="#FFB800" strokeWidth="2" opacity="0.8" filter="url(#glow-yellow)"/>
    
    {/* Clock */}
    <circle 
      cx="65" 
      cy="65" 
      r="18" 
      stroke="#FFB800" 
      strokeWidth="3" 
      fill="#0B1120"
      filter="url(#glow-yellow)"
    />
    <line x1="65" y1="65" x2="65" y2="55" stroke="#FFB800" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow-yellow)"/>
    <line x1="65" y1="65" x2="72" y2="65" stroke="#FFB800" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow-yellow)"/>
    <circle cx="65" cy="65" r="2" fill="#FFB800" filter="url(#glow-yellow)"/>
  </svg>
);

export const ArrestIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Glow effect */}
    <defs>
      <filter id="glow-pink">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Left cuff */}
    <circle 
      cx="35" 
      cy="50" 
      r="15" 
      stroke="#FF2A6D" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-pink)"
    />
    <circle 
      cx="35" 
      cy="50" 
      r="10" 
      stroke="#FF2A6D" 
      strokeWidth="2" 
      fill="none"
      opacity="0.6"
      filter="url(#glow-pink)"
    />
    
    {/* Right cuff */}
    <circle 
      cx="65" 
      cy="50" 
      r="15" 
      stroke="#FF2A6D" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-pink)"
    />
    <circle 
      cx="65" 
      cy="50" 
      r="10" 
      stroke="#FF2A6D" 
      strokeWidth="2" 
      fill="none"
      opacity="0.6"
      filter="url(#glow-pink)"
    />
    
    {/* Chain links */}
    <path 
      d="M 45 45 Q 50 40 55 45" 
      stroke="#FF2A6D" 
      strokeWidth="2.5" 
      fill="none"
      filter="url(#glow-pink)"
    />
    <path 
      d="M 45 50 L 55 50" 
      stroke="#FF2A6D" 
      strokeWidth="2.5" 
      fill="none"
      filter="url(#glow-pink)"
    />
    <path 
      d="M 45 55 Q 50 60 55 55" 
      stroke="#FF2A6D" 
      strokeWidth="2.5" 
      fill="none"
      filter="url(#glow-pink)"
    />
    
    {/* Cuff details */}
    <circle cx="35" cy="40" r="2" fill="#FF2A6D" filter="url(#glow-pink)"/>
    <circle cx="35" cy="60" r="2" fill="#FF2A6D" filter="url(#glow-pink)"/>
    <circle cx="65" cy="40" r="2" fill="#FF2A6D" filter="url(#glow-pink)"/>
    <circle cx="65" cy="60" r="2" fill="#FF2A6D" filter="url(#glow-pink)"/>
  </svg>
);

export const ActiveCasesIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-green">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Folder */}
    <path 
      d="M15 30 L15 75 L85 75 L85 30 Z" 
      stroke="#39FFA0" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-green)"
    />
    <path 
      d="M15 30 L15 25 L40 25 L45 30 L85 30" 
      stroke="#39FFA0" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-green)"
    />
    
    {/* Pulse/activity indicator */}
    <circle cx="50" cy="52" r="12" stroke="#39FFA0" strokeWidth="2.5" fill="none" filter="url(#glow-green)"/>
    <circle cx="50" cy="52" r="8" fill="#39FFA0" opacity="0.3" filter="url(#glow-green)"/>
    <path 
      d="M 35 52 L 40 52 L 43 45 L 47 59 L 50 52 L 65 52" 
      stroke="#39FFA0" 
      strokeWidth="2.5" 
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      filter="url(#glow-green)"
    />
  </svg>
);

export const ReadyResidentialIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-cyan">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* House */}
    <path 
      d="M20 50 L50 25 L80 50 L80 80 L20 80 Z" 
      stroke="#00D4FF" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-cyan)"
    />
    {/* Roof line */}
    <path 
      d="M20 50 L50 25 L80 50" 
      stroke="#00D4FF" 
      strokeWidth="3" 
      strokeLinecap="round"
      filter="url(#glow-cyan)"
    />
    {/* Door */}
    <rect x="42" y="60" width="16" height="20" stroke="#00D4FF" strokeWidth="2.5" fill="none" filter="url(#glow-cyan)"/>
    {/* Window */}
    <rect x="60" y="55" width="12" height="12" stroke="#00D4FF" strokeWidth="2" fill="none" filter="url(#glow-cyan)"/>
    {/* Crosshair/target */}
    <circle cx="50" cy="45" r="8" stroke="#00D4FF" strokeWidth="2" fill="none" filter="url(#glow-cyan)"/>
    <line x1="50" y1="37" x2="50" y2="40" stroke="#00D4FF" strokeWidth="2" filter="url(#glow-cyan)"/>
    <line x1="50" y1="50" x2="50" y2="53" stroke="#00D4FF" strokeWidth="2" filter="url(#glow-cyan)"/>
    <line x1="42" y1="45" x2="45" y2="45" stroke="#00D4FF" strokeWidth="2" filter="url(#glow-cyan)"/>
    <line x1="55" y1="45" x2="58" y2="45" stroke="#00D4FF" strokeWidth="2" filter="url(#glow-cyan)"/>
    <circle cx="50" cy="45" r="2" fill="#00D4FF" filter="url(#glow-cyan)"/>
  </svg>
);

export const ClearanceRateIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-cyan-2">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Shield/Badge outline */}
    <path 
      d="M50 15 L75 25 L75 50 Q75 70 50 85 Q25 70 25 50 L25 25 Z" 
      stroke="#00D4FF" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-cyan-2)"
    />
    
    {/* Checkmark */}
    <path 
      d="M35 50 L45 60 L65 35" 
      stroke="#00D4FF" 
      strokeWidth="4" 
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      filter="url(#glow-cyan-2)"
    />
    
    {/* Inner glow circle */}
    <circle cx="50" cy="50" r="20" stroke="#00D4FF" strokeWidth="1.5" fill="none" opacity="0.3" filter="url(#glow-cyan-2)"/>
  </svg>
);

export const AllCasesIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-all-cases">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Back document */}
    <rect x="35" y="25" width="40" height="50" rx="2" stroke="#00D4FF" strokeWidth="2" fill="none" opacity="0.4" filter="url(#glow-all-cases)"/>
    
    {/* Middle document */}
    <rect x="30" y="30" width="40" height="50" rx="2" stroke="#00D4FF" strokeWidth="2" fill="none" opacity="0.6" filter="url(#glow-all-cases)"/>
    
    {/* Front document */}
    <rect x="25" y="35" width="40" height="50" rx="2" stroke="#00D4FF" strokeWidth="2.5" fill="none" filter="url(#glow-all-cases)"/>
    
    {/* Lines on front document */}
    <line x1="32" y1="45" x2="58" y2="45" stroke="#00D4FF" strokeWidth="1.5" filter="url(#glow-all-cases)"/>
    <line x1="32" y1="52" x2="55" y2="52" stroke="#00D4FF" strokeWidth="1.5" filter="url(#glow-all-cases)"/>
    <line x1="32" y1="59" x2="58" y2="59" stroke="#00D4FF" strokeWidth="1.5" filter="url(#glow-all-cases)"/>
    <line x1="32" y1="66" x2="52" y2="66" stroke="#00D4FF" strokeWidth="1.5" filter="url(#glow-all-cases)"/>
  </svg>
);

export const SettingsIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-settings">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Outer gear teeth */}
    <path 
      d="M50 15 L55 25 L65 20 L65 30 L75 30 L70 40 L80 45 L70 50 L75 60 L65 60 L65 70 L55 65 L50 75 L45 65 L35 70 L35 60 L25 60 L30 50 L20 45 L30 40 L25 30 L35 30 L35 20 L45 25 Z" 
      stroke="#00D4FF" 
      strokeWidth="2.5" 
      fill="none"
      filter="url(#glow-settings)"
    />
    
    {/* Inner circle */}
    <circle cx="50" cy="45" r="12" stroke="#00D4FF" strokeWidth="2.5" fill="none" filter="url(#glow-settings)"/>
    
    {/* Center hex bolt */}
    <path 
      d="M50 38 L54 40.5 L54 43.5 L50 46 L46 43.5 L46 40.5 Z" 
      stroke="#00D4FF" 
      strokeWidth="2" 
      fill="none"
      filter="url(#glow-settings)"
    />
    
    {/* Spinning indicator lines */}
    <line x1="50" y1="33" x2="50" y2="28" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" filter="url(#glow-settings)"/>
    <line x1="62" y1="45" x2="67" y2="45" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" filter="url(#glow-settings)"/>
    <line x1="38" y1="45" x2="33" y2="45" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" filter="url(#glow-settings)"/>
  </svg>
);

// Case Type Icons for Create Case Page

export const CyberTipIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-cybertip">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Shield/Badge outline */}
    <path 
      d="M50 10 L75 22 L75 45 Q75 65 50 85 Q25 65 25 45 L25 22 Z" 
      stroke="#00D4FF" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-cybertip)"
    />
    
    {/* Alert/Warning triangle inside */}
    <path 
      d="M50 35 L60 55 L40 55 Z" 
      stroke="#00D4FF" 
      strokeWidth="2.5" 
      fill="none"
      filter="url(#glow-cybertip)"
    />
    
    {/* Exclamation mark */}
    <line x1="50" y1="42" x2="50" y2="48" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow-cybertip)"/>
    <circle cx="50" cy="52" r="1.5" fill="#00D4FF" filter="url(#glow-cybertip)"/>
    
    {/* Data streams */}
    <line x1="35" y1="30" x2="38" y2="35" stroke="#00D4FF" strokeWidth="1.5" opacity="0.6" filter="url(#glow-cybertip)"/>
    <line x1="65" y1="30" x2="62" y2="35" stroke="#00D4FF" strokeWidth="1.5" opacity="0.6" filter="url(#glow-cybertip)"/>
    <circle cx="35" cy="28" r="2" fill="#00D4FF" opacity="0.6" filter="url(#glow-cybertip)"/>
    <circle cx="65" cy="28" r="2" fill="#00D4FF" opacity="0.6" filter="url(#glow-cybertip)"/>
  </svg>
);

export const P2PIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-p2p">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Network nodes */}
    <circle cx="30" cy="30" r="8" stroke="#7B68EE" strokeWidth="2.5" fill="none" filter="url(#glow-p2p)"/>
    <circle cx="70" cy="30" r="8" stroke="#7B68EE" strokeWidth="2.5" fill="none" filter="url(#glow-p2p)"/>
    <circle cx="50" cy="70" r="8" stroke="#7B68EE" strokeWidth="2.5" fill="none" filter="url(#glow-p2p)"/>
    <circle cx="20" cy="70" r="6" stroke="#7B68EE" strokeWidth="2" fill="none" filter="url(#glow-p2p)"/>
    <circle cx="80" cy="70" r="6" stroke="#7B68EE" strokeWidth="2" fill="none" filter="url(#glow-p2p)"/>
    
    {/* Inner dots */}
    <circle cx="30" cy="30" r="3" fill="#7B68EE" filter="url(#glow-p2p)"/>
    <circle cx="70" cy="30" r="3" fill="#7B68EE" filter="url(#glow-p2p)"/>
    <circle cx="50" cy="70" r="3" fill="#7B68EE" filter="url(#glow-p2p)"/>
    
    {/* Connection lines */}
    <line x1="35" y1="33" x2="47" y2="67" stroke="#7B68EE" strokeWidth="2" opacity="0.6" filter="url(#glow-p2p)"/>
    <line x1="65" y1="33" x2="53" y2="67" stroke="#7B68EE" strokeWidth="2" opacity="0.6" filter="url(#glow-p2p)"/>
    <line x1="38" y1="30" x2="62" y2="30" stroke="#7B68EE" strokeWidth="2" opacity="0.6" filter="url(#glow-p2p)"/>
    <line x1="25" y1="67" x2="45" y2="73" stroke="#7B68EE" strokeWidth="1.5" opacity="0.4" filter="url(#glow-p2p)"/>
    <line x1="75" y1="67" x2="55" y2="73" stroke="#7B68EE" strokeWidth="1.5" opacity="0.4" filter="url(#glow-p2p)"/>
    
    {/* Data packets */}
    <circle cx="42" cy="50" r="2" fill="#7B68EE" opacity="0.8" filter="url(#glow-p2p)"/>
    <circle cx="58" cy="50" r="2" fill="#7B68EE" opacity="0.8" filter="url(#glow-p2p)"/>
  </svg>
);

export const ChatIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-chat">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Main chat bubble */}
    <path 
      d="M20 25 L75 25 Q80 25 80 30 L80 55 Q80 60 75 60 L45 60 L30 75 L30 60 L20 60 Q15 60 15 55 L15 30 Q15 25 20 25 Z" 
      stroke="#39FFA0" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-chat)"
    />
    
    {/* Chat lines */}
    <line x1="25" y1="35" x2="55" y2="35" stroke="#39FFA0" strokeWidth="2" strokeLinecap="round" filter="url(#glow-chat)"/>
    <line x1="25" y1="43" x2="65" y2="43" stroke="#39FFA0" strokeWidth="2" strokeLinecap="round" filter="url(#glow-chat)"/>
    <line x1="25" y1="51" x2="50" y2="51" stroke="#39FFA0" strokeWidth="2" strokeLinecap="round" filter="url(#glow-chat)"/>
    
    {/* Secondary bubble */}
    <path 
      d="M60 40 L85 40 Q90 40 90 45 L90 65 Q90 70 85 70 L70 70 L70 80 L60 70 L50 70 Q45 70 45 65 L45 45 Q45 40 50 40 Z" 
      stroke="#39FFA0" 
      strokeWidth="2.5" 
      fill="none"
      opacity="0.6"
      filter="url(#glow-chat)"
    />
    
    {/* Typing indicator dots */}
    <circle cx="58" cy="55" r="2" fill="#39FFA0" opacity="0.8" filter="url(#glow-chat)"/>
    <circle cx="65" cy="55" r="2" fill="#39FFA0" opacity="0.8" filter="url(#glow-chat)"/>
    <circle cx="72" cy="55" r="2" fill="#39FFA0" opacity="0.8" filter="url(#glow-chat)"/>
  </svg>
);

export const OtherCaseIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-other">
        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Folder outline */}
    <path 
      d="M15 30 L15 75 L85 75 L85 30 Z" 
      stroke="#FFB800" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-other)"
    />
    <path 
      d="M15 30 L15 25 L40 25 L45 30 L85 30" 
      stroke="#FFB800" 
      strokeWidth="3" 
      fill="none"
      filter="url(#glow-other)"
    />
    
    {/* Question mark */}
    <path 
      d="M45 45 Q45 40 50 40 Q55 40 55 45 Q55 50 50 52" 
      stroke="#FFB800" 
      strokeWidth="3" 
      strokeLinecap="round"
      fill="none"
      filter="url(#glow-other)"
    />
    <circle cx="50" cy="60" r="2.5" fill="#FFB800" filter="url(#glow-other)"/>
    
    {/* Data nodes around */}
    <circle cx="35" cy="50" r="3" stroke="#FFB800" strokeWidth="1.5" fill="none" opacity="0.5" filter="url(#glow-other)"/>
    <circle cx="65" cy="50" r="3" stroke="#FFB800" strokeWidth="1.5" fill="none" opacity="0.5" filter="url(#glow-other)"/>
    <circle cx="50" cy="65" r="3" stroke="#FFB800" strokeWidth="1.5" fill="none" opacity="0.5" filter="url(#glow-other)"/>
    
    {/* Connecting lines */}
    <line x1="38" y1="50" x2="47" y2="50" stroke="#FFB800" strokeWidth="1.5" opacity="0.3" filter="url(#glow-other)"/>
    <line x1="53" y1="50" x2="62" y2="50" stroke="#FFB800" strokeWidth="1.5" opacity="0.3" filter="url(#glow-other)"/>
  </svg>
);

export const GenerateReportIcon = ({ className = "" }: { className?: string }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <filter id="glow-report">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    
    {/* Document */}
    <path 
      d="M30 15 L60 15 L70 25 L70 85 L30 85 Z" 
      stroke="#00D4FF" 
      strokeWidth="2.5" 
      fill="none"
      filter="url(#glow-report)"
    />
    <path 
      d="M60 15 L60 25 L70 25" 
      stroke="#00D4FF" 
      strokeWidth="2.5" 
      fill="none"
      filter="url(#glow-report)"
    />
    
    {/* Bar chart inside */}
    <rect x="38" y="60" width="6" height="15" stroke="#00D4FF" strokeWidth="2" fill="none" filter="url(#glow-report)"/>
    <rect x="47" y="50" width="6" height="25" stroke="#00D4FF" strokeWidth="2" fill="none" filter="url(#glow-report)"/>
    <rect x="56" y="55" width="6" height="20" stroke="#00D4FF" strokeWidth="2" fill="none" filter="url(#glow-report)"/>
    
    {/* Title lines */}
    <line x1="38" y1="35" x2="62" y2="35" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" filter="url(#glow-report)"/>
    <line x1="38" y1="42" x2="55" y2="42" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" filter="url(#glow-report)"/>
    
    {/* Download arrow */}
    <circle cx="78" cy="72" r="12" stroke="#00D4FF" strokeWidth="2.5" fill="#0B1120" filter="url(#glow-report)"/>
    <path 
      d="M78 65 L78 77" 
      stroke="#00D4FF" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      filter="url(#glow-report)"
    />
    <path 
      d="M73 73 L78 78 L83 73" 
      stroke="#00D4FF" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      filter="url(#glow-report)"
    />
  </svg>
);
