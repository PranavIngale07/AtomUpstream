import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AgentRoom from './pages/AgentRoom';
import JoinSession from './pages/JoinSession';
import Room from './pages/Room';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agent/:inviteToken" element={<AgentRoom />} />
          <Route path="/join/:inviteToken" element={<JoinSession />} />
          <Route path="/room/:sessionId/:participantId" element={<Room />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
