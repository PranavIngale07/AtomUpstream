import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import CustomerHome from './pages/CustomerHome';
import Home from './pages/Home';
import AgentRoom from './pages/AgentRoom';
import JoinSession from './pages/JoinSession';
import Room from './pages/Room';
import Dashboard from './pages/Dashboard';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/agent-home" element={<Home />} />
          <Route path="/customer-home" element={<CustomerHome />} />
          <Route path="/agent/:inviteToken" element={<AgentRoom />} />
          <Route path="/join/:inviteToken" element={<JoinSession />} />
          <Route path="/room/:sessionId/:participantId" element={<Room />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
