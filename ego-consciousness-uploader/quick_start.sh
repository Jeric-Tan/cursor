#!/bin/bash

# Quick Start Script for Ego Calibration
# This script sets up the environment and runs the calibration process

echo "🚀 Ego Calibration - Quick Start"
echo "================================="

# Check if we're in the right directory
if [ ! -f "run_calibration.py" ]; then
    echo "❌ Error: Please run this script from the ego-consciousness-uploader directory"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Error: Virtual environment not found"
    echo "Please run setup first:"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    exit 1
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Please create a .env file with your API keys:"
    echo "  GEMINI_API_KEY=your_gemini_api_key_here"
    echo "  FAL_KEY=your_fal_api_key_here"
    echo ""
    echo "Get your API keys from:"
    echo "  Gemini: https://makersuite.google.com/app/apikey"
    echo "  FAL.AI: https://fal.ai/"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting. Please set up your API keys first."
        exit 1
    fi
fi

# Check if API keys are set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  Warning: GEMINI_API_KEY not found in environment"
    echo "The script will check for API keys in the .env file"
fi

# Run the calibration
echo "🎭 Starting Ego Calibration Process..."
echo "======================================"
echo ""

python3 run_calibration.py

echo ""
echo "🎉 Quick start completed!"
echo "Check the generated files in the current directory."
