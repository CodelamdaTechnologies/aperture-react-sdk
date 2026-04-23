import React, { useRef, useEffect } from 'react';

interface CardElementProps {
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

export const CardElement = React.forwardRef<HTMLDivElement, CardElementProps>(
  ({ className, style, id = 'aperture-card-element' }, ref) => {
    const innerRef = useRef<HTMLDivElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLDivElement>) || innerRef;

    return (
      <div
        ref={resolvedRef}
        id={id}
        className={className}
        style={{
          padding: '12px 14px',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          minHeight: '44px',
          ...style,
        }}
      />
    );
  },
);

CardElement.displayName = 'CardElement';
