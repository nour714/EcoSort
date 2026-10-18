/**
 * =========================================================================================
 * عارض خريطة الحرم الجامعي التفاعلي (Interactive Campus Graph Canvas)
 * =========================================================================================
 * الميزات:
 * 1. دعم شاشات Retina / High-DPI عبر window.devicePixelRatio لدقة رسومية فائقة.
 * 2. رسم مسارات المشاة بين الكليات مع أوزان الحواف الحقيقية (المسافات بالمتر).
 * 3. تمييز العقد بحالات الحاويات (🟢 متاحة - أخضر | 🔴 ممتلئة - أحمر).
 * 4. تأثيرات بصرية حركية للمسار الأقصر (Glow & Moving Dashes & Chevrons).
 * 5. محاكي تنقل تفاعلي (Route Walker Simulation) يوضح حركة الطالب عبر المسار خطوة بخطوة.
 * 6. إمكانية النقر على أي عقدة لتبديل حالتها لحظياً واختبار إعادة التوجيه الفوري للخوارزميات.
 * =========================================================================================
 */

class CampusGraphCanvas {
    constructor(canvasElement, graph, onNodeClickedCallback, onSimulationCompleteCallback) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.graph = graph;
        this.onNodeClicked = onNodeClickedCallback;
        this.onSimulationComplete = onSimulationCompleteCallback;

        // الحالة التشغيلية
        this.startNodeId = 'gate';
        this.currentWasteType = 'plastic';
        this.activePath = [];
        this.visitedNodes = [];
        this.targetNodeId = null;
        this.hoveredNodeId = null;

        // أنيميشن المسار والمحاكاة
        this.dashOffset = 0;
        this.animFrameId = null;
        this.simulationProgress = null; // 0 إلى 1 أثناء محاكاة المشي
        this.isSimulating = false;
        this.isDepositing = false;
        this.depositAnimation = null;
        this.customSimulationCallback = null;

