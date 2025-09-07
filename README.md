# HumanReplies

AI-powered reply generation for social media platforms. A complete solution with browser extension, dashboard analytics, and backend API.

## 🏗️ Project Architecture

```
HumanReplies/
├── extension/          # Browser extension (Chrome/Firefox)
├── backend/           # FastAPI backend with PostgreSQL
├── dashboard/         # Next.js analytics dashboard  
├── landing/          # Marketing landing page
└── README.md         # This file
```

## 🚀 Quick Start

### 1. Backend Setup

**Quick Setup (Recommended):**
```bash
cd backend

# macOS/Linux
./setup.sh

# Windows
setup.bat
```

**Manual Setup:**
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup PostgreSQL database (requires Postgres.app or PostgreSQL running)
python setup_db.py

# Start the backend server
python run.py

# API available at http://localhost:8000
# API docs at http://localhost:8000/docs
# Health check: http://localhost:8000/health
```

**Prerequisites for Backend:**
- **PostgreSQL**: Install Postgres.app or PostgreSQL server
- **Python 3.9+**: With virtual environment (created automatically)
- **Supabase Account**: For authentication (credentials in .env)

**Virtual Environment Commands:**
```bash
# Create virtual environment (first time only)
python -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # macOS/Linux
# OR
.venv\Scripts\activate     # Windows

