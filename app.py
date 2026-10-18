# -*- coding: utf-8 -*-
"""
EcoSort - Smart Waste Sorting & Route Retrieval System (Kafrelsheikh University)
Backend API Server powered by Python & Flask
Integrates deep learning garbage classification (.keras model)
"""

import os
import sys
import io
import time
import base64
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import numpy as np
from PIL import Image

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('EcoSortBackend')

# Disable oneDNN warning noise if desired
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)  # Enable Cross-Origin Resource Sharing for frontend client

# ---------------------------------------------------------
# Deep Learning Model Configuration
# ---------------------------------------------------------
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.keras')
INPUT_SIZE = (224, 224)

# Classes corresponding to model outputs (alphabetical TrashNet standard)
CLASS_NAMES = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']

# Rich Environmental & Recycling Knowledge Base (Information Retrieval - IR)
WASTE_KNOWLEDGE_BASE = {
    'cardboard': {
        'material': 'Cardboard',
        'material_name_ar': 'صندوق كرتون وأوراق تغليف',
        'material_name_en': 'Cardboard & Corrugated Box',
        'resin_code': '20 - PAP',
        'target_bin': 'paper',
        'bin_name_ar': 'الحاوية الزرقاء (ورق وكرتون)',
        'bin_name_en': 'Blue Bin (Paper & Cardboard)',
        'bin_color': '#2563eb',
        'co2_saved_grams': 140,
        'energy_saved': 'توفير 40% من الطاقة المستهلكة في صناعة الورق والكرتون الجديد.',
        'energy_saved_en': 'Saves 40% of energy required to manufacture virgin cardboard.',
        'water_saved_liters': 7.5,
        'guide': [
            'تفريغ الصندوق الكرتوني تماماً من أي شرائط لاصقة أو أكياس بلاستيكية داخلية.',
            'تفكيك الصندوق وطيه ليصبح مسطحاً لتوفير مساحة استيعابية داخل الحاوية.',
            'التأكد من جفاف الكرتون وعدم تلوثه بزيوت الأطعمة أو السوائل.',
            'إلقاؤه في الحاوية الزرقاء المخصصة للأوراق والكرتون.'
        ],
        'guide_en': [
            'Empty the box completely of any internal plastic wraps or tape.',
            'Flatten the box to maximize space utilization in the recycling bin.',
            'Ensure the cardboard is dry and free of greasy food residues.',
            'Deposit into the blue designated paper & cardboard bin.'
        ],
        'texture_description_ar': 'سطح ليفي مموج، بنية خلوية متعددة الطبقات، خفيف الوزن وقابل للطي.',
        'texture_description_en': 'Fibrous corrugated surface, multilayer structure, lightweight and foldable.'
    },
    'glass': {
        'material': 'Glass',
        'material_name_ar': 'زجاجات وعبوات زجاجية',
        'material_name_en': 'Glass Bottle / Container',
        'resin_code': '70 - GL',
        'target_bin': 'glass',
        'bin_name_ar': 'الحاوية الخضراء (زجاج)',
        'bin_name_en': 'Green Bin (Glass)',
        'bin_color': '#10b981',
        'co2_saved_grams': 110,
        'energy_saved': 'توفير 30% من طاقة أفران الصهر وتجنب انبعاثات غازات الاحتباس الحراري.',
        'energy_saved_en': 'Saves 30% furnace melting energy and cuts GHG emissions.',
        'water_saved_liters': 1.5,
        'guide': [
            'شطف العبوة الزجاجية سريعاً بالماء لإزالة أي بقايا سوائل أو مواد سكرية.',
            'نزع الأغطية المعدنية أو البلاستيكية وحفظها للحاويات المخصصة لها.',
            'عدم كسر الزجاج داخل الحاوية حرصاً على سلامة عمال النظافة والفرز.',
            'وضع العبوة بحرص داخل الحاوية الخضراء المخصصة للزجاج.'
        ],
        'guide_en': [
            'Rinse the glass bottle quickly to clear residue and sugars.',
            'Remove metallic or plastic caps and sort them separately.',
            'Do not break or shatter glass to protect maintenance workers.',
            'Carefully place into the green glass bin.'
        ],
        'texture_description_ar': 'سطح أملس شديد الصلابة، بارد الملمس، نفاذية ضوئية عالية ومقاومة للخدش.',
        'texture_description_en': 'Smooth, rigid, cool surface with high optical clarity and scratch resistance.'
    },
    'metal': {
        'material': 'Metal',
        'material_name_ar': 'علبة كانز ألومنيوم ومعادن',
        'material_name_en': 'Aluminum Can & Metals',
        'resin_code': '41 - ALU',
        'target_bin': 'metal',
        'bin_name_ar': 'الحاوية الرمادية/الزرقاء (معادن وكانز)',
        'bin_name_en': 'Metal & Cans Bin',
        'bin_color': '#64748b',
        'co2_saved_grams': 175,
        'energy_saved': 'توفير 95% من الطاقة الكهربائية الهائلة اللازمة لاستخلاص الألومنيوم الجديد!',
        'energy_saved_en': 'Saves 95% of electrical energy required for virgin bauxite smelting!',
        'water_saved_liters': 5.2,
        'guide': [
            'التأكد التام من تفريغ كافة السوائل والعصائر من داخل العلبة.',
            'شطف العلبة سريعاً لمنع جذب الحشرات وانبعاث الروائح في نقاط التجميع.',
            'سحق العلبة عمودياً أو أفقياً لتقليص حجمها بنسبة 80% وتسهيل النقل.',
            'ترك لسان الفتح (Tab) ملتصقاً بالعلبة ولا تفصله حتى لا يضيع أثناء الفرز.'
        ],
        'guide_en': [
            'Completely empty all liquid contents from the can.',
            'Rinse briefly to avoid insects and odor in collection points.',
            'Crush the can to reduce volume by 80% and optimize space.',
            'Keep opening tab attached to the can to prevent separation during magnetic sorting.'
        ],
        'texture_description_ar': 'معدني بارد، أسطواني رفيع، خفيف الوزن مع رنين صوتي مميز عند النقر.',
        'texture_description_en': 'Cold metallic finish, thin cylindrical wall, lightweight with resonant chime.'
    },
    'paper': {
        'material': 'Paper',
        'material_name_ar': 'أوراق ومستندات دراسية',
        'material_name_en': 'Study Paper & Documents',
        'resin_code': '22 - PAP',
        'target_bin': 'paper',
        'bin_name_ar': 'الحاوية الزرقاء (أوراق)',
        'bin_name_en': 'Blue Bin (Paper)',
        'bin_color': '#3b82f6',
        'co2_saved_grams': 95,
        'energy_saved': 'إنقاذ شجرة كاملة وتوفير 2.5 كيلووات/ساعة لكل 54 كجم ورق معاد تدويره.',
        'energy_saved_en': 'Saves 1 full tree and 2.5 kWh per 54 kg of recycled paper.',
        'water_saved_liters': 3.2,
        'guide': [
            'إزالة الدبابيس والمشابك المعدنية إن وجدت قبل التخلص من الأوراق.',
            'التأكد من عدم وجود أوراق شمعية أو فواتير حرارية غير قابلة للتدوير.',
            'تجميع الأوراق في حزم متراصة لسهولة النقل ومنع تطايرها.',
            'وضع الأوراق جافة تماماً داخل الحاوية الزرقاء.'
        ],
        'guide_en': [
            'Remove metallic staples or paperclips if present.',
            'Ensure no thermal receipts or wax-coated papers are mixed in.',
            'Stack sheets neatly to facilitate compact collection.',
            'Deposit completely dry in the blue paper bin.'
        ],
        'texture_description_ar': 'سطح ورقي ناعم، مسامي، مرن وخفيف الوزن، سهل الطي والتمزيق.',
        'texture_description_en': 'Soft, fibrous, porous paper texture, lightweight and easy to fold.'
    },
    'plastic': {
        'material': 'PET_Plastic',
        'material_name_ar': 'زجاجة بلاستيك شفافة (PET)',
        'material_name_en': 'Transparent Plastic Bottle (PET)',
        'resin_code': '1 - PETE',
        'target_bin': 'plastic',
        'bin_name_ar': 'الحاوية الصفراء (بلاستيك)',
        'bin_name_en': 'Yellow Bin (Plastic)',
        'bin_color': '#eab308',
        'co2_saved_grams': 85,
        'energy_saved': 'توفير طاقة تشغيل مصباح LED بقوة 15 وات لمدة 3 ساعات ونصف.',
        'energy_saved_en': 'Powers a 15W LED lamp for 3.5 hours continuously.',
        'water_saved_liters': 2.8,
        'guide': [
            'تفريغ أي سوائل متبقية وشطف العبوة بالماء سريعاً.',
            'نزع الغطاء البلاستيكي وحلقة العنق لفرزهما كخامة HDPE مستقلة.',
            'ضغط الزجاجة بقبضة اليد لتفريغ الهواء وتقليص حجمها بنسبة 70%.',
            'إلقاء الزجاجة في الحاوية الصفراء المخصصة للبلاستيك.'
        ],
        'guide_en': [
            'Empty any residual liquids and rinse briefly with water.',
            'Remove plastic cap and collar ring for separate sorting.',
            'Crush the bottle with your hand to deflate and reduce volume by 70%.',
            'Toss into the yellow designated plastic bin.'
        ],
        'texture_description_ar': 'سطح أملس شديد الشفافية، مرونة جيدة، قاع مقعر مع نقطة حقن دائرية مميزة.',
        'texture_description_en': 'Smooth, highly transparent surface, good elasticity with molded circular base.'
    },
    'trash': {
        'material': 'Mixed_Trash',
        'material_name_ar': 'مخلفات عامة ومختلطة',
        'material_name_en': 'General Non-Recyclable Trash',
        'resin_code': 'General Waste',
        'target_bin': 'trash',
        'bin_name_ar': 'الحاوية الرمادية (مخلفات عامة)',
        'bin_name_en': 'Grey Bin (General Waste)',
        'bin_color': '#475569',
        'co2_saved_grams': 15,
        'energy_saved': 'تحويل المخلفات للمدفن الصحي الآمن لمنع انبعاث غاز الميثان في الجو.',
        'energy_saved_en': 'Diverts non-recyclables to controlled sanitary containment.',
        'water_saved_liters': 0.5,
        'guide': [
            'وضع المخلفات داخل كيس محكم الإغلاق قبل رميها.',
            'التأكد من خلوها من أي بطاريات تالفة أو مخلفات كيميائية أو إلكترونية خطرة.',
            'إلقاؤها في حاوية المخلفات العامة غير القابلة للتدوير.'
        ],
        'guide_en': [
            'Seal waste tightly inside a trash bag.',
            'Ensure no dead batteries, electronics, or hazardous chemicals are enclosed.',
            'Dispose in the grey general waste bin.'
        ],
        'texture_description_ar': 'مخلفات غير متجانسة مركبة أو رطبة غير صالحة للتدوير الميكانيكي المباشر.',
        'texture_description_en': 'Heterogeneous composite or contaminated refuse unsuitable for direct recycling.'
    }
}

