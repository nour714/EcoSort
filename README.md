<div align="center">
<img src="https://raw.githubusercontent.com/nour714/EcoSort/main/static/assets/images/logo.png" alt="EcoSort Logo" width="110" />
​EcoSort
​Intelligent Waste Classification & Smart Campus Pathfinding System
​Live Demo
Python
Keras & LiteRT
License
​<p align="center">
<b>Faculty of Artificial Intelligence — Kafrelsheikh University</b><br/>
<i>Toward a greener campus environment and a more sustainable society</i>
</p>
</div>
​Overview
​EcoSort is an end-to-end web platform that combines Computer Vision, Environmental Information Retrieval (IR), and Graph Pathfinding Algorithms to automate waste sorting and guide students and staff across Kafrelsheikh University to the nearest available (non-full) recycling receptacle.
​Users simply capture or upload a photo of a waste item using their phone or browser. EcoSort identifies the material class, displays safe recycling instructions along with measurable ecological savings, and renders the shortest walking route on an interactive campus map while automatically bypassing full bins.
​Key Features
​Instant AI Visual Recognition: Classifies waste items into 6 material streams (Cardboard, Glass, Metal, Paper, Plastic, and General Trash) using a fine-tuned MobileNetV2 deep learning model.
​Smart Pre-Inference Quality Checks: Validates image clarity and lighting on the client side before inference, prompting users to retake blurry or unclear captures to prevent misrouting.
​Interactive Campus Graph Navigation: Computes optimal pedestrian routes across 12 Kafrelsheikh University landmarks using Dijkstra's Algorithm, A* Search, and Merge Sort while dynamically filtering out full receptacles.
​Ecological Impact Calculator: Quantifies real-time environmental savings for each recycled item, including \text{CO}_2 emissions avoided, water conserved, and equivalent LED lighting hours saved.
​Bilingual User Experience: Seamless one-click switching between Arabic (RTL) and English (LTR) interfaces with full mobile and desktop responsiveness.
​How the System Works