# Deactivate when done
deactivate
```

### 2. Extension Development
```bash
cd extension
# Load unpacked extension in Chrome
# Navigate to chrome://extensions/
# Enable Developer mode → Load unpacked → Select extension folder
```

### 3. Dashboard Development
```bash
cd dashboard
npm install
npm run dev
# Dashboard available at http://localhost:3000
```

### 4. Landing Page
```bash
cd landing
npm install
npm run dev
# Landing page available at http://localhost:3001
```

---

## 🧩 Extension

**AI-powered browser extension for generating contextual social media replies**

### Features
- 🧠 **Smart Reply Generation**: Context-aware AI responses
- ⚡ **Instant Integration**: Works directly in social media interfaces
- 🎯 **Multi-Platform**: X (Twitter), LinkedIn, Facebook support
- 🔐 **User Authentication**: Secure login with dashboard integration
- 🎨 **Dynamic Tones**: API-driven tone selection with preset options and custom user tones
- 📊 **Analytics**: Automatic reply tracking for dashboard
- 🔧 **Configurable**: Environment switching and custom API endpoints

### Supported Platforms
- **X (Twitter)**: Full integration with reply generation
- **LinkedIn**: Coming soon
- **Facebook**: Coming soon

### Technical Stack
- **Manifest V3**: Modern Chrome extension architecture
- **Vanilla JavaScript**: No framework dependencies for performance
- **Modular Design**: Platform-specific integrations
- **Environment Config**: Development/staging/production switching

### Key Files
```
extension/
├── manifest.json              # Extension configuration
├── config/environment.js      # Environment management
├── core/api-service.js        # API communication
├── supabase-client.js        # Supabase authentication client
├── platforms/x-integration.js # X (Twitter) integration
├── popup.html                # Extension popup with login/signup
├── popup.js                  # Popup authentication logic
├── auth-callback.html        # Supabase auth redirect handler
├── options.html             # Settings page
└── styles.css              # Extension styling
```

### Installation & Usage

#### Basic Setup
1. Load unpacked extension in Chrome developer mode
2. Navigate to supported social media platform
3. Look for "🧠 Generate Reply" button
4. Click to generate AI-powered response
5. Reply is automatically inserted

#### Authentication & Advanced Features
1. **Login**: Click extension popup → "🚀 Login to HumanReplies"
2. **Signup**: Click extension popup → "✨ Create Account"
3. **Supabase Auth**: Secure popup with hosted Supabase authentication
4. **Auto-Refresh**: Seamless token refresh for uninterrupted usage
5. **Dashboard Link**: Direct access to analytics at app.humanreplies.com

#### User States
- **Logged Out**: Basic preset tones, limited features
- **Logged In**: Custom tones management, analytics tracking, dashboard access
  - Create custom tones with personalized names and descriptions
  - Edit existing custom tones to refine your voice
  - Delete custom tones you no longer need
  - All custom tones appear alongside presets in tone selector

### Configuration
- **Settings Page**: Right-click extension → Options
- **Environment Switching**: Development/Staging/Production
- **Custom API URLs**: Override default endpoints
- **Debug Mode**: Console logging for development

### Authentication Flow
1. **Login Trigger**: User clicks "Login" or "Create Account" in extension popup
2. **Supabase Auth**: Opens Supabase hosted auth UI in secure popup window
3. **Token Extraction**: Extension captures JWT tokens from auth callback
4. **Token Storage**: Stores access/refresh tokens securely in Chrome storage
5. **Auto-Refresh**: Automatic token refresh when expired using refresh token
6. **User Profile**: Fetches user data from Supabase and syncs with backend

### Tone System
- **Dynamic Loading**: Tones fetched from backend API on popup load
- **Preset Tones**: System-defined tones with emojis and descriptions
  - 👍 Neutral - Balanced and helpful tone
  - 😂 Joke - Funny and light-hearted tone
  - ❤️ Support - Supportive and encouraging tone
  - 💡 Idea - Innovative and creative suggestions
  - ❓ Question - Thoughtful conversation starters
  - 💪 Confident - Assertive and confident tone
- **Custom User Tones**: Authenticated users can create, edit, and delete custom tones
  - Personal tone library for consistent voice
  - Custom display names and descriptions
  - Seamless integration with preset tones
- **Authentication-Aware**: Logged-in users see both preset and custom tones
- **Fallback Support**: Hardcoded fallback if API unavailable
- **Extensible**: Backend-managed for easy tone additions

### API Integration
- **Authentication**: JWT tokens from Supabase Auth
- **Reply Generation**: POST /api/v1/services/generate-reply
- **Tones Management**: 
  - GET /api/v1/tones/ - Dynamic tone loading (includes custom tones for authenticated users)
  - POST /api/v1/tones/ - Create custom tone
  - PUT /api/v1/tones/{id} - Update custom tone
  - DELETE /api/v1/tones/{id} - Delete custom tone
- **User Profile**: GET /api/v1/auth/me
- **Analytics**: Automatic reply tracking to backend database

---

## ⚡ Backend

**FastAPI backend with Supabase authentication and PostgreSQL data storage**

### Architecture
- **Authentication**: Supabase Auth (JWT tokens only)
- **Data Storage**: Local PostgreSQL database
- **API Framework**: FastAPI with async support
- **Database ORM**: SQLAlchemy with async support
- **Migrations**: Alembic for database versioning

### Features
- 🔐 **Supabase Auth Integration**: Secure JWT token validation
- 🗄️ **PostgreSQL Database**: Local data storage with full control
- 📝 **Reply Management**: Store and analyze user-generated replies
- 📊 **Dashboard Statistics**: Real-time analytics and insights
- 🔧 **Multi-platform Support**: Extensible service type system
- 🎨 **Custom Tones**: User-specific tone creation and management
- 🛡️ **Type Safety**: Pydantic models for all API interactions

### API Endpoints

#### Authentication (`/api/v1/auth`)
- `POST /register` - Register new user via Supabase
- `POST /login` - User login via Supabase
- `POST /logout` - User logout
- `GET /me` - Get current user info

#### Users (`/api/v1/users`)
- `GET /profile` - Get user profile from local DB
- `PUT /profile` - Update user profile
- `DELETE /profile` - Deactivate user account

#### Replies (`/api/v1/replies`)
- `POST /` - Create new reply record
- `GET /` - Get user's replies (paginated, filterable)
- `GET /stats` - Get dashboard statistics
- `GET /recent` - Get recent reply activity
- `DELETE /{reply_id}` - Delete specific reply

#### External Services (`/api/v1/services`)
- `GET /urls` - Get all external service URLs (cached for 1 hour)
- `GET /urls/{service_name}` - Get specific service URL
- `POST /urls/{service_name}/refresh` - Force refresh service URL cache
- `POST /generate-reply` - Generate reply using external AI service (requires authentication)

#### Tones (`/api/v1/tones`)
- `GET /` - Get all active tones (presets + user's custom tones if authenticated)
- `GET /presets` - Get only preset tones (system defaults)
- `POST /` - Create custom tone (requires authentication)
- `PUT /{tone_id}` - Update custom tone (requires authentication, owner only)
- `DELETE /{tone_id}` - Delete custom tone (requires authentication, owner only)

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    full_name VARCHAR,
    avatar_url VARCHAR,
    role VARCHAR DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Replies Table
```sql
CREATE TABLE replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    original_post TEXT NOT NULL,
    generated_reply TEXT NOT NULL,
    service_type VARCHAR NOT NULL,
    post_url VARCHAR,
    metadata TEXT, -- JSON stored as text
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### External Service URLs Table
```sql
CREATE TABLE external_service_urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR UNIQUE NOT NULL,
    url VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_checked TIMESTAMP DEFAULT NOW(),
    cache_expires_at TIMESTAMP,
    metadata TEXT, -- JSON for additional service info
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tones Table
```sql
CREATE TABLE tones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    display_name VARCHAR NOT NULL,
    description VARCHAR,
    is_preset BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- NULL for presets, user ID for custom tones
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_tones_user_id ON tones(user_id);
```

### Environment Variables
```env
# Supabase (Auth only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Local PostgreSQL
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/humanreplies
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=humanreplies
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# API Settings
ENVIRONMENT=development
API_HOST=0.0.0.0
API_PORT=8000
```

### External Service URL Management

The backend now manages all external service URLs with automatic caching:

#### Service URL Endpoints
- `GET /api/v1/services/urls` - Get all service URLs (cached 1 hour)
- `GET /api/v1/services/urls/pollinations` - Get Pollinations.ai URL
- `POST /api/v1/services/urls/pollinations/refresh` - Force refresh cache

#### Automatic Caching
- URLs are cached for 1 hour in PostgreSQL
- Extension fetches URLs from backend only
- No hardcoded external URLs in extension code
- Automatic cache refresh when expired

#### Adding New Services
1. Add service to `default_urls` in `backend/app/routers/services.py`
2. Update database with new service entry
3. Extension automatically uses new service via backend

### Development Workflow
```bash
# Setup database
python setup_db.py

