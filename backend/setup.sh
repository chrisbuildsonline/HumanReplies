#!/bin/bash

# HumanReplies Backend Setup Script
echo "🚀 Setting up HumanReplies Backend..."

# Check if Python is available
if ! command -v python &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.9+ first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python -m venv .venv
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source .venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please create it with your Supabase credentials."
    echo "   See .env.example for reference."
else
    echo "✅ .env file found"
fi

# Setup database
echo "🗄️  Setting up database..."
python setup_db.py

echo "✅ Setup complete!"
echo ""
echo "To start the backend server:"
echo "  source .venv/bin/activate"
echo "  python run.py"
echo ""
echo "API will be available at: http://localhost:8000"
echo "API docs at: http://localhost:8000/docs"