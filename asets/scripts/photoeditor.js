class PhotoEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.originalImage = null;
        this.currentImage = null;
        this.settings = this.getDefaultSettings();
        this.cropMode = false;
        this.cropData = null;
        this.toneCurvePoints = [[0, 0], [255, 255]]; // Linear curve initially
        
        this.initializeEditor();
        this.setupEventListeners();
        this.drawToneCurve();
    }

    getDefaultSettings() {
        return {
            exposure: 0,
            contrast: 0,
            highlights: 0,
            shadows: 0,
            whites: 0,
            blacks: 0,
            temperature: 0,
            tint: 0,
            vibrance: 0,
            saturation: 0,
            texture: 0,
            clarity: 0,
            dehaze: 0,
            vignetteAmount: 0,
            vignetteMidpoint: 50,
            vignetteFeather: 50,
            grainAmount: 0,
            grainSize: 25,
            sharpenAmount: 25,
            sharpenRadius: 1,
            noiseLuminance: 0,
            noiseColor: 25,
            straighten: 0,
            colorMix: {
                red: { hue: 0, saturation: 0, luminance: 0 },
                orange: { hue: 0, saturation: 0, luminance: 0 },
                yellow: { hue: 0, saturation: 0, luminance: 0 },
                green: { hue: 0, saturation: 0, luminance: 0 },
                aqua: { hue: 0, saturation: 0, luminance: 0 },
                blue: { hue: 0, saturation: 0, luminance: 0 },
                purple: { hue: 0, saturation: 0, luminance: 0 },
                magenta: { hue: 0, saturation: 0, luminance: 0 }
            }
        };
    }

    initializeEditor() {
        // Update all slider value displays
        this.updateAllValueDisplays();
    }

    setupEventListeners() {
        // File input
        $('#fileInput').on('change', (e) => this.handleFileLoad(e));

        // Preset buttons
        $('.preset-btn').on('click', (e) => this.applyPreset($(e.target).data('preset')));

        // Tab switching
        $('.tab').on('click', (e) => this.switchTab($(e.target).data('tab')));

        // All sliders
        $('.slider').on('input', (e) => this.handleSliderChange(e));

        // Reset button
        $('#resetBtn').on('click', () => this.resetAll());

        // Save button
        $('#saveBtn').on('click', () => this.saveImage());

        // Aspect ratio buttons
        $('.aspect-btn').on('click', (e) => this.setAspectRatio($(e.target).data('aspect')));

        // Tone curve canvas
        $('#toneCurve').on('mousedown', (e) => this.startToneCurveEdit(e));
        $(document).on('mousemove', (e) => this.updateToneCurve(e));
        $(document).on('mouseup', () => this.endToneCurveEdit());
    }

    handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.currentImage = img;
                this.displayImage();
                this.updateHistogram();
                $('#imageInfo').text(`${img.width} × ${img.height} pixels`);
                $('.status-bar').text('Image loaded successfully');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayImage() {
        if (!this.currentImage) return;

        const containerWidth = $('.canvas-container').width() - 40;
        const containerHeight = $('.canvas-container').height() - 40;

        // Calculate display size maintaining aspect ratio
        const imgAspect = this.currentImage.width / this.currentImage.height;
        const containerAspect = containerWidth / containerHeight;

        let displayWidth, displayHeight;
        if (imgAspect > containerAspect) {
            displayWidth = Math.min(containerWidth, this.currentImage.width);
            displayHeight = displayWidth / imgAspect;
        } else {
            displayHeight = Math.min(containerHeight, this.currentImage.height);
            displayWidth = displayHeight * imgAspect;
        }

        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;

        this.ctx.clearRect(0, 0, displayWidth, displayHeight);
        this.ctx.drawImage(this.currentImage, 0, 0, displayWidth, displayHeight);
        this.applyAllEffects();
    }

    applyAllEffects() {
        if (!this.originalImage) return;

        // Create a temporary canvas for processing
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        // Draw original image
        tempCtx.drawImage(this.originalImage, 0, 0, tempCanvas.width, tempCanvas.height);

        // Get image data
        let imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        let data = imageData.data;

        // Apply effects in order
        this.applyExposureAndContrast(data);
        this.applyColorAdjustments(data);
        this.applyToneCurve(data);
        this.applyEffects(data);

        // Put processed data back
        tempCtx.putImageData(imageData, 0, 0);

        // Apply rotation if needed
        if (this.settings.straighten !== 0) {
            this.ctx.save();
            this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.rotate((this.settings.straighten * Math.PI) / 180);
            this.ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
            this.ctx.restore();
        } else {
            this.ctx.drawImage(tempCanvas, 0, 0);
        }

        this.updateHistogram();
    }

    applyExposureAndContrast(data) {
        const exposure = Math.pow(2, this.settings.exposure);
        const contrast = (this.settings.contrast + 100) / 100;
        const highlights = this.settings.highlights / 100;
        const shadows = this.settings.shadows / 100;
        const whites = this.settings.whites / 100;
        const blacks = this.settings.blacks / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // Apply exposure
            r *= exposure;
            g *= exposure;
            b *= exposure;

            // Apply contrast
            r = ((r - 0.5) * contrast) + 0.5;
            g = ((g - 0.5) * contrast) + 0.5;
            b = ((b - 0.5) * contrast) + 0.5;

            // Apply highlights and shadows
            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            if (luminance > 0.5) {
                const factor = 1 + highlights * (1 - luminance);
                r *= factor;
                g *= factor;
                b *= factor;
            } else {
                const factor = 1 + shadows * luminance;
                r *= factor;
                g *= factor;
                b *= factor;
            }

            // Apply whites and blacks
            r = r + whites * (1 - r) + blacks * r;
            g = g + whites * (1 - g) + blacks * g;
            b = b + whites * (1 - b) + blacks * b;

            // Clamp values
            data[i] = Math.max(0, Math.min(255, r * 255));
            data[i + 1] = Math.max(0, Math.min(255, g * 255));
            data[i + 2] = Math.max(0, Math.min(255, b * 255));
        }
    }

    applyColorAdjustments(data) {
        const temp = this.settings.temperature / 100;
        const tint = this.settings.tint / 100;
        const vibrance = this.settings.vibrance / 100;
        const saturation = this.settings.saturation / 100;

        for (let i = 0; i < data.length; i += 4) {
            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // Apply temperature (blue-yellow)
            if (temp > 0) {
                r = Math.min(1, r + temp * 0.3);
                g = Math.min(1, g + temp * 0.1);
                b = Math.max(0, b - temp * 0.2);
            } else {
                r = Math.max(0, r + temp * 0.2);
                g = Math.max(0, g + temp * 0.1);
                b = Math.min(1, b - temp * 0.3);
            }

            // Apply tint (green-magenta)
            if (tint > 0) {
                g = Math.min(1, g + tint * 0.2);
            } else {
                r = Math.min(1, r - tint * 0.1);
                b = Math.min(1, b - tint * 0.1);
            }

            // Convert to HSL for saturation and vibrance
            const hsl = this.rgbToHsl(r, g, b);

            // Apply vibrance (affects less saturated colors more)
            if (vibrance !== 0) {
                const vibranceEffect = vibrance * (1 - hsl[1]);
                hsl[1] = Math.max(0, Math.min(1, hsl[1] + vibranceEffect));
            }

            // Apply saturation
            if (saturation !== 0) {
                hsl[1] = Math.max(0, Math.min(1, hsl[1] * (1 + saturation)));
            }

            // Convert back to RGB
            const rgb = this.hslToRgb(hsl[0], hsl[1], hsl[2]);
            data[i] = Math.max(0, Math.min(255, rgb[0] * 255));
            data[i + 1] = Math.max(0, Math.min(255, rgb[1] * 255));
            data[i + 2] = Math.max(0, Math.min(255, rgb[2] * 255));
        }
    }

    applyToneCurve(data) {
        // Create lookup table from curve points
        const lut = new Array(256);
        for (let i = 0; i < 256; i++) {
            lut[i] = this.interpolateToneCurve(i);
        }

        for (let i = 0; i < data.length; i += 4) {
            data[i] = lut[data[i]];
            data[i + 1] = lut[data[i + 1]];
            data[i + 2] = lut[data[i + 2]];
        }
    }

    applyEffects(data) {
        const texture = this.settings.texture / 100;
        const clarity = this.settings.clarity / 100;
        const dehaze = this.settings.dehaze / 100;
        const vignetteAmount = this.settings.vignetteAmount / 100;
        const grainAmount = this.settings.grainAmount / 100;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);

        for (let i = 0; i < data.length; i += 4) {
            const pixelIndex = i / 4;
            const x = pixelIndex % width;
            const y = Math.floor(pixelIndex / width);

            let r = data[i] / 255;
            let g = data[i + 1] / 255;
            let b = data[i + 2] / 255;

            // Apply clarity (local contrast)
            if (clarity !== 0) {
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                const contrast = clarity * 0.5;
                r = r + (r - luminance) * contrast;
                g = g + (g - luminance) * contrast;
                b = b + (b - luminance) * contrast;
            }

            // Apply dehaze
            if (dehaze !== 0) {
                const factor = 1 + dehaze * 0.3;
                r = ((r - 0.5) * factor) + 0.5;
                g = ((g - 0.5) * factor) + 0.5;
                b = ((b - 0.5) * factor) + 0.5;
            }

            // Apply vignette
            if (vignetteAmount !== 0) {
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                const normalizedDistance = distance / maxDistance;
                const vignetteStrength = 1 - vignetteAmount * Math.pow(normalizedDistance, 2);
                r *= vignetteStrength;
                g *= vignetteStrength;
                b *= vignetteStrength;
            }

            // Apply grain
            if (grainAmount > 0) {
                const noise = (Math.random() - 0.5) * grainAmount * 0.1;
                r += noise;
                g += noise;
                b += noise;
            }

            // Clamp values
            data[i] = Math.max(0, Math.min(255, r * 255));
            data[i + 1] = Math.max(0, Math.min(255, g * 255));
            data[i + 2] = Math.max(0, Math.min(255, b * 255));
        }
    }

    handleSliderChange(event) {
        const slider = $(event.target);
        const id = slider.attr('id');
        const value = parseFloat(slider.val());

        // Update value display
        const valueDisplay = $(`#${id}-value`);
        if (valueDisplay.length) {
            if (id === 'straighten') {
                valueDisplay.text(value + '°');
            } else {
                valueDisplay.text(value);
            }
        }

        // Update settings
        this.updateSetting(id, value);

        // Apply changes
        this.displayImage();
    }

    updateSetting(id, value) {
        const settingMap = {
            'exposure': 'exposure',
            'contrast': 'contrast',
            'highlights': 'highlights',
            'shadows': 'shadows',
            'whites': 'whites',
            'blacks': 'blacks',
            'temperature': 'temperature',
            'tint': 'tint',
            'vibrance': 'vibrance',
            'saturation': 'saturation',
            'texture': 'texture',
            'clarity': 'clarity',
            'dehaze': 'dehaze',
            'vignette-amount': 'vignetteAmount',
            'vignette-midpoint': 'vignetteMidpoint',
            'vignette-feather': 'vignetteFeather',
            'grain-amount': 'grainAmount',
            'grain-size': 'grainSize',
            'sharpen-amount': 'sharpenAmount',
            'sharpen-radius': 'sharpenRadius',
            'noise-luminance': 'noiseLuminance',
            'noise-color': 'noiseColor',
            'straighten': 'straighten'
        };

        if (settingMap[id]) {
            this.settings[settingMap[id]] = value;
        }

        // Handle color mix sliders
        const slider = $(`#${id}`);
        if (slider.data('color') && slider.data('type')) {
            const color = slider.data('color');
            const type = slider.data('type');
            this.settings.colorMix[color][type] = value;
        }
    }

    applyPreset(preset) {
        this.resetAll();

        const presets = {
            'original': {},
            'bw': {
                saturation: -100
            },
            'warm': {
                temperature: 30,
                tint: 10,
                highlights: -20,
                shadows: 20
            },
            'cold': {
                temperature: -30,
                tint: -10,
                highlights: 10,
                shadows: -10
            },
            'cinematic': {
                contrast: 25,
                highlights: -30,
                shadows: 30,
                vignetteAmount: -20,
                clarity: 15
            },
            'vintage': {
                exposure: 0.2,
                contrast: -15,
                highlights: -40,
                shadows: 15,
                temperature: 15,
                saturation: -20,
                vignetteAmount: -30,
                grainAmount: 25
            },
            'dramatic': {
                contrast: 40,
                clarity: 30,
                dehaze: 20,
                blacks: -20,
                whites: 15
            },
            'soft': {
                contrast: -20,
                highlights: -20,
                shadows: 20,
                clarity: -15
            }
        };

        const presetSettings = presets[preset] || {};
        Object.keys(presetSettings).forEach(key => {
            this.settings[key] = presetSettings[key];
        });

        this.updateAllSliders();
        this.displayImage();
    }

    updateAllSliders() {
        Object.keys(this.settings).forEach(key => {
            const slider = this.getSliderBySettingKey(key);
            if (slider) {
                slider.val(this.settings[key]);
                const valueDisplay = $(`#${slider.attr('id')}-value`);
                if (valueDisplay.length) {
                    valueDisplay.text(this.settings[key]);
                }
            }
        });
    }

    updateAllValueDisplays() {
        $('.slider').each((i, slider) => {
            const $slider = $(slider);
            const id = $slider.attr('id');
            const value = $slider.val();
            const valueDisplay = $(`#${id}-value`);
            if (valueDisplay.length) {
                if (id === 'straighten') {
                    valueDisplay.text(value + '°');
                } else {
                    valueDisplay.text(value);
                }
            }
        });
    }

    getSliderBySettingKey(settingKey) {
        const keyMap = {
            'exposure': '#exposure',
            'contrast': '#contrast',
            'highlights': '#highlights',
            'shadows': '#shadows',
            'whites': '#whites',
            'blacks': '#blacks',
            'temperature': '#temperature',
            'tint': '#tint',
            'vibrance': '#vibrance',
            'saturation': '#saturation',
            'texture': '#texture',
            'clarity': '#clarity',
            'dehaze': '#dehaze',
            'vignetteAmount': '#vignette-amount',
            'vignetteMidpoint': '#vignette-midpoint',
            'vignetteFeather': '#vignette-feather',
            'grainAmount': '#grain-amount',
            'grainSize': '#grain-size',
            'sharpenAmount': '#sharpen-amount',
            'sharpenRadius': '#sharpen-radius',
            'noiseLuminance': '#noise-luminance',
            'noiseColor': '#noise-color',
            'straighten': '#straighten'
        };

        return keyMap[settingKey] ? $(keyMap[settingKey]) : null;
    }

    switchTab(tabName) {
        // Main tabs
        if (['crop', 'edit'].includes(tabName)) {
            $('.tab[data-tab="crop"], .tab[data-tab="edit"]').removeClass('active');
            $(`.tab[data-tab="${tabName}"]`).addClass('active');
            $('#crop-tab, #edit-tab').removeClass('active');
            $(`#${tabName}-tab`).addClass('active');
        }

        // Edit sub-tabs
        if (['light', 'color', 'effect', 'detail'].includes(tabName)) {
            $('#edit-tab .tab').removeClass('active');
            $(`.tab[data-tab="${tabName}"]`).addClass('active');
            $('#edit-tab .tab-content').removeClass('active');
            $(`#${tabName}-content`).addClass('active');
        }
    }

    resetAll() {
        this.settings = this.getDefaultSettings();
        this.toneCurvePoints = [[0, 0], [255, 255]];
        this.updateAllSliders();
        this.drawToneCurve();
        if (this.originalImage) {
            this.displayImage();
        }
    }

    saveImage() {
        if (!this.canvas) return;

        const link = document.createElement('a');
        link.download = 'edited-image.png';
        link.href = this.canvas.toDataURL();
        link.click();
    }

    updateHistogram() {
        if (!this.canvas) return;

        const histogramCanvas = document.getElementById('histogram');
        const histCtx = histogramCanvas.getContext('2d');
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Initialize histograms
        const red = new Array(256).fill(0);
        const green = new Array(256).fill(0);
        const blue = new Array(256).fill(0);

        // Count pixel values
        for (let i = 0; i < data.length; i += 4) {
            red[data[i]]++;
            green[data[i + 1]]++;
            blue[data[i + 2]]++;
        }

        // Find max for normalization
        const maxR = Math.max(...red);
        const maxG = Math.max(...green);
        const maxB = Math.max(...blue);
        const max = Math.max(maxR, maxG, maxB);

        // Clear histogram canvas
        histCtx.clearRect(0, 0, 260, 100);

        // Draw histograms
        const drawHistogram = (values, color, alpha) => {
            histCtx.globalAlpha = alpha;
            histCtx.fillStyle = color;
            for (let i = 0; i < 256; i++) {
                const height = (values[i] / max) * 100;
                histCtx.fillRect(i, 100 - height, 1, height);
            }
        };

        drawHistogram(red, '#ff4444', 0.7);
        drawHistogram(green, '#44ff44', 0.7);
        drawHistogram(blue, '#4444ff', 0.7);

        histCtx.globalAlpha = 1;
    }

    // Color space conversion utilities
    rgbToHsl(r, g, b) {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [h, s, l];
    }

    hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [r, g, b];
    }

    // Tone curve methods
    drawToneCurve() {
        const canvas = document.getElementById('toneCurve');
        const ctx = canvas.getContext('2d');
        
        ctx.clearRect(0, 0, 260, 150);
        
        // Draw grid
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const x = (i / 4) * 260;
            const y = (i / 4) * 150;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 150);
            ctx.moveTo(0, y);
            ctx.lineTo(260, y);
            ctx.stroke();
        }

        // Draw diagonal reference line
        ctx.strokeStyle = '#666';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, 150);
        ctx.lineTo(260, 0);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw curve
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < 256; x++) {
            const y = 150 - (this.interpolateToneCurve(x) / 255) * 150;
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // Draw control points
        ctx.fillStyle = '#007acc';
        this.toneCurvePoints.forEach(point => {
            const x = point[0];
            const y = 150 - (point[1] / 255) * 150;
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    interpolateToneCurve(x) {
        if (this.toneCurvePoints.length < 2) return x;

        // Find the two points to interpolate between
        let i = 0;
        while (i < this.toneCurvePoints.length - 1 && this.toneCurvePoints[i + 1][0] < x) {
            i++;
        }

        if (i === this.toneCurvePoints.length - 1) {
            return this.toneCurvePoints[i][1];
        }

        const p1 = this.toneCurvePoints[i];
        const p2 = this.toneCurvePoints[i + 1];

        const t = (x - p1[0]) / (p2[0] - p1[0]);
        return p1[1] + t * (p2[1] - p1[1]);
    }

    startToneCurveEdit(e) {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Convert to curve coordinates
        const curveX = Math.max(0, Math.min(255, x));
        const curveY = Math.max(0, Math.min(255, 255 - (y / 150) * 255));

        // Find or create point
        this.toneCurveEditMode = true;
        this.toneCurvePoints.push([curveX, curveY]);
        this.toneCurvePoints.sort((a, b) => a[0] - b[0]);
        
        this.drawToneCurve();
    }

    updateToneCurve(e) {
        if (!this.toneCurveEditMode) return;

        const canvas = document.getElementById('toneCurve');
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x >= 0 && x <= 260 && y >= 0 && y <= 150) {
            const curveX = Math.max(0, Math.min(255, x));
            const curveY = Math.max(0, Math.min(255, 255 - (y / 150) * 255));

            // Update the last point
            if (this.toneCurvePoints.length > 0) {
                this.toneCurvePoints[this.toneCurvePoints.length - 1] = [curveX, curveY];
                this.toneCurvePoints.sort((a, b) => a[0] - b[0]);
                this.drawToneCurve();
                if (this.originalImage) {
                    this.displayImage();
                }
            }
        }
    }

    endToneCurveEdit() {
        this.toneCurveEditMode = false;
    }

    setAspectRatio(aspect) {
        $('.aspect-btn').removeClass('active');
        $(`.aspect-btn[data-aspect="${aspect}"]`).addClass('active');
        // Aspect ratio logic would be implemented here
        console.log('Aspect ratio set to:', aspect);
    }
}