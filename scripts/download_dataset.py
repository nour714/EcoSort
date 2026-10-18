# -*- coding: utf-8 -*-
"""
Download original TrashNet dataset and extract test split into samples/
"""
import os
import sys
import zipfile
import urllib.request
import random
import shutil

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
SAMPLES_DIR = os.path.join(os.path.dirname(__file__), '..', 'samples')
DATASET_URL = 'https://raw.githubusercontent.com/garythung/trashnet/master/data/dataset-resized.zip'
ZIP_PATH = os.path.join(DATA_DIR, 'dataset-resized.zip')
EXTRACTED_DIR = os.path.join(DATA_DIR, 'dataset-resized')

def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(SAMPLES_DIR, exist_ok=True)

    if not os.path.exists(ZIP_PATH) and not os.path.exists(EXTRACTED_DIR):
        print(f"Downloading TrashNet from {DATASET_URL}...")
        urllib.request.urlretrieve(DATASET_URL, ZIP_PATH)
        print("Download complete.")

    if not os.path.exists(EXTRACTED_DIR):
        print("Extracting dataset...")
        with zipfile.ZipFile(ZIP_PATH, 'r') as z:
            z.extractall(DATA_DIR)
        print("Extraction complete.")

    # Find the class folders
    subdirs = [d for d in os.listdir(EXTRACTED_DIR) if os.path.isdir(os.path.join(EXTRACTED_DIR, d))]
    print(f"Found classes in dataset: {subdirs}")

    # Set seed for reproducible split
    random.seed(42)
    classes = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']

    # For each class, put 50 test samples into samples/<class>/
    for cls in classes:
        src_cls_dir = os.path.join(EXTRACTED_DIR, cls)
        dst_cls_dir = os.path.join(SAMPLES_DIR, cls)
        os.makedirs(dst_cls_dir, exist_ok=True)

        if not os.path.exists(src_cls_dir):
            print(f"Warning: {src_cls_dir} does not exist")
            continue

        images = [f for f in os.listdir(src_cls_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        images.sort()
        random.shuffle(images)

        # Select 50 images for evaluation
        test_images = images[:50]
        for img_name in test_images:
            shutil.copy2(os.path.join(src_cls_dir, img_name), os.path.join(dst_cls_dir, img_name))

        print(f"Copied {len(test_images)} test samples to {dst_cls_dir}")

    print("TrashNet test samples setup finished successfully!")

if __name__ == '__main__':
    main()
