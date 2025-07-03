import React from 'react';

interface CommunityContentContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A reusable container component that matches the CommunityNav alignment structure.
 * This ensures consistent width and alignment across all community pages.
 * 
 * Structure matches CommunityNav:
 * - Full width wrapper with flex centering
 * - Inner container with w-full md:w-2/3 responsive width
 * - Proper horizontal alignment with navigation tabs
 */
const CommunityContentContainer: React.FC<CommunityContentContainerProps> = ({
  children,
  className = '',
  style = {},
}) => {
  return (
    <div className="w-full flex justify-center items-center" style={style}>
      <div className={`w-full md:w-2/3 ${className}`}>
        {children}
      </div>
    </div>
  );
};

export default CommunityContentContainer;
