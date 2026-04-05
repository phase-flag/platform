import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import CodeExample from './components/CodeExample';
import LiveDemo from './components/LiveDemo';
import Pricing from './components/Pricing';
import Comparison from './components/Comparison';
import Compare from './components/Compare';
import Testimonials from './components/Testimonials';
import OpenSource from './components/OpenSource';
import CTA from './components/CTA';
import Footer from './components/Footer';
import CookieConsent from './components/CookieConsent';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

type Page = 'home' | 'terms' | 'privacy';

function getInitialPage(): Page {
  const hash = window.location.hash;
  if (hash === '#/terms') return 'terms';
  if (hash === '#/privacy') return 'privacy';
  return 'home';
}

export default function App() {
  const [page, setPage] = useState<Page>(getInitialPage);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#/terms') {
        setPage('terms');
        window.scrollTo({ top: 0 });
      } else if (hash === '#/privacy') {
        setPage('privacy');
        window.scrollTo({ top: 0 });
      } else if (hash === '' || hash === '#') {
        setPage('home');
      }
      // Other anchors (like #features) keep the current page as-is
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const showPrivacy = () => {
    window.location.hash = '#/privacy';
  };

  if (page === 'terms') {
    return (
      <div className="min-h-screen">
        <Navbar />
        <Terms />
        <Footer />
        <CookieConsent onLearnMore={showPrivacy} />
      </div>
    );
  }

  if (page === 'privacy') {
    return (
      <div className="min-h-screen">
        <Navbar />
        <Privacy />
        <Footer />
        <CookieConsent onLearnMore={showPrivacy} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <CodeExample />
      <LiveDemo />
      <Pricing />
      <Comparison />
      <Compare />
      <Testimonials />
      <OpenSource />
      <CTA />
      <Footer />
      <CookieConsent onLearnMore={showPrivacy} />
    </div>
  );
}
