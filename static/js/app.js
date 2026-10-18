/**
 * =========================================================================================
 * EcoSort - منسق التطبيق بنظام الخطوات المتسلسلة (Step-by-Step Wizard Coordinator)
 * جامعة كفر الشيخ - نظام الفرز والتوجيه الذكي
 * =========================================================================================
 * يدير:
 * - الخطوة 1: اختيار موقع المستخدم الحالي (بحث سريع وتصفية فئات + محاكاة GPS).
 * - الخطوة 2: فحص المخلفات (الرؤية الحاسوبية CV مع ماسح ليزري + بطاقات الخامات + دليل IR).
 * - الخطوة 3: الخريطة وأقصر مسار (Dijkstra & A* & Merge Sort & صوت واهتزاز وتوست عند الوصول).
 * =========================================================================================
 */

class EcoSortApp {
    /** تعقيم النص قبل إدخاله في innerHTML (منع حقن HTML من مدخلات المستخدم) */
    static escapeHtml(text) {
        const el = document.createElement('div');
        el.textContent = String(text ?? '');
        return el.innerHTML;
    }

    constructor() {
        // إدارة حالة المعالج (Wizard State)
        this.currentStep = 1;                   // الخطوة الحالية (1, 2, 3)
        this.currentLocation = null;            // معرف الموقع المختار
        this.currentWasteType = null;           // نوع الخامة (يحدد بعد الفحص)
        this.currentWasteItem = null;           // كائن المادة المكتشفة
        this.activeAlgorithm = 'dijkstra';      // الخوارزمية النشطة
        this.selectedNodeForModal = null;

        // حالات البحث والتصفية للخطوة الأولى
        this.activeCategoryFilter = 'all';
        this.searchQuery = '';

        // حالة الكاميرا الحية
        this.activeCameraStream = null;
        this.cameraFacingMode = 'environment';

        // حالة اللغة
        this.currentLang = localStorage.getItem('ecosort_lang') || 'ar';

        // تهيئة قواعد البيانات والمخطط
        this.graph = new CampusGraph(window.CAMPUS_GRAPH_DATA);
        this.irEngine = new InformationRetrievalEngine(window.IR_EXPANDED_CATALOG);

        this.init();
    }

    init() {
        // 1. ربط وحدة الرؤية الحاسوبية (المعتمدة كلياً على الباك اند)
        this.visionModule = new VisionModule((detection) => {
            this.handleWasteDetected(detection);
        });

        // 2. ربط وحدة التقييم الأكاديمي
        this.evaluationUI = new EvaluationUI({
            onAlgorithmChanged: (algo) => {
                this.activeAlgorithm = algo;
                this.updateAlgorithmToggleUI();
                this.recalculateRoute();
            },
            onNavigateToBin: (targetNodeId) => {
                this.navigateToTarget(targetNodeId);
            }
        });

        // 3. ربط كانفاس الخريطة التفاعلي الأصلي
        const canvasElem = document.getElementById('campus-graph-canvas');
        if (canvasElem) {
            this.graphCanvas = new CampusGraphCanvas(
                canvasElem, 
                this.graph, 
                (node) => this.openNodeModal(node),
                () => this.handleRouteArrival()
            );
        }

        // 4. بناء عناصر الواجهة والربط
        this.renderLocationCards();
        this.bindWizardNavigation();
        this.bindStep1Controls();
        this.bindStep2Controls();
        this.bindStep3Controls();
        this.bindModalControls();
        this.bindLanguageSwitcher();

        // 6. تطبيق اللغة الحالية
        this.applyLanguage(this.currentLang);
    }