# ---------------------------------------------------------
# Load TensorFlow Keras Model Once at Startup
# ---------------------------------------------------------
model = None
try:
    if os.path.exists(MODEL_PATH):
        logger.info(f"Loading Keras model from: {MODEL_PATH}")
        import tensorflow as tf
        model = tf.keras.models.load_model(MODEL_PATH)
        logger.info(f"Keras model successfully loaded! Input shape: {model.input_shape}, Output shape: {model.output_shape}")
    else:
        logger.warning(f"Model file not found at {MODEL_PATH}")
except Exception as ex:
    logger.error(f"Failed to load Keras model: {ex}", exc_info=True)


def preprocess_image(image_bytes: bytes, target_size=(224, 224)) -> np.ndarray:
    """
    Preprocess raw image bytes for deep learning inference:
    1. Read via PIL and convert to 3-channel RGB.
    2. Resize to 224x224 using Bilinear interpolation.
    3. Normalize pixel intensities to [0, 1] (divide by 255.0).
    4. Expand dimensions to (1, 224, 224, 3) as expected by CNN.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    img = img.resize(target_size, Image.Resampling.BILINEAR)
    img_array = np.array(img, dtype=np.float32)
    # Normalize
    img_array = img_array / 255.0
    # Batch dimension
    img_batch = np.expand_dims(img_array, axis=0)
    return img_batch


# ---------------------------------------------------------
# Flask Routes
# ---------------------------------------------------------

@app.route('/')
def index():
    """Render the main EcoSort single-page interface."""
    return render_template('index.html')


@app.route('/health', methods=['GET'])
def health_check():
    """System health check and model diagnostics endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'EcoSort AI Backend',
        'model_loaded': model is not None,
        'classes': CLASS_NAMES,
        'timestamp': time.time()
    })