# Setup default tones (run once after database setup)
python setup_tones.py

# Generate migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Run development server
python run.py
```

---

## 📊 Dashboard

**Next.js analytics dashboard for monitoring extension usage and managing settings**

### Features
- 📈 **Usage Statistics**: Total replies, daily/weekly/monthly counts
- 📊 **Visual Analytics**: Daily activity charts and service breakdowns
- ⚙️ **Settings Management**: User preferences and configuration
- 🌓 **Dark/Light Mode**: Theme switching with system preference
- 📱 **Responsive Design**: Optimized for desktop and mobile
- 🔄 **Real-time Updates**: Live data synchronization

### Technical Stack
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **React 18** with modern hooks
- **Canvas API** for custom charts
- **CSS Custom Properties** for theming

### Key Components
```
dashboard/
├── app/
│   ├── layout.tsx           # Root layout with metadata
│   ├── page.tsx            # Main dashboard page
│   └── globals.css         # Global styles with theme support
├── components/
│   ├── Header.tsx          # Header with theme toggle
│   ├── StatsGrid.tsx       # Statistics cards grid
│   ├── Charts.tsx          # Canvas-based charts
│   ├── RecentActivity.tsx  # Activity timeline
│   └── SettingsModal.tsx   # Settings modal dialog
└── lib/
    └── storage.ts          # Chrome storage service
```

### Dashboard Statistics
```json
{
  "total_replies": 150,
  "today_replies": 5,
  "week_replies": 23,
  "month_replies": 89,
  "daily_activity": [
    {"date": "2025-01-01", "count": 3},
    {"date": "2025-01-02", "count": 7}
  ],
  "top_services": [
    {"service": "x", "count": 45, "percentage": 30.0},
    {"service": "linkedin", "count": 38, "percentage": 25.3}
  ]
}
```

### Development
```bash
cd dashboard
npm install
npm run dev      # Development server
npm run build    # Production build
npm run export   # Static export
```

---

## 🌐 Landing Page

**Marketing website built with Next.js and modern design**

### Features
- 🎨 **Modern Design**: Clean, professional interface
- 📱 **Responsive**: Mobile-first responsive design
- ⚡ **Performance**: Optimized for speed and SEO
- 🔗 **Integration**: Links to dashboard and extension

### Technical Stack
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React Components** for modularity

---

## 🔄 Integration Flow

```mermaid
graph TD
    A[Browser Extension] -->|Generate Reply Request| C[FastAPI Backend]
    C -->|Fetch Cached URLs| E[PostgreSQL]
    C -->|Proxy Request| B[Pollinations AI]
    B -->|AI Response| C
    C -->|Store Reply + Analytics| E
    C -->|Return Reply| A
    C -->|Authenticate| D[Supabase Auth]
    F[Dashboard] -->|Fetch Analytics| C
    G[Landing Page] -->|Sign Up| D
    G -->|Download| A
