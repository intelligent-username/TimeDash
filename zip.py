"""
For creating the final, publish-ready zip file for the web store
"""

import subprocess
import zipfile
import os

# Get all files not ignored by .gitignore (tracked + untracked, excluding ignored)
result = subprocess.run(
    ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
    capture_output=True, text=True, check=True
)
files = result.stdout.splitlines()

# Exclude .gitignore itself
files = [f for f in files if os.path.basename(f) != ".gitignore"]

with zipfile.ZipFile("TimeDash.zip", "w", zipfile.ZIP_DEFLATED, compresslevel=2) as zf:
    for f in files:
        zf.write(f)
