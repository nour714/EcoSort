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
        this.currentStep = 1;                                                    // الخطوة الحالية (1: الفحص، 2: الموقع، 3: المسار)
        this.currentLocation = null;                                            // تحديد الموقع إجباري لكل عملية فرز جديدة
        this.currentWasteType = null;                                            // نوع الخامة (يحدد بعد الفحص)
        this.currentWasteItem = null;                                            // كائن المادة المكتشفة
        this.activeAlgorithm = 'dijkstra';                                       // الخوارزمية النشطة
        this.selectedNodeForModal = null;
        this.lastUploadedFile = null;
        this.lastActiveElement = null;

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
        this.initHashNavigation();

        // 5. تطبيق اللغة الحالية وتحديث البانر
        this.applyLanguage(this.currentLang);
        this.updateStep1SavedLocationBanner();
    }

    /**
     * الانتقال بين الخطوات المتسلسلة (Wizard Stepper Transition)
     */
    goToStep(stepNumber, updateHash = true) {
        if (stepNumber < 1 || stepNumber > 3) return;

        // التحقق من فحص وتحديد نوع المخلفات قبل الانتقال للخطوة 3
        if (stepNumber === 3) {
            if (!this.currentWasteItem) {
                const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
                this.showToast(t.toastErrWasteTitle || 'افحص المخلفات أولاً', t.toastErrWasteMsg || 'يرجى التقاط صورة أو اختيار خامة لتحديد أقرب حاوية.');
                return;
            }
            if (!this.currentLocation) {
                // إذا لم يتم تحديد الموقع بعد، يتم التوجيه إلى شاشة اختيار الموقع
                this.goToStep(2, updateHash);
                return;
            }
        }

        this.currentStep = stepNumber;
        this.stopCameraStream();

        // تحديث عنوان الـ Hash لدعم أزرار الرجوع والتقدم بالمتصفح
        if (updateHash) {
            const hashes = { 1: '#scan', 2: '#location', 3: '#route' };
            const targetHash = hashes[stepNumber] || '#scan';
            if (window.location.hash !== targetHash) {
                try {
                    window.history.pushState(null, '', targetHash);
                } catch (_) {
                    window.location.hash = targetHash;
                }
            }
        }

        // 1. تحديث شريط التقدم (Stepper Indicators)
        for (let s = 1; s <= 3; s++) {
            const indicator = document.getElementById(`stepper-step-${s}`);
            if (!indicator) continue;

            indicator.classList.remove('active', 'completed');
            indicator.setAttribute('aria-selected', s === stepNumber ? 'true' : 'false');
            indicator.setAttribute('tabindex', s === stepNumber ? '0' : '-1');
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

        // التمرير لأعلى الصفحة بنعومة (B8)
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // إعلان قارئات الشاشة وإدارة التركيز (B8 & WCAG 2.1 AA)
        const announcer = document.getElementById('step-announcer');
        const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
        const stepTitles = {
            1: t.step1NavTitle || 'الفحص والتصنيف',
            2: t.step2NavTitle || 'الموقع في الحرم',
            3: t.step3NavTitle || 'المسار والحاوية'
        };
        if (announcer) {
            announcer.textContent = `${this.currentLang === 'en' ? 'Step' : 'الخطوة'} ${stepNumber}: ${stepTitles[stepNumber]}`;
        }

        const heading = document.getElementById(`step-${stepNumber}-title`);
        if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: true });
        }

        // 3. إجراءات مخصصة عند فتح الشاشات
        if (stepNumber === 1) {
            this.updateStep1SavedLocationBanner();
        } else if (stepNumber === 2) {
            this.updateStep2LocationUI();
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
     * دعم التنقل عبر روابط الهاش (Hash Navigation: #scan, #location, #route)
     */
    initHashNavigation() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.toLowerCase();
            if (hash === '#location') {
                this.goToStep(2, false);
            } else if (hash === '#route') {
                if (this.currentWasteItem) {
                    this.goToStep(3, false);
                } else {
                    this.goToStep(1, false);
                }
            } else if (hash === '#scan' || hash === '') {
                this.goToStep(1, false);
            }
        });

        const initHash = window.location.hash.toLowerCase();
        if (initHash === '#location') {
            this.goToStep(2, false);
        } else if (initHash === '#route') {
            if (this.currentWasteItem) {
                this.goToStep(3, false);
            }
        }
    }

    /**
     * تحديث شريط الموقع المحفوظ في الشاشة الأولى
     */
    updateStep1SavedLocationBanner() {
        const banner = document.getElementById('step1-saved-location-banner');
        const textElem = document.getElementById('step1-saved-location-text');
        if (!banner) return;

        if (this.currentLocation) {
            const node = this.graph.getNode(this.currentLocation);
            if (node) {
                const isEn = this.currentLang === 'en';
                const displayName = isEn ? (node.nameEn || node.name) : node.name;
                if (textElem) textElem.textContent = displayName;
                banner.style.display = 'flex';
                return;
            }
        }
        banner.style.display = 'none';
    }

    /**
     * تحديث واجهة الخطوة الثانية (اختيار الموقع)
     */
    updateStep2LocationUI() {
        this.renderLocationCards(this.activeCategoryFilter, this.searchQuery);
        const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
        const isEn = this.currentLang === 'en';
        const hint = document.getElementById('selected-location-hint');
        const btnNext = document.getElementById('btn-go-to-step-3');
        const btnNextText = document.getElementById('btn-go-to-step-3-text');

        if (this.currentLocation) {
            const node = this.graph.getNode(this.currentLocation);
            if (node) {
                const displayName = isEn ? (node.nameEn || node.name) : node.name;
                if (hint) {
                    const prefix = t.hintSelectedPrefix || (isEn ? 'Selected Location: ' : 'الموقع المختار: ');
                    hint.innerHTML = `${prefix}<strong class="text-emerald-700">${displayName}</strong> &check;`;
                }
                if (btnNext) btnNext.disabled = false;
                if (btnNextText) {
                    btnNextText.textContent = `${t.btnContinueToRoute || 'متابعة إلى المسار الأقرب'} (${displayName})`;
                }
                return;
            }
        }

        if (btnNext) btnNext.disabled = true;
        if (hint) hint.textContent = t.hintNoLocation || 'لم يتم تحديد موقع بعد';
        if (btnNextText) btnNextText.textContent = t.btnContinueToRoute || 'متابعة إلى المسار الأقرب';
    }

    /**
     * توليد بطاقات الكليات والمعالم في الشاشة الثانية (Step 2) مع دعم التصفية والبحث
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
        const isEn = this.currentLang === 'en';
        const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};

        const filteredNodes = nodes.filter(node => {
            // فحص التصنيف
            if (filterCategory !== 'all') {
                const allowedIds = categoryMap[filterCategory] || [];
                if (!allowedIds.includes(node.id)) return false;
            }

            // فحص البحث النصي ثنائي اللغة (عربي وإنجليزي)
            if (queryNorm.length > 0) {
                const nameNorm = (node.name || '').toLowerCase();
                const subNorm = (node.subtitle || '').toLowerCase();
                const nameEnNorm = (node.nameEn || '').toLowerCase();
                const subEnNorm = (node.subtitleEn || '').toLowerCase();
                if (!nameNorm.includes(queryNorm) && !subNorm.includes(queryNorm) &&
                    !nameEnNorm.includes(queryNorm) && !subEnNorm.includes(queryNorm)) {
                    return false;
                }
            }
            return true;
        });

        if (filteredNodes.length === 0) {
            const emptyTemplate = t.searchEmpty || 'لم نجد أي منشأة مطابقة لكلمة البحث "{q}". جرب كلمة أخرى.';
            grid.innerHTML = `
                <div class="col-span-full p-4 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                    <p>${emptyTemplate.replace('{q}', EcoSortApp.escapeHtml(searchQuery))}</p>
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

            const displayName = isEn ? (node.nameEn || node.name) : node.name;
            const displaySub = isEn ? (node.subtitleEn || node.subtitle) : (node.subtitle || 'مبنى جامعي');

            card.innerHTML = `
                <div class="loc-card-icon">${iconSvg}</div>
                <div class="loc-card-content">
                    <div class="loc-card-title">${displayName}</div>
                    <div class="loc-card-desc">${displaySub}</div>
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
        try {
            localStorage.setItem('ecosort_user_location', nodeId);
        } catch (_) {}
        const node = this.graph.getNode(nodeId);

        // تحديث المظهر المرئي للبطاقات
        const allCards = document.querySelectorAll('.location-card');
        allCards.forEach(c => {
            const isMatch = c.getAttribute('data-node-id') === nodeId;
            c.classList.toggle('selected', isMatch);
            c.setAttribute('aria-checked', isMatch ? 'true' : 'false');
        });

        // تفعيل زر التالي وتحديث نصه باسم الكلية
        const btnNext = document.getElementById('btn-go-to-step-3');
        const btnNextText = document.getElementById('btn-go-to-step-3-text');
        const isEn = this.currentLang === 'en';
        const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
        const displayName = node ? (isEn ? (node.nameEn || node.name) : node.name) : '';

        if (btnNext) {
            btnNext.disabled = false;
        }
        if (btnNextText && displayName) {
            btnNextText.textContent = `${t.btnContinueToRoute || 'متابعة إلى المسار الأقرب'} (${displayName})`;
        }

        const hint = document.getElementById('selected-location-hint');
        if (hint && node) {
            const prefix = t.hintSelectedPrefix || (isEn ? 'Selected Location: ' : 'الموقع المختار: ');
            hint.innerHTML = `${prefix}<strong class="text-emerald-700">${displayName}</strong> &check;`;
        }

        this.updateStep1SavedLocationBanner();
        this.updateStep3RouteContext();

        if (this.currentStep === 3) {
            this.recalculateRoute();
        }
    }

    /**
     * ربط أزرار التنقل الأساسية بين الشاشات
     */
    bindWizardNavigation() {
        // شريط الخطوات العلوي (Stepper Tabs)
        for (let s = 1; s <= 3; s++) {
            const ind = document.getElementById(`stepper-step-${s}`);
            if (ind) {
                ind.addEventListener('click', () => this.goToStep(s));
                ind.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.goToStep(s);
                    }
                });
            }
        }

        // شاشة البداية 1: زرا البداية السريعة
        const btnHeroScan = document.getElementById('btn-hero-scan');
        if (btnHeroScan) {
            btnHeroScan.addEventListener('click', () => {
                const dropzone = document.getElementById('cv-dropzone');
                if (dropzone) {
                    dropzone.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                this.startCameraStream();
            });
        }

        const btnHeroFindBin = document.getElementById('btn-hero-find-bin');
        if (btnHeroFindBin) {
            btnHeroFindBin.addEventListener('click', () => this.goToStep(2));
        }

        // الشاشة 1: تغيير الموقع المحفوظ
        const btnChangeLoc1 = document.getElementById('btn-change-location-step1');
        if (btnChangeLoc1) {
            btnChangeLoc1.addEventListener('click', () => this.goToStep(2));
        }

        // الشاشة 1: الانتقال للخطوة التالية لتحديد الموقع إجبارياً
        const btnGoRoute = document.getElementById('btn-go-to-route');
        if (btnGoRoute) {
            btnGoRoute.addEventListener('click', () => {
                const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
                if (!this.currentWasteItem) {
                    this.showToast(t.toastErrWasteTitle || 'افحص المخلفات أولاً', t.toastErrWasteMsg || 'يرجى التقاط صورة أو اختيار خامة لتحديد أقرب حاوية.', 'uncertain');
                    return;
                }
                // إجباري: الانتقال دائماً إلى الخطوة 2 لتحديد الموقع
                this.goToStep(2);
            });
        }

        // الشاشة 2: العودة للفحص والمتابعة للمسار
        const btnBackStep1 = document.getElementById('btn-back-to-step-1');
        if (btnBackStep1) btnBackStep1.addEventListener('click', () => this.goToStep(1));

        const btnGoStep3 = document.getElementById('btn-go-to-step-3');
        if (btnGoStep3) {
            btnGoStep3.addEventListener('click', () => {
                const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
                if (!this.currentLocation) {
                    this.showToast(t.toastErrLocTitle || 'حدد موقعك أولاً', t.toastErrLocMsg || 'يرجى اختيار الكلية أو المنشأة التي تتواجد بها حالياً.', 'uncertain');
                    return;
                }
                if (!this.currentWasteItem) {
                    this.goToStep(1);
                    this.showToast(t.toastErrWasteTitle || 'افحص المخلفات أولاً', t.toastErrWasteMsg || 'يرجى التقاط صورة أو اختيار خامة لتحديد أقرب حاوية.', 'uncertain');
                    return;
                }
                this.goToStep(3);
            });
        }

        // الشاشة 3: تغيير الموقع، فحص قطعة أخرى، وبدء دليل المشي
        const btnChangeLoc3 = document.getElementById('btn-change-location-step3');
        if (btnChangeLoc3) btnChangeLoc3.addEventListener('click', () => this.goToStep(2));

        const handleRescan = () => {
            this.currentWasteItem = null;
            this.currentWasteType = null;
            this.currentLocation = null;
            this.goToStep(1);
        };
        const btnRescanStep3 = document.getElementById('btn-rescan-step3');
        if (btnRescanStep3) btnRescanStep3.addEventListener('click', handleRescan);

        const btnStartWalk = document.getElementById('btn-start-walking-guide');
        if (btnStartWalk) {
            btnStartWalk.addEventListener('click', () => this.handleSimulateRouteClick());
        }

        const btnRestartStep1 = document.getElementById('btn-restart-step-1');
        if (btnRestartStep1) btnRestartStep1.addEventListener('click', handleRescan);

        const btnScanAnotherBottom = document.getElementById('btn-scan-another-bottom');
        if (btnScanAnotherBottom) btnScanAnotherBottom.addEventListener('click', handleRescan);
    }

    /**
     * ربط أدوات الشاشة 2 (البحث، الفئات، ومحاكاة الموقع التقريبي)
     */
    bindStep1Controls() {
        // محاكاة الموقع التقريبي بالحرم الجامعي
        const btnGps = document.getElementById('btn-gps-simulate');
        if (btnGps) {
            btnGps.addEventListener('click', () => {
                const isEn = this.currentLang === 'en';
                btnGps.innerHTML = `
                    <span class="gps-pulse-ring"></span>
                    <span>${isEn ? 'Locating on campus...' : 'جارِ تحديد موقعك بالحرم...'}</span>
                `;
                btnGps.disabled = true;

                setTimeout(() => {
                    const sampleColleges = ['ai', 'eng', 'pharmacy', 'sci', 'fci'];
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

        // البحث النصي في الكليات مع زر المسح السريع
        const searchInput = document.getElementById('location-search-input');
        const btnClearSearch = document.getElementById('btn-clear-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                if (btnClearSearch) {
                    btnClearSearch.classList.toggle('hidden', this.searchQuery.length === 0);
                }
                this.renderLocationCards(this.activeCategoryFilter, this.searchQuery);
            });
        }

        if (btnClearSearch && searchInput) {
            btnClearSearch.addEventListener('click', () => {
                searchInput.value = '';
                this.searchQuery = '';
                btnClearSearch.classList.add('hidden');
                searchInput.focus();
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
                manualSelect.classList.remove('highlight-pulse');
                this.visionModule.selectPreset(wasteId);
                const btnGoRoute = document.getElementById('btn-go-to-route');
                if (btnGoRoute) btnGoRoute.disabled = false;
            });
        }

        // زر إعادة المحاولة داخل شريط التنبيه
        const btnBannerRetry = document.getElementById('btn-banner-retry');
        if (btnBannerRetry) {
            btnBannerRetry.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startCameraStream();
            });
        }

        // زر إعادة المحاولة داخل بطاقة الخطأ
        const btnScanErrorRetry = document.getElementById('btn-scan-error-retry');
        if (btnScanErrorRetry) {
            btnScanErrorRetry.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.lastUploadedFile) {
                    this.processUploadedFile(this.lastUploadedFile);
                } else if (fileInput) {
                    fileInput.click();
                }
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
            if (this.currentStep !== 1) return;
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
        this.lastUploadedFile = file;

        const dropzone = document.getElementById('cv-dropzone');
        const previewContainer = document.getElementById('cv-image-preview-container');
        const placeholder = document.getElementById('cv-upload-placeholder');
        const previewImg = document.getElementById('cv-uploaded-image');

        const skeletonCard = document.getElementById('card-inspection-skeleton');
        const errorCard = document.getElementById('card-inspection-error');
        const resultCard = document.getElementById('card-inspection-result');
        const awaitingNotice = document.getElementById('awaiting-scan-notice');

        // إظهار بطاقة التحميل الهيكلي وإخفاء الرسائل الأخرى
        if (awaitingNotice) awaitingNotice.classList.add('hidden');
        if (errorCard) errorCard.classList.add('hidden');
        if (resultCard) resultCard.classList.add('hidden');
        if (skeletonCard) {
            skeletonCard.classList.remove('hidden');
            skeletonCard.removeAttribute('aria-hidden');
        }

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
                if (skeletonCard) {
                    skeletonCard.classList.add('hidden');
                    skeletonCard.setAttribute('aria-hidden', 'true');
                }
                if (previewImg && detection.imageUrl) {
                    previewImg.src = detection.imageUrl;
                }

                this.handleWasteDetected(detection);

                const resCard = document.getElementById('card-inspection-result');
                if (resCard) {
                    resCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }

                // إظهار إشعار متوافق مع قرار التصنيف (confident, uncertain, rejected) ونسبة الثقة
                const isEn = this.currentLang === 'en';
                const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
                const itemName = (isEn && detection.item.nameEn) ? detection.item.nameEn : (detection.item.name || '');
                const confVal = detection.confidence != null ? detection.confidence : '--';

                let toastTitle, toastMsg, toastType;
                if (detection.decision === 'rejected') {
                    toastTitle = t.toastScanRejectedTitle || (isEn ? 'Low Confidence / Rejected ✕' : 'ثقة منخفضة / غير مؤكد ✕');
                    toastMsg = (t.toastScanRejectedMsg || (isEn ? 'Confidence {confidence}% is below threshold (45%). Please verify manually or retake a clearer photo.' : 'نسبة الثقة {confidence}% أقل من حد القبول (45%). يرجى التحقق يدوياً أو التقاط صورة أوضح.'))
                        .replace('{item}', itemName).replace('{confidence}', confVal);
                    toastType = 'rejected';
                } else if (detection.decision === 'uncertain') {
                    toastTitle = t.toastScanUncertainTitle || (isEn ? 'Medium Confidence Notice ⚠️' : 'تنبيه: ثقة متوسطة ⚠️');
                    toastMsg = (t.toastScanUncertainMsg || (isEn ? 'Predicted: {item} with {confidence}% confidence. Please verify or pick manually.' : 'النتيجة: {item} بنسبة ثقة {confidence}%. يرجى التحقق أو اختيار الخامة يدوياً.'))
                        .replace('{item}', itemName).replace('{confidence}', confVal);
                    toastType = 'uncertain';
                } else {
                    toastTitle = t.toastScanConfidentTitle || (isEn ? 'High-Confidence Detection ✓' : 'تم الفحص بثقة عالية ✓');
                    toastMsg = (t.toastScanConfidentMsg || (isEn ? 'Identified: {item} with {confidence}% confidence' : 'تم التعرف على: {item} بنسبة ثقة {confidence}%'))
                        .replace('{item}', itemName).replace('{confidence}', confVal);
                    toastType = 'confident';
                }

                this.showToast(toastTitle, toastMsg, toastType);
            }, 500);

        } catch (err) {
            if (dropzone) dropzone.classList.remove('scanning');
            if (skeletonCard) {
                skeletonCard.classList.add('hidden');
                skeletonCard.setAttribute('aria-hidden', 'true');
            }
            if (errorCard) errorCard.classList.remove('hidden');
            const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
            this.showToast(t.scanErrorTitle || 'تعذّر فحص الصورة', err.message || t.scanErrorDesc || 'حدث خطأ أثناء معالجة الصورة.', 'rejected');
        }
    }

    /**
     * معالجة حدث اكتشاف خامة بواسطة CV وتحديث كارت دليل المعالجة (IR)
     */
    handleWasteDetected(detection) {
        this.currentWasteItem = detection.item;
        this.currentWasteType = detection.item.binType;
        this.lastDetection = detection;

        // 0. إظهار كارت النتيجة وإخفاء رسالة الانتظار وبطاقة التحميل وبطاقة الخطأ
        const resultCard = document.getElementById('card-inspection-result');
        const awaitingNotice = document.getElementById('awaiting-scan-notice');
        const skeletonCard = document.getElementById('card-inspection-skeleton');
        const errorCard = document.getElementById('card-inspection-error');
        const btnGoRoute = document.getElementById('btn-go-to-route');

        if (awaitingNotice) awaitingNotice.classList.add('hidden');
        if (skeletonCard) {
            skeletonCard.classList.add('hidden');
            skeletonCard.setAttribute('aria-hidden', 'true');
        }
        if (errorCard) errorCard.classList.add('hidden');
        if (resultCard) {
            resultCard.classList.remove('hidden');
            resultCard.classList.add('card-fade-in');
        }

        // 1. تحديث بيانات المادة المكتشفة
        const nameElem = document.getElementById('cv-detected-material-name');
        const codeElem = document.getElementById('cv-detected-resin-code');
        const confidenceValElem = document.getElementById('cv-confidence-value');
        const confidenceBarElem = document.getElementById('cv-confidence-bar-fill');
        const textureElem = document.getElementById('cv-texture-description');
        const latencyElem = document.getElementById('cv-inference-latency');
        const marginDisplay = document.getElementById('cv-margin-display');
        const marginValue = document.getElementById('cv-margin-value');
        const binBadge = document.getElementById('ir-target-bin-badge');
        const manualSelect = document.getElementById('manual-waste-selector');

        const isEn = this.currentLang === 'en';
        const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
        const itemName = isEn ? (detection.item.nameEn || detection.item.name) : detection.item.name;

        if (nameElem) nameElem.textContent = itemName;
        if (codeElem) codeElem.textContent = detection.item.resinCode || detection.item.category;

        // نسبة الثقة وزمن الاستدلال
        if (detection.isPreset) {
            if (confidenceValElem) confidenceValElem.textContent = isEn ? 'Verified Demo' : 'عينة تجريبية';
            if (confidenceBarElem) {
                confidenceBarElem.style.width = '100%';
                confidenceBarElem.style.background = 'linear-gradient(90deg, #64748b, #94a3b8)';
            }
            if (latencyElem) latencyElem.textContent = isEn ? 'N/A (Preset)' : 'غير منطبق (عينة)';
            if (marginDisplay) marginDisplay.classList.add('hidden');
        } else {
            if (confidenceValElem) confidenceValElem.textContent = `${detection.confidence}%`;
            if (confidenceBarElem) {
                const confClamped = Math.min(100, Math.max(0, detection.confidence));
                confidenceBarElem.style.width = `${confClamped}%`;
                confidenceBarElem.style.background = detection.confidence >= 75
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : (detection.confidence >= 45 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #ef4444, #dc2626)');
            }
            if (latencyElem) latencyElem.textContent = `${detection.inferenceTimeMs} ms`;
            if (marginDisplay && detection.margin != null) {
                marginDisplay.classList.remove('hidden');
                if (marginValue) marginValue.textContent = `${detection.margin}%`;
            } else if (marginDisplay) {
                marginDisplay.classList.add('hidden');
            }
        }

        if (textureElem) {
            textureElem.textContent = isEn 
                ? (detection.item.textureDescriptionEn || detection.texture || '') 
                : (detection.item.textureDescription || detection.texture || '');
        }

        if (manualSelect && detection.item && detection.item.id) {
            manualSelect.value = detection.item.id;
        }

        if (binBadge) {
            binBadge.textContent = isEn ? (detection.item.binColorNameEn || detection.item.binColorName) : detection.item.binColorName;
            binBadge.style.backgroundColor = detection.item.binColorHex || '#10b981';
            binBadge.style.color = '#ffffff';
        }

        const activeModelTag = document.getElementById('cv-active-model-tag');
        if (activeModelTag && detection.modelName) {
            activeModelTag.textContent = detection.modelName;
        }

        const previewStatusText = document.getElementById('cv-preview-status-text');
        if (previewStatusText) {
            if (detection.isPreset) {
                previewStatusText.textContent = isEn ? 'Reference sample loaded ✓' : 'تم تحميل العينة المرجعية ✓';
            } else {
                const modelLabel = EcoSortApp.escapeHtml(detection.modelName || (isEn ? 'AI' : 'الذكاء الاصطناعي'));
                previewStatusText.innerHTML = isEn
                    ? `Classified via <bdi dir="ltr">${modelLabel}</bdi> ✓`
                    : `تم الاستدلال بنجاح عبر <bdi dir="ltr">${modelLabel}</bdi> ✓`;
            }
        }

        // 2. تحديث خطوات الإعداد الصحيح ومؤشرات توفير الكربون (IR)
        const stepsContainer = document.getElementById('ir-handling-steps');
        const co2Elem = document.getElementById('ir-co2-savings-value');
        const energyElem = document.getElementById('ir-energy-savings-value');
        const waterElem = document.getElementById('ir-water-savings-value');

        if (stepsContainer) {
            const steps = (isEn && detection.item.properHandlingEn && detection.item.properHandlingEn.length > 0)
                ? detection.item.properHandlingEn
                : (detection.item.properHandling || []);
            stepsContainer.innerHTML = steps.map((step, idx) => `
                <li class="handling-step-item">
                    <span class="step-num">${idx + 1}</span>
                    <span class="step-text">${EcoSortApp.escapeHtml(step)}</span>
                </li>
            `).join('');
        }

        if (co2Elem) co2Elem.textContent = `${detection.item.carbonSavingsGrams || 85} ${isEn ? 'g CO₂' : 'جم CO₂'}`;
        if (energyElem) energyElem.textContent = isEn ? (detection.item.energySavingsEn || detection.item.energySavings) : (detection.item.energySavings || '3.5 ساعة إضاءة');
        if (waterElem) waterElem.textContent = `${detection.item.waterSavingsLiters || 2.5} ${isEn ? 'L clean water' : 'لتر مياه نقية'}`;

        // 3. تحذيرات جودة الصورة (Quality Warnings)
        const warningsBox = document.getElementById('cv-quality-warnings-box');
        const warningsList = document.getElementById('cv-quality-warnings-list');
        if (warningsBox && warningsList) {
            warningsList.innerHTML = '';
            const warnings = detection.qualityWarnings || [];
            if (warnings.length > 0) {
                const warnMap = {
                    'image_blurry': isEn ? 'Image is slightly blurry or out of focus (Blur).' : (t.warnBlur || 'الصورة بها غبشة أو اهتزاز حركي (Blur)'),
                    'image_too_dark': isEn ? 'Lighting is too dark or underexposed (Dark).' : (t.warnDark || 'الإضاءة منخفضة جداً (Dark)'),
                    'image_too_bright': isEn ? 'Lighting is too bright or overexposed (Overexposed).' : (t.warnBright || 'الإضاءة شديدة أو بها سطوع زائد (Overexposed)'),
                    'image_empty_or_flat': isEn ? 'Image is blank or flat with low color contrast (Low Variance).' : (t.warnFlat || 'الصورة فارغة أو شبه موحدة اللون (Low Variance)'),
                    'IMAGE_BLURRY': isEn ? 'Image is slightly blurry or out of focus (Blur).' : (t.warnBlur || 'الصورة بها غبشة أو اهتزاز حركي (Blur)'),
                    'IMAGE_TOO_DARK': isEn ? 'Lighting is too dark or underexposed (Dark).' : (t.warnDark || 'الإضاءة منخفضة جداً (Dark)'),
                    'IMAGE_TOO_BRIGHT': isEn ? 'Lighting is too bright or overexposed (Overexposed).' : (t.warnBright || 'الإضاءة شديدة أو بها سطوع زائد (Overexposed)'),
                    'IMAGE_LOW_VARIANCE': isEn ? 'Image is blank or flat with low color contrast (Low Variance).' : (t.warnFlat || 'الصورة فارغة أو شبه موحدة اللون (Low Variance)')
                };
                const genericWarning = isEn ? 'Image quality note detected. Please retake photo with good lighting.' : (t.warnGeneric || 'تم رصد ملاحظة على جودة الصورة، يُرجى إعادة التصوير في إضاءة مناسبة.');
                warnings.forEach(w => {
                    const li = document.createElement('li');
                    li.textContent = warnMap[w] || warnMap[(w || '').toLowerCase()] || genericWarning;
                    warningsList.appendChild(li);
                });
                warningsBox.classList.remove('hidden');
            } else {
                warningsBox.classList.add('hidden');
            }
        }

        // 4. أعلى 3 احتمالات بديلة (Top-3)
        const topKContainer = document.getElementById('cv-top-k-container');
        const topKList = document.getElementById('cv-top-k-list');
        if (topKContainer && topKList) {
            topKList.innerHTML = '';
            const topK = detection.topK || [];
            if (!detection.isPreset && topK.length > 0) {
                topK.forEach((cand, idx) => {
                    const row = document.createElement('div');
                    row.className = 'top-k-item';

                    const meta = document.createElement('div');
                    meta.className = 'top-k-meta';

                    const label = document.createElement('span');
                    label.textContent = isEn ? cand.materialNameEn : cand.materialNameAr;

                    const score = document.createElement('strong');
                    score.textContent = cand.confidenceFormatted || `${cand.confidence}%`;

                    meta.appendChild(label);
                    meta.appendChild(score);

                    const barWrap = document.createElement('div');
                    barWrap.className = 'top-k-bar';

                    const fill = document.createElement('div');
                    fill.className = `top-k-fill ${idx === 0 ? 'first-place' : ''}`;
                    fill.style.width = `${Math.min(100, Math.max(0, cand.confidence))}%`;

                    barWrap.appendChild(fill);
                    row.appendChild(meta);
                    row.appendChild(barWrap);
                    topKList.appendChild(row);
                });
                topKContainer.classList.remove('hidden');
            } else {
                topKContainer.classList.add('hidden');
            }
        }

        // 5. اتخاذ القرار والتحكم بعناصر الواجهة حسب Decision (B2)
        const decisionBanner = document.getElementById('cv-decision-banner');
        const decisionIcon = document.getElementById('cv-decision-banner-icon');
        const decisionTitle = document.getElementById('cv-decision-banner-title');
        const decisionDesc = document.getElementById('cv-decision-banner-desc');
        const bannerActions = document.getElementById('cv-decision-banner-actions');
        const photoAdviceBox = document.getElementById('cv-photo-advice-box');
        const candidateContainer = document.getElementById('cv-candidate-chips-container');
        const candidatePrompt = document.getElementById('cv-candidate-prompt');
        const candidateGrid = document.getElementById('cv-candidate-chips-grid');

        const detectionTopRow = document.querySelector('.detection-top-row');
        const textureBox = document.querySelector('.texture-box');
        const irDetailsSplit = document.querySelector('.ir-details-split');
        const techDisclosure = document.getElementById('cv-tech-details-disclosure');

        if (decisionBanner) {
            decisionBanner.classList.remove('hidden', 'decision-banner-confident', 'decision-banner-uncertain', 'decision-banner-rejected');
            if (manualSelect) manualSelect.classList.remove('highlight-pulse');

            if (detection.isPreset || detection.decision === 'confident') {
                decisionBanner.classList.add('decision-banner-confident');
                if (decisionIcon) decisionIcon.textContent = detection.isPreset ? '📋' : (detection.isUserConfirmed ? '👌' : '✅');
                if (decisionTitle) {
                    decisionTitle.textContent = detection.isPreset 
                        ? (isEn ? 'Verified Reference Preset' : 'عينة مرجعية تجريبية') 
                        : (detection.isUserConfirmed 
                            ? (isEn ? 'User-Confirmed Classification' : 'تصنيف مؤكد باختيارك')
                            : (t.decisionConfidentTitle || 'تصنيف مؤكد من الذكاء الاصطناعي'));
                }
                if (decisionDesc) {
                    decisionDesc.textContent = detection.isPreset 
                        ? (isEn ? 'Selected directly from verified campus catalog for testing without running AI.' : 'تم اختيار هذه الخامة مباشرة كعينة اختبار موثقة لقاعدة بيانات الحرم الجامعي.') 
                        : (detection.isUserConfirmed 
                            ? (isEn ? 'You confirmed this material from candidates; routing and carbon metrics updated.' : 'تم تأكيد هذه المادة من بين الترشيحات وتحديث مسار التوجيه وحسابات التوفير البيئي.')
                            : (t.decisionConfidentDesc || 'تم التعرف على نوع الخامة بنسبة ثقة عالية وهامش أمان كافٍ.'));
                }
                if (bannerActions) bannerActions.classList.add('hidden');
                if (photoAdviceBox) photoAdviceBox.classList.add('hidden');
                if (candidateContainer) candidateContainer.classList.add('hidden');

                // إظهار كافة التفاصيل
                if (detectionTopRow) detectionTopRow.classList.remove('hidden');
                if (textureBox) textureBox.classList.remove('hidden');
                if (irDetailsSplit) irDetailsSplit.classList.remove('hidden');
                if (techDisclosure) techDisclosure.classList.remove('hidden');

                if (btnGoRoute) btnGoRoute.disabled = false;

            } else if (detection.decision === 'uncertain') {
                decisionBanner.classList.add('decision-banner-uncertain');
                if (decisionIcon) decisionIcon.textContent = '⚠️';
                if (decisionTitle) decisionTitle.textContent = t.decisionUncertainTitle || 'تنبيه: النموذج غير متأكد تماماً';
                if (decisionDesc) decisionDesc.textContent = t.decisionUncertainDesc || 'نسبة الثقة أو هامش التمييز منخفض. يُرجى التحقق من الخيارات أدناه أو اختيار الخامة يدوياً.';
                if (bannerActions) bannerActions.classList.remove('hidden');
                if (photoAdviceBox) photoAdviceBox.classList.remove('hidden');
                if (manualSelect) manualSelect.classList.add('highlight-pulse');

                // إظهار التفاصيل
                if (detectionTopRow) detectionTopRow.classList.remove('hidden');
                if (textureBox) textureBox.classList.remove('hidden');
                if (irDetailsSplit) irDetailsSplit.classList.remove('hidden');
                if (techDisclosure) techDisclosure.classList.remove('hidden');

                // عرض رقائق الترشيحات (Top-3 Candidate Chips)
                if (candidateContainer && candidateGrid) {
                    const promptTpl = t.candidatePrompt || (isEn ? 'Is this item {material}? Tap to confirm:' : 'هل هذه القطعة {material}؟ اضغط للتأكيد:');
                    if (candidatePrompt) candidatePrompt.textContent = promptTpl.replace('{material}', itemName);

                    candidateGrid.innerHTML = '';
                    const candidates = (detection.topK && detection.topK.length > 0) ? detection.topK : [];
                    candidates.forEach(cand => {
                        const chipBtn = document.createElement('button');
                        chipBtn.type = 'button';
                        chipBtn.className = 'candidate-chip-btn';
                        const candName = isEn ? cand.materialNameEn : cand.materialNameAr;
                        const candConf = cand.confidenceFormatted || `${cand.confidence}%`;
                        chipBtn.innerHTML = `<span>${candName}</span> <strong class="chip-conf">(${candConf})</strong>`;
                        chipBtn.addEventListener('click', () => {
                            const applied = this.confirmCandidateSelection(cand);
                            if (applied && btnGoRoute) {
                                btnGoRoute.disabled = false;
                            }
                        });
                        candidateGrid.appendChild(chipBtn);
                    });
                    candidateContainer.classList.remove('hidden');
                }

                // الزر يبقى معطلاً حتى يختار المستخدم تأكيداً أو يختار من القائمة اليدوية
                if (btnGoRoute) btnGoRoute.disabled = true;

            } else { // rejected
                decisionBanner.classList.add('decision-banner-rejected');
                if (decisionIcon) decisionIcon.textContent = '❌';
                if (decisionTitle) decisionTitle.textContent = t.decisionRejectedTitle || 'تنبيه: تعذّر التعرف على الجسم بدقة مقبولة';
                if (decisionDesc) decisionDesc.textContent = t.decisionRejectedDesc || 'الصورة غير واضحة أو أن المادة غير مصنفة بدقة. يُرجى إعادة التقاط الصورة أو اختيار الخامة يدوياً من القائمة.';
                if (bannerActions) bannerActions.classList.remove('hidden');
                if (photoAdviceBox) photoAdviceBox.classList.remove('hidden');
                if (candidateContainer) candidateContainer.classList.add('hidden');
                if (manualSelect) manualSelect.classList.add('highlight-pulse');

                // B2: إخفاء تفاصيل المادة الخاطئة وانبعاثات الكربون ودليل التدوير حتى لا يتم تضليل المستخدم
                if (detectionTopRow) detectionTopRow.classList.add('hidden');
                if (textureBox) textureBox.classList.add('hidden');
                if (irDetailsSplit) irDetailsSplit.classList.add('hidden');
                if (techDisclosure) techDisclosure.classList.add('hidden');

                // إبقاء زر التوجيه معطلاً حتى اختيار خامة يدوية
                if (btnGoRoute) btnGoRoute.disabled = true;
            }
        }
    }

    /**
     * تطبيق تصحيح ترشيح مؤكد بواسطة المستخدم في حالة عدم التأكد (Uncertain State)
     * @param {Object} cand - كائن الترشيح المختار من Top-K
     */
    confirmCandidateSelection(cand) {
        if (!cand || !cand.materialId) return false;
        const chosenItem = (window.WASTE_DATABASE || []).find(w => w.id === cand.materialId);
        if (!chosenItem) return false;

        const currentDet = this.lastDetection || {};
        const updatedDetection = {
            ...currentDet,
            item: chosenItem,
            isPreset: false,
            isUserConfirmed: true,
            decision: 'confident',
            confidence: cand.confidence != null ? cand.confidence : currentDet.confidence,
            confidenceFormatted: cand.confidenceFormatted || currentDet.confidenceFormatted,
            topK: currentDet.topK || [],
            sourceType: 'user-confirmed-candidate',
            opticalFeatures: `تأكيد المستخدم: تم اعتماد الخامة "${chosenItem.name}" بناءً على ترشيحات الموديل (${cand.confidenceFormatted || (cand.confidence + '%')})`
        };

        this.handleWasteDetected(updatedDetection);
        const isEn = this.currentLang === 'en';
        const msg = isEn 
            ? `Confirmed: ${chosenItem.nameEn || chosenItem.name}` 
            : `تم تأكيد الخامة: ${chosenItem.name}`;
        this.showToast(msg, 'success');
        return true;
    }

    /**
     * تحديث اسم الموقع في شريط الشاشة الثانية
     */
    updateStep2LocationBadge() {
        const textElem = document.getElementById('step2-current-location-text');
        if (textElem && this.currentLocation) {
            const node = this.graph.getNode(this.currentLocation);
            if (node) {
                const isEn = this.currentLang === 'en';
                const name = isEn ? (node.nameEn || node.name) : node.name;
                const sub = isEn ? (node.subtitleEn || node.subtitle) : node.subtitle;
                textElem.textContent = sub ? `${name} (${sub})` : name;
            } else {
                textElem.textContent = this.currentLocation;
            }
        }
    }

    /**
     * تحديث سياق المسار في شريط الشاشة الثالثة
     */
    updateStep3RouteContext() {
        const startElem = document.getElementById('step3-start-node-name');
        const wasteElem = document.getElementById('step3-waste-name');
        const isEn = this.currentLang === 'en';

        if (startElem && this.currentLocation) {
            const node = this.graph.getNode(this.currentLocation);
            startElem.textContent = node ? (isEn ? (node.nameEn || node.name) : node.name) : this.currentLocation;
        }

        if (wasteElem && this.currentWasteItem) {
            wasteElem.textContent = isEn ? (this.currentWasteItem.nameEn || this.currentWasteItem.name) : this.currentWasteItem.name;
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

        // 4. بناء قائمة إرشادات السير خطوة بخطوة (Turn-by-turn walking steps)
        this.renderWalkingStepsList(activeResult.path, activeResult.targetNodeId);
    }

    /**
     * بناء قائمة إرشادات السير خطوة بخطوة لمستخدمي قارئات الشاشة والطلاب
     */
    renderWalkingStepsList(path, targetNodeId) {
        const listElem = document.getElementById('metric-walking-steps-list');
        const summaryElem = document.getElementById('metric-path-summary');
        if (!listElem) return;

        listElem.innerHTML = '';
        const isEn = this.currentLang === 'en';

        if (!path || path.length === 0) {
            if (summaryElem) summaryElem.textContent = isEn ? 'No reachable route available' : 'لا يوجد مسار متاح حالياً';
            return;
        }

        if (path.length === 1) {
            const node = this.graph.getNode(path[0]);
            const nodeName = node ? (isEn ? (node.nameEn || node.name) : node.name) : path[0];
            if (summaryElem) {
                summaryElem.textContent = isEn 
                    ? `You are directly in front of the matching bin at ${nodeName}!`
                    : `أنت متواجد بالفعل عند أقرب حاوية متاحة في موقعك الحالي (${nodeName})!`;
            }
            const li = document.createElement('li');
            li.className = 'walking-step-item';
            li.innerHTML = isEn
                ? `<strong>Direct Arrival:</strong> The appropriate waste sorting bin is inside or right next to ${nodeName}.`
                : `<strong>وصول مباشر:</strong> حاوية الفرز المطلوبة متوفرة مباشرة داخل أو بجوار ${nodeName}.`;
            listElem.appendChild(li);
            return;
        }

        // المسار يتكون من عقدتين أو أكثر
        if (summaryElem) {
            const names = path.map(id => {
                const n = this.graph.getNode(id);
                return n ? (isEn ? (n.nameEn || n.name) : n.name) : id;
            });
            const arrow = isEn ? ' &rarr; ' : ' &larr; ';
            summaryElem.innerHTML = names.join(`<span class="text-emerald-600 font-bold">${arrow}</span>`);
        }

        path.forEach((nodeId, idx) => {
            const node = this.graph.getNode(nodeId);
            const name = node ? (isEn ? (node.nameEn || node.name) : node.name) : nodeId;
            const li = document.createElement('li');
            li.className = 'walking-step-item';

            if (idx === 0) {
                li.innerHTML = isEn 
                    ? `<strong>Start:</strong> Begin walking from <strong>${name}</strong>.`
                    : `<strong>نقطة الانطلاق:</strong> ابدأ التحرك من <strong>${name}</strong>.`;
            } else if (idx === path.length - 1) {
                const binColor = this.currentWasteItem ? (isEn ? this.currentWasteItem.binColorNameEn : this.currentWasteItem.binColorName) : (isEn ? 'designated' : 'المخصصة');
                li.innerHTML = isEn
                    ? `<strong>Arrival:</strong> Reach <strong>${name}</strong> & deposit waste into the <strong>${binColor}</strong> bin.`
                    : `<strong>نقطة الوصول:</strong> ستصل إلى <strong>${name}</strong>، قم بإيداع المخلفات في <strong>${binColor}</strong>.`;
            } else {
                li.innerHTML = isEn
                    ? `Continue along corridor past <strong>${name}</strong>.`
                    : `تابع السير عبر الممر مروراً بـ <strong>${name}</strong>.`;
            }
            listElem.appendChild(li);
        });
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
        const isEn = this.currentLang === 'en';

        if (targetNode) {
            const name = isEn ? (targetNode.nameEn || targetNode.name) : targetNode.name;
            if (targetTitleElem) targetTitleElem.textContent = name;
            if (mobileTargetName) mobileTargetName.textContent = name;

            if (targetDescElem) {
                const bin = targetNode.bins.find(b => {
                    if (this.currentWasteType === 'plastic' || this.currentWasteType === 'pet' || this.currentWasteType === 'hdpe') {
                        return (b.type === 'plastic' || b.type === 'pet' || b.type === 'hdpe') && b.available;
                    }
                    return b.type === this.currentWasteType && b.available;
                });
                const binLabel = isEn ? (bin ? (bin.labelEn || bin.label) : 'Available sorting bin') : (bin ? bin.label : 'حاوية متاحة');
                targetDescElem.textContent = bin 
                    ? (isEn ? `${binLabel} (Available - Current capacity: ${bin.capacity}%)` : `${bin.label} (متاحة - نسبة الامتلاء الحالية: ${bin.capacity}%)`) 
                    : (isEn ? 'Available matching sorting bin' : 'حاوية متاحة');
            }
        }

        if (mobileTargetDist) {
            const unit = isEn ? 'm' : 'م';
            mobileTargetDist.textContent = totalDistance === Infinity ? (isEn ? 'Unreachable' : 'غير متصل') : `${totalDistance} ${unit}`;
        }
        if (mobileWalkingTime) {
            const mins = totalDistance === Infinity ? '-' : (totalDistance / 80).toFixed(1);
            mobileWalkingTime.textContent = isEn ? `(${mins} min walk)` : `(${mins} د مشي)`;
        }

        const btnMobileSimulateText = document.getElementById('btn-mobile-simulate-text');
        const btnDesktopSimulateText = document.getElementById('btn-simulate-route-text');
        if (totalDistance === 0) {
            if (btnMobileSimulateText) btnMobileSimulateText.textContent = isEn ? 'Deposit Waste Here (0m)' : 'إيداع المخلفات في موقعك (0 م)';
            if (btnDesktopSimulateText) btnDesktopSimulateText.textContent = isEn ? 'Deposit Waste (0m)' : 'إيداع المخلفات هنا (0 م)';
        } else {
            if (btnMobileSimulateText) btnMobileSimulateText.textContent = isEn ? 'Simulate Path Walk' : 'محاكاة السير في المسار';
            if (btnDesktopSimulateText) btnDesktopSimulateText.textContent = isEn ? 'Simulate Walk' : 'محاكاة السير';
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

        const isEn = this.currentLang === 'en';
        const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};
        const title = t.toastArrivedTitle || (isEn ? 'Arrived at Bin Successfully! ♻️' : '🎉 تم الوصول للحاوية بنجاح!');
        const savedCo2 = this.currentWasteItem ? (this.currentWasteItem.carbonSavingsGrams || 85) : 85;
        const msg = isEn 
            ? `Carbon emission savings (${savedCo2}g CO₂) registered to your eco balance.`
            : `تم تسجيل توفير ${savedCo2} جم CO₂ في رصيدك البيئي.`;
        this.showToast(title, msg, 'arrival');
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
     * يتم إلغاء أي مؤقتات توست سابقة حتى لا تتكدس الرسائل القديمة أو تختفي مبكراً
     * @param {string} title 
     * @param {string} message 
     * @param {'confident'|'uncertain'|'rejected'|'arrival'|'info'} type 
     */
    showToast(title, message, type = 'info') {
        const toast = document.getElementById('eco-toast-notification');
        const titleElem = document.getElementById('toast-title');
        const msgElem = document.getElementById('toast-message');
        const iconElem = document.getElementById('toast-icon');

        if (!toast) return;

        // إلغاء أي مؤقت توست نشط لتجنب التداخل والتلاشي المبكر
        if (this._toastTimer) clearTimeout(this._toastTimer);
        if (this._toastHideTimer) clearTimeout(this._toastHideTimer);

        if (titleElem) titleElem.textContent = title;
        if (msgElem) msgElem.textContent = message;

        // تحديث أيقونة التوست
        if (iconElem) {
            if (type === 'confident') iconElem.textContent = '✅';
            else if (type === 'uncertain') iconElem.textContent = '⚠️';
            else if (type === 'rejected') iconElem.textContent = '❌';
            else if (type === 'arrival') iconElem.textContent = '🎉';
            else iconElem.textContent = '💡';
        }

        // تحديث الصنف اللوني حسب نوع التنبيه
        toast.classList.remove('toast-confident', 'toast-uncertain', 'toast-rejected', 'toast-arrival');
        if (type) toast.classList.add(`toast-${type}`);

        toast.classList.remove('hidden');
        requestAnimationFrame(() => toast.classList.add('toast-show'));

        this._toastTimer = setTimeout(() => {
            toast.classList.remove('toast-show');
            this._toastHideTimer = setTimeout(() => toast.classList.add('hidden'), 350);
        }, 4000);
    }

    /**
     * نافذة تعديل ومراقبة حاويات الكلية (Modal)
     */
    /**
     * نافذة تعديل ومراقبة حاويات الكلية (Modal) مع إدارة التركيز (WCAG 2.1 AA)
     */
    openNodeModal(node) {
        this.selectedNodeForModal = node;
        this.lastActiveElement = document.activeElement;

        const modal = document.getElementById('node-details-modal');
        const title = document.getElementById('modal-node-title');
        const subtitle = document.getElementById('modal-node-subtitle');
        const binsList = document.getElementById('modal-node-bins-list');

        if (!modal) return;

        const isEn = this.currentLang === 'en';
        const t = (window.ECOSORT_TRANSLATIONS && window.ECOSORT_TRANSLATIONS[this.currentLang]) || window.ECOSORT_TRANSLATIONS?.ar || {};

        if (title) title.textContent = isEn ? (node.nameEn || node.name) : node.name;
        if (subtitle) subtitle.textContent = isEn ? (node.subtitleEn || node.subtitle) : (node.subtitle || t.modalSubtitle);

        if (binsList) {
            binsList.innerHTML = node.bins.map(bin => {
                const statusBadge = bin.available 
                    ? `<span class="badge badge-success">${t.modalBinAvail || '🟢 متاحة'}</span>` 
                    : `<span class="badge badge-danger">${t.modalBinFull || '🔴 ممتلئة'}</span>`;
                
                const btnLabel = bin.available ? (t.modalToggleToFull || 'تغيير إلى ممتلئة') : (t.modalToggleToAvail || 'تغيير إلى متاحة');
                const btnClass = bin.available ? 'btn-danger-sm' : 'btn-success-sm';
                const binLabel = isEn ? (bin.labelEn || bin.label) : bin.label;
                const capPrefix = t.modalCapacityPrefix || 'سعة الامتلاء الحالية: ';

                return `
                    <div class="modal-bin-item">
                        <div class="bin-desc">
                            <strong>${binLabel}</strong>
                            <div class="text-xs text-gray-500">${capPrefix}${bin.capacity}%</div>
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
        const closeBtn = document.getElementById('btn-close-node-modal');
        if (closeBtn) closeBtn.focus();
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
        if (this.lastActiveElement && typeof this.lastActiveElement.focus === 'function') {
            this.lastActiveElement.focus();
            this.lastActiveElement = null;
        }
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

        // إغلاق النافذة بزر Escape وحصر التركيز داخلها (Focus Trap)
        document.addEventListener('keydown', (e) => {
            if (!modal || modal.classList.contains('hidden')) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeNodeModal();
                return;
            }

            if (e.key === 'Tab') {
                const focusables = modal.querySelectorAll('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];

                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });
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
        const isEn = lang === 'en';
        document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        document.title = t.pageTitle;

        // نص زر اللغة
        const langBtnText = document.getElementById('lang-btn-text');
        if (langBtnText) langBtnText.textContent = t.langBtnText;

        // الهيدر والشعار
        const brandTitleUniv = document.getElementById('brand-title-university');
        if (brandTitleUniv) brandTitleUniv.innerHTML = t.brandTitleHtml;
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
        const btnNextStep2 = document.getElementById('btn-go-to-step-2-text');
        const step1Subtitle = document.getElementById('step-1-subtitle');

        if (step1Title) step1Title.textContent = t.step1HeroTitle;
        if (step1Desc) step1Desc.textContent = t.step1HeroDesc;
        if (btnGpsText) btnGpsText.textContent = t.btnGps;
        if (searchInput) {
            searchInput.placeholder = t.searchPlaceholder;
            searchInput.setAttribute('aria-label', t.searchAriaLabel);
        }
        if (step1Subtitle) step1Subtitle.textContent = t.step1Subtitle;
        if (btnNextStep2) btnNextStep2.textContent = t.btnNextStep2;

        // تلميح الموقع المختار في الخطوة 1
        const hint = document.getElementById('selected-location-hint');
        if (hint) {
            if (this.currentLocation) {
                const node = this.graph.getNode(this.currentLocation);
                const displayName = isEn ? (node?.nameEn || node?.name) : node?.name;
                const prefix = t.hintSelectedPrefix || (isEn ? 'Selected Location: ' : 'الموقع المختار: ');
                hint.innerHTML = `${prefix}<strong class="text-emerald-700">${displayName}</strong> &check;`;
            } else {
                hint.textContent = t.hintNoLocation;
            }
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

        // إعادة توليد بطاقات الكليات
        this.renderLocationCards();

        // 0. A4: Comprehensive data-i18n automatic translation pass
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key] !== undefined) {
                if (key.endsWith('Html')) {
                    el.innerHTML = t[key];
                } else {
                    el.textContent = t[key];
                }
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (t[key] !== undefined) el.placeholder = t[key];
        });
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            if (t[key] !== undefined) el.setAttribute('aria-label', t[key]);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (t[key] !== undefined) el.setAttribute('title', t[key]);
        });
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            if (t[key] !== undefined) el.innerHTML = t[key];
        });

        // الخطوة 2
        const step2LocBannerLabel = document.getElementById('step2-current-location-banner-label') || document.getElementById('step2-loc-banner-label');
        const btnChangeLocStep2 = document.getElementById('btn-change-location-step2');
        const step2Title = document.getElementById('step-2-title');
        const step2Subtitle = document.getElementById('step-2-subtitle');
        const cvBadgeText = document.getElementById('cv-badge-text');
        const btnTriggerCameraText = document.getElementById('btn-trigger-camera-text');
        const btnTriggerUploadText = document.getElementById('btn-trigger-upload-text');
        const cvDropzoneText = document.getElementById('cv-dropzone-text');
        const cvDropzoneHint = document.getElementById('cv-dropzone-hint');
        const btnCameraCaptureText = document.getElementById('btn-camera-capture-text');
        const btnCameraSwitchText = document.getElementById('btn-camera-switch-text');
        const btnCameraCloseText = document.getElementById('btn-camera-close-text');
        const previewStatusText = document.getElementById('cv-preview-status-text');
        const btnRescanCameraText = document.getElementById('btn-rescan-camera-text');
        const btnReuploadText = document.getElementById('btn-reupload-image-text') || document.getElementById('btn-reupload-text');
        const awaitingTitle = document.getElementById('awaiting-scan-title');
        const awaitingDesc = document.getElementById('awaiting-scan-desc');
        const inspectionResultTitle = document.getElementById('inspection-result-title');
        const inspectionResultSubtitle = document.getElementById('inspection-result-subtitle');
        const manualSelector = document.getElementById('manual-waste-selector');
        const btnBannerRetryText = document.getElementById('btn-banner-retry-text');
        const cvQualityWarningsTitle = document.getElementById('cv-quality-warnings-title');
        const photoAdviceTitle = document.getElementById('cv-photo-advice-title') || document.getElementById('photo-advice-title');
        const photoAdviceTip1 = document.getElementById('photo-advice-1') || document.getElementById('photo-advice-tip-1');
        const photoAdviceTip2 = document.getElementById('photo-advice-2') || document.getElementById('photo-advice-tip-2');
        const photoAdviceTip3 = document.getElementById('photo-advice-3') || document.getElementById('photo-advice-tip-3');
        const cvDetectedMatLabel = document.getElementById('cv-detected-material-label') || document.getElementById('cv-detected-mat-label');
        const cvTargetBinLabel = document.getElementById('ir-target-bin-label') || document.getElementById('cv-target-bin-label');
        const cvConfidenceLabel = document.getElementById('cv-confidence-label');
        const cvLatencyLabel = document.getElementById('cv-latency-label');
        const cvMarginLabel = document.getElementById('cv-margin-label');
        const cvTopKTitle = document.getElementById('cv-top-k-heading') || document.getElementById('cv-top-k-title');
        const cvTextureLabel = document.getElementById('cv-texture-label');
        const irHandlingLabel = document.getElementById('ir-handling-label');
        const irCo2KpiLabel = document.getElementById('ir-co2-label') || document.getElementById('ir-co2-kpi-label');
        const irEnergyKpiLabel = document.getElementById('ir-energy-label') || document.getElementById('ir-energy-kpi-label');
        const irWaterKpiLabel = document.getElementById('ir-water-label') || document.getElementById('ir-water-kpi-label');
        const btnBackStep1Text = document.getElementById('btn-back-to-step-1-text');
        const btnGoStep3Text = document.getElementById('btn-go-to-step-3-text');

        if (step2LocBannerLabel) step2LocBannerLabel.textContent = t.step2BannerLoc;
        if (btnChangeLocStep2) btnChangeLocStep2.textContent = t.btnChangeLoc;
        if (step2Title) step2Title.textContent = t.step2Title;
        if (step2Subtitle) step2Subtitle.textContent = t.step2Subtitle;
        if (cvBadgeText) cvBadgeText.textContent = t.cvBadge;
        if (btnTriggerCameraText) btnTriggerCameraText.textContent = t.btnTriggerCamera;
        if (btnTriggerUploadText) btnTriggerUploadText.textContent = t.btnTriggerUpload;
        if (cvDropzoneText) cvDropzoneText.textContent = t.dropzoneText;
        if (cvDropzoneHint) cvDropzoneHint.textContent = t.dropzoneHint;
        if (btnCameraCaptureText) btnCameraCaptureText.textContent = t.btnCaptureNow;
        if (btnCameraSwitchText) btnCameraSwitchText.textContent = t.btnSwitchCamera;
        if (btnCameraCloseText) btnCameraCloseText.textContent = t.btnCloseCamera;
        if (previewStatusText && !this.lastDetection) previewStatusText.textContent = t.previewStatus;
        if (btnRescanCameraText) btnRescanCameraText.textContent = t.btnRescanCamera;
        if (btnReuploadText) btnReuploadText.textContent = t.btnReupload;
        if (awaitingTitle) awaitingTitle.textContent = t.awaitingTitle;
        if (awaitingDesc) awaitingDesc.textContent = t.awaitingDesc;
        if (inspectionResultTitle) inspectionResultTitle.textContent = t.resultTitle;
        if (inspectionResultSubtitle) inspectionResultSubtitle.textContent = t.resultSubtitle;
        if (btnBannerRetryText) btnBannerRetryText.textContent = t.btnRetryScan;
        if (cvQualityWarningsTitle) cvQualityWarningsTitle.textContent = t.qualityWarningsTitle;
        if (photoAdviceTitle) photoAdviceTitle.textContent = t.photoAdviceTitle;
        if (photoAdviceTip1) photoAdviceTip1.textContent = t.photoAdvice1;
        if (photoAdviceTip2) photoAdviceTip2.textContent = t.photoAdvice2;
        if (photoAdviceTip3) photoAdviceTip3.textContent = t.photoAdvice3;
        if (cvDetectedMatLabel) cvDetectedMatLabel.textContent = t.detectedMatLabel;
        if (cvTargetBinLabel) cvTargetBinLabel.textContent = t.targetBinLabel;
        if (cvConfidenceLabel) cvConfidenceLabel.textContent = t.confidenceLabel;
        if (cvLatencyLabel) cvLatencyLabel.textContent = t.latencyLabel;
        if (cvMarginLabel) cvMarginLabel.textContent = t.marginLabel;
        if (cvTopKTitle) cvTopKTitle.textContent = t.topCandidatesTitle;
        if (cvTextureLabel) cvTextureLabel.textContent = t.textureLabel;
        if (irHandlingLabel) irHandlingLabel.textContent = t.handlingLabel;
        if (irCo2KpiLabel) irCo2KpiLabel.textContent = t.kpiCo2Label;
        if (irEnergyKpiLabel) irEnergyKpiLabel.textContent = t.kpiEnergyLabel;
        if (irWaterKpiLabel) irWaterKpiLabel.textContent = t.kpiWaterLabel;
        if (btnBackStep1Text) btnBackStep1Text.textContent = t.btnBackStep1;
        if (btnGoStep3Text) btnGoStep3Text.textContent = t.btnGoStep3;

        // تحديث خيارات القائمة المنسدلة اليدوية
        if (manualSelector && t.manualOptions) {
            manualSelector.setAttribute('aria-label', t.manualSelectAria);
            Array.from(manualSelector.options).forEach(opt => {
                if (t.manualOptions[opt.value]) {
                    opt.textContent = t.manualOptions[opt.value];
                }
            });
        }

        // الخطوة 3
        const step3StartNodeLabel = document.getElementById('step3-start-node-label');
        const routeArrowSymbol = document.getElementById('route-arrow-symbol');
        const step3WasteNameLabel = document.getElementById('step3-waste-name-label');
        const btnRescanStep3Text = document.getElementById('btn-rescan-step3-text');
        const step3MapTitle = document.getElementById('step3-map-title');
        const step3MapSubtitle = document.getElementById('step3-map-subtitle');
        const btnSimulateRouteText = document.getElementById('btn-simulate-route-text');
        const btnZoomIn = document.getElementById('btn-zoom-in');
        const btnZoomOut = document.getElementById('btn-zoom-out');
        const btnResetMap = document.getElementById('btn-reset-map-view');
        const legendStudentText = document.getElementById('legend-student-text');
        const legendAvailableText = document.getElementById('legend-available-text');
        const legendFullText = document.getElementById('legend-full-text');
        const legendPathText = document.getElementById('legend-path-text');
        const step3AcademicTip = document.getElementById('step3-academic-tip');
        const step3ScrollPanTip = document.getElementById('step3-scroll-pan-tip');
        const mobileRouteBadge = document.getElementById('mobile-route-badge');
        const btnMobileSimulateText = document.getElementById('btn-mobile-simulate-text');
        const recDestBadge = document.getElementById('rec-dest-badge');
        const metricDistLabel = document.getElementById('metric-dist-label');
        const metricTimeLabel = document.getElementById('metric-time-label');
        const metricNodesLabel = document.getElementById('metric-nodes-label');
        const metricExecLabel = document.getElementById('metric-exec-label');
        const walkingStepsTitle = document.getElementById('walking-steps-title');
        const evalPanelTitle = document.getElementById('eval-panel-title');
        const evalPanelSubtitle = document.getElementById('eval-panel-subtitle');
        const thCriteria = document.getElementById('th-criteria');
        const thDijkstra = document.getElementById('th-dijkstra');
        const thAStar = document.getElementById('th-astar');
        const thConclusion = document.getElementById('th-conclusion');
        const mergeSortTitle = document.getElementById('merge-sort-title');
        const mergeSortSubtitle = document.getElementById('merge-sort-subtitle');
        const mergeSortBadge = document.getElementById('merge-sort-badge');
        const btnBackStep2Text = document.getElementById('btn-back-step2-text');
        const btnRestartStep1Text = document.getElementById('btn-restart-step-1-text');

        if (step3StartNodeLabel) step3StartNodeLabel.textContent = t.startNodeLabel;
        if (routeArrowSymbol) routeArrowSymbol.innerHTML = isRtl ? '&larr;' : '&rarr;';
        if (step3WasteNameLabel) step3WasteNameLabel.textContent = t.wasteNameLabel;
        if (btnRescanStep3Text) btnRescanStep3Text.textContent = t.btnRescanStep3;
        if (step3MapTitle) step3MapTitle.textContent = t.mapTitle;
        if (step3MapSubtitle) step3MapSubtitle.textContent = t.mapSubtitle;
        if (btnSimulateRouteText) btnSimulateRouteText.textContent = t.btnSimulate;
        if (btnZoomIn) btnZoomIn.title = t.btnZoomInTitle;
        if (btnZoomOut) btnZoomOut.title = t.btnZoomOutTitle;
        if (btnResetMap) btnResetMap.title = t.btnResetViewTitle;
        if (legendStudentText) legendStudentText.textContent = t.legendYou;
        if (legendAvailableText) legendAvailableText.textContent = t.legendAvail;
        if (legendFullText) legendFullText.textContent = t.legendFull;
        if (legendPathText) legendPathText.textContent = t.legendPath;
        if (step3AcademicTip) step3AcademicTip.innerHTML = t.mapAcademicTip;
        if (step3ScrollPanTip) step3ScrollPanTip.innerHTML = t.canvasScrollPan;
        if (mobileRouteBadge) mobileRouteBadge.textContent = t.mobileRouteBadge;
        if (btnMobileSimulateText) btnMobileSimulateText.textContent = t.mobileSimulate;
        if (recDestBadge) recDestBadge.textContent = t.recDestBadge;
        if (metricDistLabel) metricDistLabel.textContent = t.metricDistance;
        if (metricTimeLabel) metricTimeLabel.textContent = t.metricWalkingTime;
        if (metricNodesLabel) metricNodesLabel.textContent = t.metricVisitedNodes;
        if (metricExecLabel) metricExecLabel.textContent = t.metricExecTime;
        if (walkingStepsTitle) walkingStepsTitle.textContent = t.walkingStepsTitle;
        if (evalPanelTitle) evalPanelTitle.innerHTML = t.evalPanelTitle;
        if (evalPanelSubtitle) evalPanelSubtitle.textContent = t.evalPanelSubtitle;
        if (thCriteria) thCriteria.textContent = t.colCriteria;
        if (thDijkstra) thDijkstra.innerHTML = t.colDijkstra;
        if (thAStar) thAStar.innerHTML = t.colAStar;
        if (thConclusion) thConclusion.textContent = t.colConclusion;
        if (mergeSortTitle) mergeSortTitle.textContent = t.mergeSortHeading;
        if (mergeSortSubtitle) mergeSortSubtitle.innerHTML = t.mergeSortSubheading;
        if (mergeSortBadge) mergeSortBadge.textContent = t.mergeSortBadge;
        if (btnBackStep2Text) btnBackStep2Text.textContent = t.btnBackStep2;
        if (btnRestartStep1Text) btnRestartStep1Text.textContent = t.btnRestart;

        // Modal نصوص النافذة
        const modalSubtitle = document.getElementById('modal-node-subtitle');
        const btnCloseModal = document.getElementById('btn-close-node-modal');
        const modalFooterHint = document.getElementById('modal-footer-hint');
        if (modalSubtitle) modalSubtitle.textContent = t.modalSubtitle;
        if (btnCloseModal) btnCloseModal.setAttribute('aria-label', t.modalCloseAria);
        if (modalFooterHint) modalFooterHint.textContent = t.modalFooterHint;
        if (this.selectedNodeForModal) {
            this.openNodeModal(this.selectedNodeForModal);
        }

        // الفوتر
        const appFooterText = document.getElementById('app-footer-text');
        if (appFooterText) appFooterText.innerHTML = t.footerHtml;

        // تحديث الكانفاس والتقييم وسياق الخطوات
        if (this.graphCanvas) {
            this.graphCanvas.refresh();
        }

        if (this.evaluationUI) {
            this.evaluationUI.updateLanguage();
        }

        this.updateStep1SavedLocationBanner();
        this.updateStep2LocationUI();
        this.updateStep3RouteContext();
        if (this.currentStep === 3) {
            this.recalculateRoute();
        }

        // إعادة عرض الفحص الأخير باللغة الجديدة
        if (this.lastDetection) {
            this.handleWasteDetected(this.lastDetection);
        }
    }
}

window.EcoSortApp = EcoSortApp;

// تشغيل التطبيق فور اكتمال تحميل المستند
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EcoSortApp();
});
