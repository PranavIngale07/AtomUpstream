# AtomUpstream

⚠ **Important:** 
The latest stable hackathon implementation is available in the **`dev`** branch. Judges must use `git checkout dev` or directly clone the `dev` branch to evaluate the project.

---

## 1. Project Title
Atomberg Support Video Platform

## 2. Project Overview
A real-time customer support platform built for Atomberg. This application empowers support agents to create secure video conferencing sessions, share files, and communicate with customers seamlessly. It features role-based access, real-time messaging, file sharing, and live captions, all managed through a centralized dashboard.

## 3. Problem Statement
Customer support often requires visual context to troubleshoot physical products effectively. Traditional phone calls or text chats lack the ability to show the exact problem, while standard video conferencing tools are too generic, lack proper agent-customer role enforcement, and do not integrate seamlessly into support workflows with features like session history and live file sharing.

## 4. Solution Overview
We built a specialized WebRTC-based video conferencing tool using Mediasoup. It provides a structured flow where an Agent can create a session and generate a secure invite link or a 6-digit short code. Customers join with the link—no account required. The system features an admin dashboard for session management, WebSocket-based real-time chat, file sharing, and browser-native live captioning.

## 5. Key Features
*   **Role-Based Workflows:** Distinct experiences for Agents (session creators) and Customers (invitees).
*   **Mediasoup Video/Audio:** High-performance, low-latency WebRTC media routing.
*   **Live Captions:** Real-time speech-to-text overlay broadcasted across the session.
*   **File Sharing:** In-session document sharing with download capabilities.
*   **Graceful Reconnects:** 30-second grace period for network drops before a participant is marked as left.
*   **Dashboard & Analytics:** Real-time overview of active sessions, chat histories, and participant metrics.

---

## 6. System Architecture
The application uses a microservices-inspired architecture separating the control plane (API) from the media plane (SFU). 
PostgreSQL stores persistent session data, Redis handles volatile state and presence, and Mediasoup routes media traffic.

---

## 7. Technology Stack

*   **Frontend:** React 19, TypeScript, Vite, React Router, Mediasoup Client, Zustand
*   **Backend:** Python 3, FastAPI, SQLAlchemy, AsyncPG, WebSockets, Uvicorn
*   **Database:** PostgreSQL 15
*   **Cache:** Redis 7
*   **Media Layer:** Mediasoup (Node.js Express Server)
*   **Storage:** Local File System (via FastAPI UploadFile)

---

## 8. User Roles

### Agent
*   Can create new support sessions.
*   Can view the admin dashboard and session history.
*   Has the authority to permanently end a session, disconnecting all users.

### Customer
*   Joins via an invite link or 6-digit short code.
*   Enters a display name before joining.
*   Can leave the session without permanently ending it for the agent.

---

## 9. Core Workflows

### Agent Flow
1. Agent lands on the home page and selects "Agent".
2. Agent clicks "Create Session".
3. An invite link and 6-digit short code are generated.
4. Agent enters the room and waits for the customer.
5. After support is provided, Agent clicks "End Session".

### Customer Flow
1. Customer receives an invite link or short code.
2. Customer enters their display name.
3. Customer joins the room and immediately connects to video/audio.
4. Customer can leave the call at any time.

### Dashboard Flow
1. Agents can access `/dashboard` to view active and past sessions.
2. The dashboard displays session durations, participant counts, and events.
3. Agents can click into a session to read chat history and view shared files.

---

## 10. Feature Breakdown

*   **Session Creation:** Secure generation of unique UUIDs, invite tokens, and short codes.
*   **Invite Links:** Direct routing to the join screen with the token pre-filled.
*   **Video Calling:** WebRTC multi-party video via Mediasoup SFU.
*   **Audio Calling:** Mute/unmute state broadcasted via WebSockets.
*   **Chat:** Real-time text messaging with persistent history.
*   **File Sharing:** Secure uploads to the backend with downloadable links sent in chat.
*   **Live Captions:** Browser `SpeechRecognition` API integration, broadcasting interim and final transcripts to peers.
*   **Reconnect Handling:** Redis-backed 30-second disconnect grace period to handle transient network failures gracefully.
*   **Role Enforcement:** Secret tokens validate Agent vs Customer permissions upon API and WebSocket connections.
*   **Dashboard:** Centralized view of all system activity.
*   **Session History:** Timeline of events (participant joined, file uploaded, session ended).
*   **Chat History:** Full transcription of in-session text messages.

---

## 11. Architecture Overview

### Control Plane
FastAPI handles HTTP requests for session creation, file uploads, and historical data retrieval. It ensures strict role validation using secret tokens.

### Media Plane
A standalone Node.js process running Mediasoup. It acts as an SFU (Selective Forwarding Unit), receiving media from producers and forwarding it to consumers to save client bandwidth.

### Database
PostgreSQL stores `sessions`, `participants`, `messages`, `session_events`, and `session_files`.

### Redis
Used for real-time presence tracking. It maps connected WebSockets to participants and handles the 30-second disconnect grace period.

### WebSocket Layer
FastAPI WebSockets manage signaling for chat, mute states, camera states, and live captions.

---

## 12. Setup Instructions

### Clone
```bash
git clone <GITHUB_URL>
cd atomberg-finale
git checkout dev
```

