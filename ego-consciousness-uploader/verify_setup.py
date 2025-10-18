#!/usr/bin/env python3
"""
Verification script to check if all dependencies are properly installed
and the emotion recognition system is ready to use.
"""

import sys
import os

def check_python_version():
    """Check if Python version is compatible."""
    print("🐍 Checking Python version...")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"   ✅ Python {version.major}.{version.minor}.{version.micro} (Compatible)")
        return True
    else:
        print(f"   ❌ Python {version.major}.{version.minor}.{version.micro} (Need 3.8+)")
        return False

def check_dependencies():
    """Check if all required dependencies are installed."""
    print("\n📦 Checking dependencies...")
    
    dependencies = {
        'cv2': 'opencv-python',
        'deepface': 'deepface',
        'numpy': 'numpy',
        'websockets': 'websockets',
        'tensorflow': 'tensorflow',
    }
    
    all_installed = True
    
    for module, package in dependencies.items():
        try:
            __import__(module)
            print(f"   ✅ {package}")
        except ImportError:
            print(f"   ❌ {package} (Not installed)")
            all_installed = False
    
    return all_installed

def check_camera_access():
    """Check if camera is accessible."""
    print("\n📹 Checking camera access...")
    
    try:
        import cv2
        camera = cv2.VideoCapture(0)
        
        if camera.isOpened():
            # Try to read a frame
            ret, frame = camera.read()
            camera.release()
            
            if ret and frame is not None:
                print(f"   ✅ Camera accessible (Resolution: {frame.shape[1]}x{frame.shape[0]})")
                return True
            else:
                print("   ❌ Camera opened but failed to read frame")
                return False
        else:
            print("   ❌ Failed to open camera (Device 0)")
            print("      Make sure:")
            print("      - Camera is connected")
            print("      - No other app is using the camera")
            print("      - You have camera permissions")
            return False
            
    except Exception as e:
        print(f"   ❌ Camera check failed: {e}")
        return False

def check_deepface_models():
    """Check if DeepFace can load models."""
    print("\n🤖 Checking DeepFace models...")
    
    try:
        from deepface import DeepFace
        print("   ✅ DeepFace imported successfully")
        print("   ℹ️  Models will be downloaded on first use (~100MB)")
        return True
    except Exception as e:
        print(f"   ❌ DeepFace error: {e}")
        return False

def check_file_structure():
    """Check if required files exist."""
    print("\n📁 Checking file structure...")
    
    required_files = [
        'backend/emotion_recognizer.py',
        'start_emotion_recognition.py',
        'frontend/test-emotion.html',
        'frontend/app.js',
        'requirements.txt',
    ]
    
    all_exist = True
    
    for file_path in required_files:
        if os.path.exists(file_path):
            # Check if file is not empty
            size = os.path.getsize(file_path)
            if size > 0:
                print(f"   ✅ {file_path} ({size} bytes)")
            else:
                print(f"   ⚠️  {file_path} (Empty file!)")
                all_exist = False
        else:
            print(f"   ❌ {file_path} (Not found)")
            all_exist = False
    
    return all_exist

def main():
    """Run all verification checks."""
    print("=" * 60)
    print("🎭 EMOTION RECOGNITION SYSTEM - VERIFICATION")
    print("=" * 60)
    
    checks = {
        'Python Version': check_python_version(),
        'Dependencies': check_dependencies(),
        'File Structure': check_file_structure(),
        'Camera Access': check_camera_access(),
        'DeepFace': check_deepface_models(),
    }
    
    print("\n" + "=" * 60)
    print("📊 VERIFICATION SUMMARY")
    print("=" * 60)
    
    for check_name, result in checks.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{check_name:.<40} {status}")
    
    all_passed = all(checks.values())
    
    print("=" * 60)
    
    if all_passed:
        print("🎉 ALL CHECKS PASSED!")
        print("\n✨ Your emotion recognition system is ready to use!")
        print("\n🚀 Quick Start:")
        print("   1. Run: ./test_emotion_only.sh")
        print("   2. Open: frontend/test-emotion.html in browser")
        print("   3. Click 'Start Camera' and test emotions!")
        return 0
    else:
        print("⚠️  SOME CHECKS FAILED")
        print("\n🔧 To fix:")
        
        if not checks['Dependencies']:
            print("   - Install dependencies: pip install -r requirements.txt")
        
        if not checks['Camera Access']:
            print("   - Check camera connection and permissions")
            print("   - Close other apps using the camera")
        
        if not checks['File Structure']:
            print("   - Ensure all files are present and not empty")
        
        print("\n💡 After fixing issues, run this script again to verify.")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n👋 Verification cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)

