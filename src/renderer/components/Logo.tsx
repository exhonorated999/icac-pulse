interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showFullText?: boolean;
}

export function Logo({ size = 'medium', showFullText = true }: LogoProps) {
  const sizes = {
    small: { height: 80, fontSize: 16, pulseHeight: 40, mainFontSize: 40, letterSpacing: 12 },
    medium: { height: 120, fontSize: 22, pulseHeight: 60, mainFontSize: 60, letterSpacing: 16 },
    large: { height: 160, fontSize: 32, pulseHeight: 80, mainFontSize: 80, letterSpacing: 20 }
  };

  const config = sizes[size];

  return (
    <div className="flex flex-col items-center justify-center">
      <svg 
        width="100%" 
        height={config.height} 
        viewBox="0 0 500 120" 
        xmlns="http://www.w3.org/2000/svg"
        className="logo-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* ICAC text - smaller, above */}
        {showFullText && (
          <text
            x="15"
            y="28"
            fill="#00D4FF"
            fontSize={config.fontSize}
            fontWeight="600"
            letterSpacing="6"
            fontFamily="sans-serif"
          >
            ICAC
          </text>
        )}

        {/* P.U.L.S.E text - large, with dots */}
        <text
          x="15"
          y={showFullText ? "80" : "70"}
          fill="#00D4FF"
          fontSize={config.mainFontSize}
          fontWeight="700"
          letterSpacing={config.letterSpacing}
          fontFamily="sans-serif"
        >
          P.U.L.S.E
        </text>

        {/* Pulse line - orange heartbeat through the middle */}
        <g transform={showFullText ? "translate(0, 28)" : "translate(0, 18)"}>
          {/* Glow effect */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#FFB800', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: '#FF6B00', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#FFB800', stopOpacity: 1 }} />
            </linearGradient>
          </defs>

          {/* Pulse line path - larger and more visible */}
          <path
            d="M 180 45 L 220 45 L 240 20 L 260 70 L 280 45 L 450 45"
            stroke="url(#pulseGradient)"
            strokeWidth="4"
            fill="none"
            filter="url(#glow)"
            className="pulse-line"
          />
          
          {/* Dot at the end - larger */}
          <circle
            cx="450"
            cy="45"
            r="6"
            fill="#FFB800"
            filter="url(#glow)"
            className="pulse-dot"
          >
            <animate
              attributeName="opacity"
              values="1;0.3;1"
              dur="1.5s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>

      <style>{`
        .logo-svg {
          filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
        }
        
        .pulse-line {
          animation: pulse-flow 2s ease-in-out infinite;
        }
        
        @keyframes pulse-flow {
          0%, 100% {
            stroke-dasharray: 0, 300;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 150, 300;
            stroke-dashoffset: -150;
          }
        }
        
        .pulse-dot {
          filter: drop-shadow(0 0 5px #FFB800);
        }
      `}</style>
    </div>
  );
}
