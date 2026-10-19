# -*- coding: utf-8 -*-
"""
EcoSort - Vercel Serverless Function API Entrypoint
High-performance, robust serverless inference & environmental retrieval for Vercel.
"""
import os
import sys
import time
import json
import base64
import logging
import traceback
from pathlib import Path

# Catch any startup / import errors
STARTUP_ERROR = None

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    import numpy as np

    # Ensure api directory is in sys.path
    API_DIR = Path(__file__).resolve().parent
    ROOT_DIR = API_DIR.parent

    for p in [str(API_DIR), str(ROOT_DIR)]:
        if p not in sys.path:
            sys.path.insert(0, p)

    from ecosort.config import Config
    from ecosort.knowledge import WASTE_KNOWLEDGE_BASE
    from ecosort.preprocess import InvalidImageError, preprocess_image
    from ecosort.rate_limiter import RateLimiter, get_client_ip

    # Configure logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
    logger = logging.getLogger('EcoSortVercelAPI')

    flask_app = Flask(__name__)
    flask_app.url_map.strict_slashes = False
    flask_app.config['MAX_CONTENT_LENGTH'] = Config.MAX_CONTENT_LENGTH
    CORS(flask_app)

    class VercelPathFixer:
        """WSGI middleware to restore original request path when Vercel rewrites requests."""
        def __init__(self, wsgi_app):
            self.wsgi_app = wsgi_app

        def __call__(self, environ, start_response):
            matched_path = (
                environ.get('HTTP_X_VERCEL_MATCHED_PATH') or
                environ.get('HTTP_X_MATCHED_PATH') or
                environ.get('HTTP_X_FORWARDED_PATH') or
                environ.get('HTTP_X_REWRITE_URL')
            )
            if matched_path:
                clean_path = matched_path.split('?')[0]
                environ['PATH_INFO'] = clean_path
            return self.wsgi_app(environ, start_response)

    flask_app.wsgi_app = VercelPathFixer(flask_app.wsgi_app)

    # Basic rate limiter: 30 requests per minute per IP
    rate_limiter = RateLimiter(max_requests=30, window_seconds=60)

    @flask_app.errorhandler(413)
    def request_entity_too_large(error):
        return jsonify({
            'status': 'error',
            'code': 413,
            'message': 'حجم الملف المرفوع يتجاوز الحد الأقصى المسموح به (4 ميجابايت).'
        }), 413

    @flask_app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(self), geolocation=()'
        return response

    class EcoSortVercelEngine:
        _instance = None

        def __init__(self):
            self.interpreter = None
            self.input_index = None
            self.output_index = None
            self.class_names = Config.CLASS_NAMES
            self.load_model()

        @classmethod
        def get_instance(cls):
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

        def load_model(self):
            """Try loading LiteRT/TFLite interpreter safely."""
            try:
                from ai_edge_litert.interpreter import Interpreter
            except BaseException:
                try:
                    from tflite_runtime.interpreter import Interpreter
                except BaseException:
                    try:
                        from tensorflow.lite.python.interpreter import Interpreter
                    except BaseException:
                        Interpreter = None

            if not Interpreter:
                logger.warning("No LiteRT/TFLite runtime available.")
                self.interpreter = None
                return

            possible_paths = [
                API_DIR / "model.tflite",
                ROOT_DIR / "models" / "model.tflite",
                ROOT_DIR / "model.tflite"
            ]

            model_path = next((p for p in possible_paths if p.exists()), None)
            if not model_path:
                logger.warning(f"No model.tflite found at paths: {possible_paths}")
                self.interpreter = None
                return

            try:
                self.interpreter = Interpreter(model_path=str(model_path))
                self.interpreter.allocate_tensors()
                self.input_index = self.interpreter.get_input_details()[0]['index']
                self.output_index = self.interpreter.get_output_details()[0]['index']
                logger.info("LiteRT/TFLite model loaded successfully!")
            except BaseException as e:
                logger.warning(f"TFLite interpreter allocation warning: {e}")
                self.interpreter = None

        def predict(self, image_bytes: bytes, use_tta=False) -> dict:
            if self.interpreter is None:
                raise RuntimeError("EcoSort AI model interpreter is not available.")

            start_time = time.time()

            tensor_batch, quality_warnings = preprocess_image(
                image_bytes,
                target_size=Config.INPUT_SIZE,
                resize_mode=Config.RESIZE_MODE,
                norm_mode=Config.NORM_MODE
            )

            self.interpreter.set_tensor(self.input_index, tensor_batch)
            self.interpreter.invoke()
            raw_preds = self.interpreter.get_tensor(self.output_index)[0]
            model_label = "2.0.0 (LiteRT Neural Model)"

            probs = raw_preds.astype(float)
            sorted_indices = np.argsort(probs)[::-1]

            top1_idx = int(sorted_indices[0])
            top2_idx = int(sorted_indices[1]) if len(sorted_indices) > 1 else top1_idx

            top1_conf = round(float(probs[top1_idx] * 100.0), 1)
            top2_conf = round(float(probs[top2_idx] * 100.0), 1)
            margin = round(top1_conf - top2_conf, 1)

            predicted_class = self.class_names[top1_idx] if top1_idx < len(self.class_names) else 'trash'

            if "image_empty_or_flat" in quality_warnings or top1_conf < Config.CONF_LOW:
                decision = "rejected"
            elif top1_conf >= Config.CONF_HIGH and margin >= Config.MARGIN_MIN:
                decision = "confident"
            else:
                decision = "uncertain"

            top_k = [
                {
                    "class_name": self.class_names[idx],
                    "confidence": round(float(probs[idx] * 100.0), 1),
                    "confidence_formatted": f"{float(probs[idx] * 100.0):.1f}%",
                    "material_name_ar": WASTE_KNOWLEDGE_BASE.get(self.class_names[idx], {}).get("material_name_ar", self.class_names[idx]),
                    "material_name_en": WASTE_KNOWLEDGE_BASE.get(self.class_names[idx], {}).get("material_name_en", self.class_names[idx]),
                }
                for idx in sorted_indices[:3]
            ]

            info = WASTE_KNOWLEDGE_BASE.get(predicted_class, WASTE_KNOWLEDGE_BASE['trash'])

            all_probs = {
                self.class_names[i]: round(float(probs[i] * 100.0), 2)
                for i in range(len(self.class_names))
            }

            latency_ms = round((time.time() - start_time) * 1000.0, 2)

            return {
                "status": "success",
                "decision": decision,
                "class_name": predicted_class,
                "confidence": top1_conf,
                "confidence_formatted": f"{top1_conf:.1f}%",
                "margin": margin,
                "top_k": top_k,
                "quality_warnings": quality_warnings,
                "tta_used": use_tta,
                "model_version": model_label,
                "inference_time_ms": latency_ms,
                "material": info["material"],
                "material_name_ar": info["material_name_ar"],
                "material_name_en": info.get("material_name_en", ""),
                "resin_code": info.get("resin_code", ""),
                "target_bin": info["target_bin"],
                "bin_name_ar": info.get("bin_name_ar", ""),
                "bin_name_en": info.get("bin_name_en", ""),
                "bin_color": info.get("bin_color", ""),
                "co2_saved_grams": info.get("co2_saved_grams", 0),
                "energy_saved": info.get("energy_saved", ""),
                "energy_saved_en": info.get("energy_saved_en", ""),
                "water_saved_liters": info.get("water_saved_liters", 0),
                "guide": info.get("guide", []),
                "guide_en": info.get("guide_en", []),
                "texture_description_ar": info.get("texture_description_ar", ""),
                "texture_description_en": info.get("texture_description_en", ""),
                "all_probabilities": all_probs
            }

    engine = EcoSortVercelEngine.get_instance()

    @flask_app.route('/', methods=['GET', 'HEAD', 'OPTIONS'])
    @flask_app.route('/api', methods=['GET', 'HEAD', 'OPTIONS'])
    @flask_app.route('/api/', methods=['GET', 'HEAD', 'OPTIONS'])
    @flask_app.route('/api/index', methods=['GET', 'HEAD', 'OPTIONS'])
    @flask_app.route('/api/index.py', methods=['GET', 'HEAD', 'OPTIONS'])
    @flask_app.route('/health', methods=['GET', 'HEAD', 'OPTIONS'])
    @flask_app.route('/api/health', methods=['GET', 'HEAD', 'OPTIONS'])
    @flask_app.route('/api/index/health', methods=['GET', 'HEAD', 'OPTIONS'])
    @flask_app.route('/api/index.py/health', methods=['GET', 'HEAD', 'OPTIONS'])
    def health():
        if request.method == 'OPTIONS':
            return ('', 204)
        backend_url = os.environ.get('ECOSORT_BACKEND_URL') or os.environ.get('BACKEND_URL')
        model_loaded = (engine.interpreter is not None) or bool(backend_url)
        return jsonify({
            'status': 'healthy' if model_loaded else 'degraded',
            'service': 'EcoSort Vercel Serverless API',
            'model_loaded': model_loaded,
            'classes': Config.CLASS_NAMES,
            'backend_proxy_configured': bool(backend_url)
        })

    @flask_app.route('/predict', methods=['POST', 'OPTIONS'])
    @flask_app.route('/api/predict', methods=['POST', 'OPTIONS'])
    @flask_app.route('/api/index/predict', methods=['POST', 'OPTIONS'])
    @flask_app.route('/api/index.py/predict', methods=['POST', 'OPTIONS'])
    @flask_app.route('/api', methods=['POST', 'OPTIONS'])
    @flask_app.route('/api/', methods=['POST', 'OPTIONS'])
    @flask_app.route('/api/index', methods=['POST', 'OPTIONS'])
    @flask_app.route('/api/index.py', methods=['POST', 'OPTIONS'])
    @flask_app.route('/', methods=['POST', 'OPTIONS'])
    def predict():
        if request.method == 'OPTIONS':
            return ('', 204)
        # 0. Basic Rate Limiting
        client_ip = get_client_ip(request)
        allowed, retry_after = rate_limiter.is_allowed(client_ip)
        if not allowed:
            return jsonify({
                'status': 'error',
                'message': 'تم تجاوز معدل الطلبات المسموح به. يرجى الانتظار قليلاً ثم إعادة المحاولة.'
            }), 429, {'Retry-After': str(retry_after)}

        image_bytes = None

        if 'file' in request.files:
            f = request.files['file']
            if f.filename != '':
                image_bytes = f.read()
        elif 'image' in request.files:
            f = request.files['image']
            if f.filename != '':
                image_bytes = f.read()
        elif request.is_json and request.json and 'image' in request.json:
            data_uri = request.json['image']
            try:
                if ',' in data_uri:
                    data_uri = data_uri.split(',', 1)[1]
                image_bytes = base64.b64decode(data_uri)
            except Exception:
                return jsonify({'status': 'error', 'message': 'بيانات Base64 غير صالحة. يرجى إرسال تنسيق تشفير صالح.'}), 400

        if not image_bytes:
            return jsonify({
                'status': 'error',
                'message': 'لم يتم توفير صورة. يرجى إرسال الصورة عبر multipart form-data أو Base64.'
            }), 400

        backend_url = os.environ.get('ECOSORT_BACKEND_URL') or os.environ.get('BACKEND_URL')
        if backend_url:
            try:
                import requests
                resp = requests.post(
                    backend_url.rstrip('/') + '/predict',
                    files={'file': ('waste.jpg', image_bytes, 'image/jpeg')},
                    timeout=25
                )
                return jsonify(resp.json()), resp.status_code
            except Exception as e:
                logger.warning(f"External backend proxy failed: {e}")

        if engine.interpreter is None:
            return jsonify({
                'status': 'error',
                'message': 'EcoSort AI model runtime is unavailable. No local inference engine or backend proxy configured.'
            }), 503

        try:
            response_data = engine.predict(image_bytes)
            return jsonify(response_data)
        except InvalidImageError as e:
            return jsonify({'status': 'error', 'message': str(e) or 'الملف المرفوع ليس ملف صورة صالح.'}), 400
        except Exception as e:
            logger.error(f"Prediction failed: {e}", exc_info=True)
            return jsonify({'status': 'error', 'message': 'حدث خطأ داخلي أثناء معالجة الصورة. يرجى المحاولة لاحقاً.'}), 500

except Exception:
    STARTUP_ERROR = traceback.format_exc()


if STARTUP_ERROR:
    sys.stderr.write(f"EcoSort Startup Error:\n{STARTUP_ERROR}\n")

    def error_app(environ, start_response):
        sys.stderr.write(f"[ERROR] Service unavailable due to startup error: {STARTUP_ERROR}\n")
        body = json.dumps({
            'status': 'error',
            'message': 'Service temporarily unavailable'
        }).encode('utf-8')
        start_response('500 Internal Server Error', [
            ('Content-Type', 'application/json; charset=utf-8'),
            ('Content-Length', str(len(body)))
        ])
        return [body]

    app = error_app
    handler = error_app
else:
    app = flask_app
    handler = flask_app

if __name__ == '__main__':
    if not STARTUP_ERROR:
        flask_app.run(port=5000)
    else:
        print("STARTUP ERROR:", STARTUP_ERROR)
