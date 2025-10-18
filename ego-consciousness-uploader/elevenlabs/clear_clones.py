#!/usr/bin/env python3
"""
Clear all voice clones from the database.
Useful when switching between test mode and real mode.
"""

import sqlite3
import os

def clear_voice_clones():
    """Delete all voice clones from the database"""
    db_path = os.path.join(os.path.dirname(__file__), "voice_clones.db")
    
    if not os.path.exists(db_path):
        print("❌ Database not found")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get count before deleting
        cursor.execute("SELECT COUNT(*) FROM voice_clones")
        count = cursor.fetchone()[0]
        
        if count == 0:
            print("ℹ️  No voice clones to delete")
            conn.close()
            return
        
        # Delete all clones
        cursor.execute("DELETE FROM voice_clones")
        conn.commit()
        
        print(f"✅ Deleted {count} voice clone(s)")
        print("💡 Tip: Now create a new clone with your current test mode setting")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🗑️  Clearing all voice clones...")
    clear_voice_clones()