    /**
     * الانتقال بين الخطوات المتسلسلة (Wizard Stepper Transition)
     */
    goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 3) return;

        // التحقق من تحديد الموقع قبل الانتقال للخطوة 2 أو 3
        if (stepNumber > 1 && !this.currentLocation) {
            this.showToast('اختر موقعك أولاً', 'يرجى اختيار موقعك الحالي داخل الجامعة للمتابعة.');
            return;
        }

        // التحقق من فحص وتحديد نوع المخلفات قبل الانتقال للخطوة 3
        if (stepNumber === 3 && !this.currentWasteItem) {
            this.showToast('افحص المخلفات أولاً', 'يرجى التقاط صورة أو رفع صورة للمخلفات للتعرف عليها وتحديد أقرب حاوية.');
            return;
        }

        this.currentStep = stepNumber;
        this.stopCameraStream();

        // 1. تحديث شريط التقدم (Stepper Indicators)
        for (let s = 1; s <= 3; s++) {
            const indicator = document.getElementById(`stepper-step-${s}`);
            if (!indicator) continue;

            indicator.classList.remove('active', 'completed');
            if (s === stepNumber) {
                indicator.classList.add('active');
            } else if (s < stepNumber) {
                indicator.classList.add('completed');
            }
        }

        // تحديث خطوط الربط بين الخطوات
        const line1 = document.getElementById('stepper-line-1');
        const line2 = document.getElementById('stepper-line-2');
        if (line1) line1.classList.toggle('filled', stepNumber >= 2);
        if (line2) line2.classList.toggle('filled', stepNumber >= 3);

        // 2. إخفاء كافة الشاشات وإظهار الشاشة المطلوبة بأنيميشن ناعم
        for (let s = 1; s <= 3; s++) {
            const stepSection = document.getElementById(`wizard-step-${s}`);
            if (stepSection) {
                if (s === stepNumber) {
                    stepSection.classList.add('active');
                } else {
                    stepSection.classList.remove('active');
                }
            }
        }

        // التمرير لأعلى الصفحة بنعومة
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // 3. إجراءات مخصصة عند فتح الشاشات
        if (stepNumber === 2) {
            this.updateStep2LocationBadge();
        } else if (stepNumber === 3) {
            this.updateStep3RouteContext();
            setTimeout(() => {
                if (this.graphCanvas) {
                    this.graphCanvas.setupDPI();
                    this.graphCanvas.fitGraph();
                }
                this.recalculateRoute();
            }, 60);
        }
    }

    /**
     * توليد بطاقات الكليات والمعالم في الشاشة الأولى (Step 1) مع دعم التصفية والبحث
     */
    renderLocationCards(filterCategory = this.activeCategoryFilter, searchQuery = this.searchQuery) {
        const grid = document.getElementById('location-cards-grid');
        if (!grid) return;

        const nodes = this.graph.getAllNodes();
        grid.innerHTML = '';

        // تصنيفات الكليات والمعالم
        const categoryMap = {
            tech: ['ai', 'eng', 'fci', 'sci'],
            medical: ['pharmacy', 'medicine'],
            service: ['restaurant', 'library', 'sports', 'admin', 'gate', 'agri']
        };

        const queryNorm = searchQuery.trim().toLowerCase();

        const filteredNodes = nodes.filter(node => {
            // فحص التصنيف
            if (filterCategory !== 'all') {
                const allowedIds = categoryMap[filterCategory] || [];
                if (!allowedIds.includes(node.id)) return false;
            }

            // فحص البحث النصي
            if (queryNorm.length > 0) {
                const nameNorm = node.name.toLowerCase();
                const subNorm = (node.subtitle || '').toLowerCase();
                if (!nameNorm.includes(queryNorm) && !subNorm.includes(queryNorm)) {
                    return false;
                }
            }
            return true;
        });

        if (filteredNodes.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full p-4 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                    <p>لم نجد أي منشأة مطابقة لكلمة البحث "${EcoSortApp.escapeHtml(searchQuery)}". جرب كلمة أخرى.</p>
                </div>
            `;
            return;
        }

        filteredNodes.forEach(node => {
            const card = document.createElement('div');
            card.className = `location-card ${this.currentLocation === node.id ? 'selected' : ''}`;
            card.setAttribute('data-node-id', node.id);
            card.setAttribute('role', 'radio');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-checked', this.currentLocation === node.id ? 'true' : 'false');

            // أيقونة توضيحية لكل كلية / مبنى
            let iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 22h16"/><path d="M18 2v20"/><path d="M6 2v20"/><path d="M6 6h12"/><path d="M6 10h12"/><path d="M6 14h12"/></svg>`;
            if (node.id === 'gate') {
                iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h20"/><path d="M5 20V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15"/><path d="M12 3v17"/></svg>`;
            } else if (node.id === 'ai') {
                iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>`;
            } else if (node.id === 'eng') {
                iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`;
            } else if (node.id === 'restaurant') {
                iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2"/><path d="M15 11v11"/><path d="M5 2v20"/><path d="M2 2h6v5a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2z"/></svg>`;
            } else if (node.id === 'sci') {
                iconSvg = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31M14 2v7.31M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0"/></svg>`;
            }

            card.innerHTML = `
                <div class="loc-card-icon">${iconSvg}</div>
                <div class="loc-card-content">
                    <div class="loc-card-title">${node.name}</div>
                    <div class="loc-card-desc">${node.subtitle || 'مبنى جامعي'}</div>
                </div>
                <div class="loc-card-check">&check;</div>
            `;

            // حدث اختيار الكلية
            card.addEventListener('click', () => {
                this.selectLocation(node.id);
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectLocation(node.id);
                }
            });

            grid.appendChild(card);
        });
    }

    /**
     * تعيين الموقع الحالي وتحديث البطاقات وزر المتابعة
     */
    selectLocation(nodeId) {
        this.currentLocation = nodeId;
        const node = this.graph.getNode(nodeId);

        // تحديث المظهر المرئي للبطاقات
        const allCards = document.querySelectorAll('.location-card');
        allCards.forEach(c => {
            const isMatch = c.getAttribute('data-node-id') === nodeId;
            c.classList.toggle('selected', isMatch);
            c.setAttribute('aria-checked', isMatch ? 'true' : 'false');
        });

        // تفعيل زر التالي
        const btnNext = document.getElementById('btn-go-to-step-2');
        if (btnNext) {
            btnNext.disabled = false;
        }

        const hint = document.getElementById('selected-location-hint');
        if (hint && node) {
            const displayName = this.currentLang === 'en' ? (node.nameEn || node.name) : node.name;
            const prefix = this.currentLang === 'en' ? 'Selected Location:' : 'الموقع المحدد:';
            hint.innerHTML = `${prefix} <strong class="text-emerald-700">${displayName}</strong> &check;`;
        }
    }

    /**
     * ربط أزرار التنقل الأساسية بين الشاشات
     */
    bindWizardNavigation() {
        // الشاشة 1 -> الشاشة 2
        const btnGoStep2 = document.getElementById('btn-go-to-step-2');
        if (btnGoStep2) {
            btnGoStep2.addEventListener('click', () => this.goToStep(2));
        }

        // الشاشة 2 -> الشاشة 1 (تغيير الموقع)
        const btnBackStep1 = document.getElementById('btn-back-to-step-1');
        const btnChangeLocStep2 = document.getElementById('btn-change-location-step2');
        if (btnBackStep1) btnBackStep1.addEventListener('click', () => this.goToStep(1));
        if (btnChangeLocStep2) btnChangeLocStep2.addEventListener('click', () => this.goToStep(1));

        // الشاشة 2 -> الشاشة 3
        const btnGoStep3 = document.getElementById('btn-go-to-step-3');
        if (btnGoStep3) {
            btnGoStep3.addEventListener('click', () => this.goToStep(3));
        }

        // الشاشة 3 -> الشاشة 2 (فحص قطعة أخرى)
        const btnBackStep2 = document.getElementById('btn-back-to-step-2');
        const btnRescanStep3 = document.getElementById('btn-rescan-step3');
        if (btnBackStep2) btnBackStep2.addEventListener('click', () => this.goToStep(2));
        if (btnRescanStep3) btnRescanStep3.addEventListener('click', () => this.goToStep(2));

        // الشاشة 3 -> الشاشة 1 (البدء من جديد)
        const btnRestartStep1 = document.getElementById('btn-restart-step-1');
        if (btnRestartStep1) btnRestartStep1.addEventListener('click', () => this.goToStep(1));
    }

    /**
     * ربط أدوات الشاشة 1 (البحث، الفئات، ومحاكاة GPS)
     */
    bindStep1Controls() {
        // محاكاة GPS الحقيقي والتمركز الذكي
        const btnGps = document.getElementById('btn-gps-simulate');
        if (btnGps) {
            btnGps.addEventListener('click', () => {
                const isEn = this.currentLang === 'en';
                btnGps.innerHTML = `
                    <span class="gps-pulse-ring"></span>
                    <span>${isEn ? 'Locating on campus via GPS...' : 'جارِ الاتصال بالأقمار وتحديد موقعك بالحرم...'}</span>
                `;
                btnGps.disabled = true;

                setTimeout(() => {
                    const sampleColleges = ['ai', 'eng', 'pharmacy', 'science', 'fci'];
                    const pickedId = sampleColleges[Math.floor(Math.random() * sampleColleges.length)];
                    this.selectLocation(pickedId);
                    const node = this.graph.getNode(pickedId);
                    const nodeName = isEn ? (node?.nameEn || node?.name) : node?.name;
                    btnGps.innerHTML = `
                        <span class="text-emerald-700 font-bold">&check; ${isEn ? 'Located at:' : 'تم تحديد موقعك:'} ${nodeName}</span>
                    `;
                    btnGps.disabled = false;

                    const selectedCard = document.querySelector(`.location-card[data-node-id="${pickedId}"]`);
                    if (selectedCard) {
                        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 400);
            });
        }

        // البحث النصي في الكليات
        const searchInput = document.getElementById('location-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderLocationCards(this.activeCategoryFilter, this.searchQuery);
            });
        }

        // تبويبات التصفية السريعة
        const categoryPills = document.querySelectorAll('.category-pill');
        categoryPills.forEach(pill => {
            pill.addEventListener('click', () => {
                categoryPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this.activeCategoryFilter = pill.getAttribute('data-category') || 'all';
                this.renderLocationCards(this.activeCategoryFilter, this.searchQuery);
            });
        });
    }

    /**
     * ربط أدوات الشاشة 2 (CV & IR مع تأثير المسح الليزري، دعم الكاميرا المباشرة والرفع)
     */
    bindStep2Controls() {
        // المدخلات الخفية للملفات والكاميرا
        const fileInput = document.getElementById('waste-image-input');
        const cameraInput = document.getElementById('waste-camera-input');
        const uploadArea = document.getElementById('cv-dropzone');

        // أزرار تشغيل الكاميرا والرفع المباشرة
        const btnTriggerCamera = document.getElementById('btn-trigger-camera');
        const btnTriggerUpload = document.getElementById('btn-trigger-upload');
        const btnRescanCamera = document.getElementById('btn-rescan-camera');
        const btnReuploadImage = document.getElementById('btn-reupload-image');

        // عناصر التحكم في الكاميرا الحية
        const btnCameraCapture = document.getElementById('btn-camera-capture');
        const btnCameraSwitch = document.getElementById('btn-camera-switch');
        const btnCameraClose = document.getElementById('btn-camera-close');

        // القائمة المنسدلة للتعديل اليدوي السريع
        const manualSelect = document.getElementById('manual-waste-selector');
        if (manualSelect) {
            manualSelect.addEventListener('change', (e) => {
                const wasteId = e.target.value;
                this.visionModule.selectPreset(wasteId);
            });
        }

        // تشغيل الكاميرا
        if (btnTriggerCamera) {
            btnTriggerCamera.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startCameraStream();
            });
        }

        if (btnRescanCamera) {
            btnRescanCamera.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startCameraStream();
            });
        }

        // تشغيل رفع الصور
        if (btnTriggerUpload) {
            btnTriggerUpload.addEventListener('click', (e) => {
                e.stopPropagation();
                this.stopCameraStream();
                if (fileInput) fileInput.click();
            });
        }

        if (btnReuploadImage) {
            btnReuploadImage.addEventListener('click', (e) => {
                e.stopPropagation();
                this.stopCameraStream();
                if (fileInput) fileInput.click();
            });
        }

        // أزرار التحكم داخل نافذة الكاميرا
        if (btnCameraCapture) {
            btnCameraCapture.addEventListener('click', (e) => {
                e.stopPropagation();
                this.captureCameraFrame();
            });
        }

        if (btnCameraSwitch) {
            btnCameraSwitch.addEventListener('click', (e) => {
                e.stopPropagation();
                this.switchCameraFacingMode();
            });
        }

        if (btnCameraClose) {
            btnCameraClose.addEventListener('click', (e) => {
                e.stopPropagation();
                this.stopCameraStream();
            });
        }

        // تفاعلات منطقة الـ Dropzone
        if (uploadArea) {
            uploadArea.addEventListener('click', (e) => {
                // إذا لم تكن الكاميرا مفتوحة ولم يتم النقر على زر
                if (!this.activeCameraStream && !e.target.closest('button')) {
                    if (fileInput) fileInput.click();
                }
            });

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.stopCameraStream();
                    this.processUploadedFile(e.dataTransfer.files[0]);
                }
            });
        }

        // مراقبة مدخلات الملفات
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.processUploadedFile(e.target.files[0]);
                    fileInput.value = '';
                }
            });
        }

        if (cameraInput) {
            cameraInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.processUploadedFile(e.target.files[0]);
                    cameraInput.value = '';
                }
            });
        }

        // دعم لصق الصور مباشرة من الحافظة (Ctrl+V / Paste)
        document.addEventListener('paste', (e) => {
            if (this.currentStep !== 2) return;
            if (e.clipboardData && e.clipboardData.items) {
                for (const item of e.clipboardData.items) {
                    if (item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                            this.stopCameraStream();
                            this.processUploadedFile(file);
                            this.showToast('تم لصق الصورة', 'تم استقبال الصورة من الحافظة وجارِ تحليلها.');
                            break;
                        }
                    }
                }
            }
        });
    }

    /**
     * تشغيل بث الكاميرا الحية مع الرجوع التلقائي لمدخل الكاميرا الأصلي عند عدم الدعم
     */
    async startCameraStream() {
        const camContainer = document.getElementById('cv-camera-stream-container');
        const videoElem = document.getElementById('cv-camera-video');
        const placeholder = document.getElementById('cv-upload-placeholder');
        const previewContainer = document.getElementById('cv-image-preview-container');
        const cameraInput = document.getElementById('waste-camera-input');

        // إيقاف أي بث سابق
        this.stopCameraStream();

        // التحقق من دعم المتصفح للـ WebRTC / getUserMedia
        if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
            try {
                const constraints = {
                    video: {
                        facingMode: { ideal: this.cameraFacingMode },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.activeCameraStream = stream;

                if (camContainer && videoElem) {
                    camContainer.classList.remove('hidden');
                    if (placeholder) placeholder.classList.add('hidden');
                    if (previewContainer) previewContainer.classList.add('hidden');

                    videoElem.srcObject = stream;
                    await videoElem.play().catch(() => {});
                }
                return;
            } catch (err) {
                console.warn('تعذّر فتح الكاميرا عبر getUserMedia، جارِ الفتح عبر مدخل الكاميرا الأصلي:', err);
            }
        }

        // الرجوع التلقائي إلى استدعاء الكاميرا الأصلية بالنظام
        if (cameraInput) {
            cameraInput.click();
        } else {
            this.showToast('تنبيه الكاميرا', 'يرجى السماح بالوصول للكاميرا أو استخدام زر رفع الصور.');
        }
    }

    /**
     * التقاط إطار من بث الكاميرا ومعالجته فورياً
     */
    captureCameraFrame() {
        const videoElem = document.getElementById('cv-camera-video');
        if (!videoElem || !this.activeCameraStream) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoElem.videoWidth || 640;
        canvas.height = videoElem.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);

        this.stopCameraStream();

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                this.processUploadedFile(file);
            }
        }, 'image/jpeg', 0.92);
    }

    /**
     * تبديل وضع الكاميرا بين الأمامية والخلفية
     */
    switchCameraFacingMode() {
        this.cameraFacingMode = this.cameraFacingMode === 'user' ? 'environment' : 'user';
        this.startCameraStream();
    }

    /**
     * إيقاف بث الكاميرا الحية وإعادة إخفاء الحاوية
     */
    stopCameraStream() {
        if (this.activeCameraStream) {
            this.activeCameraStream.getTracks().forEach(track => track.stop());
            this.activeCameraStream = null;
        }

        const camContainer = document.getElementById('cv-camera-stream-container');
        const videoElem = document.getElementById('cv-camera-video');
        if (videoElem) videoElem.srcObject = null;
        if (camContainer) camContainer.classList.add('hidden');
    }

    async processUploadedFile(file) {
        this.stopCameraStream();
        const dropzone = document.getElementById('cv-dropzone');
        const previewContainer = document.getElementById('cv-image-preview-container');
        const placeholder = document.getElementById('cv-upload-placeholder');
        const previewImg = document.getElementById('cv-uploaded-image');

        try {
            // تشغيل تأثير مسح الليزر الذكي
            if (dropzone) dropzone.classList.add('scanning');

            if (previewContainer && previewImg) {
                const tempUrl = URL.createObjectURL(file);
                previewImg.src = tempUrl;
                previewContainer.classList.remove('hidden');
                if (placeholder) placeholder.classList.add('hidden');
            }

            const detection = await this.visionModule.processUploadedImage(file);
            
            setTimeout(() => {
                if (dropzone) dropzone.classList.remove('scanning');
                if (previewImg && detection.imageUrl) {
                    previewImg.src = detection.imageUrl;
                }
                const resultCard = document.getElementById('card-inspection-result');
                if (resultCard) {
                    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                this.showToast('تم الفحص بنجاح', `تم التعرف على: ${detection.item.name} بدقة ${detection.confidence}%`);
            }, 600);

        } catch (err) {
            if (dropzone) dropzone.classList.remove('scanning');
            this.showToast('تعذّر فحص الصورة', err.message || 'حدث خطأ أثناء معالجة الصورة.');
        }
    }

    /**
     * معالجة حدث اكتشاف خامة بواسطة CV وتحديث كارت دليل المعالجة (IR)
     */
    handleWasteDetected(detection) {
        this.currentWasteItem = detection.item;
        this.currentWasteType = detection.item.binType;

        // 0. إظهار كارت النتيجة وإخفاء رسالة الانتظار وتفعيل زر الانتقال للخطوة 3
        const resultCard = document.getElementById('card-inspection-result');
        const awaitingNotice = document.getElementById('awaiting-scan-notice');
        const btnGoStep3 = document.getElementById('btn-go-to-step-3');

        if (awaitingNotice) awaitingNotice.classList.add('hidden');
        if (resultCard) {
            resultCard.classList.remove('hidden');
            resultCard.classList.add('card-fade-in');
        }
        if (btnGoStep3) {
            btnGoStep3.disabled = false;
        }

        // 1. تحديث بيانات المادة المكتشفة
        const nameElem = document.getElementById('cv-detected-material-name');
        const codeElem = document.getElementById('cv-detected-resin-code');
        const confidenceValElem = document.getElementById('cv-confidence-value');
        const confidenceBarElem = document.getElementById('cv-confidence-bar-fill');
        const textureElem = document.getElementById('cv-texture-description');
        const latencyElem = document.getElementById('cv-inference-latency');
        const binBadge = document.getElementById('ir-target-bin-badge');
        const manualSelect = document.getElementById('manual-waste-selector');

        if (nameElem) nameElem.textContent = detection.item.name;
        if (codeElem) codeElem.textContent = detection.item.resinCode || detection.item.category;
        if (confidenceValElem) confidenceValElem.textContent = `${detection.confidence}%`;
        if (confidenceBarElem) confidenceBarElem.style.width = `${detection.confidence}%`;
        if (textureElem) textureElem.textContent = detection.texture;
        if (latencyElem) latencyElem.textContent = `${detection.inferenceTimeMs} ms`;

        if (manualSelect && detection.item && detection.item.id) {
            manualSelect.value = detection.item.id;
        }

        if (binBadge) {
            binBadge.textContent = detection.item.binColorName;
            binBadge.style.backgroundColor = detection.item.binColorHex || '#10b981';
            binBadge.style.color = '#ffffff';
        }

        const activeModelTag = document.getElementById('cv-active-model-tag');
        if (activeModelTag && detection.modelName) {
            activeModelTag.textContent = detection.modelName;
        }

        const previewStatusText = document.getElementById('cv-preview-status-text');
        if (previewStatusText) {
            previewStatusText.textContent = `تم الاستدلال بنجاح عبر ${detection.modelName || 'الذكاء الاصطناعي'} ✓`;
        }

        // 2. تحديث خطوات الإعداد الصحيح ومؤشرات توفير الكربون (IR)
        const stepsContainer = document.getElementById('ir-handling-steps');
        const co2Elem = document.getElementById('ir-co2-savings-value');
        const energyElem = document.getElementById('ir-energy-savings-value');
        const waterElem = document.getElementById('ir-water-savings-value');

        if (stepsContainer && detection.item.properHandling) {
            stepsContainer.innerHTML = detection.item.properHandling.map((step, idx) => `
                <li class="handling-step-item">
                    <span class="step-num">${idx + 1}</span>
                    <span class="step-text">${step}</span>
                </li>
            `).join('');
        }

        if (co2Elem) co2Elem.textContent = `${detection.item.carbonSavingsGrams} جم CO₂`;
        if (energyElem) energyElem.textContent = detection.item.energySavings || '3.5 ساعة إضاءة';
        if (waterElem) waterElem.textContent = `${detection.item.waterSavingsLiters || 2.5} لتر مياه نقية`;
    }

    /**
     * تحديث اسم الموقع في شريط الشاشة الثانية
     */
    updateStep2LocationBadge() {
        const textElem = document.getElementById('step2-current-location-text');
        if (textElem && this.currentLocation) {
            const node = this.graph.getNode(this.currentLocation);
            textElem.textContent = node ? `${node.name} (${node.subtitle || ''})` : this.currentLocation;
        }
    }

    /**
     * تحديث سياق المسار في شريط الشاشة الثالثة
     */
    updateStep3RouteContext() {
        const startElem = document.getElementById('step3-start-node-name');
        const wasteElem = document.getElementById('step3-waste-name');

        if (startElem && this.currentLocation) {
            const node = this.graph.getNode(this.currentLocation);
            startElem.textContent = node ? node.name : this.currentLocation;
        }

        if (wasteElem && this.currentWasteItem) {
            wasteElem.textContent = this.currentWasteItem.name;
        }
    }

    /**
     * ربط أدوات الشاشة 3 (الخريطة والخوارزميات والبطاقة العائمة)
     */
    bindStep3Controls() {
        const btnDijkstra = document.getElementById('btn-algo-dijkstra');
        const btnAStar = document.getElementById('btn-algo-astar');
        const btnSimulateRoute = document.getElementById('btn-simulate-route');
        const btnMobileSimulate = document.getElementById('btn-mobile-simulate-route');
        const btnResetView = document.getElementById('btn-reset-map-view');
        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');

        if (btnDijkstra) {
            btnDijkstra.addEventListener('click', () => {
                this.evaluationUI.setAlgorithm('dijkstra');
                this.showToast('🔍 تم التبديل إلى Dijkstra', 'خوارزمية المسافات الكلاسيكية لأقصر مسار.');
            });
        }

        if (btnAStar) {
            btnAStar.addEventListener('click', () => {
                this.evaluationUI.setAlgorithm('astar');
                this.showToast('⚡ تم التبديل إلى A* Search', 'خوارزمية التوجيه الذكي باستخدام دالة Heuristic.');
            });
        }

        if (btnSimulateRoute) {
            btnSimulateRoute.addEventListener('click', () => {
                this.handleSimulateRouteClick();
            });
        }

        if (btnMobileSimulate) {
            btnMobileSimulate.addEventListener('click', () => {
                this.handleSimulateRouteClick();
            });
        }

        if (btnResetView) {
            btnResetView.addEventListener('click', () => {
                this.graphCanvas.resetView();
            });
        }

        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => {
                this.graphCanvas.zoom(1);
            });
        }

        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => {
                this.graphCanvas.zoom(-1);
            });
        }
    }

    updateAlgorithmToggleUI() {
        const btnDijkstra = document.getElementById('btn-algo-dijkstra');
        const btnAStar = document.getElementById('btn-algo-astar');

        if (this.activeAlgorithm === 'dijkstra') {
            btnDijkstra?.classList.add('active');
            btnAStar?.classList.remove('active');
        } else {
            btnAStar?.classList.add('active');
            btnDijkstra?.classList.remove('active');
        }
    }

    /**
     * تشغيل محاكاة السير أو إيداع المخلفات مع تغذية مرئية وصوتية متكاملة للأزرار
     */
    handleSimulateRouteClick() {
        if (!this.graphCanvas) return;

        const btnDesktop = document.getElementById('btn-simulate-route');
        const btnMobile = document.getElementById('btn-mobile-simulate-route');

        const path = this.graphCanvas.activePath || [];
        const isWalking = path.length >= 2;

        const setButtonState = (busy, text) => {
            [btnDesktop, btnMobile].forEach(btn => {
                if (!btn) return;
                btn.disabled = busy;
                if (busy) {
                    btn.classList.add('btn-simulating');
                    btn.innerHTML = `<span class="sim-pulse-dot"></span> <span>${text}</span>`;
                } else {
                    btn.classList.remove('btn-simulating');
                    btn.innerHTML = `
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        <span>${isWalking ? (this.currentLang === 'en' ? 'Re-simulate Walk' : 'إعادة محاكاة السير') : (this.currentLang === 'en' ? 'Simulate Walk' : 'محاكاة السير')}</span>
                    `;
                }
            });
        };

        if (path.length >= 2) {
            setButtonState(true, this.currentLang === 'en' ? 'Walking along path... 🏃‍♂️' : 'جارِ محاكاة المشي... 🏃‍♂️');
            this.graphCanvas.simulateRouteTraversal(() => {
                setButtonState(false);
                this.handleRouteArrival();
            });
        } else if (path.length === 1) {
            setButtonState(true, this.currentLang === 'en' ? 'Depositing waste... 🎯' : 'جارِ إيداع المخلفات... 🎯');
            const targetNode = this.graph.getNode(path[0]);
            const nodeName = targetNode ? (this.currentLang === 'en' ? (targetNode.nameEn || targetNode.name) : targetNode.name) : 'موقعك الحالي';

            this.graphCanvas.simulateRouteTraversal(() => {
                setButtonState(false);
                this.playEcoChime();
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                    navigator.vibrate([80, 50, 80]);
                }
                const savedCo2 = this.currentWasteItem ? this.currentWasteItem.carbonSavingsGrams : 85;
                const msg = this.currentLang === 'en'
                    ? `Bin is right in front of you at ${nodeName} (Distance: 0m). Saved ${savedCo2}g CO₂!`
                    : `الحاوية متوفرة أمامك مباشرة في ${nodeName} (المسافة: 0م). وفرت ${savedCo2} جم CO₂!`;
                this.showToast(
                    this.currentLang === 'en' ? '🎯 Deposited in Current Location!' : '🎯 تم الإيداع بنجاح في موقعك الحالي!',
                    msg
                );
            });
        } else {
            this.showToast('⚠️ لا يوجد مسار محدد', 'يرجى اختيار موقعك ونوع المخلفات أولاً.');
        }
    }

    /**
     * تشغيل خوارزميات التوجيه وحساب أقصر مسار وعرض النتائج على الخريطة
     */
    recalculateRoute() {
        if (!this.currentLocation || !this.currentWasteType) return;

        // 1. تقييم وحساب المسارات عبر Dijkstra و A* و Merge Sort
        const evaluation = this.evaluationUI.evaluateAll(
            this.graph, 
            this.currentLocation, 
            this.currentWasteType
        );

        const activeResult = evaluation.activeResult;

        // 2. تحديث الكانفاس برسم المسار الأقصر المتوهج
        if (this.graphCanvas) {
            this.graphCanvas.setNavigationData({
                startNodeId: this.currentLocation,
                wasteType: this.currentWasteType,
                path: activeResult.path,
                targetNodeId: activeResult.targetNodeId,
                visitedNodes: activeResult.visitedOrder
            });
        }

        // 3. تحديث بطاقة الوجهة الموصى بها وبطاقة الموبايل العائمة
        this.updateTargetInfo(activeResult.targetNodeId, activeResult.totalDistance);
    }

    /**
     * تحديث بيانات الحاوية المستهدفة والبطاقة العائمة
     */
    updateTargetInfo(targetNodeId, totalDistance) {
        if (!targetNodeId) return;
        const targetNode = this.graph.getNode(targetNodeId);
        const targetTitleElem = document.getElementById('final-target-bin-name');
        const targetDescElem = document.getElementById('final-target-bin-desc');
        const mobileTargetName = document.getElementById('mobile-target-bin-name');
        const mobileTargetDist = document.getElementById('mobile-target-distance');
        const mobileWalkingTime = document.getElementById('mobile-walking-time');

        if (targetNode) {
            if (targetTitleElem) targetTitleElem.textContent = targetNode.name;
            if (mobileTargetName) mobileTargetName.textContent = targetNode.name;

            if (targetDescElem) {
                const bin = targetNode.bins.find(b => {
                    if (this.currentWasteType === 'plastic' || this.currentWasteType === 'pet' || this.currentWasteType === 'hdpe') {
                        return (b.type === 'plastic' || b.type === 'pet' || b.type === 'hdpe') && b.available;
                    }
                    return b.type === this.currentWasteType && b.available;
                });
                targetDescElem.textContent = bin 
                    ? `${bin.label} (متاحة - نسبة الامتلاء الحالية: ${bin.capacity}%)` 
                    : 'حاوية متاحة';
            }
        }

        if (mobileTargetDist) {
            mobileTargetDist.textContent = totalDistance === Infinity ? 'غير متصل' : `${totalDistance} م`;
        }
        if (mobileWalkingTime) {
            const mins = totalDistance === Infinity ? '-' : (totalDistance / 80).toFixed(1);
            mobileWalkingTime.textContent = `(${mins} د مشي)`;
        }
    }

    /**
     * التوجيه اليدوي نحو حاوية بديلة تم اختيارها من جدول Merge Sort
     */
    navigateToTarget(targetNodeId) {
        let result;
        if (this.activeAlgorithm === 'dijkstra') {
            result = DijkstraAlgorithm.findShortestPath(this.graph, this.currentLocation, [targetNodeId]);
        } else {
            result = AStarAlgorithm.findShortestPath(this.graph, this.currentLocation, [targetNodeId]);
        }

        if (this.graphCanvas) {
            this.graphCanvas.setNavigationData({
                startNodeId: this.currentLocation,
                wasteType: this.currentWasteType,
                path: result.path,
                targetNodeId: targetNodeId,
                visitedNodes: result.visitedOrder
            });
            this.handleSimulateRouteClick();
        }

        const targetNode = this.graph.getNode(targetNodeId);
        this.updateTargetInfo(targetNodeId, result.totalDistance);

        // تحديث مقاييس الأداء للمسار المحدد عبر واجهة التقييم
        this.evaluationUI.renderMetrics({
            activeResult: result,
            wasteType: this.currentWasteType
        });

        this.showToast('🗺️ تم توجيه المسار', `تم اختيار الحاوية في ${targetNode ? targetNode.name : targetNodeId} (${result.totalDistance} متر).`);
    }

    /**
     * تشغيل الصوت والاهتزاز وإشعار التوست عند اكتمال محاكاة السير والوصول للحاوية
     */
    handleRouteArrival() {
        this.playEcoChime();

        // اهتزاز الموبايل
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([70, 40, 70]);
        }

        const savedCo2 = this.currentWasteItem ? this.currentWasteItem.carbonSavingsGrams : 85;
        this.showToast('🎉 تم الوصول للحاوية بنجاح!', `تم تسجيل توفير ${savedCo2} جم CO₂ في رصيدك البيئي.`);
    }

    /**
     * توليد رنين صوتي بيئي ناعم باستخدام Web Audio API بدون أي ملفات خارجية
     */
    playEcoChime() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            // النغمة الأولى: E5 (659.25 Hz)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
            gain1.gain.setValueAtTime(0.15, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.35);

            // النغمة الثانية: A5 (880 Hz)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
            gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.12);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime + 0.12);
            osc2.stop(ctx.currentTime + 0.6);
        } catch (e) {
            // AudioContext may be blocked or unsupported
        }
    }

    /**
     * إظهار رسالة التوست العائمة
     */
    showToast(title, message) {
        const toast = document.getElementById('eco-toast-notification');
        const titleElem = document.getElementById('toast-title');
        const msgElem = document.getElementById('toast-message');

        if (!toast) return;

        if (titleElem) titleElem.textContent = title;
        if (msgElem) msgElem.textContent = message;

        toast.classList.remove('hidden');
        // تأخير قصير لتطبيق أنيميشن التلاشي
        setTimeout(() => toast.classList.add('toast-show'), 10);

        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.classList.add('hidden'), 350);
        }, 3800);
    }

    /**
     * نافذة تعديل ومراقبة حاويات الكلية (Modal)
     */
    openNodeModal(node) {
        this.selectedNodeForModal = node;
        const modal = document.getElementById('node-details-modal');
        const title = document.getElementById('modal-node-title');
        const subtitle = document.getElementById('modal-node-subtitle');
        const binsList = document.getElementById('modal-node-bins-list');

        if (!modal) return;

        if (title) title.textContent = node.name;
        if (subtitle) subtitle.textContent = node.subtitle;

        if (binsList) {
            binsList.innerHTML = node.bins.map(bin => {
                const statusBadge = bin.available 
                    ? '<span class="badge badge-success">🟢 متاحة</span>' 
                    : '<span class="badge badge-danger">🔴 ممتلئة</span>';
                
                const btnLabel = bin.available ? 'تغيير إلى ممتلئة' : 'تغيير إلى متاحة';
                const btnClass = bin.available ? 'btn-danger-sm' : 'btn-success-sm';

                return `
                    <div class="modal-bin-item">
                        <div class="bin-desc">
                            <strong>${bin.label}</strong>
                            <div class="text-xs text-gray-500">سعة الامتلاء الحالية: ${bin.capacity}%</div>
                        </div>
                        <div class="bin-actions">
                            ${statusBadge}
                            <button class="btn ${btnClass} btn-sm" onclick="window.app.toggleBinInModal('${bin.type}')">
                                ${btnLabel}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        modal.classList.remove('hidden');
    }

    toggleBinInModal(wasteType) {
        if (!this.selectedNodeForModal) return;
        this.graph.toggleBinStatus(this.selectedNodeForModal.id, wasteType);
        this.openNodeModal(this.selectedNodeForModal);
        this.recalculateRoute();
    }

    closeNodeModal() {
        const modal = document.getElementById('node-details-modal');
        if (modal) modal.classList.add('hidden');
        this.selectedNodeForModal = null;
    }

    bindModalControls() {
        const closeBtn = document.getElementById('btn-close-node-modal');
        const modal = document.getElementById('node-details-modal');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeNodeModal());
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeNodeModal();
            });
        }
    }

    /**
     * ربط زر تبديل اللغة (Arabic RTL <-> English LTR)
     */
    bindLanguageSwitcher() {
        const btnLang = document.getElementById('lang-toggle-btn');
        if (btnLang) {
            btnLang.addEventListener('click', () => {
                this.toggleLanguage();
            });
        }
    }

    toggleLanguage() {
        const nextLang = this.currentLang === 'ar' ? 'en' : 'ar';
        this.applyLanguage(nextLang);
    }

    applyLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('ecosort_lang', lang);
        const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[lang]) || window.ECOSORT_TRANSLATIONS?.ar;
        if (!t) return;

        const isRtl = lang === 'ar';
        document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        document.title = t.pageTitle;

        // نص زر اللغة
        const langBtnText = document.getElementById('lang-btn-text');
        if (langBtnText) langBtnText.textContent = t.langBtnText;

        // الهيدر والشعار
        const brandSubtitle = document.getElementById('brand-subtitle');
        if (brandSubtitle) brandSubtitle.textContent = t.brandSubtitle;

        // شريط المراحل Stepper
        const s1Title = document.querySelector('#stepper-step-1 .step-title');
        const s1Desc = document.querySelector('#stepper-step-1 .step-desc');
        const s2Title = document.querySelector('#stepper-step-2 .step-title');
        const s2Desc = document.querySelector('#stepper-step-2 .step-desc');
        const s3Title = document.querySelector('#stepper-step-3 .step-title');
        const s3Desc = document.querySelector('#stepper-step-3 .step-desc');
        if (s1Title) s1Title.textContent = t.step1NavTitle;
        if (s1Desc) s1Desc.textContent = t.step1NavDesc;
        if (s2Title) s2Title.textContent = t.step2NavTitle;
        if (s2Desc) s2Desc.textContent = t.step2NavDesc;
        if (s3Title) s3Title.textContent = t.step3NavTitle;
        if (s3Desc) s3Desc.textContent = t.step3NavDesc;

        // الخطوة 1
        const step1Title = document.getElementById('step-1-title');
        const step1Desc = document.getElementById('step-1-desc');
        const btnGpsText = document.getElementById('btn-gps-text');
        const searchInput = document.getElementById('location-search-input');
        const mapTitle = document.getElementById('step1-map-title');
        const mapDesc = document.getElementById('step1-map-desc');
        const btnRecenterText = document.getElementById('btn-recenter-text');
        const btnNextStep2 = document.getElementById('btn-go-to-step-2');

        if (step1Title) step1Title.textContent = t.step1HeroTitle;
        if (step1Desc) step1Desc.textContent = t.step1HeroDesc;
        if (btnGpsText) btnGpsText.textContent = t.btnGps;
        if (searchInput) searchInput.placeholder = t.searchPlaceholder;
        if (mapTitle) mapTitle.textContent = t.step1MapTitle;
        if (mapDesc) mapDesc.textContent = t.step1MapDesc;
        if (btnRecenterText) btnRecenterText.textContent = t.btnRecenter;
        if (btnNextStep2) {
            const span = btnNextStep2.querySelector('span');
            if (span) span.textContent = t.btnNextStep2;
        }

        // تبويبات الفئات
        const pillAll = document.querySelector('.category-pill[data-category="all"]');
        const pillTech = document.querySelector('.category-pill[data-category="tech"]');
        const pillMed = document.querySelector('.category-pill[data-category="medical"]');
        const pillServ = document.querySelector('.category-pill[data-category="service"]');
        if (pillAll) pillAll.textContent = t.categoryAll;
        if (pillTech) pillTech.textContent = t.categoryTech;
        if (pillMed) pillMed.textContent = t.categoryMedical;
        if (pillServ) pillServ.textContent = t.categoryService;

        // تحديث بطاقات الكليات
        this.renderLocationCards();

        // الخطوة 2
        const step2Title = document.getElementById('step-2-title');
        const step2Subtitle = document.querySelector('#wizard-step-2 .step-subtitle');
        if (step2Title) step2Title.textContent = t.step2Title;
        if (step2Subtitle) step2Subtitle.textContent = t.step2Subtitle;

        // الخطوة 3
        const step3MapTitle = document.querySelector('.map-card-full .card-title');
        const step3MapSubtitle = document.querySelector('.map-card-full .card-subtitle');
        const btnSimulateRouteText = document.getElementById('btn-simulate-route-text');
        if (step3MapTitle) step3MapTitle.textContent = t.mapTitle;
        if (step3MapSubtitle) step3MapSubtitle.textContent = t.mapSubtitle;
        if (btnSimulateRouteText) btnSimulateRouteText.textContent = t.btnSimulate;

        if (this.currentStep === 2) {
            this.updateStep2LocationBadge();
        } else if (this.currentStep === 3) {
            this.updateStep3RouteContext();
            this.recalculateRoute();
        }
    }
}

// تشغيل التطبيق فور اكتمال تحميل المستند
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EcoSortApp();
});
