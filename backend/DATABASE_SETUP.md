# Database Setup Guide

## Overview

This directory contains the complete database setup and migration scripts for the HumanReplies application.

## Database Schema

### Tables

1. **users** - User accounts (linked to Supabase auth)
2. **user_settings** - User-specific settings (writing style, guardian text)
3. **replies** - Reply tracking for analytics
4. **tones** - System presets + user custom tones
5. **external_service_urls** - External API service URLs

### New Features Added

- **User Settings Table**: Stores user-specific writing style and guardian text instructions
- **User Custom Tones**: Users can now create their own custom tones (linked to their account)
- **Migration System**: Proper database versioning and migration tracking

## Setup Scripts

### 1. Fresh Database Setup

For a completely new database:

```bash
python setup_db_complete.py
```

This will:

- Create the database if it doesn't exist
- Create all tables
- Seed default tones (helpful, friendly, professional, etc.)
- Seed external service URLs

### 2. Migrate Existing Database

For updating an existing database with the new features:

```bash
python run_migrations.py
```

This will:

- Create the `user_settings` table
- Add `user_id` column to the `tones` table
- Update existing tones as system presets
- Track applied migrations

### 3. Test Database Connection

To verify your database connection and see current status:

```bash
python test_db_connection.py
```

## Migration Scripts

### Migration Files

Located in `migrations/` directory:

- `001_add_user_settings_and_user_tones.py` - Adds user settings and user-specific tones

### Creating New Migrations

1. Create a new file in `migrations/` with format: `XXX_description.py`
2. Include a `run_migration()` async function
3. Run `python run_migrations.py` to apply

### Rollback

To rollback the latest migration:

```bash
cd migrations
python 001_add_user_settings_and_user_tones.py rollback
```

## API Endpoints

### User Settings

- `GET /api/v1/user-settings/` - Get user settings
- `POST /api/v1/user-settings/` - Create user settings
- `PUT /api/v1/user-settings/` - Update user settings
- `DELETE /api/v1/user-settings/` - Delete user settings

### Tones (Updated)

- `GET /api/v1/tones/` - Get all tones (presets + user custom)
- `POST /api/v1/tones/` - Create custom tone (requires auth)
- `PUT /api/v1/tones/{tone_id}` - Update custom tone (own tones only)
- `DELETE /api/v1/tones/{tone_id}` - Delete custom tone (own tones only)

## Database Configuration

Set these environment variables in your `.env` file:

```env
# Local PostgreSQL Database
DATABASE_URL=postgresql://username:password@localhost:5432/humanreplies
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=humanreplies
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
```

## Troubleshooting

### Common Issues

1. **Connection refused**: Make sure PostgreSQL is running
2. **Database doesn't exist**: Run `setup_db_complete.py` first
3. **Permission denied**: Check database user permissions
4. **Migration errors**: Check database connection and user permissions

### Checking Database Status

```bash
# Test connection
python test_db_connection.py

# Check what's in the database
psql -h localhost -U postgres -d humanreplies -c "\\dt"

# See user settings structure
psql -h localhost -U postgres -d humanreplies -c "\\d user_settings"
```

## Development Workflow

1. **New Project**:

   ```bash
   python setup_db_complete.py
   python run.py
   ```

2. **Existing Project**:

   ```bash
   python run_migrations.py
   python run.py
   ```

3. **Add New Features**:
   - Update `models.py`
   - Create migration file
   - Run `python run_migrations.py`

## Schema Changes

### User Settings Table

```sql
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    writing_style TEXT,
    guardian_text TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Updated Tones Table

```sql
ALTER TABLE tones
ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- System presets: is_preset=true, user_id=null
-- User custom: is_preset=false, user_id=<user_uuid>
```

## Backup and Restore

### Backup

```bash
pg_dump -h localhost -U postgres humanreplies > backup.sql
```

### Restore

```bash
psql -h localhost -U postgres -d humanreplies < backup.sql
```
