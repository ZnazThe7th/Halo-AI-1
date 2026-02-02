import React from 'react';

interface HaloLogoProps {
  className?: string;
  size?: number;
}

const HaloLogo: React.FC<HaloLogoProps> = ({ className = '', size = 40 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer ring/glow */}
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="white"
        strokeWidth="3"
        fill="none"
        opacity="0.3"
      />
      {/* Main halo ring */}
      <circle
        cx="50"
        cy="50"
        r="35"
        stroke="white"
        strokeWidth="4"
        fill="none"
      />
      {/* Inner glow/center */}
      <circle
        cx="50"
        cy="50"
        r="20"
        stroke="white"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
      {/* Top accent */}
      <circle
        cx="50"
        cy="15"
        r="8"
        fill="white"
        opacity="0.8"
      />
    </svg>
  );
};

export default HaloLogo;
