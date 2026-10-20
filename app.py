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
from ecosort.rate_limiter import RateLimiter, get_client_ip

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('EcoSortApp')

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['MAX_CONTENT_LENGTH'] = Config.MAX_CONTENT_LENGTH
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Basic rate limiter: 30 requests per minute per IP
rate_limiter = RateLimiter(max_requests=30, window_seconds=60)

# Configure CORS
if Config.CORS_ORIGINS == '*':
    CORS(app)
else:
    origins = [orig.strip() for orig in Config.CORS_ORIGINS.split(',')]
    CORS(app, origins=origins)

# Security Headers Middleware
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(self), geolocation=(), microphone=()'
    return response

# Initialize deep learning engine singleton
engine = ModelEngine.get_instance()


# ---------------------------------------------------------
# Error Handlers
# ---------------------------------------------------------

@app.errorhandler(400)
def bad_request(error):
    msg = getattr(error, 'description', None) or 'طلب غير صالح.'
    return jsonify({
        'status': 'error',
        'code': 400,
        'message': str(msg)
    }), 400

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        'status': 'error',
        'code': 413,
        'message': 'حجم الملف المرفوع يتجاوز الحد الأقصى المسموح به (4 ميجابايت).'
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


@app.route('/robots.txt')
def robots():
    """Serve robots.txt for search crawlers."""
    return send_from_directory(app.static_folder, 'robots.txt')


@app.route('/sitemap.xml')
def sitemap():
    """Serve sitemap.xml for search engine indexing."""
    return send_from_directory(app.static_folder, 'sitemap.xml', mimetype='application/xml')



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
    # 0. Basic Rate Limiting
    client_ip = get_client_ip(request)
    allowed, retry_after = rate_limiter.is_allowed(client_ip)
    if not allowed:
        return jsonify({
            'status': 'error',
            'message': 'تم تجاوز معدل الطلبات المسموح به. يرجى الانتظار قليلاً ثم إعادة المحاولة.'
        }), 429, {'Retry-After': str(retry_after)}

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
        except Exception:
            return jsonify({'status': 'error', 'message': 'بيانات Base64 غير صالحة. يرجى إرسال تنسيق تشفير صالح.'}), 400

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
        return jsonify({'status': 'error', 'message': str(e) or 'الملف المرفوع ليس ملف صورة صالح.'}), 400
    except RuntimeError as e:
        logger.error(f"Inference runtime error: {e}")
        return jsonify({'status': 'error', 'message': 'خدمة الاستدلال بالذكاء الاصطناعي غير متاحة حالياً. يرجى المحاولة لاحقاً.'}), 503
    except Exception as e:
        logger.error(f"Prediction failed: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'حدث خطأ داخلي أثناء معالجة الصورة. يرجى المحاولة لاحقاً.'}), 500


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