        // دعم السحب والتقريب (Pan & Zoom)
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        this.init();
    }

    init() {
        this.setupDPI();
        this.fitGraph();
        this.bindEvents();
        this.startAnimationLoop();
        this.render();
    }

    setupDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width || 850;
        const displayHeight = rect.height || 520;

        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;

        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;

        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
    }

    fitGraph() {
        // ضبط المقياس ليتناسب مع أي شاشة هاتف أو لوحي أو حاسوب
        const cx = 435; // مركز كليات الحرم x
        const cy = 345; // مركز كليات الحرم y
        const targetWidth = 680;
        const targetHeight = 490;

        const scaleX = this.displayWidth / targetWidth;
        const scaleY = this.displayHeight / targetHeight;
        let scale = Math.min(scaleX, scaleY, 1.15) * 0.88;

        // على الهواتف نحافظ على حجم مقروء للنصوص واللمس، والمستخدم يسحب ويكبّر بأصابعه
        if (this.displayWidth < 600) {
            scale = Math.min(1, Math.max(0.5, this.displayWidth / 620));
        }

        this.scale = scale;
        this.panX = this.displayWidth / 2 - cx * this.scale;
        this.panY = this.displayHeight / 2 - cy * this.scale;
    }

    zoom(direction = 1) {
        const factor = direction > 0 ? 1.15 : 1 / 1.15;
        const newScale = Math.min(2.5, Math.max(0.45, this.scale * factor));
        
        // التقريب بالنسبة لمركز الشاشة
        const centerX = this.displayWidth / 2;
        const centerY = this.displayHeight / 2;
        
        const worldX = (centerX - this.panX) / this.scale;
        const worldY = (centerY - this.panY) / this.scale;

        this.scale = newScale;
        this.panX = centerX - worldX * newScale;
        this.panY = centerY - worldY * newScale;

        this.render();
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.setupDPI();
            this.fitGraph();
            this.render();
        });

        // رصد موضع المؤشر للتفاعل والنقر
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        this.bindTouchEvents();

        // تغيّر حجم عنصر الخريطة نفسه (دوران الشاشة، إظهار الخطوة، ...)
        if (typeof ResizeObserver !== 'undefined') {
            let lastW = 0;
            new ResizeObserver(() => {
                const w = this.canvas.getBoundingClientRect().width;
                if (w && Math.abs(w - lastW) > 1) {
                    lastW = w;
                    this.setupDPI();
                    this.fitGraph();
                    this.render();
                }
            }).observe(this.canvas);
        }

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredNodeId = null;
            this.render();
        });
    }

    /**
     * دعم اللمس: سحب بإصبع واحد لتحريك الخريطة، وتكبير/تصغير بإصبعين، ولمسة سريعة لفتح الكلية.
     */
    bindTouchEvents() {
        const TAP_MAX_MOVE = 10; // بكسل
        let mode = null;          // 'pan' | 'pinch'
        let startX = 0, startY = 0, moved = 0;
        let pinchStartDist = 0, pinchStartScale = 1;

        const touchPoint = (t) => {
            const rect = this.canvas.getBoundingClientRect();
            return { x: t.clientX - rect.left, y: t.clientY - rect.top };
        };
        const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                mode = 'pan';
                moved = 0;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                this.touchPanX = this.panX;
                this.touchPanY = this.panY;
            } else if (e.touches.length === 2) {
                mode = 'pinch';
                pinchStartDist = dist(e.touches[0], e.touches[1]);
                pinchStartScale = this.scale;
            }
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (mode === 'pan' && e.touches.length === 1) {
                const dx = e.touches[0].clientX - startX;
                const dy = e.touches[0].clientY - startY;
                moved = Math.max(moved, Math.hypot(dx, dy));
                this.panX = this.touchPanX + dx;
                this.panY = this.touchPanY + dy;
                this.render();
            } else if (mode === 'pinch' && e.touches.length === 2) {
                moved = TAP_MAX_MOVE + 1; // مش نقرة
                const newScale = Math.min(2.5, Math.max(0.45,
                    pinchStartScale * (dist(e.touches[0], e.touches[1]) / pinchStartDist)));
                const a = touchPoint(e.touches[0]);
                const b = touchPoint(e.touches[1]);
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                const worldX = (mx - this.panX) / this.scale;
                const worldY = (my - this.panY) / this.scale;
                this.scale = newScale;
                this.panX = mx - worldX * newScale;
                this.panY = my - worldY * newScale;
                this.render();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (mode === 'pan' && moved <= TAP_MAX_MOVE && e.changedTouches.length) {
                // لمسة سريعة = اختيار كلية (نصف قطر أكبر لتسهيل اللمس بالإصبع)
                const t = e.changedTouches[0];
                const rect = this.canvas.getBoundingClientRect();
                const worldX = (t.clientX - rect.left - this.panX) / this.scale;
                const worldY = (t.clientY - rect.top - this.panY) / this.scale;
                const node = this.findNodeAt(worldX, worldY, 40);
                if (node && typeof this.onNodeClicked === 'function') {
                    this.onNodeClicked(node);
                }
                e.preventDefault(); // منع click الوهمي المكرر
            }
            if (e.touches.length === 0) mode = null;
            else if (e.touches.length === 1) {
                // رجوع من pinch إلى pan بدون قفزة
                mode = 'pan';
                moved = TAP_MAX_MOVE + 1;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                this.touchPanX = this.panX;
                this.touchPanY = this.panY;
            }
        });

        this.canvas.addEventListener('touchcancel', () => { mode = null; });
    }

    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.clientX - rect.left;
        const clientY = e.clientY - rect.top;

        // تحويل الإحداثيات بالنسبة للـ Pan والـ Zoom
        const worldX = (clientX - this.panX) / this.scale;
        const worldY = (clientY - this.panY) / this.scale;

        return { x: worldX, y: worldY, clientX, clientY };
    }

    findNodeAt(worldX, worldY, radius = 32) {
        const nodes = this.graph.getAllNodes();
        for (const node of nodes) {
            const dist = Math.hypot(node.x - worldX, node.y - worldY);
            if (dist <= radius) {
                return node;
            }
        }
        return null;
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            this.panX = e.clientX - this.dragStartX;
            this.panY = e.clientY - this.dragStartY;
            this.render();
            return;
        }

        const coords = this.getCanvasCoordinates(e);
        const node = this.findNodeAt(coords.x, coords.y);
        
        const prevHover = this.hoveredNodeId;
        this.hoveredNodeId = node ? node.id : null;

        if (this.hoveredNodeId !== prevHover) {
            this.canvas.style.cursor = node ? 'pointer' : 'default';
            this.render();
        }
    }

    handleMouseDown(e) {
        // زر الفأرة الأيمن أو مفتاح Space للسحب
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            this.isDragging = true;
            this.dragStartX = e.clientX - this.panX;
            this.dragStartY = e.clientY - this.panY;
        }
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    handleClick(e) {
        const coords = this.getCanvasCoordinates(e);
        const node = this.findNodeAt(coords.x, coords.y);

        if (node && typeof this.onNodeClicked === 'function') {
            this.onNodeClicked(node);
        }
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomFactor = 1.08;
        const delta = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
        const newScale = Math.min(2.5, Math.max(0.65, this.scale * delta));

        const coords = this.getCanvasCoordinates(e);
        this.panX = coords.clientX - coords.x * newScale;
        this.panY = coords.clientY - coords.y * newScale;
        this.scale = newScale;

        this.render();
    }

    resetView() {
        this.fitGraph();
        this.render();
    }

    setNavigationData({ startNodeId, wasteType, path = [], targetNodeId = null, visitedNodes = [] }) {
        this.startNodeId = startNodeId || this.startNodeId;
        this.currentWasteType = wasteType || this.currentWasteType;
        this.activePath = path || [];
        this.targetNodeId = targetNodeId;
        this.visitedNodes = visitedNodes || [];
        this.simulationProgress = null;
        this.isSimulating = false;
        this.isDepositing = false;
        this.depositAnimation = null;

        this.render();
    }

    startAnimationLoop() {
        const animate = () => {
            this.dashOffset = (this.dashOffset - 0.7) % 24;

            // تحديث محاكاة المشي إذا كانت نشطة عبر ممرات الحرم (مسار متعدد العقد)
            if (this.isSimulating && this.activePath.length > 1) {
                this.simulationProgress += 0.007;
                if (this.simulationProgress >= 1.0) {
                    this.simulationProgress = 1.0;
                    this.isSimulating = false;
                    const cb = this.customSimulationCallback || this.onSimulationComplete;
                    this.customSimulationCallback = null;
                    if (typeof cb === 'function') {
                        cb('arrived');
                    }
                }
            }

            // تحديث أنيميشن إيداع المخلفات الفوري عند المسافة صفر
            if (this.isDepositing && this.depositAnimation) {
                this.depositAnimation.progress += 0.025;
                if (this.depositAnimation.progress >= 1.0) {
                    this.isDepositing = false;
                    const cb = this.depositAnimation.onComplete || this.customSimulationCallback || this.onSimulationComplete;
                    this.depositAnimation = null;
                    this.customSimulationCallback = null;
                    if (typeof cb === 'function') {
                        cb('self_deposit');
                    }
                }
            }

            this.render();
            this.animFrameId = requestAnimationFrame(animate);
        };

        this.animFrameId = requestAnimationFrame(animate);
    }

    /**
     * تشغيل محاكاة السير:
     * - إذا كان المسار يربط بين كليتين أو أكثر (مسافة > 0): تحريك الطالب على الممرات خطوة بخطوة.
     * - إذا كان المسافة صفر (المستخدم عند الحاوية): تشغيل تأثير أمواج الإيداع الزمردية الرائعة.
     */
    simulateRouteTraversal(onComplete) {
        if (!this.activePath || this.activePath.length === 0) {
            if (typeof onComplete === 'function') onComplete(false);
            return false;
        }

        // مسار مشي حقيقي متعدد العقد (مسافة > 0)
        if (this.activePath.length >= 2) {
            this.simulationProgress = 0;
            this.isSimulating = true;
            this.customSimulationCallback = onComplete;
            return true;
        }

        // المسافة صفر: المستخدم بالفعل عند الحاوية في موقعه الحالي
        if (this.activePath.length === 1) {
            this.isDepositing = true;
            this.depositAnimation = {
                nodeId: this.activePath[0],
                progress: 0,
                onComplete: onComplete
            };
            return 'self_deposit';
        }

        return false;
    }

    render() {
        const ctx = this.ctx;
        const width = this.displayWidth;
        const height = this.displayHeight;

        ctx.save();
        ctx.clearRect(0, 0, width, height);

        // تطبيق التحويلات (Pan & Zoom)
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.scale, this.scale);

        // 1. رسم أرضية الحرم الجامعي (Campus Grounds)
        this.drawCampusBackground(ctx);

        // 2. رسم الحواف العادية (Normal Pathways)
        this.drawEdges(ctx);

        // 3. رسم المسار الأقصر النشط مع التوهج والأنيميشن (Active Shortest Path)
        if (this.activePath && this.activePath.length > 1) {
            this.drawActivePath(ctx);
        }

        // 4. رسم العُقد (Colleges & Buildings)
        this.drawNodes(ctx);

        // 5. رسم محاكي الطالب المتحرك على المسار (Walker Marker)
        if (this.isSimulating || this.simulationProgress !== null) {
            this.drawSimulatedStudent(ctx);
        }

        // 6. رسم تأثير الإيداع الفوري عند المسافة صفر (Self-Deposit Ripple Effect)
        if (this.isDepositing && this.depositAnimation) {
            this.drawDepositEffect(ctx);
        }

        ctx.restore();
    }

    drawCampusBackground(ctx) {
        // خلفية خفيفة لمخطط الحرم
        ctx.fillStyle = '#f0fdf4';
        ctx.fillRect(-200, -200, 1400, 1100);

        // مساحات خضراء وحدائق الجامعة (Campus Green Parks)
        ctx.fillStyle = '#dcfce7';
        ctx.beginPath();
        ctx.ellipse(380, 240, 110, 70, Math.PI / 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(580, 440, 90, 60, -Math.PI / 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(220, 220, 80, 50, 0, 0, Math.PI * 2);
        ctx.fill();

        // بحيرة صناعية / نافورة مركزية في الساحة (Campus Central Fountain)
        ctx.fillStyle = '#e0f2fe';
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(380, 310, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0284c7';
        ctx.font = '10px Cairo, sans-serif';
        ctx.textAlign = 'center';
        const isEn = document.documentElement.lang === 'en';
        ctx.fillText(isEn ? 'Campus Square' : 'ميدان الجامعة', 380, 314);
    }

    drawEdges(ctx) {
        const edges = this.graph.getAllEdges();
        const activePairs = new Set();

        if (this.activePath && this.activePath.length > 1) {
            for (let i = 0; i < this.activePath.length - 1; i++) {
                const u = this.activePath[i];
                const v = this.activePath[i + 1];
                activePairs.add(`${u}->${v}`);
                activePairs.add(`${v}->${u}`);
            }
        }

        edges.forEach(edge => {
            const uNode = this.graph.getNode(edge.from);
            const vNode = this.graph.getNode(edge.to);
            if (!uNode || !vNode) return;

            const isPartOfActivePath = activePairs.has(`${edge.from}->${edge.to}`);
            if (isPartOfActivePath) return; // سيتم رسمها بشكل بارز لاحقاً

            // رسم الخط الرابط
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 3.5;
            ctx.setLineDash([4, 4]);

            ctx.beginPath();
            ctx.moveTo(uNode.x, uNode.y);
            ctx.lineTo(vNode.x, vNode.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // كتابة المسافة بالمتر في منتصف الممر
            const midX = (uNode.x + vNode.x) / 2;
            const midY = (uNode.y + vNode.y) / 2;

            this.drawDistancePill(ctx, midX, midY, `${edge.weight}م`, false);
        });
    }

    drawActivePath(ctx) {
        const path = this.activePath;
        ctx.save();

        // 1. هالة التوهج الخارجية للمسار
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < path.length; i++) {
            const node = this.graph.getNode(path[i]);
            if (!node) continue;
            if (i === 0) ctx.moveTo(node.x, node.y);
            else ctx.lineTo(node.x, node.y);
        }
        ctx.stroke();

        // 2. خط المسار الأساسي الأخضر الزمردي
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
            const node = this.graph.getNode(path[i]);
            if (!node) continue;
            if (i === 0) ctx.moveTo(node.x, node.y);
            else ctx.lineTo(node.x, node.y);
        }
        ctx.stroke();

        // 3. شريط متحرك فوق المسار يعبر عن اتجاه الحركة
        ctx.strokeStyle = '#6ee7b7';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.lineDashOffset = this.dashOffset;
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
            const node = this.graph.getNode(path[i]);
            if (!node) continue;
            if (i === 0) ctx.moveTo(node.x, node.y);
            else ctx.lineTo(node.x, node.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // إعادة كتابة المسافات على ممرات المسار النشط بأسلوب مميز
        for (let i = 0; i < path.length - 1; i++) {
            const uNode = this.graph.getNode(path[i]);
            const vNode = this.graph.getNode(path[i + 1]);
            if (!uNode || !vNode) continue;

            const neighbors = this.graph.getNeighbors(uNode.id);
            const edge = neighbors.find(n => n.node === vNode.id);
            const weight = edge ? edge.weight : 0;

            const midX = (uNode.x + vNode.x) / 2;
            const midY = (uNode.y + vNode.y) / 2;
            this.drawDistancePill(ctx, midX, midY, `${weight}م`, true);
        }

        ctx.restore();
    }

    drawDistancePill(ctx, x, y, text, isHighlight) {
        ctx.save();
        ctx.font = 'bold 11px Cairo, sans-serif';
        const metrics = ctx.measureText(text);
        const padding = 5;
        const pillWidth = metrics.width + padding * 2;
        const pillHeight = 18;

        ctx.fillStyle = isHighlight ? '#047857' : '#ffffff';
        ctx.strokeStyle = isHighlight ? '#a7f3d0' : '#e2e8f0';
        ctx.lineWidth = 1.5;

        // رسم كبسولة مستديرة
        ctx.beginPath();
        ctx.roundRect(x - pillWidth / 2, y - pillHeight / 2, pillWidth, pillHeight, 9);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isHighlight ? '#ffffff' : '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    drawNodes(ctx) {
        const nodes = this.graph.getAllNodes();

        nodes.forEach(node => {
            const isStart = node.id === this.startNodeId;
            const isTarget = node.id === this.targetNodeId;
            const isHovered = node.id === this.hoveredNodeId;
            const isVisited = this.visitedNodes.includes(node.id);
            const isAvailable = this.graph.hasAvailableBin(node.id, this.currentWasteType);

            // دائرة العقدة
            const radius = isStart || isTarget ? 30 : 25;

            // توهج خاص لنقطة البداية ونقطة الوصول
            if (isStart) {
                ctx.save();
                ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else if (isTarget) {
                ctx.save();
                ctx.fillStyle = 'rgba(16, 185, 129, 0.3)';
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius + 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // خلفية العقدة
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
            ctx.shadowBlur = isHovered ? 14 : 7;
            ctx.shadowOffsetY = 3;

            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // إطار العقدة الدال على حالة الحاوية
            // 🟢 أخضر = متاح | 🔴 أحمر = ممتلئ
            ctx.save();
            let strokeColor = isAvailable ? '#10b981' : '#ef4444';
            if (isStart) strokeColor = '#3b82f6'; // أزرق لموقع المستخدم
            
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = isHovered ? 4.5 : 3.5;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            ctx.stroke();

            // مؤشر حالة الحاوية (متاحة 🟢 أو ممتلئة 🔴)
            const badgeRadius = 7;
            const badgeX = node.x + radius * 0.7;
            const badgeY = node.y - radius * 0.7;

            ctx.fillStyle = isAvailable ? '#22c55e' : '#ef4444';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // أيقونة مبنى مصغرة أو حرف
            ctx.fillStyle = isStart ? '#2563eb' : (isAvailable ? '#059669' : '#dc2626');
            ctx.font = 'bold 13px Cairo, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const isEn = document.documentElement.lang === 'en';
            if (isStart) {
                ctx.fillText(isEn ? 'You' : 'أنت هنا', node.x, node.y - 1);
            } else if (isTarget) {
                ctx.fillText(isEn ? 'Target 🎯' : 'الهدف 🎯', node.x, node.y - 1);
            } else {
                ctx.fillText(isAvailable ? (isEn ? 'Open' : 'متاح') : (isEn ? 'Full' : 'ممتلئ'), node.x, node.y - 1);
            }

            // كتابة اسم الكلية أسفل العقدة
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 12px Cairo, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(isEn ? (node.nameEn || node.name) : node.name, node.x, node.y + radius + 6);

            // وصف الكلية أو التصنيف الفرعي بخط أصغر
            ctx.fillStyle = '#64748b';
            ctx.font = '10px Cairo, sans-serif';
            const subtitleText = isEn ? (node.subtitleEn || node.subtitle) : node.subtitle;
            ctx.fillText(subtitleText || '', node.x, node.y + radius + 22);

            ctx.restore();
        });
    }

    drawSimulatedStudent(ctx) {
        if (!this.activePath || this.activePath.length < 2) return;

        // حساب الموضع اللحظي على طول المسار متعدد القطع
        const totalSegments = this.activePath.length - 1;
        const scaledProgress = this.simulationProgress * totalSegments;
        const currentSegmentIndex = Math.min(totalSegments - 1, Math.floor(scaledProgress));
        const segmentT = scaledProgress - currentSegmentIndex;

        const uId = this.activePath[currentSegmentIndex];
        const vId = this.activePath[currentSegmentIndex + 1];

        const u = this.graph.getNode(uId);
        const v = this.graph.getNode(vId);
        if (!u || !v) return;

        const currentX = u.x + (v.x - u.x) * segmentT;
        const currentY = u.y + (v.y - u.y) * segmentT;

        ctx.save();
        // هالة المؤشر
        ctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
        ctx.beginPath();
        ctx.arc(currentX, currentY, 14, 0, Math.PI * 2);
        ctx.fill();

        // جسم الطالب المتنقل
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(currentX, currentY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // لافتة "جاري التوجه..."
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 10px Cairo, sans-serif';
        ctx.textAlign = 'center';
        const isEn = document.documentElement.lang === 'en';
        ctx.fillText(isEn ? '🏃 Walking...' : '🏃 جارِ التوجه', currentX, currentY - 16);

        ctx.restore();
    }

    /**
     * رسم تأثير أمواج التموج الزمردية وإشارة النجاح عند إيداع المخلفات الفوري (المسافة 0م)
     */
    drawDepositEffect(ctx) {
        if (!this.depositAnimation) return;
        const node = this.graph.getNode(this.depositAnimation.nodeId);
        if (!node) return;

        const p = this.depositAnimation.progress;
        const maxRadius = 55;
        const currentRadius = 25 + p * (maxRadius - 25);
        const opacity = Math.max(0, 1 - p);

        ctx.save();

        // 1. حلقة التموج الزمردية الأولى
        ctx.strokeStyle = `rgba(16, 185, 129, ${opacity * 0.9})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(node.x, node.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 2. حلقة التموج الخضراء الثانية المتأخرة
        if (p > 0.25) {
            const p2 = (p - 0.25) / 0.75;
            const r2 = 25 + p2 * (maxRadius - 25);
            ctx.strokeStyle = `rgba(34, 197, 94, ${(1 - p2) * 0.7})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // 3. لافتة "تم الفرز والإيداع 🎯" الصاعدة
        const badgeY = node.y - 36 - p * 16;
        ctx.fillStyle = `rgba(5, 150, 105, ${opacity})`;
        ctx.font = 'bold 12px Cairo, sans-serif';
        ctx.textAlign = 'center';
        const isEn = document.documentElement.lang === 'en';
        ctx.fillText(isEn ? 'Deposited & Sorted 🎯' : 'تم الفرز والإيداع 🎯', node.x, badgeY);

        ctx.restore();
    }

    /**
     * إعادة رسم اللوحة فوراً عند تغيير اللغة أو حالة العقد
     */
    refresh() {
        this.draw();
    }
}

window.CampusGraphCanvas = CampusGraphCanvas;