@app.route('/predict', methods=['POST'])
def predict_waste():
    """
    Main AI prediction endpoint.
    Receives an image (via multipart form-data 'file'/'image' or JSON base64 'image'),
    preprocesses it, runs inference on the trained .keras model,
    and returns comprehensive environmental and recycling data.
    """
    start_time = time.time()
    
    # 1. Extract image bytes from request
    image_bytes = None
    
    if 'file' in request.files:
        image_bytes = request.files['file'].read()
    elif 'image' in request.files:
        image_bytes = request.files['image'].read()
    elif request.is_json and request.json and 'image' in request.json:
        data_uri = request.json['image']
        if ',' in data_uri:
            data_uri = data_uri.split(',', 1)[1]
        try:
            image_bytes = base64.b64decode(data_uri)
        except Exception as e:
            return jsonify({'status': 'error', 'message': f'Invalid base64 image data: {str(e)}'}), 400
    
    if not image_bytes:
        return jsonify({
            'status': 'error',
            'message': 'No image provided. Please upload an image file using field "file" or "image", or send base64.'
        }), 400
    
    # 2. Check if model is loaded
    if model is None:
        return jsonify({
            'status': 'error',
            'message': 'AI Model is not loaded on the server. Please verify model.keras exists.'
        }), 503

    try:
        # 3. Preprocess image
        input_tensor = preprocess_image(image_bytes, target_size=INPUT_SIZE)

        # 4. Run model inference
        raw_predictions = model.predict(input_tensor, verbose=0)
        probabilities = raw_predictions[0]

        # 5. Extract predicted class and confidence
        predicted_idx = int(np.argmax(probabilities))
        raw_class_name = CLASS_NAMES[predicted_idx] if predicted_idx < len(CLASS_NAMES) else 'trash'
        confidence_pct = float(probabilities[predicted_idx] * 100.0)

        # 6. Retrieve environmental knowledge data
        info = WASTE_KNOWLEDGE_BASE.get(raw_class_name, WASTE_KNOWLEDGE_BASE['trash'])

        # Detailed probabilities dictionary for academic inspection
        all_probs = {
            CLASS_NAMES[i]: round(float(probabilities[i] * 100.0), 2)
            for i in range(len(CLASS_NAMES))
        }

        inference_time_ms = round((time.time() - start_time) * 1000.0, 2)

        response_data = {
            'status': 'success',
            'material': info['material'],
            'class_name': raw_class_name,
            'confidence': round(confidence_pct, 1),
            'confidence_formatted': f"{confidence_pct:.1f}%",
            'material_name_ar': info['material_name_ar'],
            'material_name_en': info['material_name_en'],
            'resin_code': info['resin_code'],
            'target_bin': info['target_bin'],
            'bin_name_ar': info['bin_name_ar'],
            'bin_name_en': info['bin_name_en'],
            'bin_color': info['bin_color'],
            'co2_saved_grams': info['co2_saved_grams'],
            'energy_saved': info['energy_saved'],
            'energy_saved_en': info['energy_saved_en'],
            'water_saved_liters': info['water_saved_liters'],
            'guide': info['guide'],
            'guide_ar': info['guide'],
            'guide_en': info['guide_en'],
            'texture_description_ar': info['texture_description_ar'],
            'texture_description_en': info['texture_description_en'],
            'all_probabilities': all_probs,
            'inference_time_ms': inference_time_ms
        }

        logger.info(f"Prediction: {raw_class_name} ({confidence_pct:.1f}%) in {inference_time_ms}ms")
        return jsonify(response_data)

    except Exception as ex:
        logger.error(f"Error during prediction pipeline: {ex}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': f'Prediction failed: {str(ex)}'
        }), 500


@app.route('/<path:filename>')
def serve_static_fallback(filename):
    """Fallback route to serve assets directly if requested without /static prefix."""
    static_file = os.path.join(app.static_folder, filename)
    if os.path.isfile(static_file):
        return send_from_directory(app.static_folder, filename)
    return "Not Found", 404


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    logger.info(f"Starting EcoSort server at http://localhost:{port}")
    # Run with use_reloader=False to avoid loading TensorFlow twice
    app.run(host=host, port=port, debug=False, use_reloader=False)
