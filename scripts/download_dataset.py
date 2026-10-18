# -*- coding: utf-8 -*-
"""
Download original TrashNet dataset into data/raw/ and extract 50 benchmark samples per class into data/benchmark/.
Note: 300 evaluation samples from the TrashNet distribution (training/test split
of the provided models/model.keras is unverified; results represent in-distribution
performance and may reflect optimistic upper bounds).
"""
import os
import zipfile
import urllib.request
import random
import shutil

RAW_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw')
BENCHMARK_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'benchmark')
DATASET_URL = 'https://raw.githubusercontent.com/garythung/trashnet/master/data/dataset-resized.zip'
ZIP_PATH = os.path.join(RAW_DIR, 'dataset-resized.zip')
EXTRACTED_DIR = os.path.join(RAW_DIR, 'dataset-resized')

def main():
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(BENCHMARK_DIR, exist_ok=True)

    if not os.path.exists(ZIP_PATH) and not os.path.exists(EXTRACTED_DIR):
        print(f"Downloading TrashNet from {DATASET_URL}...")
        urllib.request.urlretrieve(DATASET_URL, ZIP_PATH)
        print("Download complete.")

    if not os.path.exists(EXTRACTED_DIR):
        print("Extracting dataset...")
        with zipfile.ZipFile(ZIP_PATH, 'r') as z:
            z.extractall(RAW_DIR)
        print("Extraction complete.")

    # Find the class folders
    subdirs = [d for d in os.listdir(EXTRACTED_DIR) if os.path.isdir(os.path.join(EXTRACTED_DIR, d))]
    print(f"Found classes in dataset: {subdirs}")

    # Set seed for reproducible split
    random.seed(42)
    classes = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']

    # For each class, put 50 test samples into data/benchmark/<class>/
    for cls in classes:
        src_cls_dir = os.path.join(EXTRACTED_DIR, cls)
        dst_cls_dir = os.path.join(BENCHMARK_DIR, cls)
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
