#!/usr/bin/env python3
"""
Avatar Runner CLI
Simple wrapper to run avatar generation from Node.js
"""

import sys
import json
import os
from pathlib import Path

# Add the current directory to Python path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from avatar_service import AvatarService


def main():
    """Main CLI function."""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Session ID required'
        }))
        sys.exit(1)
    
    session_id = sys.argv[1]
    photo_dir = f"../../data/photos/{session_id}"
    
    # Debug: Print current working directory and path
    print(f"DEBUG: Current working directory: {os.getcwd()}", file=sys.stderr)
    print(f"DEBUG: Looking for photos in: {photo_dir}", file=sys.stderr)
    print(f"DEBUG: Absolute path: {os.path.abspath(photo_dir)}", file=sys.stderr)
    print(f"DEBUG: Directory exists: {os.path.exists(photo_dir)}", file=sys.stderr)
    
    # Check if photo directory exists
    if not os.path.exists(photo_dir):
        print(json.dumps({
            'success': False,
            'error': f'Photo directory not found: {photo_dir} (cwd: {os.getcwd()})'
        }))
        sys.exit(1)
    
    try:
        # Initialize service
        service = AvatarService()
        
        # Generate avatars
        result = service.generate_avatars_for_session(session_id, photo_dir)
        
        # Output result as JSON
        print(json.dumps(result))
        
        # Exit with appropriate code
        sys.exit(0 if result.get('success', False) else 1)
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
