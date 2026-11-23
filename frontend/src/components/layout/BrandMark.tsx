import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../config/brand';

interface BrandMarkProps {
  /** 'light' = white text for dark backgrounds, 'dark' = ink text for light backgrounds. */
  tone?: 'light' | 'dark';
  onClick?: () => void;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ tone = 'dark', onClick }) => (
  <Link
    to="/"
    onClick={onClick}
    aria-label={`${BRAND.productName} home`}
    className={`focus-ring rounded-lg shrink-0 ${tone === 'light' ? 'text-white' : 'text-ink-primary'}`}
  >
    <span className="flex items-center gap-2.5">
      {BRAND.logoSrc && <img src={BRAND.logoSrc} alt="" className="h-8 w-8 object-contain shrink-0" />}
      <span>
        <span className="text-sm font-extrabold tracking-tight block leading-none">{BRAND.productName}</span>
        <span className={`text-[10px] font-mono uppercase tracking-wider ${tone === 'light' ? 'text-slate-300' : 'text-ink-muted'}`}>
          {BRAND.organisation}
        </span>
      </span>
    </span>
  </Link>
);
