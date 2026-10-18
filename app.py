# -*- coding: utf-8 -*-
"""
EcoSort - Smart Waste Sorting & Route Retrieval System (Kafrelsheikh University)
Backend Flask Application Server
"""
import os
import base64
import logging
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS

from ecosort.config import Config
from ecosort.preprocess import InvalidImageError
from ecosort.inference import ModelEngine

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('EcoSortApp')

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['MAX_CONTENT_LENGTH'] = Config.MAX_CONTENT_LENGTH

# Configure CORS
if Config.CORS_ORIGINS == '*':
    CORS(app)
else:
    origins = [orig.strip() for orig in Config.CORS_ORIGINS.split(',')]
    CORS(app, origins=origins)

# Initialize deep learning engine singleton
engine = ModelEngine.get_instance()


# ---------------------------------------------------------
# Error Handlers
# ---------------------------------------------------------

@app.errorhandler(400)
def bad_request(error):
    return jsonify({
        'status': 'error',
        'code': 400,
        'message': str(error.description if hasattr(error, 'description') else error)
    }), 400

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'status': 'error',
        'code': 413,
        'message': 'حجم الملف المرفوع يتجاوز الحد الأقصى المسموح به (10 ميجابايت).'
    }), 413

@app.errorhandler(500)
def internal_server_error(error):
    logger.error(f"Internal server error: {error}", exc_info=True)
    return jsonify({
        'status': 'error',
        'code': 500,
        'message': 'حدث خطأ غير متوقع في الخادم. يرجى المحاولة مرة أخرى.'
    }), 500


# ---------------------------------------------------------
# Routes
# ---------------------------------------------------------

@app.route('/')
def index():
    """Render the main EcoSort single-page interface."""
    return render_template('index.html')


@app.route('/health', methods=['GET'])
def health():
    """Health check and model status diagnostics endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'EcoSort AI Backend',
        'model_loaded': engine.model is not None,
        'classes': Config.CLASS_NAMES,
        'config': {
            'norm_mode': Config.NORM_MODE,
            'resize_mode': Config.RESIZE_MODE,
            'conf_high': Config.CONF_HIGH,
            'conf_low': Config.CONF_LOW,
            'margin_min': Config.MARGIN_MIN,
            'tta_enabled': Config.TTA_ENABLED
        }
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Main waste prediction endpoint.
    Receives image via multipart/form-data ('file' or 'image') or JSON Base64 ('image').
    Returns classification, confidence gating decision, top-3 candidates, quality warnings,
    and environmental guidance.
    """
    image_bytes = None

    # 1. Extract raw bytes from request
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'لم يتم تحديد أي ملف للرفع.'}), 400
        image_bytes = file.read()
    elif 'image' in request.files:
        file = request.files['image']
        if file.filename == '':
            return jsonify({'status': 'error', 'message': 'لم يتم تحديد أي ملف للرفع.'}), 400
        image_bytes = file.read()
    elif request.is_json and request.json and 'image' in request.json:
        data_uri = request.json['image']
        if ',' in data_uri:
            data_uri = data_uri.split(',', 1)[1]
        try:
            image_bytes = base64.b64decode(data_uri)
        except Exception as e:
            return jsonify({'status': 'error', 'message': f'بيانات Base64 غير صالحة: {str(e)}'}), 400

    if not image_bytes:
        return jsonify({
            'status': 'error',
            'message': 'لم يتم توفير صورة. يرجى إرسال الصورة عبر multipart form-data أو Base64.'
        }), 400

    # 2. Run inference & gating pipeline
    try:
        response_data = engine.predict(image_bytes)
        logger.info(f"Prediction: {response_data['class_name']} ({response_data['confidence']}%) - Decision: {response_data['decision']} in {response_data['inference_time_ms']}ms")
        return jsonify(response_data)

    except InvalidImageError as e:
        return jsonify({'status': 'error', 'message': str(e)}), 400
    except RuntimeError as e:
        logger.error(f"Inference runtime error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 503
    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': f'فشل فحص الصورة: {str(e)}'}), 500


@app.route('/<path:filename>')
def static_fallback(filename):
    """Fallback route to serve static assets directly if requested without /static prefix."""
    static_file = os.path.join(app.static_folder, filename)
    if os.path.isfile(static_file):
        return send_from_directory(app.static_folder, filename)
    return "Not Found", 404


if __name__ == '__main__':
    logger.info(f"Starting EcoSort server on http://{Config.HOST}:{Config.PORT}")
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG, use_reloader=False)
