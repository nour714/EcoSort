# Campus Photos Dataset Directory

This directory is designated for real-world waste photos captured on the Kafrelsheikh University campus (cafeterias, faculty hallways, outdoor walkways, and disposal bins).

## Folder Structure

Place categorized JPEG or PNG images into the corresponding class subdirectories:
- `cardboard/`: Corrugated boxes, packaging cartons, food delivery boxes.
- `glass/`: Beverage bottles, glassware, broken glass containers.
- `metal/`: Soda cans, food tins, aluminum foil, metal bottle caps.
- `paper/`: Notebook pages, exam sheets, flyers, office printing paper.
- `plastic/`: Water bottles (PET), food containers (PP/HDPE), plastic cutlery.
- `trash/`: Non-recyclables, soiled napkins, wrappers, composite items.

## How to Evaluate Campus Photos

Once at least 20-50 real photos per class are deposited:
```bash
python scripts/evaluate.py --data data/campus_photos --output-dir docs/metrics/campus_benchmark
```

## Domain Shift & Accuracy Expectations

1. **TrashNet In-Distribution Baseline:** 81.67% accuracy was measured on clean, centrally placed items against clean, uniform white backgrounds.
2. **Real-World Domain Shift:** Real campus photos feature varied ambient lighting (harsh sunlight, dim fluorescent corridors), textured backgrounds (tile, concrete, desks), non-canonical angles, and occlusions.
3. **Expected Performance Drop:** Based on computer vision domain-shift literature in waste classification, an accuracy drop of **15 to 30 percentage points** is typical when evaluating a clean-background CNN on in-the-wild mobile photos.
4. **Mitigation Strategy:** EcoSort's confidence gating mechanism (`confident` vs `uncertain` vs `rejected`) is engineered specifically to catch uncertain predictions and prompt user verification or bin manual selection before routing.