### Environment Variables
Create a `.env` file in the `backend/` directory:
```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/videoplatform
REDIS_URL=redis://localhost:6379/0
STORAGE_DIR=storage
```

### Infrastructure (Database & Redis)
```bash
docker-compose up -d
```

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
# Run migrations if needed (or standard DB init)
uvicorn app.main:app --reload
```

### Media Server
```bash
cd media-server
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 13. Running The Application

### Development
1. Start `docker-compose` (Postgres & Redis).
2. Start the Backend (`uvicorn app.main:app --reload`).
3. Start the Media Server (`npm start`).
4. Start the Frontend (`npm run dev`).
5. Open `http://localhost:5173`.

### Production
For production, the frontend should be built using `npm run build` and served via Nginx. The backend should run with Gunicorn, and Mediasoup requires public IP configurations for WebRTC ICE servers.

---

## 14. Project Structure

```text
atomberg-finale/
├── backend/                  # FastAPI Control Plane
│   ├── app/
│   │   ├── api/              # API Routes (sessions, ws, dashboard)
│   │   ├── core/             # Config and DB setup
│   │   ├── models/           # SQLAlchemy Models
│   │   └── schemas/          # Pydantic validation schemas
│   ├── storage/              # Local file upload directory
│   └── requirements.txt
├── frontend/                 # React UI
│   ├── src/
│   │   ├── components/       # Reusable UI elements
│   │   ├── lib/              # WebRTC, WebSocket, and CC logic
│   │   └── pages/            # Page views (Room, Dashboard, Landing)
│   └── package.json
├── media-server/             # Node.js Mediasoup SFU
│   ├── server.js
│   └── package.json
└── docker-compose.yml        # Infrastructure definitions
```

---

## 15. API Overview

*   `POST /api/sessions/identity` - Create global role identity.
*   `POST /api/sessions/` - Create a new video session (Agent only).
*   `GET /api/sessions/{invite_token}` - Retrieve session metadata.
*   `POST /api/sessions/{invite_token}/join` - Join a session (Customer only).
*   `GET /api/sessions/{session_id}/chat` - Retrieve persistent chat history.
*   `POST /api/sessions/{session_id}/file/upload` - Upload a file to the session.
*   `POST /api/sessions/{session_id}/end` - Terminate session and cleanup.
*   `GET /api/dashboard/overview` - Fetch high-level analytics.

---

## 16. Database Overview

*   **Session:** ID, invite_token, short_code, status, timestamps.
*   **Participant:** ID, session_id, role, secret_token, display_name.
*   **Message:** ID, session_id, sender_id, content, message_type (TEXT/FILE).
*   **SessionEvent:** ID, session_id, event_type, payload (JSON).
*   **SessionFile:** ID, session_id, filename, file_size, uploader.

---

## 17. Dashboard Features

The `/dashboard` route provides:
1. **Live Metrics:** Total sessions, active sessions, and currently connected participants.
2. **Session Ledger:** A chronological list of all sessions and their statuses.
3. **Deep Dives:** Clicking a session reveals the exact event timeline, complete chat history, uploaded files, and participant join times.

---

## 18. Known Limitations

*   **File Storage:** Currently utilizes local disk storage (`/backend/storage`). In a production scenario, this should be migrated to AWS S3 or Azure Blob Storage.
*   **Mediasoup Scaling:** The SFU currently runs as a single worker process. Production scaling requires a distributed Mediasoup worker pool and a Redis pub/sub layer for cross-host routing.
*   **Live Captions API:** Depends on the browser's native `SpeechRecognition` API, which is primarily supported in Chrome/Edge and requires an active internet connection to Google's transcription servers.

---

## 19. Future Improvements

*   **Cloud Object Storage Integration** for scalable file sharing.
*   **Screen Sharing** support.
*   **Session Recording** integration via a headless browser or Mediasoup raw media extraction.
*   **Auth Provider Integration** (OAuth/JWT) to replace simple secret tokens for Agents.
*   **AI Session Summaries** via LLM analysis of the Chat and Live Caption transcripts.

---

## 20. Demo Instructions

**To evaluate the project:**
1. Navigate to the Home page.
2. **Create Session:** Select "Agent" and click "Create Session".
3. **Join Session:** Open an Incognito window, paste the invite link (or enter the 6-digit short code on the home screen), enter a name, and join as a Customer.
4. **Chat & File Sharing:** Send a text message and upload an image/document. Note how it syncs immediately.
5. **Live Captions:** Click the "CC" button on the Agent side and speak. Watch the text appear on the Customer's screen.
6. **Dashboard:** Navigate to `/dashboard` as the Agent to view the active session metrics and history.
7. **End Call:** Click the red hangup button as the Agent. Watch the Customer's screen gracefully show a "Session Ended" state.

---

## 21. Screenshots Section

*(Placeholders for future additions)*

![Landing Page](#)  
*Figure 1: Home and role selection*

![Video Room](#)  
*Figure 2: Active video session with live captions enabled*

![Dashboard](#)  
*Figure 3: Agent analytics and session history dashboard*

---

## 22. Contributors

*   Atomberg Hackathon Team

## 23. License

MIT License. See `LICENSE` for more information.
