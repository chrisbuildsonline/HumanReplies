# HumanReplies Complete Installation Guide

AI-powered reply generation for social media platforms with full-stack setup.

## 🚀 Quick Start Options

### Option 1: Extension Only (Basic Usage)
For trying out the browser extension with basic features:
1. Jump to [Extension Installation](#-browser-extension-installation)
2. Skip backend setup - extension works with hosted API

### Option 2: Complete Development Setup
For full development environment with local backend:
1. [Backend Setup](#-backend-setup) (Required first)
2. [Extension Installation](#-browser-extension-installation) 
3. [Dashboard Setup](#-dashboard-setup) (Optional)

---

## 🖥️ Backend Setup

**Required for local development and testing**

### Prerequisites

- **Python 3.9+** with pip
- **PostgreSQL 14+** (install [Postgres.app](https://postgresapp.com/) or PostgreSQL server)
- **Supabase Account** (free tier works)

### Quick Setup Script

```bash
cd backend

# macOS/Linux - Automated setup
./setup.sh

# Windows - Automated setup  
setup.bat
```

The script will:
- Create virtual environment
- Install dependencies
- Setup PostgreSQL database
- Apply migrations
- Seed default data
- Start the backend server

### Manual Setup

If the script doesn't work or you prefer manual setup:

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Environment configuration
cp .env.example .env
# Edit .env with your database and Supabase credentials

# 4. Database setup
python setup_db_complete.py    # Fresh setup with all tables and data
# OR
python run_migrations.py       # Apply migrations to existing database

# 5. Verify setup
python verify_setup.py

# 6. Start backend server
python run.py
```

### Environment Variables

Create `.env` file in `backend/` directory:

```env
# Supabase Authentication
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Local PostgreSQL Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/humanreplies
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=humanreplies
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# API Configuration
ENVIRONMENT=development
API_HOST=0.0.0.0
API_PORT=8000

# Redis Caching (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_ENABLED=true
```

### Database Features

✅ **Complete Database Schema**:
- Users with Supabase authentication
- Reply analytics (privacy-first - no content stored)
- Custom user tones and system presets
- User settings for writing style and preferences
- External service URL management with caching
- Migration system with rollback support

✅ **API Endpoints Ready**:
- `/api/v1/auth/*` - Authentication management
- `/api/v1/tones/*` - Tone management (presets + custom)
- `/api/v1/user-settings/*` - User preferences
- `/api/v1/replies/*` - Privacy-first analytics
- `/api/v1/services/*` - External service management

### Verify Backend

```bash
# Check all components
python verify_setup.py

# Test database connection
python test_db_connection.py

# View API docs
open http://localhost:8000/docs
```

---

## 🔌 Browser Extension Installation

### Chrome Installation

1. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Or Menu → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in top right

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `browser-extension` folder
   - Extension appears in your extensions list

4. **Verify Installation**
   - Look for "HumanReplies" in extensions
   - Extension icon in browser toolbar
   - Status shows "On"

### Extension Features

✅ **Multi-Platform Support**: X (Twitter), LinkedIn, Facebook
✅ **Authentication**: Secure Supabase login with popup
✅ **Custom Tones**: Create and manage personal tone presets
✅ **Analytics**: Usage tracking for dashboard insights
✅ **Environment Switching**: Dev/Staging/Production modes

### Testing the Extension

#### Method 1: Social Media Testing
1. Visit https://x.com or https://twitter.com
2. Find any tweet and click "Reply"
3. Look for "🧠 Generate Reply" button
4. Select tone and click to generate

#### Method 2: Authentication Testing
1. Click extension icon in toolbar
2. Test "🚀 Login to HumanReplies" 
3. Try "✨ Create Account" flow
4. Verify authenticated state

### Extension Configuration

**Settings Access**: Right-click extension → Options

**Environment Switching**:
- Development: `http://localhost:8000`
- Staging: Your staging API URL
- Production: Your production API URL

**Custom API**: Override default endpoints for testing

---

## 📊 Dashboard Setup

**Optional - Analytics and Settings Management**

### Prerequisites

- **Node.js 18+**
- **npm or pnpm or yarn**

### Installation

```bash
cd dashboard

# Install dependencies
npm install
# OR
pnpm install
# OR  
yarn install

# Setup environment
cp .env.local.example .env.local
# Edit API endpoints in .env.local

# Start development server
npm run dev
# OR
pnpm dev
# OR
yarn dev
```

### Dashboard Features

✅ **Usage Analytics**: Total replies, daily/weekly/monthly stats
✅ **Visual Charts**: Daily activity and service breakdowns  
✅ **Settings Management**: User preferences and custom tones
✅ **Dark/Light Mode**: Theme switching with system sync
✅ **Responsive Design**: Mobile and desktop optimized

### Access Dashboard

- **Development**: http://localhost:3000
- **Production**: Configure your domain in environment

---

## 🧪 Testing & Verification

### Extension Testing

```bash
# Test on supported platforms
1. Visit x.com - try reply generation
2. Check extension popup - verify auth state
3. Open DevTools Console - check for errors
4. Test tone selection - verify custom tones
```

### Backend Testing

```bash
cd backend

# Comprehensive verification
python verify_setup.py

# Test specific components
python test_db_connection.py
python test_services.py

# Check API health
curl http://localhost:8000/health
```

### Database Status Check

```bash
# After setup, verify database
python verify_setup.py
```

Expected output:
```
✅ Tables: 7
   - users: X rows
   - user_settings: X rows  
   - replies: X rows (analytics only)
   - tones: 6+ rows (presets + custom)
   - external_service_urls: 1+ rows
   - schema_migrations: 1+ rows

✅ Migrations Applied: 1+
✅ API Endpoints: All responding
✅ Authentication: Supabase connected
```

---

## 🔧 Development Workflow

### Making Changes

**Extension Development**:
1. Edit files in `browser-extension/`
2. Click refresh icon in `chrome://extensions/`
3. Test changes on social platforms

**Backend Development**:
```bash
cd backend
source .venv/bin/activate

# Make code changes
# Auto-reload with: python run.py --reload

# Create migrations for model changes
alembic revision --autogenerate -m "description"
alembic upgrade head
```

**Dashboard Development**:
```bash
cd dashboard
npm run dev  # Hot reload enabled
```

### File Structure Overview

```
HumanReplies/
├── backend/                   # FastAPI backend
│   ├── app/                  # Application code
│   ├── migrations/           # Database migrations
│   ├── setup_db_complete.py  # Complete setup script
│   ├── verify_setup.py       # Setup verification
│   └── requirements.txt      # Python dependencies
├── browser-extension/         # Chrome extension
│   ├── manifest.json         # Extension config
│   ├── core/api-service.js   # API communication
│   ├── popup.html/.js        # Extension popup
│   └── platforms/            # Platform integrations
├── dashboard/                # Next.js analytics
│   ├── app/                  # Next.js app directory
│   ├── components/           # React components
│   └── package.json          # Node dependencies
└── INSTALL.md               # This installation guide
```

---

## 🚨 Troubleshooting

### Backend Issues

**Database Connection Failed**:
```bash
# Check PostgreSQL is running
brew services start postgresql  # macOS
sudo service postgresql start   # Linux

# Verify database exists
psql -U postgres -l
```

**Migration Errors**:
```bash
# Reset migrations (caution: data loss)
python setup_db_complete.py

# Apply specific migration
alembic upgrade head
```

**Import Errors**:
```bash
# Verify virtual environment
source .venv/bin/activate
pip install -r requirements.txt
```

### Extension Issues

**Extension Not Loading**:
- Select `browser-extension` folder (not parent folder)
- Check all files present
- Look for errors in Extensions page

**API Not Working**:
- Verify backend running at http://localhost:8000
- Check browser console for errors
- Test API directly: http://localhost:8000/docs

**Authentication Problems**:
- Clear extension storage in Chrome
- Check Supabase credentials in backend/.env
- Verify popup blocker disabled

**No Reply Button**:
- Refresh page after installing extension
- Ensure you're on supported platform (x.com)
- Check if content script loaded in DevTools

### Dashboard Issues

**Build Errors**:
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**API Connection**:
- Verify backend URL in .env.local
- Check CORS settings in backend
- Confirm authentication tokens

---

## 🔐 Security & Privacy

### Privacy-First Design
- ❌ **No content stored**: Original posts and replies never saved
- ❌ **No personal data**: No names, locations, or sensitive information
- ✅ **Analytics only**: Timestamps and service types for insights
- ✅ **User control**: Optional authentication for advanced features

### Security Features
- **Supabase JWT**: Secure token-based authentication
- **Row-level Security**: Database access control
- **Input Validation**: All API inputs sanitized
- **CORS Protection**: Restricted frontend domains
- **Local Processing**: Content never leaves your device

---

## 📈 What's Next

### Extension Ready ✅
- Generate AI replies on X (Twitter)
- Authentication for custom tones
- Analytics tracking
- Environment switching

### Backend Complete ✅
- Full API with authentication
- Privacy-first analytics storage
- Custom tones management
- User settings system
- Redis caching layer

### Dashboard Ready ✅
- Usage statistics and charts
- Settings management
- Custom tone creation
- Dark/light theme

### Production Deployment
1. Deploy backend to your preferred platform
2. Update extension environment config
3. Build dashboard for static hosting
4. Submit extension to Chrome Web Store

---

## 🤝 Support

**Having Issues?**
1. Check this installation guide
2. Review error messages in browser console
3. Verify all prerequisites installed
4. Test each component individually

**Get Help**:
- Create GitHub issue with detailed description
- Include error messages and setup details
- Specify operating system and versions

The complete HumanReplies system is now ready for development and testing! 🚀