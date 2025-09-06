# HumanReplies Backend

FastAPI backend with Supabase authentication and PostgreSQL data storage for the HumanReplies extension dashboard.

## Architecture

- **Authentication**: Supabase Auth (JWT tokens)
- **Data Storage**: Local PostgreSQL database
- **API Framework**: FastAPI with async support
- **Database ORM**: SQLAlchemy with async support
- **Migrations**: Alembic for database versioning

## Features

- **Supabase Auth Integration**: Secure JWT token validation
- **PostgreSQL Database**: Local data storage with full control
- **Reply Management**: Store and analyze user-generated replies
- **Dashboard Statistics**: Real-time analytics and insights
- **Multi-platform Support**: Extensible service type system
- **Type Safety**: Pydantic models for all API interactions

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Setup PostgreSQL
Make sure PostgreSQL is running locally:
```bash
# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Create database user (if needed)
createuser -s postgres
```

### 3. Setup Database
```bash
python setup_db.py
```

### 4. Run Development Server
```bash
python run.py
```

### 5. Access API Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /register` - Register new user via Supabase
- `POST /login` - User login via Supabase
- `POST /logout` - User logout
- `GET /me` - Get current user info

### Users (`/api/v1/users`)
- `GET /profile` - Get user profile from local DB
- `PUT /profile` - Update user profile
- `DELETE /profile` - Deactivate user account

### Replies (`/api/v1/replies`)
- `POST /` - Create new reply record
- `GET /` - Get user's replies (paginated, filterable)
- `GET /stats` - Get dashboard statistics
- `GET /recent` - Get recent reply activity
- `DELETE /{reply_id}` - Delete specific reply

## Database Schema

### Users Table
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

### Replies Table
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

## Dashboard Data Structure

The API provides comprehensive analytics for the dashboard:

### Statistics Endpoint (`/api/v1/replies/stats`)
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

### Recent Activity (`/api/v1/replies/recent`)
```json
{
  "replies": [
    {
      "id": "uuid",
      "original_post": "Great article about AI...",
      "generated_reply": "Thanks for sharing! I found...",
      "service_type": "x",
      "created_at": "2025-01-09T10:30:00Z"
    }
  ],
  "total_count": 150
}
```

## Service Types

The system supports extensible service types. Current platforms:
- `x` (Twitter/X)
- `linkedin`
- `facebook`
- `instagram`
- `reddit`

Add new platforms by simply using a new `service_type` string when creating replies.

## Environment Variables

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

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app with lifespan management
│   ├── config.py            # Settings and environment variables
│   ├── database.py          # SQLAlchemy setup + Supabase clients
│   ├── auth.py              # JWT authentication utilities
│   ├── models.py            # SQLAlchemy + Pydantic models
│   └── routers/
│       ├── auth.py          # Supabase authentication endpoints
│       ├── users.py         # User management (local DB)
│       └── replies.py       # Reply management and analytics
├── alembic/                 # Database migrations
├── requirements.txt         # Python dependencies
├── setup_db.py             # Database initialization script
├── run.py                  # Development server
└── README.md               # This file
```

## Development Workflow

### Adding New Features
1. Update SQLAlchemy models in `app/models.py`
2. Create Pydantic models for API validation
3. Add new router endpoints
4. Generate migration: `alembic revision --autogenerate -m "description"`
5. Apply migration: `alembic upgrade head`

### Database Migrations
```bash
# Generate migration
alembic revision --autogenerate -m "add new table"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

## Integration with Extension

The extension should send reply data to the backend:

```javascript
// Extension integration example
const API_BASE = 'http://localhost:8000/api/v1';

// Create reply record
await fetch(`${API_BASE}/replies/`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    original_post: "Original social media post content",
    generated_reply: "AI generated reply",
    service_type: "x", // or "linkedin", "facebook", etc.
    post_url: "https://x.com/user/status/123",
    metadata: {
      platform_specific_data: "any additional info"
    }
  })
});
```

## Production Deployment

1. **Environment**: Set `ENVIRONMENT=production`
2. **Database**: Use managed PostgreSQL (AWS RDS, etc.)
3. **Server**: Deploy with Gunicorn + Uvicorn workers
4. **CORS**: Update allowed origins for production domains

```bash
# Production server
pip install gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Security

- **Authentication**: Supabase JWT tokens validated on every request
- **Data Isolation**: Users can only access their own data
- **Input Validation**: Pydantic models validate all inputs
- **SQL Injection**: SQLAlchemy ORM prevents injection attacks
- **CORS**: Configured for specific frontend domains