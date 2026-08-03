import json
import subprocess
import zipfile


def get_files_to_zip():
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        capture_output=True,
        text=True,
        check=True,
    )
    all_files = result.stdout.splitlines()

    exclude_prefixes = (
        "notes/",
        "tests/",
        ".vscode/",
        ".inspiration/",
        ".ideas/",
        ".git",
    )
    exclude_files = {
        ".gitignore",
        ".prettierrc",
        ".editorconfig",
        "zip.py",
        "zip_firefox.py",
        "package.json",
        "package-lock.json",
        "jsdoc.json",
        "README.md",
    }

    return [
        f
        for f in all_files
        if f not in exclude_files
        and not f.endswith(".md")
        and not f.startswith(".eslint")
        and not f.startswith(".prettier")
        and not f.replace("\\", "/").startswith(exclude_prefixes)
    ]


def zip_for_chrome(files):
    with open("manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)

    manifest.pop("browser_specific_settings", None)
    manifest.pop("data_collection_permissions", None)
    manifest["background"] = {"service_worker": "background/background.js"}

    with zipfile.ZipFile(
        "TimeDash-chrome.zip", "w", zipfile.ZIP_DEFLATED, compresslevel=2
    ) as zf:
        for f in files:
            if f == "manifest.json":
                zf.writestr("manifest.json", json.dumps(manifest, indent=4))
            else:
                zf.write(f)

    print("Successfully generated TimeDash-chrome.zip")


def zip_for_firefox(files):
    with open("manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)

    manifest["browser_specific_settings"] = {
        "gecko": {
            "id": "timedash@timedash.app",
            "strict_min_version": "126.0",
            "data_collection_permissions": {
                "required": ["none"]
            }
        }
    }

    manifest.pop("data_collection_permissions", None)

    manifest["background"] = {
        "scripts": [
            "utils/storage/defaults.js",
            "utils/storage/settings.js",
            "utils/storage/usage.js",
            "utils/storage/blocking.js",
            "utils/storage/misc.js",
            "utils/storage.js",
            "utils/storage/migration-engine.js",
            "utils/time-utils.js",
            "utils/domain-utils.js",
            "core/rules/site-rule.js",
            "core/rules/blocked-rule.js",
            "core/rules/restricted-rule.js",
            "core/rules/group-rule.js",
            "core/rules/rule-manager.js",
            "background/core/messaging.js",
            "background/core/tracking.js",
            "background/core/data.js",
            "background/alarm-manager/scheduling.js",
            "background/alarm-manager/handlers.js",
            "background/alarm-manager/notifications.js",
            "background/alarm-manager/maintenance.js",
            "background/alarm-manager.js",
            "background/modules/tab-tracker.js",
            "background/modules/video-service.js",
            "background/background.js",
        ]
    }

    with zipfile.ZipFile(
        "TimeDash-FF.zip", "w", zipfile.ZIP_DEFLATED, compresslevel=2
    ) as zf:
        for f in files:
            if f == "manifest.json":
                zf.writestr("manifest.json", json.dumps(manifest, indent=4))
            else:
                zf.write(f)

    print("Successfully generated TimeDash-FF.zip")


if __name__ == "__main__":
    files = get_files_to_zip()
    zip_for_chrome(files)
    zip_for_firefox(files)
