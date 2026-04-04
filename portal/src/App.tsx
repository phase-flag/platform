import { Routes, Route, Link } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import FlagDemo from './pages/FlagDemo';
import EvaluationDemo from './pages/EvaluationDemo';
import RolloutDemo from './pages/RolloutDemo';
import SDKDemo from './pages/SDKDemo';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
      <h1 className="text-6xl font-bold text-pf-mint mb-4">404</h1>
      <p className="text-xl text-white/70 mb-8">Page not found</p>
      <Link to="/" className="px-6 py-3 bg-pf-mint text-white rounded-xl hover:bg-pf-mint-light transition-colors">
        Back to Home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0F1A20]">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/flags" element={<FlagDemo />} />
          <Route path="/evaluation" element={<EvaluationDemo />} />
          <Route path="/rollouts" element={<RolloutDemo />} />
          <Route path="/sdks" element={<SDKDemo />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
