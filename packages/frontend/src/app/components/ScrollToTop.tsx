/**
 * ScrollToTop Component
 *
 * Automatically scrolls to the top of the page when the route changes.
 * This ensures users always see the top of the page when navigating,
 * preventing the jarring experience of landing mid-page.
 *
 * Usage: Place inside BrowserRouter in App.tsx
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll to top instantly on route change
    window.scrollTo(0, 0);
  }, [pathname]);

  // This component doesn't render anything
  return null;
};
