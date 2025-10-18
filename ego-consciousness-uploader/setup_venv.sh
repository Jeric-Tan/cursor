#!/bin/bash

# Setup virtual environment for Python dependencies
echo "🐍 Setting up Python virtual environment for emotion recognition..."

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

echo "✅ Virtual environment setup complete!"
echo ""
echo "To activate the virtual environment manually:"
echo "source venv/bin/activate"
echo ""
echo "To deactivate:"
echo "deactivate"
