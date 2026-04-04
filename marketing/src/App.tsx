import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import CodeExample from './components/CodeExample';
import LiveDemo from './components/LiveDemo';
import Pricing from './components/Pricing';
import Comparison from './components/Comparison';
import Testimonials from './components/Testimonials';
import OpenSource from './components/OpenSource';
import CTA from './components/CTA';
import Footer from './components/Footer';

export default function App() {
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
      <Testimonials />
      <OpenSource />
      <CTA />
      <Footer />
    </div>
  );
}
