// src/App.tsx
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import StoryProvider from './context/StoryProvider';
import './App.css';

// Import pages from the correct path
// Make sure to create these files in these locations
import HomePage from './pages/HomePage';
import NarrativePage from './pages/NarrativePage';

function App() {
  return (
    <StoryProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </StoryProvider>
  );
}

function AppContent() {
  const location = useLocation();
  
  return (
    <div className="LeibnizProjectRootContainer">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/narrative/:nodeId" element={<NarrativePage />} />
      </Routes>
    </div>
  );
}

export default App;