import os
import requests
from pathlib import Path

BASE_URL = "https://www.gutenberg.org/cache/epub"

# Root dataset folder
ROOT_DIR = "dataset"

# Number of test folders
TOTAL_FOLDERS = 100

# Starting number of files in first folder
START_FILES = 2

# Timeout for requests
TIMEOUT = 30

Path(ROOT_DIR).mkdir(exist_ok=True)

def download_txt_file(book_id, save_path):
    """
    Downloads pg{book_id}.txt from Project Gutenberg.
    Returns True if successful, False otherwise.
    """

    url = f"{BASE_URL}/{book_id}/pg{book_id}.txt"

    try:
        response = requests.get(url, timeout=TIMEOUT)

        if response.status_code == 200:
            with open(save_path, "wb") as f:
                f.write(response.content)

            print(f"[DOWNLOADED] {url}")
            return True

        else:
            print(f"[FAILED {response.status_code}] {url}")
            return False

    except Exception as e:
        print(f"[ERROR] {url} -> {e}")
        return False


current_book_id = 1

for folder_index in range(1, TOTAL_FOLDERS + 1):

    # Folder name
    folder_name = f"test_{folder_index}"

    # Folder path
    folder_path = os.path.join(ROOT_DIR, folder_name)

    # Create folder
    Path(folder_path).mkdir(exist_ok=True)

    # Number of files in this folder
    num_files = START_FILES + (folder_index - 1)

    print("\n" + "=" * 60)
    print(f"CREATING: {folder_name}")
    print(f"FILES NEEDED: {num_files}")
    print("=" * 60)

    files_downloaded = 0

    while files_downloaded < num_files:

        save_file_name = f"pg{current_book_id}.txt"
        save_path = os.path.join(folder_path, save_file_name)

        success = download_txt_file(current_book_id, save_path)

        # Only count successful downloads
        if success:
            files_downloaded += 1

        # Move to next Gutenberg ID
        current_book_id += 1

print("\nDATASET CREATION COMPLETED SUCCESSFULLY.")