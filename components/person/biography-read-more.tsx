"use client";

import { useEffect, useRef, useState } from "react";

type BiographyReadMoreProps = {
  biography: string;
};

export function BiographyReadMore({ biography }: BiographyReadMoreProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseFloat(
        getComputedStyle(textRef.current).lineHeight,
      );
      const height = textRef.current.scrollHeight;
      const maxHeight = lineHeight * 4;
      setShowToggle(height > maxHeight);
    }
  }, [biography]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold text-white">Biography</h2>
      <div>
        <p
          ref={textRef}
          className={`text-gray-300 leading-relaxed ${
            !isExpanded ? "line-clamp-6" : ""
          }`}
        >
          {biography}
        </p>
        {showToggle && (
          <button
            onClick={handleToggle}
            className="text-gray-400 hover:text-white text-sm font-medium mt-2 transition-colors"
            type="button"
          >
            {isExpanded ? "Read less" : "Read more"}
          </button>
        )}
      </div>
    </div>
  );
}