```

### Data Flow
1. **User generates reply** in browser extension
2. **Extension calls backend API** (no direct external service calls)
3. **Backend fetches cached service URLs** from PostgreSQL (1-hour cache)
4. **Backend proxies request** to external AI service (Pollinations.ai)
5. **Backend stores reply and analytics** in PostgreSQL database
6. **Backend authenticates** via Supabase JWT
7. **Dashboard fetches** analytics from backend
8. **Real-time updates** show usage statistics

### 🔧 New Architecture Benefits
- **Centralized Control**: All external service URLs managed in backend
- **Caching**: Service URLs cached for 1 hour to reduce latency
- **No Direct External Calls**: Extension only communicates with your backend
- **Better Error Handling**: Centralized error management and retry logic
- **Analytics**: All requests automatically logged for dashboard insights
- **Security**: No API keys or external URLs exposed in extension code

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js 18+** for frontend projects
- **Python 3.9+** for backend
- **PostgreSQL 14+** for database
- **Chrome/Chromium** for extension development

### Environment Configuration
Each component has its own environment setup:

#### Backend
```bash
cp backend/.env.example backend/.env
# Edit database and Supabase credentials
```

#### Dashboard
```bash
cp dashboard/.env.local.example dashboard/.env.local
# Configure API endpoints
```

#### Extension
- Uses built-in environment configuration
- Switch environments via extension options page
- Supports custom API endpoints

### Development Workflow
1. **Start backend**: `cd backend && python run.py`
2. **Start dashboard**: `cd dashboard && npm run dev`
3. **Load extension**: Chrome → Extensions → Load unpacked
4. **Start landing**: `cd landing && npm run dev`

---

## 🚀 Deployment

### Backend Deployment
```bash
# Production environment
export ENVIRONMENT=production

# Use managed PostgreSQL (AWS RDS, etc.)
export DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db

# Deploy with Gunicorn
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend Deployment
```bash
# Dashboard
cd dashboard
npm run build
npm run export  # Static files in out/

# Landing page
cd landing
npm run build
npm run export  # Static files in out/
```

### Extension Distribution
1. **Chrome Web Store**: Package extension for store submission
2. **Firefox Add-ons**: Convert to WebExtensions format
3. **Enterprise**: Distribute via organization policies

---

## 🔐 Security

### Authentication
- **Supabase JWT**: Secure token-based authentication
- **Row-level Security**: Database-level access control
- **API Validation**: Pydantic models validate all inputs

### Data Protection
- **User Isolation**: Users can only access their own data
- **SQL Injection**: SQLAlchemy ORM prevents injection attacks
- **CORS**: Configured for specific frontend domains
- **Input Sanitization**: All user inputs validated and sanitized

### Privacy
- **Minimal Data**: Only necessary data is collected
- **Local Storage**: Extension data stored locally
- **Opt-in Analytics**: Users control data collection
- **Data Deletion**: Users can delete all their data

---

## 📈 Analytics & Monitoring

### Extension Analytics
- Reply generation counts
- Platform usage distribution
- Response time metrics
- Error rate tracking

### Backend Monitoring
- API endpoint performance
- Database query optimization
- User authentication metrics
- System resource usage

### Dashboard Insights
- User engagement patterns
- Feature usage statistics
- Performance bottlenecks
- Growth metrics

---

## 🤝 Contributing

### Development Guidelines
1. **Code Style**: Follow existing patterns and conventions
2. **Testing**: Write tests for new features
3. **Documentation**: Update README.md with any changes
4. **Security**: Follow security best practices
5. **Performance**: Optimize for speed and efficiency

### Kiro Integration Rules
- **Always update README.md** when making project changes
- **Reflect new features** in documentation
- **Update API documentation** for backend changes
- **Document configuration changes** for all components
- **Keep architecture diagrams current**

### Pull Request Process
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Update documentation
5. Submit pull request

---

## 📝 License

This project is proprietary software. All rights reserved.

---

## 📞 Support

For questions, issues, or feature requests:
- **GitHub Issues**: Create an issue in this repository
- **Email**: support@humanreplies.com
- **Documentation**: Refer to this README for setup and usage

---

**Built with ❤️ for better social media interactions**